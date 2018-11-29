/*
* mapping.js by Aaron Becker
* Script to manage user authentication for CarOS
* Much love to Evan Gow for his great tutorial at https://medium.com/@evangow/server-authentication-basics-express-sessions-passport-and-curl-359b7456003d
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const mapUtils = {
	mapDataCache: "",
	init: (cwd, settings) => {
		return new Promise( (resolve, reject) => {
			if (typeof cwd == "undefined" || typeof settings == "undefined") {
				return reject("CWD or RuntimeSettings undefined on init");
			} else if (typeof settings.mapDataDirectory == "undefined") {
				return reject("mapDataDirectory undefined in settings");
			}

			console.log("mdr: "+settings.mapDataDirectory);

			//do stuff
			mapUtils.mapDataCache = "";

			return resolve();
		})
	},
	requestMapData: () => {
		return mapUtils.mapDataCache; //return the cache
	}
}


module.exports = mapUtils;