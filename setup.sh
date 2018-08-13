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
    echo "Installing libasound for speaker (linux)...";
    sudo apt-get install -y libasound2-dev;
    sudo apt-get install -y libalut-dev;
    sudo apt-get install -y libopenal1;
    echo "Installing I2C utils...";
    sudo apt-get install -y python-imaging python-smbus i2c-tools
    echo "Starting vnc..."
    sudo apt-get update;
    sudo apt-get install -y avahi-daemon netatalk
    sudo apt-get install -y realvnc-vnc-server realvnc-vnc-viewer;
    sudo systemctl enable vncserver-x11-serviced.service && sudo systemctl start vncserver-x11-serviced.service || echo "VNC couldn't be started"
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
sudo npm i -g npm@latest;
sudo npm install --unsafe-perm=true --allow-root --prefix $cwd brain.js window-size single-line-log node-fetch finalhandler express serve-favicon lame pcm-volume mp3-duration path progress-stream remote-file-size colors timed-stream native-watchdog rpi-oled oled-font-5x7;
sudo npm install --unsafe-perm=true --allow-root --build-from-source --prefix $cwd serialport;
if ["$platform" = "mac"]; then
    sudo npm install --mpg123-backend=openal --unsafe-perm=true --allow-root --prefix $cwd speaker;
elif [ "$platform" = "linux"]; then
    sudo npm install --unsafe-perm=true --allow-root --prefix $cwd speaker;
fi
sudo npm install -g --unsafe-perm=true --allow-root --build-from-source serialport; # for comand line tools
sudo npm install --unsafe-perm=true --allow-root --prefix $cwd socket.io@1.7.2;
sudo npm install -g --unsafe-perm=true --allow-root rpi-oled; #for command line tools
sudo npm install -g --unsafe-perm=true --allow-root nodemon; #for command line tools
echo "Done installing packages.";
sudo npm audit fix;
sudo pip3 install numpy;
sudo pip3 install socketIO-client;
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
echo "Patching nodeutils...";
sudo mv nodeutils.js nodeUtils.js || echo "Couldn't move nodeUtils; is in the right location?";
#sudo pip3 install tensorflow;
echo "If tensorflow module not found error occurs, delete the python and python3 folders in /usr/local/Cellar and reinstall python and python3 with 'brew install python python3'";
sudo python3 -m pip install opencv-contrib-python==3.3.0.9; #why do you not work unless i do this???
#sudo python3 -m pip install pyaudio;
#if this doesn't work, https://stackoverflow.com/questions/44363066/error-cannot-find-module-lib-utils-unsupported-js-while-using-ionic
#sudo rm -R /usr/local/lib/node_modules/npm; brew uninstall --force --ignore-dependencies node; brew install node;
echo "Done :)";
echo "Run 'sudo bash $cwd/start.sh' to start the sever";
exit;
#VNC STUFF BELOW