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
            var process = sentence.split("*");
            for (var j=0; j<process.length; j++) {
                speechParser.queue.push(process[j]);
            }
        }
    },
    addRNGClass: function(tgtclass) {
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
                    speechParser.addSentence(sentence);
                }
            } catch(e) {
                console.error("[SPEECH_PARSER] Indice "+randIndice+" does not point to a valid response index, classCount is "+classCount+", len of indices is "+indices.length+", randIndiceIndex="+randIndiceIndex)
            }
        }
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