'use strict';

/**
 * Configuration
 * 
 * Handle loading and display of configuration file
 * 
 */


function Configuration(file, configurationDefaults, showConfigFile) {

	// Private Variables
	var that = this; 	  // generic pointer back to this function
	var fileData; 		  // configuration file information
	var fileLinesArray;	  // Store the contents of the file globally	

	function renderFileContentList(configurationList, filter) {
		var li;

		// Clear the contents of the list
		$('li',configurationList).remove();

		for(var i=0; i<fileLinesArray.length; i++) {
			if(!filter || filter.length<1) { //Everything
				// li = $('<li class="configuration-row' + ((configurationDefaults.isDefault(fileLinesArray[i]))?(''):(' configuration-changed')) +'">' + fileLinesArray[i] + '</li>');

				li = $('<li class="configuration-row"' + ((fileLinesArray[i].length==0)?' style="background-color: white; height: 10px;"':'') + '>' + ((fileLinesArray[i].length==0)?'&nbsp':fileLinesArray[i]) + '</li>'); // Removed default syntax highlighting
				configurationList.append(li);

			} else {
				try {
				var regFilter = new RegExp('(.*)(' + filter + ')(.*)','i');
				var highLight = fileLinesArray[i].match(regFilter);
				if(highLight!=null) { // don't include blank lines
					li = $('<li class="configuration-row">' + highLight[1] + '<b>' + highLight[2] + '</b>' + highLight[3] + '</li>'); // Removed default syntax highlighting
					configurationList.append(li);
					} 
				} catch(e) {
					continue;
				}
			}
		}
	}

	function renderFileContents(filter) {

		var
		configurationElem  = ('.configuration-file'), // point to the actual element in index.html 
		configurationDiv   = $('<div class="configuration-file">' 
							  +		'<div class="configuration-header">' 
							  + 		'<h4>' + file.name
							  + 			'<span class="configuration-close glyphicon glyphicon-remove"></span>'
							  + 		'</h4>'
							  +     	'<input type="text" class="form-control configuration-filter" placeholder="Enter filter" size="5"/>'
							  + 	'</div>'
							  +		'<div><ul class="list-unstyled configuration-list"></ul></div>'
							  +'</div>'),
		configurationTitle = $('h3', configurationDiv),
		li;

		// now replace the element in the index.html with the loaded file information
		$(configurationElem).replaceWith(configurationDiv);

		var configurationList  = $('.configuration-list');
		renderFileContentList(configurationList, null);
		
		//configurationTitle.text(file.name);
		$("#status-bar .configuration-file-name").text(file.name);

		// now replace the element in the index.html with the loaded file information
		$(configurationElem).replaceWith(configurationDiv);


		// Add close icon
		$(".configuration-close").click(function() {
			if(showConfigFile) showConfigFile(false); // hide the config file
		});


	}
	
	function loadFile(file) {

        var reader = new FileReader();
    	fileData = file; 				// Store the data locally;
 
    
        reader.onload = function(e) {
        	
        	var data = e.target.result;	  			// all the data
	    	
	    	fileLinesArray = data.split('\n'); 		// separated into lines

        	renderFileContents();

        	// Add user configurable file filter
	        $(".configuration-filter").keyup(function() {

	        	var newFilter = $(".configuration-filter").val();

				var configurationList  = $('.configuration-list');
				renderFileContentList(configurationList, newFilter);
	        	
	        });

        };
     
        reader.readAsText(file);
    }

    // Public variables and functions
	this.getFile = function() {
		return fileData;
		};

    loadFile(file); // configuration file loaded
	
    // Add filter 
    
}

function ConfigurationDefaults(prefs) {
	
	// Special configuration file that handles default values only

	// Private Variables
	var that = this; 	  		  // generic pointer back to this function
	var fileData; 		  		  // configuration file information
	var fileLinesArray = null;	  // Store the contents of the file globally	
	
	function loadFileFromCache() {
		
		// Get the file from the cache if it exists
        prefs.get('configurationDefaults', function(item) {
            if (item) {
            	fileLinesArray = item;
            } else {
            	fileLinesArray = null;
            }
         });
	}
	
	this.loadFile = function(file) {

        var reader = new FileReader();
    	fileData = file; 				// Store the data locally;

    	reader.onload = function(e) {
        	
        	var data = e.target.result;	  			// all the data
	    	fileLinesArray = data.split('\n'); 		// separated into lines
	    	
	    	prefs.set('configurationDefaults', fileLinesArray); // and store it to the cache

        };
     
        reader.readAsText(file);
    }

    // Public variables and functions
	this.getFile = function() {
		return fileData;
		};

	this.getLines = function() {
		return fileLinesArray;
	}
	
	this.hasDefaults = function() {
		return (fileLinesArray!=null); // is there a default file array
	}
	
	this.isDefault = function(line) {		
		// Returns the default line equivalent

		if(!fileLinesArray) return true; // by default, lines are the same if there is no default file loaded
		
		for(var i=0; i<fileLinesArray.length; i++) {
			if(line!=fileLinesArray[i]) continue; // not the same line, keep looking
			return true; // line is same as default
		}
		return false; // line not the same as default or not found
	}

	
    loadFileFromCache(); // configuration file loaded
    
}