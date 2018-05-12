var port = 80;
var cwd = __dirname;
//console.clear();
console.log("");
console.log("~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-\nNode.js initialized successfully :)\nBy Aaron Becker\nPORT: "+port+"\nCWD: "+cwd+"\n~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-\n");

var http = require('http');
var url = require('url');
var fs = require('fs');

var formidable = require('formidable');
var debughttp = require('debug')('http');
var debuginit = require('debug')('init');
var debugfile = require('debug')('upload');
var singleLineLog = require('single-line-log').stdout; //single line logging

var windowPlugin = require('window-size');
var windowSize = windowPlugin.get();
process.stdout.on('resize', function() {
	windowSize = windowPlugin.get();
	console.log("Updated terminal size to width: "+windowSize.width+", height: "+windowSize.height);
});

var serialDevice = "none";
var foundJSON = false;
var arduinoConnected = false;
process.argv.forEach(function (val, index, array) {
	function processDeviceJSON(raw) {
		try {
			var json = JSON.parse(raw);
		} catch(e) {
			console.log("Error parsing JSON. E: "+e+", raw: "+raw);
		}
		for (var i=0; i<json.length; i++) {
			var device = json[i].comName;
			var manufacturer = json[i].manufacturer || "No manufacturer found";
			console.log("Device parsed from json: "+device+", manufacturer: "+manufacturer);
			if (manufacturer.indexOf("Arduino") > -1 || manufacturer.indexOf("arduino") > -1) {
				console.log("Arduino found!");
				arduinoConnected = true;
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
			arduinoConnected = true;
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
console.log("Serial device from start script: "+serialDevice);
var SerialPort = require('serialport');
if (serialDevice == "" || serialDevice == "none" || arduinoConnected == false) {
	console.warn("[WARNING] Server running without arduino. Errors may occur. Once you have connected an arduino, you have to relaunch the start script.");
	var arduino = { //make a fake arduino class so that server doesnt fail on write
		write: function(t) {
			console.warn("[WARNING] Arduino.write method called with no arduino connected, data is literally going nowhere");
		}
	}
} else {
	var arduino = new SerialPort(serialDevice, {
		baudRate: 9600,
		autoOpen: false
	});
	arduino.open(function (err) {
		if (err) {
			console.error("Error opening serial port to arduino at "+serialDevice+".");
			arduinoConnected = false;
		} else {
			arduinoConnected = true;
			arduino.on('readable', function(data) {
				handleArduinoData(arduino.read());
			})
		}
	})
}
var arduinoCommandSplitChar = ";";
var arduinoCommandValueChar = "|";

var server = http.createServer(handler); //setup server
debuginit("~-Server Created Successfully-~")
var io = require('socket.io')(server);

server.listen(port, function(){ //listener
	console.log((new Date()) + ' Node server is listening on port '+port);
});

var utils = require('./nodeutils.js'); //include the utils file

var speechParser = require('./speechParser.js'); //include speech parsing file
var neuralMatcher = require('./speechMatcher.js'); //include the speech matching file
neuralMatcher.algorithm.stemmer = neuralMatcher.stemmer;
var brain = require("brain.js");
var speechClassifierNet = new brain.NeuralNetwork(); //make the net
var speechNetTargetError = 0.005;//0.00001; //<- for release
var speechNetReady = false;

var userPool = new utils.authPool();

var denyFileNames = ["pass.json","rpibackend.py","fileserve.js","nodeutils.js","training.py","live.py","commands.json"];
var ignoreDenyFileExtensions = true;
var appendCWDtoRequest = true;

var securityOff = true; //PLEASE REMOVE THIS, FOR TESTING ONLY
var catchErrors = false; //enables clean error handling. Only turn off during development

var sockets = [];
var pyimgnum = 0;
var pyimgbasepath = cwd+"/index/tmpimgs/";

var approval = {faces: "", passes: "", maxVideoAttempts: "", maxPasscodeAttempts: ""};
console.log("dirname '"+__dirname+"'");
fs.readFile(__dirname+"/pass.json", function(err,data){
	if (err) {
		console.error("[FATAL] Error reading pass file");
		throw "[FATAL] Error reading pass file";
	} else {
		approval = JSON.parse(data); //read data and set approval object
		var keys = Object.keys(approval);
		for (var i=0; i<keys.length; i++) {
			for (var j=0; j<approval[keys[i]].length; j++) {
				approval[keys[i]][j] = utils.atob(approval[keys[i]][j]);
			}
		}
	}
});

console.log("dirname '"+__dirname+"'");
fs.readFile(__dirname+"/responses.json", function(err,data){
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

fs.readFile(__dirname+"/commands.json", function(err,data){
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
			var percent = speechNetTargetError/net.error;
			var chars = Math.round(windowSize.width*percent);
			var str = "";
			for (var i=0; i<chars-6; i++) {
				str+="#";
			}
			str+="> ";
			str+=String(Math.round(percent*100))
			str+="%"
			singleLineLog(str); //make it fancy
			//singleLineLog("training error: "+net.error+", iterations: "+net.iterations);
		},
		function(){
			singleLineLog.clear();
			console.log("\n[SPEECHNET] Done training net. Ready for input.");
			speechNetReady = true;
		},
		function(){
			console.error("[SPEECHNET] Error training net asynchronously. Speech-related functions may break :(");
		})
	}
});

var arduinoCommandBuffer = ""; //need buffer because might not recieve whole command in one recieve
function handleArduinoData(data) {
	var command = arduinoCommandBuffer;
	var sdata = String(data).split("");
	for (var i=0; i<sdata.length; i++) {
		if (sdata[i] == arduinoCommandSplitChar) {
			arduinoCommandRecognized(arduinoCommandBuffer);
			arduinoCommandBuffer = "";
		} else {
			arduinoCommandBuffer+=sdata[i];
		}
	}
}
function arduinoCommandRecognized(command) {
	if (command == "AOK") {
		arduino.write("SOK"); //tell arduino that server is ready
	} else if (command == "CONN") {
		console.log("Arduino is connected :)");
	} else if (command == "INFO") {
		var time = process.uptime();
		var uptime = utils.formatHHMMSS(time);
		sendArduinoCommand("uptime",uptime);
		sendArduinoCommand("status","Running");
		sendArduinoCommand("users",userPool.auth_keys.length);
	}
	console.log("Complete command recognized: "+command)
}
function sendArduinoCommand(command,value) {
	arduino.write(arduinoCommandSplitChar+command+arduinoCommandValueChar+value+arduinoCommandSplitChar);
}

var stdinput = process.openStdin();
var stdinputListener = new utils.advancedEventListener(stdinput,"data");
var sendArduinoMode = false;
stdinputListener.addPersistentListener("*",function(d) {
	var uI = d.toString().trim();
	console.log("you entered: [" + uI + "]");
	if (uI == "help") {
		console.log("Right now, sA or sendArduinoMode toggles sending raw to arduino.")
	} else if (uI == "sA" || uI == "sendArduinoMode") {
		sendArduinoMode = !sendArduinoMode;
		console.log("Send arduino mode toggled");
	} else {
		if (sendArduinoMode) {
			arduino.write(arduinoCommandSplitChar+uI+arduinoCommandSplitChar);
		} else {
			console.log("Command not recognized")
		}
	}
});

io.on('connection', function (socket) { //on connection
	sockets[sockets.length] = {socket: socket, type: "uninitialized", status: "init", id: socket.id, handler: undefined, authkey: "uninitialized"};
	var socketid = sockets.length-1;
	var socketuid = socket.id;
	var track = sockets[socketid];
	var socketHandler = new utils.socketHandler(userPool,sockets);
	track.handler = socketHandler;

	socket.on('initweb', function (data) { //set up listener for web intialization
		track.status = "connected";
		track.type = "client";
		initweb(data,socket,socketHandler,track);
	});
	socket.on('initpython', function (data) { //set up listener for python initialization
		initpython(data,socket,socketHandler,track);
		track.status = "connected";
		track.type = "python";
		socket.on('disconnect', function (data) { //we know that it is the python socket, setup listener to emit pydisconnect
			console.log("PYDISCONNECT")
			sockets[socketid].status = "disconnected";
			allemit('pydisconnect',{});
		})
	});

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
		if ((track.type == "uninitialized" || true)) { //different actions based on tracking type, if uninit just give all
			switch(action) {
				/*GENERAL ACTIONS*/
				case "validatekey":
					var ok = validKey;
					if (ok == true) {
						console.log("Validating authkey: "+key+", valid=true");
						socketHandler.socketEmitToWeb('POST', {"action": "validatekey", "valid": "true"})
					} else {
						console.log("Validating authkey: "+key+", valid=false");
						socketHandler.socketEmitToWeb('POST', {"action": "validatekey", "valid": "false"})
					}
					break;
				case "readback":
					console.log("reading back data: "+JSON.stringify(data));
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
							if ((validKey || securityOff) && keyObject.properties.videoAttemptNumber < approval.maxVideoAttempts) {
								if (keyObject.properties.allowOpenCV) {
									console.log("recv imgdata");
									var raw = data.raw;
									raw = raw.replace(/^data:image\/\w+;base64,/, "");
									var b = new Buffer(raw, 'base64');
									var path = pyimgbasepath+"in/image"+pyimgnum+".png";
									fs.writeFile(path, b, function(err) {
										console.log("Wrote file error?: "+err);
									});
									socketHandler.socketEmitToID(socket.id,"POST",{ action: "login-opencvqueue", queue: pyimgnum });
									console.log("Sending to opencv");
									keyObject.properties.allowOpenCV = false;
									if (securityOff) {
										allemit("pydata","i:"+pyimgnum) //Sync imagenum variable
										allemit("pydata","o:"+path+","+key); //send with 'o' flag to tell python that it's face recognition
									} else {
										socketHandler.socketEmitToPython("pydata","i:"+pyimgnum) //Sync imagenum variable
										socketHandler.socketEmitToPython("pydata","o:"+path+","+key); //send with 'o' flag to tell python that it's face recognition
									}
									/*allon(("opencvresp:"+pyimgnum), function (data) {
										console.log("data from opencv "+JSON.stringify(data));
									});*/
									pyimgnum++;
								} else {
									console.log("no response recieved yet from opencv, client sending too fast??");
									socketHandler.socketEmitToKey(key,"POST",{action: "processingError", error: "OpenCVClientResponseNotAttainedFromPrevRequest", longerror: "Python response from previous request has not been attained, waiting."});
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
						console.error("keyObject invalid w/key '"+key+"'");
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
				case "login-opencvresponse":
					if (typeof data == "undefined") {
						console.log("dat opencv response undefined!!! uhoh");
					} else {
						var dat = data.data;
						var innum = dat.imgnum;
						var pathout = dat.path;
						var pykey = dat.key;
						if (innum == "error" || path == "error") {
							console.error("Some internal python error ocurred :(");
							socketHandler.socketEmitToKey(pykey,"POST",{action: "processingError", error: "OpenCVBackendServerError"});
						} else {
							var conf = dat.confidences.split(",");
							var labels = dat.labels.split(",");
							var rects = dat.rects.split(",[");
							var maxVidAttempts = approval.maxVideoAttempts;
							var vidAttempt = -1;
							var pykeyObject = userPool.findKey(pykey);
							if (pykeyObject == null) {
								console.error("PyKey "+pykey+" not found in userPoolDB. Was request made before server restart?");
								socketHandler.socketEmitToID(socket.id,"POST",{action: "processingError", error: "OpenCVClientMissingKey, key:"+pykey});
							} else if (typeof pykeyObject.properties.videoAttemptNumber !== "number") {
								socketHandler.socketEmitToKey(pykey,"POST",{action: "processingError", error: "OpenCVClientKeyMissingVidAttemptProperty"});
								console.error("VidAttempt not valid on key "+pykey);
							} else {
								vidAttempt = pykeyObject.properties.videoAttemptNumber;
								//console.log("checked key "+pykey+" for prop vidAttempt");
								//console.log(conf,labels,rects,pykey)
								for (var i=0; i<rects.length; i++) { //fix removal of colons
									if (rects[i] !== "") {
										if (rects[i].substring(0,1) !== "[") { //fix if not containing starter bracket
											rects[i] = "["+rects[i];
										}
										//console.log("rectsi "+rects[i])
										rects[i] = JSON.parse(rects[i]); //parse the data
									}
								}
								fs.unlink(pyimgbasepath+"/in/image"+innum+".png",function(err){
									console.log("Error removing?: "+err);
								})
								//console.log("pathout "+pathout);
								fs.readFile(pathout, function(err, buf) {
									var approved = false;
									for (var i=0; i<labels.length; i++) {
										for (var j=0; j<approval.faces.length; j++) {
											console.log("label "+labels[i]+", face "+approval.faces[j])
											if (labels[i] === approval.faces[j]) {
												approved = true;
											}
										}
									}
									if (approved) {
										pykeyObject.properties.approved = true;
										console.log("modified key "+pykey+" with approved attrib")
									} else {
										pykeyObject.properties.videoAttemptNumber += 1;
										vidAttempt += 1;
										console.log("modified key "+pykey+" with attempt attrib")
									}
									socketHandler.socketEmitToKey(pykey, "POST", {action: 'login-opencvdata', queue: innum, buffer: buf.toString('base64'), confidences: conf, labels: labels, rects: rects, approved: approved, totalAttempts: maxVidAttempts, attemptNumber: vidAttempt }); //use new unique id database (quenum) so authkeys are not leaked between clients
									pykeyObject.properties.allowOpenCV = true; //reallow sending opencv because processing is completed
									fs.unlink(pathout, function(err) {
										console.log("Error removing sent img?: "+err);
									})
								})
							}
						}
					}
				break;
				case "login-passcodeready":
					if (securityOff) {console.warn("WARNING: passcode security protections are OFF");}
					if (validKey || securityOff) {
						console.log("Authkey "+data.authkey+" approved");
						var passok = false;
						for (var i=0; i<approval.passes.length; i++) {
							if (approval.passes[i] == data.passcode) {
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
							allemit('pydata',data.data);
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
										var classification = neuralMatcher.algorithm.classify(speechClassifierNet, data.speech);
										console.log("Speech classification: "+JSON.stringify(classification));
										var response;
										if (classification.constructor == Array && classification.length > 0) {
											speechParser.algorithm.addRNGClass(classification[0][0]); //generate rng class from classification
											response = speechParser.algorithm.dumpAndClearQueue();
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
	socket.on('gpio', function(data) {}) //why is this here?
});

function initpython(data,socket,socketHandler,track) {
	//console.log("RECV SOCKET INIT PYTHON "+JSON.stringify(data));
	if (securityOff) {
		console.warn("WARNING: Python security is OFF")
		allemit('pycwd', cwd); //emit cwd
	} else {
		socketHandler.socketEmitToPython('pycwd', cwd); //check if python script is running
	}
	socketHandler.socketEmitToWeb('webready', {data: "ready?"}); //check if there is a web browser connected
	allon('webok', function (data) { //if there is, send data
		//console.log("RECV SOCKET INIT WEB "+JSON.stringify(data));
		socketHandler.socketEmitToWeb('webdata',{data: "SEND!"});
	});
}
function initweb(data,socket,socketHandler,track) {
	//console.log("RECV SOCKET INIT WEB "+JSON.stringify(data));
	if (securityOff) {
		console.warn("WARNING: Python security is OFF")
		allemit('pyready', {data: "ready?"}); //emit cwd
	} else {
		socketHandler.socketEmitToPython('pyready', {data: "ready?"}); //check if python script is running
	}
	allon('pyok', function (data) { //if it is, go ahead and send data//authorize
		var myauth = new userPool.key();
		myauth.properties.approved = false; //set approved parameter
		myauth.properties.videoAttemptNumber = 1; //video login attempt number
		myauth.properties.passcodeAttemptNumber = 1; //passcode login attempt number
		myauth.properties.socketID = socket.id; //socket id attached to key
		myauth.properties.allowOpenCV = true; //allow opencv to happen with key
		//console.log(myauth);
		myauth.init();
		track.authkey = myauth;
		//console.log("RECV SOCKET INIT PYTHON "+JSON.stringify(data));
		//console.log("emitting to id: "+socket.id)
		socketHandler.socketEmitToID(socket.id,'webdata',{authkey: myauth.key});
	});
}

function allemit(id, data) {
	for (var i=0; i<sockets.length; i++) {
		sockets[i].socket.emit(id,data);
	}
}

function allon(id, callback) {
	for (var i=0; i<sockets.length; i++) {
		sockets[i].socket.on(id,function() {
			callback();
		});
	}
}

function handler(req, res) {
	if (req.url == '/fileupload') {
		debughttp("GET fileupload");
		var form = new formidable.IncomingForm();
		form.parse(req, function (err, fields, files) {
			debugfile("fileup: err="+err+", fields="+JSON.stringify(fields)+", files="+JSON.stringify(files));
			if (((Object.keys(fields).length === 0 && fields.constructor === Object) && (Object.keys(files).length === 0 && fields.constructor === Object))) {
					res.writeHead(200, {'Content-Type': 'text/html'});
					res.write('<form action="fileupload" method="post" enctype="multipart/form-data">');
					res.write('<input type="file" name="filetoupload"><br>');
					res.write('<input type="submit">');
					res.write('</form>');
					return res.end();
			} else {
				res.write('File uploaded: <br>');
				if (typeof files.filetoupload !== undefined) {
					res.write('File size: '+files.filetoupload.size+' <br>');
					res.write('File dir: '+files.filetoupload.path+' <br>');
					var filename = files.filetoupload.path;
					fs.readFile(filename, function(errr, data) {
						if (filename != "./json/version" && filename != "./json" && filename != "/json/version" && filename != "/json") {
							debughttp("GET filename upload: '"+filename+"', status: "+((errr)?404:200));
						}
						debughttp(data);
						if (errr) {
							res.writeHead(404, {'Content-Type': 'text/html'});
							return res.end("404 Not Found File in FileUpload :(");
						}  
						res.writeHead(200, {'Content-Type': 'text/html'});
						res.write(data);
						return res.end();
					});
				} else {
					res.write('Error finding file');
				}
				//res.end();
			}
		});
	} else {
		var q = url.parse(req.url, true);
		var filename = q.pathname;
		//var splfilename = (ignoreDenyFileExtensions == true)?filename.substring(filename.lastIndexOf("/"),filename.lastIndexOf(".")):filename.substring(filename.lastIndexOf("/"));
		var splfilename = filename.substring(filename.lastIndexOf("/"));
		var bad = false;
		for (var i=0; i<denyFileNames.length; i++) {
			var deny = (ignoreDenyFileExtensions == true)?denyFileNames[i].substring(0,denyFileNames[i].lastIndexOf(".") || denyFileNames[i].length):denyFileNames[i]; //gotta fix html encoding-relaetd bugs
			if (splfilename.indexOf(deny) !== -1) {
				bad = true;
			}
		}
		if (bad == false) {
			if (appendCWDtoRequest) {
				var request = cwd+"/index/"+filename;
			} else {
				var request = filename;
			}
			fs.readFile(request, function(err, data) {
				if (filename != "./json/version" && filename != "./json" && filename != "/json/version" && filename != "/json") {
					debughttp("GET filename: '"+filename+"', status: "+((err)?404:200));
				}
				if (err) {
					res.writeHead(404, {'Content-Type': 'text/html'});
					return res.end("404 Not Found :(");
				}
				if (filename.indexOf("css") > -1) {
					res.writeHead(200, {'Content-Type': 'text/css'});
				} else {
					res.writeHead(200, {'Content-Type': 'text/html'});
				}
				res.write(data);
				return res.end();
			});
		} else {
			res.writeHead(403, {'Content-Type': 'text/html'});
			return res.end("403 Forbidden (don't try to access this file pls)");
		}
	}
}

process.on('SIGINT', function (code) { //on ctrl+c or exit
	console.log("\nSIGINT signal recieved, graceful exit (garbage collection) w/code "+code);
	for (var i=0; i<sockets.length; i++) {
		sockets[i].socket.emit("pydata","q"); //quit python
		sockets[i].socket.emit("disconnect","");
	}
	for (var i=pyimgnum; i>=0; i--) {
		var path = pyimgbasepath+"in/image"+i+".png";
		console.log("Removing image file (in): "+path);
		fs.unlink(path,function (err) {
			console.log("Error removing?: "+err)
		})
		var path = pyimgbasepath+"out/image"+i+".jpg";
		console.log("Removing image file (out): "+path);
		fs.unlink(path,function (err) {
			console.log("Error removing?: "+err)
		})
	}
	sendArduinoCommand("status","Exiting");
	console.log("Exiting in 1500ms (waiting for sockets to send...)");
	setTimeout(function(){
		process.exit(); //exit completely
	},1500); //give some time for sockets to send
});
if (catchErrors) {
	process.on('uncaughtException', function (err) { //on error
		console.log("\nError signal recieved, graceful exiting (garbage collection)");
		sendArduinoCommand("status","Error");
		for (var i=0; i<sockets.length; i++) {
			sockets[i].socket.emit("pydata","q"); //quit python
			sockets[i].socket.emit("disconnect","");
		}
		for (var i=pyimgnum; i>=0; i--) {
			var path = pyimgbasepath+"in/image"+i+".png";
			console.log("Removing image file (in): "+path);
			fs.unlink(path,function (err) {
				console.log("Error removing?: "+err)
			});
			var path = pyimgbasepath+"out/image"+i+".jpg";
			console.log("Removing image file (out): "+path);
			fs.unlink(path,function (err) {
				console.log("Error removing?: "+err)
			});
		}
		console.log("\nCRASH REPORT\n-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~\nError:\n"+err+"\n-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~\n");
		console.log("Exiting in 1500ms (waiting for sockets to send...)");
		setTimeout(function(){
			process.exit(); //exit completely
		},1500); //give some time for sockets to send
	});
}