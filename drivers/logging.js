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
const stripColor = require('strip-color');
const stripAnsi = require('strip-ansi');

var loggingUtilities = {
	logFunctionOriginal: undefined,
	secondaryLogFunctionOriginal: undefined,
	infoFunctionOriginal: undefined,
	warnFunctionOriginal: undefined,
	errorFunctionOriginal: undefined,
	maxLogFileLength: undefined,
	logDirectory: undefined,
	debugMode: false,
	cwd: undefined,
	validationInterval: -1,
	validationTime: -1,
	maxKeptFiles: 5,
	ignoreFileString: "save", //string that will prevent deletion of file

	writeInformation: {
		currentFile: undefined, //current file that we are writing to
		currentFileStream: undefined,
		currentBytesWritten: 0
	},

	init: function(cwd, extSettings) {
		return new Promise((resolve, reject) => {
			if (typeof extSettings == "undefined" || typeof cwd == "undefined") {
				return reject("Settings or CWD undefined on init");
			} else {
				if (typeof extSettings.logDirectory == "undefined" || typeof extSettings.maxKeptFiles == "undefined", typeof extSettings.logValidationInterval == "undefined" || typeof extSettings.loggerBaseFunctions == "undefined" || typeof extSettings.maxLogFileLength == "undefined") {
					return reject("LogDirectory or maxKeptFiles or logValidationInterval or maxLogFileLength or loggerBaseFunctions undefined in settings");
				} else {
					loggingUtilities.logDirectory = extSettings.logDirectory;
					loggingUtilities.maxKeptFiles = Number(extSettings.maxKeptFiles);
					loggingUtilities.validationTime = Number(extSettings.logValidationInterval);
					loggingUtilities.maxLogFileLength = Number(extSettings.maxLogFileLength);
					loggingUtilities.cwd = cwd;

					let baseFunctions = extSettings.loggerBaseFunctions; //construct base function prototypes
					for (var i=0; i<baseFunctions.length; i++) {
						loggingUtilities[baseFunctions[i]] = (dat, type) => {
							type = type.toUpperCase() || "UND";
							if (dat.length > 1) {
								var stripArg = dat;
								for (var j=0; j<stripArg.length; j++) {
									try {
										stripArg[j] = stripColor(stripAnsi(stripArg[j]));
									} catch(e) {
										continue;
									}
								}
								loggingUtilities.logRaw("["+type+"] "+JSON.stringify(stripArg));
							} else {
								try {
									loggingUtilities.logRaw("["+type+"] "+stripColor(stripAnsi(dat[0])));
								} catch(e) {
									loggingUtilities.logRaw("["+type+"] "+dat[0]);
								}
							}
						}
						if (loggingUtilities.debugMode) {
							console.log("[LOGGER] Setup baseFunction "+baseFunctions[i]);
						}
					}

					let logPath = path.join(cwd,extSettings.logDirectory);
					fs.stat(logPath, (err, stats) => {
						if (err) {
							console.log("[LOGGER] Logging directory is missing, creating a new one");
							fs.mkdir(logPath, err => {
								if (err) {
									return reject("Error creating logfile directory: "+err);
								} else {
									return resolve();
								}
							});
						} else { //it exists
							if (loggingUtilities.debugMode) {
								console.log("Logging directory exists; checking if there are more logfiles than there should be...");
							}
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
					if (loggingUtilities.maxKeptFiles < 0) { //less than 0 infinite files
						if (loggingUtilities.debugMode) {
							console.log("[LOGGER] MaxKeptFiles < 0, will not delete files based on date");
						}
						for (var i=0; i<logfiles.length; i++) { //just iterate to find invalid files
							let filePath = path.join(logDirPath,logfiles[i]);

							if (loggingUtilities.debugMode) {
								console.log("INDEX: "+logfiles[i].indexOf(loggingUtilities.ignoreFileString));
							}
							if (logfiles[i].indexOf(loggingUtilities.ignoreFileString) == -1) {
								if (!validateDate(logfiles[i]) && logfiles[i].indexOf(loggingUtilities.ignoreFileString) == -1) { //logfile invalid
									dateObjects.push({getTime: function(){return -1}}); //blank fn
									skipDateObjects.push(i);

									console.warn("Invalid log file detected (name invalid): "+logfiles[i]);
									fs.unlink(filePath, err => {
										if (err) {
											console.error("Error unlinking logfile at path: "+filePath+", err: "+err);
										}
									});
									numFilesToDelete--; //subtract from numFiles
								}
							}
						}
					} else {
						if (logfiles.length > loggingUtilities.maxKeptFiles) {
							if (loggingUtilities.debugMode) {
								console.log("[LOGGER] MaxKeptFiles > 0, will delete files based on date");
								console.log("[LOGGING] Found "+logfiles.length+" which is above max "+loggingUtilities.maxKeptFiles);
							}
							let numFilesToDelete = logfiles.length-loggingUtilities.maxKeptFiles;
							let minDate = 10**50; //big number
							let maxDate = -minDate;
							let minDateInd = 0;
							let maxDateInd = 0;

							let dateObjects = [];
							let skipDateObjects = [];
							for (var i=0; i<logfiles.length; i++) {
								let filePath = path.join(logDirPath,logfiles[i]);

								if (logfiles[i].indexOf(loggingUtilities.ignoreFileString) > -1) {
									dateObjects.push({getTime: function(){return -1}}); //blank fn
									skipDateObjects.push(i);
								} else if (!validateDate(logfiles[i])) { //logfile invalid
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
									if (loggingUtilities.debugMode) {
										console.log("time detected from file "+dObjTime+", mindate: "+minDate+", maxDate: "+maxDate);
									}
									if (dObjTime < minDate) {
										minDate = dObjTime;
										minDateInd = i;
									}
									if (dObjTime > maxDate) {
										maxDate = dObjTime;
										maxDateInd = i;
									}
								}
							}
							if (loggingUtilities.debugMode) {
								console.log("(After prelim scan) Min date: "+minDate+", ind="+minDateInd+", Max date: "+maxDate+", ind="+maxDateInd);
							}
							if (numFilesToDelete > 0) {
								for (var j=0; j<numFilesToDelete; j++) {
									if (loggingUtilities.debugMode) {
										console.log("[LOGGING] SkipDateObjects: "+JSON.stringify(skipDateObjects));
									}
									if (skipDateObjects.indexOf(minDateInd) == -1) {
										if (loggingUtilities.debugMode) {
											console.log("[LOGGING] Deleting logfile at index "+minDateInd+" because it is too old (name "+logfiles[minDateInd]+")");
										}
										let filePath = path.join(logDirPath,logfiles[minDateInd]);
										skipDateObjects.push(minDateInd);
										fs.unlink(filePath, err => {
											if (err) {
												console.error("Error unlinking logfile at path: "+filePath+", err: "+err);
											}
										});
									} else {
										if (loggingUtilities.debugMode) {
											console.log("[LOGGING] skipping logfile deletion at index "+minDateInd+" because it is in skipDateObjects");
										}
									}

									//RECALCULATE MIN+MAX DATES

									minDate = 10**50; //big number
									maxDate = -minDate;
									minDateInd = 0;
									maxDateInd = 0;

									for (var i=0; i<dateObjects.length; i++) {
										if (skipDateObjects.indexOf(i) > -1 || dateObjects[i] == -1) {
											continue;
										} else {
											let dObjTime = dateObjects[i].getTime();
											if (dObjTime < minDate) {
												minDate = dObjTime;
												minDateInd = i;
											}
											if (dObjTime > maxDate) {
												maxDate = dObjTime;
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
				}
			});
			return resolve();
		})
	},

	logRaw: function (data) { //will actually log data (NO console.log inside function because it will be a circular dependency)
		//1st case: file handle is undefined, create a new handle
		let date = new Date(); //get current date
		let day = date.getDate();
		let monthIndex = date.getMonth();
		let year = date.getFullYear();
		let hours = date.getHours();
		let minutes = date.getMinutes();
		let seconds = date.getSeconds();

		let fullDate = (day + '-' + monthNames[monthIndex] + '-' + year + ' ' + hours + ':' + minutes + ':'+ seconds);
		let fullDateShort = (day + '-' + monthNamesShort[monthIndex] + '-' + year + ' ' + hours + ':' + minutes + ':'+ seconds);
		if (typeof loggingUtilities.writeInformation.currentFile == "undefined" || isNaN(loggingUtilities.writeInformation.currentBytesWritten) || typeof loggingUtilities.writeInformation.currentBytesWritten == "undefined" || loggingUtilities.writeInformation.currentBytesWritten < 0 || typeof loggingUtilities.writeInformation.currentFileStream == "undefined") {
			loggingUtilities.writeInformation.currentBytesWritten = 0; //reset bytes written
			let fileName = getCurrentDateFilename(); //get date as filename
			let filePath = path.join(loggingUtilities.cwd,loggingUtilities.logDirectory,fileName);

			let streamStartInfo = "CAROS - Node.JS Logger V1\nBy Aaron Becker\nProcess started at "+fullDate;
			loggingUtilities.writeInformation.currentFile = fileName;
			fs.writeFile(filePath, streamStartInfo, err => {
				if (err) {
					console.error("Error writing to log: "+err);
				} else {
					loggingUtilities.writeInformation.currentBytesWritten+=streamStartInfo.length;
					loggingUtilities.writeInformation.currentFileStream = fs.createWriteStream(filePath, {flags:'a'}); //use stream :) so as not to open too many file handlers
					loggingUtilities.logRaw(data); //actually process data once file is established
				}
			})
		} else if (loggingUtilities.writeInformation.currentBytesWritten > loggingUtilities.maxLogFileLength) {
			loggingUtilities.writeInformation.currentFileStream.end(); //end stream
			loggingUtilities.writeInformation.currentBytesWritten = -1; //make sure it resets
			loggingUtilities.logRaw(data);

		} else { //regular log
			if (loggingUtilities.writeInformation.currentBytesWritten+data.length > loggingUtilities.maxLogFileLength) {
				/*loggingUtilities.writeInformation.currentBytesWritten = loggingUtilities.maxLogFileLength+1; //write into a new file if it's too long
				loggingUtilities.logRaw(data);*/
				//noped this because it could lead to infinite recursion (if data is greater than max file length, which kinda defeats the purpose)

				let fullData = "\n["+fullDateShort+"] "+data;
				loggingUtilities.writeInformation.currentFileStream.write(fullData);
				loggingUtilities.writeInformation.currentBytesWritten+=fullData.length; //can go over max limit a bit but won't crash server
			} else { //hey it fits
				let fullData = "\n["+fullDateShort+"] "+data;
				loggingUtilities.writeInformation.currentFileStream.write(fullData);
				loggingUtilities.writeInformation.currentBytesWritten+=fullData.length;
			}
		}
	},

	registerValidationInterval: function() {
		clearInterval(loggingUtilities.validationInterval); //try to clear first
		if (loggingUtilities.debugMode) {
			console.log("Registering logValidationInterval with a timeout of "+loggingUtilities.validationTime+"ms");
		}
		loggingUtilities.validationInterval = setInterval(loggingUtilities.checkValidLogFiles, loggingUtilities.validationTime);
	},

	removeValidationInterval: function() {
		clearInterval(loggingUtilities.validationInterval); //clear it
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

function getCurrentDateFilename(shortDate) {
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
	return (day + '-' + ((shortDate) ? monthNamesShort[monthIndex] : monthNames[monthIndex]) + '-' + year + '-' + hours + ':' + minutes + ':' + seconds);
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
			} else if (isNaN(Number(splitTime[i]))) {
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
			if (loggingUtilities.debugMode) {
				console.log("Date object "+d.toString()+" created from date "+date);
			}
			return d;
		} catch(e) {
			return -1;
		}
	} else {
		return -1;
	}
}

//FOR DEBUG ONLY: creates fake log files to test function of log deletion
function createFakeLogs(amount) {
	amount = amount || 20;
	var count = 0;
	var clrInterval = setInterval( () => {
		var date = getCurrentDateFilename();
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
}

module.exports = loggingUtilities;