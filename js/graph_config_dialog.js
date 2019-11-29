"use strict";

function GraphConfigurationDialog(dialog, onSave) {
    var
        // Some fields it doesn't make sense to graph
        BLACKLISTED_FIELDS = {time:true, loopIteration:true, 'setpoint[0]':true, 'setpoint[1]':true, 'setpoint[2]':true, 'setpoint[3]':true},
        offeredFieldNames = [],
        exampleGraphs = [],
        activeFlightLog;
    

    function chooseColor(currentSelection) {
    	var selectColor = $('<select class="color-picker"></select>');
    		for(var i=0; i<GraphConfig.PALETTE.length; i++) {
    			var option = $('<option></option>')
    				.text(GraphConfig.PALETTE[i].name)
    				.attr('value', GraphConfig.PALETTE[i].color)
    				.css('color', GraphConfig.PALETTE[i].color);
    			if(currentSelection == GraphConfig.PALETTE[i].color) {
    				option.attr('selected', 'selected');
    				selectColor.css('background', GraphConfig.PALETTE[i].color)
    				           .css('color', GraphConfig.PALETTE[i].color);
    			}
    			selectColor.append(option);
    		}

    	return selectColor;
    }
    
    function chooseHeight(currentSelection) {
        var MAX_HEIGHT = 5;

    	var selectHeight = $('<select class="form-control graph-height"></select>');
    		for(var i=1; i<=MAX_HEIGHT; i++) {
    			var option = $('<option></option>')
    				.text(i)
    				.attr('value', i);
    			if(currentSelection == i || (currentSelection==null && i==1)) {
    				option.attr('selected', 'selected');
    			}
    			selectHeight.append(option);
    		}

    	return selectHeight;
    }

    // Show/Hide remove all button
     function updateRemoveAllButton() {
         var graphCount = $('.config-graph').length;

         if (graphCount > 0) {
            $('.config-graphs-remove-all-graphs').show();
         } else {
            $('.config-graphs-remove-all-graphs').hide();
         }
                renumberGraphIndexes();
     }

    // Renumber the "Graph X" blocks after additions/deletions
    function renumberGraphIndexes() {
            var graphIndexes = $('.graph-index-number');
            var graphCount = graphIndexes.length;
            for (var i = 0; i < graphCount; i++) {
                    var currentGraphNumber = i+1;
                    $(graphIndexes[i]).html(currentGraphNumber);
                }
            }

    function renderFieldOption(fieldName, selectedName) {
        var 
            option = $("<option></option>")
                .text(FlightLogFieldPresenter.fieldNameToFriendly(fieldName, activeFlightLog.getSysConfig().debug_mode))
                .attr("value", fieldName);
    
        if (fieldName == selectedName) {
            option.attr("selected", "selected");
        }
        
        return option;
    }
    
    // Set the current smoothing options for a field
    function renderSmoothingOptions(elem, flightLog, field) {
        if(elem) {
            // the smoothing is in uS rather than %, scale the value somewhere between 0 and 10000uS
            $('input[name=smoothing]',elem).val((field.smoothing!=null)?(field.smoothing/100).toFixed(0)+'%':(GraphConfig.getDefaultSmoothingForField(flightLog, field.name)/100)+'%');
            if(field.curve!=null) {
                $('input[name=power]',elem).val((field.curve.power!=null)?(field.curve.power*100).toFixed(0)+'%':(GraphConfig.getDefaultCurveForField(flightLog, field.name).power*100)+'%');
                $('input[name=scale]',elem).val((field.curve.outputRange!=null)?(field.curve.outputRange*100).toFixed(0)+'%':(GraphConfig.getDefaultCurveForField(flightLog, field.name).outputRange*100)+'%');
            } else
            {
                $('input[name=power]',elem).val((GraphConfig.getDefaultCurveForField(flightLog, field.name).power*100).toFixed(0)+'%');
                $('input[name=scale]',elem).val((GraphConfig.getDefaultCurveForField(flightLog, field.name).outputRange*100).toFixed(0)+'%');
            }
        }
    }

    /**
     * Render the element for the "pick a field" dropdown box. Provide "field" from the config in order to set up the
     * initial selection.
     */
    function renderField(flightLog, field, color) {
        var 
            elem = $(
                '<tr class="config-graph-field">'
                    + '<td><select class="form-control"><option value="">(choose a field)</option></select></td>'
                    + '<td><input name="smoothing" class="form-control" type="text"/></td>'
                    + '<td><input name="power" class="form-control" type="text"/></td>'
                    + '<td><input name="scale" class="form-control" type="text"/></td>'
                    + '<td><input name="linewidth" class="form-control" type="text"/></td>'
                    + '<td><select class="color-picker"></select></td>'
                    + '<td><button type="button" class="btn btn-default btn-sm"><span class="glyphicon glyphicon-trash"></span></button></td>'
                    + '<td><div id="grid" value=""/></td>'
                + '</tr>'
            ),
            select = $('select.form-control', elem),
            selectedFieldName = field ?field.name : false,
            i;
        
        for (i = 0; i < offeredFieldNames.length; i++) {
            select.append(renderFieldOption(offeredFieldNames[i], selectedFieldName));
        }
        
        // Set the smoothing values
        renderSmoothingOptions(elem, flightLog, field);

        // Set the line width values
        $('input[name=linewidth]',elem).val((field.lineWidth)?field.lineWidth:1);

        // Set the grid state
        $('div#grid',elem).attr("value", (field.grid)?field.grid:false);

        //Populate the Color Picker
        $('select.color-picker', elem).replaceWith(chooseColor(color));
        

        // Ade event when selection changed to retreive the current smoothing settings.
        $('select.form-control', elem).change( function() {
            var selectedField = {
                name: $('select.form-control option:selected', elem).val()
                    };
            renderSmoothingOptions(elem, activeFlightLog, selectedField);
        });

        // Add event when color picker is changed to change the dropdown coloe
        $('select.color-picker', elem).change( function() {
            $(this).css('background', $('select.color-picker option:selected', elem).val())
                   .css('color', $('select.color-picker option:selected', elem).val());
        });
        

        return elem;
    }
    
    function renderGraph(flightLog, index, graph) {
        var 
            graphElem = $(
                '<li class="config-graph" id="'+index+'">'
                    + '<dl>'
                        + '<dt><span>'
                            + '<h4 style="display:inline-block;vertical-align: baseline;"><span class="glyphicon glyphicon-minus"></span>Graph ' + '<span class="graph-index-number">' + (index + 1) + '</span>' + '</h4>'
                                + '<button type="button" class="btn btn-default btn-sm pull-right remove-single-graph-button" style="display:inline-block;vertical-align: baseline;"><span class="glyphicon glyphicon-trash"></span> Remove graph ' + '</button>'
                            + '</span></dt>'
                            + '<dd>'
                            + '<div class="form-horizontal">'
                                + '<div class="form-group">'
                                    + '<label class="col-sm-2 control-label">Axis label</label>'
                                    + '<div class="col-sm-10">'
                                        + '<ul class="config-graph-header form-inline list-unstyled">'
                                            + '<li class="config-graph-header">'
                                                + '<input class="form-control" type="text" placeholder="Axis label" style="width:92%;">'
                                                + '<select class="form-control graph-height"></select>'
                                            + '</li>'
                                        + '</ul>'
                                    + '</div>'
                                + '</div>'
                                + '<div class="form-group config-graph-field-header">'
                                    + '<label class="col-sm-2 control-label">Fields</label>'
                                    + '<div class="col-sm-10">'
                                        + '<table class="config-graph-field-list">'
                                            + '<thead>'
                                                + '<tr name="field-header">'
                                                    + '<th name="field">Name</th>'
                                                    + '<th name="smoothing">Smooth</th>'
                                                    + '<th name="expo">Expo</th>'
                                                    + '<th name="zoom">Zoom</th>'
                                                    + '<th name="line">Line</th>'
                                                    + '<th name="color">Color</th>'
                                                + '</tr>'
                                            + '</thead>'
                                            + '<tbody>'
                                            + '</tbody>'
                                        + '</table>'
                                        + '<button type="button" class="btn btn-default btn-sm add-field-button"><span class="glyphicon glyphicon-plus"></span> Add field</button>'
                                    + '</div>'
                                + '</div>'
                            + '</div>'
                        + '</dd>'
                    + '</dl>'
                + '</li>'
            ),
            fieldList = $(".config-graph-field-list", graphElem);
        
        $("input", graphElem).val(graph.label);
        
        var fieldCount = graph.fields.length;

        // "Add field" button
        $(".add-field-button", graphElem).click(function(e) {
            fieldList.append(renderField(flightLog, {}, GraphConfig.PALETTE[fieldCount++].color));
            e.preventDefault();
        });

        // "Remove Graph" button
        $(".remove-single-graph-button", graphElem).click(function(e) {
            var parentGraph = $(this).parents('.config-graph');
            parentGraph.remove();
            updateRemoveAllButton();
            e.preventDefault();
        });

        //Populate the Height seletor
        $('select.graph-height', graphElem).replaceWith(chooseHeight(graph.height?(graph.height):1));        

        // Add Field List
        for (var i = 0; i < graph.fields.length; i++) {
            var 
                field = graph.fields[i],
                fieldElem = renderField(flightLog, field, field.color?(field.color):(GraphConfig.PALETTE[i].color));
            
            fieldList.append(fieldElem);
        }
        
        fieldList.on('click', 'button', function(e) {
            var
                parentGraph = $(this).parents('.config-graph');
            
            $(this).parents('.config-graph-field').remove();
            
            // Remove the graph upon removal of the last field
            if ($(".config-graph-field", parentGraph).length === 0) {
                parentGraph.remove();
            }
            updateRemoveAllButton();

            e.preventDefault();
        });

        updateRemoveAllButton();
        
        return graphElem;
    }
    
    function renderGraphs(flightLog, graphs) {
        var
            graphList = $(".config-graphs-list", dialog);
        
        graphList.empty();
        
        for (var i = 0; i < graphs.length; i++) {
            graphList.append(renderGraph(flightLog, i, graphs[i]));
        }
    }
    
    function populateExampleGraphs(flightLog, menu) {
        var
            i;
        
        menu.empty();
        
        exampleGraphs = GraphConfig.getExampleGraphConfigs(flightLog);
        
        exampleGraphs.unshift({
            label: "Custom graph",
            fields: [{name:""}],
            dividerAfter: true
        });
        
        for (i = 0; i < exampleGraphs.length; i++) {
            var 
                graph = exampleGraphs[i],
                li = $('<li><a href="#"></a></li>');
            
            $('a', li)
                .text(graph.label)
                .data('graphIndex', i);
            
            menu.append(li);
            
            if (graph.dividerAfter) {
                menu.append('<li class="divider"></li>');
            }
        }
    }
    
    function convertUIToGraphConfig() {
        var 
            graphs = [],
            graph,
            field;
        
        $(".config-graph", dialog).each(function() {
            graph = {
               fields: [],
               height: 1
            };
            
            graph.label = $("input[type='text']", this).val();
            graph.height = parseInt($('select.graph-height option:selected', this).val());
            
            $(".config-graph-field", this).each(function() {
                field = {
                    name: $("select", this).val(),
                    smoothing: parseInt($("input[name=smoothing]", this).val())*100,        // Value 0-100%    = 0-10000uS (higher values are more smooth, 30% is typical)
                    curve: {
                        power: parseInt($("input[name=power]", this).val())/100.0,          // Value 0-100%    = 0-1.0 (lower values exagerate center values - expo)
                        outputRange: parseInt($("input[name=scale]", this).val())/100.0     // Value 0-100%    = 0-1.0 (higher values > 100% zoom in graph vertically)
                    },
                    default: { // These are used to restore configuration if using mousewheel adjustments
                        smoothing: parseInt($("input[name=smoothing]", this).val())*100,
                        power: parseInt($("input[name=power]", this).val())/100.0,
                        outputRange: parseInt($("input[name=scale]", this).val())/100.0
                    },
                    color: $('select.color-picker option:selected', this).val(),
                    lineWidth: parseInt($("input[name=linewidth]", this).val()),
                    grid: (($('div#grid', this).attr("value")==="true")?true:false)
                };
                
                if (field.name.length > 0) {
                    graph.fields.push(field);
                }
            });

            graphs.push(graph);
        });
        
        return graphs;
    }

    // Decide which fields we should offer to the user
    function buildOfferedFieldNamesList(flightLog, config) {
        var
            i, j,
            lastRoot = null,
            fieldNames = flightLog.getMainFieldNames(),
            fieldsSeen = {};
        
        offeredFieldNames = [];
        
        for (i = 0; i < fieldNames.length; i++) {
            // For fields with multiple bracketed x[0], x[1] versions, add an "[all]" option
            var 
                fieldName = fieldNames[i],
                matches = fieldName.match(/^(.+)\[[0-9]+\]$/);
            
            if (BLACKLISTED_FIELDS[fieldName])
                continue;
            
            if (matches) {
                if (matches[1] != lastRoot) {
                    lastRoot = matches[1];
                    
                    offeredFieldNames.push(lastRoot + "[all]");
                    fieldsSeen[lastRoot + "[all]"] = true;
                }
            } else {
                lastRoot = null;
            }
            
            offeredFieldNames.push(fieldName);
            fieldsSeen[fieldName] = true;
        }
        
        /* 
         * If the graph config has any fields in it that we don't have available in our flight log, add them to
         * the GUI anyway. (This way we can build a config when using a tricopter (which includes a tail servo) and
         * keep that tail servo in the config when we're viewing a quadcopter).
         */
        for (i = 0; i < config.length; i++) {
            var 
                graph = config[i];
            
            for (j = 0; j < graph.fields.length; j++) {
                var 
                    field = graph.fields[j];
                
                if (!fieldsSeen[field.name]) {
                    offeredFieldNames.push(field.name);
                }
            }
        }
    }
    
    this.show = function(flightLog, config) {
        dialog.modal('show');
        
        activeFlightLog = flightLog;
        
        buildOfferedFieldNamesList(flightLog, config);

        populateExampleGraphs(flightLog, exampleGraphsMenu);
        renderGraphs(flightLog, config);
    };
 
    $(".graph-configuration-dialog-save").click(function() {
        onSave(convertUIToGraphConfig());
    });


    var
        exampleGraphsButton = $(".config-graphs-add"),
        exampleGraphsMenu = $(".config-graphs-add ~ .dropdown-menu"),
        configGraphsList = $('.config-graphs-list');

    // Make the graph order drag-able
    configGraphsList
        .sortable(
            {
                cursor: "move"
            }
        )
        .disableSelection();

    exampleGraphsButton.dropdown();
    exampleGraphsMenu.on("click", "a", function(e) {
        var 
            graph = exampleGraphs[$(this).data("graphIndex")],
            graphElem = renderGraph(activeFlightLog, $(".config-graph", dialog).length, graph);
        
        $(configGraphsList, dialog).append(graphElem);
        updateRemoveAllButton();
        
        // Dismiss the dropdown button
        exampleGraphsButton.dropdown("toggle");
        
        e.preventDefault();
    });

    // Remove all Graphs button
    var removeAllGraphsButton = $(".config-graphs-remove-all-graphs");
    removeAllGraphsButton.on("click", function() {
            $('.config-graph').remove();
            updateRemoveAllButton();
    });
}