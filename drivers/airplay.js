/*
* airplay.js by Aaron Becker
* Manages the airplay stream used to take audio from mobile phones or other devices and stream it to the car's speakers
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*
*/

//OK SO HERE's WHAT"S HAPPENING FOR FUTURE AARON
/*
this file is one driver, soundcloud is another. soundmanager manages both and provides higher-level abstraction to carosserver.js. so bascically rewrite soundmanager
*/

const airTunes = require('nodetunes'); //where all the real work is :)

const airplayUtils = {
	serverName: undefined,
	clientConnectedListeners: [],
	clientDisonnectedListeners: [],
	init: airplaySettings => {
		return new Promise( (resolve,reject) => {
			if (!airplaySettings || !airplaySettings.serverName) {
				return reject("Missing serverName or airplaySettings");
			}
			this.serverName = airplaySettings.serverName; //this points to airplayUtils
			return resolve();
		})
	},
	startServer: () => {
		return new Promise( (resolve, reject) => {
			this.server = new airTunes({serverName: this.serverName});
			this.server.on('clientConnected', stream => {
				for (var i=0; i<this.clientConnectedListeners.length; i++) {
					try {
						this.clientConnectedListeners[i](stream);
					} catch(e) {
						console.error("Error running clientDisconnectedListener: "+e);
					}
				}
			});
			this.server.on('clientDisconnected', stream => {
				for (var i=0; i<this.clientDisconnectedListeners.length; i++) {
					try {
						this.clientDisconnectedListeners[i](stream);
					} catch(e) {
						console.error("Error running clientDisconnectedListener: "+e);
					}
				}
			});
			this.server.start();
			return resolve();
		})
	},
	onClientConnected: fn => {
		return new Promise( (resolve, reject) => {
			if (typeof fn == "function") {
				this.clientConnectedListeners.push(fn);
				return resolve();
			}
			return reject("fn is not a function");
		})
	},
	onClientDisconnected: fn => {
		return new Promise( (resolve, reject) => {
			if (typeof fn == "function") {
				this.clientDisonnectedListeners.push(fn);
				return resolve();
			}
			return reject("fn is not a function");
		})
	}
}

module.exports = airplayUtils;