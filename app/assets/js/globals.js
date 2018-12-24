

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
            modulesOK: false,
            test: false
        }
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
                    let loadMessages = document.getElementById("loadMessages");
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
                    progressBar.setAttribute("id","loadBar");
                    progressBar.setAttribute("class","loadBar");
                    progressBar.setAttribute("value","0");

                    loadMessages.appendChild(progressBar);

                    moduleReference.state = "initializeModules";
                
                },
                initializeModules: function(moduleReference) {
                    let modules = Object.keys(globals.modules);
                    let requiredProperties = ["moduleName","debugMode","realState","methods"];

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

                    if (modulesOK) { //ADD READTSTEPS
                        globals.constants.readySteps.modulesOK = true;
                    }
                },
                updateLoadListeners: function(moduleReference) {
                    //setup vars
                    let loadMessages = document.getElementById("loadMessages");
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
                    ID("loadBar").value = (stepsReady/readySteps.length);
                    moduleReference.properties.previousReadySteps = JSON.parse(JSON.stringify(globals.constants.readySteps));
                    
                    moduleReference.state = ready ? "pageReady" : "waitLoadListener";
                },
                waitLoadListener: function(moduleReference) {
                    setTimeout( () => {
                        moduleReference.state = "updateLoadListeners";
                    },2000);
                },
                pageReady: function(){
                    ID("loading").style.display = "none";
                    var loaders = document.getElementsByClassName("loader");
                    for (var i=0; i<loaders.length; i++) {
                        loaders[i].style.display = "none";
                    }
                    ID("main").style.display = "block";
                }
            },
            properties: {
                imageCheckPath: "/images/check.png",
                imageNoCheckPath: "/images/nocheck.png",
                imageWidth: 16,
                imageHeight: 16,
                loadBarElementName: "main_loadBar"
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
                    var loadBar = new ProgressBar.Line('#'+moduleReference.properties.loadBarElementName, {
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
                    SRH.requestInterval(1000, "/api/map/ready", data => {
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

                    mapElement.style.height = window.innerHeight+"px";
                    mapElement.style.opacity = 1;
                    window.addEventListener('resize', () => {
                        document.getElementById(moduleReference.properties.mapElementName).style.height = window.innerHeight+"px";
                    })

                    containerElement.parentNode.removeChild(containerElement); //remove loading
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
        musicLocal: {
            local: false,
            init: function() {

            }
        },
        musicServer: {
            local: false,
            init: function() {

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
            },
            properties: {}
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
            },
            properties: {}
        },
        menu: {
            moduleName: "menuManager",
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
                init: function(moduleReference) { //it's okay to do this stuff concurrently because they don't depend on each other
                    moduleReference.state = "initStats";
                    moduleReference.state = "initHUD";
                },
                initStats: function(moduleReference) {

                },
                initHUD: function(moduleReference) {
                    globals.modules.runtimeEvents.registerEvent
                }
            },
            properties: {}
        }
    },
    masterInit: function() {
        globals.modules.master.state = "init"; //go 4 it
    }
}