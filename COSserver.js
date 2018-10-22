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
2 main phases: Initialization (I1-I13) and Runtime Code (R1-R2)
	Sub-phase: SocketIO Subsections (R2:S1-R2:S2)

Initialization (12 steps):
1) Module Initialization: initalizes modules that are required later on
2) Runtime Info/Settings: Reads and parses runtime information and settings from external JSON file
3) State Machine Init: Initializes state machine that keeps track of the state of each module
4) Console Colors: overrides prototypes for console to provide colors in console
5) File Logging Setup: Initializes file logging handlers for functions that output to console46 Serial Device Logic: Reads command line arguments and determines valid serial devices to connect to. Also opens a serial port if a valid device is found
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
const fs = require('fs');
const utils = require('./drivers/utils.js'); //include the utils file
const path = require('path');
const singleLineLog = require('single-line-log').stdout; //single line logging\

const isRoot = require('is-root');
if (!isRoot()) { //are we running as root?
	throw "Process is not running as root. Please start with elevated permissions"
}

var catchErrors = true; //enables clean error handling. Only turn off during development

var cwd = __dirname;
process.title = "CarOS V1";

//CONFIGURING WATCHDOG
var watchdog = require('native-watchdog');
watchdog.start(process.pid); //will watch process

/**********************************
--I2-- RUNTIME INFO/SETTINGS --I2--
**********************************/
var PRODUCTIONMODE = false;
var runtimeSettings = {
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
	var settingsData = fs.readFileSync(path.join(cwd,runtimeSettings.defaultDataDirectory,"settings.json"));
} catch(e) {
	console.error("[FATAL] Error reading info/settings file");
	throw "[FATAL] Error reading info/settings file";
}

settingsData = JSON.parse(settingsData);

var keys = Object.keys(settingsData.information); //only override keys from settingsData
for (var i=0; i<keys.length; i++) {
	runtimeInformation[keys[i]] = settingsData.information[keys[i]];
}

var keys = Object.keys(settingsData.soundcloudSettings); //only override keys from settingsData
for (var i=0; i<keys.length; i++) {
	soundcloudSettings[keys[i]] = settingsData.soundcloudSettings[keys[i]];
}

var keys = Object.keys(settingsData.settings); //only override keys from settingsData
for (var i=0; i<keys.length; i++) {
	runtimeSettings[keys[i]] = settingsData.settings[keys[i]];
}

PRODUCTIONMODE = settingsData.PRODUCTION; //production mode?
runtimeSettings.productionMessage = settingsData.productionMessage;
catchErrors = PRODUCTIONMODE;

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
console.log("~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-\nCarOS V1\nBy Aaron Becker\nPORT: "+runtimeSettings.serverPort+"\nCWD: "+cwd+"\nPID: "+process.pid+"\n~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-\n");

/*******************************
--I3-- STATE MACHINE INIT --I3--
*******************************/
//UNNEEDED COMPLEXITY, so I didn't implement it
//const stateMachine = require('./drivers/stateMachine.js');

/***************************
--I4-- CONSOLE COLORS --I4--
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
--I5-- FILE LOGGING SETUP --I5--
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
			loggingUtils.error(arguments,"error");
			semiOriginalError.apply(null, arguments);
		}

		console.importantLog = function() {
			loggingUtils.ilog(arguments,"ilog");
			semiOriginalILog.apply(null, arguments);
		}

		console.importantInfo = function() {
			loggingUtils.iinfo(arguments,"iinfo");
			semiOriginalIInfo.apply(null, arguments);
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
});

/********************************
--I6-- SERIAL DEVICE LOGIC --I6--
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
--I7-- ARDUINO COMMAND HANDLING --I7--
*************************************/

var arduinoUtils = require('./drivers/arduino.js'); //require the driver
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
--I8-- DATA FILE PARSERS --I8--
******************************/

fs.readFile(path.join(cwd,runtimeSettings.defaultDataDirectory,"/responses.json"), function(err,data){
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

fs.readFile(path.join(cwd,runtimeSettings.defaultDataDirectory,"/commandGroup.json"), function(err,data){
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

fs.readFile(path.join(cwd,runtimeSettings.defaultDataDirectory,"/commands.json"), function(err,data){
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
--I9-- NEURAL NETWORK SETUP --I9--
*********************************/

var speechParser = require('./drivers/speechParser.js'); //include speech parsing file
var neuralMatcher = require('./drivers/speechMatcher.js'); //include the speech matching file
neuralMatcher.algorithm.stemmer = neuralMatcher.stemmer;
var brain = require("brain.js");
var speechClassifierNet = new brain.NeuralNetwork(); //make the net
var speechNetTargetError = 0.005;//0.00001; //<- for release
var speechNetReady = false;

/*******************************
--I10-- READING FROM STDIN --I10--
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
--I11-- ERROR AND EXIT HANDLING --I11--
************************************/

process.on('SIGINT', function (code) { //on ctrl+c or exit
	console.importantLog("\nSIGINT signal recieved, graceful exit (garbage collection) w/code "+code);
	runtimeInformation.status = "Exiting";
	arduinoUtils.sendCommand("status","Exiting");
	sendOledCommand("status","Exiting");
	console.importantLog("Exiting in 1500ms");
	watchdog.exit();
	setTimeout(function(){
		process.exit(); //exit completely
	},1500);
});

const SegfaultHandler = require('segfault-handler');
SegfaultHandler.registerHandler("crash.log", function(signal, address, stack) {
	console.error("SEGFAULT - Signal: "+signal+"\naddress: "+address+"\nstack: "+stack)
	loggingUtils.error("SEGFAULT - Signal: "+signal+"\naddress: "+address+"\nstack: "+stack, "segerror");
});

if (catchErrors) {
	process.on('uncaughtException', function (err) { //on error
		console.importantLog("\nCRASH REPORT\n-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~\nError:\n"+err+"\n-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~\n");
		console.importantLog("Exiting in 1500ms");
		console.importantLog("\nError signal recieved, graceful exiting (garbage collection)");
		arduinoUtils.sendCommand("status","Error");
		sendOledCommand("status","Error");
		runtimeInformation.status = "Error";
		watchdog.exit();
		process.exit();
	});
	process.on('unhandledRejection', (reason, p) => {
	    console.error("Unhandled Promise Rejection at: Promise ", p, " reason: ", reason);
	    process.exit();
	});

}

/***********************************
--I12-- SOUNDCLOUD INIT CODE --I12--
***********************************/
var soundcloudUtils = require('./drivers/soundcloud.js');

function initSoundcloud(username) {
	return new Promise((mresolve, mreject) => {
		if (typeof username == "undefined") {
			username = soundcloudSettings.defaultUsername;
		}
		var timesLeft = soundcloudSettings.initMaxAttempts;

		soundcloudSettings.soundcloudReady = false;
		function initSCSlave() {
			console.info("Starting SC SLAVE (att "+(soundcloudSettings.initMaxAttempts-timesLeft+1)+"/"+soundcloudSettings.initMaxAttempts+")");
			soundcloudUtils.SCUtils.init({
				soundcloudSettings: soundcloudSettings,
				username: username,
				cwd: cwd,
			}).then( () => {
				console.log(colors.green("Initialized Soundcloud successfully! Now initializing trackManager"));
				soundcloudUtils.SCSoundManager.init().then( () => {
					console.log(colors.green("Initialized trackManager successfully!"));
					soundcloudSettings.soundcloudReady = true;
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
--I13-- OpenCV Init Code --I13--
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
--I14-- OLED Driver Init --I14--
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
--I15-- MISC. INIT CODE --I15--
******************************/

var statusUpdateInterval = setInterval(function(){
	var time = process.uptime();
	var uptime = utils.formatHHMMSS(time); //rts.uptime
	runtimeInformation.uptime = uptime;
	sessionFileStore.length(function session_count(a,len) {
		runtimeInformation.users = len;
	});  //rts.users
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

//Much love to Evan Gow for his great tutorial at https://medium.com/@evangow/server-authentication-basics-express-sessions-passport-and-curl-359b7456003d

/****
DEPS
*****/

//express deps
const express = require("express");
const errorHandler = require('errorhandler');
var APIrouter = express.Router();
var SCrouter = express.Router();

var AUTHrouter = express.Router();

const session = require('express-session');
const FileStore = require('session-file-store')(session);

//create app instance
const app = express();
const server = require('http').Server(app);

//express modules
const finalHandler = require('finalhandler');
const serveFavicon = require('serve-favicon');
const bodyParser = require('body-parser');
const multer = require('multer');
const uploadHandler = multer();
const uuid = require('uuid/v4');

//authentication deps
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const CustomStrategy = require('passport-custom').Strategy;

const bcrypt = require('bcrypt');
const jsonDB = require('node-json-db');

const db = new jsonDB(runtimeSettings.jsonDBPath, true, false); //connect to json-database

/****
INIT MODS
*****/

console.log("[AUTH] Init modules begun");

app.use(errorHandler({ dumpExceptions: true, showStack: true })); 
app.use(serveFavicon(path.join(cwd,runtimeSettings.faviconDirectory))); //serve favicon

app.use(express.static(path.join(cwd,runtimeSettings.assetsDirectory))); //define a static directory

app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' })); //bodyparser for getting json data, big limit for images
app.use(bodyParser.json({limit: '50mb'}));

const sessionFileStore = new FileStore(); //create the session file store

app.use(session({
	genid: (req) => {
		console.log('Inside UUID-generation');
		return uuid(); // use UUIDs for session IDs
	},
	//store: sessionFileStore, //filestore for sessions
	secret: "k3yB0ARdC@3t5s!", //set secret to new ID
	resave: false,
	saveUninitialized: true
}));

app.use(passport.initialize()); //passport.js init
app.use(passport.session());

app.use(function(req, res, next) {
  if (tooBusyLatestLag > runtimeSettings.tooBusyLagThreshold) {
	res.send(503, "Server is busy, cannot complete your request at this time. (Latency: "+tooBusyLatestLag+")");
	res.end();
  } else {
	next();
  }
});

//TODODODODODODODO FINISH THIS
app.use(function(req, res, next) { //default listener that sets session values
	if (!req.session.videoAttemptNumber) {
		req.session.videoAttemptNumber = 0;
	}
	next();
});

/****
INIT STRATS
*****/

console.log("[AUTH] Init strategies begun");
// configure passport.js to use the local strategy
passport.use(new LocalStrategy(
  { usernameField: 'name' },
  (name, password, done) => {
	console.log('Passport localStrategy found, looking up user w/name: '+name+", passwd: "+password);
	try {
		let allUserData = db.getData("/users/");
		for (var i=0; i<allUserData.length; i++) {
			if (allUserData[i].name == name) {
				return done(null, allUserData[i]);
				if (!bcrypt.compareSync(password, allUserData[i].password)) {
					return done(null, false, { message: 'Invalid credentials: password invalid.\n' });
				} else {
					return done(null, allUserData[i]);
				}
			}
		}
		return done(null, false, { message: 'Invalid credentials: user not found (und in db).\n' });
	} catch (e) {
		return done(null, false, { message: 'Invalid credentials: user not found (err in db lookup).\n' });
	}
  }
));
passport.use('openCV', new CustomStrategy( function(req, done) {
	let imageData = req.query.image;
	if (typeof imageData == "undefined") {
		return done(null, false, { message: 'Image not sent with request\n' });
	} else {
		console.log("image len "+imageData.length);
		if (openCVReady) {
	        //console.log("recv imgdata");
	        let imageDataMatches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
        cvtImageData = {};
        	if (imageDataMatches.length !== 3) {
		        return done(null, false, { message: 'Invalid image: image is not encoded correctly'});
		    }
		    cvtImageData.type = imageDataMatches[1];
    		cvtImageData.data = Buffer.from(imageDataMatches[2], 'base64'); //create converted object

	        let image = cv.imdecode(cvtImageData.data); //decode the buffer

	        let maxVidAttempts = runtimeSettings.maxVideoAttempts;
	        let vidAttempt = req.session.videoAttemptNumber;
	        
	        cvUtils.predictFaceFromData(image).then( result => { //predict the face
	            if (result == false) {
	                req.session.videoAttemptNumber++; //increment video attempt

	                console.log("faceHandler: (no face found)");
	                //req.send("Error: No face found"); //use new unique id database (quenum) so authkeys are not leaked between clients
	            } else {

	                let face = result[0];
	                let confidence = result[1];

	                if (runtimeSettings.faces.indexOf(face) > -1) {
	                    console.log("faceHandler: approved "+face+", looking up");
	                    let allUserData = db.getData("/users/");
	                    for (var i=0; i<allUserData.length; i++) {
							if (allUserData[i].name == face) {
								console.log("found face "+face+" in db");
								return done(null, allUserData[i]);
							}
						}
	                    return done(null, false, { message: 'Face found has no corresponding user in database. Cannot approve, please update the user database with label '+face+'.\n' });
	                    //req.send({confidences: confidence, buffer: imageBuffer.toString('base64'), labels: face, approved: true, totalAttempts: maxVidAttempts, attemptNumber: vidAttempt }); //use new unique id database (quenum) so authkeys are not leaked between clients
	                } else {
	                    req.session.videoAttemptNumber++;
	                    console.log("faceHandler: not approved "+face);
	                    return done(null, false, { message: 'Face found is not approved.\n' });
	                }
	            }

	        }).catch( err => {
	            req.session.videoAttemptNumber++;
	            console.error("Error predicting image: "+err);
	            return done(null, false, { message: 'Error: Server encoutered error \' '+err+'\' while processing\n' });
	        })
		} else {
		    return done(null, false, { message: 'Error: OpenCV is not ready\n' });
		}
	}
}));

passport.use('passcode', new CustomStrategy( function(req, done) {
	if (req.params.passcode) {
		console.log("psc entered="+req.params.passcode);
	} else {
		console.log("no psc entered?");
	}
	done(null, users[0]);
}));

//User serialization and deserialization
passport.serializeUser((user, done) => {
	console.log("Serializing user with id: "+user.id);
	done(null, user.id);
});

passport.deserializeUser((id, done) => {
	console.log("Deserializing user with id: "+id);
	  try {
		let allUserData = db.getData("/users/");
		for (var i=0; i<allUserData.length; i++) {
			if (allUserData[i].id == id) {
				return done(null, allUserData[i]);
			}
		}
		console.warn("Couldn't find user w/id "+id+" in db when deserializing");
		return done("Couldn't find user in db when deserializing", false);
	} catch (e) {
		return done(e, false);
	}
});

/****
INIT ROUTES
*****/
//MAIN ROUTES
app.get("/client", function(req, res) { //COS main route
	console.log(JSON.stringify(req.session)+" session");
	var done = finalHandler(req, res, {
		onerror: function(err) {
			console.log("[HTTP] Error: "+err.stack || err.toString())
		}
	});

	console.log('Inside GET /authrequired callback')
	console.log(`User authenticated? ${req.isAuthenticated()}`)
	if(req.isAuthenticated()) {
		fs.readFile(path.join(cwd,runtimeSettings.defaultFileDirectory,runtimeSettings.defaultClientFile), function (err, buf) {
			if (err) {
				return done(err);
			} else {
				//res.setHeader('Content-Type', 'text/html')
				res.end(buf);
			}
		})
	} else {
		res.redirect('/login');
	}
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

app.get('/login', (req, res) => {
    console.log('Inside GET request on /login, sessID: '+req.sessionID);
    if (req.isAuthenticated()) {
        res.redirect("/client");
    } else {
        var done = finalHandler(req, res, {
			onerror: function(err) {
				console.log("[HTTP] Error: "+err.stack || err.toString())
			}
		});

		console.log('Inside GET /login callback')
		fs.readFile(path.join(cwd,runtimeSettings.defaultFileDirectory,runtimeSettings.defaultLoginFile), function (err, buf) {
			if (err) {
				return done(err);
			} else {
				//res.setHeader('Content-Type', 'text/html')
				res.end(buf);
			}
		});
    }
})

//AUTH ROUTES
AUTHrouter.get('/regular', (req, res, next) => {
    res.redirect("/login");
});
AUTHrouter.post('/regular', (req, res, next) => {
    console.log('Inside POST request on /loginRegular, sessID: '+req.sessionID)
    passport.authenticate('local', (err, user, info) => {
        if(info) {return res.send(info.message)}
        if (err) { return next(err); }
        if (!user) { return res.redirect('/login'); }
        req.login(user, (err) => {
          if (err) { return next(err); }
          console.log("You were authenticated :)")
          return res.redirect('/client');
        })
    })(req, res, next);
})

AUTHrouter.get('/cv', (req, res, next) => {
	console.log('Inside GET request on /loginCV, sessID: '+req.sessionID)
    passport.authenticate('openCV', (err, user, info) => {
        if(info) {return res.send(info.message)}
        if (err) { return next(err); }
        if (!user) { return res.redirect('/login'); }
        req.login(user, (err) => {
          if (err) { return next(err); }
          console.log("You were authenticated :)")
          return res.redirect('/authrequired');
        })
    })(req, res, next);
    //res.redirect("/login");
});
AUTHrouter.post('/cv', uploadHandler.fields([]), (req, res, next) => {
    console.log('Inside POST request on /loginCV, sessID: '+req.sessionID)
    console.log(JSON.stringify(req.body))
    /*passport.authenticate('openCV', (err, user, info) => {
        if(info) {return res.send(info.message)}
        if (err) { return next(err); }
        if (!user) { return res.redirect('/login'); }
        req.login(user, (err) => {
          if (err) { return next(err); }
          console.log("You were authenticated :)")
          return res.redirect('/authrequired');
        })
    })(req, res, next);*/
});
AUTHrouter.get('/passcode', (req, res, next) => {
    res.redirect("/login");
});
AUTHrouter.post('/passcode', (req, res, next) => {
    console.log('Inside POST request on /loginPasscode, sessID: '+req.sessionID)
    passport.authenticate('passcode', (err, user, info) => {
        if(info) {return res.send(info.message)}
        if (err) { return next(err); }
        if (!user) { return res.redirect('/login'); }
        req.login(user, (err) => {
          if (err) { return next(err); }
          console.log("You were authenticated :)");
          return res.redirect('/authrequired');
        })
    })(req, res, next);
});

//API ROUTES

//Main routes
APIrouter.get("/isup", function(req, res) { //console route
	res.status(200);
	res.end();
});
APIrouter.get("/runtimeInformation", function(req, res) { //console route
	res.send(JSON.stringify(runtimeInformation));
	res.end();
});

//Soundcloud Routes
SCrouter.get("/clientReady", function(req, res) {
	if (soundcloudSettings.soundcloudReady) {
        console.log("SCClientReady request recieved; sending data");
        res.send({
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
        res.end();
    } else {
        console.log("SCClientReady request recieved; soundcloud is not ready");
        res.send("serverLoadingTracklist");
        soundcloudSettings.waitingClients.push(req.session.id);
        res.end();
    }
});
SCrouter.get("/clientUpdate", function(req, res) {
	if (soundcloudSettings.soundcloudReady) {
        console.log("SCClientUpdate");
        var ps = soundcloudUtils.SCSoundManager.getPlayedSeconds();
        res.send({
            currentPlayingTrack: soundcloudUtils.SCSoundManager.currentPlayingTrack,
            percent: soundcloudUtils.SCSoundManager.getPercent(),
            playedSeconds: ps,
            timeStamp: utils.formatHHMMSS(ps),
            playing: soundcloudUtils.SCSoundManager.playingTrack,
            settingsData: {
                currentUser: soundcloudUtils.SCUtils.localSoundcloudSettings.currentUser,
                currentVolume: soundcloudUtils.SCSoundManager.currentVolume,
                nextTrackShuffle: soundcloudUtils.SCUtils.localSoundcloudSettings.nextTrackShuffle,
                nextTrackLoop: soundcloudUtils.SCUtils.localSoundcloudSettings.nextTrackLoop
            }
        });
        res.end();
    } else {
        console.log("SC not ready on clientUpdate");
        res.send("serverLoadingTracklist");
        soundcloudSettings.waitingClients.push(req.session.id);
        res.end();
    }
});
SCrouter.get("/event/:type", function(req, res) {
	console.log("SCROUTER: Event type="+req.params.type+", data="+req.query.data)
	if (req.params.type) {
	    soundcloudUtils.SCSoundManager.processClientEvent({
	        type: req.params.type,
	        data: req.query.data,
	        origin: "external"
	    }).then( () => {
	    	res.send("OK");
	    	res.end();
	    }).catch( err => {
	    	res.send(err);
	    	res.end();
	    })
	} else {
	    console.error("Type undefined sccliuserevent");
	    res.send("Error: Type is undefined in request");
	    res.end();
	}
});

var gettingSCUser = false;
SCrouter.get("/changeUser/:user", function(req, res) {
	if (req.params.user) {
	    console.info("Restarting SC MASTER with new user "+req.params.user);
	    if (!gettingSCUser) {
	    	gettingSCUser = true;
	        initSoundcloud(req.params.user).then( () => {
	            console.importantInfo("SC INIT OK");
	            gettingSCUser = false;
	            res.send("OK");
	            res.end();
	        }).catch( err => {
	            console.error("Error initializing SC: "+err);
	            res.send("Error initializing SC: "+err);
	            gettingSCUser = false;
	            res.end();
	        });
	    } else {
	    	res.send("Error: Soundcloud not ready");
	    	res.end();
	    }
	} else {
		console.error("User undefined in SC changeUser");
	    res.send("Error: User is undefined in request");
	    res.end();
	}
});

/*
                        SCUtils.extSocketHandler.socketEmitToWeb("POST", {action: "serverLoadedTracks", trackList: scSettings.trackList, likedTracks: scSettings.trackList, hasTracks: true}); //send serverloadedtracks
                        this.extSocketHandler.socketEmitToWeb("POST", {action: "serverLoadingCachedTracks"}); //send serverloadedtracks
                        SCUtils.extSocketHandler.socketEmitToWeb("POST", {action: "serverNoTrackCache"}); //send serverloadedtracks
                        SCUtils.extSocketHandler.socketEmitToWeb("POST", {action: "serverLoadedTracks", trackList: scSettings.trackList, likedTracks: scSettings.trackList, hasTracks: true}); //send serverloadedtracks
                        SCUtils.extSocketHandler.socketEmitToWeb("POST", {action: "serverNoTrackCache"}); //send serverloadedtracks
                        SCUtils.extSocketHandler.socketEmitToWeb("POST", {action: "serverLoadingTracksUpdate", track: likedTracks[trackIndex].title, percent: ((tracksLoaded+1)/tracksToLoad)*100});
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
					}*/

app.use('/login', AUTHrouter); //connect login to auth router
APIrouter.use('/SC', SCrouter); //connect soundcloud router to api
app.use('/api', APIrouter); //connect api to main

app.use(function(req, res, next){
	res.status(404); //crappy 404 page
	res.send("<h1>Uhoh, you tried to go to a page that doesn't exist.</h1><br> Navigate to /client to go to the main page.");
});

console.log("[AUTH] Init server begun");
server.listen(runtimeSettings.serverPort, () => {
	console.log('Node server OK on port ' + runtimeSettings.serverPort);
});

//I see you all the way at the bottom... what r u doing here, go back up and code something useful!
