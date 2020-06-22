"use strict";

// Global Level Variables
var userSettings = {};

var VIEWER_VERSION = getManifestVersion(); // Current version

const INNER_BOUNDS_WIDTH  = 1340;
const INNER_BOUNDS_HEIGHT = 900;
const INITIAL_APP_PAGE = "index.html";

function BlackboxLogViewer() {
    function supportsRequiredAPIs() {
        return window.File && window.FileReader && window.FileList && Modernizr.canvas;
    }
    
    if (!supportsRequiredAPIs()) {
        alert("Your browser does not support the APIs required for reading log files.");
    }
    
    var
        GRAPH_STATE_PAUSED = 0,
        GRAPH_STATE_PLAY = 1,
        
        SMALL_JUMP_TIME = 100 * 1000,
        PLAYBACK_MIN_RATE = 10,
        PLAYBACK_MAX_RATE = 300,
        PLAYBACK_DEFAULT_RATE = 100,
        PLAYBACK_RATE_STEP = 5,
        GRAPH_MIN_ZOOM = 10,
        GRAPH_MAX_ZOOM = 1000,
        GRAPH_DEFAULT_ZOOM = 100,
        GRAPH_ZOOM_STEP = 10;
    
    var
        graphState = GRAPH_STATE_PAUSED,
        currentBlackboxTime = 0,
        lastRenderTime = false,
        flightLog, flightLogDataArray,
        graph = null,
        latestVersion,
        
        prefs = new PrefStorage(),
        
        configuration = null,           					       // is their an associated dump file ?
        configurationDefaults = new ConfigurationDefaults(prefs),  // configuration defaults

        // User's video render config:
        videoConfig = {},
        
        // JSON graph configuration:
        graphConfig = {},
        

        offsetCache = [], // Storage for the offset cache (last 20 files)
        currentOffsetCache = {log:null, index:null, video:null, offset:null},

        // JSON array of graph configurations for New Workspaces feature
        lastGraphConfig = null,     // Undo feature - go back to last configuration.
        workspaceGraphConfigs = [], // Workspaces
        activeWorkspace = 1,        // Active Workspace
        bookmarkTimes	= [],		// Empty array for bookmarks (times)
        
        // Graph configuration which is currently in use, customised based on the current flight log from graphConfig
        activeGraphConfig = new GraphConfig(),
        
        graphLegend = null,
        workspaceSelection = null,
        fieldPresenter = FlightLogFieldPresenter,
        
        hasVideo = false, hasLog = false, hasMarker = false, // add measure feature
        hasTable = true, hasAnalyser, hasAnalyserFullscreen,
        hasAnalyserSticks = false, viewVideo = true, hasTableOverlay = false, hadTable,
        hasConfig = false, hasConfigOverlay = false,

        isFullscreen = false, // New fullscreen feature (to hide table)

        video = $(".log-graph video")[0],
        canvas = $("#graphCanvas")[0],
        analyserCanvas = $("#analyserCanvas")[0],
        stickCanvas = $("#stickCanvas")[0],
        craftCanvas = $("#craftCanvas")[0],
        statusBar = $('#status-bar'),
        html = $('html'),


        videoURL = false,
        videoOffset = 0.0,
        
        videoExportInTime = false,
        videoExportOutTime = false,

        markerTime = 0, // New marker time
        
        graphRendersCount = 0,
        
        seekBarCanvas = $(".log-seek-bar canvas")[0],
        seekBar = new SeekBar(seekBarCanvas),
        
        seekBarRepaintRateLimited = $.throttle(200, $.proxy(seekBar.repaint, seekBar)),
        
        updateValuesChartRateLimited,
        
        animationFrameIsQueued = false,
        
        playbackRate = PLAYBACK_DEFAULT_RATE,

        graphZoom = GRAPH_DEFAULT_ZOOM,
        lastGraphZoom = GRAPH_DEFAULT_ZOOM; // QuickZoom function.

        function createNewBlackboxWindow(fileToOpen) {
            var timestampId = Date.now();
            if (isNW()) {
                const gui = require('nw.gui');
                gui.Window.open(INITIAL_APP_PAGE,
                {
                    'min_width'  : INNER_BOUNDS_WIDTH,
                    'min_height' : INNER_BOUNDS_HEIGHT,
                },
                function (createdWindow) {
                    if (fileToOpen !== undefined) {
                        createdWindow.window.argv = fileToOpen;
                    }
                });

            } else {
                chrome.app.window.create(INITIAL_APP_PAGE,
                {
                    'id': "main" + timestampId,
                    'innerBounds' : {
                        'width'  : INNER_BOUNDS_WIDTH,
                        'height' : INNER_BOUNDS_HEIGHT,
                    },
                },
                function (createdWindow) {
                    if (fileToOpen !== undefined) {
                        createdWindow.contentWindow.argv = fileToOpen;
                    }
                });
            }
        }

    function blackboxTimeFromVideoTime() {
        return (video.currentTime - videoOffset) * 1000000 + flightLog.getMinTime();
    }
    
    function syncLogToVideo() {
        if (hasLog) {
            currentBlackboxTime = blackboxTimeFromVideoTime();
        }
    }
    
    function setVideoOffset(offset, withRefresh) { // optionally prevent the graph refresh until later
        videoOffset = offset;
        
        /* 
         * Round to 2 dec places for display and put a plus at the start for positive values to emphasize the fact it's
         * an offset
         */
        $(".video-offset").val((videoOffset >= 0 ? "+" : "") + (videoOffset.toFixed(3) != videoOffset ? videoOffset.toFixed(3) : videoOffset));
        
        if (withRefresh) invalidateGraph();
    }
    
    function isInteger(value) {
        return (value | 0) == value || Math.trunc(value) == value;
    }
    
    function atMost2DecPlaces(value) {
        if (isInteger(value))
            return value; //it's an integer already
    
        if (value === null)
            return "(absent)";
        
        return value.toFixed(2);
    }
    
    function updateValuesChart() {
        var 
            table = $(".log-field-values table"),
            i,
            frame = flightLog.getSmoothedFrameAtTime(currentBlackboxTime),
            fieldNames = flightLog.getMainFieldNames();
        
        $("tr:not(:first)", table).remove();

        if (frame) {

            var currentFlightMode = frame[flightLog.getMainFieldIndexByName("flightModeFlags")];

            if(hasTable || hasTableOverlay) { // Only redraw the table if it is enabled

                var 
                    rows = [],
                    rowCount = Math.ceil(fieldNames.length / 2);

                for (i = 0; i < rowCount; i++) {
                    var 
                        row = 
                            "<tr>" +
                            '<td>' + fieldPresenter.fieldNameToFriendly(fieldNames[i], flightLog.getSysConfig().debug_mode) + '</td>' +
                            '<td class="raw-value">' + atMost2DecPlaces(frame[i]) + '</td>' +
                            '<td>' + fieldPresenter.decodeFieldToFriendly(flightLog, fieldNames[i], frame[i], currentFlightMode) + "</td>",

                        secondColumn = i + rowCount;

                    if (secondColumn < fieldNames.length) {
                        row += 
                            '<td>' + fieldPresenter.fieldNameToFriendly(fieldNames[secondColumn], flightLog.getSysConfig().debug_mode) + '</td>' +
                            '<td>' + atMost2DecPlaces(frame[secondColumn]) + '</td>' +
                            '<td>' + fieldPresenter.decodeFieldToFriendly(flightLog, fieldNames[secondColumn], frame[secondColumn], currentFlightMode) + '</td>';
                    }

                    row += "</tr>";

                    rows.push(row);
                }

                table.append(rows.join(""));
                
            }

            // Update flight mode flags on status bar
            $(".flight-mode", statusBar).text(
            		fieldPresenter.decodeFieldToFriendly(null, 'flightModeFlags', currentFlightMode, null)	
            	);

            // update time field on status bar
            $(".graph-time").val(formatTime((currentBlackboxTime-flightLog.getMinTime())/1000, true));
            if(hasMarker) {
                $(".marker-offset", statusBar).text('Marker Offset ' + formatTime((currentBlackboxTime-markerTime)/1000, true) + 'ms ' + (1000000/(currentBlackboxTime-markerTime)).toFixed(0) + "Hz");
            }

            // Update the Legend Values
            if(graphLegend) graphLegend.updateValues(flightLog, frame);
            
        }
    }
    
    updateValuesChartRateLimited = $.throttle(250, updateValuesChart);
    
    function animationLoop() {
        var 
            now = Date.now();
        
        if (!graph) {
            animationFrameIsQueued = false;
            return;
        }
        
        if (hasVideo) {
            currentBlackboxTime = blackboxTimeFromVideoTime();
        } else if (graphState == GRAPH_STATE_PLAY) {
            var
                delta;
            
            if (lastRenderTime === false) {
                delta = 0;
            } else {
                delta = Math.floor((now - lastRenderTime) * 1000 * playbackRate / 100);
            }
    
            currentBlackboxTime += delta;
    
            if (currentBlackboxTime > flightLog.getMaxTime()) {
                currentBlackboxTime = flightLog.getMaxTime();
                setGraphState(GRAPH_STATE_PAUSED);
            }
        }
        
        graph.render(currentBlackboxTime);
        graphRendersCount++;
        
        seekBar.setCurrentTime(currentBlackboxTime);
        seekBar.setWindow(graph.getWindowWidthTime());

        updateValuesChartRateLimited();
        
        if (graphState == GRAPH_STATE_PLAY) {
            lastRenderTime = now;
            
            seekBarRepaintRateLimited();
            
            animationFrameIsQueued = true;
            requestAnimationFrame(animationLoop);
        } else {
            seekBar.repaint();
            
            animationFrameIsQueued = false;
        }
    }
    
    function invalidateGraph() {
        if (!animationFrameIsQueued) {
            animationFrameIsQueued = true;
            requestAnimationFrame(animationLoop);
        }
    }

    function updateCanvasSize() {
        var
            width = $(canvas).width(),
            height = $(canvas).height();
        
        if (graph) {
            graph.resize(width, height);
            seekBar.resize(canvas.offsetWidth, 50);
            
            invalidateGraph();
        }
    }
    
    function renderLogFileInfo(file) {
        $(".log-filename").text(file.name);

        var
            logIndexContainer = $(".log-index"),
            logIndexPicker,
            logCount = flightLog.getLogCount(),
            index;

        logIndexContainer.empty();
        
        if (logCount > 1) {
            logIndexPicker = $('<select class="log-index form-control no-wheel">');
            
            logIndexPicker.change(function() {
                selectLog(parseInt($(this).val(), 10));
                if(graph) {
                    (hasAnalyserFullscreen)?html.addClass("has-analyser-fullscreen"):html.removeClass("has-analyser-fullscreen");
                    graph.setAnalyser(hasAnalyserFullscreen);
                }
            });
        }
        
        for (index = 0; index < logCount; index++) {
            var
                logLabel,
                option, holder,
                error;
            
            error = flightLog.getLogError(index);
            
            if (error) {
                logLabel = error;
            } else {
                logLabel = formatTime(flightLog.getMinTime(index) / 1000, false) 
                    + " - " + formatTime(flightLog.getMaxTime(index) / 1000 , false)
                    + " [" + formatTime(Math.ceil((flightLog.getMaxTime(index) - flightLog.getMinTime(index)) / 1000), false) + "]";
            }
            
            if (logCount > 1) {
                option = $("<option></option>");
            
                option.text((index + 1) + "/" + (flightLog.getLogCount()) + ": " + logLabel);
                option.attr("value", index);
                
                if (error)
                    option.attr("disabled", "disabled");
                
                logIndexPicker.append(option);
            } else {
                holder = $('<div class="form-control-static no-wheel"></div>');
                
                holder.text(logLabel);
                logIndexContainer.append(holder);
            }
        }
    
        if (logCount > 1) {
            logIndexPicker.val(0);
            logIndexContainer.append(logIndexPicker);
        }
    }
    
    /**
     * Update the metadata displays to show information about the currently selected log index.
     */
    function renderSelectedLogInfo() {
        $(".log-index").val(flightLog.getLogIndex());
                
        if (flightLog.getNumCellsEstimate()) {
            $(".log-cells").text(flightLog.getNumCellsEstimate() + "S (" + Number(flightLog.getReferenceVoltageMillivolts() / 1000).toFixed(2) + "V)");
            $(".log-cells-header,.log-cells").css('display', 'block');
        } else {
            $(".log-cells-header,.log-cells").css('display', 'none');
        }
        
        /**
        Removed as cant see a reason to display this information

        if (flightLog.getSysConfig().deviceUID != null) {
            $(".log-device-uid").text(flightLog.getSysConfig().deviceUID);
            $(".log-device-uid-header,.log-device-uid").css('display', 'block');
        } else {
           $(".log-device-uid-header,.log-device-uid").css('display', 'none');
        }
        **/
        
        // Add log version information to status bar
        var sysConfig = flightLog.getSysConfig();
        $('.version', statusBar).text( ((sysConfig['Craft name']!=null)?(sysConfig['Craft name'] + ' : '):'') +
                                        ((sysConfig['Firmware revision']!=null)?(sysConfig['Firmware revision']):''));
        $('.looptime', statusBar).text( stringLoopTime(sysConfig.looptime, sysConfig.pid_process_denom, sysConfig.unsynced_fast_pwm, sysConfig.motor_pwm_rate));
        $('.lograte', statusBar).text( ((sysConfig['frameIntervalPDenom']!=null && sysConfig['frameIntervalPNum']!=null)?( 'Sample Rate : ' + sysConfig['frameIntervalPNum'] +'/' + sysConfig['frameIntervalPDenom']):''));

        seekBar.setTimeRange(flightLog.getMinTime(), flightLog.getMaxTime(), currentBlackboxTime);
        seekBar.setActivityRange(flightLog.getSysConfig().motorOutput[0], flightLog.getSysConfig().motorOutput[1]);
        
        var 
            activity = flightLog.getActivitySummary();
        
        seekBar.setActivity(activity.times, activity.avgThrottle, activity.hasEvent);
        
        seekBar.repaint();
    }
    
    function setGraphState(newState) {
        graphState = newState;
        var btnLogPlayPause = $(".log-play-pause");

        lastRenderTime = false;
        
        switch (newState) {
            case GRAPH_STATE_PLAY:
                if (hasVideo) {
                    video.play();
                }
                $("span", btnLogPlayPause).attr('class', 'glyphicon glyphicon-pause');
            break;
            case GRAPH_STATE_PAUSED:
                if (hasVideo) {
                    video.pause();
                }
                $("span", btnLogPlayPause).attr('class', 'glyphicon glyphicon-play');
            break;
        }
        
        invalidateGraph();
    }
    
    function setCurrentBlackboxTime(newTime) {
        if (hasVideo) {
            video.currentTime = (newTime - flightLog.getMinTime()) / 1000000 + videoOffset;
        
            syncLogToVideo();
        } else {
            currentBlackboxTime = newTime;
        }
        
        invalidateGraph();
    }
    
    function setVideoTime(newTime) {
        video.currentTime = newTime;
    
        syncLogToVideo();
    }
    
    function setVideoInTime(inTime) {
        videoExportInTime = inTime;
        
        if (seekBar) {
            seekBar.setInTime(videoExportInTime);
        }
        
        if (graph) {
            graph.setInTime(videoExportInTime);
            invalidateGraph();
        }
    }
    
    function setVideoOutTime(outTime) {
        videoExportOutTime = outTime;
        
        if (seekBar) {
            seekBar.setOutTime(videoExportOutTime);
        }
        
        if (graph) {
            graph.setOutTime(videoExportOutTime);
            invalidateGraph();
        }
    }
    
    function setPlaybackRate(rate, updateUi) {
        if (rate >= PLAYBACK_MIN_RATE && rate <= PLAYBACK_MAX_RATE) {
              playbackRate = rate;
              
              if (video) {
                  video.playbackRate = rate / 100;
              }
        }
        
        if (updateUi) {
            $(".playback-rate-control").val(playbackRate);
        }
        
        $(".playback-rate-control .noUi-handle").text(playbackRate + '%');
    }
    
    function setGraphZoom(zoom, updateUi) {
        if (zoom == null) { // go back to last zoom value
            zoom = lastGraphZoom;
        }
        if (zoom >= GRAPH_MIN_ZOOM && zoom <= GRAPH_MAX_ZOOM) {
            lastGraphZoom = graphZoom;
            graphZoom = zoom;
            
            if (graph) {
                graph.setGraphZoom(zoom / 100);
                invalidateGraph();
            }
        }
        
        if (updateUi) {
            $(".graph-zoom-control").val(graphZoom);
        }

        $(".graph-zoom-control .noUi-handle").text(graphZoom + '%');
    }
    
    function showConfigFile(state) {
            if(hasConfig) {
                if(state == null) { // no state specified, just toggle
                    hasConfigOverlay = !hasConfigOverlay;
                } else { //state defined, just set item
                    hasConfigOverlay = (state)?true:false;
                }
                html.toggleClass("has-config-overlay", hasConfigOverlay);
            }
        }

    function showValueTable(state) {
        if(state == null) { // no state specified, just toggle
            hasTableOverlay = !hasTableOverlay;
        } else { //state defined, just set item
            hasTableOverlay = (state)?true:false;
        }
        html.toggleClass("has-table-overlay", hasTableOverlay);
        updateValuesChart();
    }

    /**
     * Set the index of the log from the log file that should be viewed. Pass "null" as the index to open the first
     * available log.
     */
    function selectLog(logIndex) {
        var
            success = false;
        
        try {
            if (logIndex === null) {
                for (var i = 0; i < flightLog.getLogCount(); i++) {
                    if (flightLog.openLog(i)) {
                        success = true;
                        currentOffsetCache.index = i;
                        break;
                    }
                }
                
                if (!success) {
                    throw "No logs in this file could be parsed successfully";
                }
            } else {
                flightLog.openLog(logIndex);
                currentOffsetCache.index = logIndex;
            }
        } catch (e) {
            alert("Error opening log: " + e);
            currentOffsetCache.index = null;
            return;
        }
        
        if (graph) {
            graph.destroy();
        }

        
        if((flightLog.getSysConfig().looptime             != null) &&
            (flightLog.getSysConfig().frameIntervalPNum   != null) &&
            (flightLog.getSysConfig().frameIntervalPDenom != null) ) {
                userSettings.analyserSampleRate = 1000000 / (flightLog.getSysConfig().looptime * (validate(flightLog.getSysConfig().pid_process_denom,1)) * flightLog.getSysConfig().frameIntervalPDenom / flightLog.getSysConfig().frameIntervalPNum);
                }

        graph = new FlightLogGrapher(flightLog, activeGraphConfig, canvas, stickCanvas, craftCanvas, analyserCanvas, userSettings);

        setVideoInTime(false);
        setVideoOutTime(false);
    
        activeGraphConfig.adaptGraphs(flightLog, graphConfig);
        
        graph.onSeek = function(offset) {
            //Seek faster
            offset *= 2;
            
            if (hasVideo) {
                setVideoTime(video.currentTime + offset / 1000000);
            } else {
                setCurrentBlackboxTime(currentBlackboxTime + offset);
            }
            invalidateGraph();
        };
        
        if (hasVideo) {
            syncLogToVideo();
        } else {
            // Start at beginning:
            currentBlackboxTime = flightLog.getMinTime();
        }
        
        renderSelectedLogInfo();
        
        updateCanvasSize();
        
        setGraphState(GRAPH_STATE_PAUSED);
        setGraphZoom(graphZoom, true);
    }

    function loadFileMessage(fileName) {
        $("#loading-file-text").text(`Trying to load file ${fileName}...`);
        $("#loading-file-text").show();
    }
    
    function loadFiles(files) {
        for (var i = 0; i < files.length; i++) {
            var
                isLog = files[i].name.match(/\.(BBL|TXT|CFL|BFL|LOG)$/i),
                isVideo = files[i].name.match(/\.(AVI|MOV|MP4|MPEG)$/i),
                isWorkspaces = files[i].name.match(/\.(JSON)$/i);

            loadFileMessage(files[i].name);

            if (!isLog && !isVideo && !isWorkspaces) {
                if (files[i].size < 10 * 1024 * 1024)
                    isLog = true; //Assume small files are logs rather than videos
                else
                    isVideo = true;
            }
            
            if (isLog) {
                loadLogFile(files[i]);
            } else if (isVideo) {
                loadVideo(files[i]);
            } else if (isWorkspaces) {
                loadWorkspaces(files[i])
            }
        }

        // finally, see if there is an offsetCache value already, and auto set the offset
        for(i=0; i<offsetCache.length; i++) {
            if(
                (currentOffsetCache.log   == offsetCache[i].log)   &&
                (currentOffsetCache.index == offsetCache[i].index) &&
                (currentOffsetCache.video == offsetCache[i].video)    ) {
                    setVideoOffset(offsetCache[i].offset, true);
                }
        }
    }

    function loadLogFile(file) {
        var reader = new FileReader();
    
        reader.onload = function(e) {
            var bytes = e.target.result;
            
            var fileContents = String.fromCharCode.apply(null, new Uint8Array(bytes, 0,100));

            if(fileContents.match(/# dump|# diff/i)) { // this is actually a configuration file
                try{

                   // Firstly, is this a configuration defaults file
                   // (the filename contains the word 'default')

                   if( (file.name).match(/default/i) ) {
                        configurationDefaults.loadFile(file);
                   } else {

                       configuration = new Configuration(file, configurationDefaults, showConfigFile); // the configuration class will actually re-open the file as a text object.
                       hasConfig = true;
                       html.toggleClass("has-config", hasConfig);
                   }
                   
                   } catch(e) {
                       configuration = null;
                       hasConfig = false;
                   }
               return;            
            }

            flightLogDataArray = new Uint8Array(bytes);
            
            try {
                flightLog = new FlightLog(flightLogDataArray);
            } catch (err) {
                alert("Sorry, an error occured while trying to open this log:\n\n" + err);
                return;
            }
            
            renderLogFileInfo(file);
            currentOffsetCache.log      = file.name; // store the name of the loaded log file
            currentOffsetCache.index    = null;      // and clear the index
            
            hasLog = true; html.toggleClass("has-log", hasLog);
            html.toggleClass("has-table", hasTable);
            html.toggleClass("has-craft",              userSettings.drawCraft);
            html.toggleClass("has-sticks",             userSettings.drawSticks);
            html.toggleClass('has-expo-override',      userSettings.graphExpoOverride);
            html.toggleClass('has-smoothing-override', userSettings.graphSmoothOverride);
            html.toggleClass('has-grid-override',      userSettings.graphSmoothOverride);

            setTimeout(function(){$(window).resize();}, 500 ); // refresh the window size;

            selectLog(null);
            
            if (graph) {
                (hasAnalyserFullscreen)?html.addClass("has-analyser-fullscreen"):html.removeClass("has-analyser-fullscreen");
                graph.setAnalyser(hasAnalyserFullscreen);
            }

        };
    
        reader.readAsArrayBuffer(file);
    }
    
    function loadVideo(file) {
        currentOffsetCache.video = file.name; // store the name of the loaded video
        if (videoURL) {
            URL.revokeObjectURL(videoURL);
            videoURL = false;
        }
        
        if (!URL.createObjectURL) {
            alert("Sorry, your web browser doesn't support showing videos from your local computer.");
            currentOffsetCache.video = null; // clear the associated video name
            return;
        }
            
        videoURL = URL.createObjectURL(file);
        video.volume = 1.00;
        video.src = videoURL;
        
        // Reapply the last playbackRate to the new video
        setPlaybackRate(playbackRate, true);
    }
    
    function videoLoaded(e) {
        hasVideo = true;
        html.toggleClass("has-video", hasVideo);
        
        setGraphState(GRAPH_STATE_PAUSED);
        invalidateGraph();
    }
    
    function reportVideoError(e) {
        let errorMessage = 'Error while loading the video.';
        if (e.currentTarget.error.code) {
            errorMessage += ' ERROR (' + e.currentTarget.error.code + '): ' + e.currentTarget.error.message;
        }
        alert(errorMessage);
    }
    
    function onLegendVisbilityChange(hidden) {
        prefs.set('log-legend-hidden', hidden);
        updateCanvasSize();
    }

    function onLegendSelectionChange() {
        hasAnalyser = true;
        graph.setDrawAnalyser(hasAnalyser);            
        html.toggleClass("has-analyser", hasAnalyser);
        prefs.set('hasAnalyser', hasAnalyser);
        invalidateGraph();
    }

    function onLegendHighlightChange() {
        invalidateGraph();
    }

    function setMarker(state) { // update marker field
        hasMarker = state;
        html.toggleClass("has-marker",state);
    }

    function setFullscreen(state) { // update fullscreen status
        isFullscreen = state;
        html.toggleClass("is-fullscreen",state);
    }
    
    this.getMarker = function() { // get marker field
        return {
            state:hasMarker,
            time:markerTime
            };
    }
    
    this.getBookmarks = function() { // get bookmark events
    	var bookmarks = [];
    	try {
    		if(bookmarkTimes!=null) {
		    	for(var i=0; i<=9; i++) {
		    		if(bookmarkTimes[i]!=null) {
			    		bookmarks[i] = {
			    			state: (bookmarkTimes[i]!=0),
			    			time:  bookmarkTimes[i]
			    			};
			    		} else bookmarks[i] = null;
		    	}
    		}
	    	return bookmarks;	    		
    	} catch(e) {
    		return null;
    	}
    }

    this.getBookmarkTimes = function() {
        return bookmarkTimes;
    }
           
    prefs.get('videoConfig', function(item) {
        if (item) {
            videoConfig = item;
        } else {
            videoConfig = {
                width: 1280,
                height: 720,
                frameRate: 30,
                videoDim: 0.4
            };
        }
    });
    
    prefs.get('graphConfig', function(item) {
        graphConfig = GraphConfig.load(item);
        
        if (!graphConfig) {
            graphConfig = GraphConfig.getExampleGraphConfigs(flightLog, ["Motors", "Gyros"]);
        }
    });

    // Workspace save/restore to/from file.
    function saveWorkspaces(file) {

        var data; // Data to save

        if(!workspaceGraphConfigs) return null;     // No workspaces to save
        if(!file) file = 'workspaces.json'; // No filename to save to, make one up

        if(typeof workspaceGraphConfigs === "object"){
            data = JSON.stringify(workspaceGraphConfigs, undefined, 4);
        }

        var blob = new Blob([data], {type: 'text/json'}),
            e    = document.createEvent('MouseEvents'),
            a    = document.createElement('a');

        a.download = file;
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':');
        e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(e);

    }

    function upgradeWorkspaceFormat(oldFormat) {
        // Check if upgrade is needed
        if (!oldFormat.graphConfig) { return oldFormat }

        let newFormat = [];

        oldFormat.graphConfig.forEach((element, id) => {
            if (element) {
                let title = "Unnamed";
                if (element.length > 0) {
                    title = element[0].label;
                }

                newFormat[id] = {
                    title: title,
                    graphConfig: element
                }
            }
            else {
                newFormat[id] = null;
            }
        });

        return newFormat;
    }

    function loadWorkspaces(file) {
        var reader = new FileReader();
    
        reader.onload = function(e) {
            var data = e.target.result;
            var tmp = JSON.parse(data);
            if (tmp.graphConfig) {
                window.alert('Old Workspace format. Upgrading...');
                tmp = upgradeWorkspaceFormat(tmp);
            }
            workspaceGraphConfigs = tmp;
            onSwitchWorkspace(workspaceGraphConfigs, 1);
            window.alert('Workspaces Loaded');               
        };
     
        reader.readAsText(file);
    }

    function exportCsv(file, options={}) {

        function onSuccess(data) {
            console.debug("CSV export finished in", (performance.now() - startTime) / 1000, "secs");
            if (!data) {
                console.debug("Empty data, nothing to save");
                return;
            }
            let blob = new Blob([data], {type: 'text/csv'}),
                e    = document.createEvent('MouseEvents'),
                a    = document.createElement('a');
            a.download = file || $(".log-filename").text() + ".csv";
            a.href = window.URL.createObjectURL(blob);
            a.dataset.downloadurl =  ['text/csv', a.download, a.href].join(':');
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(e);
        }

        let startTime = performance.now();
        CsvExporter(flightLog, options).dump(onSuccess);
    }

    function newGraphConfig(newConfig) {
        lastGraphConfig = graphConfig; // Remember the last configuration.
        graphConfig = newConfig;

        activeGraphConfig.adaptGraphs(flightLog, graphConfig);

        prefs.set('graphConfig', graphConfig);
    }

    // Store to local cache and update Workspace Selector control
    function onSwitchWorkspace(newWorkspaces, newAciveId) {
        prefs.set('activeWorkspace', newAciveId);      
        prefs.set('workspaceGraphConfigs', newWorkspaces);
        workspaceSelection.setWorkspaces(newWorkspaces)
        workspaceSelection.setActiveWorkspace(newAciveId)
        if (flightLog && newWorkspaces[newAciveId] && newWorkspaces[newAciveId].graphConfig) {
           newGraphConfig(newWorkspaces[newAciveId].graphConfig);
           document.getElementById("legend_title").textContent = newWorkspaces[newAciveId].title
        }
    }

    // Save current config
    function onSaveWorkspace(id, title){
        workspaceGraphConfigs[id] = {
            title: title,
            graphConfig: graphConfig
        };
        onSwitchWorkspace(workspaceGraphConfigs, id)
    }

    // New workspaces feature; local storage of user configurations
    prefs.get('workspaceGraphConfigs', function(item) {
        if(item) {
            workspaceGraphConfigs = upgradeWorkspaceFormat(item);
        } else {
            workspaceGraphConfigs = [];
        }

        onSwitchWorkspace(workspaceGraphConfigs, activeWorkspace);
    });

    prefs.get('activeWorkspace', function (id){
        if (id) {
            activeWorkspace = id
        }
        else {
            activeWorkspace = 1
        }

        onSwitchWorkspace(workspaceGraphConfigs, activeWorkspace);
    });

    // Get the offsetCache buffer
    prefs.get('offsetCache', function(item) {
        if(item) {
            offsetCache = item;
        }
    })
    
    activeGraphConfig.addListener(function() {
        invalidateGraph();
    });
    
    $(document).ready(function() {

        $('[data-toggle="tooltip"]').tooltip({trigger: "hover", placement: "auto bottom"}); // initialise tooltips
        $('[data-toggle="dropdown"]').dropdown(); // initialise menus
        $('a.auto-hide-menu').click(function() {
            var test = $(this).closest('.dropdown').children().first().dropdown("toggle");
        });

        // Get Latest Version Information
        $("#viewer-version").text('You are using version ' + VIEWER_VERSION);
        $(".viewer-version", statusBar).text('v'+VIEWER_VERSION);
        try {
            $.getJSON('https://api.github.com/repos/betaflight/blackbox-log-viewer/releases/latest',{},function(data){
                latestVersion = data;
                if(latestVersion) {
                    $(".btn-viewer-download").text(latestVersion.tag_name);
                    $(".viewer-download").show();
                } else {
                    $(".viewer-download").hide();
                }
                });
        } catch (e) 
        {
            console.log('Cannot get latest version information');
            $(".viewer-download").hide();
        }

        graphLegend = new GraphLegend($(".log-graph-legend"), activeGraphConfig, onLegendVisbilityChange, onLegendSelectionChange, onLegendHighlightChange, zoomGraphConfig, expandGraphConfig, newGraphConfig);
        
        workspaceSelection = new WorkspaceSelection($(".log-workspace-selection"), workspaceGraphConfigs, onSwitchWorkspace, onSaveWorkspace);
        onSwitchWorkspace(workspaceGraphConfigs, workspaceSelection);

        prefs.get('log-legend-hidden', function(item) {
            if (item) {
                graphLegend.hide();
            }
        });

        /* Always start with the table hidden
        prefs.get('hasTable', function(item) {
           if (item) {
               hasTable = item;
               html.toggleClass("has-table", hasTable);
           } 
        });
        */
        hasTable = false;
        html.toggleClass("has-table", hasTable);
        
        // Reset the analyser window on application startup.
        hasAnalyser = false;
        html.toggleClass("has-analyser", hasAnalyser);

        $(".btn-new-window").click(function(e) {
            createNewBlackboxWindow();
        });

        $(".file-open").change(function(e) {
            var 
                files = e.target.files;

            loadFiles(files);

            // Clear the files, in this way we can open a file with the same path/name again
            e.target.value = "";
        });
        
        // New View Controls
        $(".view-video").click(function() {
            viewVideo = !viewVideo;
            html.toggleClass("video-hidden", !viewVideo);       
        });

        $(".view-craft").click(function() {
            userSettings.drawCraft = !userSettings.drawCraft;
            html.toggleClass("has-craft", userSettings.drawCraft);
            saveOneUserSetting('drawCraft', userSettings.drawCraft);
        });

        $(".view-sticks").click(function() {
            userSettings.drawSticks = !userSettings.drawSticks;
            graph.setDrawSticks(userSettings.drawSticks);
            html.toggleClass("has-sticks", userSettings.drawSticks);
            saveOneUserSetting('drawSticks', userSettings.drawSticks);
            invalidateGraph();
        });
        
        $(".view-table").click(function() {
            showValueTable();
            showConfigFile(false); // hide the config file
            /*
            hasTable = !hasTable;
            html.toggleClass("has-table", hasTable);       
            prefs.set('hasTable', hasTable);
            */
        });
       
        $(".view-config").click(function() {
            showValueTable(false); // hide the table
            showConfigFile();
        });

        $(".view-analyser").click(function() {
            // Show the latest graph selected (if any) or the first in the list.
            if (activeGraphConfig.selectedFieldName != null) {
                hasAnalyser = !hasAnalyser;
            } else {
                var graphs = activeGraphConfig.getGraphs();
                if (graphs.length == 0 || graphs[0].fields.length == 0) {
                    hasAnalyser = false;
                } else { 
                    activeGraphConfig.selectedFieldName = graphs[0].fields[0].friendlyName;
                    activeGraphConfig.selectedGraphIndex = 0;
                    activeGraphConfig.selectedFieldIndex = 0;
                    hasAnalyser = true;
                }
            }

            graph.setDrawAnalyser(hasAnalyser);            
            html.toggleClass("has-analyser", hasAnalyser);       
            prefs.set('hasAnalyser', hasAnalyser);
            invalidateGraph();
        });

        $(".view-analyser-fullscreen").click(function() {
            if(hasAnalyser) {
                hasAnalyserFullscreen = !hasAnalyserFullscreen; 
            } else hasAnalyserFullscreen = false;
            (hasAnalyserFullscreen)?html.addClass("has-analyser-fullscreen"):html.removeClass("has-analyser-fullscreen");
            graph.setAnalyser(hasAnalyserFullscreen);
            invalidateGraph();
        });

        $(".view-zoom-in").click(function() {
            zoomIn();
        });

        $(".view-zoom-out").click(function() {
            zoomOut();
        });

        $(".toggle-smoothing").click(function () {
            toggleOverrideStatus('graphSmoothOverride', 'has-smoothing-override');
        });

        $(".toggle-expo").click(function () {
            toggleOverrideStatus('graphExpoOverride', 'has-expo-override');
        });

        $(".toggle-grid").click(function () {
            toggleOverrideStatus('graphGridOverride', 'has-grid-override');
        });

        /** changelog trigger **/
        $("#changelog_toggle").on('click', function() {
            var state = $(this).data('state2');
            if (state) { // log closed
                $("#changelog").animate({right: -695}, 200, function () {
                    html.removeClass('log_open');
                });
                state = false;
            } else { // log open
                $("#changelog").animate({right: 0}, 200);
                html.addClass('log_open');
                state = true;
            }
            $(this).text(state ? 'Close' : 'Changelog');
            $(this).data('state2', state);
        });

        var logJumpBack = function(fast, slow) {
            var scrollTime  = SMALL_JUMP_TIME;
            if(fast!=null) scrollTime = (fast!=0)?(graph.getWindowWidthTime() * fast):scrollTime;
            if (hasVideo) {
                if(slow) { scrollTime = (1/60) * 1000000; } // Assume 60Hz video
                setVideoTime(video.currentTime - scrollTime / 1000000);
            } else {
                var currentFrame = flightLog.getCurrentFrameAtTime((hasVideo)?video.currentTime:currentBlackboxTime);
                if (currentFrame && currentFrame.previous && slow) {
                    setCurrentBlackboxTime(currentFrame.previous[FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME]);
                } else {
                    setCurrentBlackboxTime(currentBlackboxTime - scrollTime);
                }
            }
            
            setGraphState(GRAPH_STATE_PAUSED);
        };
        $(".log-jump-back").click(function() {logJumpBack(false);});

        var logJumpForward = function(fast, slow) {

            var scrollTime = SMALL_JUMP_TIME;
            if(fast!=null) scrollTime = (fast!=0)?(graph.getWindowWidthTime() * fast):scrollTime;
            if (hasVideo) {
                if(slow) { scrollTime = (1/60) * 1000000; } // Assume 60Hz video
                setVideoTime(video.currentTime + scrollTime / 1000000);
            } else {
                var currentFrame = flightLog.getCurrentFrameAtTime((hasVideo)?video.currentTime:currentBlackboxTime);
                if (currentFrame && currentFrame.next && slow) {
                    setCurrentBlackboxTime(currentFrame.next[FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME]);
                } else {
                    setCurrentBlackboxTime(currentBlackboxTime + scrollTime);
                }
            }
            
            setGraphState(GRAPH_STATE_PAUSED);
        };
        $(".log-jump-forward").click(function() {logJumpForward(false);});
        
        var logJumpStart = function() {
            setCurrentBlackboxTime(flightLog.getMinTime());
            setGraphState(GRAPH_STATE_PAUSED);
        };
        $(".log-jump-start").click(logJumpStart);
    
        var logJumpEnd = function() {
            setCurrentBlackboxTime(flightLog.getMaxTime());
            setGraphState(GRAPH_STATE_PAUSED);
        };
        $(".log-jump-end").click(logJumpEnd);
        
        var videoJumpStart = function() {
            setVideoTime(0);
            setGraphState(GRAPH_STATE_PAUSED);
        };
        $(".video-jump-start").click(videoJumpStart);
    
        var videoJumpEnd = function() {
            if (video.duration) {
                setVideoTime(video.duration);
                setGraphState(GRAPH_STATE_PAUSED);
            }
        };
        $(".video-jump-end").click(videoJumpEnd);

        var logPlayPause = function() {
            if (graphState == GRAPH_STATE_PAUSED) {
                setGraphState(GRAPH_STATE_PLAY);
            } else {
                setGraphState(GRAPH_STATE_PAUSED);
            }            
        };  
        $(".log-play-pause").click(logPlayPause);
        
        var logSyncHere = function() {
            setVideoOffset(video.currentTime, true);
        };
        $(".log-sync-here").click(logSyncHere);
        
        var logSyncBack = function() {
            setVideoOffset(videoOffset - 1 / 15, true);
        };
        $(".log-sync-back").click(logSyncBack);
    
        var logSyncForward = function() {
            setVideoOffset(videoOffset + 1 / 15, true);
        };
        $(".log-sync-forward").click(logSyncForward);

        var logSmartSync = function() {
            if (hasMarker && hasVideo && hasLog) { // adjust the video sync offset and remove marker
                try {
                    setVideoOffset(videoOffset + (stringTimetoMsec($(".marker-offset", statusBar).text()) / 1000000), true);
                } catch (e) {
                    console.log('Failed to set video offset');
                }
            }
            setMarker(!hasMarker);
            $(".marker-offset", statusBar).css('visibility', (hasMarker)?'visible':'hidden');
            invalidateGraph();
        };
        $(".log-smart-sync").click(logSmartSync);


        $(".video-offset").change(function() {
            var offset = parseFloat(this.value);

            if (!isNaN(offset)) {
                setVideoOffset(offset, true);
            }
        });

        // Add user configurable start time
        $(".graph-time").change(function() {

            // the log is offset by the minTime
            var newTime = stringTimetoMsec($(".graph-time").val());
                   
            if (!isNaN(newTime)) {
                if (hasVideo) {
                    setVideoTime(newTime / 1000000 + videoOffset);
                } else {
                    newTime += flightLog.getMinTime();
                    setCurrentBlackboxTime(newTime);
                }
                invalidateGraph();               
            }
        });

        function expandGraphConfig(index) { // Put each of the fields into a seperate graph

            var expandedGraphConfig = [];

            for(var i=0; i< graphConfig[index].fields.length; i++) {                    // Loop through each of the fields
            var singleGraph = {fields: [], label:'', height: 1 };
                singleGraph.fields.push(graphConfig[index].fields[i]);
                singleGraph.label = graphConfig[index].fields[i].name;
                expandedGraphConfig.push(singleGraph);
            }
            
            newGraphConfig(expandedGraphConfig);
            invalidateGraph();

        }

        function zoomGraphConfig(index) { // Put each of the fields onto one graph and clear the others

            if(graphConfig.length == 1) { // if there is only one graph, then return to previous configuration
                if (lastGraphConfig != null) {
                    newGraphConfig(lastGraphConfig);
                }
            } else {

                var expandedGraphConfig = [];
                var singleGraph = {fields: [], label:'', height: 1 };


                for(var i=0; i< graphConfig[index].fields.length; i++) {                    // Loop through each of the fields
                    singleGraph.fields.push(graphConfig[index].fields[i]);
                    singleGraph.label = graphConfig[index].label;
                }
                expandedGraphConfig.push(singleGraph);

                newGraphConfig(expandedGraphConfig);
            }
            invalidateGraph();

        }
        
        var 
            graphConfigDialog = new GraphConfigurationDialog($("#dlgGraphConfiguration"), function(newConfig) {
                newGraphConfig(newConfig);   
            }),
            
            headerDialog = new HeaderDialog($("#dlgHeaderDialog"), function(newSysConfig) {
                if(newSysConfig!=null) {
                    prefs.set('lastHeaderData', newSysConfig);
                    flightLog.setSysConfig(newSysConfig);

                    // Save Current Position then re-calculate all the log information
                    var activePosition = (hasVideo)?video.currentTime:currentBlackboxTime;
                    
                    selectLog(null);
                    if (hasVideo) {
                        setVideoTime(activePosition);
                    } else {
                        setCurrentBlackboxTime(activePosition);
                    }
                }
            }),

            keysDialog = new KeysDialog($("#dlgKeysDialog")),

            userSettingsDialog = new UserSettingsDialog($("#dlgUserSettings"), 
            function(defaultSettings) { // onLoad
                prefs.get('userSettings', function(item) {
                    if (item) {
                        userSettings = $.extend({}, defaultSettings, item);
                    } else {
                        userSettings = defaultSettings;
                    }
                });
            },

            function(newSettings) { // onSave
	            userSettings = newSettings;

	            prefs.set('userSettings', newSettings);

	            // refresh the craft model
	            if(graph!=null) {
	                graph.refreshOptions(newSettings);
	                graph.refreshLogo();
	                graph.initializeCraftModel();
	                updateCanvasSize();
	            }

	        }),

	        exportDialog = new VideoExportDialog($("#dlgVideoExport"), function(newConfig) {
	            videoConfig = newConfig;
	            
	            prefs.set('videoConfig', newConfig);
	        });
        
        $(".open-graph-configuration-dialog").click(function(e) {
            e.preventDefault();
            
            graphConfigDialog.show(flightLog, activeGraphConfig.getGraphs());
        });

        $(".open-header-dialog").click(function(e) {
            headerDialog.show(flightLog.getSysConfig());
            e.preventDefault();
        });

        $(".open-keys-dialog").click(function(e) {
            e.preventDefault();
            
            keysDialog.show();
        });

        $(".open-user-settings-dialog").click(function(e) {
            e.preventDefault();
            
            userSettingsDialog.show(flightLog, userSettings);
        });

        $(".marker-offset", statusBar).click(function(e) {
	        setCurrentBlackboxTime(markerTime);
	        invalidateGraph(); 
        });
        
        for(var i=1; i< 9; i++) { // Loop through all the bookmarks.
            $('.bookmark-'+i, statusBar).click(function() {
    	        setCurrentBlackboxTime(bookmarkTimes[parseInt(this.className.slice(-1))]);
    	        invalidateGraph(); 
            });
        }

        $('.bookmark-clear', statusBar).click(function() {
            bookmarkTimes = null;
            for(var i=1; i<=9; i++) {
                $('.bookmark-'+ i, statusBar).css('visibility', 'hidden' );
            }
            $('.bookmark-clear', statusBar).css('visibility', 'hidden' );
	        invalidateGraph(); 
        });

        $('.configuration-file-name', statusBar).click(function(e) {
            showConfigFile(true); // show the config file
            e.preventDefault();
        });

        $(".btn-workspaces-export").click(function(e) {
            setGraphState(GRAPH_STATE_PAUSED);
            saveWorkspaces();
            e.preventDefault();
        });

        $(".btn-csv-export").click(function(e) {
            setGraphState(GRAPH_STATE_PAUSED);
            exportCsv();
            e.preventDefault();
        });
                
        if (FlightLogVideoRenderer.isSupported()) {
            $(".btn-video-export").click(function(e) {
                setGraphState(GRAPH_STATE_PAUSED);
    
                exportDialog.show(flightLog, {
                    graphConfig: activeGraphConfig,
                    inTime: videoExportInTime,
                    outTime: videoExportOutTime,
                    flightVideo: (hasVideo && viewVideo) ? video.cloneNode() : false,
                    flightVideoOffset: videoOffset,
                    hasCraft: userSettings.drawCraft,
                    hasAnalyser: hasAnalyser,
                    hasSticks: userSettings.drawSticks
                }, videoConfig);
                
                e.preventDefault();
            });
        } else {
            $(".btn-video-export")
                .addClass('disabled')
                .css('pointer-events', 'all !important')
                .attr({
                    'data-toggle': 'tooltip',
                    'data-placement': 'bottom',
                    'title': "Not supported by your browser, use Google Chrome instead"
                })
                .tooltip();
        }

        $(window).resize(function() { updateCanvasSize(); /*updateHeaderSize()*/ });

        function updateHeaderSize() {
            var newHeight = $(".video-top-controls").height() - 20; // 23px offset
            $(".log-graph").css("top", newHeight+"px");
            $(".log-graph-config").css("top", newHeight+"px");
            $(".log-seek-bar").css("top", newHeight+"px");
            $(".log-field-values").css("top", newHeight+"px");
            invalidateGraph();
        }

        function savePenDefaults(graphConfig, graph, field) {
            /**
             * graphConfig is the current graph configuration
             * group is the set of pens to change, null means individual pen within group
             * field is the actual pen to change, null means all pens within group
             */

            if(graph==null && field==null) return false; // no pen specified, just exit

            if(graph!=null && field==null) { // save ALL pens withing group
                for(var i=0; i<graphConfig[parseInt(graph)].fields.length; i++) {
                    if(graphConfig[parseInt(graph)].fields[i].default==null) {
                        graphConfig[parseInt(graph)].fields[i].default = [];
                        graphConfig[parseInt(graph)].fields[i].default.smoothing   = graphConfig[parseInt(graph)].fields[i].smoothing;
                        graphConfig[parseInt(graph)].fields[i].default.outputRange = graphConfig[parseInt(graph)].fields[i].curve.outputRange;
                        graphConfig[parseInt(graph)].fields[i].default.power       = graphConfig[parseInt(graph)].fields[i].curve.power;
                    }
                }
                return '<h4>Stored defaults for all pens</h4>';
            }
            if(graph!=null && field!=null) { // restore single pen
                if(graphConfig[parseInt(graph)].fields[parseInt(field)].default==null) {
                    graphConfig[parseInt(graph)].fields[parseInt(field)].default = [];
                    graphConfig[parseInt(graph)].fields[parseInt(field)].default.smoothing    = graphConfig[parseInt(graph)].fields[parseInt(field)].smoothing;
                    graphConfig[parseInt(graph)].fields[parseInt(field)].default.outputRange  = graphConfig[parseInt(graph)].fields[parseInt(field)].curve.outputRange;
                    graphConfig[parseInt(graph)].fields[parseInt(field)].default.power        = graphConfig[parseInt(graph)].fields[parseInt(field)].curve.power;
                    return '<h4>Stored defaults for single pen</h4>';
                }
            }
            return false; // nothing was changed

        }

        function restorePenDefaults(graphConfig, graph, field) {
            /**
             * graphConfig is the current graph configuration
             * group is the set of pens to change, null means individual pen within group
             * field is the actual pen to change, null means all pens within group
             */

            if(graph==null && field==null) return false; // no pen specified, just exit

            if(graph!=null && field==null) { // restore ALL pens withing group
                for(var i=0; i<graphConfig[parseInt(graph)].fields.length; i++) {
                    if(graphConfig[parseInt(graph)].fields[i].default!=null) {
                        graphConfig[parseInt(graph)].fields[i].smoothing         = graphConfig[parseInt(graph)].fields[i].default.smoothing;
                        graphConfig[parseInt(graph)].fields[i].curve.outputRange = graphConfig[parseInt(graph)].fields[i].default.outputRange;
                        graphConfig[parseInt(graph)].fields[i].curve.power       = graphConfig[parseInt(graph)].fields[i].default.power;
                    } else return false;
                }
                return '<h4>Restored defaults for all pens</h4>';
            }
            if(graph!=null && field!=null) { // restore single pen
                if(graphConfig[parseInt(graph)].fields[parseInt(field)].default!=null) {
                    graphConfig[parseInt(graph)].fields[parseInt(field)].smoothing         = graphConfig[parseInt(graph)].fields[parseInt(field)].default.smoothing;
                    graphConfig[parseInt(graph)].fields[parseInt(field)].curve.outputRange = graphConfig[parseInt(graph)].fields[parseInt(field)].default.outputRange;
                    graphConfig[parseInt(graph)].fields[parseInt(field)].curve.power       = graphConfig[parseInt(graph)].fields[parseInt(field)].default.power;
                    return '<h4>Restored defaults for single pen</h4>';
                } else return false;
            }
            return false; // nothing was changed
        }

        function changePenSmoothing(graphConfig, graph, field, delta) {
            /**
             * graphConfig is the current graph configuration
             * group is the set of pens to change, null means individual pen within group
             * field is the actual pen to change, null means all pens within group
             * delta is the direction false is down, true is up
             */

            const range = { min:0, max:10000 }; // actually in milliseconds!
            const scroll = 1000; // actually in milliseconds

            if(graph==null && field==null) return false; // no pen specified, just exit

            savePenDefaults(graphConfig, graph, field); // only updates defaults if they are not already set

            var changedValue = '<h4>Smoothing</h4>';
            if(graph!=null && field==null) { // change ALL pens withing group
                for(var i=0; i<graphConfig[parseInt(graph)].fields.length; i++) {
                    graphConfig[parseInt(graph)].fields[i].smoothing += ((delta)?-scroll:+scroll);
                    graphConfig[parseInt(graph)].fields[i].smoothing = constrain(graphConfig[parseInt(graph)].fields[i].smoothing, range.min, range.max);
                    changedValue += graphConfig[parseInt(graph)].fields[i].friendlyName + ' ' + (graphConfig[parseInt(graph)].fields[i].smoothing / 100).toFixed(2)+ '%\n';
                }
                return changedValue;
            }
            if(graph!=null && field!=null) { // change single pen
                graphConfig[parseInt(graph)].fields[parseInt(field)].smoothing += ((delta)?-scroll:+scroll);
                graphConfig[parseInt(graph)].fields[parseInt(field)].smoothing = constrain(graphConfig[parseInt(graph)].fields[parseInt(field)].smoothing, range.min, range.max);
                return changedValue + graphConfig[parseInt(graph)].fields[parseInt(field)].friendlyName + ' ' + (graphConfig[parseInt(graph)].fields[parseInt(field)].smoothing / 100).toFixed(2) + '%\n';
            }
            return false; // nothing was changed
        }

        function changePenZoom(graphConfig, graph, field, delta) {
            /**
             * graphConfig is the current graph configuration
             * group is the set of pens to change, null means individual pen within group
             * field is the actual pen to change, null means all pens within group
             * delta is the direction false is down, true is up
             */

            const range = { min:0.10, max:10.0 };    // 1.0 is actually 100 percent linear!
            const scroll = 0.10;

            if(graph==null && field==null) return false; // no pen specified, just exit

            savePenDefaults(graphConfig, graph, field); // only updates defaults if they are not already set

            var changedValue = '<h4>Zoom</h4>';
            if(graph!=null && field==null) { // change ALL pens withing group
                for(var i=0; i<graphConfig[parseInt(graph)].fields.length; i++) {
                    graphConfig[parseInt(graph)].fields[i].curve.outputRange += ((delta)?-scroll:+scroll);
                    graphConfig[parseInt(graph)].fields[i].curve.outputRange = constrain(graphConfig[parseInt(graph)].fields[i].curve.outputRange, range.min, range.max);
                    changedValue += graphConfig[parseInt(graph)].fields[i].friendlyName + ' x' + (graphConfig[parseInt(graph)].fields[i].curve.outputRange).toFixed(1)+ '\n';
                }
                return changedValue;
            }
            if(graph!=null && field!=null) { // change single pen
                graphConfig[parseInt(graph)].fields[parseInt(field)].curve.outputRange += ((delta)?-scroll:+scroll);
                graphConfig[parseInt(graph)].fields[parseInt(field)].curve.outputRange = constrain(graphConfig[parseInt(graph)].fields[parseInt(field)].curve.outputRange, range.min, range.max);
                return changedValue + graphConfig[parseInt(graph)].fields[parseInt(field)].friendlyName + ' x' + (graphConfig[parseInt(graph)].fields[parseInt(field)].curve.outputRange).toFixed(1) + '\n';;
            }
            return false; // nothing was changed
        }

        function changePenExpo(graphConfig, graph, field, delta) {
            /**
             * graphConfig is the current graph configuration
             * group is the set of pens to change, null means individual pen within group
             * field is the actual pen to change, null means all pens within group
             * delta is the direction false is down, true is up
             */

            const range = { min:0.05, max:1.0 };    // 1.0 is actually 100 percent linear!
            const scroll = 0.05;

            if(graph==null && field==null) return false; // no pen specified, just exit

            savePenDefaults(graphConfig, graph, field); // only updates defaults if they are not already set

            var changedValue = '<h4>Expo</h4>';
            if(graph!=null && field==null) { // change ALL pens withing group
                for(var i=0; i<graphConfig[parseInt(graph)].fields.length; i++) {
                    graphConfig[parseInt(graph)].fields[i].curve.power += ((delta)?-scroll:+scroll);
                    graphConfig[parseInt(graph)].fields[i].curve.power = constrain(graphConfig[parseInt(graph)].fields[i].curve.power, range.min, range.max);
                    changedValue += graphConfig[parseInt(graph)].fields[i].friendlyName + ' ' + (graphConfig[parseInt(graph)].fields[i].curve.power * 100).toFixed(2)+ '%\n';
                }
                return changedValue;
            }
            if(graph!=null && field!=null) { // change single pen
                graphConfig[parseInt(graph)].fields[parseInt(field)].curve.power += ((delta)?-scroll:+scroll);
                graphConfig[parseInt(graph)].fields[parseInt(field)].curve.power = constrain(graphConfig[parseInt(graph)].fields[parseInt(field)].curve.power, range.min, range.max);
                return changedValue + graphConfig[parseInt(graph)].fields[parseInt(field)].friendlyName + ' ' + (graphConfig[parseInt(graph)].fields[parseInt(field)].curve.power * 100).toFixed(2) + '%\n';;
            }
            return false; // nothing was changed
        }

        function saveOneUserSetting(name, value) {
            prefs.get('userSettings', function(data) {
                data[name] = value;
                prefs.set('userSettings', data);
            });
        }

        function toggleOverrideStatus(userSetting, className) {
            userSettings[userSetting] = !userSettings[userSetting]; // toggle current setting
            html.toggleClass(className, userSettings[userSetting]);
            saveOneUserSetting(userSetting, userSettings[userSetting]);
            graph.refreshOptions(userSettings);
            graph.refreshGraphConfig();
            invalidateGraph();
        }

        
        $('.log-graph-legend').on("mousedown", function(e) {

            if(e.which != 2) return; // is it the middle mouse button, no, then ignore

            if($(e.target).hasClass('graph-legend-group') || $(e.target).hasClass('graph-legend-field')) {
                var refreshRequired = restorePenDefaults(activeGraphConfig.getGraphs(), $(e.target).attr('graph'), $(e.target).attr('field'));

                if(refreshRequired) {
                    graph.refreshGraphConfig();
                    invalidateGraph();
                    mouseNotification.show($('.log-graph'), null, null, refreshRequired, 1000, null, 'bottom-right', 0);
                }
                e.preventDefault();
                return;
            }
        });
        
        $(document).on("mousewheel", function(e) {

        if($(e.target).hasClass('no-wheel')) { // prevent mousewheel scrolling on non scrollable elements.
            e.preventDefault();
            return;
        }
        
        if (graph && $(e.target).parents('.modal').length == 0){
            var delta = Math.max(-1, Math.min(1, (e.originalEvent.wheelDelta)));
            if (delta!=0) {
                if($(e.target).attr('id') == 'graphCanvas') { // we are scrolling the graph
                    if (delta < 0) { // scroll down (or left)
                        if (e.altKey || e.shiftKey) {
                            setGraphZoom(graphZoom - 10.0 - ((e.altKey) ? 15.0 : 0.0), true);
                        } else {
                            logJumpBack(0.1 /*10%*/);
                        }
                    } else { // scroll up or right
                        if (e.altKey || e.shiftKey) {
                            setGraphZoom(graphZoom + 10.0 + ((e.altKey) ? 15.0 : 0.0), true);
                        } else {
                            logJumpForward(0.1 /*10%*/);
                        }
                    }
                    e.preventDefault();
                    return true;
                }
                if($(e.target).hasClass('field-quick-adjust')) {
                    var refreshRequired = false;

                    if (e.shiftKey) { // change zoom
                        refreshRequired = changePenZoom(activeGraphConfig.getGraphs(), $(e.target).attr('graph'), $(e.target).attr('field'), (delta>=0))
                        e.preventDefault();
                    } else if (e.altKey) { // change Expo
                        refreshRequired = changePenExpo(activeGraphConfig.getGraphs(), $(e.target).attr('graph'), $(e.target).attr('field'), (delta>=0))
                        e.preventDefault();
                    } else if (e.ctrlKey){ // Change smoothing
                        refreshRequired = changePenSmoothing(activeGraphConfig.getGraphs(), $(e.target).attr('graph'), $(e.target).attr('field'), (delta>=0))
                        e.preventDefault();
                    }

                    if(refreshRequired) {
                        graph.refreshGraphConfig();
                        invalidateGraph();
                        mouseNotification.show($('.log-graph'), null, null, refreshRequired, 750, null, 'bottom-right', 0);
                    }

                    return true;
                }
            }
        }
        });

        $(document).keydown(function(e) {
            // Pressing any key hides dropdown menus
            //$(".dropdown-toggle").dropdown("toggle");

            var shifted = (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey);
            if(e.which === 13 && e.target.type === 'text' && $(e.target).parents('.modal').length == 0) {
                // pressing return on a text field clears the focus.
                $(e.target).blur();                
            }
            // keyboard controls are disabled on modal dialog boxes and text entry fields
            if (graph && e.target.type != 'text' && $(e.target).parents('.modal').length == 0) {
                switch (e.which) {
                    case "I".charCodeAt(0):
                        if (!(shifted)) {
                            if (videoExportInTime === currentBlackboxTime) {
                                setVideoInTime(false)
                            } else {
                                setVideoInTime(currentBlackboxTime);
                            }
                        }
                        
                        e.preventDefault();
                    break;
                    case "O".charCodeAt(0):
                        if (!(shifted)) {
                            if (videoExportOutTime === currentBlackboxTime) {
                                setVideoOutTime(false);
                            } else {
                                setVideoOutTime(currentBlackboxTime);
                            }
                        }                        
                        e.preventDefault();
                    break;
                    case "M".charCodeAt(0): 
                        if (e.altKey) { // adjust the video sync offset and remove marker
                          logSmartSync();
                        } else { // Add a marker to graph window
                            markerTime = currentBlackboxTime;
                            setMarker(!hasMarker);
                            $(".marker-offset", statusBar).text('Marker Offset ' + formatTime(0) + 'ms').css('visibility', (hasMarker)?'visible':'hidden');
                            invalidateGraph();
                        }                        
                        e.preventDefault();
                    break;

                    case "C".charCodeAt(0):
                        if(!(shifted)) {
                            showValueTable(false); // hide the values table if shown
                            showConfigFile(); // toggle the config file popup
                            e.preventDefault();
                        }
                    break;

                    case "A".charCodeAt(0):
                        if(!(shifted)) {
                            if(activeGraphConfig.selectedFieldName != null) {
                                hasAnalyser = !hasAnalyser;
                            } else hasAnalyser = false;
                            graph.setDrawAnalyser(hasAnalyser);
                            html.toggleClass("has-analyser", hasAnalyser);
                            prefs.set('hasAnalyser', hasAnalyser);
                            invalidateGraph();
                            e.preventDefault();
                        } else { // Maximize
                            if(hasAnalyser) {
                                hasAnalyserFullscreen = !hasAnalyserFullscreen;
                            } else hasAnalyserFullscreen = false;
                            (hasAnalyserFullscreen)?html.addClass("has-analyser-fullscreen"):html.removeClass("has-analyser-fullscreen");
                            graph.setAnalyser(hasAnalyserFullscreen);
                            invalidateGraph();
                        }
                        break;

                    case "H".charCodeAt(0):
                        if(!(shifted)) {
                            headerDialog.show(flightLog.getSysConfig());
                            e.preventDefault();
                        }
                        break;

                    case "T".charCodeAt(0):
                        if(!(shifted)) {
                            showValueTable();
                            showConfigFile(false); // hide the config file (if shown)
                            invalidateGraph();
                            e.preventDefault();
                        }
                    break;

                    // Workspace shortcuts
                    case "0".charCodeAt(0):
                    case "1".charCodeAt(0):
                    case "2".charCodeAt(0):
                    case "3".charCodeAt(0):
                    case "4".charCodeAt(0):
                    case "5".charCodeAt(0):
                    case "6".charCodeAt(0):
                    case "7".charCodeAt(0):
                    case "8".charCodeAt(0):
                    case "9".charCodeAt(0):
                        try {
                            if (!e.altKey) { // Workspaces feature
                                var id = e.which - 48;
                                if (!e.shiftKey) { // retreive graph configuration from workspace
                                    if (workspaceGraphConfigs[id] != null) {
                                        onSwitchWorkspace(workspaceGraphConfigs, id)
                                    }
                                } else { // store configuration to workspace
                                    if (workspaceGraphConfigs[id]) {
                                        onSaveWorkspace(id, workspaceGraphConfigs[id].title);
                                    }
                                    else {
                                        onSaveWorkspace(id, "Unnamed");
                                    }
                                }
                            } else { // Bookmark Feature
                        		if (!e.shiftKey) { // retrieve time from bookmark
		                            if (bookmarkTimes[e.which-48] != null) {
		                                setCurrentBlackboxTime(bookmarkTimes[e.which-48]);
		                                invalidateGraph(); 
		                            }

		                        } else {// store time to bookmark
		                            // Special Case : Shift Alt 0 clears all bookmarks
		                            if(e.which==48) {
		                                bookmarkTimes = null;
		                                for(var i=1; i<=9; i++) {
	                                        $('.bookmark-'+ i, statusBar).css('visibility', 'hidden' );
		                                }
                                        $('.bookmark-clear', statusBar).css('visibility', 'hidden' );
		                            } else {
		                                if(bookmarkTimes==null) bookmarkTimes = new Array();
                                        if (bookmarkTimes[e.which-48] == null) {
                                             bookmarkTimes[e.which-48] = currentBlackboxTime; 		// Save current time to bookmark
                                        } else {
                                             bookmarkTimes[e.which-48] = null; 			            // clear the bookmark
                                        }
                                        $('.bookmark-'+(e.which-48), statusBar).css('visibility', ((bookmarkTimes[e.which-48]!=null)?('visible'):('hidden')) );
                                        var countBookmarks = 0;
                                        for(var i=0; i<=9; i++) {
                                        	countBookmarks += (bookmarkTimes[i]!=null)?1:0;
                                        }
                                        $('.bookmark-clear', statusBar).css('visibility', ((countBookmarks>0)?('visible'):('hidden')) );

		                            }
		                            invalidateGraph();
		                        }
                        	}
                        } catch(e) {
                            console.log('Workspace feature not functioning');
                        }
                        e.preventDefault();
                    break;
                    case "Z".charCodeAt(0): // Ctrl-Z key to toggle between last graph config and current one - undo
                        try {
                            if(e.ctrlKey) {
                                if (lastGraphConfig != null) {
                                    newGraphConfig(lastGraphConfig);
                                }
                            } else {
                                    (graphZoom==GRAPH_MIN_ZOOM)?setGraphZoom(null, true):setGraphZoom(GRAPH_MIN_ZOOM, true);
                            }
                        } catch(e) {
                            console.log('Workspace toggle feature not functioning');
                        }
                        e.preventDefault();
                    break;

                    case "S".charCodeAt(0): // S key to toggle between last graph smooth and none
                        try {
                            if(!(shifted)) {
                                toggleOverrideStatus('graphSmoothOverride', 'has-smoothing-override' );
                                e.preventDefault();
                            } else if (e.altKey) {
                                makeScreenshot();
                            }
                        } catch(e) {
                            console.log('Smoothing override toggle feature not functioning');
                        }
                        e.preventDefault();
                    break;                    

                    case "X".charCodeAt(0): // S key to toggle between last graph smooth and none
                        try {
                            if(!(shifted)) {
                                toggleOverrideStatus('graphExpoOverride', 'has-expo-override' );
                                e.preventDefault();
                            }
                        } catch(e) {
                            console.log('Expo override toggle feature not functioning');
                        }
                        e.preventDefault();
                    break;

                    case "G".charCodeAt(0): // S key to toggle between last graph smooth and none
                        try {
                            if(!(shifted)) { 
                                toggleOverrideStatus('graphGridOverride', 'has-grid-override' );
                                e.preventDefault();
                            }
                        } catch(e) {
                            console.log('Grid override toggle feature not functioning');
                        }
                        e.preventDefault();
                    break;                        

                    // Toolbar shortcuts
                    case " ".charCodeAt(0): // start/stop playback
                            logPlayPause();
                        e.preventDefault();
                    break;
                    case 37: // left arrow (normal scroll, shifted zoom out)
                        if (e.shiftKey) {
                            setGraphZoom(graphZoom - 10.0 - ((e.altKey)?15.0:0.0), true);
                        } else {
                          logJumpBack(null, e.altKey);
                        }
                        e.preventDefault();
                    break;
                    case 39: // right arrow (normal scroll, shifted zoom in)
                        if (e.shiftKey) {
                            setGraphZoom(graphZoom + 10.0 + ((e.altKey)?15.0:0.0), true);
                        } else {
                            logJumpForward(null, e.altKey);
                        }
                        e.preventDefault();
                    break;
                    case 33: // pgup - Scroll fast
                        logJumpBack(0.25 /* 25% */);
                        e.preventDefault();
                    break;
                    case 34: // pgdn - Scroll fast
                        logJumpForward(0.25 /* 25% */);
                        e.preventDefault();
                    break;
                    case 36: // home - goto start of log
                        logJumpStart();
                        e.preventDefault();
                    break;
                    case 35: // end - goto end of log
                        logJumpEnd();
                        e.preventDefault();
                    break;

                }
            }
        });
        
        $(video).on({
            loadedmetadata: updateCanvasSize,
            error: reportVideoError,
            loadeddata: videoLoaded
        });
        
        var percentageFormat = {
            to: function(value) {
                return value.toFixed(0) + "%";
            },
            from: function(value) {
                return parseFloat(value);
            }
        };
        
        $(".playback-rate-control")
            .noUiSlider({
                start: playbackRate,
                connect: false,
                step: PLAYBACK_RATE_STEP,
                range: {
                    'min': [ PLAYBACK_MIN_RATE ],
                    '50%': [ PLAYBACK_DEFAULT_RATE, PLAYBACK_RATE_STEP ],
                    'max': [ PLAYBACK_MAX_RATE, PLAYBACK_RATE_STEP ]
                },
                tooltips: percentageFormat,
                format: percentageFormat
            })
            .on("slide", function() {
                setPlaybackRate(parseFloat($(this).val()), false);
            })
            .dblclick(function() { 
                setPlaybackRate(100, true);
            });

        $(".playback-rate-control .noUi-handle").text( playbackRate + '%');
        
        $(".graph-zoom-control")
            .noUiSlider({
                start: graphZoom,
                connect: false,
                step: GRAPH_ZOOM_STEP,
                range: {
                    'min': [ GRAPH_MIN_ZOOM ],
                    '50%': [ GRAPH_DEFAULT_ZOOM, GRAPH_ZOOM_STEP ],
                    'max': [ GRAPH_MAX_ZOOM, GRAPH_ZOOM_STEP ]
                },
                tooltips: true,
                format: percentageFormat
            })
            .on("slide", function() {
                setGraphZoom(parseFloat($(this).val()), false);
            })
            .dblclick(function() { 
                setGraphZoom(100, true);
            });
        
        $('.navbar-toggle').click(function(e) {
            $('.navbar-collapse').collapse('toggle');
            
            e.preventDefault();
        });

        seekBar.onSeek = setCurrentBlackboxTime;

        function checkIfFileAsParameter() {
            let fullPath = null;
            // Chrome or opening a file association
            if ((typeof argv !== 'undefined') && (argv.length > 0)) {
                fullPath = argv[0];
            } else if (isNW()) {
                const gui = require('nw.gui');
                if (gui.App.argv.length > 0) {
                    fullPath = gui.App.argv[0];
                }
            }
            if (fullPath != null) {
                const filename = fullPath.replace(/^.*[\\\/]/, '');
                const file = new File(fullPath, filename);
                loadFiles([file]);
            }
        }
        checkIfFileAsParameter();

        // File extension association
        var onOpenFileAssociation = function() {

            if (isNW()) {
                const gui = require('nw.gui');
                gui.App.on('open', function(path) {

                    // All the windows opened try to open the new blackbox,
                    // so we limit it to one of them, the first in the list for example
                    gui.Window.getAll(function(windows) {

                        const firstWindow = windows[0];
                        const currentWindow = gui.Window.get();

                        if (currentWindow.window === firstWindow.window) {
                            const filePathToOpenExpression = /.*"([^"]*)"$/;
                            const fileToOpen = path.match(filePathToOpenExpression);

                            if (fileToOpen.length > 1) {
                                const fullPathFile = fileToOpen[1];
                                createNewBlackboxWindow([fullPathFile]);
                            }
                        }
                    });

                });
            }
        }
        onOpenFileAssociation();

        /* drag and drop support */

        window.ondragover = function(e) {
            // prevent default behavior from changing page on dropped file
            // NOTE: ondrop events WILL NOT WORK if you do not "preventDefault" in the ondragover event!!
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'copy';
            return false; 
        };

        window.ondrop = function(e) { 
            e.preventDefault();

            const item = e.dataTransfer.items[0];
            const entry = item.webkitGetAsEntry();
            if (entry.isFile) {              
              var file = e.dataTransfer.files[0];
              loadFiles([file]);              
            } 
            return false;
        };

    });
}

// Close the dropdowns if not clicking a decendant of the dropdown
$(document).click(function (e) {
    var p = $(e.target).closest(".dropdown");
    if (!p.length) {
        $(".dropdown").removeClass("open");
    }
});

// Boostrap's data API is extremely slow when there are a lot of DOM elements churning, don't use it
$(document).off('.data-api');

window.blackboxLogViewer = new BlackboxLogViewer();
