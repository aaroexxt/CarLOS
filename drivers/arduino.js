/*
* arduino.js by Aaron Becker
* Arduino driver to communicate with external arduino, using protocol and command buffering
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const serialPort = require('serialport'); //require serialport driver

var arduinoUtilities = {
    debugMode: true,
    arduinoCommandSplitChar: ";",
    arduinoCommandValueChar: "|",

    arduinoCommandBuffer: "",  //need buffer because might not recieve whole command in one recieve

    arduinoObject: undefined,
    extSettings: {},
    extInformation: {},

    sensorOverloaded: false,
    sensorUpdateListener: undefined,

    init: function(eRuntimeSettings, eRuntimeInformation, arduinoAddr) {
        return new Promise((resolve, reject) => {
            if (typeof eRuntimeSettings == "undefined") {
                return reject("[ARDUINO] runtimeSettings undefined on init");
            } else {
                arduinoUtilities.extSettings = eRuntimeSettings;
            }
            if (typeof eRuntimeInformation == "undefined") {
                return reject("[ARDUINO] runtimeInformation undefined on init");
            } else {
                arduinoUtilities.extInformation = eRuntimeInformation;
            }
            if (typeof arduinoAddr == "undefined") {
                console.warn("[ARDUINO] library init called without address specified, must be initialized seperately");
            } else {
                arduinoUtilities.connectArduino(arduinoAddr, eRuntimeSettings, eRuntimeInformation).catch( err => {
                    return reject("[ARDUINO] connection failed with err message: "+err);
                });
            }
            return resolve(); //if it wasn't rejected then it's ok
        });
    },

    connectArduino: function(arduinoAddr, extSettings, extInformation) { //start new arduino connection with
        return new Promise((resolve, reject) => {
            if (typeof extSettings == "undefined" || typeof extInformation == "undefined") {
                return reject("ExtSettings or ExtInformation undefined on arduino ConnectArduino")
            }
            try {
                arduinoUtilities.arduinoObject.close(); //attempt to close previous connection
            } catch(e){}
            arduinoUtilities.arduinoObject = new serialPort(arduinoAddr, {
                baudRate: extSettings.arduinoBaudRate,
                autoOpen: false //don't open it yet
            });
            arduinoUtilities.arduinoObject.open(function (err) { //and open the port
                if (err) { //arduino was connected in previous server iteration and was disconnected?
                    extInformation.arduinoConnected = false;
                    console.warn("[WARNING] Server running without valid arduino. Errors may occur. Once you have reconnected an arduino, you have to relaunch the start script (unless it is on the same port).");
                    arduinoUtilities.setArduinoFakeClass();
                    reject("Error opening serial port to arduino at "+arduinoAddr+" (err="+err+")");
                } else {
                    console.log("Arduino connected successfully");
                    extInformation.arduinoConnected = true;
                    arduinoUtilities.arduinoObject.on('readable', function(data) {
                        arduinoUtilities.handleArduinoData(arduinoUtilities.arduinoObject.read(), extSettings, extInformation).catch(e => {
                            console.error("[ARDUINO] HandleArduinoData failed with message: "+e);
                        }); //pass reference
                    });
                    resolve();
                }
            })
        });
    },

    handleArduinoData: function(data, extSettings, extInformation) {
        return new Promise( (resolve, reject) => {
            var sdata = String(data).split("");
            for (var i=0; i<sdata.length; i++) {
                if (sdata[i] == arduinoUtilities.arduinoCommandSplitChar) {
                    var split = arduinoUtilities.arduinoCommandBuffer.split(arduinoUtilities.arduinoCommandValueChar);
                    if (split.length == 1) {
                        if (arduinoUtilities.debugMode) {
                            console.log("ARDUINO buf "+arduinoUtilities.arduinoCommandBuffer+", no value in command");
                        }
                        try {
                            arduinoUtilities.processFullCommand(arduinoUtilities.arduinoCommandBuffer,null, extSettings, extInformation);
                            resolve();
                        } catch(e) {
                            reject("Arduino handle of data failed with error message '"+e+"'");
                        }
                    } else if (split.length == 2) {
                        if (arduinoUtilities.debugMode) {
                            console.log("ARDUINO buf "+arduinoUtilities.arduinoCommandBuffer+", single value found");
                        }
                        try {
                            arduinoUtilities.processFullCommand(split[0],split[1], extSettings, extInformation);
                            resolve();
                        } catch(e) {
                            reject("Arduino handle of data failed with error message '"+e+"'");
                        }
                    } else if (split.length > 2) {
                        if (arduinoUtilities.debugMode) {
                            console.log("ARDUINO buf "+arduinoUtilities.arduinoCommandBuffer+", multiple values found");
                        }
                        var values = [];
                        for (var i=1; i<split.length; i++) {
                            values.push(split[i]);
                        }
                        try {
                            arduinoUtilities.processFullCommand(split[0],values, extSettings, extInformation);
                            resolve();
                        } catch(e) {
                            reject("Arduino handle of data failed with error message '"+e+"'");
                        }
                    }
                    arduinoUtilities.arduinoCommandBuffer = "";
                } else {
                    arduinoUtilities.arduinoCommandBuffer+=sdata[i]; //if it's not recognized, just add it to the buffer
                }
            }
        });
    },

    processFullCommand: function(command, value, extSettings, extInformation) {
        switch(command) {
            //CONNECTION COMMANDS
            case "AOK": //arduino tells server that it is ok
                arduinoUtilities.sendCommand("SOK"); //tell arduino that server is ready
                break;
            case "CONN": //arduino tells server that it is connected
                console.log("Arduino is connected :)");
                break;
            //INFO COMMANDS
            case "INFO": //arduino requested server information
                console.log("Arduino has requested information, sending");
                arduinoUtilities.sendCommand("uptime",runtimeInformation.uptime);
                arduinoUtilities.sendCommand("status",runtimeInformation.status);
                arduinoUtilities.sendCommand("users",runtimeInformation.users);
                break;
            //SENSOR CONNECTION COMMANDS
            case "SENSORSTATUS": //arduino has sensor status information
                if (arduinoUtilities.debugMode) {
                    console.log("Arduino sensor status: "+value);
                }
                var sensorStatus = arduinoUtilities.processCommandValues(value);
                if (typeof sensorStatus == "undefined" || Object.keys(sensorStatus).length == 0) {
                    console.warn("Arduino sent undefined sensorStatus");
                } else {
                    extInformation.arduinoSensorStatus = sensorStatus;
                }
                break;
            case "TSL1DATA": //temp 1 data
                if (arduinoUtilities.debugMode) {
                    console.log("TSL1 Data: "+value);
                }
                var lightValue = arduinoUtilities.processCommandValues(value);
                if (typeof lightValue == "undefined") {
                    console.warn("Arduino sent light value that is undefined");
                    extInformation.arduinoSensorData.tsl1Lux = "?";
                } else {
                    extInformation.arduinoSensorData.tsl1Lux = Number(lightValue.LIGHT);
                }
                break;
            case "TSL1OVERLOAD":
                if (arduinoUtilities.debugMode) {
                    console.warn("TSL1 Overload detected");
                }
                arduinoUtilities.sensorOverloaded = true;
                break;
            case "TSL2DATA":
                if (arduinoUtilities.debugMode) {
                    console.log("TSL2 Data: "+value);
                }
                var lightValue = arduinoUtilities.processCommandValues(value);
                if (typeof lightValue.LIGHT == "undefined") {
                    console.warn("Arduino sent light value that is undefined");
                    extInformation.arduinoSensorData.tsl2Lux = "?";
                } else {
                    extInformation.arduinoSensorData.tsl2Lux = Number(lightValue.LIGHT);
                }
                break;
            case "TSL2OVERLOAD":
                if (arduinoUtilities.debugMode) {
                    console.warn("TSL2 Overload detected");
                }
                arduinoUtilities.sensorOverloaded = true;
                break;
            case "ACCELDATA":
                if (arduinoUtilities.debugMode) {
                    console.log("Accel Data: "+value);
                }
                var accelValue = arduinoUtilities.processCommandValues(value);
                if (typeof accelValue.X == "undefined" || typeof accelValue.Y == "undefined" || typeof accelValue.Z == "undefined") {
                    console.warn("Arduino send accel value that is undefined");
                    extInformation.arduinoSensorData.accelValues = {X: "?",Y: "?", Z: "?"};
                } else {
                    extInformation.arduinoSensorData.accelValues = {X: Number(accelValue.X), Y: Number(accelValue.Y), Z: Number(accelValue.Z)};
                }
                break;
            case "MAGDATA":
                if (arduinoUtilities.debugMode) {
                    console.log("Mag Data: "+value);
                }
                var magValue = arduinoUtilities.processCommandValues(value);
                if (typeof magValue.X == "undefined" || typeof magValue.Y == "undefined" || typeof magValue.Z == "undefined" || typeof magValue.HEADING == "undefined") {
                    console.warn("Arduino send mag value that is undefined");
                    extInformation.arduinoSensorData.magValues = {X: "?",Y: "?",Z: "?"};
                    extInformation.arduinoSensorData.magHeading = "?";
                } else {
                    extInformation.arduinoSensorData.magValues = {X: Number(magValue.X), Y: Number(magValue.Y), Z: Number(magValue.Z)};
                    extInformation.arduinoSensorData.magHeading = Number(magValue.HEADING);
                }
                break;
            case "TEMPDATA":
                if (arduinoUtilities.debugMode) {
                    console.log("Temperature Data: "+value);
                }
                var tempValue = arduinoUtilities.processCommandValues(value);
                if (typeof tempValue.OTEMP == "undefined" || typeof tempValue.ITEMP == "undefined") {
                    console.warn("Arduino sent temperature value (inside or outside) that is undefined");
                    extInformation.arduinoSensorData.outsideTemp = "?";
                    extInformation.arduinoSensorData.insideTemp = "?";
                } else {
                    extInformation.arduinoSensorData.outsideTemp = Number(tempValue.OTEMP);
                    extInformation.arduinoSensorData.insideTemp = Number(tempValue.ITEMP);
                }
                break;
            case "GPSDATA":
                if (arduinoUtilities.debugMode) {
                    console.log("GPS Data: "+value);
                }
                var gpsValue = arduinoUtilities.processCommandValues(value);
                if (typeof gpsValue.FIX == "undefined" || typeof gpsValue.FIXQUAL == "undefined") {
                    console.warn("Arduino sent GPS value that is malformed (no fix or fix quality)");
                    extInformation.arduinoSensorData.gps = {"FIX": "?", "FIXQUAL": "?", "LAT": "?", "LNG": "?", "SPEED": "?", "ANGLE": "?", "ALTITUDE": "?", "SAT": "?"}
                } else {
                    extInformation.arduinoSensorData.gps = {
                        "FIX": gpsValue.FIX,
                        "FIXQUAL": gpsValue.FIXQUAL,
                        "LAT": ((typeof gpsValue.LAT == "undefined") ? "?" : gpsValue.LAT), //determine type and set if it was recieved
                        "LNG": ((typeof gpsValue.LNG == "undefined") ? "?" : gpsValue.LNG),
                        "SPEED": ((typeof gpsValue.SPEED == "undefined") ? "?" : gpsValue.SPEED),
                        "ANGLE": ((typeof gpsValue.ANGLE == "undefined") ? "?" : gpsValue.ANGLE),
                        "ALTITUDE": ((typeof gpsValue.ALTITUDE == "undefined") ? "?" : gpsValue.ALTITUDE),
                        "SAT": ((typeof gpsValue.SAT == "undefined") ? "?" : gpsValue.SAT)
                    }
                }
                break;
            case "CARCOMM": //yee it's a car command! work on this later ;)
                break;
            case "UNC":
                console.warn("[ARDUINO] Command "+value+" was not understood by arduino")
            default:
                console.error("Command "+command+" not recognized as valid arduino command");
                break;
        }
        if (arduinoUtilities.debugMode) {
            console.log("Complete command recognized: "+command+", value(s): "+JSON.stringify(value));
        }
    },

    processCommandValues: function(values) {
        var split = values.split(",");
        var polished = {};
        for (var i=0; i<split.length; i++) {
            var furtherSplit = split[i].split("="); //split by equal sign
            if (furtherSplit.length == 1) {
                polished[furtherSplit[0]] = null; //set to whatever it is equal to
            } else if (furtherSplit.length == 2) {
                polished[furtherSplit[0]] = furtherSplit[1]; //set value to what's it's equal to
            } else { //more than 1 equal sign? idk this should never happen but let's write a case for it to be safe
                var argsList = [];
                for (var j=1; j<furtherSplit.length-1; j++) {
                    argsList.push(furtherSplit[j]);
                }
                polished[furtherSplit[0]] = argsList;
            }
        }
        return polished;
    },

    sendCommand: function(command,value) {
        if (typeof arduinoUtilities.arduinoObject == "undefined") {
            arduinoUtilities.setArduinoFakeClass(); //if it's undefined set the fake class
        }
        if (typeof value == "undefined") {
            arduinoUtilities.arduinoObject.write(command+arduinoUtilities.arduinoCommandSplitChar);
        } else {
            arduinoUtilities.arduinoObject.write(command+arduinoUtilities.arduinoCommandValueChar+value+arduinoUtilities.arduinoCommandSplitChar);
        }
    },

    setArduinoFakeClass: function() {
        arduinoUtilities.arduinoObject = { //make a fake arduino class so that server doesnt fail on write
            write: function(t) {
                console.warn("[WARNING] Arduino.write method called with no arduino connected, data is literally going nowhere");
            },
            read: function() {
                return "";
            }
        }
    },

    enableSensorUpdates: function() {
        return new Promise( (resolve, reject) => {
            try {
                arduinoUtilities.disableSensorUpdates(); //try to clear first

                arduinoUtilities.sensorUpdateListener = setInterval( () => {
                    arduinoUtilities.sendCommand("SENSORSTATUS"); //send status and update requests
                    arduinoUtilities.sendCommand("SENSORUPDATE");
                },arduinoUtilities.extSettings.arduinoSensorUpdateInterval);

                arduinoUtilities.setSensorOverloadedListener(); //set overloaded listener
                resolve();
            } catch(e) {
                reject("Error: "+e);
            }
        });
    },

    disableSensorUpdates: function() {
        try { //try to clear intervals
            clearInterval(arduinoUtilities.sensorUpdateListener);
        } catch(e) {}
        try {
            clearInterval(arduinoUtilities.sensorOverloadListener);
        } catch(e) {}
    },

    setSensorOverloadedListener: function(){
        arduinoUtilities.sensorOverloadListener = setInterval( () => {
            if (arduinoUtilities.sensorOverloaded) {
                console.warn("[ARDUINO] Sensor overload detected, waiting "+String(arduinoUtilities.extSettings.arduinoSensorOverloadedTimeout)+"ms to restart listener");
                arduinoUtilities.disableSensorUpdates();
                setTimeout( () => {
                    arduinoUtilities.enableSensorUpdates(); //reenable sensor updates
                }, arduinoUtilities.extSettings.arduinoSensorOverloadedTimeout);
            }
        },arduinoUtilities.extSettings.arduinoSensorOverloadedInterval);
    }
}

exports.utilities = arduinoUtilities;
    
