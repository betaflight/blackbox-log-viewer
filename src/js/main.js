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
	
	video = $(".log-graph video")[0],
	canvas = $(".log-graph canvas")[0],
	videoURL = false,
	videoOffset = 0.0;

function blackboxTimeFromVideoTime() {
	return (video.currentTime - videoOffset) * 1000000 + flightLog.getMinTime();
}

function renderGraph() {
	var 
		now = Date.now();
	
	if (!graph)
		return;
	
	if (videoURL) {
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
		requestAnimationFrame(renderGraph);
	}
}

function updateCanvasSize() {
	canvas.width = canvas.offsetWidth;
	canvas.height = canvas.offsetHeight;
	renderGraph();
}

function leftPad(string, pad, minLength) {
	string = "" + string;
	
	while (string.length < minLength)
		string = pad + string;
	
	return string;
}

function formatTime(msec, displayMsec) {
	var
		secs, mins, hours, msec;
	
	msec = Math.round(msec);
	
	secs = Math.floor(msec / 1000);
	msec %= 1000;

	mins = Math.floor(secs / 60);
	secs %= 60;

	hours = Math.floor(mins / 60);	
	mins %= 60;
	
	return (hours ? leftPad(hours, "0", 2) + ":" : "") + leftPad(mins, "0", 2) + ":" + leftPad(secs, "0", 2)
		+ (displayMsec ? "." + leftPad(msec, "0", 3) : "");
}

function renderLogInfo() {
	$(".log-start-time").text(formatTime(flightLog.getMinTime() / 1000, false));
	$(".log-end-time").text(formatTime(flightLog.getMaxTime() / 1000, false));
	$(".log-duration").text(formatTime(Math.ceil((flightLog.getMaxTime() - flightLog.getMinTime()) / 1000), false));
	$(".log-cells").text(flightLog.estimateNumCells() + "S");
}

function setGraphState(newState) {
	graphState = newState;
	
	lastRenderTime = false;
	
	if (graphState == GRAPH_STATE_PLAY) {
		video.play();
		$(".log-play-pause span").attr('class', 'glyphicon glyphicon-pause');
	} else {
		video.pause();
		$(".log-play-pause span").attr('class', 'glyphicon glyphicon-play');
	}
	
	renderGraph();
}

function setCurrentBlackboxTime(newTime) {
	video.currentTime = (newTime - flightLog.getMinTime()) / 1000000 + videoOffset;
	
	//Assuming that the video snaps the currentTime to an actual frame boundary, read it back to use as our log position
	currentBlackboxTime = blackboxTimeFromVideoTime();
}

function loadLog(bytes) {
	dataArray = new Uint8Array(bytes);
	flightLog = new FlightLog(dataArray, 0);
	graph = new FlightLogGrapher(flightLog, canvas);
	
	// Rewind:
	currentBlackboxTime = flightLog.getMinTime();
	
	setGraphState(GRAPH_STATE_PAUSED);
	renderLogInfo();
}

$(document).ready(function() {
	$("#logfile-open").change(function(e) {
		var 
			files = e.target.files,
			reader;
		
		if (files.length > 0) {
			reader = new FileReader();

		    reader.onload = function(e) {
		    	loadLog(e.target.result);
	        };

		    reader.readAsArrayBuffer(files[0]);
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
			
			$(".log-graph").addClass("has-video");
		}
	});
	
	$(".log-jump-back").click(function() {
		setCurrentBlackboxTime(currentBlackboxTime - SMALL_JUMP_TIME);
		setGraphState(GRAPH_STATE_PAUSED);
	});

	$(".log-jump-forward").click(function() {
		setCurrentBlackboxTime(currentBlackboxTime + SMALL_JUMP_TIME);
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
	
	$(".log-play-pause").click(function() {
		if (graphState == GRAPH_STATE_PAUSED) {
			setGraphState(GRAPH_STATE_PLAY);
		} else {
			setGraphState(GRAPH_STATE_PAUSED);
		}
	});
	
	$(".log-sync-here").click(function() {
		videoOffset = video.currentTime;
		renderGraph();
	});
	
	$(".video-offset").change(function() {
		var offset = parseFloat($(".video-offset").val());
		
		if (!isNaN(offset)) {
			videoOffset = offset;
			renderGraph();
		} 
			
	});
	
	$(window).resize(updateCanvasSize);
	
	updateCanvasSize();
});