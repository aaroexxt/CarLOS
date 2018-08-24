var STOP = -1;
var INTACT = 0;
var CONTINUE = 1;
var PROTECT = 2;
var VOWELS = /[aeiouy]/;
var rules = {
  a: [
    {match: 'ia', replacement: '', type: INTACT},
    {match: 'a', replacement: '', type: INTACT}
  ],
  b: [{match: 'bb', replacement: 'b', type: STOP}],
  c: [
    {match: 'ytic', replacement: 'ys', type: STOP},
    {match: 'ic', replacement: '', type: CONTINUE},
    {match: 'nc', replacement: 'nt', type: CONTINUE}
  ],
  d: [
    {match: 'dd', replacement: 'd', type: STOP},
    {match: 'ied', replacement: 'y', type: CONTINUE},
    {match: 'ceed', replacement: 'cess', type: STOP},
    {match: 'eed', replacement: 'ee', type: STOP},
    {match: 'ed', replacement: '', type: CONTINUE},
    {match: 'hood', replacement: '', type: CONTINUE}
  ],
  e: [{match: 'e', replacement: '', type: CONTINUE}],
  f: [
    {match: 'lief', replacement: 'liev', type: STOP},
    {match: 'if', replacement: '', type: CONTINUE}
  ],
  g: [
    {match: 'ing', replacement: '', type: CONTINUE},
    {match: 'iag', replacement: 'y', type: STOP},
    {match: 'ag', replacement: '', type: CONTINUE},
    {match: 'gg', replacement: 'g', type: STOP}
  ],
  h: [
    {match: 'th', replacement: '', type: INTACT},
    {match: 'guish', replacement: 'ct', type: STOP},
    {match: 'ish', replacement: '', type: CONTINUE}
  ],
  i: [
    {match: 'i', replacement: '', type: INTACT},
    {match: 'i', replacement: 'y', type: CONTINUE}
  ],
  j: [
    {match: 'ij', replacement: 'id', type: STOP},
    {match: 'fuj', replacement: 'fus', type: STOP},
    {match: 'uj', replacement: 'ud', type: STOP},
    {match: 'oj', replacement: 'od', type: STOP},
    {match: 'hej', replacement: 'her', type: STOP},
    {match: 'verj', replacement: 'vert', type: STOP},
    {match: 'misj', replacement: 'mit', type: STOP},
    {match: 'nj', replacement: 'nd', type: STOP},
    {match: 'j', replacement: 's', type: STOP}
  ],
  l: [
    {match: 'ifiabl', replacement: '', type: STOP},
    {match: 'iabl', replacement: 'y', type: STOP},
    {match: 'abl', replacement: '', type: CONTINUE},
    {match: 'ibl', replacement: '', type: STOP},
    {match: 'bil', replacement: 'bl', type: CONTINUE},
    {match: 'cl', replacement: 'c', type: STOP},
    {match: 'iful', replacement: 'y', type: STOP},
    {match: 'ful', replacement: '', type: CONTINUE},
    {match: 'ul', replacement: '', type: STOP},
    {match: 'ial', replacement: '', type: CONTINUE},
    {match: 'ual', replacement: '', type: CONTINUE},
    {match: 'al', replacement: '', type: CONTINUE},
    {match: 'll', replacement: 'l', type: STOP}
  ],
  m: [
    {match: 'ium', replacement: '', type: STOP},
    {match: 'um', replacement: '', type: INTACT},
    {match: 'ism', replacement: '', type: CONTINUE},
    {match: 'mm', replacement: 'm', type: STOP}
  ],
  n: [
    {match: 'sion', replacement: 'j', type: CONTINUE},
    {match: 'xion', replacement: 'ct', type: STOP},
    {match: 'ion', replacement: '', type: CONTINUE},
    {match: 'ian', replacement: '', type: CONTINUE},
    {match: 'an', replacement: '', type: CONTINUE},
    {match: 'een', replacement: '', type: PROTECT},
    {match: 'en', replacement: '', type: CONTINUE},
    {match: 'nn', replacement: 'n', type: STOP}
  ],
  p: [
    {match: 'ship', replacement: '', type: CONTINUE},
    {match: 'pp', replacement: 'p', type: STOP}
  ],
  r: [
    {match: 'er', replacement: '', type: CONTINUE},
    {match: 'ear', replacement: '', type: PROTECT},
    {match: 'ar', replacement: '', type: STOP},
    {match: 'ior', replacement: '', type: CONTINUE},
    {match: 'or', replacement: '', type: CONTINUE},
    {match: 'ur', replacement: '', type: CONTINUE},
    {match: 'rr', replacement: 'r', type: STOP},
    {match: 'tr', replacement: 't', type: CONTINUE},
    {match: 'ier', replacement: 'y', type: CONTINUE}
  ],
  s: [
    {match: 'ies', replacement: 'y', type: CONTINUE},
    {match: 'sis', replacement: 's', type: STOP},
    {match: 'is', replacement: '', type: CONTINUE},
    {match: 'ness', replacement: '', type: CONTINUE},
    {match: 'ss', replacement: '', type: PROTECT},
    {match: 'ous', replacement: '', type: CONTINUE},
    {match: 'us', replacement: '', type: INTACT},
    {match: 's', replacement: '', type: CONTINUE},
    {match: 's', replacement: '', type: STOP}
  ],
  t: [
    {match: 'plicat', replacement: 'ply', type: STOP},
    {match: 'at', replacement: '', type: CONTINUE},
    {match: 'ment', replacement: '', type: CONTINUE},
    {match: 'ent', replacement: '', type: CONTINUE},
    {match: 'ant', replacement: '', type: CONTINUE},
    {match: 'ript', replacement: 'rib', type: STOP},
    {match: 'orpt', replacement: 'orb', type: STOP},
    {match: 'duct', replacement: 'duc', type: STOP},
    {match: 'sumpt', replacement: 'sum', type: STOP},
    {match: 'cept', replacement: 'ceiv', type: STOP},
    {match: 'olut', replacement: 'olv', type: STOP},
    {match: 'sist', replacement: '', type: PROTECT},
    {match: 'ist', replacement: '', type: CONTINUE},
    {match: 'tt', replacement: 't', type: STOP}
  ],
  u: [
    {match: 'iqu', replacement: '', type: STOP},
    {match: 'ogu', replacement: 'og', type: STOP}
  ],
  v: [
    {match: 'siv', replacement: 'j', type: CONTINUE},
    {match: 'eiv', replacement: '', type: PROTECT},
    {match: 'iv', replacement: '', type: CONTINUE}
  ],
  y: [
    {match: 'bly', replacement: 'bl', type: CONTINUE},
    {match: 'ily', replacement: 'y', type: CONTINUE},
    {match: 'ply', replacement: '', type: PROTECT},
    {match: 'ly', replacement: '', type: CONTINUE},
    {match: 'ogy', replacement: 'og', type: STOP},
    {match: 'phy', replacement: 'ph', type: STOP},
    {match: 'omy', replacement: 'om', type: STOP},
    {match: 'opy', replacement: 'op', type: STOP},
    {match: 'ity', replacement: '', type: CONTINUE},
    {match: 'ety', replacement: '', type: CONTINUE},
    {match: 'lty', replacement: 'l', type: STOP},
    {match: 'istry', replacement: '', type: STOP},
    {match: 'ary', replacement: '', type: CONTINUE},
    {match: 'ory', replacement: '', type: CONTINUE},
    {match: 'ify', replacement: '', type: STOP},
    {match: 'ncy', replacement: 'nt', type: CONTINUE},
    {match: 'acy', replacement: '', type: CONTINUE}
  ],
  z: [
    {match: 'iz', replacement: '', type: CONTINUE},
    {match: 'yz', replacement: 'ys', type: STOP}
  ]
};
function lancasterStemmer(value) {
  return applyRules(String(value).toLowerCase(), true);
}
function applyRules(value, isIntact) {
  var ruleset = rules[value.charAt(value.length - 1)];
  var breakpoint;
  var index;
  var length;
  var rule;
  var next;
  if (!ruleset) {
    return value;
  }
  index = -1;
  length = ruleset.length;
  while (++index < length) {
    rule = ruleset[index];
    if (!isIntact && rule.type === INTACT) {
      continue;
    }
    breakpoint = value.length - rule.match.length;
    if (breakpoint < 0 || value.substr(breakpoint) !== rule.match) {
      continue;
    }
    if (rule.type === PROTECT) {
      return value;
    }
    next = value.substr(0, breakpoint) + rule.replacement;
    if (!acceptable(next)) {
      continue;
    }
    if (rule.type === CONTINUE) {
      return applyRules(next, false);
    }
    return next;
  }
  return value;
}
/* Detect if a value is acceptable to return, or should
 * be stemmed further. */
function acceptable(value) {
  return VOWELS.test(value.charAt(0)) ?
    value.length > 1 : value.length > 2 && VOWELS.test(value);
}

var NeuralMatcher = {
    words: [],
    documents: [],
    classes: [],
    ignore_words: ["!",":",";","?",",",".","x"],
    punctuation: ["!",":",";","?",",","."],
    stemmer: lancasterStemmer,
    cutoffOutput: 0.3,

    preprocessData: function(data) {
        NeuralMatcher.words = [];
        NeuralMatcher.classes = [];
        NeuralMatcher.documents = [];
        for (var i=0; i<data.length; i++) { //preprocessing
            NeuralMatcher.documents.push([data[i].sentence, data[i].class]);//don't want split sentence since it is done in postprocessing
            var sentence = data[i].sentence.split(" ");

            for (var j=0; j<sentence.length; j++) { //tokenization
                for (var b=0; b<NeuralMatcher.punctuation.length; b++) {
                    if (sentence[j].substring(0,1) == NeuralMatcher.punctuation[b]) {
                        sentence[j] = sentence[j].substring(1,sentence[j].length); //splice out punctuation
                    } else if (sentence[j].substring(sentence[j].length-1, sentence[j].length) == NeuralMatcher.punctuation[b]) {
                        sentence[j] = sentence[j].substring(0,sentence[j].length-1);
                    }
                }
                NeuralMatcher.words.push(sentence[j]);
            }

            if (NeuralMatcher.classes.indexOf(data[i].class) == -1) {
                NeuralMatcher.classes.push(data[i].class);
            }

        }

        var trueWords = [];
        for (var i=0; i<NeuralMatcher.words.length; i++) {
            if (NeuralMatcher.ignore_words.indexOf(NeuralMatcher.words[i]) == -1) {
                trueWords.push(NeuralMatcher.stemmer(NeuralMatcher.words[i].toLowerCase())); //stem it
            } else {
                //console.log("word "+NeuralMatcher.words[i]+" found in ignore_words dict")
                //NeuralMatcher.words.splice(NeuralMatcher.ignore_words.indexOf(NeuralMatcher.words[i]), 1);
            }
        }
        NeuralMatcher.words = trueWords;

        NeuralMatcher.words = NeuralMatcher.words.filter(function (value, index, self) { //uniqueify
            return self.indexOf(value) === index;
        });

        console.log(NeuralMatcher.words.length+" unique stemmed words after preprocessing")//+JSON.stringify(NeuralMatcher.words))
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

    /*generateSplicedXData: function(sentence) {

        var training_data = []; //generate that training data!

        for (var i=0; i<NeuralMatcher.documents.length; i++) {
            if (NeuralMatcher.documents[i][0].indexOf("x") !== -1) {
                console.log("not neg 1\n"+NeuralMatcher.documents[i][0]);
                var bag = NeuralMatcher.bagOfWords(NeuralMatcher.documents[i][0], NeuralMatcher.words);
                var sentence = NeuralMatcher.documents[i][0].split(" ");
                var xPos = [];
                var subnet = [];
                for (var j=0; j<sentence.length; j++) {
                    if (sentence[j] == "x") {
                        xPos.push(j);
                        subnet.push(1);
                    } else {
                        subnet.push(0);
                    }
                }
                console.log(sentence, subnet)
                var output = [];
                for (var j=0; j<NeuralMatcher.classes.length; j++) {
                    output.push(0);
                }
                var classIndex = NeuralMatcher.classes.indexOf(NeuralMatcher.documents[i][1]);
                if (classIndex == -1) {
                    console.error("ClassIndex is -1, training error");
                } else {
                    output[classIndex] = 1;
                    training_data.push({"input": {subnet: subnet, sentence: bag}, "output": output})
                }
            }
        }

        return training_data;
    },*/

    matchSentenceInClass: function(sentence, senClass, dataset) { //less accurate than neuralnet, but does match commands within classes
        var sentencesInClass = [];
        var tokenizedSenInClass = [];
        var scores = [];
        var splitSentence = NeuralMatcher.tokenizeSentence(sentence);
        for (var i=0; i<dataset.length; i++) {
            if (dataset[i].class == senClass) {
                sentencesInClass.push(dataset[i].sentence);
            }
        }
        if (sentencesInClass.length == 0) {
            console.error("Couldn't find sentences with class name "+senClass+" in dataset")
        } else {
            console.log("sentences in class "+senClass+" are "+JSON.stringify(sentencesInClass));
            for (var i=0; i<sentencesInClass.length; i++) {
                sentencesInClass[i] = NeuralMatcher.stemSentence(NeuralMatcher.depunctuateSentence(sentencesInClass[i]));
                tokenizedSenInClass.push(NeuralMatcher.tokenizeSentence(sentencesInClass[i]));
                scores.push(0);
            }
            for (var i=0; i<splitSentence.length; i++) {
                for (var j=0; j<sentencesInClass.length; j++) {
                    console.log("sen j "+sentencesInClass[j]+", splitseni "+splitSentence[i])
                    if (sentencesInClass[j].indexOf(splitSentence[i]) > -1) {
                        scores[j]+=1;
                        console.log("+1")
                    }
                }
            }
            var max = Math.max.apply(null,scores);
            var indices = [];
            for(var i=0; i<scores.length; i++) {
                if (scores[i] == max) {
                    indices.push(i);
                }
            }
            for (var i=0; i<tokenizedSenInClass.length; i++) {
                if (tokenizedSenInClass[i] == "x") {
                    console.log("x found")
                }
            }
        }
        return [scores,indices];
    },

    trainNet: function(net, targetError, trainingData, callback) {
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

    classify: function(net, sentence) {
        return NeuralMatcher.getOutput(net, sentence)[2];
    }
}

exports.algorithm = NeuralMatcher;
exports.stemmer = lancasterStemmer;
