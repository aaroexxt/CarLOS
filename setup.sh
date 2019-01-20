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
    sudo apt-get install -y gcc g++ make cmake;
    echo "Installing python and pip (linux)...";
    sudo apt-get install -y python python3 python-pip python3-pip;
    echo "Installing libasound for speaker (linux)...";
    sudo apt-get install -y libasound2-dev;
    sudo apt-get install -y libalut-dev;
    sudo apt-get install -y libopenal1;
    sudo apt-get install -y libx11-dev
    sudo apt-get install -y libpng-dev;
    sudo apt-get install -y libopenblas-dev;
    echo "Installing I2C utils...";
    sudo apt-get install -y python-imaging python-smbus i2c-tools
    echo "Starting vnc..."
    sudo apt-get update;
    sudo apt-get install -y avahi-daemon netatalk
    sudo apt-get install -y realvnc-vnc-server realvnc-vnc-viewer;
    sudo systemctl enable vncserver-x11-serviced.service && sudo systemctl start vncserver-x11-serviced.service || echo "VNC couldn't be started"
    #echo "Installing libpostal...";
    #sudo apt-get install -y curl autoconf automake libtool pkg-config;
    #sudo apt-get install -y build-essential;
elif [ "$platform" = "mac" ]; then
    echo "running xcode-select";
    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer || (echo "Make sure XCode is installed; error running XCode setup" && exit 1);
    echo "Installing node (mac)...";
    brew install node
    echo "Fixing npm install issues";
    sudo chmod -R 777 ~/.npm
    echo "Installing python and pip (mac)...";
    brew install https://raw.githubusercontent.com/Homebrew/homebrew-core/f2a764ef944b1080be64bd88dca9a1d80130c558/Formula/python.rb;
    brew install python;
    sudo easy_install pip;
    brew remove portaudio;
    brew install portaudio;
    brew install curl autoconf automake libtool pkg-config;

fi
#echo "Installing libPostal";
#git clone https://github.com/openvenues/libpostal
#cd libpostal
#./bootstrap.sh
#./configure --datadir $(pwd)
#make
#sudo make install;

# On Linux it's probably a good idea to run
sudo ldconfig;

echo "Updating node and npm to correct versions...";
sudo npm cache clean -f #update node
sudo npm install -g n
#sudo n 8.9.3
sudo n 10.15.0
#sudo npm install npm@5.5.1 -g #update npm
sudo npm install npm@latest -g

echo "Installing packages...";
sudo npm i -g npm@latest;

echo "Installing node-gyp";
sudo npm install -g node-gyp;
#cd ~;
echo "Installing mocha&chai";
sudo npm install --unsafe-perm=true --allow-root --save-dev chai mocha
sudo npm install --unsafe-perm=true --allow-root --save-dev --global mocha
echo "Installing all important packages from npm";
sudo npm install --unsafe-perm=true --allow-root --save-prod git://github.com/Kolky/nodetunes.git#master
sudo npm install --unsafe-perm=true --allow-root --save-prod multer is-root segfault-handler errorhandler opencv4nodejs node-json-db express-session session-file-store passport passport-local passport-custom bcrypt brain.js strip-color strip-ansi window-size single-line-log node-fetch finalhandler express serve-favicon lame pcm-volume mp3-duration path progress-stream remote-file-size colors timed-stream native-watchdog toobusy-js geojson-vt @mapbox/mbtiles big-json deepspeech mic sox-stream memory-stream cors;
#sudo npm install --unsafe-perm=true --allow-root --save-prod electron@2.0.12
#sudo npm install --unsafe-perm=true --allow-root --save-dev electron-rebuild
sudo npm install --unsafe-perm=true --allow-root --build-from-source --save-prod serialport;
sudo npm install --unsafe-perm=true --allow-root --save-prod nodemon;

if [ "$platform" = "mac" ]; then
    sudo npm install --mpg123-backend=openal --unsafe-perm=true --allow-root --save-prod speaker;
elif [ "$platform" = "linux"]; then
    sudo npm install --unsafe-perm=true --allow-root --save-prod speaker;
    sudo npm install --unsafe-perm=true --allow-root --save-prod rpi-oled oled-font-5x7;
fi
echo "Done installing packages.";

#rebuild electron
#echo "Rebuilding modules for electron...";
#sudo ./node_modules/.bin/electron-rebuild -v 2.0.12 -p -t "dev,prod,optional"
# NO DONT USE THIS sudo npm rebuild --unsafe-perm=true --allow-root --runtime=electron --target=3.0.4 --disturl=https://atom.io/download/atom-shell --build-from-source

echo "Changing permissions on downloaded folder";
sudo chmod 777 -R $cwd;
sudo chmod 777 -R node_modules || echo "Couldn't chg permissions on node modules";
echo "Patching nodeutils...";
sudo mv nodeutils.js nodeUtils.js || echo "Couldn't move nodeUtils; is in the right location?";
#echo "Auditing npm modules...";
#sudo npm audit fix;


echo "Done :)";
echo "Run 'sudo bash $cwd/start.sh' to start the sever";
exit;

#sudo pip3 install numpy;
#sudo pip3 install socketIO-client;
#below code attempts to build opencv from source
'if [ "$platform" = "mac" ]; then
    echo "Installing opencv with pip";
    sudo pip3 uninstall opencv-python;
elif [ "$platform" = "linux" ]; then
    echo "Building OpenCV from source.";
    echo "Downloading OpenCV files";
    sudo apt-get install -y build-essential cmake pkg-config libjpeg-dev libtiff5-dev libjasper-dev libpng12-dev libavcodec-dev libavformat-dev libswscale-dev libv4l-dev libxvidcore-dev libx264-dev libgtk2.0-dev libgtk-3-dev libatlas-base-dev gfortran python2.7-dev python3-dev cmake;
    cd ~
    sudo wget -O opencv.zip https://github.com/Itseez/opencv/archive/3.3.0.zip
    sudo unzip opencv.zip
    sudo wget -O opencv_contrib.zip https://github.com/Itseez/opencv_contrib/archive/3.3.0.zip
    sudo unzip opencv_contrib.zip
    cd ~/opencv-3.3.0/
    sudo mkdir build
    cd build
    echo "Setting up build";
    sudo cmake -D CMAKE_BUILD_TYPE=RELEASE \
        -D CMAKE_INSTALL_PREFIX=/usr/local \
        -D INSTALL_PYTHON_EXAMPLES=ON \
        -D OPENCV_EXTRA_MODULES_PATH=~/opencv_contrib-3.3.0/modules \
        -D BUILD_EXAMPLES=ON ..

    echo "Changing swap memory size...";
    sudo sed -i -e 's/100/1024/g' /etc/dphys-swapfile
    sudo /etc/init.d/dphys-swapfile stop
    sudo /etc/init.d/dphys-swapfile start

    echo "Compiling opencv. This can take > 1 hour.";
    sudo make -j4

    echo "Installing compiled build.";
    sudo make install
    sudo ldconfig

    echo "Renaming opencv python compiled file so it is usable...";
    cd /usr/local/lib/python3.5/site-packages/
    sudo mv cv2.cpython-35m-arm-linux-gnueabihf.so cv2.so

    echo "Changing swap memory size back to defaults...";
    sudo sed -i -e 's/1024/100/g' /etc/dphys-swapfile
    sudo /etc/init.d/dphys-swapfile stop
    sudo /etc/init.d/dphys-swapfile start
fi'
#sudo pip3 install tensorflow;
#echo "If tensorflow module not found error occurs, delete the python and python3 folders in /usr/local/Cellar and reinstall python and python3 with 'brew install python python3'";
#sudo python3 -m pip install opencv-contrib-python==3.3.0.9; #why do you not work unless i do this???
#sudo python3 -m pip install pyaudio;
#if this doesn't work, https://stackoverflow.com/questions/44363066/error-cannot-find-module-lib-utils-unsupported-js-while-using-ionic
#sudo rm -R /usr/local/lib/node_modules/npm; brew uninstall --force --ignore-dependencies node; brew install node;
#VNC STUFF BELOW
