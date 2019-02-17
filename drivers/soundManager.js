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
    debugMode: false,

    playingTrack: false, //boolean whether track is playing or not
    wasPlayingTrackBeforeAirplay: false, //boolean whether track was playing before airplay took over
    playingAirplay: false,
    currentPlayingTrack: {}, //current playing track in object form

    trackTimer: trackTimerModule,
    interactTimer: interactTimerModule,
    trackAudioController: trackAudioController,
    trackController: { //coordinates all the modules together
        play: function(trackObject) {
            var _this = SoundManagerV2;

            if (_this.playingAirplay) {
                return;
            }

            if (_this.playingTrack) {
                _this.trackController.pause();
            }

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

            if (_this.playingAirplay) {
                return;
            }

            _this.playingTrack = false;
            _this.trackAudioController.pause();
            _this.trackTimer.pause(); //stop the timer
        },

        resume: function() { //also basically just a wrapper
            var _this = SoundManagerV2;

            if (_this.playingAirplay) {
                return;
            }

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
                        
                    }).catch(errorReject); //one error rejecting function because good code cleanliness
                }).catch(errorReject);
            }).catch(errorReject);

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
                    if (_this.debugMode) {
                        console.info("Starting SC SLAVE (att "+(_this.soundcloudSettings.initMaxAttempts-timesLeft+1)+"/"+_this.soundcloudSettings.initMaxAttempts+")");
                    }
                    soundcloud.init({
                        soundcloudSettings: _this.soundcloudSettings,
                        username: username,
                        cwd: _this.cwd
                    }).then( () => {
                        console.log(colors.green("Initialized Soundcloud successfully!"));
                        
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

        if (_this.debugMode) {
            console.log("airplay status: connect. pausing music");
        }
        stream.pipe(new Speaker({channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
        bitRate: 128}));

        _this.wasPlayingTrackBeforeAirplay = _this.playingTrack;
        console.log(_this.playingTrack)
        if (_this.playingTrack) {
            _this.trackController.pause();
        }

        _this.playingAirplay = true; //set last because it will block other functions
    },

    airplayClientDisconnected: function() {
        var _this = SoundManagerV2;

        if (_this.debugMode) {
            console.log("airplay status: disconnect. playing music");
        }

        _this.playingAirplay = false;

        _this.playingTrack = _this.wasPlayingTrackBeforeAirplay;
        console.log(_this.playingTrack)
        if (_this.wasPlayingTrackBeforeAirplay) {
            _this.trackController.resume();
        }
    },

    getSoundcloudObject: function() { //shim to access soundcloud
        return soundcloud;
    },
    getAirplayObject: function() { //shim to access airplay
        return airplay;
    },

    processClientEvent: function(ev) {
        var _noResetInteractTimerEvents = ["volume", "changeTrackLoopState", "changeTrackShuffleState"]; //array that includes all events that shouldn't reset interactTimer

        var _this = SoundManagerV2;

        var tracksLength = (soundcloud.localSoundcloudSettings.likedTracks.length-soundcloud.track401Offset); //used a lot in trackForward and trackBackward functions

        return new Promise( (resolve, reject) => {
            if (ev && ev.type) {
                if (_this.debugMode) {
                    console.log("[SoundManager] ClientEvent: "+ev.type+", origin: "+((ev.origin) ? ev.origin : "unknown (external)")+", dat: "+JSON.stringify((ev.data) ? ev.data : "no data provided"));
                }
                try { //attempt change to JSON data format
                    ev.data = JSON.parse(ev.data);
                } catch(e) {} //swallow the error

                let canInteract = _this.interactTimer.canInteractWithTrack; //fetch canInteract
                let overrideInteractPresent = false; //override canInteract
                for (var i=0; i<_noResetInteractTimerEvents.length; i++) {
                    if (ev.type && ev.type.indexOf(_noResetInteractTimerEvents[i]) > -1) {
                        overrideInteractPresent = true;
                    }
                }

                if (canInteract && !overrideInteractPresent) {
                    _this.interactTimer.reset(); //reset timer if override is false and can interact currently
                }


                if (canInteract || overrideInteractPresent) {

                    switch (ev.type) {
                        case "playPause":
                            if (_this.debugMode) {
                                console.log("EXTERNAL_PLAY",_this.playingTrack);
                            }
                            if (_this.playingTrack) {
                                _this.trackController.pause(); //already broken into other functions lol
                            } else {
                                _this.trackController.resume();
                            }
                            break;
                        case "volumeUp":
                            _this.trackAudioController.setVolume(_this.trackAudioController.currentVolume+soundcloud.localSoundcloudSettings.volStep);
                            break;
                        case "volumeDown":
                            _this.trackAudioController.setVolume(_this.trackAudioController.currentVolume-soundcloud.localSoundcloudSettings.volStep);
                            break;
                        case "trackForward":
                            if (soundcloud.localSoundcloudSettings.nextTrackLoop && ev.origin.indexOf("internal") > -1) { //the track is looping, play it again
                                if (_this.debugMode) {
                                    console.info("Track looping");
                                }
                                _this.trackController.play(soundcloud.localSoundcloudSettings.likedTracks[_this.currentPlayingTrack.index]); //replay
                            } else {

                                if (soundcloud.localSoundcloudSettings.nextTrackShuffle) { //alright the client wants to shuffle the track, so let's do that
                                    var ind = Math.round(Math.random()*tracksLength);
                                    if (ind == _this.currentPlayingTrack.index) { //is track so add one
                                        ind++;
                                        if (ind > tracksLength) { //lol very random chance that it wrapped over
                                            ind = 0;
                                        }
                                    }
                                    _this.trackController.play(soundcloud.localSoundcloudSettings.likedTracks[ind]);
                                } else { //straight up go forward a track
                                    var ind = _this.currentPlayingTrack.index+1;
                                    if (ind > tracksLength) {
                                        ind = 0; //go to first track
                                    }
                                    
                                    _this.trackController.play(soundcloud.localSoundcloudSettings.likedTracks[ind]);
                                }
                            }
                            break;
                        case "trackBackward":
                            var ind = _this.currentPlayingTrack.index-1;
                            if (ind < 0) {
                                ind = tracksLength-1; //go to last track
                            }
                            _this.trackController.play(soundcloud.localSoundcloudSettings.likedTracks[ind]);
                            break;
                        case "clientTrackSelected":
                            if (ev.data) {
                                var trackID = ev.data;
                                if (typeof trackID == "undefined") {
                                    return reject("ClientTrackSelected event fired but no trackID data was provided");
                                } else {
                                    _this.lookupTrackByID(trackID).then( trackData => {
                                        _this.trackController.play(trackData);
                                    }).catch( err => {
                                        return reject("Error looking up track with id "+trackID+": "+err);
                                    });
                                }
                                
                            } else {
                                return reject("ClientTrackSelected event fired but no data provided");
                            }
                            break;
                        case "changeTrackLoopState":
                            soundcloud.localSoundcloudSettings.nextTrackLoop = !soundcloud.localSoundcloudSettings.nextTrackLoop;
                            break;
                        case "changeTrackShuffleState":
                            soundcloud.localSoundcloudSettings.nextTrackShuffle = !soundcloud.localSoundcloudSettings.nextTrackShuffle;
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

    lookupTrackByID: trackID => {
        return new Promise((resolve, reject) => {
            if (typeof trackID == "undefined") {
                return reject("[ERROR] TrackID undefined");
            }
            var lt = soundcloud.localSoundcloudSettings.likedTracks;
            for (var i=0; i<lt.length; i++) {
                if (lt[i].id == trackID) {
                    return resolve(lt[i]);
                }
            }
            return reject("[ERROR] Can't find track");
        });
    }
}

module.exports = SoundManagerV2;

//cleaned up down here