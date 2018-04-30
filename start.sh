#!/bin/bash
echo "ANSS (Automatic Node Start Script), by Aaron Becker";

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

set -e -u;

if [[ $(id -u) -ne 0 ]]
  then echo "Sorry, but it appears that you didn't run this script as root. Please run it as a root user!";
  exit 1;
fi
trap 'abort' 0;

openpage="false";
newscript="false";
newroot="false";
nodebackground="false";
usenodemon="false";
debugval=""

defaultroot="/Users/Aaron/Desktop/Code/nodejs/index";
defaultscript="/Users/Aaron/Desktop/Code/nodejs/fileserve.js";
port="80";

while getopts :orsbndc option
do
    case "$option" in
    o)
         echo "-o option passed"; openpage="true";
         ;;
    r)
         echo "-r option passed"; newroot="true";
         ;;
    s)
         echo "-s option passed"; newscript="true";
         ;;
    b)
         echo "-b option passed"; nodebackground="true";
         ;;
    n)
         echo "-n option passed"; usenodemon="true";
         ;;
    d)
         echo "-d option passed"; debugval=*;
         ;;
    c)
         echo "-c options passed, clearing screen"; clear && printf '\e[3J';
         ;;
    *)
        echo "Hmm, an invalid option was received."
        echo ""
        ;;
        esac
done

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
                echo "Directory '$ans' invalid. Please try again.";
            else
                echo "Directory '$ans' does exist!"; 
                dir=$ans;
                break;
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

echo "";
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
    echo "Full file path: 'https://localhost:$port/$dir'";
    open http://localhost:$port/$dir/index.html;
fi
echo "Navigated to directory cdloc...";
echo "If it breaks, try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime";
if [ "$usenodemon" = "true" ]; then
    if [ "$nodebackground" = "true" ]; then
        echo "Starting node server in background (option passed)...";
        echo "WARNING: Node running in background can't recover from --inspect error. If this occurs, try again without the -b option.";
        DEBUG=$debugval nodemon --inspect $nodeloc &
    else
        echo "Starting node server in foreground...";
        DEBUG=$debugval nodemon --inspect $nodeloc || echo "Oh no, there was an exception :( Trying again without --inspect"; DEBUG=* node $nodeloc || printf "\n\n\n\nAnother error! Try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime! (then use kill PID) It usually works :)\n";
    fi
else
    if [ "$nodebackground" = "true" ]; then
        echo "Starting node server in background (option passed)...";
        echo "WARNING: Node running in background can't recover from --inspect error. If this occurs, try again without the -b option.";
        DEBUG=$debugval node --inspect $nodeloc &
    else
        echo "Starting node server in foreground...";
        DEBUG=$debugval node --inspect $nodeloc || echo "Oh no, there was an exception :( Trying again without --inspect"; DEBUG=* node $nodeloc || printf "\n\n\n\nAnother error! Try using 'ps aux | grep node' and killing a process to kill a not properly shutdown node runtime! (then use kill PID) It usually works :)\n";
    fi
fi
trap : 0;
exit 0;