import { FlightLogFieldPresenter } from "./flightlog_fields_presenter";

export function GraphLegend(
  targetElem,
  config,
  onVisibilityChange,
  onNewSelectionChange,
  onHighlightChange,
  onZoomGraph,
  onExpandGraph,
  onNewGraphConfig
) {
  let that = this;

  function buildLegend() {
    let graphs = config.getGraphs(),
      i,
      j;

    targetElem.empty();

    for (i = 0; i < graphs.length; i++) {
      let graph = graphs[i],
        graphDiv = $(
          `<div class="graph-legend" id="${i}"><h3 class="graph-legend-group field-quick-adjust" graph="${i}"></h3><ul class="list-unstyled graph-legend-field-list"></ul></div>`
        ),
        graphTitle = $("h3", graphDiv),
        fieldList = $("ul", graphDiv);

      graphTitle.text(graph.label);
      graphTitle.prepend('<span class="glyphicon glyphicon-minus"></span>');

      for (j = 0; j < graph.fields.length; j++) {
        let field = graph.fields[j],
          li = $(
            `<li class="graph-legend-field field-quick-adjust" name="${field.name}" graph="${i}" field="${j}"></li>`
          ),
          nameElem = $(
            `<span class="graph-legend-field-name field-quick-adjust" name="${field.name}" graph="${i}" field="${j}"></span>`
          ),
          valueElem = $(
            `<span class="graph-legend-field-value field-quick-adjust" name="${field.name}" graph="${i}" field="${j}"></span>`
          ),
          settingsElem = $(
            `<div class="graph-legend-field-settings field-quick-adjust" name="${field.name}" graph="${i}" field="${j}"></div>`
          ),
          visibilityIcon = config.isGraphFieldHidden(i, j)
            ? "glyphicon-eye-close"
            : "glyphicon-eye-open",
          visibilityElem = $(
            `<span class="glyphicon ${visibilityIcon} graph-legend-field-visibility" graph="${i}" field="${j}"></span>`
          );
        li.append(nameElem);
        li.append(visibilityElem);
        li.append(valueElem);
        li.append(settingsElem);

        nameElem.text(field.friendlyName);
        settingsElem.text(" ");
        settingsElem.css("background", field.color);
        fieldList.append(li);
      }

      targetElem.append(graphDiv);
    }

    // Add a trigger on legend; highlight the hovered field in plot
    $(".graph-legend-field").on("mouseenter", function (e) {
      $(this).addClass("highlight");
      config.highlightGraphIndex = $(this).attr("graph");
      config.highlightFieldIndex = $(this).attr("field");
      if (onHighlightChange) {
        onHighlightChange();
      }
    });

    $(".graph-legend-field").on("mouseleave", function (e) {
      $(this).removeClass("highlight");
      config.highlightGraphIndex = null;
      config.highlightFieldIndex = null;
      if (onHighlightChange) {
        onHighlightChange();
      }
    });

    // Add a trigger on legend; select the analyser graph/field to plot
    $(
      ".graph-legend-field-name, .graph-legend-field-settings, .graph-legend-field-value"
    ).on("click", function (e) {
      if (e.which != 1) return; // only accept left mouse clicks

      let selectedGraphIndex = $(this).attr("graph"),
        selectedFieldIndex = $(this).attr("field");

      if (!e.altKey) {
        const selectedFieldName =
          config.getGraphs()[selectedGraphIndex].fields[selectedFieldIndex]
            .friendlyName;
        if (config.selectedFieldName != selectedFieldName) {
          config.selectedFieldName = selectedFieldName;
          config.selectedGraphIndex = selectedGraphIndex;
          config.selectedFieldIndex = selectedFieldIndex;
          if (onNewSelectionChange) {
            onNewSelectionChange();
          }
        } else {
          onNewSelectionChange(true);
        }
      }
      e.preventDefault();
    });

    // Add a trigger on legend list title; select the graph to expland
    $(".graph-legend h3").on("click", function (e) {
      if (e.which != 1) return; // only accept left mouse clicks

      let selectedGraph = $(this).attr("graph");
      if (!e.altKey) {
        if (onZoomGraph) {
          onZoomGraph(selectedGraph);
        }
      } else {
        if (onExpandGraph) {
          onExpandGraph(selectedGraph);
        }
      }
      e.preventDefault();
    });

    // Make the legend dragabble
    $(".log-graph-legend").sortable({
      update: function (event, ui) {
        let newOrder = $(".log-graph-legend").sortable("toArray");
        let newGraphs = [];
        let oldGraphs = config.getGraphs();
        for (let i = 0; i < newOrder.length; i++) {
          newGraphs[i] = oldGraphs[newOrder[i]];
        }
        onNewGraphConfig(newGraphs);
      },
      cursor: "move",
    });
    $(".log-graph-legend").disableSelection();

    $(".log-close-legend-dialog").on("click", function () {
      that.hide();
    });

    $(".log-open-legend-dialog").on("click", function () {
      that.show();
    });

    // on first show, hide the analyser button
    if (!config.selectedFieldName) $(".hide-analyser-window").hide();

    // Add a trigger on legend; select the analyser graph/field to plot
    $(".graph-legend-field-visibility").on("click", function (e) {
      if (e.which != 1) {
        return; // only accept left mouse clicks
      }

      const $this = $(this),
        graphIndex = $this.attr("graph"),
        fieldIndex = $this.attr("field");

      config.toggleGraphField(graphIndex, fieldIndex);
      onHighlightChange();

      if (config.isGraphFieldHidden(graphIndex, fieldIndex)) {
        $this.removeClass("glyphicon-eye-open");
        $this.addClass("glyphicon-eye-close");
      } else {
        $this.addClass("glyphicon-eye-open");
        $this.removeClass("glyphicon-eye-close");
      }

      e.preventDefault();
    });
  }

  this.updateValues = function (flightLog, frame) {
    try {
      // New function to show values on legend.
      let currentFlightMode =
        frame[flightLog.getMainFieldIndexByName("flightModeFlags")];  //TODO use actualFlightModeFlags for new BF versions
      let graphs = config.getGraphs(),
        i,
        j;

      $(".graph-legend-field-value").each(function (index, value) {
        let fieldName = $(this).attr("name");
        var value = frame[flightLog.getMainFieldIndexByName(fieldName)]; // get the raw value from log
        if (userSettings.legendUnits) {
          // if we want the legend to show engineering units
          value = FlightLogFieldPresenter.decodeFieldToFriendly(
            flightLog,
            fieldName,
            value,
            currentFlightMode
          );
        } else {
          // raw value
          if (value % 1 != 0) {
            value = value.toFixed(2);
          }
        }

        if (value != null) {
          $(this).text(value);
        } else {
          $(this).text("");
        }
      });

      $(".graph-legend-field-settings").each(function (index, value) {
        let i = $(this).attr("graph");
        let j = $(this).attr("field");
        let field = graphs[i].fields[j];
        let str =
          `Z100` + // There are no direct zoom now, set 100%
          ` E${(field.curve.power * 100).toFixed(0)} S${(
            field.smoothing / 100
          ).toFixed(0)}`;
        $(this).text(str);
      });
    } catch (e) {
      console.log("Cannot update legend with values");
    }
  };

  this.show = function () {
    $(".log-graph-config").show();
    $(".log-open-legend-dialog").hide();

    if (onVisibilityChange) {
      onVisibilityChange(false);
    }
  };

  this.hide = function () {
    $(".log-graph-config").hide();
    $(".log-open-legend-dialog").show();

    if (onVisibilityChange) {
      onVisibilityChange(true);
    }
  };

  config.addListener(buildLegend);

  buildLegend();
}
