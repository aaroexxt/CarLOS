#!/usr/bin/env node
/*
* COSserver.js by Aaron Becker
* CarOS Node.JS Server
*
* Dedicated to Marc Perkel
*/

/*
 * Copyright (c) 2018 Aaron Becker <aaron.becker.developer@gmail.com>
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

/*
---- CODE LAYOUT ----

This descriptor describes the layout of the code in this file.
2 main phases: Initialization (I1-I9) and Runtime Code (R1-R2)
	Sub-phase: SocketIO Subsections (R2:S1-R2:S2)

Initialization (12 steps):
1) Module Initialization: initalizes modules that are required later on
2) Runtime Info/Settings: Reads and parses runtime information and settings from external JSON file
3) Console Colors: overrides prototypes for console to provide colors in console
4) File Logging Setup: Initializes file logging handlers for functions that output to console
4) Serial Device Logic: Reads command line arguments and determines valid serial devices to connect to. Also opens a serial port if a valid device is found
5) Arduino Command Handling: defines handling of arduino commands
6) Data File Parsers: parses files that contain information like data for commands and responses for speech matching
7) Neural Network Setup: sets up and trains neural network for processing of speech commands
8) Reading From Stdin: initializes handlers for reading from stdin (arduino commands from stdin)
9) Error and Exit Handling: initializes error & exit (Ctrl+C) handlers
10) Soundcloud Init Code: Initializes soundcloud (from ext file soundcloudUtils) and starts caching of soundcloud files to server
11) OpenCV Init Code: Initializes and trains OpenCV model for facial recognition
12) Oled Driver Init: Initializes OLED driver for external oled display. (update set in misc init code)
13) Misc. Init Code: Initializes loops for tracking runtimeInformation and sending to clients, as well as listener for terminal resize. Also sends information to oled

Runtime Code (2 steps):
1) HTTP Server Setup/Handling: sets up the HTTP server, also sets up socket.io connection
2) Socket.IO Connection Logic: large chunk of code which responds to client websocket connections
	--SocketIO Subsections--
	1) Web/Python Init Logic: Connection logic for determining type of connection
	2) Action Handlers: Handlers for requests from web and python clients
*/

/**********************************
--I1-- MODULE INITIALIZATION --I1--
**********************************/
var fs = require('fs');
var utils = require('./drivers/utils.js'); //include the utils file

var singleLineLog = require('single-line-log').stdout; //single line logging

var securityOff = true; //PLEASE REMOVE THIS, FOR TESTING ONLY
var catchErrors = false; //enables clean error handling. Only turn off during development
var displayAuthkeyValidMessages = false;

var cwd = __dirname;
process.title = "CarOS V1";
var sockets = [];
var pyimgnum = 0; //python image counter

var userPool = new utils.authPool(); //AuthPool that keeps track of sessions and users

var socketHandler = new utils.socketHandler(userPool,sockets); //socketHandler which keeps track of sockets and userPool and can send messages to specific clients

//CONFIGURING WATCHDOG

var watchdog = require('native-watchdog');
watchdog.start(60000); //will watch process

/**********************************
--I2-- RUNTIME INFO/SETTINGS --I2--
**********************************/
var PRODUCTIONMODE = false;
var runtimeSettings = {
	faces: "",
	passes: "",
	maxVideoAttempts: "",
	maxPasscodeAttempts: "",
	defaultDataDirectory: "/data"
}; //holds settings like maximum passcode tries
var runtimeInformation = {
	frontendVersion: "?",
	backendVersion: "?",
	heartbeatMS: "?",
	nodeConnected: true,
	pythonConnected: false,
	arduinoConnected: false, //set here and not in settings.json so it is not overridden
	arduinoSensorData: {},
	arduinoSensorStatus: {}
}; //holds information like version
var soundcloudSettings = {
	clientID: "?",
	defaultUsername: "?",
	noArtworkUrl: "?",
	defaultVolume: "?",
	volStep: "?"
}

try {
	var settingsData = fs.readFileSync(cwd+runtimeSettings.defaultDataDirectory+"/settings.json");
} catch(e) {
	console.error("[FATAL] Error reading info/settings file");
	throw "[FATAL] Error reading info/settings file";
}

settingsData = JSON.parse(settingsData);
if (typeof settingsData.settings.unscrambleKeys == "undefined") {
	console.error("UnscrambleKeys undefined in runtimeSettings, not unscrambling. This may result in no users being able to login");
	throw "UnscrambleKeys undefined in runtimeSettings, not unscrambling. This may result in no users being able to login";
} else {
	var keys = Object.keys(settingsData.settings);
	for (var i=0; i<keys.length; i++) {
		if (settingsData.settings.unscrambleKeys.indexOf(keys[i]) > -1) {
			runtimeSettings[keys[i]] = [];
			for (var j=0; j<settingsData.settings[keys[i]].length; j++) {
				runtimeSettings[keys[i]][j] = utils.atob(settingsData.settings[keys[i]][j]); //undo atob encryption
			}
		} else {
			runtimeSettings[keys[i]] = settingsData.settings[keys[i]]; //undo atob encryption
		}
	}
}

var keys = Object.keys(settingsData.information); //only override keys from settingsData
for (var i=0; i<keys.length; i++) {
	runtimeInformation[keys[i]] = settingsData.information[keys[i]];
}

var keys = Object.keys(settingsData.soundcloudSettings); //only override keys from settingsData
for (var i=0; i<keys.length; i++) {
	soundcloudSettings[keys[i]] = settingsData.soundcloudSettings[keys[i]];
}

PRODUCTIONMODE = settingsData.PRODUCTION; //production mode?
runtimeSettings.productionMessage = settingsData.productionMessage;

if (!runtimeSettings.disableToobusy) {
	//CONFIGURING TOOBUSY
	var toobusy = require('toobusy-js');
	var tooBusyLatestLag = 0;
	toobusy.onLag(function(currentLag) {
		currentLag = Math.round(currentLag);
		if (!PRODUCTIONMODE) {
			console.log("Lag detected on event loop, declining new requests. Latency: " + currentLag + "ms");
		}
		tooBusyLatestLag = currentLag;
	});
} else {
	console.info("TooBusyJS disabled; will not throttle server to remove high loads");
	var tooBusyLatestLag = -1;
}

//console.clear();
console.log("~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-\nCarOS V1\nBy Aaron Becker\nPORT: "+runtimeSettings.serverPort+"\nCWD: "+cwd+"\n~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-\n");

/***************************
--I3-- CONSOLE COLORS --I3--
****************************/

var colors = require('colors');

const originalWarn = console.warn;
const originalErr = console.error;
const originalInfo = console.info;
const originalLog = console.log;

if (PRODUCTIONMODE) {
	if (runtimeSettings.productionMessage && runtimeSettings.productionMessage[0] && runtimeSettings.productionMessage[1]) {
		originalLog(colors.italic.bold.green(runtimeSettings.productionMessage[0]))
		for (var i=1; i<runtimeSettings.productionMessage.length-1; i++) {
			originalLog(runtimeSettings.productionMessage[i]);
		}
		originalLog(colors.italic.bold.green(runtimeSettings.productionMessage[runtimeSettings.productionMessage.length-1]));
	} else {
		originalErr(colors.red("No runtimeMessage provided in json config when it is required"));
	}
	originalLog(colors.blue("PRODUCTION_MODE is enabled, will only show important information"));
	runtimeSettings.logLevel = 1; //set to errors only
	singleLineLog.clear();
	setInterval( () => {
		var statusStr = "-- Status: "+colors.green(runtimeInformation.status)+" ~~ Uptime: "+colors.green(runtimeInformation.uptime)+" ~~ Users: "+colors.green(runtimeInformation.users)+" ~~ Lag: ";
		if (tooBusyLatestLag < 50) {
			statusStr += colors.green(tooBusyLatestLag);
		} else if (tooBusyLatestLag < 100) {
			statusStr += colors.yellow(tooBusyLatestLag);
		} else if (tooBusyLatestLag < 500) {
			statusStr += colors.magenta(tooBusyLatestLag);
		} else if (tooBusyLatestLag < 1000) {
			statusStr += colors.red(tooBusyLatestLag);
		} else {
			statusStr += colors.red.underline(tooBusyLatestLag);
		}
		statusStr += " --";
		singleLineLog(statusStr);
	},500);
}

if (runtimeSettings.logLevel < 4) {
	originalLog(colors.cyan("Overriding console.log because logLevel="+runtimeSettings.logLevel+" is too low"));
	console.log = function(){};
}

if (runtimeSettings.logLevel >= 3) {
	console.info = function(){
		if (arguments.length > 1) {
			var firstArg = arguments[0];
			var restArgs = [];
			for (var i=1; i<arguments.length; i++) {
				restArgs.push(arguments[i]);
			}
			originalInfo(colors.blue.underline(firstArg),restArgs);
		} else {
			originalInfo(colors.blue.underline(arguments[0]));
		}
	}
} else {
	originalLog(colors.cyan("Overriding console.info because logLevel="+runtimeSettings.logLevel+" is too low"));
	console.info = function(){};
}

if (runtimeSettings.logLevel >= 2) {
	console.warn = function(){
		if (arguments.length > 1) {
			var firstArg = arguments[0];
			var restArgs = [];
			for (var i=1; i<arguments.length; i++) {
				restArgs.push(arguments[i]);
			}
			originalWarn(colors.yellow.underline(firstArg),restArgs);
		} else {
			originalWarn(colors.yellow.underline(arguments[0]));
		}
	}
} else {
	originalLog(colors.cyan("Overriding console.warn because logLevel="+runtimeSettings.logLevel+" is too low"));
	console.warn = function(){}; //redir to empty function
}

if (runtimeSettings.logLevel >= 1) {
	console.error = function(){
		if (arguments.length > 1) {
			var firstArg = arguments[0];
			var restArgs = [];
			for (var i=1; i<arguments.length; i++) {
				restArgs.push(arguments[i]);
			}
			originalErr(colors.red.underline(firstArg),restArgs);
		} else {
			originalErr(colors.red.underline(arguments[0]));
		}
	}
} else {
	originalLog(colors.cyan("Overriding console.error because logLevel="+runtimeSettings.logLevel+" is too low"));
	originalWarn(colors.yellow.underline("[WARNING] No logging enabled, will not show any more messages. You might want to disable this to logLevel=1 because you won't see any errors"));
	console.error = function(){}; //redir to empty function
}

console.importantInfo = function(){
	if (arguments.length > 1) {
		var firstArg = arguments[0];
		var restArgs = [];
		for (var i=1; i<arguments.length; i++) {
			restArgs.push(arguments[i]);
		}
		originalInfo("\n"+colors.cyan.bold.underline(firstArg),restArgs);
	} else {
		originalInfo("\n"+colors.cyan.bold.underline(arguments[0]));
	}
}
console.importantLog = function(){
	if (arguments.length > 1) {
		var firstArg = arguments[0];
		var restArgs = [];
		for (var i=1; i<arguments.length; i++) {
			restArgs.push(arguments[i]);
		}
		originalLog("\n"+colors.white.bold(firstArg),restArgs);
	} else {
		originalLog("\n"+colors.white.bold(arguments[0]));
	}
}

/********************************
--I4-- FILE LOGGING SETUP --I4--
********************************/

const loggingUtils = require("./drivers/logging.js");

const semiOriginalLog = console.log;
const semiOriginalWarn = console.warn;
const semiOriginalInfo = console.info;
const semiOriginalError = console.error;
const semiOriginalIInfo = console.importantInfo;
const semiOriginalILog = console.importantLog;

loggingUtils.init(cwd, runtimeSettings).then( () => {
	console.importantLog("Logging master init ok (1/4)");

	try {
		console.log = function() {
			loggingUtils.log(arguments,"log");
			semiOriginalLog.apply(null, arguments);
		}

		console.warn = function() {
			loggingUtils.warn(arguments,"warn");
			semiOriginalWarn.apply(null, arguments);
		}

		console.error = function() {
			loggingUtils.warn(arguments,"error");
			semiOriginalWarn.apply(null, arguments);
		}

		console.importantLog = function() {
			loggingUtils.warn(arguments,"ilog");
			semiOriginalWarn.apply(null, arguments);
		}

		console.importantInfo = function() {
			loggingUtils.warn(arguments,"iinfo");
			semiOriginalWarn.apply(null, arguments);
		}

		console.importantLog("Logging commands init ok (2/4)");

		loggingUtils.registerValidationInterval();
		console.importantLog("Logging validationListener init ok (3/4)");



		console.importantInfo("LOGGING INIT OK");
	} catch(e) {
		console.error("Logging init error: "+e);
	}
	
}).catch( err => {
	console.error("Error initializing logger: "+err);
})

/********************************
--I5-- SERIAL DEVICE LOGIC --I5--
********************************/

var serialDevice = "none";
var foundJSON = false;
process.argv.forEach(function (val, index, array) {
	function processDeviceJSON(raw) {
		try {
			var json = JSON.parse(raw.trim());
		} catch(e) {
			console.log("Error parsing JSON. E: "+e+", raw: "+raw);
			var json = "";
		}
		for (var i=0; i<json.length; i++) {
			var device = json[i].comName;
			var manufacturer = json[i].manufacturer || "No manufacturer found";
			console.log("Device parsed from json: "+device+", manufacturer: "+manufacturer);
			if (manufacturer.toLowerCase().indexOf("arduino") > -1) {
				console.log("Arduino found!");
				runtimeInformation.arduinoConnected = true;
				serialDevice = device;
			}
		}
	}
	var ind = val.indexOf("serial=");
	var ind2 = val.indexOf("listtype=");
	if (ind > -1) {
		serialDevice = val.split("=")[1];
		if (foundJSON) {
			processDeviceJSON(serialDevice);
		} else {
			runtimeInformation.arduinoConnected = true;
		}
	} else if (ind2 > -1) {
		var listType = val.split("=")[1];
		if (listType == "JSON") {
			console.log("JSON list detected");
			if (serialDevice == "" || serialDevice == "none") { //process later
				foundJSON = true;
			} else {
				processDeviceJSON(serialDevice);
			}
		}
	}
});

/*************************************
--I6-- ARDUINO COMMAND HANDLING --I6--
*************************************/

var arduinoUtils = require('./drivers/arduino.js').utilities; //require the driver
console.log("Serial device from start script: "+serialDevice);
arduinoUtils.init(runtimeSettings, runtimeInformation).then(() => {
	console.importantLog("Arduino driver initialized successfully (1/3)");
	if (serialDevice == "" || serialDevice == "none" || runtimeInformation.arduinoConnected == false) {
		console.warn("[WARNING] Server running without arduino. Errors may occur. Once you have connected an arduino, you have to relaunch the start script.");
		console.importantInfo("ARDU INIT ERR: NO ARDU CONNECTED")
		arduinoUtils.setArduinoFakeClass();
	} else {
		arduinoUtils.connectArduino(serialDevice, runtimeSettings, runtimeInformation).then( () => {
			console.importantLog("Arduino connected successfully (2/3)");
			arduinoUtils.enableSensorUpdates(runtimeSettings, runtimeInformation).then( () => {
				console.importantLog("Arduino sensor updates enabled (3/3)");
				console.importantInfo("ARDU INIT OK");
			}).catch( err => {
				console.error("Ardu init error (enabling sensorupdates): "+err);
			});
		}).catch( err => {
			console.error("Failed to connect to arduino for the following reason: '"+err+"'");
		});
	}
}).catch( err => {
	console.error("Arduino driver failed to initialize for the following reason: '"+err+"'");
}) //setup arduino object and libs

/******************************
--I7-- DATA FILE PARSERS --I7--
******************************/

fs.readFile(cwd+runtimeSettings.defaultDataDirectory+"/responses.json", function(err,data){
	if (err) {
		console.error("[FATAL] Error reading responses file");
		throw "[FATAL] Error reading responses file";
	} else {
		var responseData = [];
		var commands = JSON.parse(data); //read data and set approval object
		for (var i=0; i<commands.length; i++) {
			responseData.push(commands[i]);
		}
		console.log("[SPEECHPARSE] Sentences in response data: "+responseData.length);
		console.log("[SPEECHPARSE] Preprocessing data...");
		speechParser.algorithm.preprocessData(responseData);
		console.log("[SPEECHPARSE] Data preprocessed successfully.");
	}
});

fs.readFile(cwd+runtimeSettings.defaultDataDirectory+"/commandGroup.json", function(err,data){
	if (err) {
		console.error("[FATAL] Error reading commandGroup file");
		throw "[FATAL] Error reading commandGroup file";
	} else {
		var lines = JSON.parse(data); //read data and set approval object
		var foundCommandGroup = false;
		var commands = [];
		for (var i=0; i<lines.length; i++) {
			if (lines[i].type == "commandGroup") {
				speechParser.algorithm.commandGroup = lines[i].commandGroup;
				foundCommandGroup = true;
			} else if (lines[i].type == "command") {
				commands.push([lines[i].command,lines[i].response,lines[i].arguments]);
			}
		}
		if (!foundCommandGroup) {
			throw "[FATAL] No commandGroup found in commandGroup file.";
		} else if (commands.length != speechParser.algorithm.commandGroup.length) {
			throw "[FATAL] CommandGroup length does not match command length. Are there commands missing from the commandGroup file? (command length: "+commands.length+", cg length: "+speechParser.algorithm.commandGroup.length;
		} else {
			speechParser.algorithm.commandFunctions = commands;
		}
	}
});

fs.readFile(cwd+runtimeSettings.defaultDataDirectory+"/commands.json", function(err,data){
	if (err) {
		console.error("[FATAL] Error reading commands file");
		throw "[FATAL] Error reading commands file";
	} else {
		var speechData = [];
		var commands = JSON.parse(data); //read data and set approval object
		for (var i=0; i<commands.length; i++) {
			speechData.push(commands[i]);
		}
		console.log("[SPEECHNET] Sentences in speech training data: "+speechData.length);
		console.log("[SPEECHNET] Preprocessing data...");
		neuralMatcher.algorithm.preprocessData(speechData);
		console.log("[SPEECHNET] Generating training data...");
		var td = neuralMatcher.algorithm.generateTrainingData(); //uses preprocessed data
		console.log("[SPEECHNET] Training net (won't show progress on chrome console)...");
		neuralMatcher.algorithm.trainNetAsync(speechClassifierNet, speechNetTargetError, td,
		function(net){
			/*var percent = speechNetTargetError/net.error;
			var chars = Math.round(windowSize.width*percent);
			var str = "";
			for (var i=0; i<chars-6; i++) {
				str+="#";
			}
			str+="> ";
			str+=String(Math.round(percent*100))
			str+="%"
			singleLineLog(str); //make it fancy*/
			//don't need singleLineLog for neural init
			//singleLineLog("training error: "+net.error+", iterations: "+net.iterations);
		},
		function(){
			console.importantInfo("NEURAL INIT OK");
			singleLineLog.clear();
			console.log("\n[SPEECHNET] Done training net. Ready for input.");
			speechNetReady = true;
		},
		function(){
			console.error("[SPEECHNET] Error training net asynchronously. Speech-related functions may break :(");
		})
	}
});

/*********************************
--I8-- NEURAL NETWORK SETUP --I8--
*********************************/

var speechParser = require('./drivers/speechParser.js'); //include speech parsing file
var neuralMatcher = require('./drivers/speechMatcher.js'); //include the speech matching file
neuralMatcher.algorithm.stemmer = neuralMatcher.stemmer;
var brain = require("brain.js");
var speechClassifierNet = new brain.NeuralNetwork(); //make the net
var speechNetTargetError = 0.005;//0.00001; //<- for release
var speechNetReady = false;

/*******************************
--I9-- READING FROM STDIN --I9--
*******************************/

var stdinput = process.openStdin();
var stdinputListener = new utils.advancedEventListener(stdinput,"data");
var sendArduinoMode = false;
stdinputListener.addPersistentListener("*",function(d) {
	var uI = d.toString().trim();
	console.log("you entered: [" + uI + "]");
	if (uI == "help") {
		console.importantLog("Right now, sA or sendArduinoMode toggles sending raw to arduino.")
	} else if (uI == "sA" || uI == "sendArduinoMode") {
		sendArduinoMode = !sendArduinoMode;
		console.importantLog("Send arduino mode toggled ("+sendArduinoMode+")");
	} else {
		if (sendArduinoMode) {
			arduinoUtils.sendCommand(uI);
		} else {
			console.importantLog("Command not recognized");
		}
	}
});


/************************************
--I10-- ERROR AND EXIT HANDLING --I10--
************************************/

process.on('SIGINT', function (code) { //on ctrl+c or exit
	console.importantLog("\nSIGINT signal recieved, graceful exit (garbage collection) w/code "+code);
	runtimeInformation.status = "Exiting";
	arduinoUtils.sendCommand("status","Exiting");
	sendOledCommand("status","Exiting");
	console.importantLog("Exiting in 1500ms (waiting for sockets to send...)");
	for (var i=0; i<sockets.length; i++) {
		sockets[i].socket.emit("pydata","q"); //quit python
		sockets[i].socket.emit("POST",{"action": "runtimeInformation", "information":runtimeInformation}); //send rti
		sockets[i].socket.emit("disconnect","");
	}
	watchdog.exit();
	setTimeout(function(){
		process.exit(); //exit completely
	},1500); //give some time for sockets to send
});

if (catchErrors) {
	process.on('uncaughtException', function (err) { //on error
		console.importantLog("\nError signal recieved, graceful exiting (garbage collection)");
		arduinoUtils.sendCommand("status","Error");
		sendOledCommand("status","Error");
		runtimeInformation.status = "Error";
		for (var i=0; i<sockets.length; i++) {
			sockets[i].socket.emit("pydata","q"); //quit python
			sockets[i].socket.emit("POST",{"action": "runtimeInformation", "information":runtimeInformation}); //send rti
			sockets[i].socket.emit("disconnect","");
		}
		console.importantLog("\nCRASH REPORT\n-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~\nError:\n"+err+"\n-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~\n");
		console.importantLog("Exiting in 1500ms (waiting for sockets to send...)");
		watchdog.exit();
		setTimeout(function(){
			process.exit(); //exit completely
		},1500); //give some time for sockets to send
	});
}

/***********************************
--I11-- SOUNDCLOUD INIT CODE --I11--
***********************************/
var soundcloudUtils = require('./drivers/soundcloud.js');

function initSoundcloud(username) {
	return new Promise((mresolve, mreject) => {
		if (typeof username == "undefined") {
			username = soundcloudSettings.defaultUsername;
		}
		var timesLeft = soundcloudSettings.initMaxAttempts;

		function initSCSlave() {
			console.info("Starting SC SLAVE (att "+(soundcloudSettings.initMaxAttempts-timesLeft+1)+"/"+soundcloudSettings.initMaxAttempts+")");
			soundcloudUtils.SCUtils.init({
				soundcloudSettings: soundcloudSettings,
				username: username,
				cwd: cwd,
				socketHandler: socketHandler
			}).then( () => {
				console.log(colors.green("Initialized Soundcloud successfully! Now initializing trackManager"));
				soundcloudUtils.SCSoundManager.init().then( () => {
					console.log(colors.green("Initialized trackManager successfully!"));
					soundcloudSettings.soundcloudReady = true;

					if (username == soundcloudSettings.defaultUsername) { //first init
						for (var i=0; i<soundcloudSettings.waitingClients.length; i++) { //send data to clients who were waiting for it
							socketHandler.socketEmitToID(soundcloudSettings.waitingClients[i], 'POST', {
								"action": "serverDataReady",
								hasTracks: true,
								likedTracks: soundcloudSettings.likedTracks,
								trackList: soundcloudSettings.trackList,
								settingsData: {
									currentUser: soundcloudSettings.currentUser,
									noArtworkUrl: soundcloudSettings.noArtworkUrl,
									defaultVolume: soundcloudSettings.defaultVolume,
									volStep: soundcloudSettings.volStep,
									currentVolume: soundcloudSettings.currentVolume,
									tracksFromCache: soundcloudSettings.tracksFromCache
								}
							});
						}
					} else {
						socketHandler.socketEmitToWeb('POST', {
							"action": "serverDataReady",
							hasTracks: true,
							likedTracks: soundcloudSettings.likedTracks,
							trackList: soundcloudSettings.trackList,
							settingsData: {
								currentUser: soundcloudSettings.currentUser,
								noArtworkUrl: soundcloudSettings.noArtworkUrl,
								defaultVolume: soundcloudSettings.defaultVolume,
								volStep: soundcloudSettings.volStep,
								currentVolume: soundcloudSettings.currentVolume,
								tracksFromCache: soundcloudSettings.tracksFromCache
							}
						});
					}

					mresolve();

				}).catch( e => {
					console.error("Error initializing trackManager: "+e+". won't restart");
				});
			}).catch( err => {
				timesLeft--;
				firstRun = true;
				if (timesLeft > 0) {
					console.error("[SCMASTER] Error initializing soundcloud ("+err+"). Trying again in "+soundcloudSettings.initErrorDelay+" ms.");
					setTimeout( () => {
						initSCSlave();
					}, soundcloudSettings.initErrorDelay);
				} else {
					console.error("[SCMASTER] Reached maximum tries for attempting soundcloud initialization. Giving up. (Err: "+err+")");
					mreject("MaxTries reached (giving up) with error message: "+err);
					if (username == soundcloudSettings.defaultUsername) { //first init
						for (var i=0; i<soundcloudSettings.waitingClients.length; i++) { //send data to clients who were waiting for it
							socketHandler.socketEmitToID(soundcloudSettings.waitingClients[i], 'POST', {
								"action": "serverSoundcloudError",
								error: "MaxTries reached (giving up) with error message: "+err
							});
						}
					} else {
						socketHandler.socketEmitToWeb('POST', {
							"action": "serverSoundcloudError",
							error: "MaxTries reached (giving up) with error message: "+err
						});
					}
				}
			});
		}
		initSCSlave(); //begin first slave
	});

}

console.info("Starting SC MASTER");
initSoundcloud().then( () => {
	console.importantInfo("SC INIT OK");
}).catch( err => {
	console.error("Error initializing SC: "+err);
});

/*******************************
--I12-- OpenCV Init Code --I12--
*******************************/

const cv = require('opencv4nodejs'); //require opencv
var openCVReady = false;

console.log("Initializing OpenCV");
const cvUtils = require('./drivers/openCV.js').CVUtils;
cvUtils.init(cwd, runtimeSettings).then( () => {
	console.importantInfo("CV INIT OK");
	openCVReady = true; //set ready flag
}).catch( err => {
	console.error("Error initializing OpenCV: "+err);
	openCVReady = false;
}); //initialize (async)

/*******************************
--I13-- OLED Driver Init --I13--
*******************************/

console.log("Initializing OLED");
var burninCounter = 0;
var preventBurnInMode = false;

if (runtimeSettings.runningOnRPI) {
	const oledDriver = require('./drivers/oled.js').driver;
	oledDriver.init(runtimeSettings);

	var oledUpdateInterval = setInterval(function(){
		if (!preventBurnInMode) {
			sendOledCommand("uptime",runtimeInformation.uptime);
			sendOledCommand("status",runtimeInformation.status);
			sendOledCommand("users",runtimeInformation.users);
			oledDriver.update();
		}

		burninCounter++;
		if (burninCounter > 60) {
			preventBurnInMode = true;
			oledDriver.preventBurnin();
		} else if (burninCounter > 62) {
			preventBurnInMode = false;
			burninCounter = 0; //reset counter
		}
	},runtimeSettings.oledUpdateTime);

	function sendOledCommand(command, info) {
		oledDriver.command(command, info);
	}
} else {
	console.log("Initialization of OLED skipped because server is not running on RPI");
	function sendOledCommand(command, info) {
		console.warn("[WARNING] sendOledCommand called without oLED display initialized. Data is literally going nowhere, errors may occur.");
	}
}

/******************************
--I14-- MISC. INIT CODE --I14--
******************************/

var statusUpdateInterval = setInterval(function(){
	var time = process.uptime();
	var uptime = utils.formatHHMMSS(time); //rts.uptime
	runtimeInformation.uptime = uptime;
	runtimeInformation.users = userPool.auth_keys.length //rts.users
	if (runtimeInformation.status.toLowerCase() != "running") {
		console.log("Sending runtimeinfo because of status change");
		socketHandler.socketEmitToAll('POST', {"action": "runtimeInformation", "information":runtimeInformation})
	}
},1000);
runtimeInformation.status = "Running";

var windowPlugin = require('window-size');
var windowSize = windowPlugin.get();
process.stdout.on('resize', function() {
	windowSize = windowPlugin.get();
	console.log("Updated terminal size to width: "+windowSize.width+", height: "+windowSize.height);
});

/***************************************
--R1-- HTTP SERVER SETUP/HANDLING --R1--
***************************************/

var express = require("express");
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var finalHandler = require('finalhandler');
var serveFavicon = require('serve-favicon');
//var url = require('url');

server.listen(runtimeSettings.serverPort, function() {
	console.log((new Date()) + ' Node server is listening on port ' + runtimeSettings.serverPort);
});

app.use(serveFavicon(cwd+runtimeSettings.faviconDirectory)); //serve favicon

app.use(express.static(cwd+runtimeSettings.assetsDirectory)); //define a static directory

app.use(function(req, res, next) {
  if (tooBusyLatestLag > runtimeSettings.tooBusyLagThreshold) {
    res.send(503, "Server is busy, cannot complete your request at this time. (Latency: "+tooBusyLatestLag+")");
    res.end();
  } else {
    next();
  }
});

app.get("/client", function(req, res) { //COS main route
	var done = finalHandler(req, res, {
		onerror: function(err) {
			console.log("[HTTP] Error: "+err.stack || err.toString())
		}
	});

	fs.readFile(cwd+runtimeSettings.defaultFileDirectory+"/"+runtimeSettings.defaultClientFile, function (err, buf) {
		if (err) {
			return done(err);
		} else {
			//res.setHeader('Content-Type', 'text/html')
			res.end(buf);
		}
	})
});

app.get("/console", function(req, res) { //console route
	var done = finalHandler(req, res, {
		onerror: function(err) {
			console.log("[HTTP] Error: "+err.stack || err.toString())
		}
	});

	res.send("Umm... It's not made yet, so check back later");
	res.end();
});

app.use(function(req, res, next){
  res.status(404); //crappy 404 page
  res.send("<h1>Uhoh, you tried to go to a page that doesn't exist.</h1><br> Navigate to /client to go to the main page.");
});

/***************************************
--R2-- SOCKET.IO CONNECTION LOGIC --R2--
***************************************/

io.on('connection', function (socket) { //on connection
	sockets[sockets.length] = {socket: socket, type: "uninitialized", status: "init", id: socket.id, handler: undefined, authkey: "uninitialized"};
	var socketid = sockets.length-1;
	var socketuid = socket.id;
	var track = sockets[socketid];
	track.handler = socketHandler;

	socketHandler.update(userPool,sockets); //update the handler

	/****************************************
	--R2:S1-- WEB/PYTHON INIT LOGIC --R2:S1--
	****************************************/

	socket.on('initweb', function (data) { //set up listener for web intialization
		track.status = "connected";
		track.type = "client";
		var myauth = new userPool.key(); //create new key
		myauth.properties.approved = false; //set approved parameter
		myauth.properties.videoAttemptNumber = 1; //video login attempt number
		myauth.properties.passcodeAttemptNumber = 1; //passcode login attempt number
		myauth.properties.socketID = socket.id; //socket id attached to key
		myauth.properties.allowOpenCV = true; //allow opencv to happen with key
		//console.log(myauth);
		myauth.init();
		track.authkey = myauth;
		//console.log("emitting to id: "+socket.id)
		socketHandler.socketEmitToID(socket.id,'webdata',{ //emit data to socket
			authkey: myauth.key,
			runtimeInformation: runtimeInformation
		});

		if (cv) {
			runtimeInformation.pythonConnected = true;
		} else {
			console.error("Error: cv module not found");
			throw "FATAL: cv module not found :(";
		}
	});
	socketHandler.update(userPool,sockets);

	/**********************************
	--R2:S2-- ACTION HANDLERS --R2:S2--
	**********************************/

	socket.on("GET", function (data) { //make it nice! like one unified action for all commands
		socketHandler.update(userPool,sockets); //update socketHandler
		var action = data.action;
		var key = data.authkey;
		if (typeof key == "undefined") {
			key = data.key;
		}
		var keyObject = userPool.findKey(key);
		var keyObjectValid = true;
		if (keyObject == null || typeof keyObject == "undefined") {
			keyObjectValid = false;
		}
		var validKey = userPool.validateKey(key);
		var processeddata = data.data;
		//console.log("OPENCVALLOWED? "+((keyObjectValid == true)?keyObject.properties.allowOpenCV:"invalid keyObject"))
		//console.log("TRACK TYPE: "+track.type);
		if ((track.type == "uninitialized" || true)) { //different actions based on tracking type, if uninit just give all
			switch(action) {
				/*GENERAL ACTIONS*/
				case "validatekey":
					var ok = validKey;
					if (ok == true) {
						if (displayAuthkeyValidMessages) {
							console.log("Validating authkey: "+key+", valid=true");
						}
						socketHandler.socketEmitToKey(key, 'POST', {"action": "validatekey", "valid": "true"});
					} else {
						if (displayAuthkeyValidMessages) {
							console.log("Validating authkey: "+key+", valid=false");
						}
						socketHandler.socketEmitToID(track.id,'POST', {"action": "validatekey", "valid": "false"});
					}
					break;
				case "readback":
					console.log("Reading back data: "+JSON.stringify(data));
				break;
				case "requestRuntimeInformation": //valid key not required
					console.log("Runtime information requested");
					socketHandler.socketEmitToWeb('POST', {"action": "runtimeInformation", "information": runtimeInformation});
				break;
				case "SCClientReady":
				if (validKey || securityOff) {
					if (soundcloudSettings.soundcloudReady) {
						console.log("SCClientReady request recieved; sending data");
						socketHandler.socketEmitToKey(key, 'POST', {
							"action": "serverDataReady",
							hasTracks: true,
							likedTracks: soundcloudSettings.likedTracks,
							trackList: soundcloudSettings.trackList,
							clientID: soundcloudSettings.clientID,
							settingsData: {
								currentUser: soundcloudSettings.currentUser,
								noArtworkUrl: soundcloudSettings.noArtworkUrl,
								defaultVolume: soundcloudSettings.defaultVolume,
								volStep: soundcloudSettings.volStep,
								currentVolume: soundcloudUtils.SCSoundManager.currentVolume,
								tracksFromCache: soundcloudSettings.tracksFromCache,
								playMusicOnServer: soundcloudSettings.playMusicOnServer,
								nextTrackShuffle: soundcloudSettings.nextTrackShuffle,
								nextTrackLoop: soundcloudSettings.nextTrackLoop,
								soundcloudReady: soundcloudSettings.soundcloudReady
							}
						});
					} else {
						console.log("SCClientReady request recieved; soundcloud is not ready");
						socketHandler.socketEmitToKey(key, 'POST', {
							"action": "serverLoadingTracklist"
						});
						soundcloudSettings.waitingClients.push(socket.id);
					}
				}
				break;

				case "SCClientUserEvent":
				if (validKey || securityOff) {
					if (data.type) {
						soundcloudUtils.SCSoundManager.processClientEvent({
							type: data.type,
							data: data.data,
							origin: "external"
						});
					} else {
						console.log("Type undefined sccliuserevent");
					}
				} else {
					console.error("keyObject invalid w/key '"+key+"'");
					socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "SCClientUserEventInvalidKeyObject"});
				}
				break;

				case "SCClientChangeUser":
				if (validKey || securityOff) {
					if (data.newUser) {
						console.info("Restarting SC MASTER with new user "+data.newUser);
						initSoundcloud(data.newUser).then( () => {
							console.importantInfo("SC INIT OK");
						}).catch( err => {
							console.error("Error initializing SC: "+err);
						});
					} else {
						console.log("NewUser undefined SCClientChangeUser");
					}
				} else {
					console.error("keyObject invalid w/key '"+key+"'");
					socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "SCClientChangeUserInvalidKeyObject"});
				}
				break;

				/*OPENCV HANDLERS*/
				//yes I know I can use single line comments
				case "login-imageready":
					if (securityOff) {console.warn("WARNING: opencv security protections are OFF");}
					if (keyObjectValid) {
						if (typeof keyObject.properties.videoAttemptNumber == "undefined") {
							console.error("keyObject videoAttemptNumber undefined, erroring");
							socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "OpenCVClientVideoAttemptPropertyUndefined"});
						} else {
							if ((validKey || securityOff) && keyObject.properties.videoAttemptNumber < runtimeSettings.maxVideoAttempts) {
								if (openCVReady) {
									if (keyObject.properties.allowOpenCV) {
										//console.log("recv imgdata");
										var raw = data.raw;
										raw = raw.replace(/^data:image\/\w+;base64,/, "");
										var imageBuffer = new Buffer(raw, 'base64');

										socketHandler.socketEmitToID(track.id,"POST",{ action: "login-opencvqueue", queue: pyimgnum });
										const currentImgNum = pyimgnum;

										keyObject.properties.allowOpenCV = false;

										const image = cv.imdecode(imageBuffer); //decode the buffer

										var maxVidAttempts = runtimeSettings.maxVideoAttempts;
										var vidAttempt = keyObject.properties.videoAttemptNumber;
										
										cvUtils.predictFaceFromData(image).then( result => {
											if (result == false) {
												keyObject.properties.allowOpenCV = true;
												keyObject.properties.videoAttemptNumber += 1;
												vidAttempt += 1;

												console.log("modified key "+key+" with attempt attrib (no face found)");
												socketHandler.socketEmitToKey(key, "POST", {action: 'login-opencvdata', queue: currentImgNum, confidences: confidence, buffer: imageBuffer.toString('base64'), labels: face, approved: false, totalAttempts: maxVidAttempts, attemptNumber: vidAttempt }); //use new unique id database (quenum) so authkeys are not leaked between clients
											} else {

												var face = result[0];
												var confidence = result[1];

												keyObject.properties.allowOpenCV = true;

												var foundFace = false;
												for (var j=0; j<runtimeSettings.faces.length; j++) {
													console.log("label "+face+", face "+runtimeSettings.faces[j])
													if (face === runtimeSettings.faces[j]) {
														foundFace = true;
														break;
													}
												}
												if (foundFace) {
													keyObject.properties.approved = true;
													console.log("modified key "+key+" with approved attrib");
													socketHandler.socketEmitToKey(key, "POST", {action: 'login-opencvdata', queue: currentImgNum, confidences: confidence, buffer: imageBuffer.toString('base64'), labels: face, approved: true, totalAttempts: maxVidAttempts, attemptNumber: vidAttempt }); //use new unique id database (quenum) so authkeys are not leaked between clients
												} else {
													keyObject.properties.videoAttemptNumber += 1;
													vidAttempt += 1;
													console.log("modified key "+key+" with attempt attrib (face found not approved)");
													socketHandler.socketEmitToKey(key, "POST", {action: 'login-opencvdata', queue: currentImgNum, confidences: confidence, buffer: imageBuffer.toString('base64'), labels: face, approved: false, totalAttempts: maxVidAttempts, attemptNumber: vidAttempt }); //use new unique id database (quenum) so authkeys are not leaked between clients
												}
											}

										}).catch( err => {
											keyObject.properties.allowOpenCV = true;
											keyObject.properties.videoAttemptNumber += 1;
											vidAttempt += 1;
											console.log("modified key "+key+" with attempt attrib");
											console.error("Error predicting image: "+err);
											socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "OpenCVBackendServerError ("+err+")"});
										})
										/*socketHandler.socketListenToAll(("opencvresp:"+pyimgnum), function (data) {
											console.log("data from opencv "+JSON.stringify(data));
										});*/
										pyimgnum++;
									} else {
										console.log("no response recieved yet from opencv, client sending too fast??");
										socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "OpenCVClientResponseNotAttainedFromPrevRequest", longerror: "Python response from previous request has not been attained, waiting."});
									}
								} else {
									console.log("Request recieved from client for opencv; but it is not ready yet");
									socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "OpenCVNotReady (try again soon)", longerror: "OpenCV is not ready yet :("});
								}
							} else {
								console.log("Client invalid for opencv processing");
								if (!validKey) {
									socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "OpenCVClientInvalidKey"});
								} else {
									socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "OpenCVClientVideoAttemptsExceeded"});
								}
							}
						}
					} else {
						console.error("keyObject invalid on opencv w/key '"+key+"'");
						socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "OpenCVClientInvalidKeyObject"});
					}
					//console.log(raw)
					/*var b = new Buffer(raw.length);
					var c = "";
					for (var i=0; i<raw.length; i++) {
						b[i] = raw[i];
						c = c + " " + raw[i];
					}
					fs.writeFile(pyimgbasepath+"in/image"+pyimgnum+".jpg",c,"binary",function(err) {
						console.log("write error?: "+err)
					})*/
				break;
				case "login-passcodeready":
					if (securityOff) {console.warn("WARNING: passcode security protections are OFF");}
					if (validKey || securityOff) {
						console.log("Authkey "+data.authkey+" approved");
						var passok = false;
						for (var i=0; i<runtimeSettings.passes.length; i++) {
							if (runtimeSettings.passes[i] == data.passcode) {
								console.log("Pass "+data.passcode+" approved");
								passok = true;
							} else {
								console.log("Pass "+data.passcode+" denied");
							}
						}
						if (passok) {
							socketHandler.socketEmitToKey(key,"POST", {action: 'login-passcodeapproval', approved: true});
							if (keyObjectValid) {
								keyObject.properties.approved = true;
							} else {
								socketHandler.socketEmitToKey(key,"POST", {action: 'processingError', error: "loginPasscodeKeyObjectInvalid"});
							}
						} else {
							socketHandler.socketEmitToKey(key,"POST", {action: 'login-passcodeapproval', approved: false});
						}
					} else {
						console.log("Authkey "+data.authkey+" denied");
					}
				break;
				case "pydata":
					if (securityOff) {console.warn("WARNING: pydata security protections are OFF");}
					if (validKey || securityOff) {
						console.log("Authkey "+data.authkey+" approved")
						if (securityOff) {
							socketHandler.socketEmitToAll('pydata',data.data);
						} else {
							socketHandler.socketEmitToPython('pydata',data.data);
						}
					} else {
						console.log("Authkey "+data.authkey+" denied");
					}
				break;
				case "processSpeech":
					if (securityOff) {console.warn("WARNING: processSpeech security protections are OFF");}
					if (validKey) {
						if (keyObjectValid || securityOff) {
							if (keyObject.properties.approved || securityOff) {
								if (speechNetReady) {
									console.log("processing speech: '"+JSON.stringify(data.speech)+"'");
									var classifiedSpeech = []; //array to hold speech that is classified
									if (data.speech.constructor === Array) { //array of possibilities?
										var classifications = []; //array of potential classifications
										for (var i=0; i<data.speech.length; i++) { //part 1: get all possibilities
											console.log("running speech possibility: "+data.speech[i]);
											var classification = neuralMatcher.algorithm.classify(speechClassifierNet, data.speech[i]);
											if (classification.length > 0) {
												classifiedSpeech.push(data.speech[i]);
											}
											console.log("Speech classification: "+JSON.stringify(classification));
											for (var j=0; j<classification.length; j++) {
												var category = classification[j][0];
												var confidence = classification[j][1];

												var contains = false;
												var containIndex = -1;
												for (var b=0; b<classifications.length; b++) {
													if (classifications[b][0] == category) {
														contains = true;
														containIndex = b;
													}
												}
												if (contains) {
													console.log("contains, push _ cat="+category+", conf="+confidence);
													classifications[containIndex][1].push(confidence);
												} else {
													console.log("no contain, not averaging _ cat="+category+", conf="+confidence);
													classifications[classifications.length] = classification[j];
													classifications[classifications.length-1][1] = [classifications[classifications.length-1][1]];
												}
											}
										}
										var max = 0;
										for (var i=0; i<classifications.length; i++) { //part 2: total possibilities
											if (classifications[i][1].length > 1) {
												console.log("averaging "+JSON.stringify(classifications[i][1]));
												var tot = 0;
												var len = classifications[i][1].length;
												for (var j=0; j<classifications[i][1].length; j++) {
													tot += classifications[i][1][j];
												}
												var avg = tot/len;
												if (tot > max) {
													max = tot;
												}
												console.log("avg="+avg+", tot="+tot)
												classifications[i][1] = avg*tot; //multiply by total to weight more answers (I know this results in just total)
											}
										}
										for (var i=0; i<classifications.length; i++) { //part 3, scale by max
											console.log("Scaling classification "+classifications[i][1]+" by max val "+max);
											if (max == 0) {
												console.warn("Dividing factor max is 0, did you pass only a single word in an array?");
											} else {
												classifications[i][1] /= max;
											}
										}
										var finalClassifications = [];
										for (var i=0; i<classifications.length; i++) {
											if (classifications[i][1] > neuralMatcher.algorithm.cutoffOutput) {
												finalClassifications.push(classifications[i]);
											}
										}
										console.log("classifications: "+JSON.stringify(classifications)+", cutoff filtered classifications: "+JSON.stringify(finalClassifications));
										//pick the more likely response from the ones provided
										var likelyResponse = ["",[0]];
										for (var i=0; i<finalClassifications.length; i++) {
							
											if (finalClassifications[i][1] > likelyResponse[1]) {
												likelyResponse = finalClassifications[i];
											}
										}
										var response;
										if (likelyResponse.constructor == Array && likelyResponse[0] !== "" && likelyResponse[1][1] !== 0) {
											speechParser.algorithm.addRNGClass(likelyResponse[0]); //generate rng class from classification
											response = speechParser.algorithm.dumpAndClearQueue();
										} else {
											console.warn("Likelyresponse is blank, what happened?")
											response = "";
										}
										socketHandler.socketEmitToKey(key,"POST",{action: "speechMatchingResult", classification: finalClassifications, likelyResponse: likelyResponse, transcript: data.speech, classifiedTranscript: classifiedSpeech, response: response});
									} else {
										var classification = neuralMatcher.algorithm.classify(speechClassifierNet, data.speech); //classify speech
										console.log("Speech classification: "+JSON.stringify(classification));
										var response;
										if (classification.constructor == Array && classification.length > 0) {
											speechParser.algorithm.addRNGClass(classification[0][0]); //generate rng class from classification
											response = speechParser.algorithm.dumpAndClearQueue(); //dump queue to response (if backed up w/multiple calls)
										} else {
											console.warn("Classification length is 0, response is nothing")
											response = "";
										}
										socketHandler.socketEmitToKey(key,"POST",{action: "speechMatchingResult", classification: classification, transcript: data.speech, classifiedTranscript: classifiedSpeech, response: response});
									}
								} else {
									socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "speechNetNotReady"});
								}
							} else {
								socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "ProcessSpeechClientKeyNotApproved, key: "+key});
							}
						}
					} else {
						socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "ProcessSpeechKeyInvalid, key:"+key});
					}
				break;
				default:
					console.error("Recieved invalid action "+action+" from key "+key);
				break;
			}
		}
	})
/*
socket shenanigans (thx jerry)
{"type":2,"nsp":"/","data":["opencvresp:0",{"image":"true","data":"0,/Users/Aaron/Desktop/Code/nodejs/index/tmpimgs/out/image0.jpg"}]}
{"type":2,"nsp":"/","data":["pyok",""]}
*/
});

//I see you all the way at the bottom... what r u doing here, go back up and code something useful!