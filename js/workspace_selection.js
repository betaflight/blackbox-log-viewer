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
        titleSpan = $('<span>');

        buttonElem = $('<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" id="workspace-menu"><span class="caret"></span></button>');

        menuElem = $('<ul class="dropdown-menu pull-right" role="menu" aria-labelledby="workspace-menu"></ul>');

        targetElem.empty();
        targetElem.addClass("dropdown")
        targetElem.append(buttonElem);
        targetElem.append(menuElem);
        buttonElem.prepend(titleSpan);
        buttonElem.prepend(numberSpan);

        buttonElem.dropdown(); // initialise menus
    }

    function update() {
        menuElem.empty();

        workspaces.forEach((element, id) => {
            var item = $('<li></li>');
            var link = $('<a href="#"></a>')
            var number = $('<span class="index">').text(id);
            var title = $('<span>').text(element.title);
            link.click((e) => {
                buttonElem.dropdown("toggle");
                onSelectionChange(workspaces, id); 
                onNewGraphConfig(element.graphConfig)
                e.preventDefault();
            });

            var actionButtons = $('<span class="pull-right workspace-menu-item-actions"></span>');
            var editButton = $('<span class="glyphicon glyphicon-pencil" aria-hidden="true"></span>');
            editButton.click((e) => {
                var inputElem = $("<input type='text'>")
                link.replaceWith(inputElem);
                inputElem.val(element.title)
                inputElem.focus();
                inputElem.on('focusout', () => {
                    element.title = inputElem.val()
                    update();
                });

                e.preventDefault();
            });

            var saveButton = $('<span class="glyphicon glyphicon-floppy-disk" aria-hidden="true"></span>');
            saveButton.click((e) => {
                onSaveWorkspace(id, element.title);
                e.preventDefault();
            });

            item.append(link);
            link.append(number);
            link.append(title);
            link.append(actionButtons);
            actionButtons.append(editButton);
            actionButtons.append(saveButton);
            item.toggleClass("active", id == activeId)
            menuElem.append(item);
        });

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