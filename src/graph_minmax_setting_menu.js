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
        let menu1 = $(".dropdown-content.menu1", selected_curve.parents(".config-graph"));
        menu1.css('pointer-events', 'none');
        let menu3 = $(".dropdown-content.menu3", selected_curve.parents(".config-graph"));
        menu3.empty();
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        menu3.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
                curve.checked = true;
                elem = $('<div><input type="checkbox" checked="true">' + curve.friendly_name + '</input></div>');
                $('input', elem).click(function (e) {
                    let curve = curvesData[this.parentElement.innerText];
                    curve.checked = this.checked;
                });
                menu3.append(elem);
        }

        if (e.shiftKey == true) {
            SetSelectedCurvesToZeroOffset();
            menu3.empty();
            menu1.css('pointer-events', 'all');
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET CURVES TO ZERO OFFSET</div>');
        elem.click(function () {
            SetSelectedCurvesToZeroOffset();
            menu3.removeClass("show");
            menu3.empty();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            menu3.removeClass("show");
            menu3.empty();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);
        menu3.css("left", this.clientWidth);
        menu3.css("top", this.offsetTop);
        menu3.addClass("show");

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
        let menu1 = $(".dropdown-content.menu1", selected_curve.parents(".config-graph"));
        menu1.css('pointer-events', 'none');
        let menu3 = $(".dropdown-content.menu3", selected_curve.parents(".config-graph"));
        menu3.empty();
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        menu3.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
            if (!curve.selected) {
                    curve.checked = true;
                    elem = $('<div><input type="checkbox" checked="true">' + curve.friendly_name + '</input></div>');
                    $('input', elem).click(function (e) {
                        let curve = curvesData[this.parentElement.innerText];
                        curve.checked = this.checked;
                    });
                menu3.append(elem);
            }
        }

        if (e.shiftKey == true) {
            ApplySelectedCurveMinMaxToOtherSelectedCurves();
            menu3.empty();
            menu1.css('pointer-events', 'all');
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET MIN-MAX VALUES</div>');
        elem.click(function () {
            menu3.removeClass("show");
            menu3.empty();
            ApplySelectedCurveMinMaxToOtherSelectedCurves();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            menu3.removeClass("show");
            menu3.empty();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);
        menu3.css("left", this.clientWidth);
        menu3.css("top", this.offsetTop);
        menu3.addClass("show");

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
        let menu1 = $(".dropdown-content.menu1", selected_curve.parents(".config-graph"));
        menu1.css('pointer-events', 'none');
        let menu3 = $(".dropdown-content.menu3", selected_curve.parents(".config-graph"));
        menu3.empty();
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        menu3.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
                curve.checked = true;
                elem = $('<div><input type="checkbox" checked="true">' + curve.friendly_name + '</input></div>');
                $('input', elem).click(function (e) {
                    let curve = curvesData[this.parentElement.innerText];
                    curve.checked = this.checked;
                });
                menu3.append(elem);
        }

        if (e.shiftKey == true) {
            FitSelectedCurveToSameScale();
            menu3.empty();
            menu1.css('pointer-events', 'all');
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET CURVES TO SAME SCALE</div>');
        elem.click(function () {
            menu3.removeClass("show");
            menu3.empty();
            FitSelectedCurveToSameScale();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            menu3.removeClass("show");
            menu3.empty();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);
        menu3.css("left", this.clientWidth);
        menu3.css("top", this.offsetTop);
        menu3.addClass("show");

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
        let menu1 = $(".dropdown-content.menu1", selected_curve.parents(".config-graph"));
        menu1.css('pointer-events', 'none');
        let elem = undefined;
        let menu3 = $(".dropdown-content.menu3", selected_curve.parents(".config-graph"));
        menu3.empty();

        elem = $('<label class="bottomBorder">INPUT ZOOM [%]:</label>');
        menu3.append(elem);
        elem = $('<div><input type="number" min="5" max="1000" step="10" value="10"/></div>');
        menu3.append(elem);
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        menu3.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
            curve.checked = true;
            elem = $('<div><input type="checkbox" checked="true">' + curve.friendly_name + '</input></div>');
            $('input', elem).click(function () {
                let curve = curvesData[this.parentElement.innerText];
                curve.checked = this.checked;
            });
            menu3.append(elem);
        }

        elem = $('<div class="topBorder">ZOOM IN</div>');
        elem.click(function () {
            let zoomScale = parseFloat($("input[type=number]", menu3).val());
            zoomScale = Math.max(zoomScale, 5.0);
            zoomScale = Math.min(zoomScale, 1000);
            zoomScale = 100.0 / (100.0 + zoomScale);
            SetZoomToSelectedCurves(zoomScale);
        });
        menu3.append(elem);

        elem = $('<div class="topBorder">ZOOM OUT</div>');
        elem.click(function () {
            let zoomScale = parseFloat($("input[type=number]", menu3).val());
            zoomScale = Math.max(zoomScale, 5.0);
            zoomScale = Math.min(zoomScale, 1000);
            zoomScale = (100.0 + zoomScale) / 100.0;
            SetZoomToSelectedCurves(zoomScale);
        });
        menu3.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            menu3.removeClass("show");
            menu3.empty();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);
        menu3.css("left", this.clientWidth);
        menu3.css("top", this.offsetTop);
        menu3.addClass("show");

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
        let menu1 = $(".dropdown-content.menu1", selected_curve.parents(".config-graph"));
        menu1.css('pointer-events', 'none');
        let menu3 = $(".dropdown-content.menu3", selected_curve.parents(".config-graph"));
        menu3.empty();
        elem = $('<label class="bottomBorder">SELECT CURVES:</label>');
        menu3.append(elem);

        for (const key in curvesData) {
            const curve = curvesData[key];
                elem = $('<div><input type="checkbox" checked="false">' + curve.friendly_name + '</input></div>');
                $('input', elem).prop('checked', curve.save || e.shiftKey == true);
                $('input', elem).click(function (e) {
                    let curve = curvesData[this.parentElement.innerText];
                    curve.save = this.checked;
                });
                menu3.append(elem);
        }

        if (e.shiftKey == true) {
            SetSelectedCurvesMinMaxForSave();
            menu3.empty();
            menu1.css('pointer-events', 'all');
            return;
        }

        elem = $('<div class="topBorder iconDiv">&#9668;SET CURVES AS SAVING</div>');
        elem.click(function () {
            SetSelectedCurvesMinMaxForSave();
            menu3.removeClass("show");
            menu3.empty();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            menu3.removeClass("show");
            menu3.empty();
            menu1.css('pointer-events', 'all');
        });
        menu3.append(elem);
        menu3.css("left", this.clientWidth);
        menu3.css("top", this.offsetTop);
        menu3.addClass("show");

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

    let menu1 = $(".dropdown-content.menu1", selected_curve.parents(".config-graph"));
    let menu2 = $(".dropdown-content.menu2", selected_curve.parents(".config-graph"));
    let menu3 = $(".dropdown-content.menu3", selected_curve.parents(".config-graph"));
    menu1.empty();
    menu2.empty();
    menu3.empty();

    let elem = undefined;
    if (!oneRow) {
        elem = $('<div> All to defailt</div>');
        elem.click(SetAllMinMaxToDefault);
        menu1.append(elem);

        elem = $('<div>Selected to this one&#9658;</div>');
        elem.click(ShowCurvesToSetMinMaxCheckboxedMenu);
        menu1.append(elem);

        elem = $('<div>Selected to one scale&#9658;</div>');
        elem.click(ShowCurvesToSetSameScaleCheckboxedMenu);
        menu1.append(elem);

        elem = $('<div>Selected centered&#9658;</div>');
        elem.click(ShowCurvesToSetZeroOffsetCheckboxedMenu);
        menu1.append(elem);
    }

    let caption = oneRow ?  "This full range&#9658;" : "All full range&#9658;"
    elem = $('<div class="bottomBorder iconDiv">' + caption + '</div>');
    elem.click(function (e) {
        menu2.empty();
        let elem = $('<div>At all global log time</div>');
        elem.click(SetAllMinMaxToFullRangeDuringAllTime);
        menu2.append(elem);

        elem = $('<div>At local window time</div>');
        elem.click(SetAllMinMaxToFullRangeDuringWindowTime);
        menu2.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            menu2.removeClass('show');
            menu2.empty();
            menu1.css('pointer-events', 'all');
        });
        menu2.append(elem);
        menu2.css("left", this.clientWidth);
        menu2.css("top", this.offsetTop);
        menu2.addClass('show');

        menu1.css('pointer-events', 'none');
    });
    menu1.append(elem);

    elem = $('<div> This curve to defailt</div>');
    elem.click(SetSelectedCurveMinMaxToDefault);
    menu1.append(elem);

//        elem = $('<div>This curve to:</div>');
//      elem.click(SetSelectedCurveMinMaxToDefault);
    //menu1.append(elem);

    elem = $('<div class="bottomBorder iconDiv">This curve centered</div>');
    elem.click(SetSelectedCurveToZeroOffset);
    menu1.append(elem);

    elem = $('<div class="bottomBorder topBorder iconDiv">Curves zoom&#9658;</div>');
    elem.click(SetZoomToCurves);
    menu1.append(elem);

    elem = $('<div>Other actions&#9658;</div>');
    elem.click(function () {
        menu1.css('pointer-events', 'none');
        menu2.empty();

        let elem = $('<div>Fit all curves to zero ofset at global full range</div>');
        elem.click(SetAllMinMaxToZeroOffsetDuringAllTime);
        menu2.append(elem);

        elem = $('<div>Fit all curves to zero offset at window full range</div>');
        elem.click(SetAllMinMaxToZeroOffsetDuringWindowTime);
        menu2.append(elem);

        elem = $('<div class="bottomBorder iconDiv>Place all curves to one scale</div>');
        elem.click(SetAllCurvesToOneScale);
        menu2.append(elem);
        menu2.addClass('show');

        elem = $('<div class="Fit this curve at global full range</div>');
        elem.click(SetSelectedCurveMinMaxToFullRangeDuringAllTime);
        menu2.append(elem);

        elem = $('<div class="topBorder iconDiv">&#9668;Back</div>');
        elem.click(function () {
            menu2.removeClass('show');
            menu2.empty();
            menu1.css('pointer-events', 'all');
        });
        menu2.append(elem);
        menu2.css("left", this.clientWidth);
        menu2.css("top", this.offsetTop);
        menu2.addClass('show');
    });
    menu1.append(elem);

    elem = $('<div class="topBorder iconDiv">Save&#9658;</div>');
    elem.click(ShowCurvesToSetSaveMinMaxCheckboxedMenu);
    menu1.append(elem);

    elem = $('<div class="topBorder iconDiv">&#9668;Exit</div>');
    elem.click(function () {
        menu1.removeClass('show');
        menu1.empty();
        $('.graph-configuration-dialog').css('pointer-events', 'all');
    });
    menu1.append(elem);

    $('.graph-configuration-dialog').css('pointer-events', 'none');
    menu1.css('pointer-events', 'all');
    menu2.css('pointer-events', 'all');
    menu3.css('pointer-events', 'all');

    menu1.addClass('show');
}
