/*
* deepspeechWrapper.js by Aaron Becker
* Manages real-time speech recognition for CarOS using Mozilla's DeepSpeech recognition engine
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*
* I know that I could have made a stab at implementing this myself, but oh well lol
*/

const Fs = require('fs');
const mic = require('mic');
const Sox = require('sox-stream');
const Ds = require('deepspeech');
const path = require('path');
const argparse = require('argparse');
const MemoryStream = require('memory-stream');

function totalTime(hrtimeValue) {
	return (hrtimeValue[0] + hrtimeValue[1] / 1000000000).toPrecision(4);
}

const deepspeechWrapper = {
	debugMode: false,
	model: {},
	audio_max_sample_length: 30000, //time (in ms) to sample audio from the microphone
	neuralConstants: {
		// These constants control the beam search decoder

		// Beam width used in the CTC decoder when building candidate transcriptions
		beam_width: 500,
		// The alpha hyperparameter of the CTC decoder. Language Model weight
		lm_weight: 1.50,
		// Valid word insertion weight. This is used to lessen the word insertion penalty
		// when the inserted word is part of the vocabulary
		valid_word_count_weight: 2.10,
		// These constants are tied to the shape of the graph used (changing them changes
		// the geometry of the first layer), so make sure you use the same constants that
		// were used during training

		// Number of MFCC features to use
		n_features: 26,

		// Size of the context window used for producing timesteps in the input vector
		n_context: 9

	},

	init: (neuralSettings) => {
		return new Promise( (resolve, reject) => {
			if (deepspeechWrapper.debugMode) {
				console.log("Initializing deepspeech; versions");
				Ds.printVersions();
			}

			if (!neuralSettings) {
				return reject("neuralSettings undefined in recognition network init");
			}
			let nsR = neuralSettings.recognition;
			if (!nsR || !nsR.triePath || !nsR.dataBasePath || !nsR.LMpath || !nsR.modelPath || !nsR.alphabetPath) {
				return reject("neuralSettings is missing an essential setting for network init");
			}
			let bp = nsR.dataBasePath;

			let triePath = path.join(bp, nsR.triePath);
			let LMpath = path.join(bp, nsR.LMpath);
			let modelPath = path.join(bp, nsR.modelPath);
			let alphabetPath = path.join(bp, nsR.alphabetPath);
			if (deepspeechWrapper.debugMode) {
				console.log("model pathing: alphabet@%s, model@%s, LM@%s trie@%s", alphabetPath, modelPath, LMpath, triePath);
			}

			//load model
			if (deepspeechWrapper.debugMode) {
				console.log('Loading model from file %s', nsR.modelPath);
			}
			const model_load_start = process.hrtime();
			var model = new Ds.Model(modelPath, deepspeechWrapper.neuralConstants.n_features, deepspeechWrapper.neuralConstants.n_context, alphabetPath, deepspeechWrapper.neuralConstants.beam_width);
			const model_load_end = process.hrtime(model_load_start);
			console.log('Loaded model in %ds.', totalTime(model_load_end));

			if (deepspeechWrapper.debugMode) {
				console.log('Loading language model from files %s %s', LMpath, triePath);
			}
			const lm_load_start = process.hrtime();
			model.enableDecoderWithLM(alphabetPath, LMpath, triePath, deepspeechWrapper.neuralConstants.lm_weight, deepspeechWrapper.neuralConstants.valid_word_count_weight);
			const lm_load_end = process.hrtime(lm_load_start);
			console.log('Loaded language model in %ds.', totalTime(lm_load_end));

			deepspeechWrapper.model = model; //set var

			var micInstance = mic({
					sampleRate: 16000,
					channels: 1,
					debug: deepspeechWrapper.debugMode,
					fileType: "wav",
					bits: 16,
					encoding: 'signed-integer',
					endian: 'little',
					compression: 0.0,
					exitOnSilence: 6
			});
			var micInputStream = micInstance.getAudioStream();
			
			deepspeechWrapper.micInstance = micInstance;
			deepspeechWrapper.micInputStream = micInputStream;

			return resolve(); //resolve
		})
	},

	runInference: audioBuffer => {
		return new Promise( (resolve, reject) => {
			try {
				if (deepspeechWrapper.debugMode) {
					console.log('Running inference.');
				}
				const audioLength = (audioBuffer.length / 2) * ( 1 / 16000); //in seconds

				// We take half of the buffer_size because buffer is a char* while
				// LocalDsSTT() expected a short*
				const inference_start = process.hrtime();
				let inference = String(deepspeechWrapper.model.stt(audioBuffer.slice(0, audioBuffer.length / 2), 16000));
				const inference_stop = process.hrtime(inference_start);
				if (deepspeechWrapper.debugMode) {
					console.log('Inference took %ds for %ds audio file.', totalTime(inference_stop), audioLength.toPrecision(4));
				}

				return resolve(inference);
			} catch (e) {
				return reject(e);
			}
		})
	},

	takeAudioSample: ms => {
		if (!ms) {
			ms = deepspeechWrapper.audio_max_sample_length;
		}

		return new Promise( (resolve, reject) => {
			var audioStream = new MemoryStream(); //memory stream of audio coming in from microphone

			var transform = Sox({ //transform stream to make data conistent in terms of formatting
				global: {
					'no-dither': true,
				},
				output: {
					bits: 16,
					rate: 16000,
					channels: 1,
					encoding: 'signed-integer',
					endian: 'little',
					compression: 0.0,
					type: 'raw'
				}
			});

			deepspeechWrapper.micInputStream.pipe(transform).pipe(audioStream); //pipe mic through transform stream and then to audio stream

			deepspeechWrapper.micInstance.start(); //start recording

			setTimeout( () => {
				deepspeechWrapper.micInstance.stop();
			},ms);
			if (deepspeechWrapper.debugMode) {
				console.log("stopping recording in %dms", ms);
			}

			audioStream.on('finish', () => {
				if (deepspeechWrapper.debugMode) {
					console.log("Recording audio sample finished; resolving");
				}

				deepspeechWrapper.micInputStream.unpipe(transform);
				//transform.unpipe(audioStream);

				audioBuffer = audioStream.toBuffer();
				return resolve(audioBuffer);
			});
			
		})
	},

	loadAudioFile: fileName => {
		return new Promise( (resolve, reject) => {
			if (!fileName) {
				return reject("FileName not defined");
			}

			try {
				const buffer = Fs.readFileSync(fileName);
			} catch(e) {
				return reject("Error reading audio file: "+e);
			}

			function bufferToStream(buffer) {
			  var stream = new Duplex();
			  stream.push(buffer);
			  stream.push(null);
			  return stream;
			}

			var audioStream = new MemoryStream();
			bufferToStream(buffer).
			  pipe(Sox({
			    global: {
			      'no-dither': true,
			    },
			    output: {
			      bits: 16,
			      rate: 16000,
			      channels: 1,
			      encoding: 'signed-integer',
			      endian: 'little',
			      compression: 0.0,
			      type: 'raw'
			    }
			  })).
			  pipe(audioStream);

			audioStream.on('finish', () => {
  				audioBuffer = audioStream.toBuffer();
  				return resolve(audioBuffer);
  			});
		})
	}
}

module.exports = deepspeechWrapper;
