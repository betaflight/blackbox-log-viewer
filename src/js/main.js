"use strict";

var acc = [];

function supportsFileAPI() {
	return window.File && window.FileReader && window.FileList && window.Blob;
}

if (!supportsFileAPI()) {
	alert("Your browser does not support the APIs required for reading log files.");
}

$(document).ready(function() {
	$("#logfile").change(function(e) {
		var 
			files = e.target.files,
			file;

		for (var i = 0; file = files[i]; i++) {
			var reader = new FileReader();

		    reader.onload = (function(theFile) {
		        return function(e) {
		        	var 
		        		dataArray = new Uint8Array(e.target.result),
		        		flightLog = new FlightLog(dataArray);
		        	
		        	
		        	
		        	alert("Done!");
		        };
		    })(file);

		    reader.readAsArrayBuffer(file);
		}
	});
});