/*
* mapping.js by Aaron Becker
* Script to manage user authentication for CarOS
* Much love to Evan Gow for his great tutorial at https://medium.com/@evangow/server-authentication-basics-express-sessions-passport-and-curl-359b7456003d
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const tileIndexing = require("geojson-vt"); //thanks the gods to https://github.com/mapbox/geojson-vt for this AWESOME library
const fs = require("fs");
const path = require("path");
const bigJson = require('big-json');

const mapUtils = {
	tileIndex: undefined,
	init: (cwd, settings) => {
		return new Promise( (resolve, reject) => {
			if (typeof cwd == "undefined" || typeof settings == "undefined") {
				return reject("CWD or RuntimeSettings undefined on init");
			} else if (typeof settings.mapDataDirectory == "undefined" || typeof settings.defaultMapdataFile == "undefined") {
				return reject("mapDataDirectory or defaultMapdataFile undefined in settings");
			}

			let mdr = path.join(cwd,settings.mapDataDirectory,settings.defaultMapdataFile);
			console.log("Fetching mapdata via read stream from dir: "+mdr);
			
			let readStream = fs.createReadStream(mdr);
			let parseStream = bigJson.createParseStream(); //parse stream for json

			parseStream.on('data', gdc => {
				console.log("Mapping: loaded geoJson data, running tile preprocessor...");
				mapUtils.tileIndex = tileIndexing(gdc, {
					debug: 1
				});
				console.log("Tile preprocessor created successfully");
				return resolve();
			})
			readStream.pipe(parseStream);
			
		})
	},
	fetchTile: (zoom, x, y) => {
		return new Promise( (resolve, reject) => {
			let tileData = mapUtils.tileIndex.getTile(Number(zoom), Number(x), Number(y)); //return the cache
			if (typeof tileData == "undefined" || tileData === null || !tileData) {
				return reject();
			} else {
				return resolve(tileData.features);
			}
		})
	}
}


module.exports = mapUtils;