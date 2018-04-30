#!/bin/bash
echo "Making directories...";
mkdir -p ~/Desktop/Code/nodejs/node_modules;
echo "Installing packages...";
sudo npm install --prefix ~/Desktop/Code/nodejs/ request browserify watchify async formidable debug child-process brain.js opn window-size single-line-log;
sudo npm install --prefix ~/Desktop/Code/nodejs/ socket.io@1.7.2;
sudo npm install -g nodemon;
sudo pip3 install numpy;
sudo pip3 install socketIO-client;
sudo pip3 uninstall opencv-python;
sudo python3 -m pip install opencv-contrib-python==3.3.0.9; #why do you not work unless i do this???
brew remove portaudio;
brew install portaudio;
sudo python3 -m pip install pyaudio;
#if this doesn't work, https://stackoverflow.com/questions/44363066/error-cannot-find-module-lib-utils-unsupported-js-while-using-ionic
#sudo rm -R /usr/local/lib/node_modules/npm; brew uninstall --force --ignore-dependencies node; brew install node;
echo "Done";
exit;