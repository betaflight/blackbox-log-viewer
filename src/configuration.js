/**
 * Configuration
 *
 * Handle loading and display of configuration file
 *
 */

export function Configuration(file, configurationDefaults, showConfigFile) {
  let fileData;
  let fileLinesArray;

  function renderFileContentList(configurationList, filter) {
    // Clear existing items
    configurationList.querySelectorAll("li").forEach((li) => li.remove());

    for (let i = 0; i < fileLinesArray.length; i++) {
      if (!filter || filter.length < 1) {
        const li = document.createElement("li");
        li.className = "configuration-row";
        if (fileLinesArray[i].length == 0) {
          li.style.backgroundColor = "white";
          li.style.height = "10px";
          li.innerHTML = "&nbsp";
        } else {
          li.textContent = fileLinesArray[i];
        }
        configurationList.appendChild(li);
      } else {
        try {
          let regFilter = new RegExp(`(.*)(${filter})(.*)`, "i");
          let highLight = fileLinesArray[i].match(regFilter);
          if (highLight != null) {
            const li = document.createElement("li");
            li.className = "configuration-row";
            li.innerHTML = `${highLight[1]}<b>${highLight[2]}</b>${highLight[3]}`;
            configurationList.appendChild(li);
          }
        } catch (e) {
          continue;
        }
      }
    }
  }

  function renderFileContents() {
    const existingElem = document.querySelector(".configuration-file");
    if (!existingElem) return;

    const configurationDiv = document.createElement("div");
    configurationDiv.className = "configuration-file";
    configurationDiv.innerHTML =
      `<div class="configuration-header">` +
      `<h4>${file.name}<span class="configuration-close" style="cursor:pointer;margin-left:8px"><span class="i-lucide-x w-4 h-4 inline-block align-middle"></span></span></h4>` +
      `<input type="text" class="form-control configuration-filter" placeholder="Enter filter" size="5"/>` +
      `</div>` +
      `<div><ul class="list-unstyled configuration-list"></ul></div>`;

    existingElem.replaceWith(configurationDiv);

    const configurationList = configurationDiv.querySelector(".configuration-list");
    renderFileContentList(configurationList, null);

    const statusBarFileName = document.querySelector("#status-bar .configuration-file-name");
    if (statusBarFileName) statusBarFileName.textContent = file.name;

    configurationDiv.querySelector(".configuration-close")?.addEventListener("click", function () {
      if (showConfigFile) showConfigFile(false);
    });
  }

  function loadFile(file) {
    let reader = new FileReader();
    fileData = file;

    reader.onload = function (e) {
      let data = e.target.result;
      fileLinesArray = data.split("\n");

      renderFileContents();

      const filterInput = document.querySelector(".configuration-filter");
      if (filterInput) {
        filterInput.addEventListener("keyup", function () {
          const newFilter = filterInput.value;
          const configurationList = document.querySelector(".configuration-list");
          renderFileContentList(configurationList, newFilter);
        });
      }
    };

    reader.readAsText(file);
  }

  this.getFile = function () {
    return fileData;
  };

  loadFile(file);
}

export function ConfigurationDefaults(prefs) {
  // Special configuration file that handles default values only

  // Private Variables
  let that = this; // generic pointer back to this function
  let fileData; // configuration file information
  let fileLinesArray = null; // Store the contents of the file globally

  function loadFileFromCache() {
    // Get the file from the cache if it exists
    prefs.get("configurationDefaults", function (item) {
      if (item) {
        fileLinesArray = item;
      } else {
        fileLinesArray = null;
      }
    });
  }

  this.loadFile = function (file) {
    let reader = new FileReader();
    fileData = file; // Store the data locally;

    reader.onload = function (e) {
      let data = e.target.result; // all the data
      fileLinesArray = data.split("\n"); // separated into lines

      prefs.set("configurationDefaults", fileLinesArray); // and store it to the cache
    };

    reader.readAsText(file);
  };

  // Public variables and functions
  this.getFile = function () {
    return fileData;
  };

  this.getLines = function () {
    return fileLinesArray;
  };

  this.hasDefaults = function () {
    return fileLinesArray != null; // is there a default file array
  };

  this.isDefault = function (line) {
    // Returns the default line equivalent

    if (!fileLinesArray) return true; // by default, lines are the same if there is no default file loaded

    for (let i = 0; i < fileLinesArray.length; i++) {
      if (line != fileLinesArray[i]) continue; // not the same line, keep looking
      return true; // line is same as default
    }
    return false; // line not the same as default or not found
  };

  loadFileFromCache(); // configuration file loaded
}
