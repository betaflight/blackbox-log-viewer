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
	videoOffset = 0.0;

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
	}
	
	graph.render(currentBlackboxTime);

	if (graphState == GRAPH_STATE_PLAY) {
		lastRenderTime = now;
		requestAnimationFrame(animationLoop);
	}
}

function invalidateGraph() {
	if (graphState != GRAPH_STATE_PLAY)
		animationLoop();
}

function updateCanvasSize() {
	canvas.width = canvas.offsetWidth;
	canvas.height = canvas.offsetHeight;
		
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
	video.currentTime = (newTime - flightLog.getMinTime()) / 1000000 + videoOffset;
	
	syncLogToVideo();
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
    	
    	if (hasVideo)
    		syncLogToVideo();
    	else {
	    	// Start at beginning:
	    	currentBlackboxTime = flightLog.getMinTime();
    	}
    	
    	renderLogInfo(file);
    	setGraphState(GRAPH_STATE_PAUSED);
    	
		$("html").addClass("has-log");
		updateCanvasSize();
    };

    reader.readAsArrayBuffer(file);
}

$(document).ready(function() {
	$("#logfile-open").change(function(e) {
		var 
			files = e.target.files,
			reader;
		
		if (files.length > 0) {
			loadLog(files[0]);
		}
	});
	
	$("#video-open").change(function(e) {
		var 
			files = e.target.files;
		
		if (files.length > 0) {
			if (videoURL) {
				URL.revokeObjectURL(videoURL);
				videoURL = false;
			}
			
			videoURL = URL.createObjectURL(files[0]);
			video.volume = 0.05;
			video.src = videoURL;
			hasVideo = true;
			
			$("html").addClass("has-video");
			
			setGraphState(GRAPH_STATE_PAUSED);
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
});