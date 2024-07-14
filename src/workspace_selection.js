const UNTITLED = "Untitled";

export function WorkspaceSelection(
  targetElem,
  workspaces,
  onSelectionChange,
  onSaveWorkspace
) {
  var numberSpan = null,
    titleSpan = null,
    buttonElem = null,
    menuElem = null,
    editButton = null,
    workspaces = [],
    activeId = 1;

  function buildUI() {
    buttonElem = $(
      '<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" id="workspace-menu"></button>'
    );
    numberSpan = $('<span class="workspace-selector-index">');
    titleSpan = $('<span class="workspace-selector-title">');
    let caretElem = $('<span class="caret"></span>');

    editButton = $(
      '<span class="glyphicon glyphicon-pencil workspace-selector-editButton" aria-hidden="true" data-toggle="tooltip" title="Edit Workspace Name"></span>'
    );
    editButton.click(editTitle);
    editButton.tooltip({ trigger: "hover", placement: "auto bottom" });

    menuElem = $(
      '<ul class="dropdown-menu pull-right" role="menu" aria-labelledby="workspace-menu"></ul>'
    );

    targetElem.empty();
    targetElem.addClass("dropdown");
    targetElem.append(buttonElem);
    targetElem.append(menuElem);
    buttonElem.append(numberSpan);
    buttonElem.append(titleSpan);
    buttonElem.append(editButton);
    buttonElem.append(caretElem);

    buttonElem.dropdown(); // initialise dropdown
  }

  function editTitle(e) {
    buttonElem.dropdown("toggle"); // Hack to undrop
    editButton.hide();
    let inputElem = $('<input type="text" onkeyup="event.preventDefault()">');
    inputElem.click((e) => e.stopPropagation()); // Stop click from closing
    titleSpan.replaceWith(inputElem);
    inputElem.val(workspaces[activeId]?.title);
    inputElem.focus();
    inputElem.on("focusout", () => {
      inputElem.replaceWith(titleSpan);
      editButton.show();
      onSaveWorkspace(activeId, inputElem.val());
    });

    e.preventDefault();
  }

  function update() {
    menuElem.empty();
    // Sort for non-programmers with 1-9 and then 0 last.
    for (let index = 1; index < 11; index++) {
      let id = index % 10;
      let element = workspaces[id % 10];

      let item = $("<li></li>");
      let link = $('<a href="#"></a>');

      if (!element) {
        // item.addClass("disabled");
      }

      let number = $('<span class="workspace-selector-index">').text(id);
      let title = $('<span class="workspace-selector-title">');

      if (!element) {
        title.text("<empty>");
        title.addClass("faded");
      } else {
        title.text(element.title);
      }

      link.click((e) => {
        if (element) {
          buttonElem.dropdown("toggle");
          onSelectionChange(workspaces, id);
          e.preventDefault();
        }
      });

      let actionButtons = $('<span class="pull-right"></span>');

      let saveButton = $(
        '<span class="glyphicon glyphicon-floppy-disk" aria-hidden="true" data-toggle="tooltip" title="Save current graph setup to this Workspace"></span>'
      );
      saveButton.click((e) => {
        if (!element) {
          onSaveWorkspace(id, UNTITLED);
        } else {
          onSaveWorkspace(id, element.title);
        }
        e.preventDefault();
      });

      saveButton.tooltip({ trigger: "hover", placement: "auto bottom" });

      item.append(link);
      link.append(number);
      link.append(title);
      link.append(actionButtons);
      actionButtons.append(saveButton);
      item.toggleClass("active", id == activeId);
      menuElem.append(item);
    }

    if (workspaces[activeId]) {
      numberSpan.text(activeId);
      titleSpan.text(workspaces[activeId].title);
    } else {
      titleSpan.text("");
    }
  }

  this.setWorkspaces = function (newWorkspaces) {
    workspaces = newWorkspaces;
    update();
  };

  this.setActiveWorkspace = function (newId) {
    activeId = newId;
    update();
  };

  buildUI();
}
