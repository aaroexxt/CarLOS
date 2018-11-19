const ioPassthrough = io(serverPass);
        ioPassthrough.on('connection', function (socket) { //on connection
            sockets[sockets.length] = {socket: socket, type: "uninitialized", status: "init", id: socket.id, handler: undefined, authkey: "uninitialized"};
            var socketid = sockets.length-1;
            var socketuid = socket.id;
            var track = sockets[socketid];
            track.handler = socketHandler;

            socketHandler.update(userPool,sockets); //update the handler

            /****************************************
            --R2:S1-- WEB/PYTHON INIT LOGIC --R2:S1--
            ****************************************/


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
    }
}).catch( err => {
    console.error("FATAL: Failed to initialize authentication server for the following reason: "+err);
    process.nextTick( ()=>{
        throw "Couldn't initialize authentication";
    });
});