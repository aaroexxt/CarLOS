/*
* trackTimers.js by Aaron Becker
* Basic timers/utility functions for soundManager that are needed, such as timing of tracks and 
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*
*/

const eventEmitter = require('events');

var trackTimerModule = { //module that times track and counts how long it's been going (for lack of a seek function)
    currentPlayingTrackDuration: 0, //duration of current playing track
    currentPlayingTrackPlayed: 0,
    trackTimeInterval: 0,
    trackEndTimeout: 0,
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


        _this.trackTimeInterval = setInterval( () => {
            trackTimerModule.currentPlayingTrackPlayed+=0.1;
        },100);

        _this.trackEndTimeout = setTimeout( () => {
            clearInterval(trackTimerModule.trackTimeInterval);
            trackTimerModule.eventEmitter.emit("trackEnded");
        },trackLength*1000);
        _this.eventEmitter.emit("trackBegan");
        
        return _this.eventEmitter;
    },
    pause: () => {
        var _this = trackTimerModule;

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
        },(((1-(_this.currentPlayingTrackPlayed/_this.currentPlayingTrackDuration))*_this.currentPlayingTrackDuration)*1000)); //use percent played to determine remaining timer length
        _this.eventEmitter.emit("trackResumed");
        
        return _this.eventEmitter;
    }

}

var interactTimerModule = { //client interaction timer that prevents client interaction within a certain timeframe (prevents a weird bug with Speaker)
    canInteractWithTrack: true,
    interactTimeInterval: 0,
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
    reset: () => {},
    canInteract: () => {
        return interactTimerModule.canInteractWithTrack;
    }
}


module.exports = {
    trackTimer: trackTimerModule,
    interactTimer: interactTimerModule
}