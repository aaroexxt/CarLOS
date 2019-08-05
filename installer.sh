#!/bin/bash
#To download this file from github, type:
#wget https://raw.githubusercontent.com/aaroexxt/CarOS/master/installer.sh
#sudo bash ./installer.sh
clear;
echo "~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-";
echo "Welcome to the CarOS automated installer script V6, by Aaron Becker.";
echo "This script will install all other scripts and packages necessary to run CarOS in full.";
echo "~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-";

abort()
{
    echo >&2 '
***************
*** ABORTED ***
***************
'
    echo "An error occurred :( Exiting..." >&2
    exit 1;

}

MAXSCRIPTTIME=86400;

set -e -u;

if [[ $(id -u) -ne 0 ]]
  then echo "Sorry, but it appears that you didn't run this script as root. Please run it as a root user!";
  exit 1;
fi
trap 'abort' 0;

platform='unknown'
unamestr=`uname`
if [[ "$unamestr" == 'Linux' ]]; then
   platform='linux'
elif [[ "$unamestr" == 'Darwin' ]]; then
   platform='mac'
fi

START=$(date +%s);
installall="false";
dir="";
hdirallow="true";
defaultdir="/home/pi/Desktop/"
while true; do
    echo ""; read -r -p "What directory do you want the installer files to be located in? (Defaults to $defaultdir if nothing entered): " ans;
    if [ "$ans" = "" ] || [ "$ans" = " " ]; then
        if [ "$hdirallow" = "true" ]; then
            echo "Default directory selected. Testing default directory (just in case)...";
            if [ -d "$defaultdir" ]; then
                echo "Directory $defaultdir is valid.";
                dir="$defaultdir";
                break;
            else
                echo "The default directory ($defaultdir) is not a valid directory. Please enter a valid directory.";
                hdirallow="false";
            fi
        else
            echo "The default directory is not valid. Please enter a valid directory.";
        fi
    else
        echo "Testing directory: $ans...";
        if [ -d "$ans" ]; then
            echo "Directory '$ans' does exist!"; 
            dir=$ans;
            break;
        else
            echo "Directory '$ans' invalid. Please try again.";
        fi
    fi
done
dir=${dir%/}; #remove trailing slash
echo "Step 1/4: Installing required packages...";
if [ "$platform" = "linux" ]; then
    sudo apt-get install -y git;
fi
#old package cmd which doesn't exist;
echo "Packages installed successfully.";
echo "Step 2/4: Downloading Installer files...";
cd "$dir";
if ! [ -d "CarOS" ]; then
    echo "CarOS directory doesn't exist. Downloading fresh...";
    sudo git clone https://github.com/aaroexxt/CarOS.git;
else
    while true; do
        read -r -p "CarOS directory already exists. Would you like to replace it with a new copy? " ans;
        case $ans in
            [Yy]* ) echo "Downloading new copy..."; sudo rm -r "CarOS"; sudo git clone https://github.com/aaroexxt/CarOS.git; break;;
            [Nn]* ) echo "Not downloading new copy. This may cause issues if there is scripts that you don't want run in the folder.";  break;;
            * ) echo "Please answer yes or no (or just y or n).";;
        esac
    done
fi
echo "CarOS files downloaded successfully.";
echo "Step 3/4: CD-ing into new CarOS directory"
cd "$dir/CarOS";
echo "Step 4/4: Running setup file from directory $dir";
sudo bash setup.sh;
echo "~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-";
echo "CarOS is now installed on your machine. If you would like to start it, CD into $dir and run sudo bash start.sh";
END=$(date +%s);
echo -n "Time: ";
echo $((END-START)) | awk '{print int($1/3600)"h:"int($1/60)"m:"int($1%60)"s"}';
echo "~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-";
trap : 0