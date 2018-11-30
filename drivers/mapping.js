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
	loadPercent: 0,
	init: (cwd, settings) => {
		return new Promise( (resolve, reject) => {
			if (typeof cwd == "undefined" || typeof settings == "undefined") {
				return reject("CWD or RuntimeSettings undefined on init");
			} else if (typeof settings.mapDataDirectory == "undefined" || typeof settings.defaultMapdataFile == "undefined") {
				return reject("mapDataDirectory or defaultMapdataFile undefined in settings");
			}

			let mdr = path.join(cwd,settings.mapDataDirectory,settings.defaultMapdataFile);
			console.log("Fetching mapdata via read stream from dir: "+mdr);
			
			if (!fs.existsSync(mdr)) {
				return reject("Map file does not exist, check settings");
			}

			let readStream = fs.createReadStream(mdr);
			let parseStream = bigJson.createParseStream(); //parse stream for json

			let procSize = 0;
			let totalSize;
			fs.stat(mdr, function (err, stats) {
				if (err) {
					return reject("Error getting size of zip file");
				} else {
					totalSize = stats.size;
				}
			});

			readStream.on('data', function(buffer) {
		        let segmentLength = buffer.length;
		        // Increment the uploaded data counter
		        procSize += segmentLength;

		        // Display the upload percentage
		        mapUtils.loadPercent = Number((procSize/totalSize*100).toFixed(2));
		    });

			parseStream.on('data', gdc => {
				console.log("Mapping: loaded geoJson data, running tile preprocessor...");
				mapUtils.tileIndex = tileIndexing(gdc, {
					debug: 2,
					maxZoom: 18,
					indexMaxZoom: 10
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