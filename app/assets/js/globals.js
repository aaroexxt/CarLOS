//globals.js? should be modules.js lol
//I'm updating this rn to use a much better "modules" system that will be more efficient

if (typeof utils == "undefined") {
    console.error("utils object undefined, did it load?");
}
const SRH = new utils.serverResponseHandler("http://localhost"); //setup server response handler
SRH.debugMode = false;

const globals = {
    constants: {
        sessionData: undefined,
        readySteps: {
            connectedToServer: false,
            validSession: false,
            pageLoad: true,
            gotRuntimeInformation: false,
            modulesOK: false
        },
        defaultApp: "map",
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
    },
    modules: {
        master: {
            moduleName: "master",
            debugMode: true,

            //STATE MACHINE LOGIC
            realState: "uninit",
            set state(state) { //use getter/setter logic
                if (this.debugMode) {
                    console.log("changing state in module '"+this.moduleName+"' to '"+state+"'");
                }

                if (!this.methods[state]) {
                    console.error("Cannot change state in module name "+this.moduleName+" to new state "+state+" because that method does not exist");
                } else {
                    let prevState = this.realState;
                    try {
                        this.realState = state;
                        this.methods[state](this); //run method exposed in methods
                    } catch(e) {
                        this.realState = prevState;
                        console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                    }
                }
            },
            get state() {
                return this.realState; //return state
            },

            //METHOD LOGIC
            methods: {
                init: function(moduleReference) {
                    moduleReference.state = "checkConnection"; //set state
                    /*Steps to init:
                        first check if we are connected to server.
                        Then get the runtimeInformation/session information and store it
                        After that check each module
                    */
                },
                end: function() {},
                checkConnection: function(moduleReference) {
                    console.log("Master init: begin");
                    console.log("Checking connection to server...");
                    globals.constants.readySteps.connectedToServer = false;
                    globals.constants.readySteps.validSession = false;
                    SRH.request("api/isup")
                    .then(response => {
                        console.log("Successfully connected to server");
                        globals.constants.readySteps.connectedToServer = true;
                        SRH.request("api/session")
                        .then(sessionDat => {
                            console.log("sessionData: "+JSON.stringify(sessionDat));
                            if (sessionDat.id) {
                                globals.constants.readySteps.validSession = true;
                            }
                            globals.constants.sessionData = sessionDat;
                            //change state
                            moduleReference.state = "initializeLoadListener";
                        });
                    })
                    .catch(error => {
                        console.error("Server is not up. Cannot continue with initialization (e="+error+")");
                    })
                },
                initializeLoadListener: function(moduleReference) {
                    //setup vars
                    let loadMessages = document.getElementById(moduleReference.properties.loadMessagesElementName);
                    let readySteps = Object.keys(globals.constants.readySteps);
                    moduleReference.properties.previousReadySteps = JSON.parse(JSON.stringify(globals.constants.readySteps));

                    //setup elements
                    loadMessages.innerHTML = "<h2 style='text-decoration: underline'>Loading Scripts</h2>"; //sets via js to let user know that js works
                    for (var i=0; i<readySteps.length; i++) {
                        var title = document.createElement("h3"); //create h3 tag
                        title.setAttribute("style","display: inline;");
                        var text = document.createTextNode(readySteps[i]+": ");
                        title.appendChild(text);

                        var img = document.createElement("img"); //create image element
                        img.setAttribute("width",String(moduleReference.properties.imageWidth)+"px");
                        img.setAttribute("height",String(moduleReference.properties.imageHeight)+"px");
                        img.setAttribute("id","loadImg"+readySteps[i])
                        if (globals.constants.readySteps[readySteps[i]]) { //dynamically add check or noncheck
                            img.setAttribute("src",moduleReference.properties.imageCheckPath);
                        } else {
                            img.setAttribute("src",moduleReference.properties.imageNoCheckPath);
                        }

                        var br = document.createElement("br");
                        var br2 = document.createElement("br");

                        loadMessages.appendChild(title);
                        loadMessages.appendChild(img);
                        loadMessages.appendChild(br);
                        loadMessages.appendChild(br2);
                    }
                    var progressBar = document.createElement("progress");
                    progressBar.setAttribute("id",moduleReference.properties.loadBarElementName);
                    progressBar.setAttribute("class","loadBar");
                    progressBar.setAttribute("value","0");

                    loadMessages.appendChild(progressBar);

                    moduleReference.state = "initializeModules";
                
                },
                initializeModules: function(moduleReference) {
                    let modules = Object.keys(globals.modules);
                    let requiredProperties = moduleReference.properties.requiredProperties;

                    var modulesOK = true;
                    for (var i=0; i<modules.length; i++) {
                        let moduleName = modules[i];
                        let module = globals.modules[moduleName];
                        if (module == moduleReference) { //don't initialize the master module
                            continue;
                        }
                        console.log("checking module: "+moduleName);

                        var moduleOK = true;
                        for (var j=0; j<requiredProperties.length; j++) {
                            if (!module.hasOwnProperty(requiredProperties[j])) {
                                console.log("Module name '"+moduleName+"' is missing property "+requiredProperties[j]);
                                moduleOK = false;
                                modulesOK = false;
                            }
                        }

                        if (moduleOK) { //module is ok
                            console.log("Initializing module "+moduleName);
                            module.state = "init"; //set state
                        } else {
                            console.warn("Cannot initialize module "+moduleName+" because it is missing properties");
                        }

                    }

                    moduleReference.state = "updateLoadListeners";

                    if (modulesOK || true) { //ADD READTSTEPS
                        globals.constants.readySteps.modulesOK = true;
                    }
                },
                updateLoadListeners: function(moduleReference) {
                    //setup vars
                    let loadMessages = document.getElementById(moduleReference.properties.loadMessagesElementName);
                    let readySteps = Object.keys(globals.constants.readySteps);

                    //actually do the checks
                    let ready = true;
                    var stepsReady = readySteps.length; //represents the steps left before load is ready
                    for (var i=0; i<readySteps.length; i++) {
                        if (!globals.constants.readySteps[readySteps[i]]) { //iterate through readySteps
                            ready = false;
                            stepsReady--;
                        }
                        if (moduleReference.properties.previousReadySteps[readySteps[i]] !== readySteps[readySteps[i]]) {
                            let imageElement = document.getElementById("loadImg"+readySteps[i]);
                            try {
                                if (globals.constants.readySteps[readySteps[i]]) { //dynamically add check or noncheck
                                    imageElement.setAttribute("src",moduleReference.properties.imageCheckPath);
                                } else {
                                    imageElement.setAttribute("src",moduleReference.properties.imageNoCheckPath);
                                }
                            } catch(e) {
                                console.error("Error setting attrib for key "+readySteps[i])
                            }
                        }
                    }
                    document.getElementById(moduleReference.properties.loadBarElementName).value = (stepsReady/readySteps.length);
                    moduleReference.properties.previousReadySteps = JSON.parse(JSON.stringify(globals.constants.readySteps));
                    
                    moduleReference.state = ready ? "pageReady" : "waitLoadListener";
                },
                waitLoadListener: function(moduleReference) {
                    setTimeout( () => {
                        moduleReference.state = "updateLoadListeners";
                    },moduleReference.properties.loadListenerWaitTime);
                },
                pageReady: function(moduleReference) {
                    document.getElementById(moduleReference.properties.loadContainerElementName).style.display = "none";
                    var loaders = document.getElementsByClassName(moduleReference.properties.loadElementClass);
                    for (var i=0; i<loaders.length; i++) {
                        loaders[i].style.display = "none";
                    }
                    document.getElementById(moduleReference.properties.mainElementName).style.display = "block";
                }
            },
            properties: {
                imageCheckPath: "/images/check.png",
                imageNoCheckPath: "/images/nocheck.png",
                imageWidth: 16,
                imageHeight: 16,
                loadBarElementName: "main_loadBar",
                loadListenerWaitTime: 1000,
                mainElementName: "main",
                loadContainerElementName: "loading",
                loadElementClass: "loader",
                loadMessagesElementName: "loadMessages",
                requiredProperties: ["moduleName","debugMode","realState","methods"]
            }
        },
        map: {
            moduleName: "mapping",
            debugMode: true,

            //STATE MACHINE LOGIC
            realState: "uninit",
            set state(state) { //use getter/setter logic
                if (this.debugMode) {
                    console.log("changing state in module '"+this.moduleName+"' to '"+state+"'");
                }

                if (!this.methods[state]) {
                    console.error("Cannot change state in module name "+this.moduleName+" to new state "+state+" because that method does not exist");
                } else {
                    let prevState = this.realState;
                    try {
                        this.realState = state;
                        this.methods[state](this); //run method exposed in methods
                    } catch(e) {
                        this.realState = prevState;
                        console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                    }
                }
            },
            get state() {
                return this.realState; //return state
            },

            //METHOD LOGIC
            methods: {
                init: function(moduleReference) {
                    moduleReference.state = "addLeafletPlugin";
                },
                addLeafletPlugin: function(moduleReference) {
                    L.GridLayer.customGeoRender = L.GridLayer.extend({
                        options: {
                            async: false
                        },

                        initialize: function (options) {
                            L.setOptions(this, options);
                            L.GridLayer.prototype.initialize.call(this, options);
                        },


                        createTile: function (coords) {
                            // create a <canvas> element for drawing
                            var tile = L.DomUtil.create('canvas', 'leaflet-tile');
                            // setup tile width and height according to the options
                            var size = this.getTileSize();
                            tile.width = size.x;
                            tile.height = size.y;
                            // get a canvas context and draw something on it using coords.x, coords.y and coords.z
                            var ctx = tile.getContext('2d');
                            // return the tile so it can be rendered on screen
                            fetch('http://'+window.location.host+'/api/map/annotationTile/'+this.options.layerIndex+"/"+coords.z+'/'+coords.x+"/"+coords.y, {
                                method: 'GET'
                            })
                            .then(response => response.json())
                            .then(response => {
                                if (!response.error && !response.wait) { //ok
                                    var features = response.message ? response.message : [];
                                    console.log(features.length+" feature(s) loaded")
                                    for (var i = 0; i < features.length; i++) {
                                        var feature = features[i];
                                        var text = feature.tags;
                                        this.drawFeature(ctx, feature, text);
                                    }
                                } else if (!response.error) {
                                    console.log("Need to wait for server to be ready before tiles can be fetched...");
                                } else {
                                    if (response.message.indexOf("TileData is null or undefined") < 0) {
                                        console.error("error getting tiledata: "+response.message);
                                    }
                                }
                            })
                            
                            return tile;
                        },


                        drawFeature: function (ctx, feature, text) {
                            var typeChanged = type !== feature.type,
                                type = feature.type;
                            ctx.beginPath();
                            if (this.options.style) this.setStyle(ctx, this.options.style);
                            //console.log(feature.tags)
                            if (type === 2 || type === 3) {
                                for (var j = 0; j < feature.geometry.length; j++) {
                                    var ring = feature.geometry[j];
                                    for (var k = 0; k < ring.length; k++) {
                                        var p = ring[k];
                                        if (k) ctx.lineTo(p[0] / 16.0, p[1] / 16.0);
                                        else ctx.moveTo(p[0] / 16.0, p[1] / 16.0);
                                    }
                                }
                            } else if (type === 1) {
                                for (var j = 0; j < feature.geometry.length; j++) {
                                    var p = feature.geometry[j];
                                    //console.log(p[0]/16, p[1]/16)
                                    ctx.arc(p[0] / 16.0, p[1] / 16.0, 2, 0, Math.PI * 2, true);
                                    if (text && text.name) {
                                        ctx.font="10px Georgia";
                                        ctx.fillStyle = "#000";
                                        //ctx.fillText(text.name, p[0] / 16.0, p[1] / 16.0);
                                        if (this.options.style) this.setStyle(ctx, this.options.style);
                                    }
                                }
                            }
                            if (type === 3) ctx.fill(this.options.style.fillRule || 'evenodd');

                            ctx.stroke();
                        },

                        setStyle: function (ctx, style) {
                            var stroke = style.stroke || true;
                            if (stroke) {
                                ctx.lineWidth = style.weight || 5;
                                var color = this.setOpacity(style.color, style.opacity);
                                ctx.strokeStyle = color;

                            } else {
                                ctx.lineWidth = 0;
                                ctx.strokeStyle = {};
                            }
                            var fill = style.fill || true;
                            if (fill) {
                                ctx.fillStyle = style.fillColor || '#03f';
                                var color = this.setOpacity(style.fillColor, style.fillOpacity);
                                ctx.fillStyle = color;
                            } else {
                                ctx.fillStyle = {};
                            }
                        },

                        setOpacity: function (color, opacity) {
                            if (opacity) {
                                var color = color || '#03f';
                                if (color.iscolorHex()) {
                                    var colorRgb = color.colorRgb();
                                    return "rgba(" + colorRgb[0] + "," + colorRgb[1] + "," + colorRgb[2] + "," + opacity + ")";
                                } else {
                                    return color;
                                }
                            } else {
                                return color;
                            }

                        }
                    })

                    L.gridLayer.customGeoRenderer = function (options) {
                        return new L.GridLayer.customGeoRender(options);
                    };

                    String.prototype.iscolorHex = function () {
                        var sColor = this.toLowerCase();
                        var reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;
                        return reg.test(sColor);
                    }


                    String.prototype.colorRgb = function () {
                        var sColor = this.toLowerCase();
                        if (sColor.length === 4) {
                            var sColorNew = "#";
                            for (var i = 1; i < 4; i += 1) {
                                sColorNew += sColor.slice(i, i + 1).concat(sColor.slice(i, i + 1));
                            }
                            sColor = sColorNew;
                        }
                        var sColorChange = [];
                        for (var i = 1; i < 7; i += 2) {
                            sColorChange.push(parseInt("0x" + sColor.slice(i, i + 2)));
                        }
                        return sColorChange;
                    };

                    //done adding so change state
                    moduleReference.state = "initializeLoad";
                },
                initializeLoad: function(moduleReference) {
                    var loadBar = new ProgressBar.Line(document.getElementById(moduleReference.properties.loadBarElementName), {
                        strokeWidth: 2,
                        easing: 'easeInOut',
                        duration: 1400,
                        color: '#FFEA82',
                        trailColor: '#eee',
                        trailWidth: 1,
                        svgStyle: {width: '100%', height: '100%'},
                        text: {
                            style: {
                              // Text color.
                              // Default: same as stroke color (options.color)
                              color: '#999',
                              position: 'absolute',
                              right: '0',
                              top: '30px',
                              padding: 0,
                              margin: 0,
                              transform: null
                            },
                            autoStyleContainer: false
                        },
                        from: {color: '#FFEA82'},
                        to: {color: '#ED6A5A'},
                        step: (state, bar) => {
                            bar.setText(Math.round(bar.value() * 100) + ' %');
                        }
                    });
                    moduleReference.properties.loadBar = loadBar;

                    moduleReference.state = "createMap";
                },
                createMap: function(moduleReference) {
                    let map = L.map(moduleReference.properties.mapElementName, { //create the map
                        center: [37.57,-122.34],
                        zoom: 13,
                        maxZoom: 15,
                        rotate: true
                    });
                    //L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', {foo: 'bar', attribution: '<a href="http://osm.org/copyright">OpenStreetMap</a>'}).addTo(map);
                    L.tileLayer("http://"+window.location.host+'/api/map/dataTile/{z}/{x}/{y}.png', {foo: 'bar', attribution: '<a href="http://osm.org/copyright">OpenStreetMap</a>'}).addTo(map);

                    moduleReference.properties.mapReference = map;
                    moduleReference.state = "checkMapLoaded";
                },
                checkMapLoaded: function(moduleReference) {
                    new SRH.requestInterval(1000, "/api/map/ready", data => {
                        let layerData = data;
                        if (moduleReference.debugMode) {
                            console.log("Loaded map; rendering");
                            console.log("Creating "+layerData.length+" layer(s) on map...");
                        }
                        for (var i=0; i<layerData.length; i++) {
                            let opts = {
                                layerIndex: layerData[i].index,
                                style: {
                                    fillColor: layerData[i].fillColor,//'#1EB300',
                                    fillOpacity: layerData[i].opacity,
                                    color: layerData[i].strokeColor,
                                    weight: layerData[i].strokeWeight
                                }
                            };
                            let canvasLayer = L.gridLayer.customGeoRenderer(opts).addTo(moduleReference.properties.mapReference);
                            moduleReference.properties.mapCanvasLayers.push(canvasLayer);
                        }
                        moduleReference.state = "mapReady";
                    }, wait => {
                        if (moduleReference.debugMode) {
                            console.log("loading map: "+wait+"%");
                        }
                        moduleReference.properties.loadBar.animate(Number(wait)*0.01);
                    }, error => {
                        console.log("Error loading map: "+error);
                        moduleReference.state = "mapReady";
                    });
                },
                mapReady: function(moduleReference) {
                    let barElement = document.getElementById(moduleReference.properties.loadBarElementName);
                    let containerElement = document.getElementById(moduleReference.properties.loadContainerElementName);
                    let mapElement = document.getElementById(moduleReference.properties.mapElementName);

                    mapElement.style.height = (window.innerHeight-1000)+"px";
                    mapElement.style.opacity = 1;

                    window.addEventListener('resize', () => {
                        document.getElementById(moduleReference.properties.mapElementName).style.height = window.innerHeight+"px";
                    });

                    setTimeout( () => {
                        window.dispatchEvent(new Event('resize'));
                    },100); //workaround to make resize event fire, which somehow fixes the grey map issue. don't ask

                    try {
                        containerElement.parentNode.removeChild(containerElement); //remove loading elem
                    } catch(e) { //swallow error
                        if (moduleReference.debugMode) {
                            console.warn("couldn't delete containerElement; was it already deleted?");
                        }
                    }
                }
            },

            properties: {
                mapElementName: "map_mainMap",
                loadContainerElementName: "map_loadingContainer",
                loadBarElementName: "map_loadBar",
                loadBar: {},
                mapReference: {},
                mapCanvasLayers: []
            }
        },
        music: {
            moduleName: "soundManager",
            debugMode: true,

            //STATE MACHINE LOGIC
            realState: "uninit",
            set state(state) { //use getter/setter logic
                if (this.debugMode) {
                    console.log("changing state in module '"+this.moduleName+"' to '"+state+"'");
                }

                if (!this.methods[state]) {
                    console.error("Cannot change state in module name "+this.moduleName+" to new state "+state+" because that method does not exist");
                } else {
                    let prevState = this.realState;
                    try {
                        this.realState = state;
                        this.methods[state](this); //run method exposed in methods
                    } catch(e) {
                        this.realState = prevState;
                        console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                    }
                }
            },
            get state() {
                return this.realState; //return state
            },

            //METHOD LOGIC
            methods: {
                init: function(mR) {
                    document.getElementById(mR.properties.trackTitleElement).innerHTML = "Server is loading tracks.";

                    var volumeBar = new ProgressBar.Line('#'+mR.properties.volumeBarElement, {
                        strokeWidth: 2,
                        easing: 'easeInOut',
                        duration: 1400,
                        color: '#FFEA82',
                        trailColor: '#eee',
                        trailWidth: 1,
                        svgStyle: {width: '100%', height: '100%'},
                        from: {color: '#39CE3C'},
                        to: {color: '#ED6A5A'},
                        step: (state, bar) => {
                            bar.path.setAttribute('stroke', state.color);
                        }
                    });
                    volumeBar.animate(0);
                    mR.properties.volumeBar = volumeBar;

                    clearInterval(mR.properties.trackDataUpdateTimeout); //in case user is being changed
                    new SRH.requestInterval(1000, "api/SC/clientReady", data => {

                        if (data && data.hasTracks && data.likedTracks.length > 0 && data.trackList.length > 0) { //is the data valid?
                            mR.properties.likedTracks = data.likedTracks;
                            mR.properties.trackList = data.trackList;

                            var sd = data.settingsData;
                            mR.properties.currentUser = sd.currentUser;
                            mR.properties.noArtworkUrl = sd.noArtworkUrl;
                            mR.properties.volStep = sd.volStep;
                            mR.properties.currentVolume = sd.currentVolume;
                            mR.properties.playMusicOnServer = sd.playMusicOnServer;
                            mR.properties.nextTrackShuffle = sd.nextTrackShuffle;
                            mR.properties.soundcloudStatus = sd.soundcloudStatus;
                            mR.properties.nextTrackLoop = sd.nextTrackLoop;
                            mR.properties.tracksFromCache = sd.tracksFromCache;

                            mR.properties.volumeBar.animate(mR.properties.currentVolume/100);

                            if (mR.properties.nextTrackShuffle) { //check if trackShuffle is already set from server
                                document.getElementById(mR.properties.shuffleButtonElement).className+=' activeLoopShuffle';
                            }
                            
                            if (mR.properties.nextTrackLoop) { //check if trackLoop is already set from server
                                document.getElementById(mR.properties.loopButtonElement).className+=' activeLoopShuffle';
                            }
                            console.log("server->client trackLoop:"+mR.properties.nextTrackLoop+",trackShuffle: "+mR.properties.nextTrackShuffle);
                            
                            console.log("Initializing soundcloud");
                            SC.initialize({
                                client_id: data.clientID
                            });

                            if (!mR.properties.currentPlayingTrack) { //only if not playing track so as to not change message
                                document.getElementById(mR.properties.trackTitleElement).innerHTML = "Select a track"; //set tracktitle to simple message
                            }
                            mR.methods.updateTrackList(mR.properties.likedTracks); //update the trackList
                        } else {
                            console.error("Server said that it had tracks but there are no tracks provided (track response may be malformed)");
                        }
                    }, wait => {
                        console.log("Waiting for server to be ready for soundcloud...",wait);
                        document.getElementById(mR.properties.trackAuthorElement).innerHTML = "Loading percent: "+wait.percent;
                    }, error => {
                        console.error("Soundcloud Server Error: "+JSON.stringify(error.message));
                        bootbox.alert("Soundcloud Server Error: "+JSON.stringify(error.message));
                    }, -1);

                    mR.state = "trackDataUpdate";
                },
                updateTrackList: function(tracklist) {
                    var tklElem = document.getElementById(globals.modules.music.properties.trackListElement);
                    tklElem.innerHTML = "";
                    for (var i=0; i<tracklist.length; i++) {
                        var p = document.createElement("p");
                        var txt = document.createTextNode(String(i+1)+"): "+tracklist[i].title);
                        p.setAttribute("onclick","globals.modules.music.methods.playTrackRequested("+JSON.stringify(tracklist[i])+");");
                        p.setAttribute("tabindex","0");
                        p.setAttribute("class","songTitle");
                        p.appendChild(txt);
                        tklElem.appendChild(p);
                    }
                    //globals.music.soundManager.startTrackManager(); //start the manager
                },
                trackDataUpdate: function(mR) {
                    SRH.request("api/SC/clientUpdate").then(data => {
                        //console.log(data.playing)
                        mR.properties.playingTrack = data.playingTrack; //upd playing since it's not in the settings part
                        mR.properties.playingAirplay = data.playingAirplay; //upd playing since it's not in the settings part

                        let mRP = mR.properties;
                        let buttonList = [mRP.shuffleButtonElement, mRP.loopButtonElement, mRP.backButtonElement, mRP.forwardButtonElement, mRP.playPauseButtonElement];

                        if (data.playingAirplay && !data.playingTrack) {
                            for (let i=0; i<buttonList.length; i++) {
                                let elem = document.getElementById(buttonList[i]);
                                if (elem.className.indexOf("disableMenuElement") < 0) {
                                    elem.className += " disableMenuElement";
                                }
                            }
                        } else if (!data.playingAirplay && data.playingTrack) {
                            for (let i=0; i<buttonList.length; i++) {
                                let elem = document.getElementById(buttonList[i]);
                                elem.className = elem.className.replace(new RegExp('(?:^|\\s)'+ 'disableMenuElement' + '(?:\\s|$)'), ' ');
                            }
                        }

                        if (JSON.stringify(mR.properties.oldSettingsData) != JSON.stringify(data.settingsData)) {
                            console.log("DataChange");
                            mR.properties.currentUser = data.settingsData.currentUser;
                            mR.properties.currentVolume = data.settingsData.currentVolume;

                            mR.properties.volumeBar.animate(mR.properties.currentVolume/100);

                            if (mR.properties.oldSettingsData.nextTrackShuffle != data.settingsData.nextTrackShuffle) { //check if the track data has changed and if so update the class
                                mR.properties.nextTrackShuffle = data.settingsData.nextTrackShuffle;
                                if (mR.properties.nextTrackShuffle) {
                                    document.getElementById(mR.properties.shuffleButtonElement).className+=' activeLoopShuffle';
                                } else {
                                    document.getElementById(mR.properties.shuffleButtonElement).className = "controlButton";
                                }
                            }
                            if (mR.properties.oldSettingsData.nextTrackLoop != data.settingsData.nextTrackLoop) {
                                mR.properties.nextTrackLoop = data.settingsData.nextTrackLoop;
                                if (mR.properties.nextTrackLoop) {
                                    document.getElementById(mR.properties.loopButtonElement).className+=' activeLoopShuffle';
                                } else {
                                    document.getElementById(mR.properties.loopButtonElement).className = "controlButton";
                                }
                            }
                            mR.properties.oldSettingsData = data.settingsData; //set old settings data
                        }
                        
                        if (JSON.stringify(mR.properties.currentPlayingTrack) != JSON.stringify(data.currentPlayingTrack)) {
                            console.log("TrackChange");
                            var nTrack = data.currentPlayingTrack;
                            if (nTrack) {
                                mR.properties.currentPlayingTrack = nTrack;
                                document.getElementById(mR.properties.trackArtElement).src = (!nTrack.artwork.artworkUrl) ? mR.properties.noArtworkUrl : "http://"+window.location.host+"/api/sc/trackArt/"+nTrack.id+".jpg";//track.artwork.artworkUrl;
                                document.getElementById(mR.properties.waveformArtElement).src = "http://"+window.location.host+"/api/sc/trackWaveform/"+nTrack.id+".png";
                                document.getElementById(mR.properties.trackTitleElement).innerHTML = nTrack.title;
                                document.getElementById(mR.properties.trackAuthorElement).innerHTML = "By: "+nTrack.author;
                            }
                        }
                    }).catch( err => {
                        console.error("Error getting sound update: "+err);
                    });

                    mR.state = "waitTrackDataUpdate";
                },
                waitTrackDataUpdate: function(mR) {
                    clearInterval(mR.properties.trackDataUpdateTimeout);
                    mR.properties.trackDataUpdateTimeout = setTimeout( () => {
                        mR.state = "trackDataUpdate";
                    }, 1000);
                },


                //TRACK-USER INTERACTION FUNCTIONS
                togglePlayerOutput: function() {
                    return; //deprecated


                    // let mR = globals.modules.music;
                    // if (mR.properties.soundcloudStatus.ready) {
                    //     mR.properties.playMusicOnServer = !mR.properties.playMusicOnServer;
                    //     SRH.request("/api/sc/event/togglePlayerOutput");
                    // }
                },
                changeSoundcloudUser: function() {
                    let mR = globals.modules.music;
                    bootbox.prompt("New soundcloud user? (Enter nothing if you don't want to change users)",function(user) {
                        if (user != "" && typeof user != "undefined" && user != null) {
                            console.log("Changing soundcloud user to: "+user);
                            SRH.request("/api/sc/changeUser/"+user);
                            mR.state = "init"; //reinit
                        }
                    });
                },
                playPauseTrack: function() {
                    SRH.request("/api/sc/event/playPause");
                },
                volUp: function() {
                    SRH.request("/api/sc/event/volumeUp");
                },
                volDown: function() {
                    SRH.request("/api/sc/event/volumeDown");
                },
                backTrack: function() {
                    SRH.request("/api/sc/event/trackBackward");
                },
                forwardTrack: function() { //can go forward one or shuffle to get to next track
                    SRH.request("/api/sc/event/trackForward");
                },
                changeLoopState: function() {
                    let mR = globals.modules.music;
                    mR.properties.nextTrackLoop = !mR.properties.nextTrackLoop;
                    SRH.request("/api/sc/event/changeTrackLoopState");
                },
                changeShuffleState: function() {
                    let mR = globals.modules.music;
                    mR.properties.nextTrackShuffle = !mR.properties.nextTrackShuffle;
                    SRH.request("/api/sc/event/changeTrackShuffleState");
                },
                playTrackRequested: function(track) {
                    let mR = globals.modules.music;
                    
                    SRH.request("/api/sc/event/clientTrackSelected?data="+track.id)
                    .then(data => {
                        mR.properties.currentPlayingTrack = track;
                        document.getElementById(mR.properties.trackArtElement).src = (!track.artwork.artworkUrl) ? mR.properties.noArtworkUrl : "http://"+window.location.host+"/api/sc/trackArt/"+track.id+".jpg";//track.artwork.artworkUrl;
                        document.getElementById(mR.properties.waveformArtElement).src = "http://"+window.location.host+"/api/sc/trackWaveform/"+track.id+".png";
                        document.getElementById(mR.properties.trackTitleElement).innerHTML = track.title;
                        document.getElementById(mR.properties.trackAuthorElement).innerHTML = "By: "+track.author;
                    })
                    .catch(error => {
                        console.error("Couldn't play track: "+error);
                        document.getElementById(mR.properties.trackTitleElement).innerHTML = "";
                        document.getElementById(mR.properties.trackAuthorElement).innerHTML = "Failed to play track because: "+((error.error)?(error.message):error);
                    })

                    /*for local lel
                    try{
                        globals.music.soundManager.playerObject.pause();
                    } catch(e){}
                    */
                }
                
            },

            properties: {
                shuffleButtonElement: "music_shuffleButton",
                loopButtonElement: "music_loopButton",
                trackTitleElement: "music_trackTitle",
                trackArtElement: "music_trackArt",
                waveformArtElement: "music_waveformArt",
                trackListElement: "music_trackList",
                trackAuthorElement: "music_trackAuthor",
                volumeBarElement: "music_bottomVolumeBar",
                backButtonElement: "music_backButton",
                forwardButtonElement: "music_forwardButton",
                playPauseButtonElement: "music_playPauseButton",

                trackDataUpdateTimeout: 0,
                oldSettingsData: {},


                playingTrack: false,
                currentVolume: 50,
                currentPlayingTrack: {},
                playerObject: { //fake so that no errors occur
                    play: function(){},
                    pause: function(){},
                    setVolume: function(){},
                    currentTime: function(){
                        return 0;
                    },
                    getDuration: function(){
                        return 1;
                    }
                }
            }
        },
        runtimeEvents: {
            moduleName: "runtimeEventListener",
            debugMode: true,

            //STATE MACHINE LOGIC
            realState: "uninit",
            set state(state) { //use getter/setter logic
                if (this.debugMode) {
                    console.log("changing state in module '"+this.moduleName+"' to '"+state+"'");
                }

                if (!this.methods[state]) {
                    console.error("Cannot change state in module name "+this.moduleName+" to new state "+state+" because that method does not exist");
                } else {
                    let prevState = this.realState;
                    try {
                        this.realState = state;
                        this.methods[state](this); //run method exposed in methods
                    } catch(e) {
                        this.realState = prevState;
                        console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                    }
                }
            },
            get state() {
                return this.realState; //return state
            },

            //METHOD LOGIC
            methods: {
                init: function(moduleReference) {
                    moduleReference.state = "getRuntimeInformation"; //perform initial fetch
                },
                getRuntimeInformation: function(moduleReference) {
                    if (!moduleReference) { //bck
                        moduleReference = globals.modules.runtimeEvents;
                    }

                    SRH.request("api/runtime")
                    .then(data => {
                        if (moduleReference.debugMode) {
                            console.log("RuntimeInfo: ",data);
                        }

                        globals.constants.readySteps.gotRuntimeInformation = true;
                        var keys = Object.keys(data); //only override keys from jsondat
                        for (var i=0; i<keys.length; i++) {
                            globals.constants.runtimeInformation[keys[i]] = data[keys[i]];
                        }

                        if (typeof globals.constants.runtimeInformation.heartbeatMS == "undefined") {
                            console.warn("HeartbeatMS not defined in globals; not setting timeout");
                        } else {
                            if (moduleReference.debugMode) {
                                console.log("[HB] set heartbeat timeout: "+globals.constants.runtimeInformation.heartbeatMS);
                            }

                            moduleReference.properties.heartbeatMS = Number(globals.constants.runtimeInformation.heartbeatMS)

                        }
                        if (typeof globals.constants.runtimeInformation.outsideTemp == "undefined") {
                            console.warn("OutsideTemp not defined in globals; not setting dashboard extTemp");
                        } else {
                            document.getElementById(moduleReference.properties.externalTempElement).innerHTML = "EXT: "+globals.constants.runtimeInformation.outsideTemp+"°F";
                        }
                        if (typeof globals.constants.runtimeInformation.insideTemp == "undefined") {
                            console.warn("InsideTemp not defined in globals; not setting dashboard intTemp");
                        } else {
                            document.getElementById(moduleReference.properties.internalTempElement).innerHTML = "INT: "+globals.constants.runtimeInformation.insideTemp+"°F";
                        }

                        moduleReference.state = "wait"; //set new state to wait
                    }).catch( err => {
                        console.error("Error fetching runtime information: "+err);
                        moduleReference.state = "wait";
                    })
                },
                wait: function(moduleReference) {
                    clearTimeout(moduleReference.properties.waitTimeout); //clear previous timeout
                    moduleReference.properties.waitTimeout = setTimeout( () => {
                        if (moduleReference.debugMode) {
                            console.log("[HB] Heartbeat request runtimeinfo");
                        }
                        moduleReference.state = "getRuntimeInformation"; //set state
                    },moduleReference.properties.heartbeatMS);
                },
            },
            properties: {
                heartbeatMS: 60000,
                waitTimeout: 0,
                externalTempElement: "extTemp",
                internalTempElement: "intTemp",

            }
        },
        popupDisplay: {
            moduleName: "popupDisplay",
            debugMode: true,

            //STATE MACHINE LOGIC
            realState: "uninit",
            set state(state) { //use getter/setter logic
                if (this.debugMode) {
                    console.log("changing state in module '"+this.moduleName+"' to '"+state+"'");
                }

                if (!this.methods[state]) {
                    console.error("Cannot change state in module name "+this.moduleName+" to new state "+state+" because that method does not exist");
                } else {
                    let prevState = this.realState;
                    try {
                        this.realState = state;
                        this.methods[state](this); //run method exposed in methods
                    } catch(e) {
                        this.realState = prevState;
                        console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                    }
                }
            },
            get state() {
                return this.realState; //return state
            },

            //METHOD LOGIC
            methods: {
                init: function(moduleReference) {}, //no init needed
                displayMain: function(moduleReference) {
                    if (!moduleReference) { //bck
                        moduleReference = globals.modules.popupDisplay;
                    }
                    try {
                        moduleReference.properties.dialogObject.modal('hide');
                    } catch(e){
                        if (moduleReference.debugMode) {
                            console.warn("failed to hide A modal, could still be onscreen");
                        }
                    }

                    moduleReference.properties.dialogObject = bootbox.dialog({
                        message: `
                            <hr class="asep">
                            <img class="asep" src="/images/a.png">
                            <center>
                                <h2>Information</h2>
                                <p>Frontend Version: `+globals.constants.runtimeInformation.frontendVersion+`
                                <br>Backend Version: `+globals.constants.runtimeInformation.backendVersion+`
                                <br>Node.JS Server Connected: `+globals.constants.runtimeInformation.nodeConnected+`
                                <br>Python Backend Connected: `+globals.constants.runtimeInformation.pythonConnected+`
                                <br>Arduino Connected: `+globals.constants.runtimeInformation.arduinoConnected+`
                                <br>Heartbeat Timeout (s): `+(globals.constants.runtimeInformation.heartbeatMS/1000)+`
                                </p>
                                <button onclick="globals.modules.runtimeEvents.methods.getRuntimeInformation(); setTimeout( () => {globals.modules.popupDisplay.methods.displayMain()},300);">Update Runtime Information</button>
                                <br>
                                <h3>Car Stats</h3>
                            </center>
                            <img src="/images/car.png" style="float: left; height: 120px; width: 440px; margin-left: 2%;"></img>
                            <div style="float: left; margin-left: 1%;">
                                <p style="font-size: 18px">
                                    Car Odometer: `+globals.constants.runtimeInformation.odometer+`mi
                                    <br>
                                    Server Status: `+globals.constants.runtimeInformation.status+`
                                    <br>
                                    Server Uptime: `+globals.constants.runtimeInformation.uptime+`
                                    <br>
                                    Users Connected to Server: `+globals.constants.runtimeInformation.users+`
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
                                <h4>A big thanks to Andrew Cummings for the name "CarLOS"</h4>
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
                                    moduleReference.properties.dialogObject.modal('hide');
                                }
                            },
                            advancedSettings: {
                                label: "Advanced",
                                className: "btncenter",
                                callback: function() {
                                    moduleReference.properties.dialogObject.modal('hide');
                                    setTimeout(() => {
                                        moduleReference.state = "displayAdvanced";
                                    }, 300);
                                }
                            }
                        }
                    })
                },
                displayAdvanced: function(moduleReference) {
                    if (!moduleReference) { //bck
                        moduleReference = globals.modules.popupDisplay;
                    }

                    moduleReference.properties.dialogObject = bootbox.dialog({
                        message: `
                            <hr class="asep">
                            <img class="asep" src="/images/a.png">
                            <center>
                                <h2>Advanced Settings</h2>
                                <button disabled onclick="globals.music.togglePlayerOutput();">(BETA): Toggle Music Output</button>
                                <p>Will toggle output of soundcloud playing to be server audio port or client device. Warning: Needs internet if playing on client device. More stable+tested more on server side. (THIS FEATURE IS CURRENTLY DISABLED)</p>
                                <br>
                                <p>Currently playing on: `+((globals.modules.music.properties.playMusicOnServer) ? "server" : "client")+`
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
                                    moduleReference.properties.dialogObject.modal('hide');
                                }
                            },
                            basicSettings: {
                                label: "Back",
                                className: "btncenter",
                                callback: function() {
                                    moduleReference.properties.dialogObject.modal('hide');
                                    setTimeout(() => {
                                        moduleReference.state = "displayMain";
                                    },300);
                                }
                            }
                        }
                    });
                }
            },
            properties: {
                dialogObject: null
            }
        },
        menu: {
            moduleName: "menuManager",
            debugMode: true,

            //STATE MACHINE LOGIC
            realState: "uninit",
            methodArguments: undefined,
            set state(state) { //use getter/setter logic
                if (this.debugMode) {
                    console.log("changing state in module '"+this.moduleName+"' to '"+state+"'");
                }

                if (!this.methods[state]) {
                    console.error("Cannot change state in module name "+this.moduleName+" to new state "+state+" because that method does not exist");
                } else {
                    let prevState = this.realState;

                    try {
                        this.realState = state;
                        if (this.methodArguments) {
                            this.methods[state](this.methodArguments,this);
                            this.methodArguments = undefined;
                        } else {
                            this.methods[state](this);
                        }
                        
                        
                    } catch(e) {
                        this.realState = prevState;
                        console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                    }
                }
            },
            get state() {
                return this.realState; //return state
            },
            set arguments(args) {
                this.methodArguments = args;
            },
            get arguments() {
                return this.methodArguments;
            },

            //METHOD LOGIC
            methods: {
                init: function(moduleReference) {
                    moduleReference.arguments = globals.constants.defaultApp; //set arguments for app
                    moduleReference.state = "changeMenu";
                },
                changeMenu: function(newState,moduleReference) {
                    if (!moduleReference) { //backup moduleRef
                        moduleReference = globals.modules.menu;
                    }

                    
                    var menuStates = Object.keys(moduleReference.properties.states);
                    if (menuStates.indexOf(newState) > -1) {
                        for (var i=0; i<menuStates.length; i++) {
                            moduleReference.properties.states[menuStates[i]] = false; //set key to false
                            var uppercaseKey = (menuStates[i].substring(0,1).toUpperCase()+menuStates[i].substring(1,menuStates[i].length));
                            //console.log("resetting "+uppercaseKey+" elem and button");
                            document.getElementById(moduleReference.properties.menuButtonElement+uppercaseKey).className = "circle"; //reset button className
                            document.getElementById(moduleReference.properties.mainAppElement+uppercaseKey).style.display = "none"; //reset element display
                        }
                        moduleReference.properties.states[newState] = true;
                        var uppercaseState = (newState.substring(0,1).toUpperCase()+newState.substring(1,newState.length));
                        document.getElementById(moduleReference.properties.menuButtonElement+uppercaseState).className += " selected";
                        document.getElementById(moduleReference.properties.mainAppElement+uppercaseState).style.display = "block";


                        if (moduleReference.properties.states.music) { //enable music menu
                            document.getElementById(moduleReference.properties.musicBottomMenuElement).style.display = "block";
                            document.getElementById(moduleReference.properties.secondaryMusicVolumeBar).style.display = "block";
                        } else if (!globals.constants.runtimeInformation.dynamicMusicMenu) { //no dynamic music menu so hide it
                            document.getElementById(moduleReference.properties.musicBottomMenuElement).style.display = "none";
                            document.getElementById(moduleReference.properties.secondaryMusicVolumeBar).style.display = "none";
                        } else {
                            if (!globals.modules.music.properties.playingTrack && !globals.modules.music.properties.playingServer) {
                                document.getElementById(moduleReference.properties.musicBottomMenuElement).style.display = "none";
                                document.getElementById(moduleReference.properties.secondaryMusicVolumeBar).style.display = "none";
                            }
                        }
                        console.log("Menu newState: '"+newState+"'");
                    } else {
                        console.error("NewState for menu switch is invalid");
                    }
                }
            },
            properties: {
                musicBottomMenuElement: "music_bottomMenu",
                secondaryMusicVolumeBar: "music_bottomVolumeBar",
                menuButtonElement: "menuButton",
                mainAppElement: "main",
                states: {
                    music: false,
                    browser: false,
                    stats: false,
                    map: false
                }
            }
        },
        speechManager: {
            moduleName: "speechManager",
            debugMode: true,

            //STATE MACHINE LOGIC
            realState: "uninit",
            set state(state) { //use getter/setter logic
                if (this.debugMode) {
                    console.log("changing state in module '"+this.moduleName+"' to '"+state+"'");
                }

                if (!this.methods[state]) {
                    console.error("Cannot change state in module name "+this.moduleName+" to new state "+state+" because that method does not exist");
                } else {
                    let prevState = this.realState;
                    try {
                        this.realState = state;
                        this.methods[state](this); //run method exposed in methods
                    } catch(e) {
                        this.realState = prevState;
                        console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                    }
                }
            },
            get state() {
                return this.realState; //return state
            },

            //METHOD LOGIC
            methods: {
            },
            properties: {}
        },
        UIIndicators: {
            moduleName: "UIIndicators",
            debugMode: false,

            //STATE MACHINE LOGIC
            realState: "uninit",
            set state(state) { //use getter/setter logic
                if (this.debugMode) {
                    console.log("changing state in module '"+this.moduleName+"' to '"+state+"'");
                }

                if (!this.methods[state]) {
                    console.error("Cannot change state in module name "+this.moduleName+" to new state "+state+" because that method does not exist");
                } else {
                    let prevState = this.realState;
                    try {
                        this.realState = state;
                        this.methods[state](this); //run method exposed in methods
                    } catch(e) {
                        this.realState = prevState;
                        console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                    }
                }
            },
            get state() {
                return this.realState; //return state
            },

            //METHOD LOGIC
            methods: {
                init: function(moduleReference) { //it's okay to do this stuff concurrently because they don't depend on each other
                    moduleReference.state = "initStats";
                    moduleReference.state = "initHUD";
                },
                initStats: function(moduleReference) {
                    if (!Chart || !RadialGauge || !LinearGauge) {
                        console.error("Is Chart.js and Gauges.js installed? Missing some libs");
                        return;
                    }

                    var statsElem = document.getElementById(moduleReference.properties.statsChartElement);
                    var scatterChart = new Chart(statsElem, {
                        responsive: true,
                        maintainAspectRatio: false,
                        type: 'line',
                        data: {
                            datasets: [{
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
                            }]
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

                    var speedGauge = new RadialGauge({
                        width: 300,
                        height: 300,
                        renderTo: document.getElementById(moduleReference.properties.statsSpeedGaugeElement)
                    }).draw();
                    var engineRPMGauge = new RadialGauge({
                        width: 300,
                        height: 300,
                        renderTo: document.getElementById(moduleReference.properties.statsRPMGaugeElement)
                    }).draw();
                    var temperatureGauge = new RadialGauge({
                        renderTo: document.getElementById(moduleReference.properties.statsTempGaugeElement),
                        width: 300,
                        height: 300,
                        units: "°F",
                        title: "Temperature",
                        minValue: -50,
                        maxValue: 50,
                        majorTicks: [
                            -50,
                            -40,
                            -30,
                            -20,
                            -10,
                            0,
                            10,
                            20,
                            30,
                            40,
                            50
                        ],
                        minorTicks: 2,
                        strokeTicks: true,
                        highlights: [
                            {
                                "from": -50,
                                "to": 0,
                                "color": "rgba(0,0, 255, .3)"
                            },
                            {
                                "from": 0,
                                "to": 50,
                                "color": "rgba(255, 0, 0, .3)"
                            }
                        ],
                        ticksAngle: 225,
                        startAngle: 67.5,
                        colorMajorTicks: "#ddd",
                        colorMinorTicks: "#ddd",
                        colorTitle: "#eee",
                        colorUnits: "#ccc",
                        colorNumbers: "#eee",
                        colorPlate: "#222",
                        borderShadowWidth: 0,
                        borders: true,
                        needleType: "arrow",
                        needleWidth: 2,
                        needleCircleSize: 7,
                        needleCircleOuter: true,
                        needleCircleInner: false,
                        animationDuration: 1500,
                        animationRule: "linear",
                        colorBorderOuter: "#333",
                        colorBorderOuterEnd: "#111",
                        colorBorderMiddle: "#222",
                        colorBorderMiddleEnd: "#111",
                        colorBorderInner: "#111",
                        colorBorderInnerEnd: "#333",
                        colorNeedleShadowDown: "#333",
                        colorNeedleCircleOuter: "#333",
                        colorNeedleCircleOuterEnd: "#111",
                        colorNeedleCircleInner: "#111",
                        colorNeedleCircleInnerEnd: "#222",
                        valueBoxBorderRadius: 0,
                        colorValueBoxRect: "#222",
                        colorValueBoxRectEnd: "#333"
                    }).draw();
                },
                updateSpeed: function(moduleReference) {
                    var speedIndicator = document.getElementById(moduleReference.properties.speedIndicatorElement);
                    speedIndicator.innerHTML = moduleReference.properties.connectionSpeed.mbps+" MB/s";

                    moduleReference.state = "waitUpdateSpeed";
                },
                updateTime: function(moduleReference) {
                    var timeIndicator = document.getElementById(moduleReference.properties.timeIndicatorElement);
                    var d = new Date();
                    var o = {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    };
                    var ts = d.toLocaleString('en-US', o);
                    timeIndicator.innerHTML = ts;

                    moduleReference.state = "waitUpdateTime";
                },
                getWifiSpeed: function(moduleReference) {
                    if (!moduleReference) { //bck
                        moduleReference = globals.modules.UIIndicators;
                    }

                    return new Promise( (resolve, reject) => {
                        var imageAddr = "https://aaronbecker.tech/5mb.jpg";
                        var startTime, endTime;
                        var downloadSize = 5245329;
                        var download = new Image();
                        console.log("started download")
                        download.onload = () => {
                            endTime = (new Date()).getTime();
                            var duration = (endTime - startTime) / 1000; //Math.round()
                            var bitsLoaded = downloadSize * 8;
                            var speedBps = (bitsLoaded / duration).toFixed(2);
                            var speedKbps = (speedBps / 1024).toFixed(2);
                            var speedMbps = (speedKbps / 1024).toFixed(2);
                            moduleReference.properties.connectionSpeed.bps = speedBps;
                            moduleReference.properties.connectionSpeed.kbps = speedKbps;
                            moduleReference.properties.connectionSpeed.mbps = speedMbps;
                            resolve(speedMbps);
                        }
                        download.onerror = () => {
                            console.warn("Error getting image to determine wifi speed; are you connected to a network?");
                            moduleReference.properties.connectionSpeed.bps = 0;
                            moduleReference.properties.connectionSpeed.kbps = 0;
                            moduleReference.properties.connectionSpeed.mbps = 0;
                            reject();
                        }
                        startTime = (new Date()).getTime();
                        var cacheBuster = "?nnn=" + startTime;
                        download.src = imageAddr + cacheBuster;
                    });
                },
                updateWifi: function(moduleReference) {
                    var wifiIndicator = document.getElementById(moduleReference.properties.wifiIndicatorElement);
                    var position = 0;
                    var direction = 1;
                    var seek = setInterval(function(){
                        wifiIndicator.src = "/images/wifiL"+position+".png";
                        position+= direction;
                        if (position > 3 || position < 1) {
                            direction*=-1;
                        }
                    },500);
                    moduleReference.methods.getWifiSpeed(moduleReference).then(speed => {
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

                        moduleReference.state = "waitUpdateWifi";
                    })
                    .catch(err => {
                        clearInterval(seek);
                        wifiIndicator.src = "/images/wifiE.png";

                        moduleReference.state = "waitUpdateWifi";
                    })
                },
                initHUD: function(moduleReference) {
                    //SPEED INDICATOR
                    moduleReference.state = "updateSpeed";
                    
                    //TIME
                    moduleReference.state = "updateTime";

                    //WIFI
                    moduleReference.state = "updateWifi";
    
    
                },
                waitUpdateWifi: function(mR) {
                    clearTimeout(mR.properties.wifiUpdateTimeout); //just in case
                    mR.properties.wifiUpdateTimeout = setTimeout( () => {
                        mR.state = "updateWifi";
                    },mR.properties.wifiUpdateTime);
                },
                waitUpdateTime: function(mR) {
                    clearTimeout(mR.properties.timeUpdateTimeout); //just in case
                    mR.properties.timeUpdateTimeout = setTimeout( () => {
                        mR.state = "updateTime";
                    },mR.properties.timeIndicatorUpdateTime);
                },
                waitUpdateSpeed: function(mR) {
                    clearTimeout(mR.properties.speedUpdateTimeout); //just in case
                    mR.properties.speedUpdateTimeout = setTimeout( () => {
                        mR.state = "updateSpeed";
                    },mR.properties.speedIndicatorUpdateTime);
                }
            },
            properties: {
                connectionSpeed: {
                    bps: 0,
                    kbps: 0,
                    mbps: 0
                },
                wifiUpdateTime: 320000, //update every 20 mins (1200000)
                timeIndicatorUpdateTime: 1000,
                speedIndicatorUpdateTime: 1000,
                speedIndicatorElement: "wifispeed",
                wifiIndicatorElement: "wifilevel",
                timeIndicatorElement: "time",

                speedUpdateTimeout: 0, //timeout holders
                wifiUpdateTimeout: 0,
                timeUpdateTimeout: 0,

                statsChartElement: "stats_powerChart",
                statsSpeedGaugeElement: "stats_speedGauge",
                statsRPMGaugeElement: "stats_rpmGauge",
                statsTempGaugeElement: "stats_temperatureGauge"
            }
        },

    },
    masterInit: function() {
        globals.modules.master.state = "init"; //go 4 it
    }
}