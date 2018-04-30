#!/bin/bash
du -shc *;
echo "Building from directory compile/";
#By Aaron Becker
cd ~/Desktop/Code/nodejs; browserify ~/Desktop/Code/nodejs/compile/index.js -o ~/Desktop/Code/nodejs/compile/compile.js;
cd ~/Desktop/Code/nodejs/compile/;
open http://localhost:9966;
clear;
npm start;