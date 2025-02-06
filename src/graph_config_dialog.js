import { GraphConfig } from "./graph_config";
import { FlightLogFieldPresenter } from "./flightlog_fields_presenter";
import { showMinMaxSetupContextMenu } from "./graph_minmax_setting_menu";
import { closeMinMaxContextMenu } from "./graph_minmax_setting_menu";
import { isMinMaxContextMenuActive } from "./graph_minmax_setting_menu";

export function GraphConfigurationDialog(dialog, onSave) {
  let // Some fields it doesn't make sense to graph
    BLACKLISTED_FIELDS = {
      time: true,
      loopIteration: true,
      "setpoint[0]": true,
      "setpoint[1]": true,
      "setpoint[2]": true,
      "setpoint[3]": true,
    },
    offeredFieldNames = [],
    exampleGraphs = [],
    activeFlightLog,
    logGrapher = null,
    prevCfg = null,
    activeGraphConfig = null,
    cfgMustBeRestored = false;

  function chooseColor(currentSelection) {
    const selectColor = $('<select class="color-picker"></select>');
    for (let i = 0; i < GraphConfig.PALETTE.length; i++) {
      let option = $("<option></option>")
        .text(GraphConfig.PALETTE[i].name)
        .attr("value", GraphConfig.PALETTE[i].color)
        .css("color", GraphConfig.PALETTE[i].color);
      if (currentSelection == GraphConfig.PALETTE[i].color) {
        option.attr("selected", "selected");
        selectColor
          .css("background", GraphConfig.PALETTE[i].color)
          .css("color", GraphConfig.PALETTE[i].color);
      }
      selectColor.append(option);
    }

    return selectColor;
  }

  function chooseHeight(currentSelection) {
    const MAX_HEIGHT = 5;

    const selectHeight = $(
      '<select class="form-control graph-height"></select>'
    );
    for (let i = 1; i <= MAX_HEIGHT; i++) {
      const option = $("<option></option>").text(i).attr("value", i);
      if (currentSelection == i || (currentSelection == null && i == 1)) {
        option.attr("selected", "selected");
      }
      selectHeight.append(option);
    }

    return selectHeight;
  }

  // Show/Hide remove all button
  function updateRemoveAllButton() {
    const graphCount = $(".config-graph").length;

    if (graphCount > 0) {
      $(".config-graphs-remove-all-graphs").show();
    } else {
      $(".config-graphs-remove-all-graphs").hide();
    }
    renumberGraphIndexes();
  }

  // Renumber the "Graph X" blocks after additions/deletions
  function renumberGraphIndexes() {
    const graphIndexes = $(".graph-index-number");
    const graphCount = graphIndexes.length;
    for (let i = 0; i < graphCount; i++) {
      let currentGraphNumber = i + 1;
      $(graphIndexes[i]).html(currentGraphNumber);
    }
  }

  function renderFieldOption(fieldName, selectedName) {
    const option = $("<option></option>")
      .text(
        FlightLogFieldPresenter.fieldNameToFriendly(
          fieldName,
          activeFlightLog.getSysConfig().debug_mode
        )
      )
      .attr("value", fieldName);

    if (fieldName == selectedName) {
      option.attr("selected", "selected");
    }

    return option;
  }

  // Set the current smoothing options for a field
  function renderSmoothingOptions(elem, flightLog, field) {
    if (elem) {
      // the smoothing is in uS rather than %, scale the value somewhere between 0 and 10000uS
      $("input[name=smoothing]", elem).val(
        field.smoothing != null
          ? `${(field.smoothing / 100).toFixed(0)}%`
          : `${
              GraphConfig.getDefaultSmoothingForField(flightLog, field.name) /
              100
            }%`
      );
      if (field.curve != null) {
        $("input[name=power]", elem).val(
          field.curve.power != null
            ? `${(field.curve.power * 100).toFixed(0)}%`
            : `${
                GraphConfig.getDefaultCurveForField(flightLog, field.name)
                  .power * 100
              }%`
        );
        if (field.curve.MinMax != null) {
          $("input[name=MinValue]", elem).val(
            field.curve.MinMax.min.toFixed(1)
          );
          $("input[name=MaxValue]", elem).val(
            field.curve.MinMax.max.toFixed(1)
          );
        } else {
          $("input[name=MinValue]", elem).val(
            GraphConfig.getDefaultCurveForField(
              flightLog,
              field.name
            ).MinMax.min.toFixed(1)
          );
          $("input[name=MaxValue]", elem).val(
            GraphConfig.getDefaultCurveForField(
              flightLog,
              field.name
            ).MinMax.max.toFixed(1)
          );
        }
      } else {
        $("input[name=power]", elem).val(
          `${(
            GraphConfig.getDefaultCurveForField(flightLog, field.name).power *
            100
          ).toFixed(0)}%`
        );
        $("input[name=MinValue]", elem).val(
          GraphConfig.getDefaultCurveForField(
            flightLog,
            field.name
          ).MinMax.min.toFixed(1)
        );
        $("input[name=MaxValue]", elem).val(
          GraphConfig.getDefaultCurveForField(
            flightLog,
            field.name
          ).MinMax.max.toFixed(1)
        );
      }
    }
  }

  /**
   * Render the element for the "pick a field" dropdown box. Provide "field" from the config in order to set up the
   * initial selection.
   */
  function renderField(flightLog, field, color) {
    const elem = $(
        '<tr class="config-graph-field">' +
          '<td><select class="form-control"><option value="">(choose a field)</option></select></td>' +
          '<td><input name="smoothing" class="form-control" type="text"/></td>' +
          '<td><input name="power" class="form-control" type="text"/></td>' +
          '<td><input name="linewidth" class="form-control" type="text"/></td>' +
          '<td><select class="color-picker"></select></td>' +
          '<td><input name="MinValue" class="form-control minmax-control" type="text"/></td>' +
          '<td><input name="MaxValue" class="form-control minmax-control" type="text"/></td>' +
          '<td><button type="button" class="btn btn-default btn-sm"><span class="glyphicon glyphicon-trash"></span></button></td>' +
          "</tr>"
      ),
      select = $("select.form-control", elem),
      selectedFieldName = field ? field.name : false;

    for (const field of offeredFieldNames) {
      select.append(renderFieldOption(field, selectedFieldName));
    }

    // Set the smoothing values
    renderSmoothingOptions(elem, flightLog, field);

    // Set the line width values
    $("input[name=linewidth]", elem).val(field.lineWidth ? field.lineWidth : 1);

    //Populate the Color Picker
    $("select.color-picker", elem).replaceWith(chooseColor(color));

    // Add event when selection changed to retrieve the current smoothing settings.
    $("select.form-control", elem).change(function () {
      const selectedField = {
        name: $("select.form-control option:selected", elem).val(),
      };
      const fields = activeGraphConfig.extendFields(
        activeFlightLog,
        selectedField
      );
      if (fields.length === 1) {
        renderSmoothingOptions(elem, activeFlightLog, fields[0]);
      } else {
        let colorIndex = $("select.color-picker", elem).prop("selectedIndex");
        for (let i = 0; i < fields.length - 1; i++) {
          const color =
            GraphConfig.PALETTE[colorIndex++ % GraphConfig.PALETTE.length]
              .color;
          const row = renderField(flightLog, fields[i], color);
          elem.before(row);
        }

        const index = $("select.form-control", elem).prop("selectedIndex");
        $("select.form-control", elem).prop(
          "selectedIndex",
          index + fields.length
        );
        $("select.form-control", elem).trigger("change");

        const colorPicker = $("select.color-picker", elem);
        colorPicker.prop(
          "selectedIndex",
          colorIndex % GraphConfig.PALETTE.length
        );
        colorPicker.trigger("change");
      }
      RefreshCharts();
    });

    // Add event when color picker is changed to change the dropdown coloe
    $("select.color-picker", elem).change(function () {
      $(this)
        .css("background", $("select.color-picker option:selected", elem).val())
        .css("color", $("select.color-picker option:selected", elem).val());
      RefreshCharts();
    });

    // Add event when mouse double click at the Minimum/Maxcimum input field to restore default MinMax values.
    $(".minmax-control", elem).dblclick(function (e) {
      const name = $("select.form-control option:selected", elem).val();
      const MinMax = GraphConfig.getDefaultCurveForField(
        flightLog,
        name
      ).MinMax;
      const value = e.target.name == "MinValue" ? MinMax.min : MinMax.max;
      $(this).val(value.toFixed(1));
      RefreshCharts();
    });

    $(".minmax-control", elem).change(function (e) {
      RefreshCharts();
    });
    $("input[name=smoothing]", elem).change(function (e) {
      RefreshCharts();
    });
    $("input[name=power]", elem).change(function (e) {
      RefreshCharts();
    });
    $("input[name=linewidth]", elem).change(function (e) {
      RefreshCharts();
    });

    $(".minmax-control", elem).contextmenu(function (e) {
      const name = $("select.form-control option:selected", elem).val();
      e.preventDefault();
      showMinMaxSetupContextMenu(
        e.clientX,
        e.clientY,
        name,
        elem,
        $(".config-graph-field", $(this).parents(".config-graph")),
        flightLog,
        logGrapher,
        RefreshCharts
      );
      return false;
    });

    return elem;
  }

  function renderGraph(flightLog, index, graph) {
    const graphElem = $(
        `<li class="config-graph" id="${index}">` +
          `<dl>` +
          `<dt><span>` +
          `<h4 style="display:inline-block;vertical-align: baseline;"><span class="glyphicon glyphicon-minus"></span>Graph ` +
          `<span class="graph-index-number">${index + 1}</span>` +
          `</h4>` +
          `<button type="button" class="btn btn-default btn-sm pull-right remove-single-graph-button" style="display:inline-block;vertical-align: baseline;"><span class="glyphicon glyphicon-trash"></span> Remove graph ` +
          `</button>` +
          `</span></dt>` +
          `<dd>` +
          `<div class="form-horizontal">` +
          `<div class="form-group">` +
          `<label class="col-sm-2 control-label">Axis label</label>` +
          `<div class="col-sm-10">` +
          `<ul class="config-graph-header form-inline list-unstyled">` +
          `<li class="config-graph-header">` +
          `<input class="form-control" type="text" placeholder="Axis label" style="width:92%;">` +
          `<select class="form-control graph-height"></select>` +
          `</li>` +
          `</ul>` +
          `</div>` +
          `</div>` +
          `<div class="flexDiv">` +
          `<label class="control-label">Fields:</label>` +
          `<div class="selectWrapper">` +
          `<div class="dropdown-content main_menu"></div>` +
          `<div class="dropdown-content sub_menu"></div>` +
          `<div class="dropdown-content sub_menu2"></div>` +
          `</div>` +
          `</div>` +
          `<div class="form-group config-graph-field-header">` +
          `<div class="col-sm-12">` +
          `<table class="config-graph-field-list">` +
          `<thead>` +
          `<tr name="field-header">` +
          `<th name="field">Name</th>` +
          `<th name="smoothing">Smooth</th>` +
          `<th name="expo">Expo</th>` +
          `<th name="line">Line</th>` +
          `<th name="color">Color</th>` +
          `<th name="MinValue">Minimum</th>` +
          `<th name="MaxValue">Maximum</th>` +
          `</tr>` +
          `</thead>` +
          `<tbody>` +
          `</tbody>` +
          `</table>` +
          `<button type="button" class="btn btn-default btn-sm add-field-button"><span class="glyphicon glyphicon-plus"></span> Add field</button>` +
          `</div>` +
          `</div>` +
          `</div>` +
          `</dd>` +
          `</dl>` +
          `</li>`
      ),
      fieldList = $(".config-graph-field-list", graphElem);

    $("input", graphElem).val(graph.label);

    // "Add field" button
    $(".add-field-button", graphElem).click(function (e) {
      const colorIndex = $("tbody", graphElem)[0].childElementCount;
      const color =
        GraphConfig.PALETTE[colorIndex % GraphConfig.PALETTE.length].color;
      fieldList.append(renderField(flightLog, {}, color));
      e.preventDefault();
    });

    // "Remove Graph" button
    $(".remove-single-graph-button", graphElem).click(function (e) {
      const parentGraph = $(this).parents(".config-graph");
      parentGraph.remove();
      updateRemoveAllButton();
      RefreshCharts();
      e.preventDefault();
    });

    //Populate the Height seletor
    $("select.graph-height", graphElem).replaceWith(
      chooseHeight(graph.height ? graph.height : 1)
    );

    // Add Field List
    let colorIndex = 0;
    for (const field of graph.fields) {
      const extendedFields = activeGraphConfig.extendFields(
        activeFlightLog,
        field
      );
      for (const extField of extendedFields) {
        if (!extField.color || extField.color == -1) {
          extField.color =
            GraphConfig.PALETTE[
              colorIndex++ % GraphConfig.PALETTE.length
            ].color;
        }
        const fieldElem = renderField(flightLog, extField, extField.color);
        fieldList.append(fieldElem);
      }
    }

    fieldList.on("click", "button", function (e) {
      const parentGraph = $(this).parents(".config-graph");

      $(this).parents(".config-graph-field").remove();

      // Remove the graph upon removal of the last field
      if ($(".config-graph-field", parentGraph).length === 0) {
        parentGraph.remove();
      }
      updateRemoveAllButton();
      RefreshCharts();
      e.preventDefault();
    });

    updateRemoveAllButton();

    return graphElem;
  }

  function renderGraphs(flightLog, graphs) {
    const graphList = $(".config-graphs-list", dialog);

    graphList.empty();

    for (let i = 0; i < graphs.length; i++) {
      graphList.append(renderGraph(flightLog, i, graphs[i]));
    }
  }

  function populateExampleGraphs(flightLog, menu) {
    menu.empty();

    exampleGraphs = GraphConfig.getExampleGraphConfigs(flightLog);

    exampleGraphs.unshift({
      label: "Custom graph",
      fields: [{ name: "" }],
      dividerAfter: true,
    });

    for (let i = 0; i < exampleGraphs.length; i++) {
      const li = $('<li><a href="#"></a></li>');

      $("a", li).text(exampleGraphs[i].label).data("graphIndex", i);

      menu.append(li);

      if (exampleGraphs[i].dividerAfter) {
        menu.append('<li class="divider"></li>');
      }
    }
  }

  function convertUIToGraphConfig() {
    const graphs = [];
    $(".config-graph", dialog).each(function () {
      const graph = {
        fields: [],
        height: 1,
      };

      graph.label = $("input[type='text']", this).val();
      graph.height = parseInt(
        $("select.graph-height option:selected", this).val()
      );

      $(".config-graph-field", this).each(function () {
        const fieldName = $("select", this).val();
        const minimum = $("input[name=MinValue]", this).val();
        const maximum = $("input[name=MaxValue]", this).val();
        const field = {
          name: fieldName,
          smoothing: parseInt($("input[name=smoothing]", this).val()) * 100, // Value 0-100%    = 0-10000uS (higher values are more smooth, 30% is typical)
          curve: {
            power: parseInt($("input[name=power]", this).val()) / 100.0, // Value 0-100%    = 0-1.0 (lower values exaggerate center values - expo)
            MinMax: {
              min: parseFloat(minimum),
              max: parseFloat(maximum),
            },
          },
          default: {
            // These are used to restore configuration if using mousewheel adjustments
            smoothing: parseInt($("input[name=smoothing]", this).val()) * 100,
            power: parseInt($("input[name=power]", this).val()) / 100.0,
            MinMax: {
              min: parseFloat(minimum),
              max: parseFloat(maximum),
            },
          },
          color: $("select.color-picker option:selected", this).val(),
          lineWidth: parseInt($("input[name=linewidth]", this).val()),
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
    let lastRoot = null;
    const fieldNames = flightLog.getMainFieldNames(),
      fieldsSeen = {};

    offeredFieldNames = [];

    for (const fieldName of fieldNames) {
      // For fields with multiple bracketed x[0], x[1] versions, add an "[all]" option
      const matches = fieldName.match(/^(.+)\[[0-9]+\]$/);

      if (BLACKLISTED_FIELDS[fieldName]) continue;

      if (matches) {
        if (matches[1] != lastRoot) {
          lastRoot = matches[1];

          offeredFieldNames.push(`${lastRoot}[all]`);
          fieldsSeen[`${lastRoot}[all]`] = true;
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
    for (const graph of config) {
      for (const field of graph.fields) {
        if (!fieldsSeen[field.name]) {
          offeredFieldNames.push(field.name);
        }
      }
    }
  }

  this.show = function (flightLog, graphConfig, grapher) {
    dialog.modal("show");
    activeFlightLog = flightLog;
    logGrapher = grapher;
    activeGraphConfig = graphConfig;
    const config = activeGraphConfig.getGraphs();

    buildOfferedFieldNamesList(flightLog, config);

    populateExampleGraphs(flightLog, exampleGraphsMenu);
    renderGraphs(flightLog, config);
    prevCfg = convertUIToGraphConfig();
    cfgMustBeRestored = false;
  };

  // Set focus to 'Cancel' button to do possible a closing dialog box by Esc or Enter keys
  $("#dlgGraphConfiguration").on("shown.bs.modal", function (e) {
    $(".graph-configuration-dialog-cancel").focus();
  });

  $("#dlgGraphConfiguration").on("hide.bs.modal", function (e) {
    // Lock close window if MinMax menu is openned
    if (isMinMaxContextMenuActive()) {
      e.preventDefault();
      return;
    }

    if (cfgMustBeRestored) {
      const noRedraw = false;
      onSave(prevCfg, noRedraw);
    }
  });

  $(".graph-configuration-dialog-save").click(function () {
    if (isMinMaxContextMenuActive()) closeMinMaxContextMenu();

    cfgMustBeRestored = false;
    const noRedraw = true;
    onSave(convertUIToGraphConfig(), noRedraw);
  });

  $(".graph-configuration-dialog-cancel").click(function () {
    if (isMinMaxContextMenuActive()) closeMinMaxContextMenu();

    const noRedraw = !cfgMustBeRestored;
    onSave(prevCfg, noRedraw);
    cfgMustBeRestored = false;
  });

  function RefreshCharts() {
    cfgMustBeRestored = true;
    const noRedraw = false;
    onSave(convertUIToGraphConfig(), noRedraw);
  }

  let exampleGraphsButton = $(".config-graphs-add"),
    exampleGraphsMenu = $(".config-graphs-add ~ .dropdown-menu"),
    configGraphsList = $(".config-graphs-list");

  // Make the graph order drag-able
  configGraphsList
    .sortable({
      cursor: "move",
    })
    .disableSelection();

  exampleGraphsButton.dropdown();
  exampleGraphsMenu.on("click", "a", function (e) {
    const graph = exampleGraphs[$(this).data("graphIndex")],
      graphElem = renderGraph(
        activeFlightLog,
        $(".config-graph", dialog).length,
        graph
      );

    $(configGraphsList, dialog).append(graphElem);
    updateRemoveAllButton();

    // Dismiss the dropdown button
    exampleGraphsButton.dropdown("toggle");
    if (graph.label != "Custom graph") {
      RefreshCharts();
    }
    e.preventDefault();
  });

  // Remove all Graphs button
  const removeAllGraphsButton = $(".config-graphs-remove-all-graphs");
  removeAllGraphsButton.on("click", function () {
    $(".config-graph").remove();
    updateRemoveAllButton();
    RefreshCharts();
  });
}
