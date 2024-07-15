import ctzsnoozeWorkspace from "./ws_ctzsnooze.json";
import supaflyWorkspace from "./ws_supafly.json";
export function WorkspaceMenu(menuElem, onSwitchWorkspace) {
  const workspace_menu = menuElem;

  function hideMenu() {
    workspace_menu.removeClass("show");
    workspace_menu.empty();
  }

  function showMenu() {
    workspace_menu.addClass("show");
  }

  this.show = function () {
    let elem = $('<div class="titleDiv bottomBorder">SELECT WORKSPACE:</div>');
    workspace_menu.append(elem);
    elem = $("<div>Ctzsnooze</div>");
    elem.click(1, ApplyWorkspace);
    workspace_menu.append(elem);
    elem = $("<div>SupaflyFPV</div>");
    elem.click(2, ApplyWorkspace);
    workspace_menu.append(elem);
    elem = $('<div class="menu-button topBorder">Close</div>');
    elem.click(ApplyWorkspace);
    workspace_menu.append(elem);
    showMenu();
  };

  function ApplyWorkspace(e) {
    switch (e.data) {
      case 1:
        onSwitchWorkspace(ctzsnoozeWorkspace, 1);
        break;
      case 2:
        onSwitchWorkspace(supaflyWorkspace, 1);
        break;
    }
    hideMenu();
  }

  $(document).keydown(function (e) {
    if (e.which === 27 && workspace_menu.length > 0) {
      e.preventDefault();
      hideMenu();
    }
  });

  this.getDefaultWorkspace = function () {
    return ctzsnoozeWorkspace;
  };
}
