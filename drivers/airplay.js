/*
* airplay.js by Aaron Becker
* Manages the airplay stream used to take audio from mobile phones or other devices and stream it to the car's speakers
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*
*/

const airTunes = require('nodetunes'); //where all the real work is :)

const airplayUtils = {
	serverName: undefined,
	clientConnectedListeners: [],
	clientDisconnectedListeners: [],
	debugMode: false,
	init: airplaySettings => {
		var _this = airplayUtils;
		return new Promise( (resolve,reject) => {
			if (!airplaySettings || !airplaySettings.serverName) {
				return reject("Missing serverName or airplaySettings");
			}
			if (_this.debugMode) {
				console.log("init airplay ok with servername "+airplaySettings.serverName);
			}
			_this.serverName = airplaySettings.serverName; //this points to airplayUtils
			return resolve();
		})
	},
	startServer: () => {
		var _this = airplayUtils;
		return new Promise( (resolve, reject) => {
			_this.server = new airTunes({serverName: _this.serverName});
			_this.server.on('clientConnected', stream => {
				for (var i=0; i<_this.clientConnectedListeners.length; i++) {
					try {
						_this.clientConnectedListeners[i](stream);
					} catch(e) {
						console.error("Error running clientDisconnectedListener: "+e);
					}
				}
			});
			_this.server.on('clientDisconnected', stream => {
				for (var i=0; i<_this.clientDisconnectedListeners.length; i++) {
					try {
						_this.clientDisconnectedListeners[i](stream);
					} catch(e) {
						console.error("Error running clientDisconnectedListener: "+e);
					}
				}
			});
			_this.server.start();
			if (_this.debugMode) {
				console.log("airplay startServer ok");
			}
			return resolve();
		})
	},
	onClientConnected: fn => {
		var _this = airplayUtils;
		return new Promise( (resolve, reject) => {
			if (typeof fn == "function") {
				_this.clientConnectedListeners.push(fn);
				if (_this.debugMode) {
					console.log("airplay attach clientConnected listener");
				}
				return resolve();
			}
			return reject("fn is not a function");
		})
	},
	onClientDisconnected: fn => {
		var _this = airplayUtils;
		return new Promise( (resolve, reject) => {
			if (typeof fn == "function") {
				_this.clientDisconnectedListeners.push(fn);
				if (_this.debugMode) {
					console.log("airplay attach clientDisconnected listener");
				}
				return resolve();
			}
			return reject("fn is not a function");
		})
	}
}

module.exports = airplayUtils;