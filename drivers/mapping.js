/*
* mapping.js by Aaron Becker
* Script to manage handling+parsing of mapping data for CarOS
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const geojsonVT = require("geojson-vt"); //thanks the gods to https://github.com/mapbox/geojson-vt for this AWESOME library
const fs = require("fs");
const path = require("path");
const MBTiles = require("@mapbox/mbtiles");
const bigJson = require('big-json');

const mapUtils = {
	mapAnnotationData: [],
	mapTileData: [],
	loadPercent: 0,
	displayAnnotations: true,
	init: (cwd, settings) => {
		return new Promise( (resolve, reject) => {
			if (typeof cwd == "undefined" || typeof settings == "undefined") {
				return reject("CWD or RuntimeSettings undefined on init");
			} else if (typeof settings.mapDataDirectory == "undefined" || typeof settings.defaultMapAnnotationFiles == "undefined" || settings.defaultMapAnnotationFiles.length == 0 || typeof settings.displayAnnotations == "undefined") {
				return reject("mapDataDirectory or defaultMapdataFile or displayAnnotations undefined in settings");
			}
			mapUtils.displayAnnotations = settings.displayAnnotations;

			function loadAnnotationData(index) {
				let mdr = path.join(cwd,settings.mapDataDirectory,settings.defaultMapAnnotationFiles[index].file);
				console.log("Fetching mapdata (index: "+index+") via read stream from dir: "+mdr);
				
				if (!fs.existsSync(mdr)) {
					return reject("Map file at index: "+index+" and path: "+mdr+"does not exist, check settings");
				} else if (typeof settings.defaultMapAnnotationFiles[index].file == "undefined" || typeof settings.defaultMapAnnotationFiles[index].fillColor == "undefined" || typeof settings.defaultMapAnnotationFiles[index].strokeColor == "undefined" || typeof settings.defaultMapAnnotationFiles[index].opacity == "undefined" || typeof settings.defaultMapAnnotationFiles[index].strokeWeight == "undefined") {
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
			        mapUtils.loadPercent = Number((((index/settings.defaultMapAnnotationFiles.length)+((procSize/totalSize)/settings.defaultMapAnnotationFiles.length))*100).toFixed(2)); //upload percentage of all files
			    });

				parseStream.on('data', gdc => {
					console.log("Mapping: loaded geoJson data for file at index: "+index+", running tile preprocessor...");
					let tileIndex = geojsonVT(gdc, { //create tile index
						debug: 2,
						maxZoom: 15,
						indexMaxZoom: 13
					});

					mapUtils.mapAnnotationData.push({
						tileIndex: tileIndex,
						fileSize: totalSize,
						settings: {
							index: index,
							strokeColor: settings.defaultMapAnnotationFiles[index].strokeColor,
							fillColor: settings.defaultMapAnnotationFiles[index].fillColor,
							opacity: settings.defaultMapAnnotationFiles[index].opacity,
							strokeWeight: settings.defaultMapAnnotationFiles[index].strokeWeight,
						}
					}) //push the full object
					console.log("Tile preprocessor created successfully for data at index: "+index);

					readStream.unpipe(parseStream); //unpipe stream
					
					if (index >= settings.defaultMapAnnotationFiles.length-1) {
						console.log("Done loading mapdata");
						return resolve();
					} else {
						loadAnnotationData(index+1); //load next index
					}
				})
				readStream.pipe(parseStream);
			}

			//ACTUAL INIT CODE
			console.log("creating mbtiles object (could take a while)...");
			let mbpath = path.join(cwd,settings.mapDataDirectory,settings.defaultMapdataFile);
			if (!fs.existsSync(mbpath)) {
				return reject("Mapdata file at path: "+mbpath+"does not exist, check settings");
			}
			new MBTiles(mbpath, function(err, mbtiles) {
				if (err) {
					return reject("Failed to create MBTiles object because "+err);
				} else {
					console.log("mbtiles object ok, loading annotation data...");
					mapUtils.mapTileData = mbtiles;

					loadAnnotationData(0); //start load process for annotation geojson
				}
			});
			
		})
	},
	fetchAnnotationTile: (layerIndex, zoom, x, y) => {
		return new Promise( (resolve, reject) => {
			if (!mapUtils.displayAnnotations) {
				return resolve([]);
			}
			let realLindex = -1;
			for (var i=0; i<mapUtils.mapAnnotationData.length; i++) { //search it up just in case
				if (mapUtils.mapAnnotationData[i].settings.index == layerIndex) {
					realLindex = i;
					break;
				}
			}
			if (realLindex < 0) {
				console.warn("Tried to lookup layer "+layerIndex+" but couldn't find it for some reason??");
				return reject("Layer lookup failed");
			} else {
				let tileData = mapUtils.mapAnnotationData[realLindex].tileIndex.getTile(Number(zoom), Number(x), Number(y)); //return the cache from the correct layer
				if (typeof tileData == "undefined" || tileData === null || !tileData) {
					return reject();
				} else {
					return resolve(tileData.features);
				}
			}
		})
	},
	fetchDataTile: (zoom, x, y) => {
		return new Promise( (resolve, reject) => {
			mapUtils.mapTileData.getTile(zoom, x, y, function(err, tile, headers) {
				if (err) {
					return reject(err);
				} else {
					return resolve(tile);
				}
	        });
		})
	},
	fetchDataGrid: (zoom, x, y) => {
		return new Promise( (resolve, reject) => {
			mapUtils.mapTileData.getGrid(zoom, x, y, function(err, grid, headers) {
				if (err) {
					return reject(err);
				} else {
					return resolve(grid);
				}
			});
		})
	}

}


module.exports = mapUtils;