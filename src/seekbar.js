export function SeekBar(canvas) {
    var
        that = this,
        
        //Times:
        min, max, current, currentWindow = 0,
        
        //Activity to display on bar:
        activityStrength, activityTime,
        
        //Whether a special event exists at the given time:
        hasEvent,
        
        //Expect to be plotting PWM-like data by default:
        activityMin = 1000, activityMax = 2000,

        canvasContext = canvas.getContext("2d"),
        
        background = document.createElement('canvas'),
        backgroundContext = background.getContext("2d"),
        
        inTime = false,
        outTime = false,
        
        backgroundValid = false,
        dirtyRegion = false,
        
        BACKGROUND_STYLE = '#eee',
        EVENT_BAR_STYLE = '#8d8',
        ACTIVITY_BAR_STYLE = 'rgba(170,170,255, 0.9)',
        OUTSIDE_EXPORT_RANGE_STYLE = 'rgba(100, 100, 100, 0.5)',
        
        // Suggested to be the same as that used by the graph's center mark in order to tie them together
        CURSOR_STYLE        = 'rgba(255, 64, 64, 0.75)',
        CURSOR_STYLE_WINDOW = 'rgba(255, 65, 64, 0.15)',

        //Current time cursor:
        CURSOR_WIDTH = 1,
        
        // The bar begins a couple of px inset from the left to allow the cursor to hang over the edge at start&end
        BAR_INSET = CURSOR_WIDTH;
    
    this.onSeek = false;
    
    function seekToDOMPixel(x) {
        var
            bounding = canvas.getBoundingClientRect(),
            time; 

        // Compensate for canvas being stretched on the page
        x = x / (bounding.right - bounding.left) * canvas.width;
        
        time = (x - BAR_INSET) * (max - min) / (canvas.width - 1 - BAR_INSET * 2) + min;
    
        if (time < min)
            time = min;
        
        if (time > max)
            time = max;
        
        if (that.onSeek)
            that.onSeek(time);
        
        that.repaint();
    }
    
    function invalidateBackground() {
        backgroundValid = false;
    }
    
    function onMouseMove(e) {
        if (e.which == 1)
            seekToDOMPixel(e.pageX - $(canvas).offset().left);
    }
    
    $(canvas).mousedown(function(e) {
        e.preventDefault();

        if (e.which == 1) { //Left mouse button only for seeking
            seekToDOMPixel(e.pageX - $(this).offset().left);
            
            //"capture" the mouse so we can drag outside the boundaries of the seek bar
            $("body").on("mousemove", onMouseMove);
            
            //Release the capture when the mouse is released
            $("body").one("mouseup", function () {
                $("body").off("mousemove", onMouseMove);
            });
        }
    });
    
    function onTouchMove(e) {
        if (e.which == 0)
            seekToDOMPixel(e.originalEvent.touches[0].pageX - $(canvas).offset().left);
    }
    
    function onTouchStart(e) {
        e.preventDefault();

        if (e.which == 0) { //touch only for seeking
            seekToDOMPixel(e.originalEvent.touches[0].pageX - $(this).offset().left);
            
            //"capture" so we can drag outside the boundaries of the seek bar
            $("body").on("touchmove", onTouchMove);
            
            //Release the capture when touch ends
            $("body").one("touchend", function () {
                $("body").off("touchmove", onTouchMove);
            });
        }
    }
    
    $(canvas).on("touchstart", onTouchStart);
    
    this.destroy = function() {
        $(canvas).off("touchstart", onTouchStart);
    };

    this.resize = function(width, height) {
        var ratio = window.devicePixelRatio ? window.devicePixelRatio : 1;
        
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        
        background.width = width * ratio;
        background.height = height * ratio;
        
        CURSOR_WIDTH = 2.5 * ratio;
        BAR_INSET = CURSOR_WIDTH; 
        
        invalidateBackground();
        
        that.repaint();
    };
    
    this.setActivityRange = function(min, max) {
        activityMin = min;
        activityMax = max;
        
        invalidateBackground();
    };
    
    this.setTimeRange = function(newMin, newMax, newCurrent) {
        min = newMin;
        max = newMax;
        current = newCurrent;
        
        invalidateBackground();
    };
    
    this.setActivity = function(newActivityTimes, newActivityStrengths, newHasEvent) {
        activityTime = newActivityTimes;
        activityStrength = newActivityStrengths;
        hasEvent = newHasEvent;
        
        invalidateBackground();
    };
    
    this.setCurrentTime = function(newTime) {
        current = newTime;
    };

    this.setWindow = function(newTime) {
        currentWindow = newTime;
    };

    function rebuildBackground() {
        var 
            x, activityIndex, activity,
            pixelTimeStep, time;
        
        backgroundContext.fillStyle = BACKGROUND_STYLE;
        backgroundContext.fillRect(0, 0, canvas.width, canvas.height);
        
        if (max > min) {
            pixelTimeStep = (max - min) / (canvas.width - BAR_INSET * 2);
            
            if (activityTime.length) {
                //Draw events
                backgroundContext.strokeStyle = EVENT_BAR_STYLE;
                backgroundContext.beginPath();
                
                time = min;
                activityIndex = 0;
                
                for (x = BAR_INSET; x < canvas.width - BAR_INSET; x++) {
                    //Advance to the right entry in the activity array for this time
                    while (activityIndex < activityTime.length && time >= activityTime[activityIndex]) {
                        activityIndex++;
                    }
                    
                    activityIndex--;
                    
                    if (activityIndex > 0) {
                        if (hasEvent[activityIndex]) {
                            backgroundContext.moveTo(x, canvas.height);
                            backgroundContext.lineTo(x, 0);
                        }
                    }
                    
                    time += pixelTimeStep;
                }

                backgroundContext.stroke();
                
                //Draw activity bars
                backgroundContext.strokeStyle = ACTIVITY_BAR_STYLE;
                backgroundContext.beginPath();
                
                time = min;
                activityIndex = 0;

                for (x = BAR_INSET; x < canvas.width - BAR_INSET; x++) {
                    //Advance to the right entry in the activity array for this time
                    while (activityIndex < activityTime.length && time >= activityTime[activityIndex]) {
                        activityIndex++;
                    }
                    
                    activityIndex--;
                    
                    if (activityIndex > 0) {
                        activity = (activityStrength[activityIndex] - activityMin) / (activityMax - activityMin) * canvas.height;
                        backgroundContext.moveTo(x, canvas.height);
                        backgroundContext.lineTo(x, canvas.height - activity);
                        
                    }
                    
                    time += pixelTimeStep;
                }
                
                backgroundContext.stroke();
            }
            
            // Paint in/out region
            if (inTime !== false || outTime !== false) {
                backgroundContext.fillStyle = OUTSIDE_EXPORT_RANGE_STYLE;
                
                if (inTime !== false) {
                    backgroundContext.fillRect(0, 0, (inTime - min) / pixelTimeStep + BAR_INSET, canvas.height);
                }
                
                if (outTime !== false) {
                    var 
                        barStartX = (outTime - min) / pixelTimeStep + BAR_INSET;
                    
                    backgroundContext.fillRect(barStartX, 0, canvas.width - barStartX, canvas.height);
                }
            }
            
            backgroundValid = true;
        }
    }
    
    this.repaint = function() {
        if (canvas.width == 0 || canvas.height == 0)
            return;
        
        if (!backgroundValid) {
            dirtyRegion = false;
            rebuildBackground();
        }
        
        if (dirtyRegion === false)
            canvasContext.drawImage(background, 0, 0);
        else {
            canvasContext.drawImage(background, dirtyRegion.x, dirtyRegion.y, dirtyRegion.width, dirtyRegion.height, dirtyRegion.x, dirtyRegion.y, dirtyRegion.width, dirtyRegion.height);
        }
        
        //Draw cursor
        var 
            pixelTimeStep = (max - min) / (canvas.width - BAR_INSET * 2),
            cursorX = (current - min) / pixelTimeStep + BAR_INSET,
            cursorWidth = 0;

        if(currentWindow!=0) {
            cursorWidth = (currentWindow/2) / pixelTimeStep;
        }

        canvasContext.fillStyle = CURSOR_STYLE;
        if(cursorWidth < CURSOR_WIDTH) {
            cursorWidth = CURSOR_WIDTH;
            canvasContext.fillRect(cursorX - CURSOR_WIDTH, 0, CURSOR_WIDTH * 2, canvas.height);
        } else {
            canvasContext.fillRect(cursorX - CURSOR_WIDTH, 0, CURSOR_WIDTH * 2, canvas.height);

            canvasContext.fillStyle = CURSOR_STYLE_WINDOW; // paint window
            canvasContext.fillRect(cursorX - cursorWidth, 0, cursorWidth * 2, canvas.height);

        }

        dirtyRegion = {
            x: Math.max(Math.floor(cursorX - cursorWidth - 1), 0),
            y: 0,
            width: Math.ceil(cursorWidth * 2 + 2),
            height: canvas.height
        };
    };
    
    this.setInTime = function(newInTime) {
        inTime = newInTime;
        invalidateBackground();
    };

    this.setOutTime = function(newOutTime) {
        outTime = newOutTime;
        invalidateBackground();
    };
    
    background.width = canvas.width;
    background.height = canvas.height;
}
