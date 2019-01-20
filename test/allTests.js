/*
* allTests.js by Aaron Becker
* All unit tests for CarLOS; uses Mocha+Chai
*
* Dedicated to Marc Perkel
*
*/

const expect = require('chai').expect;
const events = require("events");

const timerModule = require("../drivers/trackTimers.js");

describe("basic", function() {
	it('does aaron know how to use mocha?', function(){})
})

describe("#trackTimers", function() {
	context("track timer module", function() {
		var trackTimer = timerModule.trackTimer;

		it("should return instance of eventEmitter on init", function() {
			expect(trackTimer.init()).to.be.instanceOf(events);
		})

		it("should return instance of eventEmitter on reset", function() {
			expect(trackTimer.reset(0.001)).to.be.instanceOf(events);
		})

		it("should return begin event", function(done) {
			trackTimer.init().once('trackBegan', () => {done()})
			trackTimer.reset(0.01);
		})

		it("should return end event after 0.1s", function(done) {
			trackTimer.init();
			trackTimer.reset(0.01).once('trackEnded', () => {done()})
		})

		it("should return pause event", function(done) {
			trackTimer.init();
			trackTimer.reset(0.3).once("trackPaused", () => setTimeout( () => {done()},200)); //give time for rest of tests to pass
			setTimeout( () => {
				trackTimer.pause();

				expect(trackTimer.currentPlayingTrackDuration).to.be.equal(0.3);
				expect(trackTimer.currentPlayingTrackPlayed).to.be.above(0.09);
				expect(trackTimer.currentPlayingTrackPlayed).to.be.below(0.21);
			},100);

			/*
			var eList = trackTimerModule.reset(2);
			eList.on('trackEnded', () => console.log("TRACKENDED"));
			eList.on('trackPaused', () => console.log("TRACKPAUSED"));
			eList.on('trackResumed', () => console.log("TRACKRESUMED"));

			setTimeout( () => {
			    trackTimerModule.pause();
			},1000);
			setTimeout( () => {
			    trackTimerModule.resume();
			},3000);*/
		})

		it("should handle resume event", function(done) {
			trackTimer.init();
			trackTimer.reset(0.3).once("trackResumed", () => setTimeout( () => {done()},100)); //give time for rest of tests
			setTimeout( () => {
				trackTimer.pause();
			},100);
			setTimeout( () => {
				trackTimer.resume();
			},150);
			setTimeout( () => {
				expect(trackTimer.currentPlayingTrackDuration).to.be.equal(0.3);
				expect(trackTimer.currentPlayingTrackPlayed).to.be.above(0.09);
				expect(trackTimer.currentPlayingTrackPlayed).to.be.below(0.31);
			},260)
		});
	})

	context("interact timer module", function() {
		var interactTimer = timerModule.interactTimer;

		it("should return instance of eventEmitter", function() {
			expect(interactTimer.init()).to.be.instanceOf(events);
		})

		it("should have time delay of 2 without configuration", function() {
			expect(interactTimer.timeDelay).to.equal(2);
		})

		it("should have time delay of 3 after configuration", function(done) {
			try {
				interactTimer.init(3);
				expect(interactTimer.timeDelay).to.equal(3);
				done();
			} catch(e) {
				done(e);
			}
		})
	})
})



//yuh testing code, I should put this into mocha at some point
/*
var _this = trackTimerModule;
console.log(
    (((1-(_this.currentPlayingTrackPlayed/_this.currentPlayingTrackDuration))*_this.currentPlayingTrackDuration)*1000)
    )*/