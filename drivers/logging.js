/*
* logging.js by Aaron Becker
* Script to manage logging data from node
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const fs = require('fs');
const path = require('path');

var loggingUtilities = {
	logFunctionOriginal: undefined,
	secondaryLogFunctionOriginal: undefined,
	infoFunctionOriginal: undefined,
	warnFunctionOriginal: undefined,
	errorFunctionOriginal: undefined,
	logDirectory: undefined,
	cwd: undefined,
	maxKeptFiles: 5,

	init: function(cwd, extSettings) {
		return new Promise((resolve, reject) => {
			if (typeof extSettings == "undefined" || typeof cwd == "undefined") {
				return reject("Settings or CWD undefined on init");
			} else {
				if (typeof extSettings.logDirectory == "undefined" || extSettings.maxKeptFiles == "undefined") {
					return reject("LogDirectory or maxKeptFiles undefined in settings");
				} else {
					loggingUtilities.logDirectory = extSettings.logDirectory;
					loggingUtilities.maxKeptFiles = Number(extSettings.maxKeptFiles);
					loggingUtilities.cwd = cwd;

					let logPath = path.join(cwd,extSettings.logDirectory);
					fs.stat(logPath, (err, stats) => {
						if (err) {
							console.log("Logging directory is missing, creating a new one")
							fs.mkdir(logPath, err => {
								if (err) {
									return reject("Error creating logfile directory: "+err);
								} else {
									return resolve();
								}
							});
						} else { //it exists
							console.log("Logging directory exists; checking if there are more logfiles than there should be...");
							//REMOVE: Creates testing files
							var count = 0;
							var clrInterval = setInterval( () => {
								var date = getCurrentDate();
								var fPath = path.join(loggingUtilities.cwd,loggingUtilities.logDirectory,date);
								console.log("Creating file: "+fPath)
								fs.writeFile(fPath, "TEST", err => {
									if (err) {
										console.error("Error creating test file: "+err);
									}
								});
								count++;
								if (count > 20) {
									clearInterval(clrInterval);
								}
							},1000);
							loggingUtilities.checkValidLogFiles().then( () => {
								return resolve();
							}).catch( err => {
								return reject("Error checking log files: "+err);
							});
						}
					})
				}
			}
		})
	},

	checkValidLogFiles: function() {
		return new Promise((resolve, reject) => {
			let logDirPath = path.join(loggingUtilities.cwd,loggingUtilities.logDirectory);
			fs.readdir(logDirPath, function(err, logfiles) {
				if (err) {
					return reject("Error reading from directory "+logDirPath+": "+err);
				} else {
					if (logfiles.length > loggingUtilities.maxKeptFiles) {
						console.log("[LOGGING] Found "+logfiles.length+" which is above max "+loggingUtilities.maxKeptFiles);
						let numFilesToDelete = logfiles.length-loggingUtilities.maxKeptFiles;
						let minDate = 1**10; //big number
						let maxDate = -minDate;
						let minDateInd = 0;
						let maxDateInd = 0;

						let dateObjects = [];
						let skipDateObjects = [];
						for (var i=0; i<logfiles.length; i++) {
							let filePath = path.join(logDirPath,logfiles[i]);

							if (!validateDate(logfiles[i])) { //logfile invalid
								dateObjects.push({getTime: function(){return -1}}); //blank fn
								skipDateObjects.push(i);

								console.warn("Invalid log file detected (name invalid): "+logfiles[i]);
								fs.unlink(filePath, err => {
									if (err) {
										console.error("Error unlinking logfile at path: "+filePath+", err: "+err);
									}
								});
								numFilesToDelete--; //subtract from numFiles
							} else {
								dateObjects.push(convertDateToObject(logfiles[i])); //cvt date to object
								let dObjTime = dateObjects[i].getTime();
								if (dObjTime < minDate) {
									minDate = logfiles[i];
									minDateInd = i;
								}
								if (dObjTime > maxDate) {
									maxDate = logfiles[i];
									maxDateInd = i;
								}
							}
						}
						console.log("Min date: "+minDate+", ind="+minDateInd+", Max date: "+maxDate+", ind="+maxDateInd);
						if (numFilesToDelete > 0) {
							for (var j=0; j<numFilesToDelete; j++) {
								console.log("Deleting file at index "+minDateInd+" because it is too old (name "+minDate+")");
								let filePath = path.join(logDirPath,logfiles[minDateInd]);
								skipDateObjects.push(minDateInd);
								fs.unlink(filePath, err => {
									if (err) {
										console.error("Error unlinking logfile at path: "+filePath+", err: "+err);
									}
								});

								//RECALCULATE MIN+MAX DATES

								minDate = 1**10; //big number
								maxDate = -minDate;
								minDateInd = 0;
								maxDateInd = 0;

								for (var i=0; i<dateObjects.length; i++) {
									if (skipDateObjects.indexOf(i) > -1) {
										continue;
									} else {
										let dObjTime = dateObjects[i].getTime();
										if (dObjTime < minDate) {
											minDate = logfiles[i];
											minDateInd = i;
										}
										if (dObjTime > maxDate) {
											maxDate = logfiles[i];
											maxDateInd = i;
										}
									}
								}
							}
						}
						return resolve()
					} else {
						return resolve();
					}
				}
			});
			return resolve();
		})
	},

	log: function(logFn) {
		
	}
}

var monthNames = [ //month data
	"January", "February", "March",
	"April", "May", "June", "July",
	"August", "September", "October",
	"November", "December"
];
var monthNamesShort = [
	"Jan", "Feb", "Mar",
	"Apr", "May", "Jun", "Jul",
	"Aug", "Sep", "Oct",
	"Nov", "Dec"
];

function getCurrentDate(shortDate) {
	if (typeof shortDate == "undefined") {
		shortDate = true;
	}
	let date = new Date(); //get current date
	let day = date.getDate();
	let monthIndex = date.getMonth();
	let year = date.getFullYear();
	let hours = date.getHours();
	let minutes = date.getMinutes();
	let seconds = date.getSeconds();
	return (day + '-' + ((shortDate) ? monthNamesShort[monthIndex] : monthNames[monthIndex]) + '-' + year + '-' + hours + ':' + minutes + ':'
	+ seconds);
}

function validateDate(date) {
	try {
		if (typeof date == "undefined") {
			return false;
		}
		let splitDate = date.split("-");
		if (splitDate.length != 4) {
			return false;
		}
		if (Number(splitDate[0]) < 0 || Number(splitDate[0] > 31)) { //validate days
			return false;
		}
		if (monthNames.indexOf(splitDate[1]) < 0 && monthNamesShort.indexOf(splitDate[1]) < 0) { //validate month
			return false;
		}
		if (Number(splitDate[2]) < 2000 || Number(splitDate[2] > 4000)) { //validate year (hey if you are reading this in 4000 hi from 2018)
			return false;
		}
		let splitTime = splitDate[3].split(":");
		if (splitTime.length != 3) {
			return false;
		}
		for (var i=0; i<splitTime.length; i++) {
			if (Number(splitTime[i]) < 0 || Number(splitTime[i]) > 60) { //hey ik that the first number can also be 60 but whatever
				return false;
			}
		}
		return true; //passed all tests
	} catch(e) {
		return false; //hey did you pass in null you sneak?
	}
}

function convertDateToObject(date) {
	if (validateDate(date)) {
		try {
			let splitDate = date.split("-");
			let splitTime = splitDate[3].split(":");
			let monthIndex = monthNamesShort.indexOf(splitDate[1]);
			if (monthIndex < 0) {
				monthIndex = monthNames.indexOf(splitDate[1]);
			}
			var d = new Date(splitDate[2], monthIndex, splitDate[0], splitTime[0], splitTime[1], splitTime[2]) //create date object with format: y, m, d, h, m, s, (ms)
			console.log("Date object "+d.toString()+" created from date "+date);
			return d;
		} catch(e) {
			return -1;
		}
	} else {
		return -1;
	}
}

module.exports = loggingUtilities;