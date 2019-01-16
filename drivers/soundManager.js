/*
* soundManager.js by Aaron Becker
* Provides higher-level abstraction to lower-level drivers (soundcloud.js and airplay.js)
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*
*/

const airplay = require("airplay.js"); //airplay server wrapper
const soundcloud = require("soundcloud.js"); //soundcloud local storage wrapper

var speaker = new Speaker({
  channels: 2,
  bitDepth: 16,
  sampleRate: 44100,
});

var SCSoundManager = {
    playingTrack: false,
    currentVolume: 50,

    MINVOLUME: 0, //pcm constants, shouldn't be changed for any reason
    MAXVOLUME: 1.5,

    currentPlayingTrack: {},
    currentPlayingTrackDuration: 0,
    currentPlayingTrackPlayed: 0,
    trackTimeInterval: 0,
    canInteractTrack: true,
    canInteractTrackTimeout: 0,

    trackControl: {
        play: function(){},
        pause: function(){}
    },

    clientUpdateInterval: {},

    init: () => {
        return new Promise((resolve, reject) => {
            SCSoundManager.currentPlayingTrack = SCUtils.localSoundcloudSettings.likedTracks[0]; //start with first track
            SCSoundManager.currentVolume = SCUtils.localSoundcloudSettings.defaultVolume;
            //SCSoundManager.playTrackLogic(this.currentPlayingTrack);
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
                    console.log("[SCSoundManager] ClientEvent: "+ev.type+", origin: "+((ev.origin) ? ev.origin : "unknown (external)")+", dat: "+JSON.stringify((ev.data) ? ev.data : "no data provided"));
                }
                try {
                    ev.data = JSON.parse(ev.data);
                } catch(e) {}

                if (SCSoundManager.canInteractTrack || ev.type.indexOf("volume") > -1 || ev.type.indexOf("changeTrack") > -1 || ev.type == "togglePlayerOutput") {
                    
                    if (ev.type.indexOf("volume") == -1 && ev.type.indexOf("changeTrack") == -1 && ev.type != "togglePlayerOutput") { //vol changetrackstate and toggleoutput no limits
                        SCSoundManager.canInteractTrack = false;
                        clearTimeout(SCSoundManager.canInteractTrackTimeout);
                        SCSoundManager.canInteractTrackTimeout = setTimeout(function(){
                            SCSoundManager.canInteractTrack = true;
                        }, (ev.type.indexOf("clientTrackSelected") > -1) ? SCUtils.localSoundcloudSettings.minInteractionWaitTime*SCUtils.localSoundcloudSettings.trackSelectedWaitMultiplier : SCUtils.localSoundcloudSettings.minInteractionWaitTime);
                    }

                    switch (ev.type) {
                        case "playPause":
                            if (SCSoundManager.playingTrack) {
                                SCSoundManager.trackControl.pause();
                                SCSoundManager.playingTrack = false;
                            } else {
                                SCSoundManager.trackControl.play();
                                SCSoundManager.playingTrack = true;
                            }
                            break;
                        case "volumeUp":
                            if (SCSoundManager.currentVolume+SCUtils.localSoundcloudSettings.volStep <= 100) { //ik that it will go > 100 but it is clamped by setplayervolume
                                SCSoundManager.currentVolume+=SCUtils.localSoundcloudSettings.volStep;
                                SCSoundManager.setPlayerVolume(SCSoundManager.currentVolume);
                            }
                            break;
                        case "volumeDown":
                            if (SCSoundManager.currentVolume-SCUtils.localSoundcloudSettings.volStep > 0) {
                                SCSoundManager.currentVolume-=SCUtils.localSoundcloudSettings.volStep;
                                SCSoundManager.setPlayerVolume(SCSoundManager.currentVolume);
                            }
                            break;
                        case "trackForward":
                            if (SCUtils.localSoundcloudSettings.nextTrackLoop && ev.origin.indexOf("internal") > -1) {
                                console.info("Track looping");
                                SCSoundManager.playTrackLogic(SCUtils.localSoundcloudSettings.likedTracks[SCSoundManager.currentPlayingTrack.index]); //replay
                            } else {
                                if (SCUtils.localSoundcloudSettings.nextTrackShuffle) {
                                    var ind = Math.round(Math.random()*(SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset));
                                    if (ind == SCSoundManager.currentPlayingTrack.index) { //is track so add one
                                        ind++;
                                        if (ind > (SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset)) { //lol very random chance that it wrapped over
                                            ind = 0;
                                        }
                                    }
                                    SCSoundManager.playTrackLogic(SCUtils.localSoundcloudSettings.likedTracks[ind]);
                                } else {
                                    var ind = SCSoundManager.currentPlayingTrack.index+1;
                                    if (ind > (SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset)) {
                                        ind = 0; //go to first track
                                    }
                                    //console.info("NOIND OVERFLOW (ind="+ind+", len="+(SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset)+")");
                                    SCSoundManager.playTrackLogic(SCUtils.localSoundcloudSettings.likedTracks[ind]);
                                }
                            }
                            break;
                        case "trackBackward":
                            var ind = SCSoundManager.currentPlayingTrack.index-1;
                            if (ind < 0) {
                                ind = SCUtils.localSoundcloudSettings.likedTracks.length-SCUtils.track401Offset-1; //go to last track
                            }
                            SCSoundManager.playTrackLogic(SCUtils.localSoundcloudSettings.likedTracks[ind]);
                            break;
                        case "clientLocalTrackFinished":
                            SCSoundManager.processClientEvent({
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
                                    SCSoundManager.lookupTrackByID(trackID).then( trackData => {
                                        SCSoundManager.playTrackLogic(trackData);
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
                    return reject("SCSoundManager cannot process event because the minimum time between events has not elapsed")
                }
            } else {
                return reject("SCSoundManager proc cliEv called with no event or invalid");
            }
        });
    },

    playTrackLogic: function(trackObject) {
        if (trackObject) {
            clearInterval(SCSoundManager.clientUpdateInterval); //clear the client update loop
            if (SCUtils.localSoundcloudSettings.playMusicOnServer) {
                if (SCUtils.debugMode) {
                    console.log("Playing music on: SERVER");
                }
                if (SCSoundManager.playingTrack) {
                    SCSoundManager.trackControl.pause(); //pause track so that two tracks don't overlap
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
                                SCSoundManager.playTrackServer(trackObject);
                            }).catch( err => {
                                console.error("Error playing track with title: "+trackObject.title+"; no copy saved locally and couldn't download (protected track?)");
                            })
                        } else {
                            SCSoundManager.playTrackServer(trackObject);
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
        return (SCSoundManager.currentPlayingTrackPlayed/SCSoundManager.currentPlayingTrackDuration)*100;
    },

    getPlayedSeconds: function() {
        return SCSoundManager.currentPlayingTrackPlayed;
    },

    setPlayerVolume: function(vol) {
        if (SCSoundManager.currentVolume == null || typeof SCSoundManager.currentVolume == "undefined") {
            SCSoundManager.currentVolume = SCUtils.localSoundcloudSettings.defaultVolume;
        }
        if (vol < 0) {
            vol = 0;
        }
        if (vol > 100) {
            vol = 100;
        }
        var nMap = function (number, in_min, in_max, out_min, out_max) {
            return (number - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
        }

        var clamp = function(number, min, max) {
            return Math.min(Math.max(number, min), max);
        }

        SCSoundManager.currentVolume = clamp(SCSoundManager.currentVolume, 0, 100);
        SCSoundManager.pcmVolumeAdjust.setVolume(nMap(SCSoundManager.currentVolume, 0, 100, SCSoundManager.MINVOLUME, SCSoundManager.MAXVOLUME)); //map the volume
        SCUtils.localSoundcloudSettings.currentVolume = SCSoundManager.currentVolume;
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
                        SCSoundManager.currentPlayingTrackDuration = duration;
                        SCSoundManager.currentPlayingTrackPlayed = 0;
                        SCSoundManager.currentPlayingTrack = trackObject;

                        var readable = fs.createReadStream(trackPath); //create the read path

                        var ts = new timedStream({
                            rate: 1000000,
                            period: 100
                        }); //initialize timedStream
                        
                        var audioOptions = { //set audio options
                            channels: 2,
                            bitDepth: 16,
                            sampleRate: 44100,
                            bitRate: 128,
                            outSampleRate: 22050,
                            mode: lame.STEREO
                        };

                        var decoder = new lame.Decoder(audioOptions); //initialize decoder
                        var volumeTweak = new pcmVolume(); //initialize pcm volume changer

                        SCSoundManager.pcmVolumeAdjust = volumeTweak; //set global method so it can be accessed

                        SCSoundManager.setPlayerVolume(SCSoundManager.currentVolume);


                        readable.pipe(ts) //pipe stream to timedStream
                            .pipe(decoder) //pipe to decoder
                            .pipe(volumeTweak) //pipe to volumeTweaker
                        
                        var speaker;
                        function resume() {
                            if (!SCSoundManager.playingTrack) {
                                console.info("_PLAY");

                                speaker = new Speaker(audioOptions); //setup speaker

                                volumeTweak.pipe(speaker); //setup pipe for volumeTweak
                                ts.resumeStream(); //resume the stream
                                SCUtils.playingTrack = true;

                                SCSoundManager.trackTimeInterval = setInterval(function() {
                                    SCSoundManager.currentPlayingTrackPlayed+=0.1; //add the time to the counter
                                },100);

                                return speaker.once('close', function() {
                                    speaker.end();
                                    ts.destroy();
                                    SCSoundManager.playingTrack = false;
                                    clearInterval(SCSoundManager.trackTimeInterval);
                                    if (SCUtils.debugMode) {
                                        console.log("_NEXT SONG REACHED");
                                    }

                                    SCSoundManager.processClientEvent({
                                        type: "trackForward",
                                        origin: "internal (trackFinished)"
                                    }); //request next track
                                })
                            }
                            //volumeTweak.pipe(spk); //pipe adjusted volume tweak stream to speaker (which will play it)
                            //decoder.pipe(volumeTweak); //pipe decoder to volumeTweaker to change volume
                            
                        }

                        function pause() {
                            if (SCSoundManager.playingTrack) {
                                console.info("_PAUSE");
                                clearInterval(SCSoundManager.trackTimeInterval);
                                SCUtils.playingTrack = false;
                                speaker.removeAllListeners('close');
                                volumeTweak.unpipe(speaker);
                                ts.pauseStream();
                                speaker.close();
                                return speaker.end();
                            }
                        }

                        SCSoundManager.trackControl = { //set the track control handler
                            pause: pause,
                            play: resume
                        };

                        if (SCUtils.localSoundcloudSettings.autoplayTrack) {
                            SCSoundManager.playingTrack = false;
                            resume(); //start playing track
                            SCSoundManager.playingTrack = true;
                        } else {
                            SCSoundManager.playingTrack = false;
                        }

                        console.info("INIT DONE: "+trackObject.title);
                    }
                });
            } else {
                return console.error("File doesn't exist");
            }
        })
    }
}