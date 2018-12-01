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
	mapIndexingData: [],
	loadPercent: 0,
	init: (cwd, settings) => {
		return new Promise( (resolve, reject) => {
			if (typeof cwd == "undefined" || typeof settings == "undefined") {
				return reject("CWD or RuntimeSettings undefined on init");
			} else if (typeof settings.mapDataDirectory == "undefined" || typeof settings.defaultMapdataFiles == "undefined" || settings.defaultMapdataFiles.length == 0) {
				return reject("mapDataDirectory or defaultMapdataFile undefined in settings");
			}

			function loadData(index) {
				let mdr = path.join(cwd,settings.mapDataDirectory,settings.defaultMapdataFiles[index].file);
				console.log("Fetching mapdata (index: "+index+") via read stream from dir: "+mdr);
				
				if (!fs.existsSync(mdr)) {
					return reject("Map file at index: "+index+" and path: "+mdr+"does not exist, check settings");
				} else if (typeof settings.defaultMapdataFiles[index].file == "undefined" || typeof settings.defaultMapdataFiles[index].fillColor == "undefined" || typeof settings.defaultMapdataFiles[index].strokeColor == "undefined" || typeof settings.defaultMapdataFiles[index].opacity == "undefined" || typeof settings.defaultMapdataFiles[index].strokeWeight == "undefined") {
					return reject("Settings file at index: "+index+" has invalid settings (missing file, strokeColor, or fillColor, or strokeWeight or opacity)")
				}

				let readStream = fs.createReadStream(mdr);
				let parseStream = bigJson.createParseStream(); //parse stream for json

				let procSize = 0;
				let totalSize;
				fs.stat(mdr, function (err, stats) {
					if (err) {
						return reject("Error getting size of map file");
					} else {
						totalSize = stats.size;
					}
				});

				readStream.on('data', function(buffer) {
			        let segmentLength = buffer.length;
			        // Increment the uploaded data counter
			        procSize += segmentLength;

			        // Display the upload percentage
			        mapUtils.loadPercentSingleFile = Number((procSize/totalSize*100).toFixed(2));
			        mapUtils.loadPercent = Number((((index/settings.defaultMapdataFiles.length)+((procSize/totalSize)/settings.defaultMapdataFiles.length))*100).toFixed(2)); //upload percentage of all files
			    });

				parseStream.on('data', gdc => {
					console.log("Mapping: loaded geoJson data for file at index: "+index+", running tile preprocessor...");
					let tileIndex = tileIndexing(gdc, { //create tile index
						debug: 2,
						maxZoom: 18,
						indexMaxZoom: 10
					});

					mapUtils.mapIndexingData.push({
						tileIndex: tileIndex,
						fileSize: totalSize,
						settings: {
							index: index,
							strokeColor: settings.defaultMapdataFiles[index].strokeColor,
							fillColor: settings.defaultMapdataFiles[index].fillColor,
							opacity: settings.defaultMapdataFiles[index].opacity,
							strokeWeight: settings.defaultMapdataFiles[index].strokeWeight,
						}
					}) //push the full object
					console.log("Tile preprocessor created successfully for data at index: "+index);

					readStream.unpipe(parseStream); //unpipe stream
					
					if (index >= settings.defaultMapdataFiles.length-1) {
						console.log("Done loading mapdata")
						return resolve();
					} else {
						loadData(index+1); //load next index
					}
				})
				readStream.pipe(parseStream);
			}
			loadData(0); //start load process
			
		})
	},
	fetchTile: (layerIndex, zoom, x, y) => {
		return new Promise( (resolve, reject) => {
			let realLindex = -1;
			for (var i=0; i<mapUtils.mapIndexingData.length; i++) { //search it up just in case
				if (mapUtils.mapIndexingData[i].settings.index == layerIndex) {
					realLindex = i;
					break;
				}
			}
			if (realLindex < 0) {
				console.warn("Tried to lookup layer "+layerIndex+" but couldn't find it for some reason??");
				return reject("Layer lookup failed");
			} else {
				let tileData = mapUtils.mapIndexingData[realLindex].tileIndex.getTile(Number(zoom), Number(x), Number(y)); //return the cache from the correct layer
				if (typeof tileData == "undefined" || tileData === null || !tileData) {
					return reject();
				} else {
					return resolve(tileData.features);
				}
			}
		})
	}
}


module.exports = mapUtils;