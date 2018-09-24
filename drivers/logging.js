/*
* logging.js by Aaron Becker
* Script to manage logging data from node
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const fs = require('fs');

var loggingUtilities = {
    logFunctionOriginal: undefined,
    secondaryLogFunctionOriginal: undefined,
    infoFunctionOriginal: undefined,
    warnFunctionOriginal: undefined,
    errorFunctionOriginal: undefined,
    logDirectory: undefined,
    maxKeptFiles: 5,

    init: function(cwd, extSettings) {
        return new Promise((resolve, reject) => {
            if (typeof extSettings == "undefined" || typeof cwd == "undefined") {
                return reject("Settings or CWD undefined on init");
            } else {
                if (typeof extSettings.logDirectory == "undefined" || extSettings.maxKeptFiles == "undefined") {
                    return reject("LogDirectory or maxKeptFiles undefined in settings");
                } else {
                    loggingUtilities.logDirectory = extSettings.logDirectory;
                    loggingUtilities.maxKeptFiles = Number(extSettings.maxKeptFiles);

                    let logPath = cwd+"/"+extSettings.logDirectory;
                    fs.stat(logPath, (err, stats) => {
                        if (err) {
                            console.log("Logging directory is missing, creating a new one")
                            fs.mkdir(logPath, err => {
                                if (err) {
                                    return reject("Error creating logfile directory: "+err);
                                } else {
                                    return resolve();
                                }
                            });
                        } else { //it exists
                            console.log("Logging directory exists; checking if there are more logfiles than there should be...");
                            loggingUtilities.checkMaxLog();
                            return resolve();
                        }
                    })
                }
            }
        })
    },

    checkMaxLog: function() {

    },

    log: function(logFn) {
        
    }
}

module.exports = loggingUtilities;