//GLOBAL VARIABLES
var globals = {
    disconnected: false,
    authkey: "waiting",
    openCVQueue: [],
    loginVideo: ID("loginvideo"),
    MainPopup: {
        dialogObject: null,
        displayMain: function(){
            globals.MainPopup.dialogObject = bootbox.dialog({
                message: `
                    <hr class="asep">
                    <img class="asep" src="images/a.png">
                    <center>
                        <h2>Information</h2>
                        <p>Frontend Version: `+globals.runtimeInformation.frontendVersion+`
                        <br>Backend Version: `+globals.runtimeInformation.backendVersion+`
                        <br>Node.JS Server Connected: `+globals.runtimeInformation.nodeConnected+`
                        <br>Python Backend Connected: `+globals.runtimeInformation.pythonConnected+`
                        <br>Arduino Connected: `+globals.runtimeInformation.arduinoConnected+`
                        <br>Heartbeat Timeout (s): `+(globals.runtimeInformation.heartbeatMS/1000)+`
                        </p>
                        <button onclick="globals.updateRuntimeInformation(); socketListener.addListener('runtimeInformation', function(){globals.MainPopup.dialogObject.modal('hide'); globals.MainPopup.menuOnScreen = false; setTimeout(function(){globals.MainPopup.displayMain()},500);});">Update Runtime Information</button>
                        <br>
                        <h3>Car Stats</h3>
                    </center>
                    <img src="images/car.png" style="float: left; height: 120px; width: 440px; margin-left: 2%;"></img>
                    <div style="float: left; margin-left: 1%;">
                        <p style="font-size: 18px">
                            Car Odometer: `+"a"+`
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
                    }
                }
            })
        }
    },
    updateRuntimeInformation: function() {
        console.log("requesting runtime info")
        socket.emit("GET", {"action": "requestRuntimeInformation"});
        socketListener.addListener("runtimeInformation", function(data) {
            console.log("RuntimeInfo: ",data.information);
            var keys = Object.keys(data.information); //only override keys from jsondat
            for (var i=0; i<keys.length; i++) {
                globals.runtimeInformation[keys[i]] = data.information[keys[i]];
            }
            
        });
        try {
            clearTimeout(globals.runtimeInfoUpdateTimeout);
        } catch(e) {
            console.error("Error clearing global runtime info update timeout")
        }
        if (typeof globals.runtimeInformation.heartbeatMS == "undefined") {
            console.warn("HeartbeatMS not defined in globals; not setting timeout");
        } else {
            console.log("[HB] set heartbeat timeout: "+globals.runtimeInformation.heartbeatMS);
            globals.runtimeInfoUpdateTimeout = setTimeout(function(){
                console.log("[HB] Heartbeat request runtimeinfo");
                globals.updateRuntimeInformation();
            },globals.runtimeInformation.heartbeatMS);
        }
    },
    runtimeInformation: {
        frontendVersion: "? (Should Not Happen)",
        backendVersion: "? (Should Not Happen)",
        nodeConnected: "? (Should Not Happen)",
        pythonConnected: "? (Should Not Happen)",
        arduinoConnected: "? (Should Not Happen)"
    },
    runtimeInfoUpdateTimeout: null,
    loginVideoSnapshot: function() {
        var canvas = ID("loginCanvas");
        var ctx = canvas.getContext('2d');
        canvas.height = globals.loginVideo.videoHeight;
        canvas.width = globals.loginVideo.videoWidth;
        ctx.drawImage(globals.loginVideo, 0, 0, canvas.width, canvas.height);
        var daturl = canvas.toDataURL('image/png');
        /*var raw = datatoraw(daturl);
        var blob = raw.blob;
        var rawdata = raw.rawarr;*/
        socket.emit("GET",{action: "login-imageready", raw: daturl, authkey: globals.authkey});//blob: blob, raw: rawdata});
    },
    loginVideoStream: undefined,
    fadeInOutDelay: 200,
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
                    navigator.geolocation.clearWatch(watchID);
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
        defaultCarImagePath: "images/carinverted.png",
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
            wifiIndicator.src = "images/wifiL"+position+".png";
            position+= direction;
            if (position > 3 || position < 1) {
                direction*=-1;
            }
        },500);
        var wifiPromise = globals.getWifiSpeed();
        wifiPromise.then(function(speed) {
            clearInterval(seek);
            if (speed > 10) {
                wifiIndicator.src = "images/wifi5.png";
            } else if (speed > 5) {
                wifiIndicator.src = "images/wifi4.png";
            } else if (speed > 2) {
                wifiIndicator.src = "images/wifi3.png";
            } else if (speed > 1) {
                wifiIndicator.src = "images/wifi2.png";
            } else {
                wifiIndicator.src = "images/wifi1.png";
            }
        }, function(err) {
            clearInterval(seek);
            wifiIndicator.src = "images/wifiE.png";
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

//LOGIN SETUP SCRIPTS
var login = {
    snapshot: globals.loginVideoSnapshot,
    passcode: function(psc) {
        console.log("psc submit "+psc);
        socket.emit("GET",{action: "login-passcodeready", authkey: globals.authkey, passcode: psc.trim()});
    },
    usingVideo: true,
    passcodeTracker: " ",
    approvedLogin: function(){
        ID("login").className += " fadeout";
        globals.loginVideoStream.getTracks()[0].stop();
        ID("main").className += " fadein";
        var loaders = document.getElementsByClassName("loader");
        for (var i=0; i<loaders.length; i++) {
            loaders[i].style.display = "none";
        }
        // Render KITT's interface
        SpeechKITT.render();
        setTimeout(function(){
            ID("login").style.display = "none";
        },globals.fadeInOutDelay);
    },
    transitionPasscode: function(){
        login.usingVideo = false;
        ID("login-passcode").style.display = "block";
        ID("login-video").className = "fadeout";
        ID("login-passcode").className = "fadein";
        setTimeout(function(){
            ID("login-video").style.display = "none";
        },globals.fadeInOutDelay);
    },
    transitionVideo: function(){
        login.usingVideo = true;
        ID("login-video").style.display = "block";
        ID("login-video").className = "fadein";
        ID("login-passcode").className = "fadeout";
        setTimeout(function(){
            ID("login-passcode").style.display = "none";
        },globals.fadeInOutDelay);
    },
    pageReady: function(){
        globals.loginVideoSnapshot();
        ID("loading").style.display = "none";
        var loaders = document.getElementsByClassName("loader");
        for (var i=0; i<loaders.length; i++) {
            loaders[i].style.display = "none";
        }
        ID("login").style.display = "block";
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
            login.loadedOnce = true;
            login.previousReadySteps = JSON.parse(JSON.stringify(login.readySteps));
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
        } else {
            var ready = true;
            for (var i=0; i<keys.length; i++) {
                if (!login.readySteps[keys[i]]) {
                    ready = false;
                }
                if (login.previousReadySteps[keys[i]] !== login.readySteps[keys[i]]) {
                    var img = ID("loadImg"+keys[i]);
                    if (login.readySteps[keys[i]]) { //dynamically add check or noncheck
                        img.setAttribute("src",login.imageCheckPath);
                    } else {
                        img.setAttribute("src",login.imageNoCheckPath);
                    }
                }
            }
            login.previousReadySteps = JSON.parse(JSON.stringify(login.readySteps));
            if (ready) {
                login.pageReady();
                clearInterval(login.readyUpdater);
            }
        }
    },200),
    imageCheckPath: "images/check.png",
    imageNoCheckPath: "images/nocheck.png",
    imageWidth: 16,
    imageHeight: 16,
    passcodeUpdate: function(){
        ID("login-passcodeField").innerHTML = login.passcodeTracker;
    },
    initializeMap: function(){
        login.readySteps.internetConnected = true;
        globals.map.mapReference = new google.maps.Map(ID('mainMap'), { //setup map
            zoom: globals.map.defaultZoom,
            center: globals.map.locations.burlingame,
            gestureHandling: globals.map.defaultMapGestureHandling,
            styles: (globals.map.grayScaleEnabled)?[{featureType:"landscape",stylers:[{saturation:-100},{lightness:65},{visibility:"on"}]},{featureType:"poi",stylers:[{saturation:-100},{lightness:51},{visibility:"simplified"}]},{featureType:"road.highway",stylers:[{saturation:-100},{visibility:"simplified"}]},{featureType:"road.arterial",stylers:[{saturation:-100},{lightness:30},{visibility:"on"}]},{featureType:"road.local",stylers:[{saturation:-100},{lightness:40},{visibility:"on"}]},{featureType:"transit",stylers:[{saturation:-100},{visibility:"simplified"}]},{featureType:"administrative.province",stylers:[{visibility:"off"}]/**/},{featureType:"administrative.locality",stylers:[{visibility:"off"}]},{featureType:"administrative.neighborhood",stylers:[{visibility:"on"}]/**/},{featureType:"water",elementType:"labels",stylers:[{visibility:"on"},{lightness:-25},{saturation:-100}]},{featureType:"water",elementType:"geometry",stylers:[{hue:"#ffff00"},{lightness:-25},{saturation:-97}]}]:[],
            mapTypeId: 'hybrid'
        });

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
    }, initialize: function() {
        setInterval(function(){ //validate key listener
            socket.emit('GET', {action: "validatekey", authkey: globals.authkey})
            socketListener.addListener("validatekey",function (data){
                console.log("Authkey valid?: "+data.valid);
                if (data.valid == "false" && globals.authkey != "") {
                    console.error("Authkey invalid");
                    /*if (confirm("Authkey has expired. Reload page?")) {
                        window.location.reload();
                    }*/
                    window.location.reload();
                } else if (data.valid == "false") {
                    console.log("Still waiting on python for valid authkey, not prompting user");
                    //alert("Python is not initialized, waiting for authkey from server...")
                }
            })
        }, 25000);

        setTimeout(function(){
            globals.initWifiIndicator("wifilevel"); //init wifi, time and map
        }, globals.delayWifiTime);
        globals.initSpeedIndicator("wifispeed");
        globals.initTimeIndicator("time");
        login.initializeMap();
        setTimeout(function(){
            globals.updateRuntimeInformation();
            globals.MainPopup.displayMain();
        },2000);

        /*setTimeout(function(){
            login.approvedLogin();
        },2000);*/
    }
}