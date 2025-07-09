export function ImportedCurves(curvesChanged) {
  const maxImportCount = 5;
  this._curvesData = [];
  let _that = this;
  this.minX = Number.MAX_VALUE;
  this.maxX = -Number.MAX_VALUE;
  this.minY = Number.MAX_VALUE;
  this.maxY = -Number.MAX_VALUE;
  
  this.curvesCount = function() {
    return this._curvesData.length;
  };

  this.importCurvesFromCSV = function(files) {
      let importsLeft = maxImportCount - this._curvesData.length;

      for (const file of files) {
        if (importsLeft-- == 0) {
          break;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const stringRows = e.target.result.split("\n");

            const header = stringRows[0].split(",");
            if (header.length != 2 || header[0] != "x" || header[1] != "y") {
              throw new SyntaxError("Wrong curves CSV data format");
            }

            stringRows.shift();
            //remove bad last row
            if (stringRows.at(-1) == "") {
              stringRows.pop();
            }

            const curvesData = stringRows.map( function(row) {
              const data = row.split(","),
                    x = parseFloat(data[0]),
                    y = parseFloat(data[1]);
              _that.minX = Math.min(x, _that.minX);
              _that.maxX = Math.max(x, _that.maxX);
              _that.minY = Math.min(y, _that.minY);
              _that.maxY = Math.max(y, _that.maxY);
              return {
                x: x,
                y: y,
              };
            });

            const curve = {
              name: file.name.split('.')[0],
              points: curvesData,
            };
            _that._curvesData.push(curve);
            curvesChanged();
          } catch (e) {
            alert('Curves data import error: ' + e.message);
            return;
          }
        };

        reader.readAsText(file);
      }
    };

  this.removeCurves = function() {
    this._curvesData.length = 0;
    this.minX = Number.MAX_VALUE;
    this.maxX = -Number.MAX_VALUE;
    this.minY = Number.MAX_VALUE;
    this.maxY = -Number.MAX_VALUE;
    curvesChanged();
  };
}