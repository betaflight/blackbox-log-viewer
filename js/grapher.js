"use strict";

function FlightLogGrapher(flightLog, graphConfig, canvas, stickCanvas, craftCanvas, analyserCanvas, options) {
    var
        PID_P = 0,
        PID_I = 1,
        PID_D = 2,
        
        DEFAULT_FONT_FACE = "Verdana, Arial, sans-serif",
        
        drawingParams = {
            fontSizePIDTableLabel: null,
            fontSizeAxisLabel: null,
            fontSizeFrameLabel: null,
            fontSizeEventLabel: null,
            
            plotLineWidth: null,
            
        },
        
        // How far the center of the craft is from the top of the canvas, as a portion of height
        // CRAFT_POSITION_Y_PROPORTION         =  parseInt(options.craft.top) / 100.0 ||0.2,
        
        lineColors = [
            "#fb8072", // Red
            "#8dd3c7", // Cyan
            "#ffffb3", // Yellow
            "#bebada", // Purple
            "#80b1d3",
            "#fdb462",
            "#b3de69",
            "#fccde5",
            "#d9d9d9",
            "#bc80bd",
            "#ccebc5",
            "#ffed6f"
        ],

        WINDOW_WIDTH_MICROS_DEFAULT = 1000000;

    var
        windowStartTime, windowCenterTime, windowEndTime,
        
        canvasContext = canvas.getContext("2d"),
        
        defaultOptions = {
            gapless:false,
            craftType:"3D", drawPidTable:true, drawSticks:true, drawTime:true,
            drawAnalyser:true,              // add an analyser option
            analyserSampleRate:2000/*Hz*/,  // the loop time for the log
            eraseBackground: true           // Set to false if you want the graph to draw on top of an existing canvas image
        },
        
        windowWidthMicros = WINDOW_WIDTH_MICROS_DEFAULT,
        
        idents,
        
        sysConfig = flightLog.getSysConfig(),

        graphs = [],

        inTime = false, outTime = false,
        
        lastMouseX, lastMouseY,

        sticks = null,
        
        craft3D = null, craft2D = null,
        
    	analyser = null, /* define a new spectrum analyser */

        watermarkLogo, /* Watermark feature */
        
        lapTimer, /* LapTimer feature */

        that = this;

    
    this.onSeek = null;
    
    this.getAnalyser = function() {
        return analyser;
    }

    function extend(base, top) {
        var 
            target = {};
        
        [base, top].forEach(function(obj) {
            for (var prop in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                    target[prop] = obj[prop];
                }
            }
        });
        
        return target;
    }
    
    function onMouseMove(e) {
        e.preventDefault();
        
        if (that.onSeek) {
            //Reverse the seek direction so that it looks like you're dragging the data with the mouse
            that.onSeek((lastMouseX - e.pageX) / canvas.width * windowWidthMicros);
        }
        
        lastMouseX = e.pageX;
        lastMouseY = e.pageY;
    }

    function onTouchMove(e) {
        e.preventDefault();
        
        if (that.onSeek) {
            //Reverse the seek direction so that it looks like you're dragging the data
            that.onSeek((lastMouseX - e.originalEvent.touches[0].pageX) / canvas.width * windowWidthMicros);
        }
        
        lastMouseX = e.originalEvent.touches[0].pageX;
        lastMouseY = e.originalEvent.touches[0].pageY;
    }
    
    function onMouseDown(e) {
        if (e.which == 1) { //Left mouse button only for seeking
            lastMouseX = e.pageX;
            lastMouseY = e.pageY;
            
            //"capture" the mouse so we can drag outside the boundaries of canvas
            $(document).on("mousemove", onMouseMove);
            
            //Release the capture when the mouse is released
            $(document).one("mouseup", function () {
                $(document).off("mousemove", onMouseMove);
            });
            
            e.preventDefault();
        }
    }
    
    function onTouchStart(e) {
        if (e.which == 0) {
            lastMouseX = e.originalEvent.touches[0].pageX;
            lastMouseY = e.originalEvent.touches[0].pageY;
            
            //"capture" so we can drag outside the boundaries of canvas
            $(document).on("touchmove", onTouchMove);
            
            //Release the capture when released
            $(document).one("touchend", function () {
                $(document).off("touchmove", onTouchMove);
            });
            
            e.preventDefault();
        }
    }

    
    function identifyFields() {
        var 
            motorGraphColorIndex = 0,
            fieldIndex,
            fieldNames = flightLog.getMainFieldNames();
        
        idents = {
            rcCommandFields:[],
            motorFields:[],
            motorColors:[],

            axisPIDFields: [[], [], []],  //First dimension is [P, I, D], second dimension is axis

            gyroFields:[],

            accFields:[],

            servoFields:[],

            vbatField:-1,
            numCells:-1,
            baroField:-1,

            miscFields:[],

            //Synthetic fields:
            roll:-1,
            pitch:-1,
            heading:-1,
            axisPIDSum:[]
        };
        
        for (fieldIndex = 0; fieldIndex < fieldNames.length; fieldIndex++) {
            var 
                fieldName = fieldNames[fieldIndex],
                matches;

            if ((matches = fieldName.match(/^motor\[(\d+)]$/))) {
                var motorIndex = matches[1];

                idents.motorFields[motorIndex] = fieldIndex;
                idents.motorColors[motorIndex] = lineColors[(motorGraphColorIndex++) % lineColors.length];
            } else if ((matches = fieldName.match(/^rcCommand\[(\d+)]$/))) {
                var rcCommandIndex = matches[1];

                if (rcCommandIndex >= 0 && rcCommandIndex < 4) {
                    idents.rcCommandFields[rcCommandIndex] = fieldIndex;
                }
            } else if ((matches = fieldName.match(/^axisPID\[(\d+)]$/))) {
                var axisIndex = matches[1];

                idents.axisPIDSum[axisIndex] = fieldIndex;
            } else if ((matches = fieldName.match(/^axis(.)\[(\d+)]$/))) {
                var axisIndex = matches[2];
                
                idents.axisPIDFields[matches[1]] = axisIndex;
                idents.hasPIDs = true;
            } else if ((matches = fieldName.match(/^gyroADC\[(\d+)]$/))) {
                var axisIndex = matches[1];

                idents.gyroFields[axisIndex] = fieldIndex;
            } else if ((matches = fieldName.match(/^accSmooth\[(\d+)]$/))) {
                var axisIndex = matches[1];

                idents.accFields[axisIndex] = fieldIndex;
            } else if ((matches = fieldName.match(/^servo\[(\d+)]$/))) {
                var servoIndex = matches[1];

                idents.numServos++;
                idents.servoFields[servoIndex] = fieldIndex;
            } else {
                switch (fieldName) {
                    case "vbatLatest":
                        idents.vbatField = fieldIndex;
                        idents.numCells = flightLog.getNumCellsEstimate();
                    break;
                    case "BaroAlt":
                        idents.baroField = fieldIndex;
                    break;
                    case "roll":
                        idents.roll = fieldIndex;
                    break;
                    case "pitch":
                        idents.pitch = fieldIndex;
                    break;
                    case "heading":
                        idents.heading = fieldIndex;
                    break;
                    default:
                        idents.miscFields.push(fieldIndex);
                }
            }
        }
    }

    function drawWaterMark() {

        canvasContext.save();
        canvasContext.globalAlpha = parseInt(options.watermark.transparency)/100;
        canvasContext.drawImage(watermarkLogo, parseInt(options.watermark.left)/100 * canvas.width, 
                                               parseInt(options.watermark.top)/100 * canvas.height, 
                                               parseInt(options.watermark.size)/100 * watermarkLogo.width, 
                                               parseInt(options.watermark.size)/100 * watermarkLogo.height);
        canvasContext.restore();

    }
    
    function drawLapTimer() {
        // Update the Lap Timer
        lapTimer.refresh(windowCenterTime, (3600*1000000/*a long time*/), blackboxLogViewer.getBookmarkTimes());
    	lapTimer.drawCanvas(canvas, options);
    }

    var
        frameLabelTextWidthFrameNumber = null,
        frameLabelTextWidthFrameTime = null;

    function drawFrameLabel(frameIndex, timeMsec) {
        canvasContext.font = drawingParams.fontSizeFrameLabel + "pt " + DEFAULT_FONT_FACE;
        canvasContext.fillStyle = "rgba(255,255,255,0.65)";

        if (frameLabelTextWidthFrameNumber == null)
            frameLabelTextWidthFrameNumber = canvasContext.measureText("#0000000").width;
        
        canvasContext.fillText("#" + leftPad(frameIndex, "0", 7), canvas.width - frameLabelTextWidthFrameNumber - 8, canvas.height - 8);

        if (frameLabelTextWidthFrameTime == null)
            frameLabelTextWidthFrameTime = canvasContext.measureText("00:00.000").width;
        
        canvasContext.fillText(formatTime(timeMsec, true), canvas.width - frameLabelTextWidthFrameTime - 8, canvas.height - 8 - drawingParams.fontSizeFrameLabel - 8);

    }
    
    /**
     * Plot the given field within the specified time period. When the output from the curve applied to a field
     * value reaches 1.0 it'll be drawn plotHeight pixels away from the origin.
     */
    function plotField(chunks, startFrameIndex, fieldIndex, curve, plotHeight, color, lineWidth, highlight) {
        var
            GAP_WARNING_BOX_RADIUS = 3,
            chunkIndex, frameIndex,
            drawingLine = false,
            notInBounds = -5, // when <0, then line is always drawn, (this allows us to paritially dash the line when the bounds is exceeded)
            inGap = false,
            lastX, lastY,
            yScale = -plotHeight,
            xScale = canvas.width / windowWidthMicros;

        //Draw points from this line until we leave the window
        
        //We may start partway through the first chunk:
        frameIndex = startFrameIndex;
        
        canvasContext.strokeStyle = color;
        canvasContext.lineWidth = (lineWidth)?lineWidth:drawingParams.plotLineWidth;
        
        canvasContext.beginPath();
        
        plottingLoop:
        for (chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            var 
                chunk = chunks[chunkIndex];
            
            for (; frameIndex < chunk.frames.length; frameIndex++) {
                var
                    fieldValue = chunk.frames[frameIndex][fieldIndex],
                    frameTime = chunk.frames[frameIndex][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME],
                    nextX, nextY;
    

                nextY = curve.lookup(fieldValue) * yScale;
                nextX = (frameTime - windowStartTime) * xScale;

                // clamp the Y to the range of the graph to prevent bleed into next graph if zoomed in (for example)

                if(nextY>plotHeight) {
                    nextY = plotHeight;
                    notInBounds++;
                } else
                if(nextY<(-1)*plotHeight) {
                    nextY = (-1)*plotHeight;
                    notInBounds++;
                } else notInBounds = -5;
                
                if(notInBounds>5) notInBounds = -5; // reset it every 5th line draw (to simulate dashing)  

                if (drawingLine && (notInBounds<=0)) {
                    canvasContext.lineTo(nextX, nextY);

                    if (!options.gapless && chunk.gapStartsHere[frameIndex]) {
                        canvasContext.strokeRect(nextX - GAP_WARNING_BOX_RADIUS, nextY - GAP_WARNING_BOX_RADIUS, GAP_WARNING_BOX_RADIUS * 2, GAP_WARNING_BOX_RADIUS * 2);
                        inGap = true;
                        drawingLine = false;
                        continue;
                    } 
                } else {
                    canvasContext.moveTo(nextX, nextY);
                    
                    if (!options.gapless) {
                        // Is this the end of a gap to be marked?
                        if (inGap) {
                            canvasContext.strokeRect(nextX - GAP_WARNING_BOX_RADIUS, nextY - GAP_WARNING_BOX_RADIUS, GAP_WARNING_BOX_RADIUS * 2, GAP_WARNING_BOX_RADIUS * 2);
                            
                            if (chunk.gapStartsHere[frameIndex])
                                continue;
                            else
                                inGap = false;
                        } else if (chunk.gapStartsHere[frameIndex]) {
                            //Must be right at the beginning of drawing
                            inGap = true;
                            continue;
                        }
                    }
                }

                drawingLine = true;
                
                if (frameTime >= windowEndTime)
                    break plottingLoop;
            }
            
            frameIndex = 0;
        }

        if (highlight) {
            // Draw semi-transparent stroke with wider line to simulate glow
            // Decided not to use canvasContext.shadowBlur for performance reasons
            var lineWidthTemp = canvasContext.lineWidth;
            canvasContext.lineWidth = 1.5*canvasContext.lineWidth+3;
            canvasContext.globalAlpha = 0.5;
            canvasContext.stroke();
            canvasContext.lineWidth = lineWidthTemp;
            canvasContext.globalAlpha = 1.0;
        }
        
        canvasContext.stroke();
    }
    
    //Draw an origin line for a graph (at the origin and spanning the window)
    function drawAxisLine() {
        canvasContext.strokeStyle = "rgba(255,255,255,0.5)";
        canvasContext.lineWidth = 1;
		canvasContext.setLineDash([5]); // Make the center line a dash        
        canvasContext.beginPath();
        canvasContext.moveTo(0, 0);
        canvasContext.lineTo(canvas.width, 0);
        
        canvasContext.stroke();
		canvasContext.setLineDash([]);        
    }

    //Draw an background for the line for a graph (at the origin and spanning the window)
    function drawAxisBackground(plotHeight) {
        var axisGradient = canvasContext.createLinearGradient(0,-plotHeight/2,0,plotHeight/2);
        axisGradient.addColorStop(0.0,   'rgba(255,255,255,0.1)');
        axisGradient.addColorStop(0.15,  'rgba(0,0,0,0)');
        axisGradient.addColorStop(0.5,   'rgba(0,0,0,0)');
        axisGradient.addColorStop(0.85,  'rgba(0,0,0,0)');
        axisGradient.addColorStop(1.0,   'rgba(255,255,255,0.1)');
        canvasContext.fillStyle = axisGradient;
        canvasContext.fillRect(0,-plotHeight/2,canvas.width, plotHeight);
    }

    //Draw a grid
    function drawGrid(curve, plotHeight) {
        var settings = curve.getCurve(),
            GRID_LINES = 10,
            min = -settings.inputRange - settings.offset,
            max = settings.inputRange - settings.offset,
            GRID_INTERVAL = 1/GRID_LINES * (max - min),
            yScale = -plotHeight/2;

        canvasContext.strokeStyle = "rgba(255,255,255,0.5)"; // Grid Color
		canvasContext.setLineDash([1,10]); // Make the grid line a dash        
        canvasContext.lineWidth = 1;
        canvasContext.beginPath();

        // horizontal lines
        for(var y=1; y<GRID_LINES; y++) {
            var yValue = curve.lookup(GRID_INTERVAL * y + min) * yScale;
            if(yValue!=0 && Math.abs(yValue < plotHeight/2)) {
                canvasContext.moveTo(0, yValue );
                canvasContext.lineTo(canvas.width, yValue);
            }
        }
		// vertical lines
		for(var i=(windowStartTime / 100000).toFixed(0) * 100000; i<windowEndTime; i+=100000) {
            var x = timeToCanvasX(i);
            canvasContext.moveTo(x, yScale);
            canvasContext.lineTo(x, -yScale);
		}

        canvasContext.stroke();
		canvasContext.setLineDash([]); // clear the dash

        // range values,
        //drawAxisLabel(max.toFixed(0), yScale + 12);
        //drawAxisLabel(min.toFixed(0), -yScale - 8);
        

    }

    function drawAxisLabel(axisLabel, y) {
        canvasContext.font = drawingParams.fontSizeAxisLabel + "pt " + DEFAULT_FONT_FACE;
        canvasContext.fillStyle = "rgba(255,255,255,0.9)";
        canvasContext.textAlign = 'right';
        
        canvasContext.fillText(axisLabel, canvas.width - 8, (y)?y:-8);
    }
    
    function drawEventLine(x, labelY, label, color, width, labelColor, align) {
        width = width || 1.0;
        
        canvasContext.lineWidth = width;
        canvasContext.strokeStyle = color || "rgba(255,255,255,0.5)";
        
        canvasContext.beginPath();
        
        canvasContext.moveTo(x, 0);
        canvasContext.lineTo(x, canvas.height);
        
        canvasContext.stroke();
        
        if (label) {
            var 
                margin = 8,
                labelWidth = canvasContext.measureText(label).width + 2 * margin;

            align = align || 'left'
            canvasContext.textAlign = align;
            var labelDirection = (align=='left')?1:-1;
            
            canvasContext.lineWidth = 1;
            canvasContext.beginPath();

            canvasContext.moveTo(x + labelDirection * (width - 1), labelY - drawingParams.fontSizeEventLabel/2);
            canvasContext.lineTo(x + labelDirection * (margin), labelY - drawingParams.fontSizeEventLabel*1.5);
            canvasContext.lineTo(x + labelDirection * (labelWidth), labelY - drawingParams.fontSizeEventLabel*1.5);
            canvasContext.lineTo(x + labelDirection * (labelWidth), labelY + drawingParams.fontSizeEventLabel/2);
            canvasContext.lineTo(x + labelDirection * (margin), labelY + drawingParams.fontSizeEventLabel/2);
            canvasContext.lineTo(x + labelDirection * (width - 1), labelY - drawingParams.fontSizeEventLabel/2);

            canvasContext.fillStyle = color || "rgba(255,255,255,0.5)";
            canvasContext.fill();
            canvasContext.stroke();
            canvasContext.fillStyle = labelColor || "rgba(200,200,200,0.9)";
            canvasContext.closePath();

            canvasContext.fillText(label, x + labelDirection * (width + 8), labelY);
          
        }
    }
    
    function timeToCanvasX(time) {
        return canvas.width / windowWidthMicros * (time - windowStartTime);
    }
   
    function drawEvent(event, sequenceNum) {
        var 
            x = timeToCanvasX(event.time),
            labelY = (sequenceNum + 1) * (drawingParams.fontSizeEventLabel + 10);
        
        switch (event.event) {
            case FlightLogEvent.AUTOTUNE_TARGETS:
                canvasContext.beginPath();

                canvasContext.moveTo(x, canvas.height / 2 - 25);
                canvasContext.lineTo(x, canvas.height / 2 + 25);
                
                canvasContext.stroke();
            break;
            case FlightLogEvent.LOGGING_RESUME:
                drawEventLine(x, labelY, "Logging resumed", "rgba(50,50,50,0.75)", 3);
            break;
            case FlightLogEvent.SYNC_BEEP:
                drawEventLine(x, labelY, "Arming beep begins", "rgba(0,0,255,0.75)", 3);
            break;
            case FlightLogEvent.GTUNE_CYCLE_RESULT:
                drawEventLine(x, labelY, "GTune result - axis:" + event.data.axis + " gyroAVG:" + event.data.gyroAVG + " newP:" + event.data.newP, "rgba(255,255,255,0.5)");
            break;
            case FlightLogEvent.INFLIGHT_ADJUSTMENT:
                drawEventLine(x, labelY, event.data.name + " = " + event.data.value, "rgba(0,255,255,0.5)", 2);
            break
            case FlightLogEvent.TWITCH_TEST:
                drawEventLine(x, labelY, "Twitch Test: " + event.data.name + event.data.value.toFixed(3) + "ms", "rgba(0,133,255,0.5)", 2);
            break;
            case FlightLogEvent.FLIGHT_MODE:
                drawEventLine(x, labelY, "Flight Mode Change" + FlightLogFieldPresenter.presentChangeEvent(event.data.newFlags, event.data.lastFlags, FLIGHT_LOG_FLIGHT_MODE_NAME), "rgba(0,0,255,0.75)", 3);
            break;
            case FlightLogEvent.CUSTOM: // Virtual Events shown in RED
                drawEventLine(x, labelY, (event.label)?event.label:'EVENT', "rgba(255,0,0,0.75)", 3, null, event.align);
            break;
            case FlightLogEvent.CUSTOM_BLANK: // Virtual Events shown in RED
                drawEventLine(x, labelY, (event.label)?event.label:'EVENT', "rgba(255,0,0,0.75)", 0, null, event.align);
            break;
            default:
                drawEventLine(x);
        }
        
    }
    
    function drawEvents(chunks) {
        var 
            /* 
             * Also draw events that are a little left of the window, so that their labels don't suddenly 
             * disappear when they scroll out of view:
             */ 
            BEGIN_MARGIN_MICROSECONDS = 100000, 
            shouldSetFont = true,
            sequenceNum = 0;
        
        for (var i = 0; i < chunks.length; i++) {
            var events = chunks[i].events;
            
            for (var j = 0; j < events.length; j++) {
                if (events[j].time > windowEndTime) {
                    return;
                }
                
                if (events[j].time >= windowStartTime - BEGIN_MARGIN_MICROSECONDS) {
                    // Avoid setting the font if we don't draw any events
                    if (shouldSetFont) {
                        canvasContext.fillStyle = "rgba(255, 255, 255, 0.8)";
                        canvasContext.font = drawingParams.fontSizeEventLabel + "pt " + DEFAULT_FONT_FACE;
                        shouldSetFont = false;
                    }
                    
                    drawEvent(events[j], sequenceNum++);
                }
            }
        }

        // Add custom markers

        var markerEvent = blackboxLogViewer.getMarker();
        var bookmarkEvents = blackboxLogViewer.getBookmarks();
        if ((shouldSetFont) && ((markerEvent!=null)||(bookmarkEvents!=null))) {
            canvasContext.fillStyle = "rgba(255, 255, 255, 0.8)";
            canvasContext.font = drawingParams.fontSizeEventLabel + "pt " + DEFAULT_FONT_FACE;
            shouldSetFont = false;
        }

        // Draw Marker Event Line
        if(markerEvent!=null) {
            if(markerEvent.state) { 

                if ((markerEvent.time >= windowStartTime - BEGIN_MARGIN_MICROSECONDS) && (markerEvent.time < windowEndTime)) {
                    drawEvent(
                        {
                        event:FlightLogEvent.CUSTOM,
                        time:markerEvent.time,
                        label:'Marker:' +formatTime((markerEvent.time-flightLog.getMinTime())/1000, true) ,
                        align:(markerEvent.time<windowCenterTime)?'left':'right',
                        }, sequenceNum++);
                };
                
                var markerFrequency = ((windowCenterTime-markerEvent.time).toFixed(0)!=0)?((1000000/(windowCenterTime-markerEvent.time)).toFixed(0) + "Hz") : '';
                drawEvent(
                    {
                    event:FlightLogEvent.CUSTOM_BLANK, // Blank doesnt show a vertical line
                    time:windowCenterTime,
                    label: formatTime((windowCenterTime-markerEvent.time)/1000, true) + 'ms ' + markerFrequency,
                    align:(markerEvent.time<windowCenterTime)?'right':'left', 
                    }, sequenceNum++);                    
            };
        }

        // Draw Bookmarks Event Line
        if(bookmarkEvents!=null) {
        	for(var i=0; i<=9; i++) {
        		if(bookmarkEvents[i]!=null) {
		            if(bookmarkEvents[i].state) 
                        if ((bookmarkEvents[i].time >= windowStartTime - BEGIN_MARGIN_MICROSECONDS) && (bookmarkEvents[i].time < windowEndTime)) {
                            drawEvent(
                                {
                                event:FlightLogEvent.CUSTOM,
                                time:bookmarkEvents[i].time,
                                label: i 
                                }, sequenceNum++);
                        };
                    };
        	};
        };
    
    }
    
    /**
     *  Mark the in/out of the video region (if present) and dim the view outside this region
     */
    function drawInOutRegion() {
        if (inTime !== false && inTime >= windowStartTime || outTime !== false && outTime < windowEndTime) {
            var
                inMarkerX = inTime === false ? false : timeToCanvasX(inTime),
                outMarkerX = outTime === false ? false : timeToCanvasX(outTime); 

            canvasContext.fillStyle = "rgba(0,0,0,0.8)";
            
            if (inTime !== false && inTime >= windowStartTime) {
                canvasContext.fillRect(0, 0, Math.min(inMarkerX, canvas.width), canvas.height);
            } 
            
            if (outTime !== false && outTime < windowEndTime) {
                var
                    outMarkerXClipped = Math.max(outMarkerX, 0);
                canvasContext.fillRect(outMarkerXClipped, 0, canvas.width - outMarkerXClipped, canvas.height);
            }
            
            if (inMarkerX !== false && inMarkerX >= 0 && inMarkerX <= canvas.width || outMarkerX !== false && outMarkerX >= 0 && outMarkerX <= canvas.width) {
                canvasContext.strokeStyle = 'rgb(200,200,200)';
                canvasContext.lineWidth = 4;
    
                if (inMarkerX !== false && inMarkerX >= 0 && inMarkerX <= canvas.width) {
                    canvasContext.beginPath();
                    canvasContext.moveTo(inMarkerX, 0);
                    canvasContext.lineTo(inMarkerX, canvas.height);
                    canvasContext.stroke();
                }
    
                if (outMarkerX !== false && outMarkerX >= 0 && outMarkerX <= canvas.width) {
                    canvasContext.beginPath();
                    canvasContext.moveTo(outMarkerX, 0);
                    canvasContext.lineTo(outMarkerX, canvas.height);
                    canvasContext.stroke();
                }
            }
        }
    }

    function computeDrawingParameters() {
        var
            fontSizeBase = Math.max(8, canvas.height / 60),
            
            newParams = {
                fontSizePIDTableLabel:     fontSizeBase * 3.4,
                fontSizeAxisLabel:         fontSizeBase * 0.9,
                fontSizeFrameLabel:        fontSizeBase * 0.9,
                fontSizeEventLabel:        fontSizeBase * 0.8,
                
                plotLineWidth:             Math.max(1.25, canvas.height / 400),
            };
  
        drawingParams = extend(drawingParams, newParams);
    }
    
    this.resize = function(width, height) {
        canvas.width = width;
        canvas.height = height;
        
        var sticksHeight = canvas.height * parseInt(options.sticks.size) / 2 / 100.0;
        // The total width available to draw both sticks in:
        var sticksWidth = canvas.width * parseInt(options.sticks.size) / 100.0;

        if (sticks){
            sticks.resize(sticksWidth, sticksHeight);
        }

         // Recenter the craft canvas in the top left corner
         $(stickCanvas).css({
            left:Math.max(((canvas.width * parseInt(options.sticks.left) / 100.0) - (sticksWidth / 2)), 0) + "px",
            top: Math.max(((canvas.height * parseInt(options.sticks.top) / 100.0) - (sticksHeight / 2)), 0) + "px",
        });

        var craftSize = canvas.height * (parseInt(options.craft.size) / 100.0);
        
        if (craft2D) {
            craft2D.resize(craftSize, craftSize);
        } else if (craft3D) {
            craft3D.resize(craftSize, craftSize);
        }

        // Positon the craft canvas according to options
        $(craftCanvas).css({
            left:Math.max(((canvas.width * parseInt(options.craft.left) / 100.0) - (craftSize / 2)), 0) + "px",
            top: Math.max(((canvas.height * parseInt(options.craft.top) / 100.0) - (craftSize / 2)), 0) + "px",
        });
        
        if(analyser!=null) analyser.resize();

        // Calculate again the position/size of frame label
        frameLabelTextWidthFrameNumber = null;
        frameLabelTextWidthFrameTime = null;

        computeDrawingParameters();
    };
    
    this.render = function(windowCenterTimeMicros) {
        windowCenterTime = windowCenterTimeMicros;
        windowStartTime = windowCenterTime - windowWidthMicros / 2;
        windowEndTime = windowStartTime + windowWidthMicros;
        
        if (options.eraseBackground) {
            // Work-around: The webm-writer does not like transparent backgrounds. Fill canvas with black.
            if (options.fillBackground) {
                canvasContext.fillStyle = 'black';
                canvasContext.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                canvasContext.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        
        var 
            chunks = flightLog.getSmoothedChunksInTimeRange(windowStartTime, windowEndTime),
            startChunkIndex, startFrameIndex,
            i, j;
        
        if (chunks.length) {
            //Find the first sample that lies inside the window
            for (startFrameIndex = 0; startFrameIndex < chunks[0].frames.length; startFrameIndex++) {
                if (chunks[0].frames[startFrameIndex][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] >= windowStartTime) {
                    break;
                }
            }
            
            // Pick the sample before that to begin plotting from
            if (startFrameIndex > 0)
                startFrameIndex--;
            
            // Plot graphs
            for (i = 0; i < graphs.length; i++) {
                var 
                    graph = graphs[i];
            
                canvasContext.save();
                {
                    canvasContext.translate(0, canvas.height * graph.y);
                    
                    drawAxisLine();

                    if(!options.graphGridOverride) {
                        for (j = 0; j < graph.fields.length; j++) {
                            if(graph.fields[j].grid){
                                drawGrid(graph.fields[j].curve, canvas.height * graph.height);
                                break;
                            };
                        };
                    }

                    if(graphs.length > 1) // only draw the background if more than one graph set.
                        drawAxisBackground(canvas.height * graph.height);
                    
                    for (j = 0; j < graph.fields.length; j++) {
                        var field = graph.fields[j];
                        plotField(chunks, startFrameIndex, field.index, field.curve, canvas.height * graph.height / 2, 
                            field.color ? field.color : GraphConfig.PALETTE[j % GraphConfig.PALETTE.length],
                            field.lineWidth ? field.lineWidth : null, 
                            graphConfig.highlightGraphIndex==i && graphConfig.highlightFieldIndex==j);
                    }
                    
                    if (graph.label) {
                        drawAxisLabel(graph.label);
                    }
                }
                canvasContext.restore();
            }
            
            //Draw a bar highlighting the current time if we are drawing any graphs
            if (graphs.length) {
                var 
                    centerX = canvas.width / 2;

                canvasContext.strokeStyle = 'rgba(255, 64, 64, 0.2)';
                canvasContext.lineWidth = 11;

                canvasContext.beginPath();
                canvasContext.moveTo(centerX, 0);
                canvasContext.lineTo(centerX, canvas.height);
                canvasContext.stroke();

                canvasContext.strokeStyle = 'rgba(255, 128, 128, 0.7)';
                canvasContext.lineWidth = 1;
                canvasContext.beginPath();
                canvasContext.moveTo(centerX, 0);
                canvasContext.lineTo(centerX, canvas.height);
                canvasContext.stroke();
		         
            }
            
            // Draw events - if option set or even if option is not set but there are graphs
            // the option is for video export; if you export the video without any graphs set,
            // then the events are not shown either (to keep the video clean. but
            // if you export the video with a graph selected, then the events are also shown.
            
            if(options.drawEvents || (!options.drawEvents && graphs.length > 0)) {
                drawEvents(chunks);
            }

            // Draw details at the current time
            var
                centerFrame = flightLog.getSmoothedFrameAtTime(windowCenterTime);
            
            if (centerFrame) {
                if (options.drawSticks) {
                    sticks.render(centerFrame, chunks, startFrameIndex, windowCenterTime);
                }
                
                if (options.drawTime) {
                    drawFrameLabel(centerFrame[FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION], Math.round((windowCenterTime - flightLog.getMinTime()) / 1000));
                }
                
                if (options.craftType == '3D') {
                    craft3D.render(centerFrame, flightLog.getMainFieldIndexes());
                } else if (options.craftType == '2D') {
                    craft2D.render(centerFrame, flightLog.getMainFieldIndexes());
                    
                }
            }
            
            // Draw Analyser
            if (options.drawAnalyser && graphConfig.selectedFieldName) {
                try{ // If we do not select a graph/field, then the analyser is hidden
                var graph = graphs[graphConfig.selectedGraphIndex]; 		
				var field = graph.fields[graphConfig.selectedFieldIndex];   	            
                analyser.plotSpectrum(field.index, field.curve, field.friendlyName);
                } catch(err) {console.log('Cannot plot analyser ' + err);}            
            }

            //Draw Watermark
            if (options.drawWatermark && watermarkLogo) {
                drawWaterMark();
            }

            //Draw Lap Timer
            if (options.drawLapTimer && lapTimer) {
                drawLapTimer();
            }

        }
        
        drawInOutRegion();
    };
    
    this.refreshGraphConfig = function() {
        var 
            smoothing = {},
            heightSum = 0, allocatedHeight, graphHeight,
            i, graph;
        
        graphs = jQuery.extend(true, [], graphConfig.getGraphs());
        
        for (i = 0; i < graphs.length; i++) {
            graph = graphs[i];
            
            heightSum += graph.height ? graph.height : 1.0;
            
            for (var j = 0; j < graphs[i].fields.length; j++) {
                var field = graphs[i].fields[j];
                
                field.index = flightLog.getMainFieldIndexByName(field.name);
                
                // Convert the field's curve settings into an actual expo curve object:
                field.curve = new ExpoCurve(field.curve.offset, 
                                            ((options.graphExpoOverride)?1.0:field.curve.power), 
                                            field.curve.inputRange, 
                                            field.curve.outputRange, 
                                            field.curve.steps); 
                
                if (field.smoothing > 0) {
                    smoothing[field.index] = (options.graphSmoothOverride)?0:field.smoothing;
                }
            }
        }
        
        // Lay out the graphs vertically downwards in order
        allocatedHeight = 0;
        for (i = 0; i < graphs.length; i++) {
            graph = graphs[i];
            
            graphHeight = graph.height / heightSum;
            
            graph.y = allocatedHeight + graphHeight / 2;
            
            allocatedHeight += graphHeight;
        }
        
        // Scale the graph heights so they don't overlap
        for (i = 0; i < graphs.length; i++) {
            graph = graphs[i];

            graph.height = graph.height / heightSum * 0.975;
        }
    
        flightLog.setFieldSmoothing(smoothing);
    }
    
    this.initializeCraftModel = function() {

        // Ensure craftType is a valid value
        if (["2D", "3D"].indexOf(options.craftType) == -1) {
            options.craftType = defaultOptions.craftType;
        }

        if (options.craftType == '3D') {
            if (craftCanvas) {
                try {
                    craft3D = new Craft3D(flightLog, craftCanvas, idents.motorColors);
                } catch (e) {
                    //WebGL not supported, fall back to 2D rendering
                    options.craftType = '2D';
                }
            } else {
                //Dedicated craft canvas not provided so we can't render in 3D, fall back
                options.craftType = '2D';
            }
        }
        
        if (options.craftType == '2D') {
            craft2D = new Craft2D(flightLog, craftCanvas, idents.motorColors);
        }

    }
    
    this.destroy = function() {
        $(canvas).off("mousedown", onMouseDown);
        $(canvas).off("touchstart", onTouchStart);
    };
    
    this.setGraphZoom = function(zoom) {
        windowWidthMicros = Math.round(WINDOW_WIDTH_MICROS_DEFAULT / zoom);
    };
    
    this.setInTime = function(time) {
        inTime = time;
        analyser.setInTime(inTime);

        if (outTime <= inTime) {
            outTime = false;
            analyser.setOutTime(outTime);
        }
    };

    this.setOutTime = function(time) {
        outTime = time;
        analyser.setOutTime(outTime);
        
        if (inTime >= outTime) {
            inTime = false;
            analyser.setInTime(inTime);
        }
    };

    // New function to return the current window scale.
    this.getWindowWidthTime = function() {
        return windowWidthMicros;
    }

    // Add option toggling
    this.setDrawSticks = function(state) {
      options.drawSticks = state;  
    };

    // Add option toggling
    this.setDrawAnalyser= function(state) {
      options.drawAnalyser = state;  
    };
    
    // Add analyser zoom toggling
    this.setAnalyser= function(state) {
      analyser.setFullscreen( state );  
    };
    
    // Update user options
    this.refreshOptions = function(newSettings) {
        options = $.extend(defaultOptions, newSettings || {});
    }

    this.refreshLogo = function() {
        if(options.watermark.logo) {
            watermarkLogo = new Image();
            watermarkLogo.src = options.watermark.logo;
        }
    }

    // Use defaults for any options not provided
    options = extend(defaultOptions, options || {});
    
    identifyFields();

    /* Create the FlightLogSticks object */
    sticks = new FlightLogSticks(flightLog, idents.rcCommandFields, stickCanvas, options);

    this.initializeCraftModel();

    this.refreshLogo();
    
    /* Create the FlightLogAnalyser object */
	analyser = new FlightLogAnalyser(flightLog, canvas, analyserCanvas);

    /* Create the Lap Timer object */
	lapTimer = new LapTimer();

    //Handle dragging events
    $(canvas).on("mousedown", onMouseDown);
    $(canvas).on("touchstart", onTouchStart);
    
    graphConfig.addListener(this.refreshGraphConfig);
    this.refreshGraphConfig();
        
    $('html').toggleClass("has-grid-override", options['graphGridOverride']);
    
    this.resize(canvas.width, canvas.height);

}
