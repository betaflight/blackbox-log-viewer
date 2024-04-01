"use strict";
// Show context menu to setup min-max values
function showMinMaxSetupContextMenu(menu_pos_x, menu_pos_y, selected_field_name, selected_curve, curves_table, flightLog, logGrapher, RefreshCharts) {

    function isActiveMenu(menu) {
        return menu.hasClass('show');
    }

    function hideMenu(menu) {
        menu.removeClass('show');
        menu.empty();
    }

    function showMenu(menu) {
        menu.addClass('show');
    }

    function positionMenu(menu, left, top) {
        menu.css("left", left);
        menu.css("top", top);
    }

    function enablePointerEvents(element) {
        element.css('pointer-events', 'all');
    }

    function disablePointerEvents(element) {
        element.css('pointer-events', 'none');
    }

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

    function SetAllMinMaxToOneScaleDuringAllTime () {
        let Max = -Number.MAX_VALUE, Min = Number.MAX_VALUE;
        curves_table.each(function() {
            const fieldName = $("select", this).val();
            let mm = GraphConfig.getMinMaxForFieldDuringAllTime(flightLog, fieldName);
            Max = Math.max(Max, Math.max(Math.abs(mm.min), Math.abs(mm.max)));
        });
        Min = -Max;

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

    function SetAllMinMaxToOneScaleDuringWindowTime () {
        let Max = -Number.MAX_VALUE, Min = Number.MAX_VALUE;
        curves_table.each(function() {
            const fieldName = $("select", this).val();
            let mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, fieldName);
            Max = Math.max(Max, Math.max(Math.abs(mm.min), Math.abs(mm.max)));
        });
        Min = -Max;

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

    function SetSelectedMinMaxToZeroOffsetDuringAllTime () {
        const mm = GraphConfig.getMinMaxForFieldDuringAllTime(flightLog, selected_field_name);
        const fieldFriendlyName = $('select.form-control option:selected', selected_curve).text();
        let curve = curvesData[fieldFriendlyName];
        curve.max = Math.max(Math.abs(mm.min), Math.abs(mm.max));
        curve.min = -curve.max;
        $('input[name=MinValue]', selected_curve).val(curve.min.toFixed(1));
        $('input[name=MaxValue]', selected_curve).val(curve.max.toFixed(1));
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

    function ShowSetAllCurvesFullRangeSubmenu(item) {
        const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        hideMenu(sub_menu);

        let elem = $('<div class="titleDiv bottomBorder">FULL RANGE:</div>');
        sub_menu.append(elem);
        elem = $('<div class="titleDiv bottomBorder">At all global log time</div>');
        sub_menu.append(elem);
        elem = $('<div>Full range</div>');
        elem.click(SetAllMinMaxToFullRangeDuringAllTime);
        sub_menu.append(elem);
        elem = $('<div>Centered full range</div>');
        elem.click(SetAllMinMaxToZeroOffsetDuringAllTime);
        sub_menu.append(elem);
        elem = $('<div>Centered one scale</div>');
        elem.click(SetAllMinMaxToOneScaleDuringAllTime);
        sub_menu.append(elem);

        elem = $('<div class="titleDiv topBorder bottomBorder">At local window time</div>');
        sub_menu.append(elem);
        elem = $('<div>Full range</div>');
        elem.click(SetAllMinMaxToFullRangeDuringWindowTime);
        sub_menu.append(elem);
        elem = $('<div>Centered full range</div>');
        elem.click(SetAllMinMaxToZeroOffsetDuringWindowTime);
        sub_menu.append(elem);
        elem = $('<div>Centered one scale</div>');
        elem.click(SetAllMinMaxToOneScaleDuringWindowTime);
        sub_menu.append(elem);

        elem = $('<div class="topBorder bottomBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);
        positionMenu(sub_menu, item.clientWidth, item.offsetTop);
        showMenu(sub_menu);
        disablePointerEvents(main_menu);
    }

    function ShowSetSelectedCurveFullRangeSubmenu(item) {
        const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        const sub_menu2 = $(".sub_menu2", selected_curve.parents(".config-graph"));

        const isSubmenuLevel2 = isActiveMenu(sub_menu);
        const menu = isSubmenuLevel2 ? sub_menu2 : sub_menu;
        const prev_menu = isSubmenuLevel2 ? sub_menu : main_menu;
        hideMenu(menu);

        let elem = $('<div class="titleDiv bottomBorder">At all global log time</div>');
        menu.append(elem);
        elem = $('<div>Full range</div>');
        elem.click(SetSelectedCurveMinMaxToFullRangeDuringAllTime);
        menu.append(elem);
        elem = $('<div>Centered full range</div>');
        elem.click(SetSelectedMinMaxToZeroOffsetDuringAllTime);
        menu.append(elem);

        elem = $('<div class="titleDiv topBorder bottomBorder">At local window time</div>');
        menu.append(elem);
        elem = $('<div>Full range</div>');
        elem.click(SetSelectedCurveMinMaxToFullRangeDuringWindowTime);
        menu.append(elem);
        elem = $('<div>Centered full range</div>');
        elem.click(SetSelectedMinMaxToZeroOffsetDuringWindowTime);
        menu.append(elem);

        elem = $('<div class="topBorder bottomBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            hideMenu(menu);
            enablePointerEvents(prev_menu);
        });
        menu.append(elem);

        const left = item.clientWidth + (isSubmenuLevel2 ? main_menu[0].children[8].clientWidth : 0);
        const top = item.offsetTop + (isSubmenuLevel2 ? main_menu[0].children[8].offsetTop : 0);
        positionMenu(menu, left, top);
        showMenu(menu);
        disablePointerEvents(prev_menu);
    }

    function SetCurvesToFullRange(e) {
        const SingleCurve = $(e.target).hasClass('SingleCurve');
        if (e.shiftKey == false) {
            if (SingleCurve) {
                SetSelectedCurveMinMaxToFullRangeDuringAllTime();
            }
            else {
                SetAllMinMaxToFullRangeDuringAllTime();
            }
            return;
        }

        if (SingleCurve) {
            ShowSetSelectedCurveFullRangeSubmenu(this);
        }
        else {
            ShowSetAllCurvesFullRangeSubmenu(this);
        }
    }

    function SetSelectedMinMaxToZeroOffsetDuringWindowTime () {
        const mm = GraphConfig.getMinMaxForFieldDuringWindowTimeInterval(flightLog, logGrapher, selected_field_name);

        const fieldFriendlyName = $('select.form-control option:selected', selected_curve).text();
        let curve = curvesData[fieldFriendlyName];
        curve.max = Math.max(Math.abs(mm.min), Math.abs(mm.max));
        curve.min = -curve.max;
        $('input[name=MinValue]', selected_curve).val(curve.min.toFixed(1));
        $('input[name=MaxValue]', selected_curve).val(curve.max.toFixed(1));
        RefreshCharts();
    }



    function ShowCurvesToSetZeroOffsetCheckboxedMenu (e) {
        const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        disablePointerEvents(main_menu);
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        hideMenu(sub_menu);
        elem = $('<div class="titleDiv bottomBorder">SELECT CURVES:</div>');
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

        if (e.shiftKey == false) {
            SetSelectedCurvesToZeroOffset();
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET CURVES TO ZERO OFFSET</div>');
        elem.click(function () {
            SetSelectedCurvesToZeroOffset();
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);

        positionMenu(sub_menu, this.clientWidth, this.offsetTop);
        showMenu(sub_menu);

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
        let inputMinValue = null, inputMaxValue = null;
        const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        disablePointerEvents(main_menu);
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        hideMenu(sub_menu);

        elem = $('<div class="titleDiv bottomBorder">SET MIN MAX VALUES</div>');
        sub_menu.append(elem);

        const SelectedCurveMin = $('input[name=MinValue]', selected_curve).val();
        elem = $('<div>Min:<input name="InputMin" type="number" value="10"/></div>');
        inputMinValue = $("input[name=InputMin]", elem);
        inputMinValue.val(SelectedCurveMin);
        sub_menu.append(elem);

        const SelectedCurveMax = $('input[name=MaxValue]', selected_curve).val();
        elem = $('<div>Max:<input name="InputMax" type="number" value="100"/></div>');
        inputMaxValue = $("input[name=InputMax]", elem);
        inputMaxValue.val(SelectedCurveMax);
        sub_menu.append(elem);

        elem = $('<div class="titleDiv bottomBorder topBorder">TO SELECTED CURVES:</div>');
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

        if (e.shiftKey == false) {
            ApplySelectedCurveMinMaxToOtherSelectedCurves();
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET MIN-MAX VALUES</div>');
        elem.click(function () {
            hideMenu(sub_menu);
            ApplySelectedCurveMinMaxToOtherSelectedCurves();
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);

        positionMenu(sub_menu, this.clientWidth, this.offsetTop);
        showMenu(sub_menu);

        function ApplySelectedCurveMinMaxToOtherSelectedCurves () {
            const curveMin = inputMinValue.val();
            const curveMax = inputMaxValue.val();
            curves_table.each(function() {
                const fieldFriendlyName = $('select.form-control option:selected', this).text();
                let curve = curvesData[fieldFriendlyName];
                if(curvesData[fieldFriendlyName].checked) {
                    curve.min = parseFloat(curveMin);
                    curve.max = parseFloat(curveMax);
                    $('input[name=MinValue]',this).val(curveMin);
                    $('input[name=MaxValue]',this).val(curveMax);
                }
            });
            RefreshCharts();
        }
    }

    function ShowCurvesToSetSameScaleCheckboxedMenu(e) {
        const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        disablePointerEvents(main_menu);
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        hideMenu(sub_menu);
        elem = $('<div class="bottomBorder titleDiv">SELECT CURVES:</div>');
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

        if (e.shiftKey == false) {
            FitSelectedCurveToSameScale();
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET CURVES TO SAME SCALE</div>');
        elem.click(function () {
            hideMenu(sub_menu);
            FitSelectedCurveToSameScale();
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);

        positionMenu(sub_menu, this.clientWidth, this.offsetTop);
        showMenu(sub_menu);

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

    function SetZoomToCurves (e) {
        const target = $(e.target);
        const SingleCurve = target.hasClass('SingleCurve');
        if(e.shiftKey == false || SingleCurve) {
            const ZoomIn = target.hasClass('ZoomIn');
            const ZoomOut = target.hasClass('ZoomOut');
            let zoomScale = 1;

            if (ZoomIn) {
                zoomScale = 1/1.05;
            }
            else
            if (ZoomOut) {
                zoomScale = 1.05;
            }

            let SelectedCurveName = undefined;
            if (SingleCurve) {
                SelectedCurveName = $('select.form-control option:selected', selected_curve).text();
            }

            for (const key in curvesData) {
                const curve = curvesData[key];
                curve.checked = !SelectedCurveName || key == SelectedCurveName;
            }
            SetZoomToSelectedCurves(zoomScale);
            return;
        }

        const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        disablePointerEvents(main_menu);
        let elem = undefined;
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        hideMenu(sub_menu);

        elem = $('<div class="titleDiv bottomBorder">INPUT ZOOM [%]:</div>');
        sub_menu.append(elem);
        elem = $('<div><input type="number" min="5" max="1000" step="10" value="10"/></div>');
        sub_menu.append(elem);
        elem = $('<div class="titleDiv bottomBorder">SELECT CURVES:</div>');
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
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);
        positionMenu(sub_menu, this.clientWidth, this.offsetTop);
        showMenu(sub_menu);

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
        const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        disablePointerEvents(main_menu);
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        hideMenu(sub_menu);
        elem = $('<div class="bottomBorder titleDiv">SELECT CURVES:</div>');
        sub_menu.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
                elem = $('<div><input type="checkbox" checked="false">' + curve.friendly_name + '</input></div>');
                $('input', elem).prop('checked', curve.save || e.shiftKey == false);
                $('input', elem).click(function (e) {
                    let curve = curvesData[this.parentElement.innerText];
                    curve.save = this.checked;
                });
                sub_menu.append(elem);
        }

        if (e.shiftKey == false) {
            SetSelectedCurvesMinMaxForSave();
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
            return;
        }

        elem = $('<div class="bottomBorder topBorder iconDiv">&#9668;SET CURVES TO SAVE</div>');
        elem.click(function () {
            SetSelectedCurvesMinMaxForSave();
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);
        positionMenu(sub_menu, this.clientWidth, this.offsetTop);
        showMenu(sub_menu);

        function SetSelectedCurvesMinMaxForSave () {
            const SelectedCurveName = $('select.form-control option:selected', selected_curve).text();
            curves_table.each(function() {
                const fieldFriendlyName = $('select.form-control option:selected', this).text();
                const curve = curvesData[fieldFriendlyName];
                $('input[name=saveMinMax]', this).prop('checked', curve.save);
            });
        }
    }

    function FillThisCurveActionsIntoMenu (menu, is_main_menu) {
        let elem = $('<div> Default</div>');
        elem.click(SetSelectedCurveMinMaxToDefault);
        menu.append(elem);

        elem = $('<div class="ZoomIn SingleCurve">Zoom In</div>');
        elem.click(SetZoomToCurves);
        menu.append(elem);

        elem = $('<div class="ZoomOut SingleCurve">Zoom Out&nbsp;&nbsp;&nbsp;&nbsp;</div>');
        elem.click(SetZoomToCurves);
        menu.append(elem);

        if (is_main_menu)
            elem = $('<div class="iconDiv SingleCurve">Full range<span class="right-arrow" style="display: none">&#9658;</span></div>');
        else
            elem = $('<div class="iconDiv SingleCurve">Full range<span class="right-arrow2" style="display: none">&#9658;</span></div>');
        elem.click(SetCurvesToFullRange);
        menu.append(elem);

        elem = $('<div>Centered</div>');
        elem.click(SetSelectedCurveToZeroOffset);
        menu.append(elem);
    }

    function ShowThisCurvesActionSubmenu() {
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        hideMenu(sub_menu);

        FillThisCurveActionsIntoMenu(sub_menu, false);

        elem = $('<div class="topBorder bottomBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            hideMenu(sub_menu);
            enablePointerEvents(main_menu);
        });
        sub_menu.append(elem);

        positionMenu(sub_menu, this.clientWidth, this.offsetTop);
        showMenu(sub_menu);
        disablePointerEvents(main_menu);
    }

    function addKeyboardEvents() {
        const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
        const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
        const sub_menu2 = $(".sub_menu2", selected_curve.parents(".config-graph"));

        selected_curve.parents(".config-graph").keydown( function (e) {
            //handle the event once
            if (this.lastEventTime == e.timeStamp) {
                if (isActiveMenu(main_menu))
                    e.stopPropagation();
                return;
            }
            this.lastEventTime = e.timeStamp;

            if (e.which == 27) {
                e.preventDefault();
                if (isActiveMenu(sub_menu2)) {
                    hideMenu(sub_menu2);
                    enablePointerEvents(sub_menu);
                    e.stopPropagation();
                }
                else
                if (isActiveMenu(sub_menu)) {
                    hideMenu(sub_menu);
                    enablePointerEvents(main_menu);
                    e.stopPropagation();
                }
                else
                if (isActiveMenu(main_menu)) {
                    hideMenu(main_menu);
                    enablePointerEvents($('.config-graph-field, .btn'));
                    e.stopPropagation();
                }
            }
            else
            if (e.key == 'Shift') {
                if (!isActiveMenu(sub_menu))
                    $(".right-arrow").css('display', 'inline');
                else
                if (!isActiveMenu(sub_menu2))
                    $(".right-arrow2").css('display', 'inline');
            }
        });

        selected_curve.parents(".config-graph").keyup( function (e) {
            if (e.key == 'Shift') {
                $(".right-arrow").css('display', 'none');
                $(".right-arrow2").css('display', 'none');
            }
        });
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

    const main_menu = $(".main_menu", selected_curve.parents(".config-graph"));
    const sub_menu = $(".sub_menu", selected_curve.parents(".config-graph"));
    hideMenu(main_menu);
    hideMenu(sub_menu);

    let elem = undefined;
    if (!oneRow) {
        elem = $('<div class="titleDiv">Group curves actions:</div>');
        main_menu.append(elem);

        elem = $('<div class="iconDiv">Like this one<span class="right-arrow" style="display: none">&#9658;</span></div>');
        elem.click(ShowCurvesToSetMinMaxCheckboxedMenu);
        main_menu.append(elem);

        elem = $('<div class="ZoomIn AllCurves iconDiv">Zoom In<span class="right-arrow" style="display: none">&#9658;</span></div>');
        elem.click(SetZoomToCurves);
        main_menu.append(elem);

        elem = $('<div class="ZoomOut AllCurves iconDiv">Zoom Out<span class="right-arrow" style="display: none">&#9658;</span></div>');
        elem.click(SetZoomToCurves);
        main_menu.append(elem);

        elem = $('<div>Default</div>');
        elem.click(SetAllMinMaxToDefault);
        main_menu.append(elem);

        elem = $('<div class="iconDiv AllCurves">Full range<span class="right-arrow" style="display: none">&#9658;</span></div>');
        elem.click(SetCurvesToFullRange);
        main_menu.append(elem);

        elem = $('<div class="iconDiv">One scale<span class="right-arrow" style="display: none">&#9658;</span></div>');
        elem.click(ShowCurvesToSetSameScaleCheckboxedMenu);
        main_menu.append(elem);

        elem = $('<div class="iconDiv bottomBorder">Centered<span class="right-arrow" style="display: none">&#9658;</span></div>');
        elem.click(ShowCurvesToSetZeroOffsetCheckboxedMenu);
        main_menu.append(elem);

        const selectedFieldName = $('select.form-control option:selected', selected_curve).text();
        elem = $('<div class="iconDiv">' + selectedFieldName + ' actions&#9658;</div>');
        elem.click(ShowThisCurvesActionSubmenu);
        main_menu.append(elem);
    }
    else {
        const selectedFieldName = $('select.form-control option:selected', selected_curve).text();
        elem = $('<div class="titleDiv">' + selectedFieldName + ' actions:</div>');
        main_menu.append(elem);
        FillThisCurveActionsIntoMenu(main_menu, true);
    }

    elem = $('<div class="topBorder iconDiv">&#9668;Return</div>');
    elem.click(function () {
        hideMenu(main_menu);
        enablePointerEvents($('.config-graph-field, .btn'));
    });
    main_menu.append(elem);

    disablePointerEvents($('.config-graph-field, .btn'));
    enablePointerEvents(main_menu);
    enablePointerEvents(sub_menu);
    addKeyboardEvents();
    showMenu(main_menu);
}
