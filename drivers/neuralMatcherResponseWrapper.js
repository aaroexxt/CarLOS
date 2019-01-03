/*
* neuralMatcherResponseWrapper.js by Aaron Becker
* Parses and evaluates speech data into categories using neural network
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const fs = require('fs');
const path = require('path');

var NeuralResponder = {
	debugMode: true,
	commandGroup: undefined,
	responses: undefined,

    init: function(neuralSettings) {
        return new Promise( (resolve, reject) => {
            if (!neuralSettings) {
                return reject("NeuralSettings not supplied to init")
            }

            const bp = neuralSettings.commandMatching.dataBasePath;
            const cm = neuralSettings.commandMatching;

            if (NeuralResponder.debugMode) {
                console.log("Loading data from base directory "+bp);
            }

            try {
                var commandGroup = require(cm.commandGroupPath); //require cg
                console.log(commandGroup)
                var responses = JSON.parse(fs.readFileSync(path.join(bp, cm.responsesPath)));
            } catch(e) {
                return reject("Failed to load file on init: "+e);
            }

            NeuralResponder.commandGroup = commandGroup;
            NeuralResponder.responses = responses;
            NeuralResponder.classes = [];

            for (var i=0; i<responses.length; i++) {
            	NeuralResponder.classes.push(responses[i].class);
            }

            NeuralResponder.classes = NeuralResponder.classes.filter(function (value, index, self) { //uniqueify
	            return self.indexOf(value) === index;
	        });

            console.log(NeuralResponder.classes)


            //the following command has to do with response parsing which is something that I need to fix and I don't want to get into
            /*console.log("[SPEECHPARSE] Sentences in response data: "+responseData.length);
            console.log("[SPEECHPARSE] Preprocessing data...");
            speechParser.algorithm.preprocessData(responses);
            console.log("[SPEECHPARSE] Data preprocessed successfully.");

            var lines = JSON.parse(data); //read data and set approval object
            var foundCommandGroup = false;
            var commands = [];
            for (var i=0; i<lines.length; i++) {
                if (lines[i].type == "commandGroup") {
                    speechParser.algorithm.commandGroup = lines[i].commandGroup;
                    foundCommandGroup = true;
                } else if (lines[i].type == "command") {
                    commands.push([lines[i].command,lines[i].response,lines[i].arguments]);
                }
            }
            if (!foundCommandGroup) {
                throw "[FATAL] No commandGroup found in commandGroup file.";
            } else if (commands.length != speechParser.algorithm.commandGroup.length) {
                throw "[FATAL] CommandGroup length does not match command length. Are there commands missing from the commandGroup file? (command length: "+commands.length+", cg length: "+speechParser.algorithm.commandGroup.length;
            } else {
                speechParser.algorithm.commandFunctions = commands;
            }*/

            return resolve();
        })
    }
}

module.exports = NeuralResponder;