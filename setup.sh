#!/bin/bash
echo "NODEJS CarOS Setup"
echo "------------------"
cwd=$(pwd)
echo "CWD: $cwd"
echo "Identifying platform...";
platform='unknown'
unamestr=`uname`
if [[ "$unamestr" == 'Linux' ]]; then
   platform='linux'
elif [[ "$unamestr" == 'Darwin' ]]; then
   platform='mac'
fi
echo "Platform: $platform, unamestr $unamestr";

echo "Making directories...";
mkdir -p $cwd/node_modules;
if [ "$platform" = "linux" ]; then
    echo "Installing node (linux)...";
    curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
    sudo apt-get install -y nodejs;
    sudo apt-get install -y gcc g++ make;
    echo "Installing python and pip (linux)...";
    sudo apt-get install -y python python3 python-pip python3-pip;
elif [ "$platform" = "mac" ]; then
    echo "Installing node (mac)...";
    brew install node
    echo "Installing python and pip (mac)...";
    brew install python python3;
    sudo easy_install pip;
    brew remove portaudio;
    brew install portaudio;
fi
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
echo "Done :)";
echo "Run 'sudo bash $cwd/start.sh' to start the sever"
exit;