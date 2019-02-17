/*
* trackTimers.js by Aaron Becker
* Basic timers/utility functions for soundManager that are needed, such as timing of tracks
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*
*/

const eventEmitter = require('events');
const fs = require('fs');
const Speaker = require('speaker');


/********
TRACKTIMER: times tracks and keeps track of when they should end
********/
const trackTimerModule = { //module that times track and counts how long it's been going (for lack of a seek function)
    currentPlayingTrackDuration: 0, //duration of current playing track
    currentPlayingTrackPlayed: 0,
    trackTimeInterval: 0,
    trackEndTimeout: 0,
    playingTrack: false,
    eventEmitter: new eventEmitter(),
    init: () => {
        var _this = trackTimerModule;
        _this.currentPlayingTrackPlayed = 0;
        _this.trackTimeInterval = 0;

        return _this.eventEmitter;
    },
    reset: (trackLength) => {
        var _this = trackTimerModule;

        if (!trackLength) {
            console.error("Tracklength parameter not passed into timer reset");
            return _this.eventEmitter;
        }

        _this.currentPlayingTrackPlayed = 0;
        _this.currentPlayingTrackDuration = trackLength;
        _this.playingTrack = true;


        _this.trackTimeInterval = setInterval( () => {
            trackTimerModule.currentPlayingTrackPlayed+=0.1;
        },100);

        _this.trackEndTimeout = setTimeout( () => {
            clearInterval(trackTimerModule.trackTimeInterval);
            trackTimerModule.eventEmitter.emit("trackEnded");
            _this.playingTrack = false;
        },trackLength*1000);
        _this.eventEmitter.emit("trackBegan");
        
        return _this.eventEmitter;
    },
    pause: () => {
        var _this = trackTimerModule;

        _this.playingTrack = false;
        clearInterval(_this.trackTimeInterval);
        clearTimeout(_this.trackEndTimeout);
        _this.eventEmitter.emit("trackPaused");
    },
    resume: () => {
        var _this = trackTimerModule;

        if (_this.currentPlayingTrackPlayed > _this.currentPlayingTrackDuration) {
            console.warn("trackTimer resume called on track that has ended");
            return _this.eventEmitter; //track has already ended, no need to do anything
        }

        _this.trackTimeInterval = setInterval( () => {
            trackTimerModule.currentPlayingTrackPlayed+=0.1;
        },100);

        _this.trackEndTimeout = setTimeout( () => {
            clearInterval(trackTimerModule.trackTimeInterval);
            trackTimerModule.eventEmitter.emit("trackEnded");
            _this.playingTrack = false;
        },(((1-(_this.currentPlayingTrackPlayed/_this.currentPlayingTrackDuration))*_this.currentPlayingTrackDuration)*1000)); //use percent played to determine remaining timer length
        _this.eventEmitter.emit("trackResumed");
        _this.playingTrack = true;
        
        return _this.eventEmitter;
    },

    getPlayedSeconds: () => {
        return trackTimerModule.currentPlayingTrackPlayed;
    },

    getTrackDuration: () => {
        return trackTimerModule.currentPlayingTrackDuration;
    },

    getPlayedPercent: function() {
        return (trackTimerModule.currentPlayingTrackPlayed/trackTimerModule.currentPlayingTrackDuration)*100;
    }

}


/********
INTERACTTIMER: client interaction timer that prevents weird bugs
********/

const interactTimerModule = { //client interaction timer that prevents client interaction within a certain timeframe (prevents a weird bug with Speaker)
    canInteractWithTrack: true,
    interactTimeout: 0,
    timeDelay: 2,
    eventEmitter: new eventEmitter(),
    init: (timeDelay) => {
        var _this = interactTimerModule;
        if (timeDelay) {
            _this.timeDelay = timeDelay;
        }
        _this.canInteractWithTrack = true;

        return _this.eventEmitter;
    },
    reset: () => {
        var _this = interactTimerModule;
        _this.canInteractWithTrack = false;

        clearTimeout(_this.interactTimeout);
        _this.interactTimeout = setTimeout( () => {
            _this.eventEmitter.emit("canInteract");
            _this.canInteractWithTrack = true;
        },_this.timeDelay*1000);

        _this.eventEmitter.emit("cannotInteract");

        return _this.eventEmitter;
    },
    canInteract: (dontReset) => {
        var _this = interactTimerModule;
        if (!dontReset) { //flag to not reset timer when peeking at canInteract variable
            _this.reset();
        }
        return _this.canInteractWithTrack;
    }
}


/********
TRACK CONTROLLER: controls the tracks/raw output data
********/

//dependencies
const lame = require("lame");
const pcmVolume = require("pcm-volume");
const timedStream = require('timed-stream');

const nMap = function (number, in_min, in_max, out_min, out_max) { //number mapping
    return (number - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

const clamp = function(number, min, max) { //clamp values
    return Math.min(Math.max(number, min), max);
}

const trackControl = { //module which controls the speaker and can output&decode the mp3 data to PCM speaker data
    pcm_MINVOLUME: 0, //pcm constants, shouldn't be changed for any reason
    pcm_MAXVOLUME: 1.5,
    playingTrackInternal: false, //internal playing track state
    defaultAudioOptions:  { //set audio options
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
        bitRate: 128,
        outSampleRate: 22050,
        mode: lame.STEREO
    },

    pipeline: {
        readStream: undefined,
        volumeAdjust: new pcmVolume(), //initialize pcm volume changer
        decoder: new lame.Decoder(this.defaultAudioOptions), //initialize decoder
        timedInputStream: new timedStream({ //initialize timedStream
            rate: 1000000,
            period: 100
        }),
        speaker: undefined
    },

    eventEmitter: new eventEmitter(),
    

    currentVolume: 50,


    setVolume: function(vol) {
        var _this = trackControl;

        if (_this.currentVolume == null || typeof _this.currentVolume == "undefined") {
            _this.currentVolume = 50;
        }

        if (typeof vol == "number") { //make sure it's a number
            _this.currentVolume = vol;
        }
        _this.currentVolume = clamp(_this.currentVolume, 0, 100); //clamp range

        _this.pipeline.volumeAdjust.setVolume(nMap(_this.currentVolume, 0, 100, _this.pcm_MINVOLUME, _this.pcm_MAXVOLUME)); //map the volume

        _this.eventEmitter.emit("volumeChange");
    },

    play: (filename) => {
        var _this = trackControl;
        fs.stat(filename, function(err, stat) {
            if (err == null) {
                var readable = fs.createReadStream(filename); //create the read path
                _this.pipeline.readStream = readable;

                _this.pipeline.timedInputStream = new timedStream({
                    rate: 1000000,
                    period: 100
                }); //initialize timedStream
                
                _this.pipeline.volumeAdjust = new pcmVolume();
                _this.pipeline.decoder = new lame.Decoder(_this.defaultAudioOptions);
                
               _this.setVolume(_this.currentVolume); //make sure volume is set correctly

                readable.pipe(_this.pipeline.timedInputStream) //pipe stream to timedStream
                    .pipe(_this.pipeline.decoder) //pipe to decoder
                    .pipe(_this.pipeline.volumeAdjust) //pipe to volumeTweaker

                console.log("__internal_trackAudio play");
                _this.resume(); //start playing the track
            } else {
                console.error("Error playing track: "+err);
            }
        })

        return _this.eventEmitter;               
    },
    resume: () => {
        var _this = trackControl;
        console.log("INTERNAL_PLAY:RESUME ",_this.playingTrackInternal);
        if (!_this.playingTrackInternal) {
            console.info("_RESUME");
            _this.playingTrackInternal = true;

            _this.pipeline.speaker = new Speaker(_this.defaultAudioOptions); //setup speaker

            _this.pipeline.volumeAdjust.pipe(_this.pipeline.speaker); //setup pipe for volumeTweak
            _this.pipeline.timedInputStream.resumeStream(); //resume the stream

            _this.eventEmitter.emit("trackPlay");

            return _this.pipeline.speaker.once('close', function() {
                trackControl.pipeline.timedInputStream.destroy();
                trackControl.eventEmitter.emit("trackEnd");
            });
        }

        return _this.eventEmitter;
        
    },

    pause: () => {
        var _this = trackControl;
        console.log("INTERNAL_PLAY:PAUSE ",_this.playingTrackInternal);
        if (_this.playingTrackInternal) {
            console.info("_PAUSE");
            _this.playingTrackInternal = false;

            _this.pipeline.volumeAdjust.unpipe(_this.pipeline.speaker); //unpipe to stop playback
            _this.pipeline.timedInputStream.pauseStream(); //stop reading of audio

            _this.pipeline.speaker.removeAllListeners('close'); //remove listeners and close speaker
            _this.eventEmitter.emit("trackPause");
            return _this.pipeline.speaker.close();
        }

        return _this.eventEmitter;
    }
}


module.exports = {
    trackTimerModule: trackTimerModule,
    interactTimerModule: interactTimerModule,
    trackAudioController: trackControl
}