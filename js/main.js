"use strict";

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
        PLAYBACK_MIN_RATE = 5,
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
        
        prefs = new PrefStorage(),
        
        // User's video render config:
        videoConfig = {},
        
        // JSON graph configuration:
        graphConfig = {},
        
        // JSON flightlog configuration
        flightLogSettings = {},

        flightLogDefaultSettings = [ // FlightLog Default Settings
                { label: "Rates",
                  parameters:
                   [ 
                    { // Index 0
                      label: "RC Rate",
                      value: 100
                    },
                    { // Index 1
                      label: "RC Expo",
                      value: 70
                    },
                    { // Index 2
                      label: "Roll Rate",
                      value: 75
                    },
                    { // Index 3
                      label: "Pitch Rate",
                      value: 75
                    },
                    { // Index 4
                      label: "Yaw Rate",
                      value: 45
                    }, 
                    { // Index 5
                      label: "Yaw Expo",
                      value: 20
                    },
                    { // Index 6
                      label: "Super Expo",
                      value: 30
                    }                     
                   ]
                },
                { label: "Loop Time",
                  parameters:
                   [ 
                    { // Index 0
                      label: "Looptime",
                      value: 500
                    },
                   ]
                },
            ],
            
        
        // Graph configuration which is currently in use, customised based on the current flight log from graphConfig
        activeGraphConfig = new GraphConfig(),
        
        graphLegend = null,
        fieldPresenter = FlightLogFieldPresenter,
        
        hasVideo = false, hasLog = false,
        video = $(".log-graph video")[0],
        canvas = $("#graphCanvas")[0],
        craftCanvas = $("#craftCanvas")[0],
        videoURL = false,
        videoOffset = 0.0,
        
        videoExportInTime = false,
        videoExportOutTime = false,
        
        graphRendersCount = 0,
        
        seekBarCanvas = $(".log-seek-bar canvas")[0],
        seekBar = new SeekBar(seekBarCanvas),
        
        seekBarRepaintRateLimited = $.throttle(200, $.proxy(seekBar.repaint, seekBar)),
        
        updateValuesChartRateLimited,
        
        animationFrameIsQueued = false,
        
        playbackRate = PLAYBACK_DEFAULT_RATE,
        
        graphZoom = GRAPH_DEFAULT_ZOOM;
    
    function blackboxTimeFromVideoTime() {
        return (video.currentTime - videoOffset) * 1000000 + flightLog.getMinTime();
    }
    
    function syncLogToVideo() {
        if (hasLog) {
            currentBlackboxTime = blackboxTimeFromVideoTime();
        }
    }
    
    function setVideoOffset(offset) {
        videoOffset = offset;
        
        /* 
         * Round to 2 dec places for display and put a plus at the start for positive values to emphasize the fact it's
         * an offset
         */
        $(".video-offset").val((videoOffset >= 0 ? "+" : "") + (videoOffset.toFixed(2) != videoOffset ? videoOffset.toFixed(2) : videoOffset));
        
        invalidateGraph();
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
            var 
                rows = [],
                rowCount = Math.ceil(fieldNames.length / 2);
            
            for (i = 0; i < rowCount; i++) {
                var 
                    row = 
                        "<tr>" +
                        '<td>' + fieldPresenter.fieldNameToFriendly(fieldNames[i]) + '</td>' +
                        '<td class="raw-value">' + atMost2DecPlaces(frame[i]) + '</td>' +
                        '<td>' + fieldPresenter.decodeFieldToFriendly(flightLog, fieldNames[i], frame[i]) + "</td>",
                        
                    secondColumn = i + rowCount;
                
                if (secondColumn < fieldNames.length) {
                    row += 
                        '<td>' + fieldPresenter.fieldNameToFriendly(fieldNames[secondColumn]) + '</td>' +
                        '<td>' + atMost2DecPlaces(frame[secondColumn]) + '</td>' +
                        '<td>' + fieldPresenter.decodeFieldToFriendly(flightLog, fieldNames[secondColumn], frame[secondColumn]) + '</td>';
                }
                
                row += "</tr>";
                
                rows.push(row);
            }
            
            table.append(rows.join(""));
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
            logIndexPicker = $('<select class="log-index form-control">');
            
            logIndexPicker.change(function() {
                selectLog(parseInt($(this).val(), 10));
            });
        }
        
        for (index = 0; index < logCount; index++) {
            var
                logLabel,
                option, holder,
                error;
            
            error = flightLog.getLogError(index);
            
            if (error) {
                logLabel = "Error: " + error;
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
                holder = $('<div class="form-control-static"></div>');
                
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
        
        if (flightLog.getSysConfig().deviceUID != null) {
            $(".log-device-uid").text(flightLog.getSysConfig().deviceUID);
            $(".log-device-uid-header,.log-device-uid").css('display', 'block');
        } else {
           $(".log-device-uid-header,.log-device-uid").css('display', 'none');
        }
        
        seekBar.setTimeRange(flightLog.getMinTime(), flightLog.getMaxTime(), currentBlackboxTime);
        seekBar.setActivityRange(flightLog.getSysConfig().minthrottle, flightLog.getSysConfig().maxthrottle);
        
        var 
            activity = flightLog.getActivitySummary();
        
        seekBar.setActivity(activity.times, activity.avgThrottle, activity.hasEvent);
        
        seekBar.repaint();
    }
    
    function setGraphState(newState) {
        graphState = newState;
        
        lastRenderTime = false;
        
        switch (newState) {
            case GRAPH_STATE_PLAY:
                if (hasVideo) {
                    video.play();
                }
                $(".log-play-pause span").attr('class', 'glyphicon glyphicon-pause');
            break;
            case GRAPH_STATE_PAUSED:
                if (hasVideo) {
                    video.pause();
                }
                $(".log-play-pause span").attr('class', 'glyphicon glyphicon-play');
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
    
    function setPlaybackRate(rate) {
        if (rate >= PLAYBACK_MIN_RATE && rate <= PLAYBACK_MAX_RATE) {
              playbackRate = rate;
              
              if (video) {
                  video.playbackRate = rate / 100;
              }
        }
    }
    
    function setGraphZoom(zoom) {
        if (zoom >= GRAPH_MIN_ZOOM && zoom <= GRAPH_MAX_ZOOM) {
            graphZoom = zoom;
            
            if (graph) {
                graph.setGraphZoom(zoom / 100);
                invalidateGraph();
            }
        }
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
                        break;
                    }
                }
                
                if (!success) {
                    throw "No logs in this file could be parsed successfully";
                }
            } else {
                flightLog.openLog(logIndex);
            }
        } catch (e) {
            alert("Error opening log: " + e);
            return;
        }
        
        try {
        // transfer the parameters from the log file into the settings data structure
        if(flightLog.getSysConfig().rcRate          != null)    {flightLogSettings[0].parameters[0].value = flightLog.getSysConfig().rcRate; }           else {flightLog.getSysConfig().rcRate          = flightLogSettings[0].parameters[0].value; }
        if(flightLog.getSysConfig().rcExpo          != null)    {flightLogSettings[0].parameters[1].value = flightLog.getSysConfig().rcExpo; }           else {flightLog.getSysConfig().rcExpo          = flightLogSettings[0].parameters[1].value; }
        if(flightLog.getSysConfig().rRate           != null)    {flightLogSettings[0].parameters[2].value = flightLog.getSysConfig().rRate; }            else {flightLog.getSysConfig().rRate           = flightLogSettings[0].parameters[2].value; }
        if(flightLog.getSysConfig().pRate           != null)    {flightLogSettings[0].parameters[3].value = flightLog.getSysConfig().pRate; }            else {flightLog.getSysConfig().pRate           = flightLogSettings[0].parameters[3].value; }
        if(flightLog.getSysConfig().yRate           != null)    {flightLogSettings[0].parameters[4].value = flightLog.getSysConfig().yRate; }            else {flightLog.getSysConfig().yRate           = flightLogSettings[0].parameters[4].value; }
        if(flightLog.getSysConfig().rcYawExpo       != null)    {flightLogSettings[0].parameters[5].value = flightLog.getSysConfig().rcYawExpo; }        else {flightLog.getSysConfig().rcYawExpo       = flightLogSettings[0].parameters[5].value; }
        if(flightLog.getSysConfig().superExpoFactor != null)    {flightLogSettings[0].parameters[6].value = flightLog.getSysConfig().superExpoFactor; }  else {flightLog.getSysConfig().superExpoFactor = flightLogSettings[0].parameters[6].value; }
        if(flightLog.getSysConfig().loopTime        != null)    {flightLogSettings[1].parameters[0].value = flightLog.getSysConfig().loopTime; }         else {flightLog.getSysConfig().loopTime        = flightLogSettings[1].parameters[0].value; }
        } catch(e) {
            console.log('FlightLog Settings archive fault... ignoring');
        }
        if (graph) {
            graph.destroy();
        }
        
        var graphOptions = {
            drawAnalyser:true,              // add an analyser option
            analyserSampleRate:2000/*Hz*/,  // the loop time for the log
            };

        if(flightLog.getSysConfig().loopTime        != null)    {graphOptions.analyserSampleRate = 1000000 / flightLog.getSysConfig().loopTime; }

        graph = new FlightLogGrapher(flightLog, activeGraphConfig, canvas, craftCanvas, graphOptions);
        
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
        setGraphZoom(graphZoom);
    }
    
    function loadLogFile(file) {
        var reader = new FileReader();
    
        reader.onload = function(e) {
            var bytes = e.target.result;
            
            flightLogDataArray = new Uint8Array(bytes);
            
            try {
                flightLog = new FlightLog(flightLogDataArray, flightLogSettings);
            } catch (err) {
                alert("Sorry, an error occured while trying to open this log:\n\n" + err);
                return;
            }
            
            renderLogFileInfo(file);
            
            hasLog = true;
            $("html").addClass("has-log");
            
            selectLog(null);
        };
    
        reader.readAsArrayBuffer(file);
    }
    
    function loadVideo(file) {
        if (videoURL) {
            URL.revokeObjectURL(videoURL);
            videoURL = false;
        }
        
        if (!URL.createObjectURL) {
            alert("Sorry, your web browser doesn't support showing videos from your local computer. Try Google Chrome instead.");
            return;
        }
            
        videoURL = URL.createObjectURL(file);
        video.volume = 0.05;
        video.src = videoURL;
        
        // Reapply the last playbackRate to the new video
        setPlaybackRate(playbackRate);
    }
    
    function videoLoaded(e) {
        hasVideo = true;
        
        $("html").addClass("has-video");
        
        setGraphState(GRAPH_STATE_PAUSED);
    }
    
    function reportVideoError(e) {
        alert("Your video could not be loaded, your browser might not support this kind of video. Try Google Chrome instead.");
    }
    
    function onLegendVisbilityChange(hidden) {
        prefs.set('log-legend-hidden', hidden);
        updateCanvasSize();
    }

    function onLegendSelectionChange() {
        updateCanvasSize();
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
    
    prefs.get('flightLogSettings', function(item) {
        if(item) {
            flightLogSettings = item;
            } else {
            flightLogSettings = flightLogDefaultSettings;
            }
    });
    
    
    activeGraphConfig.addListener(function() {
        invalidateGraph();
    });
    
    $(document).ready(function() {
        graphLegend = new GraphLegend($(".log-graph-legend"), activeGraphConfig, onLegendVisbilityChange, onLegendSelectionChange);
        
        prefs.get('log-legend-hidden', function(item) {
            if (item) {
                graphLegend.hide();
            }
        });
        
        $(".file-open").change(function(e) {
            var 
                files = e.target.files,
                i;
            
            for (i = 0; i < files.length; i++) {
                var
                    isLog = files[i].name.match(/\.(TXT|CFL|LOG)$/i),
                    isVideo = files[i].name.match(/\.(AVI|MOV|MP4|MPEG)$/i);
                
                if (!isLog && !isVideo) {
                    if (files[i].size < 10 * 1024 * 1024)
                        isLog = true; //Assume small files are logs rather than videos
                    else
                        isVideo = true;
                }
                
                if (isLog) {
                    loadLogFile(files[i]);
                } else if (isVideo) {
                    loadVideo(files[i]);
                }
            }
        });


        var logJumpBack = function() {
            if (hasVideo) {
                setVideoTime(video.currentTime - SMALL_JUMP_TIME / 1000000);
            } else {
                setCurrentBlackboxTime(currentBlackboxTime - SMALL_JUMP_TIME);
            }
            
            setGraphState(GRAPH_STATE_PAUSED);
        };
        $(".log-jump-back").click(logJumpBack);
    
        

        var logJumpForward = function() {
            if (hasVideo) {
                setVideoTime(video.currentTime + SMALL_JUMP_TIME / 1000000);
            } else {
                setCurrentBlackboxTime(currentBlackboxTime + SMALL_JUMP_TIME);
            }
            
            setGraphState(GRAPH_STATE_PAUSED);
        };
        $(".log-jump-forward").click(logJumpForward);
        
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
            setVideoOffset(video.currentTime);
        };
        $(".log-sync-here").click(logSyncHere);
        
        var logSyncBack = function() {
            setVideoOffset(videoOffset - 1 / 15);
        };
        $(".log-sync-back").click(logSyncBack);
    
        var logSyncForward = function() {
            setVideoOffset(videoOffset + 1 / 15);
        };
        $(".log-sync-forward").click(logSyncForward);
    
        $(".video-offset").change(function() {
            var offset = parseFloat($(".video-offset").val());
            
            if (!isNaN(offset)) {
                videoOffset = offset;
                invalidateGraph();
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
       
        var 
            graphConfigDialog = new GraphConfigurationDialog($("#dlgGraphConfiguration"), function(newConfig) {
                graphConfig = newConfig;
                
                activeGraphConfig.adaptGraphs(flightLog, graphConfig);
                
                prefs.set('graphConfig', graphConfig);
            }),
            
            flightLogSetupDialog = new FlightLogSetupDialog($("#dlgFlightLogSetup"), function(newSettings) {
                flightLog.settings = newSettings; // Store the settings to the flightlog

                flightLogSettings = newSettings;  // Let's write this information to the local store
                prefs.set('flightLogSettings', flightLogSettings);

                // Save Current Position
                var activePosition = (hasVideo)?video.currentTime:currentBlackboxTime;
                selectLog(null);
                if (hasVideo) {
                    setVideoTime(activePosition);
                } else {
                    setCurrentBlackboxTime(activePosition);
                }
            }),

            exportDialog = new VideoExportDialog($("#dlgVideoExport"), function(newConfig) {
                videoConfig = newConfig;
                
                prefs.set('videoConfig', newConfig);
            });

        
        $(".open-graph-configuration-dialog").click(function(e) {
            e.preventDefault();
            
            graphConfigDialog.show(flightLog, graphConfig);
        });

        $(".open-log-setup-dialog").click(function(e) {
            e.preventDefault();
            
            flightLogSetupDialog.show(flightLog, flightLogSettings);
        });
        
        if (FlightLogVideoRenderer.isSupported()) {
            $(".btn-video-export").click(function(e) {
                setGraphState(GRAPH_STATE_PAUSED);
    
                exportDialog.show(flightLog, {
                    graphConfig: activeGraphConfig,
                    inTime: videoExportInTime,
                    outTime: videoExportOutTime,
                    flightVideo: hasVideo ? video.cloneNode() : false,
                    flightVideoOffset: videoOffset
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

        $(window).resize(updateCanvasSize);
        
        $(document).on("mousewheel", function(e) {
        if (graph && $(e.target).parents('.modal').length == 0) {
                var delta = Math.max(-1, Math.min(1, (e.originalEvent.wheelDelta)));
                if(delta<0) { // scroll down (or left)
                    if (e.altKey || e.shiftKey) {
                        setGraphZoom(graphZoom - 10.0 - ((e.altKey)?15.0:0.0));
                        $(".graph-zoom").val(graphZoom + "%");
                    } else {
                      logJumpBack();
                    }
                } else { // scroll up or right
                    if (e.altKey || e.shiftKey) {
                        setGraphZoom(graphZoom + 10.0 + ((e.altKey)?15.0:0.0));
                        $(".graph-zoom").val(graphZoom + "%");
                    } else {
                        logJumpForward();
                    }
                }
                e.preventDefault();
            }
        });

        $(document).keydown(function(e) {
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
                    // Add my shortcuts
                    case " ".charCodeAt(0): // start/stop playback
                            logPlayPause();
                        e.preventDefault();
                    break;
                    case 37: // left arrow (normal scroll, shifted zoom out)
                        if (e.altKey || e.shiftKey) {
                            setGraphZoom(graphZoom - 10.0 - ((e.altKey)?15.0:0.0));
                            $(".graph-zoom").val(graphZoom + "%");
                        } else {
                          logJumpBack();
                        }
                        e.preventDefault();
                    break;
                    case 39: // right arrow (normal scroll, shifted zoom in)
                        if (e.altKey || e.shiftKey) {
                            setGraphZoom(graphZoom + 10.0 + ((e.altKey)?15.0:0.0));
                            $(".graph-zoom").val(graphZoom + "%");
                        } else {
                            logJumpForward();
                        }
                        e.preventDefault();
                    break;
                    case 33: // pgup arrow - goto start
                        if (!(shifted)) {
                          logJumpStart();
                        } 
                        e.preventDefault();
                    break;
                    case 34: // pgdn arrow - goto end
                        if (!(shifted)) {
                            logJumpEnd();
                        } 
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
                format: percentageFormat
            })
            .on("slide change set", function() {
                setPlaybackRate(parseFloat($(this).val()));
            })
            .Link("lower").to($(".playback-rate"));
    
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
                format: percentageFormat
            })
            .on("slide change set", function() {
                setGraphZoom(parseFloat($(this).val()));
            })
            .Link("lower").to($(".graph-zoom"));
        
        $('.navbar-toggle').click(function(e) {
            $('.navbar-collapse').collapse('toggle');
            
            e.preventDefault();
        });
        
        seekBar.onSeek = setCurrentBlackboxTime;
    });
}

// Boostrap's data API is extremely slow when there are a lot of DOM elements churning, don't use it
$(document).off('.data-api');

window.blackboxLogViewer = new BlackboxLogViewer();