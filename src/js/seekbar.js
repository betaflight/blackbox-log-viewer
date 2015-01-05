"use strict";

function SeekBar(canvas) {
	var
		that = this,
		
		//Times:
		min, max, current,
		
		//Activity to display on bar:
		activityStrength, activityTime,
		//Expect to be plotting PWM-like data by default:
		activityMin = 1000, activityMax = 2000,

		canvasContext = canvas.getContext("2d"),
		
		background = document.createElement('canvas'),
		backgroundContext = background.getContext("2d"),
		
		backgroundValid = false,
		
		//Current time cursor:
		CURSOR_WIDTH = 2.5,
		
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
			seekToDOMPixel(e.offsetX);
			
			//"capture" the mouse so we can drag outside the boundaries of the seek bar
			$(document).on("mousemove", onMouseMove);
			
			//Release the capture when the mouse is released
			$(document).one("mouseup", function () {
				$(document).off("mousemove", onMouseMove);
			});
		}
	});
	
	this.resize = function(width, height) {
		var ratio = window.devicePixelRatio ? window.devicePixelRatio : 1;
		
		canvas.width = width * ratio;
		canvas.height = height * ratio;
		
		background.width = width * ratio;
		background.height = height * ratio;
		
		CURSOR_WIDTH = 2.5 * ratio;
		BAR_INSET = CURSOR_WIDTH; 
		
		invalidateBackground();
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
	
	this.setActivity = function(newActivityStrengths, newActivityTimes) {
		activityStrength = newActivityStrengths;
		activityTime = newActivityTimes;
		
		invalidateBackground();
	};
	
	this.setCurrentTime = function(newTime) {
		current = newTime;
	};
	
	function rebuildBackground() {
		var 
			x, activityIndex = 0,
			pixelTimeStep;
		
		backgroundContext.fillStyle = '#eee';
		backgroundContext.fillRect(0, 0, canvas.width, canvas.height);
		
		if (max > min) {
			pixelTimeStep = (max - min) / (canvas.width - 1 - BAR_INSET * 2);
			
			//Draw activity bars
			if (activityTime.length) {
				backgroundContext.strokeStyle = '#AAF';
				backgroundContext.beginPath();
				
				var 
					time = min;
				
				for (x = BAR_INSET; x < canvas.width - BAR_INSET; x++) {
					var 
						activity;
					
					//Advance to the right entry in the activity array for this time
					while (activityIndex < activityTime.length && time >= activityTime[activityIndex])
						activityIndex++;
					
					if (activityIndex == activityTime.length)
						activity = 0;
					else {
						activity = (activityStrength[activityIndex] - activityMin) / (activityMax - activityMin) * canvas.height;
						backgroundContext.moveTo(x, canvas.height);
						backgroundContext.lineTo(x, canvas.height - activity);
					}
					
					time += pixelTimeStep;
				}
				
				backgroundContext.stroke();
			}
			backgroundValid = true;
		}
	};
	
	this.repaint = function() {
		if (!backgroundValid)
			rebuildBackground();
		
		canvasContext.drawImage(background, 0, 0);
		
		//Draw cursor
		var 
			pixelTimeStep = (max - min) / (canvas.width - 1 - BAR_INSET * 2),
			cursorX = (current - min) / pixelTimeStep + BAR_INSET;

		canvasContext.fillStyle = 'rgba(0,0,0,0.5)';
		canvasContext.fillRect(cursorX - CURSOR_WIDTH, 0, CURSOR_WIDTH * 2, canvas.height);
	};
	
	background.style.display = 'none';
	background.width = canvas.width;
	background.height = canvas.height;
}