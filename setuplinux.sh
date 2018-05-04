#!/bin/bash
cwd=$(pwd)
echo "CWD: $cwd"
echo "Making directories...";
mkdir -p ~/Desktop/Code/nodejs/node_modules;
echo "Installing python and pip...";
sudo apt-get install -y python python3 python-pip python3-pip;
echo "Installing node...";
sudo apt-get install -y nodejs npm;
sudo ln -s /usr/bin/nodejs /usr/bin/node;
echo "Installing packages...";
sudo npm install --prefix $cwd request browserify watchify async formidable debug child-process brain.js opn window-size single-line-log;
sudo npm install --prefix $cwd socket.io@1.7.2;
sudo npm install -g nodemon;
sudo pip3 install numpy;
sudo pip3 install socketIO-client;
sudo pip3 uninstall opencv-python;
sudo python3 -m pip install opencv-contrib-python==3.3.0.9; #why do you not work unless i do this???
sudo python3 -m pip install pyaudio;
#if this doesn't work, https://stackoverflow.com/questions/44363066/error-cannot-find-module-lib-utils-unsupported-js-while-using-ionic
#sudo rm -R /usr/local/lib/node_modules/npm; brew uninstall --force --ignore-dependencies node; brew install node;
echo "Done";
exit;