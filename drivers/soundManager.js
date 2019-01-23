/*
* soundManager.js by Aaron Becker
* Provides higher-level abstraction to lower-level drivers (soundcloud.js and airplay.js)
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*
*/

/******
DEPENDENCIES
******/
const Speaker = require("speaker");

//SoundManager dependencies
const mp3d = require('mp3-duration');
const path = require('path');
const colors = require("colors");

const {trackTimerModule, interactTimerModule, trackAudioController} = require("./trackTimers&Controllers.js");

const airplay = require("./airplay.js"); //airplay server wrapper
const soundcloud = require("./soundcloud.js"); //soundcloud local storage wrapper


/******
REQUIRED FUNCTIONS/CONSTANTS
******/
var speaker; //global output



/******
ACTUAL CODE LOL
******/

const SoundManagerV2 = {
    debugMode: true,

    playingTrack: false, //boolean whether track is playing or not
    currentPlayingTrack: {}, //current playing track in object form

    trackTimer: trackTimerModule,
    interactTimer: interactTimerModule,
    trackAudioController: trackAudioController,
    trackController: { //coordinates all the modules together
        play: function(trackObject) {
            var _this = SoundManagerV2;

            var trackPath = path.join(_this.cwd,soundcloud.localSoundcloudSettings.soundcloudTrackCacheDirectory,("track-"+trackObject.id+".mp3"));
            if (_this.debugMode) {
                console.log("Playing track from path: "+trackPath);
            }

            mp3d(trackPath, (err, duration) => {
                if (err) {
                    return console.error("error getting duration of mp3 (can't play track): "+err.message);
                } else {
                    if (_this.debugMode) {
                        console.log("Track duration in seconds long: "+duration);
                    }

                    _this.currentPlayingTrack = trackObject;
                    _this.playingTrack = true;

                    _this.trackTimer.reset(duration); //reset trackTimer
                    _this.trackAudioController.play(trackPath); //actually play it lol
                }
            });

        },

        pause: function() { //basically just a wrapper
            var _this = SoundManagerV2;

            _this.playingTrack = false;
            _this.trackAudioController.pause();
            _this.trackTimer.pause(); //stop the timer
        },

        resume: function() { //also basically just a wrapper
            var _this = SoundManagerV2;

            _this.playingTrack = true;
            _this.trackAudioController.resume();
            _this.trackTimer.resume(); //resume the timer
        }
    },

    init: (soundcloudSettings, airplaySettings, cwd, username) => {
        return new Promise( (resolve, reject) => {
            var _this = SoundManagerV2;

            if (!soundcloudSettings || !cwd || !airplaySettings) {
                return reject("SoundcloudSettings or AirplaySettings or cwd undefined on SCSoundManagerV2 init");
            }
            if (!username) {
                username = soundcloudSettings.defaultUsername;
            }

            const errorReject = function(err) {
                soundcloudSettings.soundcloudStatus = {ready: false, error: true, message: err};
                return reject(err);
            } 


            /*
            STEPS TO INIT
            1) set up variables/constants such as cwd and soundcloudSettings
            2) initialize soundcloud library with username (will load/download tracks from online to local cache)
            3) initialize airplay library with server name
            4) start airplay server
            5) attach listeners to airplay
            6) init timers/trackControllers
            */

            //STEP 1
            _this.soundcloudSettings = soundcloudSettings; //setup constants
            _this.cwd = cwd;

            //STEP 2
            soundcloudSettings.soundcloudStatus = {ready: false, error: false, message: ""};
             _this.initUsername(username).then( () => {

                _this.currentPlayingTrack = soundcloud.localSoundcloudSettings.likedTracks[0]; //start with first track
                _this.currentVolume = soundcloud.localSoundcloudSettings.defaultVolume;
            //STEP 3
                airplay.init(airplaySettings).then( () => {
            //STEP 4
                    airplay.startServer().then( () => {
            //STEP 5
                        airplay.onClientConnected(_this.airplayClientConnected);
                        airplay.onClientDisconnected(_this.airplayClientDisconnected);

            //STEP 6
                        //TRACKTIMER
                        _this.trackTimer.init();

                        //TRACKAUDIOCONTROLLER
                        _this.trackAudioController.setVolume(soundcloudSettings.defaultVolume); //set volume to default
                        let trackControllerEvents = _this.trackAudioController.eventEmitter;
                        trackControllerEvents.on("trackEnd", () => {
                            if (_this.debugMode) {
                                console.log("trackControllerEvent: trackEnd, next track");
                            }
                            _this.processClientEvent({ //process client event: track has ended, next track
                                type: "trackForward",
                                origin: "internal (trackFinished)"
                            }); //request next track
                        })

                        //INTERACTTIMER
                        _this.interactTimer.init(soundcloudSettings.minInteractionWaitTime/1000);


                        soundcloudSettings.soundcloudStatus = {ready: true, error: false, message: ""};

                        return resolve();
                        
                    }).catch(errorReject)
                }).catch(errorReject)
            }).catch(errorReject)

        })
    },

    initUsername: function(username) {
        return new Promise((mresolve, mreject) => {
            var _this = SoundManagerV2;
                if (typeof username == "undefined") {
                    username = _this.soundcloudSettings.defaultUsername;
                }
                var timesLeft = _this.soundcloudSettings.initMaxAttempts;

                function initSCSlave() {
                    console.info("Starting SC SLAVE (att "+(_this.soundcloudSettings.initMaxAttempts-timesLeft+1)+"/"+_this.soundcloudSettings.initMaxAttempts+")");
                    soundcloud.init({
                        soundcloudSettings: _this.soundcloudSettings,
                        username: username,
                        cwd: _this.cwd
                    }).then( () => {
                        console.log(colors.green("Initialized Soundcloud successfully! Now initializing trackManager"));
                        
                        return mresolve();
                    }).catch( err => {
                        timesLeft--;
                        firstRun = true;
                        if (timesLeft > 0) {
                            console.error("[SCMASTER] Error initializing soundcloud ("+err+"). Trying again in "+_this.soundcloudSettings.initErrorDelay+" ms.");
                            setTimeout( () => {
                                initSCSlave();
                            }, _this.soundcloudSettings.initErrorDelay);
                        } else {
                            console.error("[SCMASTER] Reached maximum tries for attempting soundcloud initialization. Giving up. (Err: "+err+")");
                            mreject("MaxTries reached (giving up) with error message: "+err);
                        }
                    });
                }

                initSCSlave(); //begin first slave
        })
    },


    airplayClientConnected: function(stream) {
        var _this = SoundManagerV2;

        console.log("YO SOMEONE CONNECTED TO AIRPLAY");
        stream.pipe(new Speaker({channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
        bitRate: 128}));

        if (_this.playingTrack) {
            _this.trackController.pause();
        }
    },

    airplayClientDisconnected: function() {
        console.log("YO SOMEONE DISCONNECTED FROM AIRPLAY")
    }
}

module.exports = SoundManagerV2;

/*


SCUtils.playingTrack = true;                SoundManager.playingTrack = false;if (SCUtils.debugMode) {
                    console.log("_NEXT SONG REACHED");
                } SoundManager.processClientEvent({
                    type: "trackForward",
                    origin: "internal (trackFinished)"
                }); //request next track

        
        
    }
}

var SoundManager = {
    playingTrack: false,
    currentVolume: 50,

    currentPlayingTrackDuration: 0,
    currentPlayingTrackPlayed: 0,
    trackTimeInterval: 0,
    canInteractTrack: true,
    canInteractTrackTimeout: 0,

    

    


    init: () => {
        return new Promise((resolve, reject) => {
            SoundManager.currentPlayingTrack = SCUtils.localSoundcloudSettings.likedTracks[0]; //start with first track
            SoundManager.currentVolume = SCUtils.localSoundcloudSettings.defaultVolume;
            //SoundManager.playTrackLogic(this.currentPlayingTrack);
            resolve();
        });
    },
    lookupTrackByID: trackID => {
        return new Promise((resolve, reject) => {
            if (typeof trackID == "undefined") {
                return reject("[ERROR] TrackID undefined");
            }
            var lt = SCUtils.localSoundcloudSettings.likedTracks;
            for (var i=0; i<lt.length; i++) {
                if (lt[i].id == trackID) {
                    return resolve(lt[i]);
                }
            }
            return reject("[ERROR] Can't find track");
        });
    },
    processClientEvent: function(ev) {
        return new Promise( (resolve, reject) => {
            if (ev && ev.type) {
                if (SCUtils.debugMode) {
                    console.log("[SoundManager] ClientEvent: "+ev.type+", origin: "+((ev.origin) ? ev.origin : "unknown (external)")+", dat: "+JSON.stringify((ev.data) ? ev.data : "no data provided"));
                }
                try {
                    ev.data = JSON.parse(ev.data);
                } catch(e) {}

                if (SoundManager.canInteractTrack || ev.type.indexOf("volume") > -1 || ev.type.indexOf("changeTrack") > -1 || ev.type == "togglePlayerOutput") {
                    
                    if (ev.type.indexOf("volume") == -1 && ev.type.indexOf("changeTrack") == -1 && ev.type != "togglePlayerOutput") { //vol changetrackstate and toggleoutput no limits
                        SoundManager.canInteractTrack = false;
                        clearTimeout(SoundManager.canInteractTrackTimeout);
                        SoundManager.canInteractTrackTimeout = setTimeout(function(){
                            SoundManager.canInteractTrack = true;
                        }, (ev.type.indexOf("clientTrackSelected") > -1) ? SCUtils.localSoundcloudSettings.minInteractionWaitTime*SCUtils.localSoundcloudSettings.trackSelectedWaitMultiplier : SCUtils.localSoundcloudSettings.minInteractionWaitTime);
                    }

                    switch (ev.type) {
                        case "playPause":
                            if (SoundManager.playingTrack) {
                                SoundManager.trackControl.pause();
                                SoundManager.playingTrack = false;
                            } else {
                                SoundManager.trackControl.play();
                                SoundManager.playingTrack = true;
                            }
                            break;
                        case "volumeUp":
                            if (SoundManager.currentVolume+SCUtils.localSoundcloudSettings.volStep <= 100) { //ik that it will go > 100 but it is clamped by setplayervolume
                                SoundManager.currentVolume+=SCUtils.localSoundcloudSettings.volStep;
                                SoundManager.setPlayerVolume(SoundManager.currentVolume);
                            }
                            break;
                        case "volumeDown":
                            if (SoundManager.currentVolume-SCUtils.localSoundcloudSettings.volStep > 0) {
                                SoundManager.currentVolume-=SCUtils.localSoundcloudSettings.volStep;
                                SoundManager.setPlayerVolume(SoundManager.currentVolume);
                            }
                            break;
                        case "trackForward":
                            if (SCUtils.localSoundcloudSettings.nextTrackLoop && ev.origin.indexOf("internal") > -1) {
                                console.info("Track looping");
                                SoundManager.playTrackLogic(SCUtils.localSoundcloudSettings.likedTracks[SoundManager.currentPlayingTrack.index]); //replay
                            } else {
                                if (SCUtils.localSoundcloudSettings.nextTrackShuffle) {
                                    var ind = Math.round(Math.random()*(SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset));
                                    if (ind == SoundManager.currentPlayingTrack.index) { //is track so add one
                                        ind++;
                                        if (ind > (SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset)) { //lol very random chance that it wrapped over
                                            ind = 0;
                                        }
                                    }
                                    SoundManager.playTrackLogic(SCUtils.localSoundcloudSettings.likedTracks[ind]);
                                } else {
                                    var ind = SoundManager.currentPlayingTrack.index+1;
                                    if (ind > (SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset)) {
                                        ind = 0; //go to first track
                                    }
                                    //console.info("NOIND OVERFLOW (ind="+ind+", len="+(SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset)+")");
                                    SoundManager.playTrackLogic(SCUtils.localSoundcloudSettings.likedTracks[ind]);
                                }
                            }
                            break;
                        case "trackBackward":
                            var ind = SoundManager.currentPlayingTrack.index-1;
                            if (ind < 0) {
                                ind = SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset-1; //go to last track
                            }
                            SoundManager.playTrackLogic(SCUtils.localSoundcloudSettings.likedTracks[ind]);
                            break;
                        case "clientLocalTrackFinished":
                            SoundManager.processClientEvent({
                                type: "trackForward",
                                origin: "internal (client local track finished)"
                            });
                            break;
                        case "clientTrackSelected":
                            if (ev.data) {
                                var trackID = ev.data;
                                if (typeof trackID == "undefined") {
                                    return reject("ClientTrackSelected event fired but no trackID data was provided");
                                } else {
                                    SoundManager.lookupTrackByID(trackID).then( trackData => {
                                        SoundManager.playTrackLogic(trackData);
                                    }).catch( err => {
                                        return reject("Error looking up track with id "+trackID+": "+err);
                                    })
                                }
                                
                            } else {
                                return reject("ClientTrackSelected event fired but no data provided");
                            }
                            break;
                        case "changeTrackLoopState":
                            SCUtils.localSoundcloudSettings.nextTrackLoop = !SCUtils.localSoundcloudSettings.nextTrackLoop;
                            break;
                        case "changeTrackShuffleState":
                            SCUtils.localSoundcloudSettings.nextTrackShuffle = !SCUtils.localSoundcloudSettings.nextTrackShuffle;
                            break;
                        case "togglePlayerOutput":
                            SCUtils.localSoundcloudSettings.playMusicOnServer = !SCUtils.localSoundcloudSettings.playMusicOnServer;
                            if (SCUtils.debugMode) {
                                console.log("Toggled player output to "+SCUtils.localSoundcloudSettings.playMusicOnServer);
                            }
                            break;
                        default:
                            console.warn("unknown event "+JSON.stringify(ev)+" passed into SCProcessClientEvent");
                            return reject("unknown event "+JSON.stringify(ev)+" passed into SCProcessClientEvent");
                            break;
                    }
                    return resolve();
                } else {
                    return reject("SoundManager cannot process event because the minimum time between events has not elapsed")
                }
            } else {
                return reject("SoundManager proc cliEv called with no event or invalid");
            }
        });
    },

    playTrackLogic: function(trackObject) {
        if (trackObject) {
            if (SCUtils.localSoundcloudSettings.playMusicOnServer) {
                if (SCUtils.debugMode) {
                    console.log("Playing music on: SERVER");
                }
                if (SoundManager.playingTrack) {
                    SoundManager.trackControl.pause(); //pause track so that two tracks don't overlap
                    SCUtils.playingTrack = false;
                    setTimeout(function() {
                        playT();
                    },500); //give it time to pause
                } else {
                    playT();
                }

                function playT() {
                var trackPath = path.join(SCUtils.CWD,SCUtils.localSoundcloudSettings.soundcloudTrackCacheDirectory,("track-"+trackObject.id+".mp3"));
                    fs.stat(trackPath, function(err, stat) {
                        if (err) {
                            console.warn("Track with title: "+trackObject.title+" had no copy saved locally; downloading one (was it deleted somehow?)");
                            SCUtils.saveTrack(trackObject, SCUtils.localSoundcloudSettings).then( () => {
                                SoundManager.playTrackServer(trackObject);
                            }).catch( err => {
                                console.error("Error playing track with title: "+trackObject.title+"; no copy saved locally and couldn't download (protected track?)");
                            })
                        } else {
                            SoundManager.playTrackServer(trackObject);
                        }
                    });
                }
            } else {
                if (SCUtils.debugMode) {
                    console.log("Playing music on: CLIENT");
                }
                //PROGRAM CLIENT PLAY MUSIC
            }
        } else {
            console.error("Invalid track passed into playTrackLogic");
        }
    },
    
    getPercent: function() {
        return (SoundManager.currentPlayingTrackPlayed/SoundManager.currentPlayingTrackDuration)*100;
    },

    getPlayedSeconds: function() {
        return SoundManager.currentPlayingTrackPlayed;
    },

    setPlayerVolume: function(vol) {
        if (SoundManager.currentVolume == null || typeof SoundManager.currentVolume == "undefined") {
            SoundManager.currentVolume = SCUtils.localSoundcloudSettings.defaultVolume;
        }
        if (vol < 0) {
            vol = 0;
        }
        if (vol > 100) {
            vol = 100;
        }
        

        SoundManager.currentVolume = clamp(SoundManager.currentVolume, 0, 100);
        SoundManager.pcmVolumeAdjust.setVolume(nMap(SoundManager.currentVolume, 0, 100, SoundManager.MINVOLUME, SoundManager.MAXVOLUME)); //map the volume
        SCUtils.localSoundcloudSettings.currentVolume = SoundManager.currentVolume;
    },
    playTrackServer: function(trackObject) {
        var trackPath = path.join(SCUtils.CWD,SCUtils.localSoundcloudSettings.soundcloudTrackCacheDirectory,("track-"+trackObject.id+".mp3"));
        if (SCUtils.debugMode) {
            console.log("Playing track from path: "+trackPath);
        }
        fs.stat(trackPath, function(err, stat) {
            if (err == null) {
                //console.log("file exists, ok w/stat "+JSON.stringify(stat));

                mp3d(trackPath, (err, duration) => {
                    if (err) {
                        return console.error("error getting duration of mp3: "+err.message);
                    } else {
                        if (SCUtils.debugMode) {
                            console.log("Track duration in seconds long: "+duration);
                        }
                        SoundManager.currentPlayingTrackDuration = duration;
                        SoundManager.currentPlayingTrackPlayed = 0;
                        SoundManager.currentPlayingTrack = trackObject;

                        var readable = fs.createReadStream(trackPath); //create the read path

                        var ts = new timedStream({
                            rate: 1000000,
                            period: 100
                        }); //initialize timedStream
                        
                        

                        var decoder = new lame.Decoder(audioOptions); //initialize decoder
                        var volumeTweak = new pcmVolume(); //initialize pcm volume changer

                        SoundManager.pcmVolumeAdjust = volumeTweak; //set global method so it can be accessed

                        SoundManager.setPlayerVolume(SoundManager.currentVolume);


                        readable.pipe(ts) //pipe stream to timedStream
                            .pipe(decoder) //pipe to decoder
                            .pipe(volumeTweak) //pipe to volumeTweaker
                        
                        var speaker;
                        function resume() {
                            if (!SoundManager.playingTrack) {
                                console.info("_PLAY");

                                speaker = new Speaker(audioOptions); //setup speaker

                                volumeTweak.pipe(speaker); //setup pipe for volumeTweak
                                ts.resumeStream(); //resume the stream
                                SCUtils.playingTrack = true;

                                SoundManager.trackTimeInterval = setInterval(function() {
                                    SoundManager.currentPlayingTrackPlayed+=0.1; //add the time to the counter
                                },100);

                                return speaker.once('close', function() {
                                    speaker.end();
                                    ts.destroy();
                                    SoundManager.playingTrack = false;
                                    clearInterval(SoundManager.trackTimeInterval);
                                    if (SCUtils.debugMode) {
                                        console.log("_NEXT SONG REACHED");
                                    }

                                    SoundManager.processClientEvent({
                                        type: "trackForward",
                                        origin: "internal (trackFinished)"
                                    }); //request next track
                                })
                            }
                            //volumeTweak.pipe(spk); //pipe adjusted volume tweak stream to speaker (which will play it)
                            //decoder.pipe(volumeTweak); //pipe decoder to volumeTweaker to change volume
                            
                        }

                        function pause() {
                            if (SoundManager.playingTrack) {
                                console.info("_PAUSE");
                                clearInterval(SoundManager.trackTimeInterval);
                                SCUtils.playingTrack = false;
                                speaker.removeAllListeners('close');
                                volumeTweak.unpipe(speaker);
                                ts.pauseStream();
                                speaker.close();
                                return speaker.end();
                            }
                        }

                        SoundManager.trackControl = { //set the track control handler
                            pause: pause,
                            play: resume
                        };

                        if (SCUtils.localSoundcloudSettings.autoplayTrack) {
                            SoundManager.playingTrack = false;
                            resume(); //start playing track
                            SoundManager.playingTrack = true;
                        } else {
                            SoundManager.playingTrack = false;
                        }

                        console.info("INIT DONE: "+trackObject.title);
                    }
                });
            } else {
                return console.error("File doesn't exist");
            }
        })
    }
}*/