#!/bin/bash


#USAGE: sudo bash /path/to/raspianForCARLOS.sh /dev/disk2s2 <- this is your disk to erase
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

if [[ $(id -u) -ne 0 ]]
  then echo "Sorry, but it appears that you did not run this script as root, please run as root or admin";
  exit 1;
fi

#auto script for this awesome tutorial at https://tilemill-project.github.io/tilemill/docs/guides/osm-bright-mac-quickstart/

echo "raspi-autoConfig by Aaron Becker";
echo "Will setup a basic raspberry pi install";
echo "-----------------------------"

echo "do you want to install to disk $1 if not press ctrl+z now";
echo "$1 MUST be the disk number. if your disk is /dev/disk2, you must enter 2."
read

echo "Downloading raspian";
sudo curl -o raspbian.zip -L -J https://downloads.raspberrypi.org/raspbian_full_latest #download latest raspian zip
sudo unzip -p raspbian.zip > raspbian.img; #unzip and move to image
clear;
diskutil list || (echo "diskutil not supported :(. can't finish install" && exit 1);
echo "erasing disk $1. ARE YOU SURE";
read

diskutil eraseDisk FAT32 RASPBIAN /dev/disk$1 || exit 1;
echo "unmounting";
diskutil unmountDisk /dev/disk$1 || exit 1;
echo "copying data";
echo "GOING TO TAKE A WHILE. IT IS DOING SOMETHING EVEN IF IT DOESN'T LOOK LIKE IT";
sudo dd bs=1m if=raspbian.img of=/dev/rdisk$1 conv=sync
echo "removing unneeded files";
sudo rm -f raspbian.zip raspbian.img;
echo "enabling ssh";
cd /Volumes/boot;
sudo touch ssh
sudo touch wpa_supplicant.conf;
echo 'network={' >> wpa_supplicant.conf;
echo '	ssid="BPWireless1"' >> wpa_supplicant.conf;
echo '	psk=a9353d2e6556fdf61ee8ffe1af7ad8b5de0875fa03defe4155f28f0570ae91c8' >> wpa_supplicant.conf;
echo '}' >> wpa_supplicant.conf;
echo "done";
exit 0;





