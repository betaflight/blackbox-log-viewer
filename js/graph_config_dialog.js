"use strict";

function GraphConfigurationDialog(dialog, onSave) {
    var
        // Some fields it doesn't make sense to graph
        BLACKLISTED_FIELDS = {time:true, loopIteration:true, 'setpoint[0]':true, 'setpoint[1]':true, 'setpoint[2]':true, 'setpoint[3]':true},
        offeredFieldNames = [],
        exampleGraphs = [],
        activeFlightLog,
        logGrapher = null,
        prevCfg = null,
        cfgMustBeRestored = false;
    

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
                $('input[name=MinValue]',elem).val(GraphConfig.getDefaultCurveForField(flightLog, field.name).MinMax.min.toFixed(1));
                $('input[name=MaxValue]',elem).val(GraphConfig.getDefaultCurveForField(flightLog, field.name).MinMax.max.toFixed(1));
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
                    + '<td><input name="linewidth" class="form-control" type="text"/></td>'
                    + '<td><select class="color-picker"></select></td>'
                    + '<td><input name="grid" type="checkbox"/></td>'
                    + '<td><input name="MinValue" class="form-control minmax-control" type="text"/></td>'
                    + '<td><input name="MaxValue" class="form-control minmax-control" type="text"/></td>'
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

        // Add event when mouse double click at the enabled Minimum input field to restore default Min values. 
        // field.name is undefined for the newest single curves, but it is not for the newest group curves. Therefore,  use $('select.form-control option:selected', elem).val() when field.name is undefined only
        $('input[name=MinValue]',elem).dblclick( function() {
            let name = $('select.form-control option:selected', elem).val();
            $(this).val(GraphConfig.getDefaultCurveForField(flightLog, name).MinMax.min.toFixed(1));
        });
        // Add event when mouse double click at the enabled Maximum input field to restore default Max values.
        // field.name is undefined for the newest single curves, but it is not for the newest group curves. Therefore,  use $('select.form-control option:selected', elem).val() when field.name is undefined only
        $('input[name=MaxValue]',elem).dblclick( function() {
            let name = $('select.form-control option:selected', elem).val();
            $(this).val(GraphConfig.getDefaultCurveForField(flightLog, name).MinMax.max.toFixed(1));
        });

        $('.minmax-control', elem).contextmenu( function(e) {
            let name = $('select.form-control option:selected', elem).val();
            e.preventDefault();
            showMinMaxSetupContextMenu(e.clientX, e.clientY, flightLog, name, elem, $(".config-graph-field", $(this).parents('.config-graph')));
            return false;
        });

        return elem;
    }

    // Show context menu to setup min-max values
    function showMinMaxSetupContextMenu(menu_pos_x, menu_pos_y, flightLog, selected_field_name, selected_curve, curves_table) {               
        var SetAllMinMaxToDefault = function () {
            curves_table.each(function() {
                const fieldName = $("select", this).val();
                const mm = GraphConfig.getDefaultCurveForField(flightLog, fieldName).MinMax;
                $('input[name=MinValue]',this).val(mm.min.toFixed(1));
                $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
            });
            RefreshCharts();
        };

        var SetAllMinMaxToFullRangeDuringAllTime = function () {
            curves_table.each(function() {
                const fieldName = $("select", this).val();
                const mm = GraphConfig.getMinMaxForFieldDuringAllTime(flightLog, fieldName);
                $('input[name=MinValue]',this).val(mm.min.toFixed(1));
                $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
            });
            RefreshCharts();
        };

        var SetAllMinMaxToZeroOffsetDuringAllTime = function () {
            curves_table.each(function() {
                const fieldName = $("select", this).val();
                let mm = GraphConfig.getMinMaxForFieldDuringAllTime(flightLog, fieldName);
                mm.max = Math.max(Math.abs(mm.min), Math.abs(mm.max));
                mm.min = -mm.max;
                $('input[name=MinValue]',this).val(mm.min.toFixed(1));
                $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
            });
            RefreshCharts();
        };

        var SetAllMinMaxToFullRangeDuringWindowTime = function () {
            curves_table.each(function() {
                const fieldName = $("select", this).val();
                const mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, fieldName);
                $('input[name=MinValue]',this).val(mm.min.toFixed(1));
                $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
            });
            RefreshCharts();
        };

        var SetAllMinMaxToZeroOffsetDuringWindowTime = function () {
            curves_table.each(function() {
                const fieldName = $("select", this).val();
                let mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, fieldName);
                mm.max = Math.max(Math.abs(mm.min), Math.abs(mm.max));
                mm.min = -mm.max;
                $('input[name=MinValue]',this).val(mm.min.toFixed(1));
                $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
            });
            RefreshCharts();
        };

        var SetAllCurvesToOneScale = function () {
            let Max = -Number.MAX_VALUE, Min = Number.MAX_VALUE;
            for (const key in curvesData) {
                Min = Math.min(Min, curvesData[key].min);
                Max = Math.max(Max, curvesData[key].max);
            }

            curves_table.each(function() {
                $('input[name=MinValue]',this).val(Min.toFixed(1));
                $('input[name=MaxValue]',this).val(Max.toFixed(1));
            });
            RefreshCharts();
        };

        var SetSelectedCurveMinMaxToDefault = function () {
            const mm = GraphConfig.getDefaultCurveForField(flightLog, selected_field_name).MinMax;
            $('input[name=MinValue]', selected_curve).val(mm.min.toFixed(1));
            $('input[name=MaxValue]', selected_curve).val(mm.max.toFixed(1));
            RefreshCharts();
        };

        var SetSelectedCurveMinMaxToFullRangeDuringAllTime = function () {
            const mm = GraphConfig.getMinMaxForFieldDuringAllTime(flightLog, selected_field_name);
            $('input[name=MinValue]', selected_curve).val(mm.min.toFixed(1));
            $('input[name=MaxValue]', selected_curve).val(mm.max.toFixed(1));
            RefreshCharts();
        };

        var SetSelectedCurveMinMaxToFullRangeDuringWindowTime = function () {
            const mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, selected_field_name);
            $('input[name=MinValue]', selected_curve).val(mm.min.toFixed(1));
            $('input[name=MaxValue]', selected_curve).val(mm.max.toFixed(1));
            RefreshCharts();
        };

        var SetAllCurvesToZeroOffset = function () {
            curves_table.each(function() {
                let Min = parseFloat($('input[name=MinValue]',this).val());
                let Max = parseFloat($('input[name=MaxValue]',this).val());
                Max = Math.max(Math.abs(Min), Math.abs(Max));
                Min = -Max;
                $('input[name=MinValue]',this).val(Min.toFixed(1));
                $('input[name=MaxValue]',this).val(Max.toFixed(1));
            });
            RefreshCharts();
        };

        var SetSelectedCurveToZeroOffset = function () {
            let Min = parseFloat($('input[name=MinValue]', selected_curve).val());
            let Max = parseFloat($('input[name=MaxValue]', selected_curve).val());
            Max = Math.max(Math.abs(Min), Math.abs(Max));
            Min = -Max;
            $('input[name=MinValue]', selected_curve).val(Min.toFixed(1));
            $('input[name=MaxValue]', selected_curve).val(Max.toFixed(1));
            RefreshCharts();
        };

        var ApplySelectedCurveMinMaxToAllCurves = function () {
            const Min = $('input[name=MinValue]', selected_curve).val();
            const Max = $('input[name=MaxValue]', selected_curve).val();
            curves_table.each(function() {
                $('input[name=MinValue]',this).val(Min);
                $('input[name=MaxValue]',this).val(Max);
            });
            RefreshCharts();
        };

        var ShowCurvesToSetMinMaxCheckboxedMenu = function() {
            let CurvesCheckboxedMenu = new nw.Menu();
            for (const key in curvesData) {
                const curve = curvesData[key];
                if (!curve.selected) {
                    CurvesCheckboxedMenu.append(new nw.MenuItem({
                    label: curve.friendly_name,
                    type: 'checkbox',
                    checked: curvesData[curve.friendly_name].checked,
                    click: ApplySelectedCurveMinMaxToOtherSelectedCurves
                    }));
                }
            }
            CurvesCheckboxedMenu.append(new nw.MenuItem({
                        type:  'separator'
                    }));
            CurvesCheckboxedMenu.append(new nw.MenuItem({
                        label: "Set min-max values",
                        click: ApplySelectedCurveMinMaxToOtherSelectedCurves
                    }));

            CurvesCheckboxedMenu.popup(menu_pos_x, menu_pos_y);
        };

        var ApplySelectedCurveMinMaxToOtherSelectedCurves = function() {
            if (this.type == 'checkbox') {
                const fieldFriendlyName = this.label;
                curvesData[fieldFriendlyName].checked = this.checked;
                ShowCurvesToSetMinMaxCheckboxedMenu();
            }
            else {
                const SelectedCurveMin = $('input[name=MinValue]', selected_curve).val();
                const SelectedCurveMax = $('input[name=MaxValue]', selected_curve).val();
                curves_table.each(function() {
                    const fieldFriendlyName = $('select.form-control option:selected', this).text();
                    if(curvesData[fieldFriendlyName].checked) {
                        $('input[name=MinValue]',this).val(SelectedCurveMin);
                        $('input[name=MaxValue]',this).val(SelectedCurveMax);
                    }
                });
                RefreshCharts();
            }
        };

        var ShowCurvesToSetSameScaleCheckboxedMenu = function(multipleCall) {
            let CurvesCheckboxedMenu = new nw.Menu();
            const SelectedCurveName = $('select.form-control option:selected', selected_curve).text();
            for (const key in curvesData) {
                const curve = curvesData[key];
                // Checked selected curve when menu is showed firstly
                if (multipleCall==undefined && curve.friendly_name == SelectedCurveName)
                    curve.checked = true;
                CurvesCheckboxedMenu.append(new nw.MenuItem({
                label: curve.friendly_name,
                type: 'checkbox',
                checked: curve.checked,
                click: FitSelectedCurveToSameScale
                }));
            }
            CurvesCheckboxedMenu.append(new nw.MenuItem({
                        type:  'separator'
                    }));
            CurvesCheckboxedMenu.append(new nw.MenuItem({
                        label: "Set to same scale",
                        click: FitSelectedCurveToSameScale
                    }));

            CurvesCheckboxedMenu.popup(menu_pos_x, menu_pos_y);
        };

        var FitSelectedCurveToSameScale = function () {
            if (this.type == 'checkbox') {
                const fieldFriendlyName = this.label;
                curvesData[fieldFriendlyName].checked = this.checked;
                ShowCurvesToSetSameScaleCheckboxedMenu(true);
            }
            else {
                const SelectedCurveMin = parseFloat($('input[name=MinValue]', selected_curve).val());
                const SelectedCurveMax = parseFloat($('input[name=MaxValue]', selected_curve).val());
                let Max = -Number.MAX_VALUE, Min = Number.MAX_VALUE;
                Min = Math.min(Min, SelectedCurveMin);
                Max = Math.max(Max, SelectedCurveMax);
                for (const key in curvesData) {
                    if (curvesData[key].checked) {
                        Min = Math.min(Min, curvesData[key].min);
                        Max = Math.max(Max, curvesData[key].max);
                    }
                }

                const SelectedCurveName = $('select.form-control option:selected', selected_curve).text();
                curves_table.each(function() {
                    const fieldFriendlyName = $('select.form-control option:selected', this).text();
                    if(curvesData[fieldFriendlyName].checked) {
                        $('input[name=MinValue]',this).val(Min.toFixed(1));
                        $('input[name=MaxValue]',this).val(Max.toFixed(1));
                    }
                });
                RefreshCharts();
            }
        };

        let zoomScale = 1.0;
        const labelZoomIn25 = 'Zoom in 25%',
            labelZoomIn50 = 'Zoom in 50%',
            labelZoomOut25 = 'Zoom out 25%',
            labelZoomOut50 = 'Zoom out 50%';
        var SetZoomToCurves = function() {
            zoomScale = 1.0;
            switch (this.label) {
                case labelZoomIn25:
                    zoomScale = 0.75;
                    break;
                case labelZoomIn50:
                    zoomScale = 0.50;
                    break;
                case labelZoomOut25:
                    zoomScale = 1.25;
                    break;
                case labelZoomOut50:
                    zoomScale = 1.50;
                    break;
            }

            ShowCurvesToSetZoomCheckboxedMenu();
        };

        var ShowCurvesToSetZoomCheckboxedMenu = function (multipleCall) {
            let CurvesCheckboxedMenu = new nw.Menu();
            const SelectedCurveName = $('select.form-control option:selected', selected_curve).text();
            for (const key in curvesData) {
                const curve = curvesData[key];
                if (multipleCall==undefined)
                    curve.checked = true;
                CurvesCheckboxedMenu.append(new nw.MenuItem({
                label: curve.friendly_name,
                type: 'checkbox',
                checked: curve.checked,
                click: SetZoomToSelectedCurves
                }));
            }
            CurvesCheckboxedMenu.append(new nw.MenuItem({
                    type: 'separator'
                }));

            const Caption = zoomScale < 1 ? "Zoom in " : "Zoom out ";
            const procent =  Math.abs((1.0 - zoomScale) * 100 ).toFixed(0) + "%"
            CurvesCheckboxedMenu.append(new nw.MenuItem({
                        label: Caption + procent,
                        click: SetZoomToSelectedCurves
                    }));

            CurvesCheckboxedMenu.popup(menu_pos_x, menu_pos_y);
        };

        var SetZoomToSelectedCurves = function () {
            if (this.type == 'checkbox') {
                const fieldFriendlyName = this.label;
                curvesData[fieldFriendlyName].checked = this.checked;
                ShowCurvesToSetZoomCheckboxedMenu(true);
            }
            else {
                curves_table.each(function() {
                    const fieldFriendlyName = $('select.form-control option:selected', this).text();
                    const curve = curvesData[fieldFriendlyName];
                    if(curve.checked) {
                        $('input[name=MinValue]',this).val((curve.min*zoomScale).toFixed(1));
                        $('input[name=MaxValue]',this).val((curve.max*zoomScale).toFixed(1));
                    }
                });
                RefreshCharts();
            }
        };

        let curvesData = {};
        curves_table.each(function() {
            let fieldName = $("select", this).val();
            let fieldFriendlyName = $('select.form-control option:selected', this).text();
            let minimum = $("input[name=MinValue]", this).val();
            let maximum = $("input[name=MaxValue]", this).val();
            let curve = {
                name: fieldName,
                friendly_name: fieldFriendlyName,
                min: parseFloat(minimum),
                max: parseFloat(maximum),
                selected: fieldName == selected_field_name,
                checked: false
            };
            curvesData[fieldFriendlyName] = curve;
        });

        const oneRow = Object.keys(curvesData).length == 1;

        let zoomSubMenu = new nw.Menu();
        zoomSubMenu.append(new nw.MenuItem({
                label: labelZoomIn25,
                click: SetZoomToCurves
            }));
        zoomSubMenu.append(new nw.MenuItem({
                label: labelZoomIn50,
                click: SetZoomToCurves
            }));
        zoomSubMenu.append(new nw.MenuItem({
                label: labelZoomOut25,
                click: SetZoomToCurves
            }));
        zoomSubMenu.append(new nw.MenuItem({
                label: labelZoomOut50,
                click: SetZoomToCurves
            }));

        let mainMenu = new nw.Menu();

        if (!oneRow) {
            mainMenu.append(new nw.MenuItem({
                label: 'Set all curves min-max values to default',
                click: SetAllMinMaxToDefault
            }));
            mainMenu.append(new nw.MenuItem({
                label: 'Fit all curves at global full range',
                click: SetAllMinMaxToFullRangeDuringAllTime
            }));
            mainMenu.append(new nw.MenuItem({
                label: 'Fit all curves to zero ofset at global full range',
                click: SetAllMinMaxToZeroOffsetDuringAllTime
            }));
            mainMenu.append(new nw.MenuItem({
                label: 'Fit all curves at window full range',
                click: SetAllMinMaxToFullRangeDuringWindowTime
            }));
            mainMenu.append(new nw.MenuItem({
                label: 'Fit all curves to zero offset at window full range',
                click: SetAllMinMaxToZeroOffsetDuringWindowTime
            }));
            mainMenu.append(new nw.MenuItem({
                label: 'Place all curves to one scale',
                click: SetAllCurvesToOneScale
            }));
            mainMenu.append(new nw.MenuItem({
                label: 'Place all curves to zero ofset',
                click: SetAllCurvesToZeroOffset
            }));
            mainMenu.append(new nw.MenuItem({
                label: 'Apply this curves min-max to all curves',
                click: ApplySelectedCurveMinMaxToAllCurves
            }));
                mainMenu.append(new nw.MenuItem({
                    label: 'Apply this curves min-max to ...',
                    click: ShowCurvesToSetMinMaxCheckboxedMenu
                }));
                mainMenu.append(new nw.MenuItem({
                    label: 'Fit curves to same scale ...',
                    click: ShowCurvesToSetSameScaleCheckboxedMenu
                }));
                mainMenu.append(new nw.MenuItem({type: 'separator'}));
        }
        mainMenu.append(new nw.MenuItem({
            label: 'Set this curve min-max values to default',
            click: SetSelectedCurveMinMaxToDefault
        }));
        mainMenu.append(new nw.MenuItem({
            label: 'Fit this curve at global full range',
            click: SetSelectedCurveMinMaxToFullRangeDuringAllTime
        }));
        mainMenu.append(new nw.MenuItem({
            label: 'Fit this curve at window full range',
            click: SetSelectedCurveMinMaxToFullRangeDuringWindowTime
        }));
        mainMenu.append(new nw.MenuItem({
            label: 'Place this curve to zero offset',
            click: SetSelectedCurveToZeroOffset
        }));
        mainMenu.append(new nw.MenuItem({type: 'separator'}));
        mainMenu.append(new nw.MenuItem({
            label: 'Zoom',
            submenu: zoomSubMenu
        }));

        mainMenu.popup(menu_pos_x, menu_pos_y);
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
                                                    + '<th name="line">Line</th>'
                                                    + '<th name="color">Color</th>'
                                                    + '<th name="grid">Grid</th>'
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
                        MinMax: {
                            min: parseFloat(minimum),
                            max: parseFloat(maximum)
                        }
                    },
                    default: { // These are used to restore configuration if using mousewheel adjustments
                        smoothing: parseInt($("input[name=smoothing]", this).val())*100,
                        power: parseInt($("input[name=power]", this).val())/100.0,
                        MinMax: {
                            min: parseFloat(minimum),
                            max: parseFloat(maximum)
                        }
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
        cfgMustBeRestored = false;
    };
    
    $("#dlgGraphConfiguration").on('hidden.bs.modal', function() {
        if (cfgMustBeRestored)
            onSave(prevCfg);
    });
 
    $(".graph-configuration-dialog-save").click(function() {
        cfgMustBeRestored = false;
        onSave(convertUIToGraphConfig());
    });

    $(".graph-configuration-dialog-cancel").click(function() {
        cfgMustBeRestored = false;
        onSave(prevCfg);
    });

    function RefreshCharts() {
        cfgMustBeRestored = true;
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