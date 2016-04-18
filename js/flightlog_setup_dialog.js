"use strict";

function FlightLogSetupDialog(dialog, onSave) {
    
    function renderParameter(parameter) {
        var 
            elem = $(
                '<li class="setup-parameter">'
                    + '<label class="col-sm-2 control-label">' + parameter.label + '</label>'
                    + '<input class="form-control" type="text" placeholder="Enter the value">'
                + '</li>'
            );
        
            $("input", elem).val(parameter.value);
        
        return elem;
    }
    
    function renderParameters(setting) {
        var 
            parametersElem = $(
                '<li class="setup-parameters">'
                    + '<dl>'
                        + '<dt><h4>' + setting.label + '</dt>'
                        + '<dd>'
                            + '<div class="form-horizontal">'
                                + '<div class="form-group form-group-sm">'
                                        + '<ul class="setup-parameter-list form-inline list-unstyled"></ul>'
                                + '</div>'
                            + '</div>'
                        + '</dd>'
                    + '</dl>'
                + '</li>'
            ),
            parameterList = $(".setup-parameter-list", parametersElem);
            
        for (var i = 0; i < setting.parameters.length; i++) {
            var 
                parameter = setting.parameters[i],
                parameterElem = renderParameter(parameter);
            
            parameterList.append(parameterElem);
        }
        
        return parametersElem;
    }
    
    function renderSettings(flightLog) {
        var
            settingsList = $(".setup-flightlog-list", dialog);
        
        settingsList.empty();
                
        for (var i = 0; i < flightLog.settings.length; i++) {
            settingsList.append(renderParameters(flightLog.settings[i]));
        }
    }
        
    function convertUIToFlightLogSettings() {
        var 
            settings = [],
            setting,
            parameter;
        
        $(".setup-parameters", dialog).each(function() {
            setting = {
               label: '', 
               parameters: []
            };
           
            setting.label = $("h4", this).text();
            
            $(".setup-parameter", this).each(function() {
                parameter = {
                    label: $("label", this).text(),
                    value: parseInt($("input[type='text']", this).val()),
                };
                setting.parameters.push(parameter);
            });
            
            settings.push(setting);
        });
        
        return settings;
    }
    
    this.show = function(flightLog, settings) {
        dialog.modal('show');

        // Assign the settings
        flightLog.settings = settings;

        renderSettings(flightLog);
    };
 
    $(".flightlog-setup-dialog-save").click(function(e) {
        onSave(convertUIToFlightLogSettings());
    });
    

}