/*
* utils.js by Aaron Becker
* Utilities for the main server, including a socket handler, and a user database
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
}

var advancedEventListener = function(object,evt) {
    if (typeof object === "undefined") {
        console.error("[NODE_UTILS] Socket undefined in initialization");
        return "error";
    }
    if (typeof evt === "undefined") {
        console.error("[NODE_UTILS] Evt undefined in initialization");
        return "error";
    }
    this.listeners = [];
    var _this = this;
    this.recvData = function(data) {
        var dat = JSON.stringify(data);
        //console.log("recvdata event data: "+((dat.length > 100)?"'data too long to show'":dat)+", list "+JSON.stringify(_this.listeners))
        var nonpersist = [];
        for (var i=0; i<_this.listeners.length; i++) {
            if (_this.listeners[i][0] == data.action || _this.listeners[i][3]) {
                try {
                    if (_this.listeners[i][2] == false || _this.listeners[i][2] == "false") { //non persistent listener
                        nonpersist.push(i); //push it to nonpersist list to remove it later
                    }
                    _this.listeners[i][1](data); //run function
                } catch(e) {
                    console.error("[UTILS] Error running function in listenerRecieve, e: "+e);
                }
            }
        }
        //console.log("nonpersist: "+JSON.stringify(nonpersist))
        for (var i=0; i<nonpersist.length; i++) {
            _this.listeners.splice(nonpersist[i],1);
        }
    }
    this.addListener = function(ev,fn) {
        if (typeof ev !== "string") {
            console.error("[UTILS] AddListener ev type not string");
        } else if (typeof fn !== "function") {
            console.error("[UTILS] AddListener fn type not function");
        } else {
            var ignoreAction = false;
            if (ev == "*") {
                ignoreAction = true;
            }
            this.listeners[this.listeners.length] = [ev,fn,false,ignoreAction];
        }
    }
    this.addPersistentListener = function(ev,fn) {
        if (typeof ev !== "string") {
            console.error("[UTILS] AddListener ev type not string");
        } else if (typeof fn !== "function") {
            console.error("[UTILS] AddListener fn type not function");
        } else {
            var ignoreAction = false;
            if (ev == "*") {
                ignoreAction = true;
            }
            this.listeners[this.listeners.length] = [ev,fn,true,ignoreAction];
        }
    }
    try {
        object.addEventListener(evt,this.recvData); //set up listener on object
    } catch(e) {
        console.warn("[NODE_UTILS] AddEventListener failed, trying addListener");
        try {
            object.addListener(evt,this.recvData);
        } catch(e) {
            console.error("[NODE_UTILS] Failed to create the event");
        }
    }
}

function atob_poly(a) {
    return new Buffer(a, 'base64').toString('binary');
};
function btoa_poly(b) {
    return new Buffer(b).toString('base64');
};

function formatHHMMSS(seconds){
  function pad(s){
    return (s < 10 ? '0' : '') + s;
  }
  var hours = Math.floor(seconds / (60*60));
  var minutes = Math.floor(seconds % (60*60) / 60);
  var seconds = Math.floor(seconds % 60);

  return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

var windowPlugin = require('window-size');
var singleLineLog = require('single-line-log').stdout; //single line logging for progressBar
var colors = require('colors');
function progressBar(options) {
    var windowSize = windowPlugin.get();
    
    if (typeof options != "object") {
        options = {
            startPercent: 0,
            task: "Doing a task: ",
            showETA: false
        }
    } else {
        if (typeof options.startPercent == "undefined") {
            options.startPercent = 0;
        }
        if (typeof options.task == "undefined") {
            options.task = "Doing a task: ";
        } else {
            options.task = options.task+": ";
        }
        if (typeof options.showETA !== "boolean") {
            options.showETA = false;
        }
    }
    if (options.task.length+9 > windowSize.width) {
        options.task = options.task.substring(0,windowSize.width-9);
    }

    this.update = (newPercent, eta) => {
        var windowSize = windowPlugin.get(); //inefficient but fine

        if (newPercent > 1) {
            newPercent = 1;
        }
        if (newPercent < 0) {
            newPercent = 0;
        }
        if (eta && options.showETA) {
            var chars = Math.round((windowSize.width-options.task.length-11-eta.length)*newPercent);
        } else {
            var chars = Math.round((windowSize.width-options.task.length-9)*newPercent);
        }
        
        var str = colors.yellow(options.task)+colors.blue("[");
        var hashStr = "";
        for (var i=0; i<chars; i++) {
            //hashStr+="█";
            hashStr+="#";
        }
        str+=colors.grey(hashStr);
        if (eta && options.showETA) {
            str+=colors.blue("]> ")+colors.green(String(Math.round(newPercent*100)+"%, "+eta));
        } else {
            str+=colors.blue("]> ")+colors.green(String(Math.round(newPercent*100)+"%"));
        }
        singleLineLog(str);
    }

    this.update(options.startPercent);
}

/*module.exports = {
    generateUUID: generateUUID,
    authPool: authPool
};*/
exports.generateUUID = generateUUID;
exports.atob = atob_poly;
exports.btoa = btoa_poly;
exports.formatHHMMSS = formatHHMMSS;
exports.progressBar = progressBar;
exports.advancedEventListener = advancedEventListener;
