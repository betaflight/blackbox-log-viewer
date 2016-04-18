"use strict";

function GraphConfigurationDialog(dialog, onSave) {
    var
        // Some fields it doesn't make sense to graph
        BLACKLISTED_FIELDS = {time:true, loopIteration:true},
        offeredFieldNames = [],
        exampleGraphs = [];
    
    function renderFieldOption(fieldName, selectedName) {
        var 
            option = $("<option></option>")
                .text(FlightLogFieldPresenter.fieldNameToFriendly(fieldName))
                .attr("value", fieldName);
    
        if (fieldName == selectedName) {
            option.attr("selected", "selected");
        }
        
        return option;
    }
    
    /**
     * Render the element for the "pick a field" dropdown box. Provide "field" from the config in order to set up the
     * initial selection.
     */
    function renderField(field) {
        var 
            elem = $(
                '<li class="config-graph-field">'
                    + '<select class="form-control"><option value="">(choose a field)</option></select>'
                    + '<input name="smoothing" class="form-control" type="text"></input>'
                    + '<input name="power" class="form-control" type="text"></input>'
                    + '<input name="scale" class="form-control" type="text"></input>'
                    + '<button type="button" class="btn btn-default btn-sm">Remove</button>'
                + '</li>'
            ),
            select = $('select', elem),
            selectedFieldName = field ? field.name : false,
            i;
        
        for (i = 0; i < offeredFieldNames.length; i++) {
            select.append(renderFieldOption(offeredFieldNames[i], selectedFieldName));
        }
        
        // the smoothing is in uS rather than %, scale the value somewhere between 0 and 10000uS
        $('input[name=smoothing]',elem).val((field.smoothing!=null)?(field.smoothing/100)+'%':'30%');
        if(field.curve!=null) {
            $('input[name=power]',elem).val((field.curve.power!=null)?(field.curve.power*100)+'%':'100%');
            $('input[name=scale]',elem).val((field.curve.outputRange!=null)?(field.curve.outputRange*100)+'%':'100%');
        } else
        {
            $('input[name=power]',elem).val('100%');
            $('input[name=scale]',elem).val('100%');
        }

        return elem;
    }
    
    function renderGraph(index, graph) {
        var 
            graphElem = $(
                '<li class="config-graph">'
                    + '<dl>'
                        + '<dt><h4>Graph ' + (index + 1) + '</dt>'
                        + '<dd>'
                            + '<div class="form-horizontal">'
                                + '<div class="form-group">'
                                    + '<label class="col-sm-2 control-label">Axis label</label>'
                                    + '<div class="col-sm-10">'
                                        + '<input class="form-control" type="text" placeholder="Axis label">'
                                    + '</div>'
                                + '</div>'
                                + '<div class="form-group form-group-sm">'
                                    + '<div class="col-sm-10">'
                                        + '<table>'
                                            + '<tr>'
                                                + '<th name="field"></th>'
                                                + '<th name="smoothing">Smooth</th>'
                                                + '<th name="expo">Expo</th>'
                                                + '<th name="zoom">Zoom</th>'
                                            + '</tr>'
                                        + '</table>'
                                    + '</div>'
                                + '</div>'
                                + '<div class="form-group form-group-sm">'
                                    + '<label class="col-sm-2 control-label">Fields</label>'
                                    + '<div class="col-sm-10">'
                                        + '<ul class="config-graph-field-list form-inline list-unstyled"></ul>'
                                        + '<button type="button" class="btn btn-default btn-sm"><span class="glyphicon glyphicon-plus"></span> Add field</button>'
                                    + '</div>'
                                + '</div>'
                            + '</div>'
                        + '</dd>'
                    + '</dl>'
                + '</li>'
            ),
            fieldList = $(".config-graph-field-list", graphElem);
        
        $("input", graphElem).val(graph.label);
        
        // "Add field" button
        $("button", graphElem).click(function(e) {
            fieldList.append(renderField({}));
            e.preventDefault();
        });
        
        for (var i = 0; i < graph.fields.length; i++) {
            var 
                field = graph.fields[i],
                fieldElem = renderField(field);
            
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
            
            e.preventDefault();
        });
        
        return graphElem;
    }
    
    function renderGraphs(graphs) {
        var
            graphList = $(".config-graphs-list", dialog);
        
        graphList.empty();
        
        for (var i = 0; i < graphs.length; i++) {
            graphList.append(renderGraph(i, graphs[i]));
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
            
            $(".config-graph-field", this).each(function() {
                field = {
                    name: $("select", this).val(),
                    smoothing: parseInt($("input[name=smoothing]", this).val())*100,        // Value 0-100%    = 0-10000uS (higher values are more smooth, 30% is typical)
                    curve: {
                        power: parseInt($("input[name=power]", this).val())/100.0,          // Value 0-100%    = 0-1.0 (lower values exagerate center values - expo)
                        outputRange: parseInt($("input[name=scale]", this).val())/100.0     // Value 0-100%    = 0-1.0 (higher values > 100% zoom in graph vertically)
                    }
                }
                
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
        
        buildOfferedFieldNamesList(flightLog, config);

        populateExampleGraphs(flightLog, exampleGraphsMenu);
        renderGraphs(config);
    };
 
    $(".graph-configuration-dialog-save").click(function(e) {
        onSave(convertUIToGraphConfig());
    });
    
    $(".config-graphs-add").dropdown();
    
    var
        exampleGraphsButton = $(".config-graphs-add"),
        exampleGraphsMenu = $(".config-graphs-add ~ .dropdown-menu");
    
    exampleGraphsMenu.on("click", "a", function(e) {
        var 
            graph = exampleGraphs[$(this).data("graphIndex")],
            graphElem = renderGraph($(".config-graph", dialog).length, graph);
        
        $(".config-graphs-list", dialog).append(graphElem);
        
        // Dismiss the dropdown button
        exampleGraphsButton.dropdown("toggle");
        
        e.preventDefault();
    });
}