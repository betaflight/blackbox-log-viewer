"use strict";

function supportsRequiredAPIs() {
	return window.File && window.FileReader && window.FileList && Modernizr.canvas;
}

if (!supportsRequiredAPIs()) {
	alert("Your browser does not support the APIs required for reading log files.");
}

var
	GRAPH_STATE_PAUSED = 0,
	GRAPH_STATE_PLAY = 1,
	
	SMALL_JUMP_TIME = 100 * 1000;

var
	graphState = GRAPH_STATE_PAUSED,
	currentBlackboxTime = 0,
	lastRenderTime = false,
	dataArray, flightLog, graph,
	
	hasVideo = false, hasLog = false,
	video = $(".log-graph video")[0],
	canvas = $(".log-graph canvas")[0],
	videoURL = false,
	videoOffset = 0.0,
	
	graphRendersCount = 0,
	
	seekBarCanvas = $(".log-seek-bar canvas")[0],
	seekBar = new SeekBar(seekBarCanvas);

function blackboxTimeFromVideoTime() {
	return (video.currentTime - videoOffset) * 1000000 + flightLog.getMinTime();
}

function syncLogToVideo() {
	if (hasLog) {
		//Assuming that the video snaps the currentTime to an actual frame boundary, read it back to use as our log position
		currentBlackboxTime = blackboxTimeFromVideoTime();
	}
}

function animationLoop() {
	var 
		now = Date.now();
	
	if (!graph)
		return;
	
	if (hasVideo) {
		currentBlackboxTime = blackboxTimeFromVideoTime();
	} else {
		var
			delta;
		
		if (lastRenderTime === false)
			delta = 0;
		else
			delta = (now - lastRenderTime) * 1000;
	
		currentBlackboxTime += delta;
		
		if (graphState == GRAPH_STATE_PLAY) {
			if (currentBlackboxTime > flightLog.getMaxTime()) {
				currentBlackboxTime = flightLog.getMaxTime();
				setGraphState(GRAPH_STATE_PAUSED);
			}
		}
	}
	
	graph.render(currentBlackboxTime);
	graphRendersCount++;
	
	seekBar.setCurrentTime(currentBlackboxTime);

	if (graphState == GRAPH_STATE_PLAY) {
		if (graphRendersCount % 8 == 0)
			seekBar.repaint();
		
		lastRenderTime = now;
		requestAnimationFrame(animationLoop);
	} else {
		seekBar.repaint();
	}
}

function invalidateGraph() {
	if (graphState != GRAPH_STATE_PLAY)
		animationLoop();
}

function updateCanvasSize() {
	canvas.width = canvas.offsetWidth;
	canvas.height = canvas.offsetHeight;
	
	seekBar.resize(canvas.offsetWidth, 50);
		
	invalidateGraph();
}

function renderLogInfo(file) {
	$(".log-filename").text(file.name);
	$(".log-start-time").text(formatTime(flightLog.getMinTime() / 1000, false));
	$(".log-end-time").text(formatTime(flightLog.getMaxTime() / 1000, false));
	$(".log-duration").text(formatTime(Math.ceil((flightLog.getMaxTime() - flightLog.getMinTime()) / 1000), false));
	$(".log-cells").text(flightLog.estimateNumCells() + "S (" + Number(flightLog.getReferenceVoltageMillivolts() / 1000).toFixed(2) + "V)");
}

function setGraphState(newState) {
	graphState = newState;
	
	lastRenderTime = false;
	
	if (graphState == GRAPH_STATE_PLAY) {
		if (hasVideo)
			video.play();
		
		$(".log-play-pause span").attr('class', 'glyphicon glyphicon-pause');
	} else {
		if (hasVideo)
			video.pause();
		
		$(".log-play-pause span").attr('class', 'glyphicon glyphicon-play');
	}
	
	animationLoop();
}

function setCurrentBlackboxTime(newTime) {
	if (hasVideo) {
		video.currentTime = (newTime - flightLog.getMinTime()) / 1000000 + videoOffset;
	
		syncLogToVideo();
	} else {
		currentBlackboxTime = newTime;
		
		invalidateGraph();
	}
}

function setVideoTime(newTime) {
	video.currentTime = newTime;

	syncLogToVideo();
}

function loadLog(file) {
	var reader = new FileReader();

    reader.onload = function(e) {
    	var bytes = e.target.result;
    	
    	dataArray = new Uint8Array(bytes);
    	flightLog = new FlightLog(dataArray, 0);
    	graph = new FlightLogGrapher(flightLog, canvas);

    	hasLog = true;

    	if (hasVideo)
    		syncLogToVideo();
    	else {
	    	// Start at beginning:
	    	currentBlackboxTime = flightLog.getMinTime();
    	}

    	seekBar.setTimeRange(flightLog.getMinTime(), flightLog.getMaxTime(), currentBlackboxTime);
    	seekBar.setActivityRange(flightLog.getSysConfig().minthrottle, flightLog.getSysConfig().maxthrottle);
    	
    	var throttleActivity = flightLog.getThrottleActivity();
    	seekBar.setActivity(throttleActivity.avgThrottle, throttleActivity.times);
    	
    	renderLogInfo(file);
    	setGraphState(GRAPH_STATE_PAUSED);
    	
		$("html").addClass("has-log");
		updateCanvasSize();
    };

    reader.readAsArrayBuffer(file);
}

function loadVideo(file) {
	if (videoURL) {
		URL.revokeObjectURL(videoURL);
		videoURL = false;
	}
	
	videoURL = URL.createObjectURL(file);
	video.volume = 0.05;
	video.src = videoURL;
	hasVideo = true;
	
	$("html").addClass("has-video");
	
	setGraphState(GRAPH_STATE_PAUSED);
}

function seekBarSeek(time) {
	setCurrentBlackboxTime(time);
	
	invalidateGraph();
}

$(document).ready(function() {
	$("#file-open").change(function(e) {
		var 
			files = e.target.files,
			i;
		
		for (i = 0; i < files.length; i++) {
			var
				isLog = files[i].name.match(/\.TXT$/i),
				isVideo = files[i].name.match(/\.(AVI|MOV|MP4|MPEG)$/i);
			
			if (!isLog && !isVideo) {
				if (files[i].size < 10 * 1024 * 1024)
					isLog = true; //Assume small files are logs rather than videos
				else
					isVideo = true;
			}
			
			if (isLog)
				loadLog(files[i]);
			else if (isVideo)
				loadVideo(files[i]);
		}
	});
	
	$(".log-jump-back").click(function() {
		if (hasVideo) {
			setVideoTime(video.currentTime - SMALL_JUMP_TIME / 1000000);
		} else {
			setCurrentBlackboxTime(currentBlackboxTime - SMALL_JUMP_TIME);
		}
		
		setGraphState(GRAPH_STATE_PAUSED);
	});

	$(".log-jump-forward").click(function() {
		if (hasVideo) {
			setVideoTime(video.currentTime + SMALL_JUMP_TIME / 1000000);
		} else {
			setCurrentBlackboxTime(currentBlackboxTime + SMALL_JUMP_TIME);
		}
		
		setGraphState(GRAPH_STATE_PAUSED);
	});
	
	$(".log-jump-start").click(function() {
		setCurrentBlackboxTime(flightLog.getMinTime());
		setGraphState(GRAPH_STATE_PAUSED);
	});

	$(".log-jump-end").click(function() {
		setCurrentBlackboxTime(flightLog.getMaxTime());
		setGraphState(GRAPH_STATE_PAUSED);
	});
	
	$(".video-jump-start").click(function() {
		setVideoTime(0);
		setGraphState(GRAPH_STATE_PAUSED);
	});

	$(".video-jump-end").click(function() {
		setVideoTime(video.duration);
		setGraphState(GRAPH_STATE_PAUSED);
	});
	
	$(".log-play-pause").click(function() {
		if (graphState == GRAPH_STATE_PAUSED) {
			setGraphState(GRAPH_STATE_PLAY);
		} else {
			setGraphState(GRAPH_STATE_PAUSED);
		}
	});
	
	$(".log-sync-here").click(function() {
		videoOffset = video.currentTime;
		$(".video-offset").val((videoOffset >= 0 ? "+" : "") + videoOffset);
		invalidateGraph();
	});
	
	$(".video-offset").change(function() {
		var offset = parseFloat($(".video-offset").val());
		
		if (!isNaN(offset)) {
			videoOffset = offset;
			invalidateGraph();
		}
	});
	
	$(window).resize(updateCanvasSize);
	$(video).on('loadedmetadata', updateCanvasSize);
	
	updateCanvasSize();
	
	seekBar.onSeek = seekBarSeek;
});