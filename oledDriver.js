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
        function decimalToHexString(number)
        {
          if (number < 0)
          {
            number = 0xFFFFFFFF + number + 1;
          }

          return number.toString(16).toUpperCase();
        }
        rso.options.address = decimalToHexString(Number(settings.oledDisplayAddres));
        rso.oledObject = new oled(rso.options);

        oled.turnOnDisplay();
        oled.clearDisplay();
        oled.dimDisplay(false);

        rso.writeText("Initialized OLED", {
            style: "centerUnderline",
            y: 30
        })
    },
    writeText: function(text, options) {
        var rso = RPIStatusOled;
        if (text) {
            if (options.clearDisplay) {
                oled.clearDisplay();
            }
            if (options.style == "center") {
                if (options.y) {
                    var txtSizePX = (text.length*rso.textSize.width);
                    var remainingSpace = (rso.options.width-txtSizePX);
                    oled.setCursor(remainingSpace/2, options.y);
                    oled.writeString(font, rso.defaultColor, text);
                } else {
                    return console.error("OLED WriteText center called with no YPos");
                }
            } else if (options.style == "underline") {
                if (options.y && options.x) {
                    oled.setCursor(options.x,options.y);
                    oled.writeString(font, rso.defaultColor, text);
                    oled.drawLine(options.x, options.y+1, options.x+(text.length*rso.textSize.width), options.y+1, rso.defaultColor);
                } else {
                    return console.error("OLED WriteText underline called with no X or Ypos");
                }
            } else if (options.style == "centerUnderline") {
                if (options.y) {
                    var txtSizePX = (text.length*rso.textSize.width);
                    var remainingSpace = (rso.options.width-txtSizePX);
                    oled.setCursor(remainingSpace/2, options.y);
                    oled.writeString(font, rso.defaultColor, text);
                    oled.drawLine(remainingSpace/2, options.y+1, (remainingSpace/2)+txtSizePX, options.y+1, rso.defaultColor);
                } else {
                    return console.error("OLED WriteText underlinecenter called with no YPos");
                }
            } else {
                if (options.x && options.y) {
                    oled.setCursor(options.x, options.y);
                    oled.writeString(font, rso.defaultColor, text);
                } else {
                    return console.error("OLED Writetext regular called with no X or YPow")
                }
            }
        } else {
            return console.error("OLED WriteText called with no text");
        }
    }
    update: function() {
        var rso = RPIStatusOled;
        var yPos = 1;
        var yIncrement = 11;
        var commandKeys = Object.keys(rso.commandList);

        oled.clearDisplay();

        for (var i=0; i<commandKeys.length; i++) {
            var titleWidth = (commandKeys[i].length+2)*rso.textSize.width; //width plus colon and space
            rso.writeText(commandKeys[i]+": ", {
                style: "underline",
                x: 0,
                y: yPos
            });
            rso.writeText(rso.commandList[commandKeys[i]], {
                style: "regular",
                x: titleWidth,
                y: yPos
            })
            yPos+=yIncrement;
        }
    },
    command: function(command, info) {
        var rso = RPIStatusOled;
        rso.commandList.command = info;
    }
}
exports.driver = RPIStatusOled;