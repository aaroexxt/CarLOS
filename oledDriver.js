var oled = require('oled-js-pi'); //req the library

var RPIStatusOled = {
    options: {
      width: 128,
      height: 64,
      address: 0x3D
    },
    init: function() {
        var oled = new oled(RPIStatusOled.options);
    }
}