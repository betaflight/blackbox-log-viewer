"use strict";
// Show context menu to setup min-max values
function showMinMaxSetupContextMenu(menu_pos_x, menu_pos_y, selected_field_name, selected_curve, curves_table, flightLog, logGrapher, RefreshCharts) {

    function SetAllMinMaxToDefault () {
        curves_table.each(function() {
            const fieldName = $("select", this).val();
            const mm = GraphConfig.getDefaultCurveForField(flightLog, fieldName).MinMax;
            const fieldFriendlyName = $('select.form-control option:selected', this).text();
            let curve = curvesData[fieldFriendlyName];

            curve.min = mm.min;
            curve.max = mm.max;
            $('input[name=MinValue]',this).val(mm.min.toFixed(1));
            $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
        });
        RefreshCharts();
    }

    function SetAllMinMaxToFullRangeDuringAllTime () {
        curves_table.each(function() {
            const fieldName = $("select", this).val();
            const mm = GraphConfig.getMinMaxForFieldDuringAllTime(flightLog, fieldName);

            const fieldFriendlyName = $('select.form-control option:selected', this).text();
            let curve = curvesData[fieldFriendlyName];
            curve.min = mm.min;
            curve.max = mm.max;
            $('input[name=MinValue]',this).val(mm.min.toFixed(1));
            $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
        });
        RefreshCharts();
    }

    function SetAllMinMaxToZeroOffsetDuringAllTime () {
        curves_table.each(function() {
            const fieldName = $("select", this).val();
            let mm = GraphConfig.getMinMaxForFieldDuringAllTime(flightLog, fieldName);
            mm.max = Math.max(Math.abs(mm.min), Math.abs(mm.max));
            mm.min = -mm.max;

            const fieldFriendlyName = $('select.form-control option:selected', this).text();
            let curve = curvesData[fieldFriendlyName];
            curve.min = mm.min;
            curve.max = mm.max;
            $('input[name=MinValue]',this).val(mm.min.toFixed(1));
            $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
        });
        RefreshCharts();
    }

    function SetAllMinMaxToFullRangeDuringWindowTime () {
        curves_table.each(function() {
            const fieldName = $("select", this).val();
            const mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, fieldName);

            const fieldFriendlyName = $('select.form-control option:selected', this).text();
            let curve = curvesData[fieldFriendlyName];
            curve.min = mm.min;
            curve.max = mm.max;
            $('input[name=MinValue]',this).val(mm.min.toFixed(1));
            $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
        });
        RefreshCharts();
    }

    function SetAllMinMaxToZeroOffsetDuringWindowTime () {
        curves_table.each(function() {
            const fieldName = $("select", this).val();
            let mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, fieldName);
            mm.max = Math.max(Math.abs(mm.min), Math.abs(mm.max));
            mm.min = -mm.max;

            const fieldFriendlyName = $('select.form-control option:selected', this).text();
            let curve = curvesData[fieldFriendlyName];
            curve.min = mm.min;
            curve.max = mm.max;
            $('input[name=MinValue]',this).val(mm.min.toFixed(1));
            $('input[name=MaxValue]',this).val(mm.max.toFixed(1));
        });
        RefreshCharts();
    }

    function SetAllCurvesToOneScale () {
        let Max = -Number.MAX_VALUE, Min = Number.MAX_VALUE;
        for (const key in curvesData) {
            Min = Math.min(Min, curvesData[key].min);
            Max = Math.max(Max, curvesData[key].max);
        }

        curves_table.each(function() {
            const fieldFriendlyName = $('select.form-control option:selected', this).text();
            let curve = curvesData[fieldFriendlyName];
            curve.min = Min;
            curve.max = Max;
            $('input[name=MinValue]',this).val(Min.toFixed(1));
            $('input[name=MaxValue]',this).val(Max.toFixed(1));
        });
        RefreshCharts();
    }

    function SetSelectedCurveMinMaxToDefault () {
        const mm = GraphConfig.getDefaultCurveForField(flightLog, selected_field_name).MinMax;
        const fieldFriendlyName = $('select.form-control option:selected', selected_curve).text();
        let curve = curvesData[fieldFriendlyName];
        curve.min = mm.min;
        curve.max = mm.max;
        $('input[name=MinValue]', selected_curve).val(mm.min.toFixed(1));
        $('input[name=MaxValue]', selected_curve).val(mm.max.toFixed(1));
        RefreshCharts();
    }

    function SetSelectedCurveMinMaxToFullRangeDuringAllTime () {
        const mm = GraphConfig.getMinMaxForFieldDuringAllTime(flightLog, selected_field_name);
        const fieldFriendlyName = $('select.form-control option:selected', selected_curve).text();
        let curve = curvesData[fieldFriendlyName];
        curve.min = mm.min;
        curve.max = mm.max;
        $('input[name=MinValue]', selected_curve).val(mm.min.toFixed(1));
        $('input[name=MaxValue]', selected_curve).val(mm.max.toFixed(1));
        RefreshCharts();
    }

    function SetSelectedCurveMinMaxToFullRangeDuringWindowTime () {
        const mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, selected_field_name);

        const fieldFriendlyName = $('select.form-control option:selected', selected_curve).text();
        let curve = curvesData[fieldFriendlyName];
        curve.min = mm.min;
        curve.max = mm.max;
        $('input[name=MinValue]', selected_curve).val(mm.min.toFixed(1));
        $('input[name=MaxValue]', selected_curve).val(mm.max.toFixed(1));
        RefreshCharts();
    }

    function ShowCurvesToSetZeroOffsetCheckboxedMenu (e) {
        let main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        main_menu.css('pointer-events', 'none');
        let sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        sub_menu.empty();
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        sub_menu.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
                curve.checked = true;
                elem = $('<div><input type="checkbox" checked="true">' + curve.friendly_name + '</input></div>');
                $('input', elem).click(function (e) {
                    let curve = curvesData[this.parentElement.innerText];
                    curve.checked = this.checked;
                });
                sub_menu.append(elem);
        }

        if (e.shiftKey == true) {
            SetSelectedCurvesToZeroOffset();
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET CURVES TO ZERO OFFSET</div>');
        elem.click(function () {
            SetSelectedCurvesToZeroOffset();
            sub_menu.removeClass("show");
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            sub_menu.removeClass("show");
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);
        sub_menu.css("left", this.clientWidth);
        sub_menu.css("top", this.offsetTop);
        sub_menu.addClass("show");

        function SetSelectedCurvesToZeroOffset () {
            curves_table.each(function() {
                const fieldFriendlyName = $('select.form-control option:selected', this).text();
                let curve = curvesData[fieldFriendlyName];
                if(curve.checked) {
                    let Min = parseFloat($('input[name=MinValue]',this).val());
                    let Max = parseFloat($('input[name=MaxValue]',this).val());
                    Max = Math.max(Math.abs(Min), Math.abs(Max));
                    Min = -Max;
                    const fieldFriendlyName = $('select.form-control option:selected', this).text();
                    let curve = curvesData[fieldFriendlyName];
                    curve.min = Min;
                    curve.max = Max;
                    $('input[name=MinValue]',this).val(Min.toFixed(1));
                    $('input[name=MaxValue]',this).val(Max.toFixed(1));
                }
            });
            RefreshCharts();
        }
    }

    function SetSelectedCurveToZeroOffset () {
        let Min = parseFloat($('input[name=MinValue]', selected_curve).val());
        let Max = parseFloat($('input[name=MaxValue]', selected_curve).val());
        Max = Math.max(Math.abs(Min), Math.abs(Max));
        Min = -Max;
        const fieldFriendlyName = $('select.form-control option:selected', selected_curve).text();
        let curve = curvesData[fieldFriendlyName];
        curve.min = Min;
        curve.max = Max;
        $('input[name=MinValue]', selected_curve).val(Min.toFixed(1));
        $('input[name=MaxValue]', selected_curve).val(Max.toFixed(1));
        RefreshCharts();
    }

    function ApplySelectedCurveMinMaxToAllCurves () {
        const Min = $('input[name=MinValue]', selected_curve).val();
        const Max = $('input[name=MaxValue]', selected_curve).val();
        curves_table.each(function() {
            const fieldFriendlyName = $('select.form-control option:selected', this).text();
            let curve = curvesData[fieldFriendlyName];
            curve.min = parseFloat(Min);
            curve.max = parseFloat(Max);
            $('input[name=MinValue]',this).val(Min);
            $('input[name=MaxValue]',this).val(Max);
        });
        RefreshCharts();
    }

    function ShowCurvesToSetMinMaxCheckboxedMenu (e) {
        let main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        main_menu.css('pointer-events', 'none');
        let sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        sub_menu.empty();
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        sub_menu.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
            if (!curve.selected) {
                    curve.checked = true;
                    elem = $('<div><input type="checkbox" checked="true">' + curve.friendly_name + '</input></div>');
                    $('input', elem).click(function (e) {
                        let curve = curvesData[this.parentElement.innerText];
                        curve.checked = this.checked;
                    });
                sub_menu.append(elem);
            }
        }

        if (e.shiftKey == true) {
            ApplySelectedCurveMinMaxToOtherSelectedCurves();
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET MIN-MAX VALUES</div>');
        elem.click(function () {
            sub_menu.removeClass("show");
            sub_menu.empty();
            ApplySelectedCurveMinMaxToOtherSelectedCurves();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            sub_menu.removeClass("show");
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);
        sub_menu.css("left", this.clientWidth);
        sub_menu.css("top", this.offsetTop);
        sub_menu.addClass("show");

        function ApplySelectedCurveMinMaxToOtherSelectedCurves () {
            const SelectedCurveMin = $('input[name=MinValue]', selected_curve).val();
            const SelectedCurveMax = $('input[name=MaxValue]', selected_curve).val();
            curves_table.each(function() {
                const fieldFriendlyName = $('select.form-control option:selected', this).text();
                let curve = curvesData[fieldFriendlyName];
                if(curvesData[fieldFriendlyName].checked) {
                    curve.min = parseFloat(SelectedCurveMin);
                    curve.max = parseFloat(SelectedCurveMax);
                    $('input[name=MinValue]',this).val(SelectedCurveMin);
                    $('input[name=MaxValue]',this).val(SelectedCurveMax);
                }
            });
            RefreshCharts();
        }
    }

    function ShowCurvesToSetSameScaleCheckboxedMenu(e) {
        let main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        main_menu.css('pointer-events', 'none');
        let sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        sub_menu.empty();
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        sub_menu.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
                curve.checked = true;
                elem = $('<div><input type="checkbox" checked="true">' + curve.friendly_name + '</input></div>');
                $('input', elem).click(function (e) {
                    let curve = curvesData[this.parentElement.innerText];
                    curve.checked = this.checked;
                });
                sub_menu.append(elem);
        }

        if (e.shiftKey == true) {
            FitSelectedCurveToSameScale();
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET CURVES TO SAME SCALE</div>');
        elem.click(function () {
            sub_menu.removeClass("show");
            sub_menu.empty();
            FitSelectedCurveToSameScale();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            sub_menu.removeClass("show");
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);
        sub_menu.css("left", this.clientWidth);
        sub_menu.css("top", this.offsetTop);
        sub_menu.addClass("show");

        function FitSelectedCurveToSameScale () {
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
                let curve = curvesData[fieldFriendlyName];
                if(curve.checked) {
                    curve.min = Min;
                    curve.max = Max;
                    $('input[name=MinValue]',this).val(Min.toFixed(1));
                        $('input[name=MaxValue]',this).val(Max.toFixed(1));
                    }
                });
                RefreshCharts();
        }
    }

    function SetZoomToCurves () {
        let main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        main_menu.css('pointer-events', 'none');
        let elem = undefined;
        let sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        sub_menu.empty();

        elem = $('<label class="bottomBorder">INPUT ZOOM [%]:</label>');
        sub_menu.append(elem);
        elem = $('<div><input type="number" min="5" max="1000" step="10" value="10"/></div>');
        sub_menu.append(elem);
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        sub_menu.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
            curve.checked = true;
            elem = $('<div><input type="checkbox" checked="true">' + curve.friendly_name + '</input></div>');
            $('input', elem).click(function () {
                let curve = curvesData[this.parentElement.innerText];
                curve.checked = this.checked;
            });
            sub_menu.append(elem);
        }

        elem = $('<div class="topBorder">ZOOM IN</div>');
        elem.click(function () {
            let zoomScale = parseFloat($("input[type=number]", sub_menu).val());
            zoomScale = Math.max(zoomScale, 5.0);
            zoomScale = Math.min(zoomScale, 1000);
            zoomScale = 100.0 / (100.0 + zoomScale);
            SetZoomToSelectedCurves(zoomScale);
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder">ZOOM OUT</div>');
        elem.click(function () {
            let zoomScale = parseFloat($("input[type=number]", sub_menu).val());
            zoomScale = Math.max(zoomScale, 5.0);
            zoomScale = Math.min(zoomScale, 1000);
            zoomScale = (100.0 + zoomScale) / 100.0;
            SetZoomToSelectedCurves(zoomScale);
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            sub_menu.removeClass("show");
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);
        sub_menu.css("left", this.clientWidth);
        sub_menu.css("top", this.offsetTop);
        sub_menu.addClass("show");

        function SetZoomToSelectedCurves (zoomScale) {
            curves_table.each(function() {
                const fieldFriendlyName = $('select.form-control option:selected', this).text();
                const curve = curvesData[fieldFriendlyName];
                if(curve.checked) {
                    curve.min *= zoomScale;
                    curve.max *= zoomScale;
                    $('input[name=MinValue]',this).val((curve.min).toFixed(1));
                    $('input[name=MaxValue]',this).val((curve.max).toFixed(1));
                }
            });
            RefreshCharts();
        }
    }

    function ShowCurvesToSetSaveMinMaxCheckboxedMenu(e) {
        let main_menu = $(".main_menu");
        main_menu.css('pointer-events', 'none');
        let sub_menu = $(".sub_menu");
        sub_menu.empty();
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        sub_menu.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
                elem = $('<div><input type="checkbox" checked="false">' + curve.friendly_name + '</input></div>');
                $('input', elem).prop('checked', curve.save || e.shiftKey == true);
                $('input', elem).click(function (e) {
                    let curve = curvesData[this.parentElement.innerText];
                    curve.save = this.checked;
                });
                sub_menu.append(elem);
        }

        if (e.shiftKey == true) {
            SetSelectedCurvesMinMaxForSave();
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET CURVES AS SAVING</div>');
        elem.click(function () {
            SetSelectedCurvesMinMaxForSave();
            sub_menu.removeClass("show");
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            sub_menu.removeClass("show");
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);
        sub_menu.css("left", this.clientWidth);
        sub_menu.css("top", this.offsetTop);
        sub_menu.addClass("show");

        function SetSelectedCurvesMinMaxForSave () {
            const SelectedCurveName = $('select.form-control option:selected', selected_curve).text();
            curves_table.each(function() {
                const fieldFriendlyName = $('select.form-control option:selected', this).text();
                const curve = curvesData[fieldFriendlyName];
                $('input[name=saveMinMax]', this).prop('checked', curve.save);
            });
        }
    }

    let curvesData = {};
    curves_table.each(function() {
        const fieldName = $("select", this).val();
        const fieldFriendlyName = $('select.form-control option:selected', this).text();
        const minimum = $("input[name=MinValue]", this).val();
        const maximum = $("input[name=MaxValue]", this).val();
        const save = $("input[name=saveMinMax]", this).is(':checked');
        let curve = {
            name: fieldName,
            friendly_name: fieldFriendlyName,
            min: parseFloat(minimum),
            max: parseFloat(maximum),
            selected: fieldName == selected_field_name,
            checked: false,
            save: save
        };
        curvesData[fieldFriendlyName] = curve;
    });

    const oneRow = Object.keys(curvesData).length == 1;

    let main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
    let sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
    main_menu.empty();
    sub_menu.empty();

    let elem = undefined;
    if (!oneRow) {
        elem = $('<div> All to defailt</div>');
        elem.click(SetAllMinMaxToDefault);
        main_menu.append(elem);

        elem = $('<div>Selected to this one&#9658;</div>');
        elem.click(ShowCurvesToSetMinMaxCheckboxedMenu);
        main_menu.append(elem);

        elem = $('<div>Selected to one scale&#9658;</div>');
        elem.click(ShowCurvesToSetSameScaleCheckboxedMenu);
        main_menu.append(elem);

        elem = $('<div>Selected centered&#9658;</div>');
        elem.click(ShowCurvesToSetZeroOffsetCheckboxedMenu);
        main_menu.append(elem);
    }

    let caption = oneRow ?  "This full range&#9658;" : "All full range&#9658;"
    elem = $('<div class="bottomBorder iconDiv">' + caption + '</div>');
    elem.click(function (e) {
        sub_menu.empty();
        let elem = $('<div>At all global log time</div>');
        elem.click(SetAllMinMaxToFullRangeDuringAllTime);
        sub_menu.append(elem);

        elem = $('<div>At local window time</div>');
        elem.click(SetAllMinMaxToFullRangeDuringWindowTime);
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            sub_menu.removeClass('show');
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);
        sub_menu.css("left", this.clientWidth);
        sub_menu.css("top", this.offsetTop);
        sub_menu.addClass('show');

        main_menu.css('pointer-events', 'none');
    });
    main_menu.append(elem);

    elem = $('<div> This curve to defailt</div>');
    elem.click(SetSelectedCurveMinMaxToDefault);
    main_menu.append(elem);

    elem = $('<div class="bottomBorder iconDiv">This curve centered</div>');
    elem.click(SetSelectedCurveToZeroOffset);
    main_menu.append(elem);

    elem = $('<div class="bottomBorder topBorder iconDiv">Curves zoom&#9658;</div>');
    elem.click(SetZoomToCurves);
    main_menu.append(elem);

    elem = $('<div>Other actions&#9658;</div>');
    elem.click(function () {
        main_menu.css('pointer-events', 'none');
        sub_menu.empty();

        let elem = $('<div>Fit all curves to zero ofset at global full range</div>');
        elem.click(SetAllMinMaxToZeroOffsetDuringAllTime);
        sub_menu.append(elem);

        elem = $('<div>Fit all curves to zero offset at window full range</div>');
        elem.click(SetAllMinMaxToZeroOffsetDuringWindowTime);
        sub_menu.append(elem);

        elem = $('<div class="bottomBorder iconDiv>Place all curves to one scale</div>');
        elem.click(SetAllCurvesToOneScale);
        sub_menu.append(elem);
        sub_menu.addClass('show');

        elem = $('<div class="Fit this curve at global full range</div>');
        elem.click(SetSelectedCurveMinMaxToFullRangeDuringAllTime);
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            sub_menu.removeClass('show');
            sub_menu.empty();
            main_menu.css('pointer-events', 'all');
        });
        sub_menu.append(elem);
        sub_menu.css("left", this.clientWidth);
        sub_menu.css("top", this.offsetTop);
        sub_menu.addClass('show');
    });
    main_menu.append(elem);

    elem = $('<div class="topBorder iconDiv">Save&#9658;</div>');
    elem.click(ShowCurvesToSetSaveMinMaxCheckboxedMenu);
    main_menu.append(elem);

    elem = $('<div class="topBorder iconDiv">&#9668;Exit</div>');
    elem.click(function () {
        main_menu.removeClass('show');
        main_menu.empty();
        $('.config-graph-field, .btn').css('pointer-events', 'all');
    });
    main_menu.append(elem);

    $('.config-graph-field, .btn').css('pointer-events', 'none');
    main_menu.css('pointer-events', 'all');
    sub_menu.css('pointer-events', 'all');
    main_menu.addClass('show');

    main_menu.addClass('show');
}
