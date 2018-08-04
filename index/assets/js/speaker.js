//modified from blabla.js
//^basically blabla without listener functionality and changed name, with slight modification in the setVocies fucntion
//credit to: https://github.com/jillesme/Speech/blob/master/blabla.js

var Speech = (function () {
  'use strict';

  var Speech = {};
  var _settings = {
    default: {},
    speaker: {},
  };
  var recognizer;

  // Check for support
  Speech.isSupported = (function () {
    return (
      'speechSynthesis' in window &&
        'webkitSpeechRecognition' in window);
  })();

  Speech.voices = [];
  // Set the voices (voices are loaded async!!)
  speechSynthesis.addEventListener('voiceschanged', function () {
    Speech.voices = speechSynthesis.getVoices();
    // Call voicesLoaded if loaded
    if (_settings.default.voicesLoaded) _settings.default.voicesLoaded();
    Speech.voicesLoaded();
  });

  Speech.voicesLoaded = function(){};

  Speech.listVoices = function () {
    return Speech.voices.map(function (voice) {
      var voiceObj = {
        name: voice.name,
        lang: voice.lang
      };
      return voiceObj;
    });
  };

  Speech.setVoice = function (name) {
    var search = Speech.voices.filter(function (voice) {
      if (voice.name === name) {
        return voice;
      }
    });

    if (!search.length) {
      console.error('Not a valid voice \'' + name + ('\', use Speech.listVoices to get the available voices'));
      return undefined;
    }
    _settings.voice = search[0];
  };

  Speech.speak = function (sentence,callback) {

    // Create a speech utterance object, this takes a string as argument.
    var utterance = new SpeechSynthesisUtterance(sentence);

    // Change voice if needed
    if (_settings.voice) {
      utterance.voice = _settings.voice;
    }

    // Any registered 'on(...) handlers?
    for (var event in _settings.speaker) {
      // Set callbacks
      utterance['on' + event] = _settings.speaker[event];
    }
    utterance.onend = callback;

    // Speak text out loud.
    speechSynthesis.speak(utterance);
  };

  // Event listeners
  Speech.on = function (ev, cb) {
    _settings.default[ev] = cb;
  };
  Speech.speaker = {
    on: function (ev, cb) {
      _settings.speaker[ev] = cb;
    }
  };

  return Speech;
})();