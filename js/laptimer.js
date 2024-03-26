export function LapTimer() {

	var lapTime = {
			current: null,
			last:	null,
			best:	null,
			laps:	[],
		};
	
	this.currentLapTime = function() {
		return lapTime.current || '00:00.000';
	};
	
	this.lastLapTime = function() {
		return lapTime.last || '00:00.000';
	};
	
	this.bestLapTime = function() {
		return lapTime.best || '00:00.000';
	};
	
	this.laps = function() {
		return lapTime.laps;
	};

	this.drawCanvas = function(canvas, options) {
		// Draw the LapTimes using a canvas
		var ctx = canvas.getContext("2d");
		
        var

			lineHeight		  = 14, //px
	        DEFAULT_FONT_FACE = "8pt Verdana, Arial, sans-serif",
			
	        fgColor = "rgba(191,191,191,1.0)",											// Text and highlights color
	        bgColor = "rgba(76,76,76," + parseInt(options.laptimer.transparency) / 100.0 + ")",	// background color

        	left = canvas.width  * parseInt(options.laptimer.left) / 100.0,
        	top  = canvas.height * parseInt(options.laptimer.top) / 100.0,
        	margin = 4, // pixels
        	rows   = 5 + ((lapTime.laps.length>0)?(1+lapTime.laps.length):0);
        
		ctx.save(); // Store the current canvas configuration
		
		
		var firstColumnWidth = ctx.measureText("Current").width,
        	secondColumn = ctx.measureText("XX:XX.XXX").width,
        	width 		 = margin + firstColumnWidth + margin + secondColumn + margin; // get the size of the box

         
        // move to the top left of the Lap Timer
        ctx.translate(left, top);

		ctx.lineWidth = 1;

        ctx.fillStyle = bgColor;
        ctx.strokeStyle = fgColor;
        
		//Fill in background
        roundRect(ctx, 0, 0, width, lineHeight * (rows - 0.5) , 7, true, true); // draw the bounding box with border

		// Add Title, and current values
		var currentRow = 1;
		ctx.textAlign = 'left';
		ctx.fillStyle = fgColor;	

		// Title
        ctx.font = "italic " + DEFAULT_FONT_FACE;
        ctx.fillText('Lap Timer', margin, lineHeight * currentRow);
			// Underline
            ctx.beginPath();
				ctx.strokeStyle = fgColor;
				ctx.moveTo(margin, 		 (lineHeight * currentRow) + 2 /*px*/);
				ctx.lineTo(width-margin, (lineHeight * currentRow) + 2 /*px*/);
            ctx.stroke();

		currentRow++;

		// Summary
        ctx.font = DEFAULT_FONT_FACE;
        ctx.fillText('Current'  , margin, lineHeight * currentRow); ctx.fillText(formatTime(lapTime.current, true)  , margin + firstColumnWidth + margin, lineHeight * currentRow++);
        ctx.fillText('Last'  	, margin, lineHeight * currentRow); ctx.fillText(formatTime(lapTime.last   , true)  , margin + firstColumnWidth + margin, lineHeight * currentRow++);
        ctx.fillText('Best'  	, margin, lineHeight * currentRow); ctx.fillText(formatTime(lapTime.best   , true)  , margin + firstColumnWidth + margin, lineHeight * currentRow++);

		// Laps
		if(lapTime.laps.length>0) {
			// Title
			ctx.font = "italic " + DEFAULT_FONT_FACE;
			ctx.fillText('Laps', margin, lineHeight * currentRow);
				// Underline
				ctx.beginPath();
					ctx.strokeStyle = fgColor;
					ctx.moveTo(margin, 		 (lineHeight * currentRow) + 2 /*px*/);
					ctx.lineTo(width-margin, (lineHeight * currentRow) + 2 /*px*/);
				ctx.stroke();
			currentRow++;

			// Each Lap
			ctx.font = DEFAULT_FONT_FACE;
			for(var i=0; i<lapTime.laps.length; i++) {
		        ctx.fillText('Lap ' + (i+1), margin, lineHeight * currentRow); ctx.fillText(formatTime(lapTime.laps[i]   , true)  , margin + firstColumnWidth + margin, lineHeight * currentRow++);
			}
		}

        ctx.restore();
	};

	this.refresh = function(currentTime, maxTime, bookmarkTimes) {
		// Update the lapTimeTable with the current information

		if(currentTime!=null && bookmarkTimes!=null) if(bookmarkTimes.length>0) {

			var bookmarkTimesSorted = bookmarkTimes.slice(0);
			bookmarkTimesSorted.push(maxTime); // add end time
			bookmarkTimesSorted.sort((a,b)=>a-b); // sort on value (rather than default alphabetically)

			lapTime.laps = []; // Clear the array

			for(var i=0; i<bookmarkTimesSorted.length - 1; i++) {
				if(i>0 && currentTime >= bookmarkTimesSorted[0]) { // Calculate all the laps so far
					lapTime.laps.push((bookmarkTimesSorted[i] - bookmarkTimesSorted[i-1])/1000);
				}
				if(currentTime < bookmarkTimesSorted[i+1] && currentTime >= bookmarkTimesSorted[i]) {
					// We have found the current lap
					lapTime.current = (currentTime - bookmarkTimesSorted[i])/1000;
					if(i>0) {
						lapTime.last = (bookmarkTimesSorted[i] - bookmarkTimesSorted[i-1])/1000;
					} else {
						lapTime.last = 0; // we are in the first lap, there is no last or best value
						lapTime.best = 0;	
					} 

					break;
				} else { // We are before the first bookmark (i.e. the start of the race)
					lapTime.current = 0;
					lapTime.last = 0;
				};
			}

			if(lapTime.laps.length > 0 && currentTime > bookmarkTimesSorted[0]) {
				lapTime.best=maxTime;
				for(var i=0; i<lapTime.laps.length; i++) {
					if(lapTime.laps[i] < lapTime.best) { 
						lapTime.best = lapTime.laps[i]; 
					};
				};
			};

		};
	};

	// Initialisation Code

	// None
};