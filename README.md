# CarOS
Node.JS version of a computer for your car. Designed to run on Raspberry Pi, but has been tested on Mac OSX 10.13.6

## Installing

There are two main ways to install, via command line or via github.

### Installation - Command Line
So far, the best way to install this is via command line. There is prebuilt setup scripts and installation scripts to install the code and nodejs packages. Run this code:
```
echo "Downloading installer..."; sudo rm ~/installer.sh && echo "Deleted previous installer version" || echo "No previous installer file found"; sudo curl -o ~/installer.sh https://raw.githubusercontent.com/aaroexxt/CarOS/master/installer.sh; echo "Running installer..."; sudo bash ~/installer.sh; echo "Deleting installer file..."; sudo rm ~/installer.sh;
```

### Installation - Less Command Line
If you don't want to install via the command line, you can download the zip from Github. After unzipping, run setup.sh, which will setup everything you need to run the server.

## Getting Started
- Once the server and packages are installed, simply cd into root directory and run ```npm start```
- Go to http://localhost:80/client
- Connect an Arduino with I2C devices to add more functionality to the server. Arduino code is in /index/arduino.
Note \- do not start the server file COSserver.js manually with ```node COSserver.js```. If you want to start the server manually, run the shell script start.sh in the root directory (takes a list of arguments that are in the file). The reason for this is that the server needs some arguments that this script provides.

## Main server file
COSserver.js
Do not start this manually, refer to note in getting started section.

## Routing

/client/ for main html view
/console/ BETA - console view
all other requests will 404 if they do not resolve to a static directory

