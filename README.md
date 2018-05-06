# CarOS
This repo holds the scripts behind my future car computer, CarOS. I am planning to build a computer inside of my car, and run this program on it, which will let me interface with the CAN bus eventually. This project is basically a frontend/backend nodejs server, which can do facial recognition to recognize me, play music, listen to voice commands, and more.
## Installation - Command Line
So far, the best way to install this is via command line. There is prebuilt setup scripts and installation scripts to install the code. Run this code:
```
echo "Downloading installer..."; sudo rm ~/installer.sh && echo "Deleted previous installer version" || echo "No previous installer file found"; sudo curl -o ~/installer.sh https://raw.githubusercontent.com/aaroexxt/CarOS/master/installer.sh; echo "Running installer..."; sudo bash ~/installer.sh; echo "Deleting installer file..."; sudo rm ~/installer.sh;
```
