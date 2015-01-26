"use strict";

function FlightLogGrapher(flightLog, canvas, craftCanvas) {
    var
        PID_P = 0,
        PID_I = 1,
        PID_D = 2,
        
        WHITE = "white",
        
        DEFAULT_FONT_FACE = "Verdana, Arial, sans-serif",
        
        FONTSIZE_CURRENT_VALUE_LABEL = 10,
        FONTSIZE_PID_TABLE_LABEL = 34,
        FONTSIZE_AXIS_LABEL = 9,
        FONTSIZE_FRAME_LABEL = 9,
        
        lineColors = [
            "#fb8072",
            "#8dd3c7",
            "#ffffb3",
            "#bebada",
            "#80b1d3",
            "#fdb462",
            "#b3de69",
            "#fccde5",
            "#d9d9d9",
            "#bc80bd",
            "#ccebc5",
            "#ffed6f"
        ],
        
        craftColor = "rgb(76,76,76)",
        
        windowWidthMicros = 1000000;
    
    var
        windowStartTime, windowCenterTime, windowEndTime,
        
        canvasContext = canvas.getContext("2d"),
        
        craftParameters,
        
        options = {
            gapless:false,
            drawCraft:"2D", drawPidTable:true, drawSticks:true, drawTime:true
        },
        
        idents,
        
        sysConfig = flightLog.getSysConfig(),

        pitchStickCurve = new ExpoCurve(0, 0.700, 500 * (sysConfig.rcRate ? sysConfig.rcRate : 100) / 100, 1.0, 10),

        lastMouseX, lastMouseY,
        
        craft3D,
        
        that = this;
    
    this.onSeek = null;
    
    function onMouseMove(e) {
        e.preventDefault();
        
        if (that.onSeek) {
            //Reverse the seek direction so that it looks like you're dragging the data with the mouse
            that.onSeek((lastMouseX - e.pageX) / canvas.width * windowWidthMicros); 
        }
        
        lastMouseX = e.pageX;
        lastMouseY = e.pageY;
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
    
    function makeColorHalfStrength(color) {
        color = parseInt(color.substring(1), 16);
        
        return "rgba(" + ((color >> 16) & 0xFF) + "," + ((color >> 8) & 0xFF) + "," + (color & 0xFF) + ",0.5)";
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
            motorShadeColors:[],

            axisPIDFields: [[], [], []],  //First dimension is [P, I, D], second dimension is axis
            PIDAxisColors: [[], [], []], //PID, axis
            PIDLineStyle: [], //Indexed by PID_P etc

            gyroFields:[],
            gyroColors:[],

            accFields:[],
            accColors:[],

            servoFields:[],
            servoColors:[],

            vbatField:-1,
            numCells:-1,
            baroField:-1,

            miscFields:[],
            miscColors:[],

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
                idents.motorShadeColors[motorIndex] = makeColorHalfStrength(idents.motorColors[motorIndex]);
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

                if (options.plotPids) {
                    idents.PIDAxisColors[PID_P][axisIndex] = lineColors[0];
                    idents.PIDAxisColors[PID_I][axisIndex] = lineColors[1];
                    idents.PIDAxisColors[PID_D][axisIndex] = lineColors[2];
                } else {
                    idents.PIDAxisColors[PID_P][axisIndex] = WHITE;
                    idents.PIDAxisColors[PID_I][axisIndex] = WHITE;
                    idents.PIDAxisColors[PID_D][axisIndex] = WHITE;
                }

                idents.PIDLineStyle[axisIndex] = 0; //TODO
            } else if ((matches = fieldName.match(/^gyroData\[(\d+)]$/))) {
                var axisIndex = matches[1];

                idents.gyroFields[axisIndex] = fieldIndex;

                if (options.plotGyros) {
                    if (options.bottomGraphSplitAxes)
                        idents.gyroColors[axisIndex] = lineColors[(PID_D + 2) % lineColors.length];
                    else
                        idents.gyroColors[axisIndex] = lineColors[axisIndex % lineColors.length];
                } else
                    idents.gyroColors[axisIndex] = WHITE;
            } else if ((matches = fieldName.match(/^accSmooth\[(\d+)]$/))) {
                var axisIndex = matches[1];

                idents.accFields[axisIndex] = fieldIndex;
                idents.accColors[axisIndex] = lineColors[axisIndex % lineColors.length];
            } else if ((matches = fieldName.match(/^servo\[(\d+)]$/))) {
                var servoIndex = matches[1];

                idents.numServos++;
                idents.servoFields[servoIndex] = fieldIndex;
                idents.servoColors[servoIndex] = lineColors[(motorGraphColorIndex++) % lineColors.length];
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
                        idents.miscColors.push(lineColors[idents.miscColors.length % lineColors.length]);
                }
            }
        }
    }
    
    function decideCraftParameters() {
        craftParameters ={
            bladeLength: canvas.height / 14
        };
        
        craftParameters.tipBezierWidth = 0.2 * craftParameters.bladeLength;
        craftParameters.tipBezierHeight = 0.1 * craftParameters.bladeLength;
        craftParameters.motorSpacing = craftParameters.bladeLength * 1.7;
        
        switch (idents.motorFields.length) {
            case 3:
                craftParameters.motors = [
                    {
                        x: 0,
                        y: 1,
                        direction: -1,
                        color: idents.motorColors[0]
                    }, {
                        x: .71,
                        y: -.71,
                        direction: -1,
                        color: idents.motorColors[1]
                    }, {
                        x: -.71,
                        y: -.71,
                        direction: -1,
                        color: idents.motorColors[2]
                    }
                ];
            break;
            case 4:
                craftParameters.motors = [
                    {
                        x: .71,
                        y: .71,
                        direction: 1,
                        color: idents.motorColors[0]
                    }, {
                        x: .71,
                        y: -.71,
                        direction: -1,
                        color: idents.motorColors[1]
                    }, {
                        x: -.71,
                        y: .71,
                        direction: -1,
                        color: idents.motorColors[2]
                    }, {
                        x: -.71,
                        y: -.71,
                        direction: 1,
                        color: idents.motorColors[3]
                    }
                ];
            break;
            default:
                craftParameters.motors = [];
            
                for (var i = 0; i < idents.motorFields.length; i++) {
                    craftParameters.motors.push({
                        x: Math.cos(i / idents.motorFields.length * Math.PI * 2),
                        y: Math.sin(i / idents.motorFields.length * Math.PI * 2),
                        direction: Math.pow(-1, i),
                        color: idents.motorColors[i]
                    });
                }
            break;
        }
    }
    
    function drawCraft2D(frame) {
        var 
            motorIndex;
        
        //Draw arms
        canvasContext.lineWidth = craftParameters.bladeLength * 0.30;
        
        canvasContext.lineCap = "round";
        canvasContext.strokeStyle = craftColor;
        
        canvasContext.beginPath();
        
        for (motorIndex = 0; motorIndex < idents.motorFields.length; motorIndex++) {
            canvasContext.moveTo(0, 0);

            canvasContext.lineTo(
                craftParameters.motorSpacing * craftParameters.motors[motorIndex].x * 1.2,
                craftParameters.motorSpacing * craftParameters.motors[motorIndex].y * 1.2
            );
        }

        canvasContext.stroke();

        //Draw the central hub
        canvasContext.beginPath();
        
        canvasContext.moveTo(0, 0);
        canvasContext.arc(0, 0, craftParameters.motorSpacing * 0.3, 0, 2 * Math.PI);
        
        canvasContext.fillStyle = craftColor;
        canvasContext.fill();

        canvasContext.font = FONTSIZE_CURRENT_VALUE_LABEL + "pt " + DEFAULT_FONT_FACE;

        for (motorIndex = 0; motorIndex < idents.motorFields.length; motorIndex++) {
            canvasContext.save();
            {
                //Move to the motor center
                canvasContext.translate(
                    craftParameters.motorSpacing * craftParameters.motors[motorIndex].x,
                    craftParameters.motorSpacing * craftParameters.motors[motorIndex].y
                );

                canvasContext.fillStyle = idents.motorShadeColors[motorIndex];

                canvasContext.beginPath();
                
                canvasContext.moveTo(0, 0);
                canvasContext.arc(0, 0, craftParameters.bladeLength, 0, Math.PI * 2, false);
                
                canvasContext.fill();

                canvasContext.fillStyle = craftParameters.motors[motorIndex].color;

                canvasContext.beginPath();

                canvasContext.moveTo(0, 0);
                canvasContext.arc(0, 0, craftParameters.bladeLength, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 
                        * Math.max(frame[idents.motorFields[motorIndex]] - sysConfig.minthrottle, 0) / (sysConfig.maxthrottle - sysConfig.minthrottle), false);
                
                canvasContext.fill();

                var
                    motorLabel = "" + frame[idents.motorFields[motorIndex]];

                if (craftParameters.motors[motorIndex].x > 0) {
                    canvasContext.textAlign = 'left';
                    canvasContext.fillText(motorLabel, craftParameters.bladeLength + 10, 0);
                } else {
                    canvasContext.textAlign = 'right';
                    canvasContext.fillText(motorLabel, -(craftParameters.bladeLength + 10), 0);
                }

            }
            
            canvasContext.restore();
        }
    }
    
    function drawCommandSticks(frame) {
        var
            stickSurroundRadius = canvas.height / 11, 
            stickSpacing = stickSurroundRadius * 3,
            yawStickMax = 500,
            
            stickColor = "rgba(255,102,102,1.0)",
            stickAreaColor = "rgba(76,76,76,0.8)",
            crosshairColor = "rgba(191,191,191,0.5)";
        
        var
            stickIndex,
            rcCommand = [],
            stickPositions = [],
            stickLabel;

        for (stickIndex = 0; stickIndex < 4; stickIndex++) {
            //Check that stick data is present to be drawn:
            if (idents.rcCommandFields[stickIndex] === undefined)
                return;

            rcCommand[stickIndex] = frame[idents.rcCommandFields[stickIndex]];
        }

        //Compute the position of the sticks in the range [-1..1] (left stick x, left stick y, right stick x, right stick y)
        stickPositions[0] = -rcCommand[2] / yawStickMax; //Yaw
        stickPositions[1] = (1500 - rcCommand[3]) / 500; //Throttle
        stickPositions[2] = pitchStickCurve.lookup(rcCommand[0]); //Roll
        stickPositions[3] = pitchStickCurve.lookup(-rcCommand[1]); //Pitch

        for (stickIndex = 0; stickIndex < 4; stickIndex++) {
            //Clamp to [-1..1]
            stickPositions[stickIndex] = stickPositions[stickIndex] > 1 ? 1 : (stickPositions[stickIndex] < -1 ? -1 : stickPositions[stickIndex]);

            //Scale to our stick size
            stickPositions[stickIndex] *= stickSurroundRadius;
        }

        // Move origin to center of left stick
        canvasContext.translate(-stickSpacing / 2, 0);

        canvasContext.font = FONTSIZE_CURRENT_VALUE_LABEL + "pt " + DEFAULT_FONT_FACE;

        //For each stick
        for (var i = 0; i < 2; i++) {
            //Fill in background
            canvasContext.beginPath();
            canvasContext.fillStyle = stickAreaColor;
            canvasContext.rect(-stickSurroundRadius, -stickSurroundRadius, stickSurroundRadius * 2, stickSurroundRadius * 2);
            canvasContext.fill();

            //Draw crosshair
            canvasContext.beginPath();
            canvasContext.lineWidth = 1;
            canvasContext.strokeStyle = crosshairColor;
            
            canvasContext.moveTo(-stickSurroundRadius, 0);
            canvasContext.lineTo(stickSurroundRadius, 0);
            
            canvasContext.moveTo(0, -stickSurroundRadius);
            canvasContext.lineTo(0, stickSurroundRadius);
            
            canvasContext.stroke();

            //Draw circle to represent stick position
            canvasContext.beginPath();
            canvasContext.fillStyle = stickColor;
            canvasContext.arc(stickPositions[i * 2 + 0], stickPositions[i * 2 + 1], stickSurroundRadius / 5, 0, 2 * Math.PI);
            canvasContext.fill();

            canvasContext.fillStyle = WHITE;
            
            //Draw horizontal stick label
            stickLabel = frame[idents.rcCommandFields[(1 - i) * 2 + 0]] + "";

            canvasContext.textAlign = 'center';
            canvasContext.fillText(stickLabel, 0, stickSurroundRadius + FONTSIZE_CURRENT_VALUE_LABEL + 8);

            //Draw vertical stick label
            stickLabel = frame[idents.rcCommandFields[(1 - i) * 2 + 1]] + "";
            
            canvasContext.textAlign = 'right';
            canvasContext.fillText(stickLabel, -stickSurroundRadius - 8, FONTSIZE_CURRENT_VALUE_LABEL / 2);

            //Advance to next stick
            canvasContext.translate(stickSpacing, 0);
        }
    }
    
    var
        frameLabelTextWidthFrameNumber,
        frameLabelTextWidthFrameTime;
    
    function drawFrameLabel(frameIndex, timeMsec)
    {
        var 
            extentFrameNumber, extentFrameTime;

        canvasContext.font = FONTSIZE_FRAME_LABEL + "pt " + DEFAULT_FONT_FACE;
        canvasContext.fillStyle = "rgba(255,255,255,0.65)";

        if (frameLabelTextWidthFrameNumber === undefined)
            frameLabelTextWidthFrameNumber = canvasContext.measureText("#0000000").width;
        
        canvasContext.fillText("#" + leftPad(frameIndex, "0", 7), canvas.width - frameLabelTextWidthFrameNumber - 8, canvas.height - 8);

        if (frameLabelTextWidthFrameTime === undefined)
            frameLabelTextWidthFrameTime = canvasContext.measureText("00:00.000").width;
        
        canvasContext.fillText(formatTime(timeMsec, true), canvas.width - frameLabelTextWidthFrameTime - 8, canvas.height - 8 - FONTSIZE_FRAME_LABEL - 8);
    }
    
    /**
     * Plot the given field within the specified time period. When the output from the curve applied to a field
     * value reaches 1.0 it'll be drawn plotHeight pixels away from the origin.
     */
    function plotField(chunks, startFrameIndex, fieldIndex, curve, plotHeight, color) {
        var
            GAP_WARNING_BOX_RADIUS = 3,
            chunkIndex, frameIndex,
            drawingLine = false,
            inGap = false,
            lastX, lastY,
            yScale = -plotHeight,
            xScale = canvas.width / windowWidthMicros;

        //Draw points from this line until we leave the window
        
        //We may start partway through the first chunk:
        frameIndex = startFrameIndex;
        
        canvasContext.strokeStyle = color;

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
    
                if (drawingLine) {
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

        canvasContext.stroke();
    }
    
    //Draw an origin line for a graph (at the origin and spanning the window)
    function drawAxisLine() {
        canvasContext.strokeStyle = "rgba(255,255,255,0.5)";
        canvasContext.lineWidth = 1;
        
        canvasContext.beginPath();
        canvasContext.moveTo(0, 0);
        canvasContext.lineTo(canvas.width, 0);
        
        canvasContext.stroke();
    }

    function drawAxisLabel(axisLabel) {
        canvasContext.font = FONTSIZE_AXIS_LABEL + "pt " + DEFAULT_FONT_FACE;
        canvasContext.fillStyle = "rgba(255,255,255,0.9)";
        canvasContext.textAlign = 'right';
        
        canvasContext.fillText(axisLabel, canvas.width - 8, -8);
    }
    
    this.resize = function(width, height) {
        canvas.width = width;
        canvas.height = height;
        
        decideCraftParameters();
    };
    
    this.render = function(windowCenterTimeMicros) {
        windowCenterTime = windowCenterTimeMicros;
        windowStartTime = windowCenterTime - windowWidthMicros / 2;
        windowEndTime = windowStartTime + windowWidthMicros;
        
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        
        var 
            chunks = flightLog.getSmoothedChunksInTimeRange(windowStartTime, windowEndTime),
            startChunkIndex, startFrameIndex,
            i, j;
        
        if (chunks.length) {
            //Find the first sample that lies inside the window
            for (var startFrameIndex = 0; startFrameIndex < chunks[0].frames.length; startFrameIndex++) {
                if (chunks[0].frames[startFrameIndex][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] >= windowStartTime) {
                    break;
                }
            }
            
            // Pick the sample before that to begin plotting from
            if (startFrameIndex > 0)
                startFrameIndex--;
            
            // Plot graphs
            for (i = 0; i < this.graphSetup.length; i++) {
                var 
                    graph = this.graphSetup[i],
                    field;
            
                canvasContext.save();
                {
                    canvasContext.translate(0, canvas.height * graph.y);
                    
                    drawAxisLine();
                    
                    for (j = 0; j < graph.fields.length; j++) {
                        var field = graph.fields[j];
                        
                        plotField(chunks, startFrameIndex, field.index, field.curve, canvas.height * graph.height / 2, lineColors[j]);
                    }
                    
                    if (graph.label) {
                        drawAxisLabel(graph.label);
                    }
                }
                canvasContext.restore();
            }
            
            //Draw a bar highlighting the current time if we are drawing any graphs
            if (this.graphSetup.length) {
                var 
                    centerX = canvas.width / 2;

                canvasContext.strokeStyle = 'rgba(255, 64, 64, 0.2)';
                canvasContext.lineWidth = 10;

                canvasContext.beginPath();
                canvasContext.moveTo(centerX, 0);
                canvasContext.lineTo(centerX, canvas.height);
                canvasContext.stroke();
            }
            
            // Draw details at the current time
            var
                centerFrame = flightLog.getSmoothedFrameAtTime(windowCenterTime);
            
            if (centerFrame) {
                if (options.drawSticks) {
                    canvasContext.save();
                    
                    canvasContext.translate(0.75 * canvas.width, 0.20 * canvas.height);
                    
                    drawCommandSticks(centerFrame);
                    
                    canvasContext.restore();
                }
                
                if (options.drawTime) {
                    drawFrameLabel(centerFrame[FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION], Math.round((windowCenterTime - flightLog.getMinTime()) / 1000));
                }
                
                if (options.drawCraft == '3D') {
                    craft3D.render(centerFrame, flightLog.getMainFieldIndexes());
                } else if (options.drawCraft == '2D') {
                    canvasContext.save();
                
                    canvasContext.translate(0.25 * canvas.width, 0.20 * canvas.height);

                    drawCraft2D(centerFrame);
                    
                    canvasContext.restore();
                }
            }
        }
    };
    
    this.setGraphSetup = function(graphSetup) {
        this.graphSetup = graphSetup;
        
        var 
            smoothing = [];
        
        for (var i = 0; i < graphSetup.length; i++) {
            for (var j = 0; j < graphSetup[i].fields.length; j++) {
                var field = graphSetup[i].fields[j];
                
                field.index = flightLog.getMainFieldIndexByName(field.name);
                
                if (field.smoothing > 0) {
                    smoothing.push({field:field.index, radius: field.smoothing});
                }
            }
        }

        flightLog.setFieldSmoothing(smoothing);
    };
    
    this.destroy = function() {
        $(canvas).off("mousedown", onMouseDown);
    };
    
    identifyFields();

    if (options.drawCraft == '3D') {
        craftCanvas.width = 300;
        craftCanvas.height = 300;
        craft3D = new Craft3D(flightLog, craftCanvas, idents.motorColors);
    } else {
        craftCanvas.width = 0;
        craftCanvas.height = 0;
    }
    
    //Handle dragging events
    $(canvas).on("mousedown", onMouseDown);
    
     //Debugging: 
    /*var chunks = flightLog.getChunksInTimeRange(flightLog.getMinTime(), flightLog.getMaxTime());
    
    for (var i = 0; i < chunks.length; i++) {
        var chunk = chunks[i];
        
        for (var j = 0; j < chunk.frames.length; j++) {
            console.log(chunk.frames[j].join(",") + "\n");
        }
    }*/
}