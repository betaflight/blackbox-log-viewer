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
	videoURL = false;

function renderGraph() {
	var 
		now = Date.now(), delta;
	
	if (lastRenderTime === false)
		delta = 0;
	else
		delta = (now - lastRenderTime) * 1000;

	currentBlackboxTime += delta;
	graph.render(currentBlackboxTime);

	if (graphState == GRAPH_STATE_PLAY) {
		lastRenderTime = now;
		requestAnimationFrame(renderGraph);
		
		$(".log-play-pause span").attr('class', 'glyphicon glyphicon-pause');
	} else {
		$(".log-play-pause span").attr('class', 'glyphicon glyphicon-play');
	}
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
}

function setGraphState(newState) {
	graphState = newState;
	
	lastRenderTime = false;
	
	renderGraph();
}

function loadLog(bytes) {
	dataArray = new Uint8Array(bytes);
	flightLog = new FlightLog(dataArray, 0);
	graph = new FlightLogGrapher(flightLog, $("#graph")[0]);
	
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
			$(".log-graph video")[0].src = videoURL;
		}
});
	
	$(window).resize(function() {
		renderGraph();
	});
	
	$(".log-jump-back").click(function() {
		currentBlackboxTime -= SMALL_JUMP_TIME;
		setGraphState(GRAPH_STATE_PAUSED);
	});

	$(".log-jump-forward").click(function() {
		currentBlackboxTime += SMALL_JUMP_TIME;
		setGraphState(GRAPH_STATE_PAUSED);
	});		
	
	$(".log-jump-start").click(function() {
		currentBlackboxTime = flightLog.getMinTime();
		setGraphState(GRAPH_STATE_PAUSED);
	});

	$(".log-jump-end").click(function() {
		currentBlackboxTime = flightLog.getMaxTime();
		setGraphState(GRAPH_STATE_PAUSED);
	});	
	
	$(".log-play-pause").click(function() {
		if (graphState == GRAPH_STATE_PAUSED) {
			setGraphState(GRAPH_STATE_PLAY);
		} else {
			setGraphState(GRAPH_STATE_PAUSED);
		}
	});
});