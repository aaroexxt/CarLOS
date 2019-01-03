/*
* neuralMatcherCommandWrapper.js by Aaron Becker
* Training and utilities for neural network speech matching algorithm
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2019, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const brain = require("brain.js");
const path = require("path");
const fs = require("fs");

const lancasterStemmer = require('./algorithms/lancasterStemmer.js');

var NeuralMatcher = {
    words: [],
    documents: [],
    classes: [],
    rawData: {
        commands: []
    },
    commandClassifierNet: undefined,
    ignore_words: ["!",":",";","?",",",".","x"],
    punctuation: ["!",":",";","?",",","."],
    stemmer: lancasterStemmer,
    cutoffOutput: 0.3,
    debugMode: true,

    init: function(neuralSettings) {
        return new Promise( (resolve, reject) => {
            if (!neuralSettings) {
                return reject("NeuralSettings not supplied to init")
            }

            const bp = neuralSettings.commandMatching.dataBasePath;
            const cm = neuralSettings.commandMatching;

            if (NeuralMatcher.debugMode) {
                console.log("Loading data from base directory "+bp);
            }

            try {
                var commands = JSON.parse(fs.readFileSync(path.join(bp, cm.commandsPath)));
            } catch(e) {
                return reject("Failed to load file on init: "+e);
            }

            NeuralMatcher.rawData = { //set rae data
                commands: commands
            }

            if (NeuralMatcher.debugMode) {
                console.log("[SPEECHNET] Sentences in speech training data: "+commands.length);
                console.log("[SPEECHNET] Preprocessing data...");
            }
            NeuralMatcher.preprocessData(commands);
            if (NeuralMatcher.debugMode) {
                console.log("[SPEECHNET] Generating training data...");
            }
            var td = NeuralMatcher.generateTrainingData(); //uses preprocessed data
            if (NeuralMatcher.debugMode) {
                console.log("[SPEECHNET] Creating net");
            }
            const commandClassifierNet = new brain.NeuralNetwork(); //make the net
            if (NeuralMatcher.debugMode) {
                console.log("[SPEECHNET] Training net to target error "+Number(cm.targetError));
            }

            NeuralMatcher.trainNet(commandClassifierNet, Number(cm.targetError), td);
            NeuralMatcher.commandClassifierNet = commandClassifierNet;

            return resolve();
        })
    },

    preprocessData: function(data) {
        NeuralMatcher.words = []; //blank out arrays
        NeuralMatcher.classes = [];
        NeuralMatcher.documents = [];

        for (var i=0; i<data.length; i++) { //preprocessing
            NeuralMatcher.documents.push([data[i].sentence, data[i].class]);//don't want split sentence since it is done in postprocessing
            var depunctuatedSentence = NeuralMatcher.depunctuateSentence(data[i].sentence); //depunctuate the sentence
            var wordsInSentence = depunctuatedSentence.split(" ");

            for (var j=0; j<wordsInSentence.length; j++) { //add each word
                NeuralMatcher.words.push(wordsInSentence[j]);
            }

            if (NeuralMatcher.classes.indexOf(data[i].class) == -1) {
                NeuralMatcher.classes.push(data[i].class);
            }

        }

        var filteredWords = [];
        for (var i=0; i<NeuralMatcher.words.length; i++) {
            if (NeuralMatcher.ignore_words.indexOf(NeuralMatcher.words[i]) == -1) {
                filteredWords.push(NeuralMatcher.stemmer(NeuralMatcher.words[i].toLowerCase())); //stem it
            }
        }
        NeuralMatcher.words = filteredWords;

        NeuralMatcher.words = NeuralMatcher.words.filter(function (value, index, self) { //uniqueify
            return self.indexOf(value) === index;
        });

        if (NeuralMatcher.debugMode) {
            console.log(NeuralMatcher.words.length+" unique stemmed words after preprocessing");
        }
    },

    tokenizeSentence: function(sentence) {
        sentence = sentence.split(" ");
        for (var j=0; j<sentence.length; j++) { //tokenization
            for (var b=0; b<NeuralMatcher.punctuation.length; b++) {
                if (sentence[j].substring(0,1) == NeuralMatcher.punctuation[b]) {
                    sentence[j] = sentence[j].substring(1,sentence[j].length); //splice out punctuation
                } else if (sentence[j].substring(sentence[j].length-1, sentence[j].length) == NeuralMatcher.punctuation[b]) {
                    sentence[j] = sentence[j].substring(0,sentence[j].length-1);
                }
            }
        }
        return sentence;
    },

    depunctuateSentence: function(sentence) {
        sentence = sentence.split(" ");
        for (var j=0; j<sentence.length; j++) { //tokenization
            for (var b=0; b<NeuralMatcher.punctuation.length; b++) {
                if (sentence[j].substring(0,1) == NeuralMatcher.punctuation[b]) {
                    sentence[j] = sentence[j].substring(1,sentence[j].length); //splice out punctuation
                } else if (sentence[j].substring(sentence[j].length-1, sentence[j].length) == NeuralMatcher.punctuation[b]) {
                    sentence[j] = sentence[j].substring(0,sentence[j].length-1);
                }
            }
        }
        sentence = sentence.join(" ");
        return sentence;
    },

    stemSentence: function(sentence) {
        sentence = sentence.split(" ");
        for (var i=0; i<sentence.length; i++) {
            sentence[i] = NeuralMatcher.stemmer(sentence[i]);
        }
        sentence = sentence.join(" ");
        return sentence;
    },

    bagOfWords: function(sentence, words) {
        if (typeof words == "undefined") {
            words = NeuralMatcher.words; //default
        }
        sentence = sentence.split(" ");
        for (var i=0; i<sentence.length; i++) { //tokenization
            for (var b=0; b<NeuralMatcher.punctuation.length; b++) {
                if (sentence[i].substring(0,1) == NeuralMatcher.punctuation[b]) {
                    sentence[i] = sentence[i].substring(1,sentence[i].length); //splice out punctuation
                } else if (sentence[i].substring(sentence[i].length-1, sentence[i].length) == NeuralMatcher.punctuation[b]) {
                    sentence[i] = sentence[i].substring(0,sentence[i].length-1);
                }
            }
            sentence[i] = NeuralMatcher.stemmer(sentence[i].toLowerCase()); //stem it
        }

        var bag = []; //make a blank array
        for (var i=0; i<words.length; i++) {
            bag.push(0);
        }

        for (var i=0; i<sentence.length; i++) {
            for (var j=0; j<words.length; j++) {
                if (words[j] == sentence[i]) {
                    //console.log("bag match: word "+words[j]+", sentence word "+sentence[i]+", i="+i+", j="+j)
                    bag[j] = 1;
                }
            }
        }
        return bag;
    },

    generateTrainingData: function() {

        var training_data = []; //generate that training data!

        for (var i=0; i<NeuralMatcher.documents.length; i++) {
            var bag = NeuralMatcher.bagOfWords(NeuralMatcher.documents[i][0], NeuralMatcher.words);

            var output = [];
            for (var j=0; j<NeuralMatcher.classes.length; j++) {
                output.push(0);
            }
            var classIndex = NeuralMatcher.classes.indexOf(NeuralMatcher.documents[i][1]);
            if (classIndex == -1) {
                console.error("ClassIndex is -1, training error");
            } else {
                output[classIndex] = 1;
                training_data.push({"input": bag, "output": output})
            }
        }

        return training_data;
    },

    trainNet: function(net, targetError, trainingData, callback) {
        callback = callback || function(){}
        var training = net.train(trainingData, {
            iterations: 50000,
            //errorThresh: 0.00001,
            errorThresh: targetError,
            log: false,
            logPeriod: 10,
            learningRate: 0.3,
            momentum: 0.1,
            callback: callback,
            callbackPeriod: 1,
            timeout: 50000
        });
        return training;
    },

    trainNetAsync: function(net, targetError, trainingData, callback, successCallback, failCallback) {
        callback = callback || function(){}
        var training = net.trainAsync(trainingData, {
            iterations: 50000,
            //errorThresh: 0.00001,
            errorThresh: targetError,
            log: false,
            logPeriod: 10,
            learningRate: 0.3,
            momentum: 0.1,
            callback: callback,
            callbackPeriod: 100,
            timeout: 60000
        }).then(successCallback).catch(failCallback);
        return training;
    },

    getOutput: function(net, sentence) {
        var bag = NeuralMatcher.bagOfWords(sentence, NeuralMatcher.words);
        var output = net.run(bag);
        var prob = [];
        var probClasses = [];
        for (var i=0; i<output.length; i++) {
            if (output[i] < NeuralMatcher.cutoffOutput) {
                prob.push(0);
            } else {
                prob.push(1);
                probClasses.push([NeuralMatcher.classes[i], output[i]]);
            }
        }
        return [output,prob,probClasses];
    },

    classify: function(sentence) {
        return NeuralMatcher.getOutput(NeuralMatcher.commandClassifierNet, sentence)[2];
    }
}

module.exports = NeuralMatcher;
