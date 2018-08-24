/*
* oled.js by Aaron Becker
* External OLED driver wrapper for Raspberry Pi
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

//CarOS OledDriver
var oled = require('rpi-oled'); //req the library
var font = require('oled-font-5x7'); //req the font

var RPIStatusOled = {
    options: {
        width: 128,
        height: 64,
        address: 0x3C
    },
    textSize: {
        width: 5,
        height: 7
    },
    commandList: {}, //stores commands
    defaultColor: 1,
    oledObject: undefined,
    init: function(settings) {
        var rso = RPIStatusOled;
        console.log("OLED initialized with I2C address: "+settings.oledDisplayAddress);
        rso.options.address = Number(settings.oledDisplayAddress);
        rso.oledObject = new oled(rso.options);

        rso.oledObject.turnOnDisplay();
        rso.oledObject.clearDisplay();
        rso.oledObject.dimDisplay(false);

        rso.writeText("Initialized OLED", {
            style: "centerUnderline",
            y: 30
        })
    },
    writeText: function(text, options) {
        var rso = RPIStatusOled;
        if (typeof text !== "undefined") {
            if (options.clearDisplay) {
                rso.oledObject.clearDisplay();
            }
            if (options.style == "center") {
                if (typeof options.y !== "undefined") {
                    var txtSizePX = (text.length*rso.textSize.width);
                    var remainingSpace = (rso.options.width-txtSizePX);
                    rso.oledObject.setCursor(remainingSpace/2, options.y);
                    rso.oledObject.writeString(font, rso.defaultColor, text);
                } else {
                    return console.error("OLED WriteText center called with no YPos");
                }
            } else if (options.style == "underline") {
                if (typeof options.y !== "undefined" && typeof options.x !== "undefined") {
                    rso.oledObject.setCursor(options.x,options.y);
                    rso.oledObject.writeString(font, rso.defaultColor, text);
                    rso.oledObject.drawLine(options.x, options.y+rso.textSize.height+1, options.x+(text.length*rso.textSize.width), options.y+rso.textSize.height+1, rso.defaultColor);
                } else {
                    return console.error("OLED WriteText underline called with no X or Ypos");
                }
            } else if (options.style == "centerUnderline") {
                if (typeof options.y !== "undefined") {
                    var txtSizePX = (text.length*rso.textSize.width);
                    var remainingSpace = (rso.options.width-txtSizePX);
                    rso.oledObject.setCursor(remainingSpace/2, options.y);
                    rso.oledObject.writeString(font, rso.defaultColor, text);
                    rso.oledObject.drawLine(remainingSpace/2, options.y+rso.textSize.height+1, (remainingSpace/2)+txtSizePX, options.y+rso.textSize.height+1, rso.defaultColor);
                } else {
                    return console.error("OLED WriteText underlinecenter called with no YPos");
                }
            } else {
                if (typeof options.x !== "undefined" && typeof options.y !== "undefined") {
                    rso.oledObject.setCursor(options.x, options.y);
                    rso.oledObject.writeString(font, rso.defaultColor, text);
                } else {
                    return console.error("OLED Writetext regular called with no X or YPow")
                }
            }
        } else {
            return console.error("OLED WriteText called with no text");
        }
    },
    update: function() {
        var rso = RPIStatusOled;
        var yPos = 1;
        var yIncrement = 15;
        var commandKeys = Object.keys(rso.commandList);

        rso.oledObject.clearDisplay();

        for (var i=0; i<commandKeys.length; i++) {
            var title = commandKeys[i];
            if (typeof title == "string") {
                title = title.substring(0,1).toUpperCase()+title.substring(1,title.length);
            }
            var titleWidth = (String(title).length)*rso.textSize.width; //width plus colon and space
            rso.writeText(title+": ", {
                style: "underline",
                x: 0,
                y: yPos
            });

            rso.writeText(rso.commandList[commandKeys[i]], {
                style: "regular",
                x: titleWidth+(4*rso.textSize.width),
                y: yPos
            })
            yPos+=yIncrement;
        }
    },
    command: function(command, info) {
        var rso = RPIStatusOled;
        if (typeof info == "undefined") {
            info = "?";
        }
        rso.commandList[command] = String(info);
    },
    preventBurnin: function() {
        var rso = RPIStatusOled;
        rso.oledObject.clearDisplay();
        setTimeout( () => {
            rso.oledObject.fillRect(0, 0, rso.options.width, rso.options.height, rso.defaultColor);
            setTimeout( () => {
                rso.oledObject.clearDisplay();
            },1000);
        },1000);
    }
}
exports.driver = RPIStatusOled;