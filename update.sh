#!/bin/bash
echo "NODEJS CarOS Updater";
echo "--------------------"
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

confirm() {
    # call with a prompt string or use a default
    read -r -p "${1:-Are you sure? [y/N]} " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

update() {
    echo "Downloading temporary CarOS directory...";
    sudo git clone https://github.com/aaroexxt/CarOS.git tempCAROS;

    if [ "$platform" = "linux" ]; then
        echo "Installing basename";
        sudo apt-get install -y basename;
    fi

    IFS=$'\n'; set -f #set internal field seperator to fix spaces in filenames
    cd tempCAROS;
    path=""
    if [ -d "$1" ]; then
        path=$1;
    else
        path="$cwd/tempCAROS"
    fi

    echo "base path: $path"
    recursivesize $path
    unset IFS; set +f

    #sudo rm -R "$cwd/tempCAROS";
}

function recursivesize() {
    files="$(find -L "$1" -type f)";
    if [[ "$files" == "" ]]; then
        echo "No files";
        return 0;
    fi
    file_count=$(echo "$files" | wc -l)
    echo "Found $file_count files to potentially update"
    echo "$files" | while read file; do
        #echo "Github file path: $file";
        sliceCWD=${file#$cwd}
        removeTempDir=$(echo $sliceCWD | sed 's,^[^/]*/,,' | sed 's,^[^/]*/,,') #slice twice to get rid of trailing slash and then dir
        rawFN="$cwd/$removeTempDir"
            
        sizeTemporary=`stat -f%z $file` #tem
        sizeCurrent=`(stat -f%z $rawFN)`


        if [ "$sizeTemporary" != "$sizeCurrent" ]; then
            if [[ $sizeTemporary = *".git"* ]]; then
                echo "git file found"
            else
                if [ "$sizeCurrent" = "" ]; then
                    echo "DELETED CLIENT DIR: $rawFN"
                else
                    echo && echo && echo
                    echo "Github size:"$sizeTemporary", CurrentDir size:"$sizeCurrent
                    read -p "File $rawFN doesn't match github file. Would you like to replace this file? [y/N]" </dev/tty response
                    case "$response" in
                        [yY][eE][sS]|[yY]) 
                            echo "REPLACED";
                            ;;
                        *)
                            echo "NOT REPLACED";
                            ;;
                    esac
                fi
            fi
            
        fi;
    done
}

echo "YOU ARE RUNNING THE UPDATE SCRIPT";
echo "This could potentially erase parts or all of the current CarOS directory, which will destroy changes that you have made.";
confirm && update;

#some kind of awesome glitch happens when I do this
#for filename in tempCarOS/*; do
#    rawFN=$($filename | sed -e 's/\/.*\///g')
#    echo $rawFN
#    lastModTemp=$(stat -f%z tempCarOS/$filename)
#    lastModCurrent=$(stat -f%z $filename)
#    echo $lastMod
#done


echo "Done updating."
echo "Run 'sudo bash $cwd/start.sh' to start the sever";
exit;
#VNC STUFF BELOW