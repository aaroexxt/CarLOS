var arduinoUtilities = {
    debugMode: false,
    arduinoCommandSplitChar: ";",
    arduinoCommandValueChar: "|",

    arduinoCommandBuffer: "",  //need buffer because might not recieve whole command in one recieve

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
                sendArduinoCommand("uptime",runtimeInformation.uptime);
                sendArduinoCommand("status",runtimeInformation.status);
                sendArduinoCommand("users",runtimeInformation.users);
                break;
            //SENSOR CONNECTION COMMANDS
            case "SENSORSTATUS": //arduino has sensor status information
                console.log("Arduino sensor status: "+value);
                processArduinoValues
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
        arduino.write(command+arduinoCommandValueChar+value+arduinoCommandSplitChar);
    }
}

var arduino = { //make a fake arduino class so that server doesnt fail on write
        write: function(t) {
            console.warn("[WARNING] Arduino.write method called with no arduino connected, data is literally going nowhere");
        }
    }

    var SerialPort = require('serialport');

    arduino = new SerialPort(serialDevice, {
        baudRate: runtimeSettings.arduinoBaudRate,
        autoOpen: false
    });