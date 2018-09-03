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
    debugMode: false,
    arduinoCommandSplitChar: ";",
    arduinoCommandValueChar: "|",

    arduinoCommandBuffer: "",  //need buffer because might not recieve whole command in one recieve

    arduinoObject: undefined,
    extSettings: {},
    extInformation: {},

    init: function(eRuntimeSettings, eRuntimeInformation) {
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
            resolve(); //if it wasn't rejected then it's ok
        });
    },

    connectArduino: function(arduinoAddr) { //start new arduino connection with
        return new Promise((resolve, reject) => {
            try {
                arduinoUtilities.arduinoObject.close(); //close previous connection
            } catch(e){}
            arduinoUtilities.arduinoObject = new serialPort(arduinoAddr, {
                baudRate: arduinoUtilities.extSettings.arduinoBaudRate,
                autoOpen: false //don't open it yet
            });
            arduinoUtilities.arduinoObject.open(function (err) { //and open the port
                if (err) { //arduino was connected in previous server iteration and was disconnected?
                    arduinoUtilities.extInformation.arduinoConnected = false;
                    console.warn("[WARNING] Server running without valid arduino. Errors may occur. Once you have reconnected an arduino, you have to relaunch the start script (unless it is on the same port).");
                    arduinoUtilities.setArduinoFakeClass();
                    reject("Error opening serial port to arduino at "+arduinoAddr+" (err="+err+")");
                } else {
                    console.log("Arduino connected successfully");
                    arduinoUtilities.extInformation.arduinoConnected = true;
                    arduinoUtilities.arduinoObject.on('readable', function(data) {
                        arduinoUtilities.handleArduinoData(arduinoUtilities.arduinoObject.read());
                    });
                    resolve();
                }
            })
        });
    },

    handleArduinoData: function(data) {
        var sdata = String(data).split("");
        for (var i=0; i<sdata.length; i++) {
            if (sdata[i] == arduinoUtilities.arduinoCommandSplitChar) {
                var split = arduinoUtilities.arduinoCommandBuffer.split(arduinoUtilities.arduinoCommandValueChar);
                if (split.length == 1) {
                    if (arduinoUtilities.debugMode) {
                        console.log("ARDUINO buf "+arduinoUtilities.arduinoCommandBuffer+", no value in command");
                    }
                    arduinoUtilities.processFullCommand(arduinoUtilities.arduinoCommandBuffer,null);
                } else if (split.length == 2) {
                    if (arduinoUtilities.debugMode) {
                        console.log("ARDUINO buf "+arduinoUtilities.arduinoCommandBuffer+", single value found");
                    }
                    arduinoUtilities.processFullCommand(split[0],split[1]);
                } else if (split.length > 2) {
                    if (arduinoUtilities.debugMode) {
                        console.log("ARDUINO buf "+arduinoUtilities.arduinoCommandBuffer+", multiple values found");
                    }
                    var values = [];
                    for (var i=1; i<split.length; i++) {
                        values.push(split[i]);
                    }
                    arduinoUtilities.processFullCommand(split[0],values);
                }
                arduinoUtilities.arduinoCommandBuffer = "";
            } else {
                arduinoUtilities.arduinoCommandBuffer+=sdata[i]; //if it's not recognized, just add it to the buffer
            }
        }
    },

    processFullCommand: function(command,value) {
        switch(command) {
            //CONNECTION COMMANDS
            case "AOK": //arduino tells server that it is ok
                arduino.write("SOK"); //tell arduino that server is ready
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
                console.log("Arduino sensor status: "+value);
                arduinoUtilities.processCommandValues(value);
                break;
            case "TSL1DATA": //temp 1 data
                break;
            case "TSL1OVERLOAD":
                break;
            case "TSL2DATA":
                break;
            case "TSL2OVERLOAD":
                break;
            case "ACCELDATA":
                break;
            case "MAGDATA":
                break;
            case "TEMPDATA":
                break;
            case "GPSDATA":
                break;
            case "OTEMP": //arduino reports outside temperature
                if (arduinoUtilities.debugMode) {
                    console.log("Outside arduino temp report "+value);
                }
                runtimeInformation.outsideTemp = Number(value);
                break;
            case "ITEMP": //arduino reports inside temperature
                if (arduinoUtilities.debugMode) {
                    console.log("Inside arduino temp report "+value);
                }
                runtimeInformation.insideTemp = Number(value);
                break;
            case "CARCOMM": //yee it's a car command! work on this later ;)
                break;
            default:
                console.error("Command "+command+" not recognized as valid arduino command");
                break;
        }
        if (arduinoUtilities.debugMode) {
            console.log("Complete command recognized: "+command+", value(s): "+JSON.stringify(value));
        }
    },

    sendCommand: function(command,value) {
        arduinoUtilities.arduinoObject.write(command+arduinoUtilities.arduinoCommandValueChar+value+arduinoUtilities.arduinoCommandSplitChar);
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
    }
}

exports.utilities = arduinoUtilities;
    
