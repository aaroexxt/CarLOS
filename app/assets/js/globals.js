

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
            validSession: false
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
                    console.log("changing state in module "+this.moduleName+" to "+state);
                }
                let prevState = this.realState;
                try {
                    this.realState = state;
                    this.methods[state](); //run method exposed in methods
                } catch(e) {
                    this.realState = prevState;
                    console.error("Error changing state in module name "+this.moduleName+" to new state "+state+" because '"+e+"'");
                }
            },
            get state() {
                return this.realState; //return state
            },

            //METHOD LOGIC
            methods: {
                init: function() {
                    this.state = "checkConnection"; //set state
                    /*Steps to init:
                        first check if we are connected to server.
                        Then get the runtimeInformation/session information and store it
                        After that check each module
                    */
                },
                checkConnection: function() {
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
                        });
                        
                        //change state
                        this.state = "initializeModules";
                    })
                    .catch(error => {
                        console.error("Server is not up. Cannot continue with initialization (e="+error+")");
                    })
                },
                initializeModules: function() {
                    let modules = Object.keys(globals.modules);
                    let requiredProperties = ["moduleName","debugMode","realState","methods","properties"];

                    var modulesOK = true;
                    for (var i=0; i<modules.length; i++) {
                        let moduleName = modules[i];
                        let module = globals.modules[moduleName];
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

                    if (modulesOK) {
                        this.state = "";
                    }
                }
            },

            //PROPERTIES
            properties: {

            }
        }
        map: {
            init: function() {

            }
        },
        music: {
            local: false,
            init: function() {

            }
        }
    },
    masterInit: function() {
        globals.modules.master.state = "init"; //go 4 it
    }
}