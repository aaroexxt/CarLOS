/*
* allTests.js by Aaron Becker
* All unit tests for CarLOS; uses Mocha+Chai
*
* Dedicated to Marc Perkel
*
*/

const expect = require('chai').expect;
const events = require("events");

const timerModule = require("../drivers/trackTimers&Controllers.js");

describe("basic", function() {
	it('does aaron know how to use mocha?', function(){})
})

describe("#trackTimerModule", function() {
	context("basic tests", function() {
		var trackTimer = timerModule.trackTimer;

		it("should return instance of eventEmitter on init", function() {
			expect(trackTimer.init()).to.be.instanceOf(events);
		})

		it("should return instance of eventEmitter on reset", function() {
			expect(trackTimer.reset(0.001)).to.be.instanceOf(events);
		})
	})

	context("event-driven tests", function() {
		var trackTimer = timerModule.trackTimer;
		it("should return begin event", function(done) {
			trackTimer.init().once('trackBegan', () => {done()})
			trackTimer.reset(0.01);
		})

		it("should return end event after 0.1s", function(done) {
			trackTimer.init();
			trackTimer.reset(0.01).once('trackEnded', () => {done()})
		})

		it("should return pause event", function(done) {
			this.slow(210);

			trackTimer.init();
			trackTimer.reset(0.2).once("trackPaused", () => setTimeout( () => {done()},100)); //give time for rest of tests to pass
			setTimeout( () => {
				trackTimer.pause();

				expect(trackTimer.currentPlayingTrackDuration).to.be.equal(0.2);
				expect(trackTimer.currentPlayingTrackPlayed).to.be.above(0.09);
				expect(trackTimer.currentPlayingTrackPlayed).to.be.below(0.21);
			},100);
		})

		it("should handle resume event", function(done) {
			this.slow(270);

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
	
})

describe("#interactTimerModule", function() {
	context("basic tests", function() {
		var interactTimer = timerModule.interactTimer;

		it("should return instance of eventEmitter", function() {
			expect(interactTimer.init()).to.be.instanceOf(events);
		})

		it("should have time delay of 2 without configuration", function() {
			expect(interactTimer.timeDelay).to.equal(2);
		})

		it("should have time delay of 3 after configuration", function(done) {
			interactTimer.init(3);
			expect(interactTimer.timeDelay).to.equal(3);
			done();
		})
	})

	context("event-driven tests", function() {
		var interactTimer = timerModule.interactTimer;
		it("should return instance of eventEmitter on init", function() {
			expect(interactTimer.init()).to.be.instanceOf(events);
		})

		it("should return instance of eventEmitter on reset", function() {
			expect(interactTimer.reset()).to.be.instanceOf(events);
		})

		it("should return canInteract based on whether timer has expired", function(done) {
			this.slow(110);

			interactTimer.init(0.1);
			expect(interactTimer.canInteract()).to.be.equal(true);
			interactTimer.reset();
			expect(interactTimer.canInteract()).to.be.equal(false);
			setTimeout( () => {
				expect(interactTimer.canInteract()).to.be.equal(true);
				done();
			},105);
		})

		it("should handle cannotInteract event", function(done) {
			this.slow(110);

			interactTimer.init(0.1).once("cannotInteract", () => done())
			interactTimer.reset(); //reset before previous timeout expired
		})

		it("should handle canInteract event", function(done) {
			this.slow(110);

			interactTimer.init(0.1).once("canInteract", () => done())
			interactTimer.reset(); //reset before previous timeout expired
		})
	})

})

describe("#trackController", function() {
	context("basic tests", function() {
		it("should control tracks")
	})
})