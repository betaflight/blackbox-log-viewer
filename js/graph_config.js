"use strict";

function GraphConfig(graphConfig) {
    var
        graphs = graphConfig ? graphConfig : [],
        listeners = [];
    
    function notifyListeners() {
        for (var i = 0; i < listeners.length; i++) {
            listeners[i](this);
        }
    }
    
    this.getGraphs = function() {
        return graphs;
    };
    
    this.setGraphs = function(newGraphs) {
        graphs = newGraphs;
        notifyListeners();
    };
    
    this.addListener = function(listener) {
        listeners.push(listener);
    };
}

GraphConfig.PALETTE = [
    "#fb8072", // Red
    "#8dd3c7", // Cyan
    "#ffffb3", // Yellow
    "#bebada", // Purple
    "#80b1d3",
    "#fdb462",
    "#b3de69",
    "#fccde5",
    "#d9d9d9",
    "#bc80bd",
    "#ccebc5",
    "#ffed6f"
];