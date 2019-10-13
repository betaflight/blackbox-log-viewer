"use strict";

function WorkspaceSelection(targetElem, workspaces, onSelectionChange, onSaveWorkspace, onNewGraphConfig) {
    var
        numberSpan = null,
        titleSpan = null,
        buttonElem = null,
        menuElem = null,
        workspaces = [],
        activeId = 1

    function buildUI() {
        numberSpan = $('<span class="index">');
        titleSpan = $('<span class="title">');

        buttonElem = $('<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" id="workspace-menu"></button>');
        var caretElem = $('<span class="caret"></span>')
        menuElem = $('<ul class="dropdown-menu pull-right" role="menu" aria-labelledby="workspace-menu"></ul>');

        var editButton = $('<span class="glyphicon glyphicon-pencil" aria-hidden="true" data-toggle="tooltip" title="Edit Workspace Name"></span>');
        editButton.click(editTitle);
        editButton.tooltip({ trigger: "hover", placement: "auto bottom" });

        targetElem.empty();
        targetElem.addClass("dropdown")
        targetElem.append(buttonElem);
        targetElem.append(menuElem);
        buttonElem.append(numberSpan);
        buttonElem.append(titleSpan);
        buttonElem.append(editButton);
        buttonElem.append(caretElem);

        buttonElem.dropdown(); // initialise menus
    }

    function editTitle(e) {
        buttonElem.dropdown("toggle"); // Hack to undrop
        var inputElem = $('<input type="text" onkeyup="event.preventDefault()">');
        inputElem.click((e) => e.stopPropagation()); // Stop click from closing
        titleSpan.replaceWith(inputElem);
        inputElem.val(workspaces[activeId].title)
        inputElem.focus();
        inputElem.on('focusout', () => {
            inputElem.replaceWith(titleSpan);
            onSaveWorkspace(activeId, inputElem.val())
        });

        e.preventDefault();
    }

    function update() {
        menuElem.empty();
        // Sort for non-programmers with 1-9 and then 0 last. 
        for (let index = 1; index < 11; index++) {
            let id = index % 10
            let element = workspaces[id % 10];

            var item = $('<li></li>');
            var link = $('<a href="#"></a>')

            if (!element) {
                // item.addClass("disabled");
            }

            var number = $('<span class="index">').text(id);
            var title = $('<span class="title">')

            if (!element) {
                title.text("<empty>");
            }
            else {
                title.text(element.title);
            }

            link.click((e) => {
                if (element) {
                    buttonElem.dropdown("toggle");
                    onSelectionChange(workspaces, id);
                    onNewGraphConfig(element.graphConfig)
                    e.preventDefault();
                }
            });

            var actionButtons = $('<span class="pull-right workspace-menu-item-actions"></span>');

            var saveButton = $('<span class="glyphicon glyphicon-floppy-disk" aria-hidden="true" data-toggle="tooltip" title="Save current graph setup to this Workspace"></span>');
            saveButton.click((e) => {
                if (!element) {
                    onSaveWorkspace(id, "Unnamed");
                }
                else {
                    onSaveWorkspace(id, element.title);
                }
                e.preventDefault();
            });

            // saveButton.tooltip({ trigger: "hover", placement: "auto bottom" });

            item.append(link);
            link.append(number);
            link.append(title);
            link.append(actionButtons);
            actionButtons.append(saveButton);
            item.toggleClass("active", id == activeId)
            menuElem.append(item);
        }

        if (workspaces[activeId]) {
            numberSpan.text(activeId);
            titleSpan.text(workspaces[activeId].title);
        }
        else {
            titleSpan.text("");
        }
    }

    this.setWorkspaces = function (newWorkspaces) {
        workspaces = newWorkspaces;
        update();
    }

    this.setActiveWorkspace = function (newId) {
        activeId = newId;
        update();
    }
    //TODO Should listen to workspace changes
    // config.addListener(buildUI);

    buildUI();
}