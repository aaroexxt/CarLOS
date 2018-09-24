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

askIfDif="true"

while getopts :a option
do
    case "$option" in
    a)
         echo "-a flag passed, will automatically delete all files found to be not matching. (won't ask)"; askIfDif="false";
         ;;
    h)
        echo "Help: pass -a to automatically update files without y/n for each one."; exit 0;
        ;;
        esac
    *)
        echo "Hmm, an invalid option was received."
        echo ""
        ;;
        esac
done

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
    sudo rm -R "$cwd/tempCAROS" || echo "No CarOS directory found; not deleting"
    echo "Downloading temporary CarOS directory...";
    sudo git clone https://github.com/aaroexxt/CarOS.git tempCAROS;

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

    echo "Changing permissions on downloaded folder";
    sudo chmod 777 -R $cwd;
    sudo rm -R "$cwd/tempCAROS";
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
            
        sizeTemporary=`wc -c < $file` #tem
        sizeCurrent=`wc -c < $rawFN`


        if [ "$sizeTemporary" -ne "$sizeCurrent" ]; then
            ignoreSequence=".git"
            if ! [[ $file =~ $ignoreSequence ]]; then #make sure files aren't github files
                if [ "$sizeCurrent" = "" ]; then
                    echo "Found directory that client has deleted: $rawFN"
                else
                    echo && echo && echo
                    echo "Github filesize: "$sizeTemporary", CurrentDir filesizesize: "$sizeCurrent
                    if [ "$askIfDif" = "true" ]; then
                        read -p "File $rawFN doesn't match github file. Would you like to replace this file? [y/N]" </dev/tty response
                        case "$response" in
                            [yY][eE][sS]|[yY]) 
                                echo "Replacing file"; sudo rm $rawFN; sudo cp $file $rawFN; #will delete original file, then copy new
                                ;;
                            *)
                                echo "Won't replace file.";
                                ;;
                        esac
                    else
                        echo "File $rawFN doesn't match; autoreplacing.";
                        sudo rm $rawFN;
                        sudo cp $file $rawFN
                    fi
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