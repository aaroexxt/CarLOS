//GLOBAL VARIABLES
var globals = {
    disconnected: false,
    openCVQueue: [],
    MainPopup: {
        dialogObject: null,
        displayMain: function(){
            globals.MainPopup.dialogObject = bootbox.dialog({
                message: `
                    <hr class="asep">
                    <img class="asep" src="/images/a.png">
                    <center>
                        <h2>Information</h2>
                        <p>Frontend Version: `+globals.runtimeInformation.frontendVersion+`
                        <br>Backend Version: `+globals.runtimeInformation.backendVersion+`
                        <br>Node.JS Server Connected: `+globals.runtimeInformation.nodeConnected+`
                        <br>Python Backend Connected: `+globals.runtimeInformation.pythonConnected+`
                        <br>Arduino Connected: `+globals.runtimeInformation.arduinoConnected+`
                        <br>Heartbeat Timeout (s): `+(globals.runtimeInformation.heartbeatMS/1000)+`
                        </p>
                        <button onclick="globals.updateRuntimeInformation(); socketListener.addListener('runtimeInformation', function(){globals.MainPopup.dialogObject.modal('hide'); setTimeout(function(){globals.MainPopup.displayMain()},300);});">Update Runtime Information</button>
                        <br>
                        <h3>Car Stats</h3>
                    </center>
                    <img src="/images/car.png" style="float: left; height: 120px; width: 440px; margin-left: 2%;"></img>
                    <div style="float: left; margin-left: 1%;">
                        <p style="font-size: 18px">
                            Car Odometer: `+globals.runtimeInformation.odometer+`mi
                            <br>
                            Server Status: `+globals.runtimeInformation.status+`
                            <br>
                            Server Uptime: `+globals.runtimeInformation.uptime+`
                            <br>
                            Users Connected to Server: `+globals.runtimeInformation.users+`
                            <br>
                        </p>
                    </div>
                    <br>
                    <br>
                    <br>
                    <br>
                    <br>
                    <br>
                    <center>
                        <h4>Idea, Design, UI, and Code © Aaron Becker, 2018.</h4>
                        <h4>Credit to Google, Node.js, OpenCV, Bootstrap, and Bootbox.js Developers for software used in this program</h4>
                    </center>
                `,
                backdrop: false,
                closeButton: false,
                onEscape: true,
                size: "large",
                className: "center",
                buttons: {
                    cancel: {
                        label: "Close Window",
                        className: "btncenter",
                        callback: function() {
                            globals.MainPopup.dialogObject.modal('hide');
                        }
                    },
                    advancedSettings: {
                        label: "Advanced",
                        className: "btncenter",
                        callback: function() {
                            globals.MainPopup.dialogObject.modal('hide');
                            setTimeout(() => {
                                globals.MainPopup.displayAdvanced();
                            }, 300);
                        }
                    }
                }
            })
        },
        displayAdvanced: function() {
            globals.MainPopup.dialogObject = bootbox.dialog({
                message: `
                    <hr class="asep">
                    <img class="asep" src="/images/a.png">
                    <center>
                        <h2>Advanced Settings</h2>
                        <button onclick="globals.music.togglePlayerOutput();">(BETA): Toggle Music Output</button>
                        <p>Will toggle output of soundcloud playing to be server audio port or client device. Warning: Needs internet if playing on client device. More stable+tested more on server side.</p>
                        <br>
                        <p>Currently playing on: `+((globals.music.playMusicOnServer) ? "server" : "client")+`
                    </center>
                `,
                backdrop: false,
                closeButton: false,
                onEscape: true,
                size: "large",
                className: "center",
                buttons: {
                    cancel: {
                        label: "Close Window",
                        className: "btncenter",
                        callback: function() {
                            globals.MainPopup.dialogObject.modal('hide');
                        }
                    },
                    basicSettings: {
                        label: "Back",
                        className: "btncenter",
                        callback: function() {
                            globals.MainPopup.dialogObject.modal('hide');
                            setTimeout(() => {
                                globals.MainPopup.displayMain();
                            },300);
                        }
                    }
                }
            });
        }
    },
    menu: {
        states: {
            music: false,
            browser: false,
            stats: false,
            map: false
        },
        changeState: function(newState) {
            var keys = Object.keys(globals.menu.states);
            if (keys.indexOf(newState) > -1) {
                for (var i=0; i<keys.length; i++) {
                    globals.menu.states[keys[i]] = false;
                    var uppercaseKey = (keys[i].substring(0,1).toUpperCase()+keys[i].substring(1,keys[i].length));
                    //console.log("resetting "+uppercaseKey+" elem and button");
                    ID("menuButton"+uppercaseKey).className = "circle"; //reset button className
                    ID("main"+uppercaseKey).style.display = "none"; //reset element display
                }
                globals.menu.states[newState] = true;
                var uppercaseState = (newState.substring(0,1).toUpperCase()+newState.substring(1,newState.length));
                ID("menuButton"+uppercaseState).className += " selected";
                ID("main"+uppercaseState).style.display = "block";
                if (globals.menu.states.music) {
                    ID("music_bottomMenu").style.display = "block";
                } else if (!globals.runtimeInformation.dynamicMusicMenu) { //no dynamic music menu so hide it
                    ID("music_bottomMenu").style.display = "none";
                } else {
                    if (!globals.music.soundManager.playingTrack) {
                        ID("music_bottomMenu").style.display = "none";
                    }
                }
                console.log("Menu newState: '"+newState+"'");
            } else {
                console.error("NewState for menu switch is invalid");
            }
        }
    },
    updateRuntimeInformation: function() {
        console.log("requesting runtime info")
        socket.emit("GET", {"action": "requestRuntimeInformation"});
    },
    runtimeInformation: {
        frontendVersion: "? (Should Not Happen)",
        backendVersion: "? (Should Not Happen)",
        nodeConnected: "? (Should Not Happen)",
        pythonConnected: "? (Should Not Happen)",
        arduinoConnected: "? (Should Not Happen)",
        uptime: "? (Should Not Happen)",
        status: "NotConnected",
        users: "? (Should Not Happen)",
        odometer: "? (Should Not Happen)",
        dynamicMusicMenu: true
    },
    runtimeInfoUpdateTimeout: null,
    defaultApp: "music",
    music: {
        
        noArtworkUrl: "/images/noAlbumArt.png",
        nextTrackShuffle: false,
        nextTrackLoop: false,
        soundcloudReady: false,
        firstPlay: true,
        tracksFromCache: false,
        likedTracks: [],
        trackList: [],
        setListeners: false,
        playMusicOnServer: true,

        oldSettingsData: {},

        init: function() {
            if (!globals.music.setListeners) {
                globals.music.setListeners = true;
                socketListener.addPersistentListener("serverDataReady", data => {
                    if (data && data.hasTracks && data.likedTracks.length > 0 && data.trackList.length > 0) {
                        globals.music.likedTracks = data.likedTracks;
                        globals.music.trackList = data.trackList;
                        
                        var sd = data.settingsData;
                        globals.music.currentUser = sd.currentUser;
                        globals.music.noArtworkUrl = sd.noArtworkUrl;
                        globals.music.volStep = sd.volStep;
                        globals.music.currentVolume = sd.currentVolume;
                        globals.music.playMusicOnServer = sd.playMusicOnServer;
                        globals.music.nextTrackShuffle = sd.nextTrackShuffle;
                        globals.music.soundcloudReady = sd.soundcloudReady;
                        globals.music.nextTrackLoop = sd.nextTrackLoop;
                        globals.music.tracksFromCache = sd.tracksFromCache;

                        if (globals.music.nextTrackShuffle) {
                            ID("music_shuffleButton").className+=' activeLoopShuffle';
                        }
                        
                        if (globals.music.nextTrackLoop) {
                            ID("music_loopButton").className+=' activeLoopShuffle';
                        }
                        console.log(globals.music.nextTrackLoop,globals.music.nextTrackShuffle,data)
                        
                        SC.initialize({
                            client_id: data.clientID
                        });
                        ID("music_trackTitle").innerHTML = "Select a track";
                        
                        //socket.emit("GET",{action: "clientHasSoundcloudCache", cache: globals.music.likedTracks, cacheLength: globals.music.trackList.length, authkey: globals.authkey});
                        globals.music.musicUI.updateTrackList(globals.music.likedTracks);
                    } else {
                        console.error("Server said that it had tracks but there are no tracks provided (track response may be malformed)");
                    }
                    socketListener.addPersistentListener("serverPlayingTrackUpdate", data => {
                        console.log("PLAYINGTRACKUPDATE: ",data);
                        if (JSON.stringify(globals.music.oldSettingsData) != JSON.stringify(data.settingsData)) {
                            console.log("DataChange");
                            globals.music.currentUser = data.settingsData.currentUser;
                            globals.music.currentVolume = data.settingsData.currentVolume;
                            if (globals.music.oldSettingsData.nextTrackShuffle != data.settingsData.nextTrackShuffle) {
                                globals.music.nextTrackShuffle = data.settingsData.nextTrackShuffle;
                                if (globals.music.nextTrackShuffle) {
                                    ID("music_shuffleButton").className+=' activeLoopShuffle';
                                } else {
                                    ID("music_shuffleButton").className = "controlButton";
                                }
                            }
                            if (globals.music.oldSettingsData.nextTrackLoop != data.settingsData.nextTrackLoop) {
                                globals.music.nextTrackLoop = data.settingsData.nextTrackLoop;
                                if (globals.music.nextTrackLoop) {
                                    ID("music_loopButton").className+=' activeLoopShuffle';
                                } else {
                                    ID("music_loopButton").className = "controlButton";
                                }
                            }
                            globals.music.oldSettingsData = data.settingsData;
                        }
                        
                        if (JSON.stringify(globals.music.soundManager.currentPlayingTrack) != JSON.stringify(data.currentPlayingTrack)) {
                            console.log("TrackChange");
                            var nTrack = data.currentPlayingTrack;
                            globals.music.soundManager.currentPlayingTrack = nTrack;
                            ID("music_trackArt").src = (!nTrack.artwork.artworkUrl) ? globals.music.noArtworkUrl : nTrack.artwork.artworkUrl;
                            ID("music_waveformArt").src = nTrack.artwork.waveformUrl;
                            ID("music_trackTitle").innerHTML = nTrack.title;
                            ID("music_trackAuthor").innerHTML = "By: "+nTrack.author;
                        }
                    });
                });

                socketListener.addPersistentListener("serverNoTrackCache", data => {
                    console.warn("TrackCache has no tracks; no music playing possible");
                    ID("music_trackTitle").innerHTML = "No tracks in cache; can't load tracks (no internet?)";
                });

                socketListener.addPersistentListener("serverLoadingCachedTracks", data => {
                    ID("music_trackTitle").innerHTML = "Requesting cached tracks (can't fetch new)";
                });

                socketListener.addPersistentListener("serverLoadingTracklist", data => {
                    ID("music_trackTitle").innerHTML = "Server is loading tracks.";
                });

                socketListener.addPersistentListener("serverLoadingTracksUpdate", data => {
                    ID("music_trackAuthor").innerHTML = "Loading percent: "+data.percent+" (Loading track: "+data.track+")";
                });

                socketListener.addPersistentListener("serverSoundcloudError", data => {
                    console.error("Soundcloud Server Error: "+data.error);
                    bootbox.alert("Soundcloud Server Error: "+data.error);
                });

            }

            socket.emit("GET",{action: "SCClientReady", authkey: globals.authkey});
        },

        togglePlayerOutput: function() {
            if (globals.music.soundcloudReady) {
                globals.music.playMusicOnServer = !globals.music.playMusicOnServer;
                socket.emit("GET", {action: "SCClientUserEvent", type: "togglePlayerOutput", origin: "client-"+globals.authkey});
            }
        },

        soundManager: {
            playingTrack: false,
            currentVolume: 50,
            currentPlayingTrack: {},
            playerObject: { //faaaake so that no errors occur
                play: function(){},
                pause: function(){},
                setVolume: function(){},
                currentTime: function(){
                    return 0;
                },
                getDuration: function(){
                    return 1;
                }
            },
            playTrackLocal: function(track) {
                console.log("playing id: "+track.id); 
                SC.stream('/tracks/' + track.id).then(function(player) {
                    globals.music.soundManager.playerObject.pause(); //pause previous
                    globals.music.soundManager.playerObject = player;
                    globals.music.soundManager.playerObject.play();
                    globals.music.soundManager.playingTrack = true;
                    ID("music_trackArt").src = (!track.artwork.artworkUrl) ? globals.music.noArtworkUrl : track.artwork.artworkUrl;
                    ID("music_waveformArt").src = track.artwork.waveformUrl;
                    ID("music_trackTitle").innerHTML = track.title;
                    ID("music_trackAuthor").innerHTML = "By: "+track.author;
                    globals.music.soundManager.currentPlayingTrack = track;
                    if (globals.music.firstPlay) {
                        globals.music.soundManager.currentVolume = globals.music.defaultVolume;
                        globals.music.soundManager.setPlayerVolume(globals.music.soundManager.currentVolume);
                        globals.music.firstPlay = false;
                    }
                }).catch(function(){
                    console.error("Error playing track with id ("+track.id+"): ",arguments);
                    ID("music_trackArt").src = "/images/errorLoadingTrack.png";
                });
            },
            playTrackRequested: function(track) {
                globals.music.soundManager.currentPlayingTrack = track;
                ID("music_trackArt").src = (!track.artwork.artworkUrl) ? globals.music.noArtworkUrl : track.artwork.artworkUrl;
                ID("music_waveformArt").src = track.artwork.waveformUrl;
                ID("music_trackTitle").innerHTML = track.title;
                ID("music_trackAuthor").innerHTML = "By: "+track.author;
                socket.emit("GET", {action: "SCClientUserEvent", authkey: globals.authkey, type: "clientTrackSelected", data: {trackID: track.id}, origin: "client-"+globals.authkey});
            },
            setPlayerVolume: function(vol) {
                if (globals.music.soundManager.currentVolume == null || typeof globals.music.soundManager.currentVolume == "undefined") {
                    globals.music.soundManager.currentVolume = globals.music.defaultVolume;
                }
                if (vol < 0) {
                    vol = 0;
                }
                if (vol > 100) {
                    vol = 100;
                }
                if (vol > 1) {
                    globals.music.soundManager.playerObject.setVolume(vol/100); //assume it is 1-100 scale
                } else {
                    globals.music.soundManager.playerObject.setVolume(vol); //assume it is 0-1 scale
                }
            },
            getPercent: function() {
                return Math.round((globals.music.soundManager.playerObject.currentTime()/globals.music.soundManager.playerObject.getDuration())*100);
            },
            startTrackManager: function() {
                clearInterval(globals.music.trackUpdateInterval);
                globals.music.trackUpdateInterval = setInterval(function() {
                    var isDone = ((globals.music.soundManager.playerObject.currentTime()/globals.music.soundManager.playerObject.getDuration()) >= 0.999);
                    if (isDone) {
                        if (globals.music.nextTrackLoop) { //loop?
                            globals.music.soundManager.playerObject.seek(0); //loop the track
                        } else {
                            globals.music.soundManager.forwardTrack(); //nah just forward
                        }
                    }
                },200)
            },
            playPauseTrack: function() {
                socket.emit("GET", {action: "SCClientUserEvent", authkey: globals.authkey, type: "playPause", origin: "client-"+globals.authkey});
            },
            volUp: function() {
                socket.emit("GET", {action: "SCClientUserEvent", authkey: globals.authkey, type: "volumeUp", origin: "client-"+globals.authkey});
            },
            volDown: function() {
                socket.emit("GET", {action: "SCClientUserEvent", authkey: globals.authkey, type: "volumeDown", origin: "client-"+globals.authkey});
            },
            backTrack: function() {
                socket.emit("GET", {action: "SCClientUserEvent", authkey: globals.authkey, type: "trackBackward", origin: "client-"+globals.authkey});
            },
            forwardTrack: function() { //can go forward one or shuffle to get to next track
                socket.emit("GET", {action: "SCClientUserEvent", authkey: globals.authkey, type: "trackForward", origin: "client-"+globals.authkey});
            },
            changeLoopState: function() {
                globals.music.nextTrackLoop = !globals.music.nextTrackLoop;
                socket.emit("GET", {action: "SCClientUserEvent", authkey: globals.authkey, type: "changeTrackLoopState", origin: "client-"+globals.authkey});
            },
            changeShuffleState: function() {
                globals.music.nextTrackShuffle = !globals.music.nextTrackShuffle;
                socket.emit("GET", {action: "SCClientUserEvent", authkey: globals.authkey, type: "changeTrackShuffleState", origin: "client-"+globals.authkey});
            },
            updateCanvas: function() {
                var canvas = document.getElementById('main');

                var ctx = document.getElementById('main').getContext('2d');
                var tile = new Image();
                tile.src = document.getElementById('image').src;
                tile.onload = function() {
                    draw(tile);
                }

                function draw(img) {
                    var buffer = document.createElement('canvas');
                    var bufferctx = buffer.getContext('2d');
                    bufferctx.drawImage(img, 0, 0);
                    var imageData = bufferctx.getImageData(0,0,buffer.width,  buffer.height);
                    var data = imageData.data;
                    var removeBlack = function() {
                        for (var i = 0; i < data.length; i += 4) {
                            if(data[i]+ data[i + 1] + data[i + 2] < 10){ 
                                data[i + 3] = 0; // alpha
                            }
                        } 
                        ctx.putImageData(imageData, 0, 0); 
                    }; 
                 removeBlack(); 
                } 
            }
        },

        musicUI: {
            updateTrackList: function(tracklist) {
                var tklElem = ID("music_trackList");
                tklElem.innerHTML = "";
                for (var i=0; i<tracklist.length; i++) {
                    var p = document.createElement("p");
                    var txt = document.createTextNode(String(i+1)+"): "+tracklist[i].title);
                    p.setAttribute("onclick","globals.music.soundManager.playTrackRequested("+JSON.stringify(tracklist[i])+");");
                    p.setAttribute("tabindex","0");
                    p.setAttribute("class","songTitle")
                    p.appendChild(txt);
                    tklElem.appendChild(p);
                }
                globals.music.soundManager.startTrackManager(); //start the manager
            },
            changeSoundcloudUser: function() {
                bootbox.prompt("New soundcloud user? (Enter nothing if you don't want to change users)",function(user) {
                    if (user != "" && typeof user != "undefined" && user != null) {
                        console.log("Changing soundcloud user to: "+user);
                        socket.emit("GET", {action: "SCClientChangeUser", newUser: user, authkey: globals.authkey});
                        globals.music.setListeners = false;
                    }
                });
            }
        }
    },
            
    loginVideoStream: undefined,
    fadeInOutDelay: 500,
    map: {
        mapReference: "uninit",
        defaultZoom: 15,
        defaultMapGestureHandling: "greedy",
        geolocationOptions: {
            enableHighAccuracy: true,
            timeout: 60000,
            maximumAge: 0,
            desiredAccuracy: 0,
            frequency: 1
        },
        markers: [],
        locations: {
            burlingame: {
                lat: 37.577870,
                lng: -122.34809
            }
        },
        grayScaleEnabled: false,
        createMarker: function(opts, callback) {
            if (typeof opts == "undefined" || typeof callback == "undefined") {
                console.error("[MAPS] Opts or callback undefined");
            } else {
                var marker = new google.maps.Marker(opts);
                google.maps.event.addListener(marker, 'click', function(){
                    try {
                        callback();
                    } catch(e) {
                        console.error("[MAPS] Error running callback function")
                    }
                })
                globals.map.markers.push(marker);
                return marker;
            }
            return "error";
        },
        currentPos: {
            lat: 37.577870,
            lng: -122.34809
        },
        getClientLocation: function() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    var la = position.coords.latitude;
                    var ln = position.coords.longitude;
                    console.log("[MAPS] got lat nowatch: "+la+", lng: "+ln);
                    globals.map.currentPos.lat = la;
                    globals.map.currentPos.lng = ln;
                }, function(){
                    console.error("[MAPS] Error getting user position noClientWatch. Code: "+error.code+", message: "+error.message);
                }, globals.map.geolocationOptions);
            } else {
                console.error("[MAPS] Client browser does not support geolocation.");
            }
        },
        watchID: null,
        setupClientWatch: function(callback) {
            if (navigator.geolocation) {
                if (globals.map.watchID != null) {
                    navigator.geolocation.clearWatch(globals.map.watchID);
                    globals.map.watchID = null;
                }
                globals.map.watchID = navigator.geolocation.watchPosition(function(position) {
                    var la = position.coords.latitude;
                    var ln = position.coords.longitude;
                    console.log("[MAPS] got lat from watch: "+la+", lng: "+ln);
                    globals.map.currentPos.lat = la;
                    globals.map.currentPos.lng = ln;
                    try {
                        callback(la, ln);
                    } catch(e) {
                        console.error("[MAPS] failed to run lat watch callback function")
                    }
                }, function(){
                    console.error("[MAPS] Error getting user position clientWatch.");
                }, globals.map.geolocationOptions);
            } else {
                console.error("[MAPS] Client browser does not support geolocation.");
            }
        },
        defaultCarImagePath: "/images/carinverted.png",
        defaultCarImageWidth: 100, //used to be 50
        defaultCarImageHeight: 33.125, //used to be 50
        getImageBounds: function(path, callback) {
            var imgLoader = new Image();

            imgLoader.onload = function() {
                var height = imgLoader.height;
                var width = imgLoader.width;
                try {
                    callback(width, height);
                } catch(e) {
                    console.error("[MAPS] Error running callback for getImageBounds");
                }
            }
            imgLoader.src = path;
        },
        latLngToPixels: function(lat, lng, map) {
            var latLng = new google.maps.LatLng(lat, lng);
            var projection = map.getProjection();
            var bounds = map.getBounds();
            var topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
            var bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
            var scale = Math.pow(2, map.getZoom());
            var worldPoint = projection.fromLatLngToPoint(latLng);
            return [Math.floor((worldPoint.x - bottomLeft.x) * scale), Math.floor((worldPoint.y - topRight.y) * scale)];
        },
        shrinkViewportPercentage: 0.48,
        fitMapToMarkers: function(markers, map) { //ty https://stackoverflow.com/questions/8170023/google-maps-api-3-zooms-out-on-fitbounds
            var bounds = new google.maps.LatLngBounds();
            for (var i = 0; i < markers.length; i++) {
                bounds.extend(new google.maps.LatLng(markers[i].position.lat(), markers[i].position.lng()));
            }
            //map.setCenter(bounds.getCenter());
            var sw = bounds.getSouthWest();
            var ne = bounds.getNorthEast();

            var latAdj = Math.abs(ne.lat() - sw.lat()) * globals.map.shrinkViewportPercentage;
            var lngAdj = Math.abs(ne.lng() - sw.lng()) * globals.map.shrinkViewportPercentage;

            var latLngBounds = [
                {lat: sw.lat() + latAdj, lng: sw.lng() + lngAdj},
                {lat: ne.lat() - latAdj, lng: ne.lng() - lngAdj}
            ]

            var newBounds = new google.maps.LatLngBounds(latLngBounds[0], latLngBounds[1]);

            map.fitBounds(newBounds);
            map.panToBounds(newBounds);

            if (map.getZoom() < 4) {
                map.setZoom(4);
            }
        }, //todo make this function run whenever the user is not touching the screen
        steeringWheelMarker: ""
    },
    voice: {
        speaker: Speech.speak,
        onSpeech: function(data) {
            //console.log("recieved speech data: "+data);
            socket.emit("GET",{action: "processSpeech", authkey: globals.authkey, speech: data});
        },
        defaultInstructions: "What can I help you with?",
        defaultTextDelay: 1000
    },
    initWifiIndicator: function(id) {
        var wifiIndicator = document.getElementById(id);
        var position = 0;
        var direction = 1;
        var seek = setInterval(function(){
            wifiIndicator.src = "/images/wifiL"+position+".png";
            position+= direction;
            if (position > 3 || position < 1) {
                direction*=-1;
            }
        },500);
        var wifiPromise = globals.getWifiSpeed();
        wifiPromise.then(function(speed) {
            clearInterval(seek);
            if (speed > 10) {
                wifiIndicator.src = "/images/wifi5.png";
            } else if (speed > 5) {
                wifiIndicator.src = "/images/wifi4.png";
            } else if (speed > 2) {
                wifiIndicator.src = "/images/wifi3.png";
            } else if (speed > 1) {
                wifiIndicator.src = "/images/wifi2.png";
            } else {
                wifiIndicator.src = "/images/wifi1.png";
            }
        }, function(err) {
            clearInterval(seek);
            wifiIndicator.src = "/images/wifiE.png";
        })
        setTimeout(function(){
            globals.initWifiIndicator(id);
        }, globals.wifiUpdateTime);
    },
    wifiUpdateTime: 320000, //update every 20 mins (1200000)
    delayWifiTime: 7000,
    getWifiSpeed: function() {
        var wifiPromise = new Promise(function(resolve, reject) {
            var imageAddr = "https://aaronbecker.tech/5mb.jpg";
            var startTime, endTime;
            var downloadSize = 5245329;
            var download = new Image();
            console.log("started download")
            download.onload = function () {
                endTime = (new Date()).getTime();
                var duration = (endTime - startTime) / 1000; //Math.round()
                var bitsLoaded = downloadSize * 8;
                var speedBps = (bitsLoaded / duration).toFixed(2);
                var speedKbps = (speedBps / 1024).toFixed(2);
                var speedMbps = (speedKbps / 1024).toFixed(2);
                globals.speed.bps = speedBps;
                globals.speed.kbps = speedKbps;
                globals.speed.mbps = speedMbps;
                resolve(speedMbps);
            }
            download.onerror = function() {
                console.error("Error getting image from aaronbecker.tech");
                reject();
            }
            startTime = (new Date()).getTime();
            var cacheBuster = "?nnn=" + startTime;
            download.src = imageAddr + cacheBuster;
        });
        return wifiPromise;
    },
    speed: {
        bps: 0,
        kbps: 0,
        mbps: 0
    },
    initSpeedIndicator: function(id) {
        var speedIndicator = document.getElementById(id);
        speedIndicator.innerHTML = globals.speed.mbps+" MB/s";
        setTimeout(function(){
            globals.initSpeedIndicator(id);
        },globals.speedIndicatorUpdateTime);
    },
    speedIndicatorUpdateTime: 1000,
    initTimeIndicator: function(id) {
        var timeIndicator = document.getElementById(id);
        var d = new Date();
        var o = {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }; 
        var ts = d.toLocaleString('en-US', o);
        timeIndicator.innerHTML = ts;
        setTimeout(function(){
            globals.initTimeIndicator(id);
        },globals.timeIndicatorUpdateTime)
    },
    timeIndicatorUpdateTime: 1000
}

/*voices:
samantha
tessa
yuri
google uk english male
google us english
*/
const login = {
    pageReady: function(){
        ID("loading").style.display = "none";
        var loaders = document.getElementsByClassName("loader");
        for (var i=0; i<loaders.length; i++) {
            loaders[i].style.display = "none";
        }
        ID("loginvideo").style.display = "block";
    },
    readySteps: {
        pageLoad: true,
        videoLoad: false,
        nodeConnected: false,
        pythonConnected: false,
        validAuthkey: false,
        internetConnected: false,
        runtimeInformationProvided: false
    },
    loadedOnce: false,
    readyUpdater: setInterval(function(){
        var loadMessages = ID("loadMessages");
        var keys = Object.keys(login.readySteps);
        if (login.loadedOnce == false) {
            login.previousReadySteps = JSON.parse(JSON.stringify(login.readySteps));
            try{
                loadMessages.innerHTML = "<h2 style='text-decoration: underline'>Loading Scripts</h2>";
                for (var i=0; i<keys.length; i++) {
                    var title = document.createElement("h3"); //create h3 tag
                    title.setAttribute("style","display: inline;");
                    var text = document.createTextNode(keys[i]+": ");
                    title.appendChild(text);

                    var img = document.createElement("img"); //create image element
                    img.setAttribute("width",String(login.imageWidth)+"px");
                    img.setAttribute("height",String(login.imageHeight)+"px");
                    img.setAttribute("id","loadImg"+keys[i])
                    if (login.readySteps[keys[i]]) { //dynamically add check or noncheck
                        img.setAttribute("src",login.imageCheckPath);
                    } else {
                        img.setAttribute("src",login.imageNoCheckPath);
                    }

                    var br = document.createElement("br");
                    var br2 = document.createElement("br");

                    loadMessages.appendChild(title);
                    loadMessages.appendChild(img);
                    loadMessages.appendChild(br);
                    loadMessages.appendChild(br2);
                }
                var progressBar = document.createElement("progress");
                progressBar.setAttribute("id","loadBar");
                progressBar.setAttribute("class","loadBar");
                progressBar.setAttribute("value","0");

                loadMessages.appendChild(progressBar);

                login.loadedOnce = true; //only set if successful
            } catch(e) {} //not loaded yet
        } else {
            var ready = true;
            var stepsReady = keys.length;
            for (var i=0; i<keys.length; i++) {
                if (!login.readySteps[keys[i]]) {
                    ready = false;
                    stepsReady--;
                }
                if (login.previousReadySteps[keys[i]] !== login.readySteps[keys[i]]) {
                    var img = ID("loadImg"+keys[i]);
                    try {
                        if (login.readySteps[keys[i]]) { //dynamically add check or noncheck
                            img.setAttribute("src",login.imageCheckPath);
                        } else {
                            img.setAttribute("src",login.imageNoCheckPath);
                        }
                    } catch(e) {
                        console.error("Error setting attrib for key "+keys[i])
                    }
                }
            }
            ID("loadBar").value = (stepsReady/keys.length);
            login.previousReadySteps = JSON.parse(JSON.stringify(login.readySteps));
            if (ready) {
                login.pageReady();
                clearInterval(login.readyUpdater);
            }
        }
    },200),
    imageCheckPath: "/images/check.png",
    imageNoCheckPath: "/images/nocheck.png",
    imageWidth: 16,
    imageHeight: 16,
    initializeMap: function(){
        ID("mainMap").innerHTML = "";
        globals.map.mapReference = new google.maps.Map(ID('mainMap'), { //setup map
            zoom: globals.map.defaultZoom,
            center: globals.map.locations.burlingame,
            gestureHandling: globals.map.defaultMapGestureHandling,
            mapTypeId: "OSM", //openstreetmap
            mapTypeControl: false,
            streetViewControl: false
            //styles: (globals.map.grayScaleEnabled)?[{featureType:"landscape",stylers:[{saturation:-100},{lightness:65},{visibility:"on"}]},{featureType:"poi",stylers:[{saturation:-100},{lightness:51},{visibility:"simplified"}]},{featureType:"road.highway",stylers:[{saturation:-100},{visibility:"simplified"}]},{featureType:"road.arterial",stylers:[{saturation:-100},{lightness:30},{visibility:"on"}]},{featureType:"road.local",stylers:[{saturation:-100},{lightness:40},{visibility:"on"}]},{featureType:"transit",stylers:[{saturation:-100},{visibility:"simplified"}]},{featureType:"administrative.province",stylers:[{visibility:"off"}]/**/},{featureType:"administrative.locality",stylers:[{visibility:"off"}]},{featureType:"administrative.neighborhood",stylers:[{visibility:"on"}]/**/},{featureType:"water",elementType:"labels",stylers:[{visibility:"on"},{lightness:-25},{saturation:-100}]},{featureType:"water",elementType:"geometry",stylers:[{hue:"#ffff00"},{lightness:-25},{saturation:-97}]}]:[],
            //mapTypeId: 'hybrid'
        });
        globals.map.mapReference.mapTypes.set("OSM", new google.maps.ImageMapType({
            getTileUrl: function(coord, zoom) {
                // "Wrap" x (longitude) at 180th meridian properly
                // NB: Don't touch coord.x: because coord param is by reference, and changing its x property breaks something in Google's lib
                var tilesPerGlobe = 1 << zoom;
                var x = coord.x % tilesPerGlobe;
                if (x < 0) {
                    x = tilesPerGlobe+x;
                }
                // Wrap y (latitude) in a like manner if you want to enable vertical infinite scrolling

                return "https://tile.openstreetmap.org/" + zoom + "/" + x + "/" + coord.y + ".png";
            },
            tileSize: new google.maps.Size(256, 256),
            name: "OpenStreetMap",
            maxZoom: 18
        }));
        login.readySteps.internetConnected = true; //if it errors it will error b4 this so that internet won't be set

        globals.map.createMarker({ //create burlingame marker
            position: globals.map.locations.burlingame,
            map: globals.map.mapReference,
            clickable: true,
            title: 'Burlingame, CA'
        },function(){
            console.log("clicked marker");
        });

        /*var imageBounds = globals.map.getImageBounds(globals.map.defaultImagePath, function(width, height) { //get imagebounds for steering wheel and place it on map
            console.log("got imagebounds: w="+width+", h="+height);
            var lat = globals.map.currentPos.lat;
            var lng = globals.map.currentPos.lng;

            var currentPixels = globals.map.latLngToPixels(lat, lng, globals.map.mapReference);

            var boundsInPixels = [
                [currentPixels[0], currentPixels[1]],
                [currentPixels[0]+width, currentPixels[1]+height];
            ];

            var currentBounds = glob

            globals.map.mapOverlay = new MapImageOverlay(imageBounds, globals.map.defaultImagePath, globals.map.mapReference);
        });*/

        var steeringWheelIcon = {
            url: globals.map.defaultCarImagePath,
            scaledSize: new google.maps.Size(globals.map.defaultCarImageWidth,globals.map.defaultCarImageHeight),
            origin: new google.maps.Point(0,0),
            anchor: new google.maps.Point(globals.map.defaultCarImageWidth/2,globals.map.defaultCarImageHeight/2)
        }
        globals.map.steeringWheelMarker = globals.map.createMarker({
            position: globals.map.locations.burlingame,
            map: globals.map.mapReference,
            clickable: true,
            draggable: true,
            icon: steeringWheelIcon
        }, function(){
            console.log("Clicking other marker")
        });

        globals.map.setupClientWatch(function(lat, lng) {
            globals.map.steeringWheelMarker.setPosition(new google.maps.LatLng(lat, lng));
            globals.map.fitMapToMarkers(globals.map.markers, globals.map.mapReference);
        });
    }, initializeStats: function() {
        var ctx = ID("carStats");
        var scatterChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Average PWR',
                        data: [
                            {
                                x: 0,
                                y: 0
                            },
                            {
                                x: 10,
                                y: 10
                            }
                        ],
                        backgroundColor : "rgba(0,220,0,0.22)"
                    }
                ]
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'linear',
                        position: 'bottom',
                        labelString: 'X Axis'
                    }],
                    yAxes: [{
                        type: 'linear',
                        labelString: 'Y Axis'
                    }]
                }
            }
        });
    }, initialize: function() {

        setTimeout(function(){
            globals.initWifiIndicator("wifilevel"); //init wifi, time and map
            globals.initSpeedIndicator("wifispeed");
        }, globals.delayWifiTime);

        globals.initTimeIndicator("time");
        login.initializeStats();
        login.initializeMap();

        if (typeof Speech !== "undefined") {
            if (Speech.isSupported) {
                var voices = Speech.listVoices();
                if (typeof Speech.setVoice("Google UK English Male") == "undefined") {
                    console.warn("Defaulting to first system voice.");
                    if (typeof Speech.setVoice(voices[0].name) == "undefined") {
                        console.warn("Failed to set speech voice, waiting for voices load...");
                        Speech.voicesLoaded = function() {
                            alert("Voices loaded")
                            var voices = Speech.listVoices();
                            if (typeof Speech.setVoice("Google UK English Male") == "undefined") {
                                console.warn("Defaulting to first system voice.");
                                if (typeof Speech.setVoice(voices[0].name) == "undefined") {
                                    console.warn("Failed to set speech voice.");
                                }
                            }
                        }
                    }
                }
            } else {
                console.error("Client is not capable of speech synthesis.")
            }
        } else {
            console.error("Speech not defined; annyang is active however")
        }
    }, initializeOnceAuthkeyValid: function(){
        //setTimeout(()=>{login.approvedLogin()},2000);
        globals.music.init(globals.music.defaultUsername);
        globals.menu.changeState(globals.defaultApp);
    }
}