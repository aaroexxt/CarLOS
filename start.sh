#!/bin/bash
sudo /usr/local/bin/node "$@"

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

#set -e -u;

if [[ $(id -u) -ne 0 ]]
  then echo "Sorry, but it appears that you didn't run this script as root. Please run it as a root user!";
  exit 1;
fi
#trap 'abort' 0;

#programsettings (hardcoded)
pythonCompatibilityMode="false"; #sets whether to open or check for the python compatibility (older versions of server)

#program variables
openpage="false";
newscript="false";
newroot="false";
nodebackground="false";
usenodemon="false";
newpython="false";
debugval="";
launchpython="true"; #only works if pythoncompatibility mode is set to true

printtitle="true";
cwd=$(pwd)
defaultroot="$cwd/app";
defaultscript="$cwd/COSserver.js";
defaultpython="$cwd/pythonDevelopment/python/rpibackend.py";

port="80";

while getopts :corsbndpl option
do
    case "$option" in
    c)
         clear && printf '\e[3J'; echo "ANSS (Automatic Node Start Script), by Aaron Becker"; echo "---------------------------------------------------"; echo "-c option passed, clearing screen"; printtitle="false";
         ;;
    o)
         echo "-o option passed, opening the page"; openpage="true";
         ;;
    r)
         echo "-r option passed, prompting user for root"; newroot="true";
         ;;
    s)
         echo "-s option passed, prompting user for script"; newscript="true";
         ;;
    b)
         echo "-b option passed, running nodejs in the background"; nodebackground="true";
         ;;
    n)
         echo "-n option passed, using nodemon instead of regular node (must have nodemon installed)"; usenodemon="true";
         ;;
    d)
         echo "-d option passed, allowing debug values from packages in console"; debugval=*;
         ;;
    p)
         echo "-p option passed, prompting for new python script"; newpython="true";
         ;;
    l)
         echo "-l option passed, not launching python script"; launchpython="false";
         ;;
    *)
        echo "Hmm, an invalid option was received."
        echo ""
        ;;
        esac
done

if [[ "$printtitle" == "true" ]]; then
    echo "ANSS (Automatic Node Start Script), by Aaron Becker"; echo "---------------------------------------------------";
fi

echo "CWD: $cwd";

echo "Identifying platform...";
platform='unknown'
unamestr=`uname`
if [[ "$unamestr" == 'Linux' ]]; then
   platform='linux'
elif [[ "$unamestr" == 'Darwin' ]]; then
   platform='mac'
else
    echo "Unable to identify platform: '$unamestr' does not match 'linux' or 'mac'";
    exit 1;
fi
echo "Platform: $platform, unamestr $unamestr"

dir="";
hdirallow="true";
if [ "$newroot" = "true" ]; then
    while true; do
        echo ""; read -r -p "What directory do you want to have the root of the node server in? (Defaults to $defaultroot if nothing entered): " ans;
        if [ "$ans" = "" ] || [ "$ans" = " " ]; then
            if [ "$hdirallow" = "true" ]; then
                echo "Default directory selected. Testing default directory (just in case)...";
                if [ -d "$defaultroot" ]; then
                    echo "Directory $defaultroot is valid.";
                    dir="$defaultroot";
                    break;
                else
                    echo "The default directory ($defaultroot) is not a valid directory. Please enter a valid directory.";
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
else
    echo "Default directory selected. Testing default directory (just in case)...";
    if [ -d "$defaultroot" ]; then
        echo "Directory $defaultroot is valid.";
        dir="$defaultroot";
    else
        echo "The default directory ($defaultroot) is not a valid directory. Please enter a valid directory.";
        while true; do
            echo ""; read -r -p "What directory do you want to have the root of the node server in? (Defaults to $defaultroot if nothing entered): " ans;
            if [ "$ans" = "" ] || [ "$ans" = " " ]; then
                echo "Testing directory: $ans...";
                if [ -d "$ans" ]; then
                    echo "Directory '$ans' invalid. Please try again.";
                else
                    echo "Directory '$ans' does exist!"; 
                    dir=$ans;
                    break;
                fi
            fi
        done
    fi
fi
dir=${dir%/}; #remove trailing slash

echo "";

nodedir="";
nodeloc="";
cdloc="";
if [ "$newscript" = "true" ]; then
    while true; do
        echo ""; read -r -p "What node file would you like to use (enter path)? : " ans;
            echo "Testing file: $ans...";
            if [ ! -e "$ans" ]; then
                echo "File '$ans' invalid. Please try again.";
            else
                echo "File '$ans' does exist!";
                nodedir=$ans;
                break;
            fi
    done
else
    echo "Checking if default node file is valid ($defaultscript)...";
    if [ ! -e "$defaultscript" ]; then
        echo "File '$defaultscript' is invalid. Please enter a valid node file.";
        while true; do
            echo ""; read -r -p "What node file would you like to use? : " ans;
                echo "Testing file: $ans...";
                if [ ! -e "$ans" ]; then
                    echo "File '$ans' invalid. Please try again.";
                else
                    echo "File '$ans' does exist!";
                    nodedir=$ans;
                    break;
                fi
        done
    else
        echo "Node file '$defaultscript' exists. Proceeding...";
        nodedir="$defaultscript";
    fi
fi

if [ "$pythonCompatibilityMode" = "true" ]; then
    pythondir="";
    if [ "$launchpython" = "true" ]; then
        if [ "$newpython" = "true" ]; then
            while true; do
                echo ""; read -r -p "What python file would you like to use (enter path)? : " ans;
                    echo "Testing file: $ans...";
                    if [ ! -e "$ans" ]; then
                        echo "File '$ans' invalid. Please try again.";
                    else
                        echo "File '$ans' does exist!";
                        pythondir=$ans;
                        break;
                    fi
            done
        else
            echo "Checking if default python file is valid ($defaultpython)...";
            if [ ! -e "$defaultpython" ]; then
                echo "File '$defaultpython' is invalid. Please enter a valid python directory file.";
                while true; do
                    echo ""; read -r -p "What python file would you like to use (enter path)? : " ans;
                        echo "Testing file: $ans...";
                        if [ ! -e "$ans" ]; then
                            echo "File '$ans' invalid. Please try again.";
                        else
                            echo "File '$ans' does exist!";
                            pythondir=$ans;
                            break;
                        fi
                done
            else
                echo "Python file '$defaultpython' exists. Proceeding...";
                pythondir="$defaultpython";
            fi
        fi

        echo "";
        echo "Starting python script in a new window.";
        if [[ $platform == 'linux' ]]; then
           gnome-terminal -e "echo \"Starting python script in this window...\"; sudo python3 "$pythondir"; exit" || xterm -e "echo \"Starting python script in this window...\"; gksudo -m \"Please provide permission to run python\" python3 $pythondir;" || lxterminal --command="sudo python3 "$pythondir &
           # || echo "Error starting python script; run 'sudo python3 $pythondir' to start it.";
           #xterm -e "echo \"Starting python script in this window...\"; sudo python3 "$pythondir"; exit" || echo "Failed to start terminal...";
        elif [[ $platform == 'mac' ]]; then
            osascript -e 'tell application "Terminal"
                do script "echo \"Starting python script in this window...\"; echo -n -e \"\\033]0;BackendPython\\007\"; sudo python3 '$pythondir'; echo \"Exiting terminal...\"; exit;"
            end tell'
            #lower script closes window manually, upper one justs exits
            #do script "echo \"Starting python script in this window...\"; echo -n -e \"\\033]0;BackendPython\\007\"; sudo python3 '$pythondir'; echo \"Exiting terminal...\"; osascript -e \"tell application \\\"Terminal\\\" to close (every window whose name contains \\\"BackendPython\\\")\"; exit;"
        fi
    fi
else
    echo "Skipping python initialization; compatibility mode is turned off (enable in sourcecode)";
fi

#script that reads and prints dir from command, used below
: '
array=(`ls`)

len=${#array[*]}

i=0
while [ $i -lt $len ]; do
echo "$i: ${array[$i]}"
let i++
done
'


echo "";
echo "Finding arduino serial port...";

printSerial()
{
    echo "Serial device found!";
    foundDevice="true"
    maxArrValue=`expr $len - 1`;
    if [[ $len == 1 ]]; then
        device=${array[0]}
    else
        echo; echo "There are multiple devices found. Please choose one, or type e to exit if none of these are the target device."
        echo "Devices:"
        i=0
        while [ $i -lt $len ]; do
            echo "$i: ${array[$i]}"
            let i++
        done
        while true; do
            echo ""; read -r -p "Select a device by entering its number (or e to exit). Device number: " devnum;
            if [[ devnum == "e" ]]; then
                echo "Exiting without selecting device.";
            else
                re='^[0-9]+([.][0-9]+)?$'
                if ! [[ $devnum =~ $re ]]; then
                   echo "Invalid: You didn't enter a number";
                elif [[ $devnum > $maxArrValue ]]; then
                    echo "Invalid: The number that you entered is greater then the number of options. (Maximum value: $maxArrValue)";
                else
                    echo "Device $devnum selected.";
                    device=${array[$devnum]}
                    break;
                fi
            fi
        done
        

    fi
}

device=""
foundDevice="false" #pointer to store if device is found

command_name="serialport-list";
if ! command_loc="$(type -p "$command_name")" || [[ -z $command_loc ]]; then
    # Backup hard directory scan in case serial-port list doesn't exist from nodejs port library
    array=(`ls /dev/tty.usbserial*`) || array=() && echo "Error accessing /dev/tty.usbserial"
    len=${#array[*]}
    if [[ $len > 0 ]]; then
        printSerial
    else
        echo "Scan of /dev/tty.usbserial results in no devices found";
        array=(`ls /dev/tty.usbmodem*`) || array=() && echo "Error accessing /dev/tty.usbmodem"
        len=${#array[*]}
        if [[ $len > 0 ]]; then
            printSerial
        else
            echo "Scan of /dev/tty.usbmodem results in no devices found";
            array=(`ls /dev/ttyUSB*`) || array=() && echo "Error accessing /dev/ttyUSB"
            len=${#array[*]}
            if [[ $len > 0 ]]; then
                printSerial
            else
                echo "Scan of /dev/ttyUSB results in no devices found";
                array=(`ls /dev/tty.ACM*`) || array=() && echo "Error accessing /dev/ttyACM"
                len=${#array[*]}
                if [[ $len > 0 ]]; then
                    printSerial
                else
                    foundDevice="false"
                    echo "Error: No devices could be found."
                fi
            fi
        fi
    fi
else
    device="'`serialport-list -f json`'"; #output serial list
    foundDevice="JSON";
fi



echo "FOUND DEVICE?: find type: $foundDevice, devicename $device"

echo "";
echo "Killing previous node processes...";
sudo killall node;
echo "Killing previous inspector processes & servers running on port $port...";
lsof -n -i4TCP:$port | grep LISTEN | tr -s ' ' | cut -f 2 -d ' ' | xargs kill -9
echo "Inspector processes:" `sudo lsof -t -i:9229`;
sudo kill -kill $(sudo lsof -t -i:9229) || echo "No processes found"; #kill option makes sure it is ded
echo "Starting node server with file...";
echo "Full node path: '$nodedir'";
cdloc="$(echo $nodedir | rev | cut -d'/' -f2- | rev)";
nodeloc="$(echo $nodedir | rev | cut -d'/' -f-1 | rev)";
echo -n "cdloc: ";
echo $cdloc;
echo -n "nodeloc: ";
echo $nodeloc;

cd $cdloc;
if ( "$openpage" = "true"); then
    echo "";
    echo "Opening new browser window and navigating to directory...";
    echo "Full file path: 'https://localhost:$port/COS.html'";
    open http://localhost:$port/COS.html;
fi
echo "Navigated to directory cdloc...";
echo "If it breaks, try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime";
if [ "$usenodemon" = "true" ]; then
    if [ "$nodebackground" = "true" ]; then
        echo "Starting node server in background (option passed)...";
        echo "WARNING: Node running in background can't recover from --inspect error. If this occurs, try again without the -b option.";
        if [ "$platform" = "linux" ]; then
            DEBUG=$debugval nodemon --max-old-space-size=8192 --quiet -L $nodeloc listtype=$foundDevice serial=$device &
        else
            DEBUG=$debugval nodemon --max-old-space-size=8192 --quiet --inspect -L $nodeloc listtype=$foundDevice serial=$device &
        fi
        
    else
        echo "Starting node server in foreground...";
        #the 2x start was a little bit annoying
        #DEBUG=$debugval nodemon --inspect --verbose $nodeloc || echo "Oh no, there was an exception :( Trying again without --inspect"; DEBUG=* node $nodeloc || printf "\n\n\n\nAnother error! Try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime! (then use kill PID) It usually works :)\n";
        if [ "$platform" = "linux" ]; then
            DEBUG=$debugval nodemon --max-old-space-size=8192 -L $nodeloc listtype=$foundDevice serial=$device || printf "\n\n\n\nAn error has occurred! Try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime! (then use kill PID) It usually works :)\n";
        else
            DEBUG=$debugval nodemon --max-old-space-size=12288 --inspect -L $nodeloc listtype=$foundDevice serial=$device || printf "\n\n\n\nAn error has occurred! Try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime! (then use kill PID) It usually works :)\n";
        fi
    fi
else
    if [ "$nodebackground" = "true" ]; then
        echo "Starting node server in background (option passed)...";
        echo "WARNING: Node running in background can't recover from --inspect error. If this occurs, try again without the -b option.";
        if [ "$platform" = "linux" ]; then
            DEBUG=$debugval node --max-old-space-size=8192 $nodeloc listtype=$foundDevice serial=$device &
        else
            DEBUG=$debugval node --max-old-space-size=8192 --inspect $nodeloc listtype=$foundDevice serial=$device &
        fi
    else
        echo "Starting node server in foreground...";
        #the 2x start was a little bit annoying
        #DEBUG=$debugval node --inspect $nodeloc || echo "Oh no, there was an exception :( Trying again without --inspect"; DEBUG=* node $nodeloc || printf "\n\n\n\nAnother error! Try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime! (then use kill PID) It usually works :)\n";
        if [ "$platform" = "linux" ]; then
            DEBUG=$debugval node --max-old-space-size=8192 $nodeloc listtype=$foundDevice serial=$device || printf "\n\n\n\nAn error has occurred! Try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime! (then use kill PID) It usually works :)\n";
        else
            DEBUG=$debugval node --max-old-space-size=8192 --inspect $nodeloc listtype=$foundDevice serial=$device || printf "\n\n\n\nAn error has occurred! Try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime! (then use kill PID) It usually works :)\n";
        fi
    fi
fi
#trap : 0;
#exit 0; #removed because this closes the terminal