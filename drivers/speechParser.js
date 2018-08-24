/*
* speechParser.js by Aaron Becker
* Parses and evaluates speech data into categories using neural network
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

/*
Voices:
En-Gb normal
Veena with low rate/pitch for computery-sounding voice
bonus response: {"class": "joke", "sentence":"Let's do a knock-knock joke. *:pause 1s* Knock-knock. *:ifans whos there :jumpto sentence2 :else Ask me who's there.", "sentence2": "Control Freak *:pause 1s* Okay, now you say Control Freak who?"},
*/
var speechParser = {
    responses: [],
    classes: [],
    queue: [],
    commandOperator: ":",
    commandGroup: [],
    commandFunctions: [],
    /*example queue struct:
    [
    "hello",
    ":pause 1s",
    "world"
    */
    preprocessData: function(data) {
        for (var i=0; i<data.length; i++) { //preprocessing
            speechParser.responses.push([data[i].sentence, data[i].class]);
            speechParser.classes.push([data[i].class]);
        }
    },
    addSentence: function(sentence) { //function to syntactically process sentence
        var queue = [];
        if (typeof sentence == "undefined") {
            console.error("[SPEECH_PARSER] AddSentence recieved undefined sentence");
        } else {
            var process = sentence.split("[PAUSE]");
            for (var j=0; j<process.length; j++) {
                speechParser.queue.push(process[j]);
            }
        }
    },
    addRNGClass: function(tgtclass, raw) {
        console.log("recieved targetclass "+tgtclass);
        var classCount = 0;
        var indices = [];
        for (var i=0; i<speechParser.classes.length; i++) {
            if (speechParser.responses[i][1] == tgtclass) {
                classCount++;
                indices.push(i);
            }
        }
        if (classCount == 0) {
            console.warn("[SPEECH_PARSER] AddRNGClass called with nonexistent class '"+tgtclass+"'")
        } else {
            var randIndice = 0;
            if (indices.length == 1) {
                randIndice = indices[0];
            } else {
                var randIndiceIndex = Math.floor(Math.random() * (indices.length + 1)); //generate a random indice from the list of random indices
                if (randIndiceIndex >= indices.length) { //sanity checks might help errors?
                    randIndiceIndex = indices.length-1;
                    console.warn("[SPEECH_PARSER] indice check failed i>len, sanity check engaged")
                } else if (randIndiceIndex < 0) {
                    randIndiceIndex = 0;
                    console.warn("[SPEECH_PARSER] indice check failed <0, sanity check engaged")
                }
                randIndice = indices[randIndiceIndex]; //find a random indice of the ones that contain our class
            }
            try {
                //console.log("indices: "+JSON.stringify(indices)+", rand "+randIndiceIndex+", val "+randIndice+", pars "+JSON.stringify(speechParser.responses[randIndice][0]))
                var sentence = speechParser.responses[randIndice][0];
                if (typeof sentence == "undefined" || sentence == null) {
                    console.error("[SPEECH_PARSER] Indice "+randIndice+" does not point to a valid response index, because it is undefined. Is there a problem with the class "+tgtclass+" in responses.json? classCount is "+classCount+", len of indices is "+indices.length+", randIndiceIndex="+randIndiceIndex+", randomIndice="+randIndice+", responses="+JSON.stringify(speechParser.responses))
                } else {
                    if (speechParser.commandGroup.length < 1) {
                        console.error("[SPEECH_PARSER] Command group length is less than one")
                    } else {
                        var fsentence = speechParser.evaluateCommands(sentence);
                        speechParser.addSentence(fsentence);
                    }
                }
            } catch(e) {
                console.error("[SPEECH_PARSER] Indice "+randIndice+" does not point to a valid response index, classCount is "+classCount+", len of indices is "+indices.length+", randIndiceIndex="+randIndiceIndex)
            }
        }
    },
    evaluateCommands: function(raw) {
        console.log("rawcommand="+raw);
        var split = raw.split(speechParser.commandOperator);
        if (split.length == 1) {
            console.log("Split length 1, returning raw")
            return raw;
        } else {
            var finalcommand = "";
            for (var i=0; i<split.length; i++) {
                var splitSp = split[i].split(" "); //split by spaces to find arguments
                var args = [];
                var command = splitSp[0]; //command should be first
                console.log("command for evaluation: "+command)
                if (command == " " || command == "") {
                    split[i] = " ";
                } else {
                    var commandIndex = speechParser.commandGroup.indexOf(command); //is command in commandgroup?
                    var functionIndex = -1;
                    for (var j=0; j<speechParser.commandFunctions.length; j++) {
                        if (speechParser.commandFunctions[j][0] == command) {
                            functionIndex = j;
                            //console.log("found command in commandFunctions");
                        }
                    }
                    if (commandIndex > -1 && functionIndex > -1) {
                        if (splitSp.length > 1) { //arguments?
                            for (var j=1; j<splitSp.length; j++) {
                                console.log("arg: "+splitSp[j]);
                                args.push(splitSp[j]);
                            }
                        }
                        var resp;
                        //console.log("function: "+speechParser.commandFunctions[functionIndex][1]+", arguments: "+speechParser.commandFunctions[functionIndex][2]+", function: "+JSON.stringify(speechParser.commandFunctions[functionIndex]))
                        if (speechParser.commandFunctions[functionIndex][2]) { //arguments
                            resp = new Function(speechParser.commandFunctions[functionIndex][1]).apply(null,args);
                        } else {
                            resp = new Function(speechParser.commandFunctions[functionIndex][1]);
                        }
                        if (typeof resp == "undefined") {
                            split[i] = "";
                        } else if (resp == null) {
                            split[i] = "";
                        } else {
                            split[i] = resp;
                        }
                        
                        //console.log("resp from fn: "+resp)
                    } else if (split[i].substring(0,1) == " "){ //if not found, it's not a command, so fix (backup incase the response is list: 1,2,3)
                        split[i] = ":"+split[i];
                        console.log("command doesn't exist, findex = "+functionIndex+", commandIndex = "+commandIndex)
                    }
                }
            }
        }
        console.log("finalcommand: "+JSON.stringify(split))
        return split.join("");
        /*
        IDEAS:
        Dumb and smart matching:
        I.e. user input: 'text mom that I love her'
        Step 1) Run thru neuralnet: classifies as category 'text'
        Step 2) Match command to dumb 'filters', filter examples:
            1: 'text *user* *text*'
            2: 'tell *user* *text*'
            3: 'text *user* that *text*'
            Using regex matching like annyang?
        Step 3) If matched to 'dumb' list, then evaluate and respond accordingly, if not:
            -Since you know that it is in the category 'text', ask the user:
                1: Who would you like me to text?
                2: What would you like me to tell them?
            And send
        Yay!
        */
    },
    clearQueue: function() {
        speechParser.queue = [];
    },
    dumpQueue: function() {
        return speechParser.queue;
    },
    dumpAndClearQueue: function() {
        var queue = JSON.parse(JSON.stringify(speechParser.queue));
        speechParser.queue = [];
        return queue;
    }
}

exports.algorithm = speechParser;