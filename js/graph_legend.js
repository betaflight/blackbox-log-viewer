"use strict";

function GraphLegend(targetElem, config, onVisibilityChange, onNewSelectionChange) {
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
                graphDiv = $('<div class="graph-legend"><h3></h3><ul class="list-unstyled graph-legend-field-list"></ul></div>'),
                graphTitle = $("h3", graphDiv),
                fieldList = $("ul", graphDiv);
            
            graphTitle.text(graph.label);
            
            for (j = 0; j < graph.fields.length; j++) {
                var 
                    field = graph.fields[j],
                    li = $('<li class="graph-legend-field" graph="' + i + '" field="' + j +'"></li>');
                
                li.text(FlightLogFieldPresenter.fieldNameToFriendly(field.name));
                li.css('border-bottom', "2px solid " + field.color);
                
                fieldList.append(li);
            }
            
            targetElem.append(graphDiv);
        }

        // Add a trigger on legend; select the analyser graph/field to plot
        $('.graph-legend-field').on('click', function() {
               config.selectedFieldName     = this.innerText;
               config.selectedGraphIndex    = $(this).attr('graph');
               config.selectedFieldIndex    = $(this).attr('field');
               if (onNewSelectionChange) {
                   onNewSelectionChange();
               }
        });

        $('.log-close-legend-dialog').on('click', function() {
            that.hide();
        });
        
        $('.log-open-legend-dialog').on('click', function() {
            that.show();
        });
    }
    
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