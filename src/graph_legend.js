import { FlightLogFieldPresenter } from "./flightlog_fields_presenter";

export function GraphLegend(
  targetElem,
  config,
  onVisibilityChange,
  onNewSelectionChange,
  onHighlightChange,
  onZoomGraph,
  onExpandGraph,
  onNewGraphConfig,
) {
  let that = this;

  const targetEl =
    targetElem instanceof Element ? targetElem : targetElem[0] || targetElem;

  function createElement(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  function buildLegend() {
    let graphs = config.getGraphs(),
      i,
      j;

    targetEl.innerHTML = "";

    for (i = 0; i < graphs.length; i++) {
      let graph = graphs[i];
      let graphDiv = createElement(
        `<div class="graph-legend" id="${i}"><h3 class="graph-legend-group field-quick-adjust" graph="${i}"></h3><ul class="list-unstyled graph-legend-field-list"></ul></div>`,
      );
      let graphTitle = graphDiv.querySelector("h3");
      let fieldList = graphDiv.querySelector("ul");

      graphTitle.textContent = graph.label;
      graphTitle.insertAdjacentHTML("afterbegin", '<span class="glyphicon glyphicon-minus"></span>');

      for (j = 0; j < graph.fields.length; j++) {
        let field = graph.fields[j];
        let li = createElement(
          `<li class="graph-legend-field field-quick-adjust" name="${field.name}" graph="${i}" field="${j}"></li>`,
        );
        let nameElem = createElement(
          `<span class="graph-legend-field-name field-quick-adjust" name="${field.name}" graph="${i}" field="${j}"></span>`,
        );
        let valueElem = createElement(
          `<span class="graph-legend-field-value field-quick-adjust" name="${field.name}" graph="${i}" field="${j}"></span>`,
        );
        let settingsElem = createElement(
          `<div class="graph-legend-field-settings field-quick-adjust" name="${field.name}" graph="${i}" field="${j}"></div>`,
        );
        let visibilityIcon = config.isGraphFieldHidden(i, j)
          ? "glyphicon-eye-close"
          : "glyphicon-eye-open";
        let visibilityElem = createElement(
          `<span class="glyphicon ${visibilityIcon} graph-legend-field-visibility" graph="${i}" field="${j}"></span>`,
        );
        li.appendChild(nameElem);
        li.appendChild(visibilityElem);
        li.appendChild(valueElem);
        li.appendChild(settingsElem);

        nameElem.textContent = field.friendlyName;
        settingsElem.textContent = " ";
        settingsElem.style.background = field.color;
        fieldList.appendChild(li);
      }

      targetEl.appendChild(graphDiv);
    }

    // Highlight the hovered field in plot
    targetEl.querySelectorAll(".graph-legend-field").forEach((el) => {
      el.addEventListener("mouseenter", function () {
        this.classList.add("highlight");
        config.highlightGraphIndex = this.getAttribute("graph");
        config.highlightFieldIndex = this.getAttribute("field");
        if (onHighlightChange) onHighlightChange();
      });
      el.addEventListener("mouseleave", function () {
        this.classList.remove("highlight");
        config.highlightGraphIndex = null;
        config.highlightFieldIndex = null;
        if (onHighlightChange) onHighlightChange();
      });
    });

    // Select the analyser graph/field to plot
    targetEl.querySelectorAll(
      ".graph-legend-field-name, .graph-legend-field-settings, .graph-legend-field-value",
    ).forEach((el) => {
      el.addEventListener("click", function (e) {
        if (e.button !== 0) return;

        let selectedGraphIndex = this.getAttribute("graph"),
          selectedFieldIndex = this.getAttribute("field");

        if (!e.altKey) {
          const selectedFieldName =
            config.getGraphs()[selectedGraphIndex].fields[selectedFieldIndex]
              .friendlyName;
          if (config.selectedFieldName != selectedFieldName) {
            config.selectedFieldName = selectedFieldName;
            config.selectedGraphIndex = selectedGraphIndex;
            config.selectedFieldIndex = selectedFieldIndex;
            if (onNewSelectionChange) onNewSelectionChange(false, e.ctrlKey);
          } else {
            onNewSelectionChange(true, e.ctrlKey);
          }
        }
        e.preventDefault();
      });
    });

    // Select the graph to expand
    targetEl.querySelectorAll(".graph-legend h3").forEach((el) => {
      el.addEventListener("click", function (e) {
        if (e.button !== 0) return;

        let selectedGraph = this.getAttribute("graph");
        if (!e.altKey) {
          if (onZoomGraph) onZoomGraph(selectedGraph);
        } else {
          if (onExpandGraph) onExpandGraph(selectedGraph);
        }
        e.preventDefault();
      });
    });

    // Make the legend draggable (native drag & drop replaces jQuery sortable)
    const legendContainer = document.querySelector(".log-graph-legend");
    if (legendContainer) {
      legendContainer.querySelectorAll(".graph-legend").forEach((item) => {
        item.draggable = true;
        item.addEventListener("dragstart", (e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", item.id);
          item.classList.add("dragging");
        });
        item.addEventListener("dragend", () => {
          item.classList.remove("dragging");
        });
      });
      legendContainer.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragging = legendContainer.querySelector(".dragging");
        const afterElement = getDragAfterElement(legendContainer, e.clientY);
        if (afterElement == null) {
          legendContainer.appendChild(dragging);
        } else {
          legendContainer.insertBefore(dragging, afterElement);
        }
      });
      legendContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        const newOrder = Array.from(legendContainer.querySelectorAll(".graph-legend")).map((el) => parseInt(el.id));
        let newGraphs = [];
        let oldGraphs = config.getGraphs();
        for (let i = 0; i < newOrder.length; i++) {
          newGraphs[i] = oldGraphs[newOrder[i]];
        }
        onNewGraphConfig(newGraphs);
      });
    }

    document.querySelectorAll(".log-close-legend-dialog").forEach((el) => {
      el.addEventListener("click", () => that.hide());
    });

    document.querySelectorAll(".log-open-legend-dialog").forEach((el) => {
      el.addEventListener("click", () => that.show());
    });

    // on first show, hide the analyser button
    if (!config.selectedFieldName) {
      document.querySelectorAll(".hide-analyser-window").forEach((el) => el.style.display = "none");
    }

    // Toggle field visibility
    targetEl.querySelectorAll(".graph-legend-field-visibility").forEach((el) => {
      el.addEventListener("click", function (e) {
        if (e.button !== 0) return;

        const graphIndex = this.getAttribute("graph"),
          fieldIndex = this.getAttribute("field");

        config.toggleGraphField(graphIndex, fieldIndex);
        onHighlightChange();

        if (config.isGraphFieldHidden(graphIndex, fieldIndex)) {
          this.classList.remove("glyphicon-eye-open");
          this.classList.add("glyphicon-eye-close");
        } else {
          this.classList.add("glyphicon-eye-open");
          this.classList.remove("glyphicon-eye-close");
        }

        e.preventDefault();
      });
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(".graph-legend:not(.dragging)"),
    ];
    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY },
    ).element;
  }

  this.updateValues = function (flightLog, frame) {
    try {
      let currentFlightMode =
        frame[flightLog.getMainFieldIndexByName("flightModeFlags")];
      let graphs = config.getGraphs();

      targetEl.querySelectorAll(".graph-legend-field-value").forEach((el) => {
        let fieldName = el.getAttribute("name");
        var value = frame[flightLog.getMainFieldIndexByName(fieldName)];
        if (userSettings.legendUnits) {
          value = FlightLogFieldPresenter.decodeFieldToFriendly(
            flightLog,
            fieldName,
            value,
            currentFlightMode,
          );
        } else {
          if (value % 1 != 0) {
            value = value.toFixed(2);
          }
        }

        el.textContent = value != null ? value : "";
      });

      targetEl.querySelectorAll(".graph-legend-field-settings").forEach((el) => {
        let i = el.getAttribute("graph");
        let j = el.getAttribute("field");
        let field = graphs[i].fields[j];
        let str =
          `Z100` +
          ` E${(field.curve.power * 100).toFixed(0)} S${(
            field.smoothing / 100
          ).toFixed(0)}`;
        el.textContent = str;
      });
    } catch (e) {
      console.log("Cannot update legend with values");
    }
  };

  this.show = function () {
    document.querySelectorAll(".log-graph-config").forEach((el) => el.style.display = "");
    document.querySelectorAll(".log-open-legend-dialog").forEach((el) => el.style.display = "none");

    if (onVisibilityChange) onVisibilityChange(false);
  };

  this.hide = function () {
    document.querySelectorAll(".log-graph-config").forEach((el) => el.style.display = "none");
    document.querySelectorAll(".log-open-legend-dialog").forEach((el) => el.style.display = "");

    if (onVisibilityChange) onVisibilityChange(true);
  };

  config.addListener(buildLegend);

  buildLegend();
}
