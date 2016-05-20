'use strict';

/**
 * Configuration
 * 
 * Handle loading and display of configuration file
 * 
 */


function Configuration(file) {

	// Private Variables
	var that = this; 	  // generic pointer back to this function
	var fileData; 		  // configuration file information

	function loadFile(file) {

        var reader = new FileReader();
    	fileData = file; 				// Store the data locally;
    
        reader.onload = function(e) {
			
			var
				configurationElem  = ('.configuration-file'), // point to the actual element in index.html 
				configurationDiv   = $('<div class="configuration-file"><h3></h3><ul class="list-unstyled configuration-list"></ul></div>'),
				configurationTitle = $('h3', configurationDiv),
				configurationList  = $('ul', configurationDiv),
				li;

            var data = e.target.result;	  // all the data
            var lines = data.split('\n'); // separate into lines
			
			for(var i=0; i<lines.length; i++) {
				li = $('<li class="configuration-row">' + lines[i] + '</li>');
				configurationList.append(li);	
			}
			
			configurationTitle.text(file.name);
			$("#status-bar .configuration-file-name").text(file.name);
			
			// now replace the element in the index.html with the loaded file information
			$(configurationElem).replaceWith(configurationDiv);
			

        };
     
        reader.readAsText(file);
    }

    // Public variables and functions
	this.getFile = function() {
		return fileData;
		};

    loadFile(file); // configuration file loaded
	
}
