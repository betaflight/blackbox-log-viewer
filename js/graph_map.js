"use strict";

function MapGrapher() {
  var userSettings,
    myMap,
    that = this,
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
    groundCourseIndexAtFrame,
    flightLog;

  const coordinateDivider = 10000000;
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

  // debug circles can be used to aligh icons with the correct coordinates
  const debugCircle = false;
  const debugCircleOptions = {
    color: "red",
    fillColor: "red",
    fillOpacity: 0.8,
    radius: 1,
  };

  this.init = function (options) {
    if (myMap) return;
    userSettings = options;

    myMap = L.map("mapContainer", mapOptions);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 1,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(myMap);

    this.setFlightType();
  };

  this.reset = function () {
    console.log("reset");
    // this.clearMap(0);
    // trailLayers = new Map();
    // previousLogIndex = null;
    // myMap.setView([0, 0], 1);

    // reset points map
  };

  this.setFlightLog = function (newFlightLog) {
    flightLog = newFlightLog;

    const newLogStartDateTime = flightLog.getSysConfig()["Log start datetime"];
    if (currentLogStartDateTime != newLogStartDateTime) {
      this.reset();
      currentLogStartDateTime = newLogStartDateTime;
    }

    // time was intended to mark the trail with a different color when IN/OUT is set.
    // the problem is that simplification of the curve should be done in 2/3 parts depending on IN/OUT
    // if IN is set: from startTime to IN - from IN to endTime (2 parts)
    // if OUT is set: from startTime to OUT - from OUT to endTime (2 parts)
    // if BOTH are set: from startTime to IN - from IN to OUT - from OUT to endTime (3 parts)
    // const time = flightLog.getMainFieldIndexByName("time");
    latIndexAtFrame = flightLog.getMainFieldIndexByName("GPS_coord[0]");
    lngIndexAtFrame = flightLog.getMainFieldIndexByName("GPS_coord[1]");
    groundCourseIndexAtFrame =
      flightLog.getMainFieldIndexByName("GPS_ground_course");

    const logIndex = flightLog.getLogIndex();

    const chunks = flightLog.getChunksInTimeRange(
      flightLog.getMinTime(),
      flightLog.getMaxTime()
    );
    const chunksLength = chunks.length;

    let latlngs = [];

    // if this log is already proccesed its skipped
    if (trailLayers.has(logIndex)) return;

    for (let ci = 0; ci < chunksLength; ci++) {
      const chunk = chunks[ci];
      const frames = chunk.frames;

      for (let fi = 0; fi < frames.length; fi++) {
        const frame = frames[fi];

        const coordinates = this.getCoordinatesFromFrame(
          frame,
          latIndexAtFrame,
          lngIndexAtFrame
        );

        // if we have no values we skip the frame
        if (!coordinates) continue;
        latlngs.push(coordinates);
      }
    }

    const polyline = L.polyline(latlngs, polylineOptions);

    trailLayers.set(logIndex, polyline);

    if (latlngs.length > 0)
      homePosition = this.getHomeCoordinatesFromFlightLog(flightLog);
  };

  this.updateCurrentPosition = function () {
    try {
      const frame = flightLog.getCurrentFrameAtTime(currentTime);
      craftPosition = this.getCoordinatesFromFrame(
        frame.current,
        latIndexAtFrame,
        lngIndexAtFrame
      );
      groundCourse = this.getGroundCourseFromFrame(
        frame.current,
        groundCourseIndexAtFrame
      );
    } catch (e) {}
  };

  this.redraw = function () {
    if (trailLayers.size <= 0) return;
    if (!myMap) return;

    // If flightLog has changed redraw flight trail
    const currentLogIndex = flightLog.getLogIndex();
    if (previousLogIndex != currentLogIndex) {
      this.clearMap(previousLogIndex);
      if (trailLayers.has(currentLogIndex)) {
        const polyline = trailLayers.get(currentLogIndex);
        polyline.addTo(myMap);
        myMap.fitBounds(polyline.getBounds());
      }

      previousLogIndex = currentLogIndex;
    }

    // home
    if (homePosition) {
      if (homeMarker) {
        homeMarker.icon.setLatLng(homePosition).addTo(myMap);

        // debug circle
        if (debugCircle) homeMarker.circle.setLatLng(homePosition).addTo(myMap);
      } else {
        homeMarker = {};
        console.log("homePosition", homePosition);

        homeMarker.icon = L.marker(homePosition, {
          icon: homeIcon,
        }).addTo(myMap);

        // debug circle
        if (debugCircle)
          homeMarker.circle = L.circle(homePosition, debugCircleOptions).addTo(
            myMap
          );
      }
    }

    // //aircraft
    if (craftPosition) {
      if (craftMarker) {
        craftMarker.icon.setLatLng(craftPosition);
        craftMarker.icon.setRotationAngle(groundCourse).addTo(myMap);
        // debug circle
        if (debugCircle)
          homeMarker.circle.setLatLng(craftPosition).addTo(myMap);
      } else {
        craftMarker = {};
        craftMarker.icon = L.rotatedMarker(craftPosition, {
          icon: craftIcon,
          rotationAngle: groundCourse,
          rotationOrigin: "center center",
        }).addTo(myMap);

        // debug circle
        if (debugCircle)
          craftMarker.circle = L.circle(
            craftPosition,
            debugCircleOptions
          ).addTo(myMap);
      }
    }
  };

  this.clearMap = function (index) {
    if (trailLayers.has(index)) {
      myMap.removeLayer(trailLayers.get(index));
    }
    if (homeMarker) {
      myMap.removeLayer(homeMarker.icon);
      myMap.removeLayer(homeMarker.circle);
    }
    if (craftMarker) {
      myMap.removeLayer(craftMarker.icon);
      myMap.removeLayer(craftMarker.circle);
    }
  };

  this.resize = function (width, height) {
    console.log("this.resize");
    // if (!userSettings) return;

    // const containerstyle = {
    //   // height: height * parseInt(userSettings.map.size) / 100.0,
    //   // width: height * parseInt(userSettings.map.size) / 100.0,
    //   left: (width * parseInt(userSettings.map.left)) / 100.0,
    //   top: (height * parseInt(userSettings.map.top)) / 100.0,
    // };

    // const canvasstyle = {
    //   height: (height * parseInt(userSettings.map.size)) / 100.0,
    //   width: (width * parseInt(userSettings.map.size)) / 100.0,
    //   // left: (height * parseInt(userSettings.map.left) / 100.0),
    //   // top:  (height * parseInt(userSettings.map.top) / 100.0)
    // };

    // $("#mapContainer").css(containerstyle);
    // $("#mapContainer .leaflet-container").css(canvasstyle);

    // redraw();
  };

  this.getCoordinatesFromFrame = function (frame, latIndex, lngIndex) {
    const lat = frame[latIndex];
    const lng = frame[lngIndex];
    return typeof lat == "number" || typeof lng == "number"
      ? [lat / coordinateDivider, lng / coordinateDivider]
      : null;
  };

  this.getGroundCourseFromFrame = function (frame, groundCourseIndex) {
    const gc = frame[groundCourseIndex];
    return typeof gc == "number" ? gc / grounCourseDivider : 0;
  };

  this.getHomeCoordinatesFromFlightLog = function (flightLog) {
    const home = flightLog.getStats().frame.H.field;
    return [home[0].min / coordinateDivider, home[1].min / coordinateDivider];
  };

  this.setFlightType = function () {
    if ($("html").hasClass("isBF")) flightType = "isBF";
    else if ($("html").hasClass("isCF")) flightType = "isCF";
    else if ($("html").hasClass("isINAV")) flightType = "isINAV";
    else flightType = "isBF";
  };

  this.setCurrentTime = function (newTime) {
    currentTime = newTime;
    this.updateCurrentPosition();
    this.redraw();
  };
}
