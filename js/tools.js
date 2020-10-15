"use strict";

//Convert a hexadecimal string (that represents a binary 32-bit float) into a float
function hexToFloat(string) {
    var arr = new Uint32Array(1);
    arr[0] = parseInt(string, 16);
    
    var floatArr = new Float32Array(arr.buffer);
    
    return floatArr[0]; 
}

function uint32ToFloat(value) {
    var arr = new Uint32Array(1);
    arr[0] = value;
    
    var floatArr = new Float32Array(arr.buffer);

    return floatArr[0]; 
}

function asciiArrayToString(arr) {
    return String.fromCharCode.apply(null, arr);
}

function asciiStringToByteArray(s) {
    var bytes = [];
    
    for (var i = 0; i < s.length; i++)
        bytes.push(s.charCodeAt(i));
    
    return bytes;
}

function signExtend24Bit(u) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (u & 0x800000) ? (u | 0xFF000000) : u;
}

function signExtend16Bit(word) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (word & 0x8000) ? (word | 0xFFFF0000) : word;
}

function signExtend14Bit(word) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (word & 0x2000) ? (word | 0xFFFFC000) : word;
}

function signExtend8Bit(byte) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (byte & 0x80) ? (byte | 0xFFFFFF00) : byte;
}

function signExtend7Bit(byte) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (byte & 0x40) ? (byte | 0xFFFFFF80) : byte;
}

function signExtend6Bit(byte) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (byte & 0x20) ? (byte | 0xFFFFFFC0) : byte;
}

function signExtend5Bit(byte) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (byte & 0x10) ? (byte | 0xFFFFFFE0) : byte;
}

function signExtend4Bit(nibble) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (nibble & 0x08) ? (nibble | 0xFFFFFFF0) : nibble;
}

function signExtend2Bit(byte) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (byte & 0x02) ? (byte | 0xFFFFFFFC) : byte;
}

/**
 * Get the first index of needle in haystack, or -1 if it was not found. Needle and haystack
 * are both byte arrays.
 * 
 * Provide startIndex in order to specify the first index to search from
 * @param haystack
 * @param needle
 * @returns {Number}
 */
function memmem(haystack, needle, startIndex) {
    var i, j, found;
    
    for (var i = startIndex ? startIndex : 0; i <= haystack.length - needle.length; i++) {
        if (haystack[i] == needle[0]) {
            for (var j = 1; j < needle.length && haystack[i + j] == needle[j]; j++)
                ;
        
            if (j == needle.length)
                return i;
        }
    }
    
    return -1;
}

function stringHasComma(string) {
    /***
     * Checks if the string contains at least one comma.
     *
     * string               is the string to check
     *
     * returns              true if at least one comma is found.
     *                      false if no comma is found.
     ***/
    return string.match(/.*,.*/) != null;
}

function parseCommaSeparatedString(string, length) {
    /***
     * Parse a comma separated string for individual values.
     *
     * string               is the comma separated string to parse
     * length (optional)    the returned array will be forced to be this long; extra fields will be discarded,
     *                      missing fields will be padded. if length is not specified, then array will be auto
     *                      sized.
     *
     * returns              if the string does not contain a comma, then the first integer/float/string is returned
     *                      else an Array is returned containing all the values up to the length (if specified)
     ***/
    var
        parts = string.split(","),
        result, value;

    length = length || parts.length; // we can force a length if we like

    if (length < 2) {
        // this is not actually a list, just return the value
        value = (parts.indexOf('.'))?parseFloat(parts):parseInt(parts, 10);
        return (isNaN(value) ? string : value);
    } else {
        // this really is a list; build an array
        result = new Array(length);
        for (var i = 0; i < length; i++) {
            if(i<parts.length) {
                value = (parts[i].indexOf('.'))?parseFloat(parts[i]):parseInt(parts[i], 10);
                result[i] = isNaN(value) ? parts[i] : value;
            } else {
                result[i] = null;
            }
        }
        return result;
    }
}

/**
 * Browser Zoom Facilities
**/
var zoomLevels = [
        0.25, 0.33, 0.50, 0.67, 0.75, 0.80, 0.90, 1.00, 1.10, 1.25, 1.50, 1.75, 2.00, 2.50, 3.00, 4.00, 5.00
    ];

function zoomIn() {
    var currentZoom = document.body.style.zoom || 1.0; //parseInt(documentElem.css("zoom"));
    for(var i=0; i<zoomLevels.length; i++) {
        if(zoomLevels[i] > currentZoom) {
            document.body.style.zoom = zoomLevels[i];
            return;
        }
    }
}

function zoomOut() {
    var currentZoom = document.body.style.zoom || 1.0; //parseInt(documentElem.css("zoom"));
    for(var i=zoomLevels.length-1; i>0; i--) {
        if(zoomLevels[i] < currentZoom) {
            document.body.style.zoom = zoomLevels[i];
            return;
        }
    }
}

/**
 * Find the index of `item` in `list`, or if `item` is not contained in `list` then return the index
 * of the next-smaller element (or 0 if `item` is smaller than all values in `list`).
 **/
function binarySearchOrPrevious(list, item) {
    var
        min = 0,
        max = list.length,
        mid, 
        result = 0;
    
    while (min < max) {
        mid = Math.floor((min + max) / 2);
        
        if (list[mid] === item)
            return mid;
        else if (list[mid] < item) {
            // This might be the largest element smaller than item, but we have to continue the search right to find out
            result = mid;
            min = mid + 1;
        } else
            max = mid;
    }
    
    return result;
}

/**
 * Find the index of `item` in `list`, or if `item` is not contained in `list` then return the index
 * of the next-larger element (or the index of the last item if `item` is larger than all values in `list`).
 */
function binarySearchOrNext(list, item) {
    var
        min = 0,
        max = list.length,
        mid, 
        result = list.length - 1;
    
    while (min < max) {
        mid = Math.floor((min + max) / 2);
        
        if (list[mid] === item)
            return mid;
        else if (list[mid] > item) {
            // This might be the smallest element larger than item, but we have to continue the search left to find out
            max = mid;
            result = mid;
        } else
            min = mid + 1;
    }
    
    return result;
}

function leftPad(string, pad, minLength) {
    string = "" + string;
    
    while (string.length < minLength)
        string = pad + string;
    
    return string;
}

function formatTime(msec, displayMsec) {
// modify function to allow negative times.
    var
        ms, secs, mins, hours;
    
    ms = Math.round(Math.abs(msec));
    
    secs = Math.floor(ms / 1000);
    ms %= 1000;

    mins = Math.floor(secs / 60);
    secs %= 60;

    hours = Math.floor(mins / 60);  
    mins %= 60;
    
    return ((msec<0)?'-':'') + (hours ? leftPad(hours, "0", 2) + ":" : "") + leftPad(mins, "0", 2) + ":" + leftPad(secs, "0", 2)
        + (displayMsec ? "." + leftPad(ms, "0", 3) : "");
}

function stringLoopTime(loopTime, pid_process_denom, unsynced_fast_pwm, motor_pwm_rate) {
    var returnString = '';
    if(loopTime!=null) {
        returnString = (loopTime +'\u03BCS (' + parseFloat((1000/loopTime).toFixed(3)) + 'kHz');
        if(pid_process_denom!=null) {
            returnString += "/" + (parseFloat((1000/(loopTime*pid_process_denom)).toFixed(3)) +'kHz');
            if(unsynced_fast_pwm!=null) {
                returnString += (unsynced_fast_pwm==0)?('/SYNCED') : ( (motor_pwm_rate!=null)?('/' + parseFloat((motor_pwm_rate/1000).toFixed(3)) + "kHz"):('UNSYNCED') ); 
            }
        }
    returnString += ')';
    }
    return returnString;
}

function stringTimetoMsec(input) {
    try {
            var matches = input.match(/([-])?([0-9]+)(\D)*([0-9]+)*\D*([0-9]+)*/);

            if(matches.length>2) { // there is a placeholder - either : or .
                if(matches[3] == ':'){ // time has been entered MM:SS.SSS
                   return ((matches[1])?-1:1) * (matches[2] * 60 * 1000000 + ((matches[4])?matches[4]:0) * 1000000 + ((matches[5])?(matches[5] + "00").slice(0,3):0) * 1000); 
                } else {
                   return ((matches[1])?-1:1) * (matches[2] * 1000000 + ((matches[4])?(matches[4] + "00").slice(0,3):0) * 1000);
                }
            } else return ((matches[1])?-1:1) * (matches[2] * 1000000);
        } catch(e) {
            return 0;
        }
}

function constrain(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function validate(value, defaultValue) {
    return (value!=null)?value:defaultValue;
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke == 'undefined') {
      stroke = true;
    }
    if (typeof radius === 'undefined') {
      radius = 5;
    }
    if (typeof radius === 'number') {
      radius = {tl: radius, tr: radius, br: radius, bl: radius};
    } else {
      var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
      for (var side in defaultRadius) {
        radius[side] = radius[side] || defaultRadius[side];
      }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) {
      ctx.fill();
    }
    if (stroke) {
      ctx.stroke();
    }
  }

var mouseNotification = {
    enabled: true,
    elem: $('.mouseNotification'),
    timeout: null,
    show: function(target, x, y, message, delay, messageClass, align, margin) {

        /**
         target 			is the target element that triggered the mouse notification
         x,y				are the mouse coordinates (if required)
         message 		is the text to display (supports html endcoding)
         delay 			is how long the message will remain before auto clearing
         messageClass 	is the css class that should be used to draw the box, null for default
         align 			is the position to put the popup to, null means at the mouse position, 'top-left' etc,
         margin 			is the margin from the mouse cursor or border, null for default 10px

         the index.html should have an entry <div class="mouseNotification"></div>
         and the .css should have two definitions...

         .mouseNotification {
                position: absolute;
                margin 0 auto;
                white-space: pre-wrap;
            }

         .mouseNotification-box {
                padding: 4px;
                color: black;
                background-color: #EAEAEA;
                border: 2px solid white;
                border-radius: 3px;
            }

         **/

        if (!this.enabled) return false;

        this.elem = this.elem || $('.mouseNotification');

        messageClass = messageClass || 'mouseNotification-box';
        margin = margin || 10;

        var mouseNotificationElem = $('#mouse-notification');
        if (mouseNotificationElem.length != 0) {
            clearTimeout(this.timeout);
            mouseNotificationElem.replaceWith('<div class="' + messageClass + '" id="mouse-notification">' + message  + "</div>");
        } else {
            this.elem.append('<div class="' + messageClass + '" id="mouse-notification">' + message + "</div>");
        }
        this.timeout = setTimeout(function() {
            $('#mouse-notification').remove();
        }, (delay || 1000));

        var popupRect  = $(this.elem).get(0).getBoundingClientRect(); // get the popup metrics
        var targetRect = $(target).get(0).getBoundingClientRect();

        var left = 0, top = 0;

        // reposition the notification;
        if (align != null) { // default is at the mouse position
            if (align.indexOf('right') !== -1) {
                left = targetRect.width - (popupRect.width + margin);
            } else if (align.indexOf('center') !== -1) {
                left = targetRect.width / 2 - (popupRect.width + margin) / 2;
            } else { // default left
                left = margin;
            }
            if (align.indexOf('bottom') !== -1) {
                top = targetRect.height - (popupRect.height + margin);
            } else if (align.indexOf('middle') !== -1) {
                top = targetRect.height / 2 - (popupRect.height + margin) / 2;
            } else { // default top
                top = margin;
            }
            this.elem.css('left', left);
            this.elem.css('top', top);

        } else { // default is at the mouse position
            this.elem.css('left', (x || 0) - targetRect.left  + margin);
            this.elem.css('top', (y || 0) - targetRect.top  + margin);
        }

        // now re-position the box if it goes out of the target element
        popupRect = $(this.elem).get(0).getBoundingClientRect(); // now get them again now that we have positioned it.
        if (popupRect.right > (targetRect.right - margin)) {
            this.elem.css('left', targetRect.right - popupRect.width - margin);
        }
        /* // disable the overflow to the bottom as single elements will overflow.
         if (popupRect.bottom > (targetRect.bottom - margin)) {
         this.elem.css('top', targetRect.bottom - popupRect.height - margin);
         }
         */

        return true;
    }
};

function firmwareGreaterOrEqual(sysConfig, bf_version, cf_version) {
    /***
     * Check if firmware version is higher or equal to requested version
     *
     * sysConfig            System config structure
     * bf_version           Betaflight version to check, e.g. '3.1.0' (string)
     * cf_version           Cleanflight version to check, e.g. '2.3.0' (optional, string)
     *
     * returns              True when firmware version is higher or equal to requested version
     *                      False when firmware version is lower than the requested version
     ***/
    if (cf_version === undefined) {
        return (sysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT && semver.gte(sysConfig.firmwareVersion, bf_version));
    } else {
        return (sysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(sysConfig.firmwareVersion, bf_version)) || 
               (sysConfig.firmwareType == FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(sysConfig.firmwareVersion, cf_version));
    }
}

function getManifestVersion(manifest) {
    try {
        if (!manifest) {
            manifest = chrome.runtime.getManifest();
        }

        var version = manifest.version_name;
        if (!version) {
            version = manifest.version;
        }

        return version;

    } catch (error) {
        console.log("manifest does not exist, probably not running nw.js");
        return "-"
    }
}
