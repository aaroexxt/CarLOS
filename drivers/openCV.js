/*
* openCV.js by Aaron Becker
* OpenCV facial recognition with training data in Node.JS
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const cv = require('opencv4nodejs'); //require opencv
const fs = require('fs');

var CVUtils = {
    classifier: new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2),
    lbphRecognizer: new cv.LBPHFaceRecognizer(),

    faces: [],
    labels: [],
    mappings: [],

    localRuntimeSettings: {},

    debugMode: false,

    init: function(cwd, runtimeSettings) {
        return new Promise((resolve, reject) => {
            if (typeof runtimeSettings == "undefined") {
                return reject("RuntimeSettings undefined on init of CV");
            } else if (typeof cwd == "undefined") {
                return reject("CWD undefined on init")
            } else {
                CVUtils.localRuntimeSettings = runtimeSettings;
            }
            var cvBP = cwd+"/"+runtimeSettings.cvTrainingImagesPath;
            var trainingUsers;
            fs.readdir(cvBP, (err, trainingUsers) => {
                if (err) {
                    return reject("Error getting openCV files from directory "+cvBP);
                } else {
                    if (CVUtils.debugMode) {
                        console.log("Userdata files found: "+JSON.stringify(trainingUsers));
                    }
                    CVUtils.faces = []; //reset faces, labels and mappings
                    CVUtils.labels = [];
                    CVUtils.mappings = [];

                    function processTrainingUsers(i) {
                        if (trainingUsers[i].substring(0,1) == ".") {
                            console.warn("CV Training dir "+trainingUsers[i]+" is invalid; contains . in name")
                            processTrainingUsers(i+1);
                            return; //have to return out of current fn
                        } else if (trainingUsers[i].substring(0,1).toLowerCase() == "u") {
                            var userLabel = trainingUsers[i].substring(1,2);
                            CVUtils.mappings[Number(userLabel)] = String(trainingUsers[i]).split(",")[1];

                            var sbjPath = cvBP+"/"+trainingUsers[i]; //get subject path
                            var imgFiles;
                            try {
                                imgFiles = fs.readdirSync(sbjPath);
                            } catch(e) {
                                console.error("Error getting user image files from directory "+sbjPath+" (subject "+imgFiles[i]+")");
                                processTrainingUsers(i+1);
                                return;
                            }
                            if (imgFiles.length == 0) {
                                console.warn("ImageFiles length for user "+trainingUsers[i]+" is 0, skipping user");
                                processTrainingUsers(i+1);
                                return;
                            } else {
                                var imagePaths = imgFiles
                                .map(file => sbjPath+"/"+file) //get absolute path

                                function processImagePaths(j) {

                                    var determineNextAction = () => { //will determine if processImagePaths can be completed
                                        if (j >= imagePaths.length-1) { //is this loop complete?
                                            if (CVUtils.debugMode) {
                                                console.log("[ImagePaths] "+imagePaths.length+" images found for user: "+trainingUsers[i]);
                                            }

                                            if (i < trainingUsers.length-1) { //is user loop complete?
                                                processTrainingUsers(i+1);
                                            } else {
                                                if (CVUtils.debugMode) {
                                                    console.info("Training LBPH recognizer");
                                                }
                                                CVUtils.lbphRecognizer.trainAsync(CVUtils.faces, CVUtils.labels).then( () => {
                                                    if (CVUtils.debugMode) {
                                                        console.log("[ImagePaths] Trained recognizer successfully");
                                                    }
                                                    return resolve();
                                                }).catch( err => {
                                                    return reject("[ImagePaths] Couldn't train recognizer (Error: "+err+")");
                                                });
                                            }
                                        } else {
                                            processImagePaths(j+1);
                                        }
                                    }

                                    //console.log("Reading from imPath: "+imagePaths[j]);
                                    if (typeof imagePaths[j] !== "undefined" && imagePaths[j].indexOf("undefined") < 0) {
                                        try{
                                            var img = cv.imread(imagePaths[j]) //read image
                                            img.bgrToGrayAsync().then( img => {
                                                CVUtils.getFaceImage(img).then( img => { //get the face image
                                                    if (typeof img == "undefined" || img === null) {
                                                        if (CVUtils.debugMode) {
                                                            console.warn("ImageData [i="+j+"], user [i="+i+"] image is null, no face found");
                                                        }
                                                        determineNextAction();
                                                        return;
                                                    } else {
                                                        img = img.resize(80, 80); //resize to common size
                                                        CVUtils.faces.push(img);
                                                        CVUtils.labels.push(Number(userLabel));

                                                        determineNextAction();
                                                        return;
                                                    }
                                                }).catch( err => {
                                                    return reject("Error extracting face from image: "+err);
                                                })
                                            }).catch( err => {
                                                return reject("Error making image gray: "+err);
                                            }); //cvt to grey
                                            
                                        } catch(e) {
                                            return reject("[ImagePaths] Failed to read from image path: "+imagePaths[j]);
                                        }
                                    } else {
                                        if (CVUtils.debugMode) {
                                            console.log(JSON.stringify(imagePaths)+", "+imagePaths.length)
                                        }
                                        return reject("[ImagePaths] i"+j+" is undefined or contains undefined");
                                    }
                                }

                                processImagePaths(0); //start processing image paths for user recursively

                                //console.log("FINAL IMAGES: "+JSON.stringify(images));
                            }
                        } else {
                            if (CVUtils.debugMode) {
                                console.warn("Found invalid OpenCV dir "+trainingUsers[i]+" in training folder");
                            }
                            processTrainingUsers(i+1);
                            return; //have to return out of current fn
                        }
                    }

                    processTrainingUsers(0); //start recursive
                }
            })
        });
    },
    predictFaceFromPath: function (path) {
        return new Promise( (resolve, reject) => {
            try {
                var image = cv.imread(path);
                predictFaceFromData(image).then( dat => {
                    return resolve(dat);
                }).catch(err => {
                    return reject(err);
                })
            } catch(e) {
                return reject("Error loading opencv img from path "+path);
            }
        });
    },

    predictFaceFromData: function(data) {
        return new Promise( (resolve, reject) => {
            if (typeof data == "undefined") {
                return reject("Data is undefined")
            }
            data.bgrToGrayAsync().then( grayImg => {
                CVUtils.getFaceImage(grayImg).then( faceImage => {
                    if (typeof faceImage == "undefined" || faceImage === null) {
                        return resolve(false); //"Parsed faceimage is null; was a face detected?"
                    } else {
                        faceImage = faceImage.resize(80,80);
                        var result = CVUtils.lbphRecognizer.predict(faceImage);
                        var face = CVUtils.mappings[result.label];
                        console.log('predicted: %s, confidence: %s', face, result.confidence);
                        if (result.confidence > CVUtils.localRuntimeSettings.minimumCVConfidence) {
                            return resolve([face, result.confidence]);
                        } else {
                            console.error("Confidence of prediction is too low ("+result.confidence+")");
                            return reject("Confidence is too low");
                        }
                    }
                }).catch( e => {
                    return reject("Error processing opencv image: "+e);
                });
                
            }).catch( e => {
                return reject("Error converting opencv image to gray: "+e);
            })
        });
    },
    getFaceImage: function(grayImg) {
        return new Promise((resolve, reject) => {
            try {
                CVUtils.classifier.detectMultiScaleAsync(grayImg).then( res => {
                    const faceRects = res.objects;
                    if (!faceRects.length || faceRects.length == 0) {
                        return resolve(null);
                    } else {
                        return resolve(grayImg.getRegion(faceRects[0])); //only get first face
                    }
                });
            } catch(e) {
                return reject("Error detecting image: "+e);
            }
            
        });
    },

    drawTxtRectOnImage: function(image, rect, text, color) {
        const thickness = 2
        image.drawRectangle(
            new cv.Point(rect.x, rect.y),
            new cv.Point(rect.x + rect.width, rect.y + rect.height),
            color,
            cv.LINE_8,
            thickness
        );

        const textOffsetY = rect.height + 20
        image.putText(
            text,
            new cv.Point(rect.x, rect.y + textOffsetY),
            cv.FONT_ITALIC,
            0.6,
            color,
            thickness
        );
    }
};

exports.CVUtils = CVUtils