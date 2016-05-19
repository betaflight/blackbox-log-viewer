"use strict";

function GraphLegend(targetElem, config, onVisibilityChange, onNewSelectionChange, onZoomGraph, onExpandGraph) {
    var
        that = this;

    function buildLegend() {
        var 
            graphs = config.getGraphs(),
            i, j;
        
        targetElem.empty();
        
        for (i = 0; i < graphs.length; i++) {
            var 
                graph = graphs[i],
                graphDiv = $('<div class="graph-legend"><h3 graph="' + i + '"></h3><ul class="list-unstyled graph-legend-field-list"></ul></div>'),
                graphTitle = $("h3", graphDiv),
                fieldList = $("ul", graphDiv);
            
            graphTitle.text(graph.label);
            
            for (j = 0; j < graph.fields.length; j++) { 
                var 
                    field = graph.fields[j],
                    li = $('<li class="graph-legend-field" name="' + field.name + '" graph="' + i + '" field="' + j +'"></li>');
                
                li.text(FlightLogFieldPresenter.fieldNameToFriendly(field.name));
                li.css('border-bottom', "2px solid " + field.color);
                fieldList.append(li);
            }
            
            targetElem.append(graphDiv);
        }

        // Add a trigger on legend; select the analyser graph/field to plot
        $('.graph-legend-field').on('click', function() {
               config.selectedFieldName     = FlightLogFieldPresenter.fieldNameToFriendly($(this).attr('name'));
               config.selectedGraphIndex    = $(this).attr('graph');
               config.selectedFieldIndex    = $(this).attr('field');
               if (onNewSelectionChange) {
                   onNewSelectionChange();
               }
        });

        // Add a trigger on legend list title; select the graph to expland
        $('.graph-legend h3').on('click', function(e) {
               var selectedGraph = $(this).attr('graph');
               if(!e.altKey) {
                   if (onZoomGraph) {                   
                       onZoomGraph(selectedGraph);
                   }
               } else {
                   if (onExpandGraph) {                   
                       onExpandGraph(selectedGraph);
                   }
               }
        });

        $('.log-close-legend-dialog').on('click', function() {
            that.hide();
        });
        
        $('.log-open-legend-dialog').on('click', function() {
            that.show();
        });

        // on first show, hide the analyser button
        if(!config.selectedFieldName) $('.hide-analyser-window').hide();
    }

    this.updateValues = function(flightLog, frame) {
      try {  
          // New function to show values on legend.
          var currentFlightMode = frame[flightLog.getMainFieldIndexByName("flightModeFlags")];
          
              $(".graph-legend-field").each(function(index, value) {
                 var value = FlightLogFieldPresenter.decodeFieldToFriendly(flightLog, $(this).attr('name'), frame[flightLog.getMainFieldIndexByName($(this).attr('name'))], currentFlightMode);
                 $(this).text(FlightLogFieldPresenter.fieldNameToFriendly($(this).attr('name')) + ((value)?' (' + value + ')':' ') );
                 $(this).append('<span class="glyphicon glyphicon-equalizer"></span>');
              });
          } catch(e) {
              console.log('Cannot update legend with values');
          }
    };
    
    this.show = function() {
        $('.log-graph-config').show();
        $('.log-open-legend-dialog').hide();
        
        if (onVisibilityChange) {
            onVisibilityChange(false);
        }
    };
    
    this.hide = function() {
        $('.log-graph-config').hide();
        $('.log-open-legend-dialog').show();
        
        if (onVisibilityChange) {
            onVisibilityChange(true);
        }
    };
    
    config.addListener(buildLegend);
    
    buildLegend();
}