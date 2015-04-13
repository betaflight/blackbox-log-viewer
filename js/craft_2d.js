"use strict";

function Craft2D(flightLog, canvas, propColors, craftParameters) {
    var 
        numMotors = propColors.length, 
        shadeColors = [],

        craftColor = "rgb(76,76,76)",
        
        bladeLength,
        tipBezierWidth, tipBezierHeight, 
        motorSpacing;

    function makeColorHalfStrength(color) {
        color = parseInt(color.substring(1), 16);
        
        return "rgba(" + ((color >> 16) & 0xFF) + "," + ((color >> 8) & 0xFF) + "," + (color & 0xFF) + ",0.5)";
    }
    
    this.render = function(canvasContext, frame, frameFieldIndexes) {
        var 
            motorIndex,
            sysConfig = flightLog.getSysConfig();
        
        //Draw arms
        canvasContext.lineWidth = bladeLength * 0.30;
        
        canvasContext.lineCap = "round";
        canvasContext.strokeStyle = craftColor;
        
        canvasContext.beginPath();
        
        for (motorIndex = 0; motorIndex < numMotors; motorIndex++) {
            canvasContext.moveTo(0, 0);
    
            canvasContext.lineTo(
                motorSpacing * craftParameters.motors[motorIndex].x * 1.2,
                motorSpacing * craftParameters.motors[motorIndex].y * 1.2
            );
        }
    
        canvasContext.stroke();
    
        //Draw the central hub
        canvasContext.beginPath();
        
        canvasContext.moveTo(0, 0);
        canvasContext.arc(0, 0, motorSpacing * 0.3, 0, 2 * Math.PI);
        
        canvasContext.fillStyle = craftColor;
        canvasContext.fill();
    
        for (motorIndex = 0; motorIndex < numMotors; motorIndex++) {
            var motorValue = frame[frameFieldIndexes["motor[" + motorIndex + "]"]];
            
            canvasContext.save();
            {
                //Move to the motor center
                canvasContext.translate(
                    motorSpacing * craftParameters.motors[motorIndex].x,
                    motorSpacing * craftParameters.motors[motorIndex].y
                );
    
                canvasContext.fillStyle = shadeColors[motorIndex];
    
                canvasContext.beginPath();
                
                canvasContext.moveTo(0, 0);
                canvasContext.arc(0, 0, bladeLength, 0, Math.PI * 2, false);
                
                canvasContext.fill();
    
                canvasContext.fillStyle = propColors[motorIndex];
    
                canvasContext.beginPath();
    
                canvasContext.moveTo(0, 0);
                canvasContext.arc(0, 0, bladeLength, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 
                        * Math.max(motorValue - sysConfig.minthrottle, 0) / (sysConfig.maxthrottle - sysConfig.minthrottle), false);
                
                canvasContext.fill();
    
                var
                    motorLabel = "" + motorValue;
    
                if (craftParameters.motors[motorIndex].x > 0) {
                    canvasContext.textAlign = 'left';
                    canvasContext.fillText(motorLabel, bladeLength + 10, 0);
                } else {
                    canvasContext.textAlign = 'right';
                    canvasContext.fillText(motorLabel, -(bladeLength + 10), 0);
                }
    
            }
            canvasContext.restore();
        }
    };
    
    for (var i = 0; i < propColors.length; i++) {
        shadeColors.push(makeColorHalfStrength(propColors[i]));
    }
    
    this.resize = function(height) {
        bladeLength = 0.18 * height;
        
        tipBezierWidth = 0.2 * bladeLength;
        tipBezierHeight = 0.1 * bladeLength;
        motorSpacing = 1.8 * bladeLength;
    };
    
    this.resize(canvas.height);
}