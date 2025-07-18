export function ImportedCurves(curvesChanged) {
  const maxImportCount = 5;
  const _curvesData = [];
  const _that = this;
  this.minX = Number.MAX_VALUE;
  this.maxX = -Number.MAX_VALUE;
  this.minY = Number.MAX_VALUE;
  this.maxY = -Number.MAX_VALUE;

  this.curvesCount = function() {
    return _curvesData.length;
  };

  this.getCurve = function(index) {
    if (index < _curvesData.length) {
      return _curvesData[index];
    } else {
      throw "The imported curves index has exceeded maximal value";
    }
  };

  this.importCurvesFromCSV = function(files) {
    let importsLeft = maxImportCount - _curvesData.length;

    for (const file of files) {
      if (importsLeft-- == 0) {
        break;
      }
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const stringRows = e.target.result.split("\n");

          const header = stringRows[0].split(",");
          if (header.length != 2 || header[0].trim() != "x" || header[1].trim() != "y") {
            throw new SyntaxError("Wrong curves CSV data format");
          }

          stringRows.shift();
          //remove bad last row
          if (stringRows.at(-1) == "") {
            stringRows.pop();
          }

          const curvesData = stringRows.map( function(row) {
            const data = row.split(","),
                  x = parseFloat(data[0].trim()),
                  y = parseFloat(data[1].trim());
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
          _curvesData.push(curve);
          curvesChanged();
        } catch (e) {
          alert('Curves data import error: ' + e.message);
          return;
        }
      };

      reader.readAsText(file);
    }
  };

  this.addCurve = function(points, name) {
    if (this.curvesCount() < maxImportCount) {
      _curvesData.push({
        name: name,
        points: points,
      });
      for (const point of points) {
        this.minX = Math.min(point.x, _that.minX);
        this.maxX = Math.max(point.x, _that.maxX);
        this.minY = Math.min(point.y, _that.minY);
        this.maxY = Math.max(point.y, _that.maxY);
      }
      curvesChanged();
    }
  };

  this.isNewCurve = function(name) {
    for (const curve of _curvesData) {
      if (curve.name == name) {
        return false;
      }
    }
    return true;
  };

  this.removeCurves = function() {
    _curvesData.length = 0;
    this.minX = Number.MAX_VALUE;
    this.maxX = -Number.MAX_VALUE;
    this.minY = Number.MAX_VALUE;
    this.maxY = -Number.MAX_VALUE;
    curvesChanged();
  };
}
