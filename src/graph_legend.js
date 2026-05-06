import { FlightLogFieldPresenter } from "./flightlog_fields_presenter";
import { useSettingsStore } from "./stores/settings.js";

function createElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstChild;
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
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}

const ICON_EYE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_EYE_OFF =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>';

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
  const { userSettings } = useSettingsStore();
  let that = this;

  const targetEl =
    targetElem instanceof Element ? targetElem : targetElem[0] || targetElem;

  function buildLegend() {
    let graphs = config.getGraphs(),
      i,
      j;

    targetEl.innerHTML = "";

    for (i = 0; i < graphs.length; i++) {
      let graph = graphs[i];
      let graphDiv = createElement(
        `<div class="graph-legend" id="${i}"><h3 class="graph-legend-group field-quick-adjust" graph="${i}"></h3><ul class="list-none pl-0 graph-legend-field-list"></ul></div>`,
      );
      let graphTitle = graphDiv.querySelector("h3");
      let fieldList = graphDiv.querySelector("ul");

      graphTitle.textContent = graph.label;
      graphTitle.insertAdjacentHTML(
        "afterbegin",
        '<span class="legend-collapse-icon" style="margin-right:0.3em"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></span>',
      );

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
        let isHidden = config.isGraphFieldHidden(i, j);
        let visibilityClass = isHidden
          ? "legend-eye-closed"
          : "legend-eye-open";
        let visibilityElem = createElement(
          `<span class="${visibilityClass} graph-legend-field-visibility" graph="${i}" field="${j}">${isHidden ? ICON_EYE_OFF : ICON_EYE}</span>`,
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
        if (onHighlightChange) {
          onHighlightChange();
        }
      });
      el.addEventListener("mouseleave", function () {
        this.classList.remove("highlight");
        config.highlightGraphIndex = null;
        config.highlightFieldIndex = null;
        if (onHighlightChange) {
          onHighlightChange();
        }
      });
    });

    // Select the analyser graph/field to plot
    targetEl
      .querySelectorAll(
        ".graph-legend-field-name, .graph-legend-field-settings, .graph-legend-field-value",
      )
      .forEach((el) => {
        el.addEventListener("click", function (e) {
          if (e.button !== 0) {
            return;
          }

          let selectedGraphIndex = this.getAttribute("graph"),
            selectedFieldIndex = this.getAttribute("field");

          if (!e.altKey) {
            const selectedFieldName =
              config.getGraphs()[selectedGraphIndex].fields[selectedFieldIndex]
                .friendlyName;
            if (config.selectedFieldName === selectedFieldName) {
              onNewSelectionChange(true, e.ctrlKey);
            } else {
              config.selectedFieldName = selectedFieldName;
              config.selectedGraphIndex = selectedGraphIndex;
              config.selectedFieldIndex = selectedFieldIndex;
              if (onNewSelectionChange) {
                onNewSelectionChange(false, e.ctrlKey);
              }
            }
          }
          e.preventDefault();
        });
      });

    // Select the graph to expand
    targetEl.querySelectorAll(".graph-legend h3").forEach((el) => {
      el.addEventListener("click", function (e) {
        if (e.button !== 0) {
          return;
        }

        let selectedGraph = this.getAttribute("graph");
        if (!e.altKey) {
          if (onZoomGraph) {
            onZoomGraph(selectedGraph);
          }
        } else if (onExpandGraph) {
          onExpandGraph(selectedGraph);
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
        if (afterElement === null) {
          legendContainer.appendChild(dragging);
        } else {
          afterElement.before(dragging);
        }
      });
      legendContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        const newOrder = Array.from(
          legendContainer.querySelectorAll(".graph-legend"),
        ).map((el) => Number.parseInt(el.id));
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
      document.querySelectorAll(".hide-analyser-window").forEach((el) => {
        el.style.display = "none";
      });
    }

    // Toggle field visibility
    targetEl
      .querySelectorAll(".graph-legend-field-visibility")
      .forEach((el) => {
        el.addEventListener("click", function (e) {
          if (e.button !== 0) {
            return;
          }

          const graphIndex = this.getAttribute("graph"),
            fieldIndex = this.getAttribute("field");

          config.toggleGraphField(graphIndex, fieldIndex);
          onHighlightChange();

          if (config.isGraphFieldHidden(graphIndex, fieldIndex)) {
            this.classList.remove("legend-eye-open");
            this.classList.add("legend-eye-closed");
            this.innerHTML = ICON_EYE_OFF;
          } else {
            this.classList.add("legend-eye-open");
            this.classList.remove("legend-eye-closed");
            this.innerHTML = ICON_EYE;
          }

          e.preventDefault();
        });
      });
  }

  this.updateValues = function (flightLog, frame) {
    try {
      let currentFlightMode =
        frame[flightLog.getMainFieldIndexByName("flightModeFlags")];
      let graphs = config.getGraphs();

      targetEl.querySelectorAll(".graph-legend-field-value").forEach((el) => {
        let fieldName = el.getAttribute("name");
        let value = frame[flightLog.getMainFieldIndexByName(fieldName)];
        if (userSettings.legendUnits) {
          value = FlightLogFieldPresenter.decodeFieldToFriendly(
            flightLog,
            fieldName,
            value,
            currentFlightMode,
          );
        } else if (value % 1 !== 0) {
          value = value.toFixed(2);
        }

        el.textContent = value ?? "";
      });

      targetEl
        .querySelectorAll(".graph-legend-field-settings")
        .forEach((el) => {
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
    document.querySelectorAll(".log-graph-config").forEach((el) => {
      el.style.display = "";
    });
    document.querySelectorAll(".log-open-legend-dialog").forEach((el) => {
      el.style.display = "none";
    });

    if (onVisibilityChange) {
      onVisibilityChange(false);
    }
  };

  this.hide = function () {
    document.querySelectorAll(".log-graph-config").forEach((el) => {
      el.style.display = "none";
    });
    document.querySelectorAll(".log-open-legend-dialog").forEach((el) => {
      el.style.display = "inline-block";
    });

    if (onVisibilityChange) {
      onVisibilityChange(true);
    }
  };

  config.addListener(buildLegend);

  buildLegend();
}
