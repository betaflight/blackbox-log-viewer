export function MapGrapher() {
  let userSettings,
    myMap,
    currentLogStartDateTime,
    currentTime,
    craftPosition,
    groundCourse,
    homePosition,
    craftMarker,
    homeMarker,
    trailLayers = new Map(),
    previousLogIndex,
    latIndexAtFrame,
    lngIndexAtFrame,
    altitudeIndexAtFrame,
    groundCourseIndexAtFrame,
    flightLog;

  const coordinateDivider = 10000000;
  const altitudeDivider = 10;
  const grounCourseDivider = 10;

  const mapOptions = {
    center: [0, 0],
    zoom: 1,
  };

  const craftIcon = L.icon({
    iconUrl: "../images/markers/craft.png",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: "icon",
  });

  const homeIcon = L.icon({
    iconUrl: "../images/markers/home.png",
    iconSize: [40, 40],
    iconAnchor: [20, 35],
    className: "icon",
  });

  const polylineOptions = {
    color: "#2db0e3",
    opacity: 0.8,
    smoothFactor: 1,
  };

  // flight trail colors
  const colorTrailGradient = [
    { color: "#00ffe0bf" },
    { color: "#00ff8cbf" },
    { color: "#00ff02bf" },
    { color: "#75ff00bf" },
    { color: "#e5ff00bf" },
    { color: "#ffb100bf" },
    { color: "#ff4c00bf" },
    { color: "#ff1414" },
  ];

  // debug circles can be used to aligh icons at the correct coordinates
  const debugCircle = false;
  const debugCircleOptions = {
    color: "red",
    fillColor: "red",
    fillOpacity: 0.8,
    radius: 1,
  };

  this.initialize = function () {
    if (myMap) {
      return;
    }

    myMap = L.map("mapContainer", mapOptions);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 1,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(myMap);
  };

  this.reset = function () {
    if (!myMap) {
      return;
    }
    this.clearMap(previousLogIndex);
    previousLogIndex = null;
    currentTime = null;
    craftPosition = null;
    groundCourse = null;
    homePosition = null;
    craftMarker = null;
    homeMarker = null;
    trailLayers = new Map();
    previousLogIndex = null;
    latIndexAtFrame = null;
    lngIndexAtFrame = null;
    altitudeIndexAtFrame = null;
    groundCourseIndexAtFrame = null;
    myMap.setView(mapOptions.center, mapOptions.zoom);
  };

  this.setFlightLog = function (newFlightLog) {
    flightLog = newFlightLog;

    const newLogStartDateTime = flightLog.getSysConfig()["Log start datetime"];
    if (currentLogStartDateTime != newLogStartDateTime) {
      this.reset();
      currentLogStartDateTime = newLogStartDateTime;
    }

    const logIndex = flightLog.getLogIndex();

    // if this log is already proccesed its skipped
    if (trailLayers.has(logIndex)) {
      return;
    }

    this.setFlightLogIndexs();
    let { latlngs, maxAlt, minAlt } = this.getPolylinesData();

    const hasGpsData = latlngs.length > 0;

    if (hasGpsData) {
      const polyline = L.polyline(latlngs, polylineOptions);

      const polylineC = this.createAltitudeColoredPolyline(
        latlngs,
        maxAlt,
        minAlt
      );

      trailLayers.set(logIndex, { polyline, polylineC });

      homePosition = this.getHomeCoordinatesFromFlightLog(flightLog);
    } else {
      console.debug("FlightLog has no gps data.");
    }

    $("#mapContainer").toggleClass("no-gps-data", !hasGpsData);
  };

  this.setFlightLogIndexs = function () {
    latIndexAtFrame = flightLog.getMainFieldIndexByName("GPS_coord[0]");
    lngIndexAtFrame = flightLog.getMainFieldIndexByName("GPS_coord[1]");
    altitudeIndexAtFrame = flightLog.getMainFieldIndexByName("GPS_altitude");
    groundCourseIndexAtFrame =
      flightLog.getMainFieldIndexByName("GPS_ground_course");
  };

  this.getPolylinesData = function () {
    let latlngs = [];
    let maxAlt = Number.MIN_VALUE;
    let minAlt = Number.MAX_VALUE;

    const chunks = flightLog.getChunksInTimeRange(
      flightLog.getMinTime(),
      flightLog.getMaxTime()
    );

    for (const chunk of chunks) {
      for (const fi in chunk.frames) {
        const frame = chunk.frames[fi];
        const coordinates = this.getCoordinatesFromFrame(
          frame,
          latIndexAtFrame,
          lngIndexAtFrame,
          altitudeIndexAtFrame
        );

        // if there are no coordinates the frame is skipped
        if (!coordinates) {
          continue;
        }

        // Altitude max and min values can be obtained from the stats but fixing the index at 4 doesn't seem safe
        // const maxAlt = flightLog.getStats().frame.G.field[4].max / altitudeDivider;
        // const minAlt = flightLog.getStats().frame.G.field[4].min / altitudeDivider;
        maxAlt = coordinates.alt > maxAlt ? coordinates.alt : maxAlt;
        minAlt = coordinates.alt < minAlt ? coordinates.alt : minAlt;

        // 1/4 of the dots is enough to draw the line
        if (fi % 4 == 0) {
          latlngs.push(coordinates);
        }
      }
    }
    return { latlngs, maxAlt, minAlt };
  };

  this.createAltitudeColoredPolyline = function (latlngs, maxAlt, minAlt) {
    const divider = colorTrailGradient.length - 1;

    const delta = maxAlt - minAlt;

    const thresholdIncrement = delta / divider;

    let altThresholds = [];
    let threshold = minAlt;
    for (let i = 0; i < divider; i++) {
      //amount of colors - min and max that are set
      threshold += thresholdIncrement;
      altThresholds.push(threshold);
    }

    return L.multiOptionsPolyline(latlngs, {
      multiOptions: {
        optionIdxFn: function (latLng) {
          for (let i = 0; i < altThresholds.length; i++) {
            if (latLng.alt <= altThresholds[i]) {
              return i;
            }
          }
          return altThresholds.length;
        },
        options: colorTrailGradient,
      },
      weight: 3,
      lineCap: "butt",
      opacity: 1,
      smoothFactor: 1,
    });
  };

  this.updateCurrentPosition = function () {
    try {
      const frame = flightLog.getCurrentFrameAtTime(currentTime);
      craftPosition = this.getCoordinatesFromFrame(
        frame.current,
        latIndexAtFrame,
        lngIndexAtFrame,
        altitudeIndexAtFrame
      );
      groundCourse = this.getGroundCourseFromFrame(
        frame.current,
        groundCourseIndexAtFrame
      );
    } catch (e) {}
  };

  this.setUserSettings = function (newUserSettings) {
    globalThis.userSettings = newUserSettings;
  };

  this.redrawAll = function () {
    if (trailLayers.size <= 0 || !myMap) {
      return;
    }

    this.redrawFlightTrail();
    this.redrawHomeMarker();
    this.redrawCraftMarker();
  };

  this.redrawFlightTrail = function () {
    // If flightLog has changed redraw flight trail
    const currentLogIndex = flightLog.getLogIndex();
    if (previousLogIndex != currentLogIndex) {
      this.clearMap(previousLogIndex);
      if (trailLayers.has(currentLogIndex)) {
        const polyline = userSettings.mapTrailAltitudeColored
          ? trailLayers.get(currentLogIndex).polylineC
          : trailLayers.get(currentLogIndex).polyline;
        polyline.addTo(myMap);
        myMap.fitBounds(polyline.getBounds());
      }

      previousLogIndex = currentLogIndex;
    }
  };

  this.redrawHomeMarker = function () {
    if (homePosition) {
      if (homeMarker) {
        homeMarker.icon.setLatLng(homePosition).addTo(myMap);

        // debug circle
        if (debugCircle) {
          homeMarker.circle.setLatLng(homePosition).addTo(myMap);
        }
      } else {
        homeMarker = {};

        homeMarker.icon = L.marker(homePosition, {
          icon: homeIcon,
        }).addTo(myMap);

        // debug circle
        if (debugCircle) {
          homeMarker.circle = L.circle(homePosition, debugCircleOptions).addTo(
            myMap
          );
        }
      }
    }
  };

  this.redrawCraftMarker = function () {
    if (craftPosition) {
      if (craftMarker) {
        craftMarker.icon.setLatLng(craftPosition);
        craftMarker.icon.setRotationAngle(groundCourse).addTo(myMap);
        // debug circle
        if (debugCircle) {
          homeMarker.circle.setLatLng(craftPosition).addTo(myMap);
        }
      } else {
        craftMarker = {};
        craftMarker.icon = L.rotatedMarker(craftPosition, {
          icon: craftIcon,
          rotationAngle: groundCourse,
          rotationOrigin: "center center",
        }).addTo(myMap);

        // debug circle
        if (debugCircle) {
          craftMarker.circle = L.circle(
            craftPosition,
            debugCircleOptions
          ).addTo(myMap);
        }
      }
    }
  };

  this.clearMap = function (trailIndex) {
    this.clearMapFlightTrails(trailIndex);
    this.clearMapMarkers();
  };

  this.clearMapFlightTrails = function (trailIndex) {
    if (trailLayers.has(trailIndex)) {
      const p = trailLayers.get(trailIndex).polyline;
      const pc = trailLayers.get(trailIndex).polylineC;
      if (p) {
        myMap.removeLayer(p);
      }
      if (pc) {
        myMap.removeLayer(pc);
      }
    }
  };

  this.clearMapMarkers = function () {
    if (homeMarker) {
      if (myMap.hasLayer(homeMarker.icon)) {
        myMap.removeLayer(homeMarker.icon);
      }
      if (debugCircle && myMap.hasLayer(homeMarker.circle)) {
        myMap.removeLayer(homeMarker.circle);
      }
    }
    if (craftMarker) {
      if (myMap.hasLayer(craftMarker.icon)) {
        myMap.removeLayer(craftMarker.icon);
      }
      if (debugCircle && myMap.hasLayer(craftMarker.circle)) {
        myMap.removeLayer(craftMarker.circle);
      }
    }
  };

  this.resize = function (width, height) {
    if (!userSettings) {
      return;
    }
    const containerstyle = {
      height: (height * parseInt(userSettings.map.size)) / 100.0,
      width: (width * parseInt(userSettings.map.size)) / 100.0,
      left: (width * parseInt(userSettings.map.left)) / 100.0,
      top: (height * parseInt(userSettings.map.top)) / 100.0,
    };
    $("#mapContainer").css(containerstyle);
  };

  this.getCoordinatesFromFrame = function (
    frame,
    latIndex,
    lngIndex,
    altitudeIndex
  ) {
    const lat = frame[latIndex];
    const lng = frame[lngIndex];
    const alt = frame[altitudeIndex];

    return this.isNumber(lat) && this.isNumber(lng)
      ? L.latLng(
          lat / coordinateDivider,
          lng / coordinateDivider,
          alt / altitudeDivider
        )
      : null;
  };

  this.isNumber = function (n) {
    return typeof n === "number" && !isNaN(n);
  };

  this.getGroundCourseFromFrame = function (frame, groundCourseIndex) {
    const gc = frame[groundCourseIndex];
    return typeof gc == "number" ? gc / grounCourseDivider : 0;
  };

  this.getHomeCoordinatesFromFlightLog = function (flightLog) {
    const home = flightLog.getStats().frame.H.field;
    return [home[0].min / coordinateDivider, home[1].min / coordinateDivider];
  };

  this.setCurrentTime = function (newTime) {
    currentTime = newTime;
    this.updateCurrentPosition();
    this.redrawAll();
  };
}
