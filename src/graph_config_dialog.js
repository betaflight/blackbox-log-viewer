import { GraphConfig } from "./graph_config";
import { FlightLogFieldPresenter } from "./flightlog_fields_presenter";

export function GraphConfigurationDialog(dialog, onSave) {
    var
        // Some fields it doesn't make sense to graph
        BLACKLISTED_FIELDS = {time:true, loopIteration:true, 'setpoint[0]':true, 'setpoint[1]':true, 'setpoint[2]':true, 'setpoint[3]':true},
        offeredFieldNames = [],
        exampleGraphs = [],
        activeFlightLog,
        logGrapher = null,
        prevCfg = null;

    function chooseColor(currentSelection) {
        const selectColor = $('<select class="color-picker"></select>');
            for(let i=0; i<GraphConfig.PALETTE.length; i++) {
                let option = $('<option></option>')
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
        const MAX_HEIGHT = 5;

        const selectHeight = $('<select class="form-control graph-height"></select>');
            for(let i=1; i<=MAX_HEIGHT; i++) {
                const option = $('<option></option>')
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
            if (field.curve != null) {
                $('input[name=power]',elem).val((field.curve.power!=null)?(field.curve.power*100).toFixed(0)+'%':(GraphConfig.getDefaultCurveForField(flightLog, field.name).power*100)+'%');
                $('input[name=scale]',elem).val((field.curve.outputRange!=null)?(field.curve.outputRange*100).toFixed(0)+'%':(GraphConfig.getDefaultCurveForField(flightLog, field.name).outputRange*100)+'%');
                $('input[name=EnabledMinMax]',elem).attr("checked", (field.curve.EnabledMinMax)? field.curve.EnabledMinMax:false);
                $('input[name=MinValue]',elem).attr("readonly", !field.curve.EnabledMinMax);
                $('input[name=MaxValue]',elem).attr("readonly", !field.curve.EnabledMinMax);

                if (field.curve.MinMax != null) {
                    // Set line MinMax values !!!
                    $('input[name=MinValue]',elem).val(field.curve.MinMax.min.toFixed(1));
                    $('input[name=MaxValue]',elem).val(field.curve.MinMax.max.toFixed(1));
                }
                else{
                    $('input[name=MinValue]',elem).val(GraphConfig.getDefaultCurveForField(flightLog, field.name).MinMax.min.toFixed(1));
                    $('input[name=MaxValue]',elem).val(GraphConfig.getDefaultCurveForField(flightLog, field.name).MinMax.max.toFixed(1));
                }
            } else
            {
                $('input[name=power]',elem).val((GraphConfig.getDefaultCurveForField(flightLog, field.name).power*100).toFixed(0)+'%');
                $('input[name=scale]',elem).val((GraphConfig.getDefaultCurveForField(flightLog, field.name).outputRange*100).toFixed(0)+'%');
                $('input[name=MinValue]',elem).val(GraphConfig.getDefaultCurveForField(flightLog, field.name).MinMax.min.toFixed(1));
                $('input[name=MaxValue]',elem).val(GraphConfig.getDefaultCurveForField(flightLog, field.name).MinMax.max.toFixed(1));
                $('input[name=EnabledMinMax]',elem).attr("checked", false);
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
                    + '<td><input name="grid" type="checkbox"/></td>'
                    + '<td><input name="EnabledMinMax" class="minmax-control"  type="checkbox"/></td>'
                    + '<td><input name="MinValue" class="form-control minmax-control" type="text" readonly="true"/></td>'
                    + '<td><input name="MaxValue" class="form-control minmax-control" type="text" readonly="true"/></td>'
                    + '<td><button type="button" class="btn btn-default btn-sm"><span class="glyphicon glyphicon-trash"></span></button></td>'
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
        $('input[name=grid]',elem).attr("checked", (field.grid)?field.grid:false);

        //Populate the Color Picker
        $('select.color-picker', elem).replaceWith(chooseColor(color));


        // Add event when selection changed to retrieve the current smoothing settings.
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

        // Add event when enable MinMax checkbox is changed to change the Minimun and Maximum fields readonly attr.
        $('input[name=EnabledMinMax]',elem).change( function() {
            $('input[name=MinValue]',elem).attr("readonly", !this.checked);
            $('input[name=MaxValue]',elem).attr("readonly", !this.checked);
            RefreshCharts();
        });

        // Add event when mouse double click at the enabled Minimum input field to restore default Min values.
        // field.name is undefined for the newest single curves, but it is not for the newest group curves. Therefore,  use $('select.form-control option:selected', elem).val() when field.name is undefined only
        $('input[name=MinValue]',elem).dblclick( function() {
            if($(this).prop('readonly') == false) {
                let name = field.name ?? $('select.form-control option:selected', elem).val();
                $(this).val(GraphConfig.getDefaultCurveForField(flightLog, name).MinMax.min.toFixed(1));
            }
        });
        // Add event when mouse double click at the enabled Maximum input field to restore default Max values.
        // field.name is undefined for the newest single curves, but it is not for the newest group curves. Therefore,  use $('select.form-control option:selected', elem).val() when field.name is undefined only
        $('input[name=MaxValue]',elem).dblclick( function() {
            if($(this).prop('readonly') == false) {
                let name = field.name ?? $('select.form-control option:selected', elem).val();
                $(this).val(GraphConfig.getDefaultCurveForField(flightLog, name).MinMax.max.toFixed(1));
            }
        });

        $('.minmax-control', elem).contextmenu( function(e) {
            if($('input[name=EnabledMinMax]', elem).is(':checked')) {
                let name = field.name ?? $('select.form-control option:selected', elem).val();
                e.preventDefault();
                showMinMaxSetupContextMenu(e.clientX, e.clientY, flightLog, name, elem, $(".config-graph-field", $(this).parents('.config-graph')));
            }
            return false;
        });

        return elem;
    }

    // Show context menu to setup min-max values
    function showMinMaxSetupContextMenu(menu_pos_x, menu_pos_y, flightLog, selected_field_name, selected_curve, curves_table) {
        let curvesData = {};
        let subCurvesNamesOneScale = new nw.Menu();
        curves_table.each(function() {
            let enabled = $('input[name=EnabledMinMax]', this).is(':checked');
            if (enabled) {
                let fieldName = $("select", this).val();
                let fieldFriendlyName = $('select.form-control option:selected', this).text();
                let minimum = $("input[name=MinValue]", this).val();
                let maximum = $("input[name=MaxValue]", this).val();
                let curve = {
                    name: fieldName,
                    friendly_name: fieldFriendlyName,
                    min: parseFloat(minimum),
                    max: parseFloat(maximum)
                };

                curvesData[fieldFriendlyName] = curve;

                if (fieldName != selected_field_name) {
                    subCurvesNamesOneScale.append(new nw.MenuItem({
                        label: fieldFriendlyName,
                        click: FitSelectedCurveToOneScaleWithSecond
                    }));
                }
            }
        });

        function SetAllMinMaxToFullRangeDuringAllTime() {
            curves_table.each(function() {
                const enabled = $('input[name=EnabledMinMax]', this).is(':checked');
                if (enabled) {
                    const fieldName = $("select", this).val();
                    const mm = GraphConfig.getDefaultCurveForField(flightLog, fieldName).MinMax;
                    $('input[name=MinValue]',this).val(mm.min.toFixed(1));
                    $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
                }
            });
            RefreshCharts();
        }

        function SetAllMinMaxToFullRangeDuringWindowTime() {
            curves_table.each(function() {
                const enabled = $('input[name=EnabledMinMax]', this).is(':checked');
                if (enabled) {
                    const fieldName = $("select", this).val();
                    const mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, fieldName);
                    $('input[name=MinValue]',this).val(mm.min.toFixed(1));
                    $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
                }
            });
            RefreshCharts();
        }

        function SetAllCurvesToOneScale() {
            let Max = Number.MIN_VALUE, Min = Number.MAX_VALUE;
            for (let key in curvesData) {
                Min = Math.min(Min, curvesData[key].min);
                Max = Math.max(Max, curvesData[key].max);
            }

            curves_table.each(function() {
                const enabled = $('input[name=EnabledMinMax]', this).is(':checked');
                if(enabled) {
                    $('input[name=MinValue]',this).val(Min.toFixed(1));
                    $('input[name=MaxValue]',this).val(Max.toFixed(1));
                }
            });
            RefreshCharts();
        }

        function SetSelectedCurveMinMaxToFullRangeDuringAllTime() {
            const mm = GraphConfig.getDefaultCurveForField(flightLog, selected_field_name).MinMax;
            $('input[name=MinValue]', selected_curve).val(mm.min.toFixed(1));
            $('input[name=MaxValue]', selected_curve).val(mm.max.toFixed(1));
            RefreshCharts();
        }

        function SetSelectedCurveMinMaxToFullRangeDuringWindowTime() {
            const mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, selected_field_name);
            $('input[name=MinValue]', selected_curve).val(mm.min.toFixed(1));
            $('input[name=MaxValue]', selected_curve).val(mm.max.toFixed(1));
            RefreshCharts();
        }

        function FitSelectedCurveToOneScaleWithSecond() {
            let SecondCurveName = this.label;
            let SecondCurve = curvesData[SecondCurveName];
            let SelectedCurveMin = $('input[name=MinValue]', selected_curve).val();
            let SelectedCurveMax = $('input[name=MaxValue]', selected_curve).val();
            let min = Math.min(SelectedCurveMin, SecondCurve.min);
            let max = Math.max(SelectedCurveMax, SecondCurve.max);

            $('input[name=MinValue]', selected_curve).val(min.toFixed(1));
            $('input[name=MaxValue]', selected_curve).val(max.toFixed(1));

            curves_table.each(function() {
                let enabled = $('input[name=EnabledMinMax]', this).is(':checked');
                if(enabled) {
                    let fieldFriendlyName = $('select.form-control option:selected', this).text();
                    if(SecondCurveName == fieldFriendlyName) {
                        $('input[name=MinValue]',this).val(min.toFixed(1));
                        $('input[name=MaxValue]',this).val(max.toFixed(1));
                    }
                }
            });
            RefreshCharts();
        }

        function SetAllCurvesToOneZeroAxis() {
            curves_table.each(function() {
                let enabled = $('input[name=EnabledMinMax]', this).is(':checked');
                if(enabled) {
                    let Min = $('input[name=MinValue]',this).val();
                    let Max = $('input[name=MaxValue]',this).val();
                    Max = Math.max(Math.abs(Min), Math.abs(Max));
                    Min = -Max;
                    $('input[name=MinValue]',this).val(Min.toFixed(1));
                    $('input[name=MaxValue]',this).val(Max.toFixed(1));
                }
            });
            RefreshCharts();
        }

        function FitSelectedCurveAroundZeroAxis() {
            let Min = $('input[name=MinValue]', selected_curve).val();
            let Max = $('input[name=MaxValue]', selected_curve).val();
            Max = Math.max(Math.abs(Min), Math.abs(Max));
            Min = -Max;
            $('input[name=MinValue]', selected_curve).val(Min.toFixed(1));
            $('input[name=MaxValue]', selected_curve).val(Max.toFixed(1));
            RefreshCharts();
        }

        let menu = new nw.Menu();
        menu.append(new nw.MenuItem({
            label: 'Place all curves at global full range',
            click: SetAllMinMaxToFullRangeDuringAllTime
        }));
        menu.append(new nw.MenuItem({
            label: 'Place all curves at window full range',
            click: SetAllMinMaxToFullRangeDuringWindowTime
        }));
        menu.append(new nw.MenuItem({
            label: 'Place all curves to one scale',
            click: SetAllCurvesToOneScale
        }));
        menu.append(new nw.MenuItem({
            label: 'Place all curves around zero axis',
            click: SetAllCurvesToOneZeroAxis
        }));
        menu.append(new nw.MenuItem({type: 'separator'}));
        menu.append(new nw.MenuItem({
            label: 'Place this curve at global full range',
            click: SetSelectedCurveMinMaxToFullRangeDuringAllTime
        }));
        menu.append(new nw.MenuItem({
            label: 'Place this curve at window full range',
            click: SetSelectedCurveMinMaxToFullRangeDuringWindowTime
        }));
        menu.append(new nw.MenuItem({
            label: 'Fit this curve to one scale at:',
            submenu: subCurvesNamesOneScale
        }));
        menu.append(new nw.MenuItem({
            label: 'Place this curve around zero axis',
            click: FitSelectedCurveAroundZeroAxis
        }));
        menu.popup(menu_pos_x, menu_pos_y);
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
                                + '<label class="control-label">Fields:</label>'
                                + '<div class="form-group config-graph-field-header">'
                                    + '<div class="col-sm-12">'
                                        + '<table class="config-graph-field-list">'
                                            + '<thead>'
                                                + '<tr name="field-header">'
                                                    + '<th name="field">Name</th>'
                                                    + '<th name="smoothing">Smooth</th>'
                                                    + '<th name="expo">Expo</th>'
                                                    + '<th name="zoom">Zoom</th>'
                                                    + '<th name="line">Line</th>'
                                                    + '<th name="color">Color</th>'
                                                    + '<th name="grid">Grid</th>'
                                                    + '<th name="on_minmax">MinMax</th>'
                                                    + '<th name="MinValue">Minimum</th>'
                                                    + '<th name="MaxValue">Maximum</th>'
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
                let fieldName = $("select", this).val();
                let minimum = $("input[name=MinValue]", this).val();
                let maximum = $("input[name=MaxValue]", this).val();

                field = {
                    name: fieldName,
                    smoothing: parseInt($("input[name=smoothing]", this).val())*100,        // Value 0-100%    = 0-10000uS (higher values are more smooth, 30% is typical)
                    curve: {
                        power: parseInt($("input[name=power]", this).val())/100.0,          // Value 0-100%    = 0-1.0 (lower values exaggerate center values - expo)
                        outputRange: parseInt($("input[name=scale]", this).val())/100.0,     // Value 0-100%    = 0-1.0 (higher values > 100% zoom in graph vertically)
                        MinMax: {
                            min: parseFloat(minimum),
                            max: parseFloat(maximum)
                        },
                        EnabledMinMax: $('input[name=EnabledMinMax]', this).is(':checked')
                    },
                    default: { // These are used to restore configuration if using mousewheel adjustments
                        smoothing: parseInt($("input[name=smoothing]", this).val())*100,
                        power: parseInt($("input[name=power]", this).val())/100.0,
                        outputRange: parseInt($("input[name=scale]", this).val())/100.0,
                        MinMax: {
                            min: parseFloat(minimum),
                            max: parseFloat(maximum)
                        },
                        EnabledMinMax: $('input[name=EnabledMinMax]', this).is(':checked')
                    },
                    color: $('select.color-picker option:selected', this).val(),
                    lineWidth: parseInt($("input[name=linewidth]", this).val()),
                    grid: $('input[name=grid]', this).is(':checked'),
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

    this.show = function(flightLog, config, grapher) {
        dialog.modal('show');
        activeFlightLog = flightLog;
        logGrapher = grapher;

        buildOfferedFieldNamesList(flightLog, config);

        populateExampleGraphs(flightLog, exampleGraphsMenu);
        renderGraphs(flightLog, config);
        prevCfg = convertUIToGraphConfig();
    };

    $(".graph-configuration-dialog-save").click(function() {
        onSave(convertUIToGraphConfig());
    });

    $(".graph-configuration-dialog-cancel").click(function() {
        onSave(prevCfg);
    });

    function RefreshCharts() {
        onSave(convertUIToGraphConfig());
    }

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