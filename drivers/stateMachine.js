/*
* stateMachine.js by Aaron Becker
* Manages server state/ modules state
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const RUN_STATES = {
    RUNNING: "running",
    INIT: "init",
    EXITING: "exit",
    ERROR: "error",
    RUNNING_NONETWORK: "running_nonetwork"
}
const MODULE_STATE = {
    UNINITIALIZED: "uninit",
    INIT: "init",
    ERROR: "error",
    REGISTERED_NOINIT: "reg_noinit", //registered with statemachine, but not initialized
    RUNNING: "running",
    DISABLED: "disabled"
}

var stateMachine = {
    modules: {
        arduino: { //here is the state of the module
            name: "arduino",
            state: MODULE_STATE.UNINITIALIZED,
            functions: {
                init: function(){},
                stop: function(){}
            },
            pollRunVar: undefined
        }
    },
    pollers: {
        arduino: undefined //interval where pollrunvar is checked
    },
    registerModule: function(moduleName, moduleInit, moduleStop, moduleRunningPollvar) {
        return new Promise( (resolve, reject) => {
            if (typeof moduleName == "string" && typeof moduleInit == "function" && typeof moduleStop == "function" && typeof moduleRunningPollvar == "boolean") {
                stateMachine.modules[moduleName] = { //this is boilerplate, pls finish
                    name: moduleName,
                    state: MODULE_STATE.UNINITIALIZED,
                    functions: {
                        init: moduleInit,
                        stop: moduleStop
                    },
                    pollRunVar: moduleRunningPollvar
                }
            } else {
                return reject("[STATEMACHINE] Failed to register module with name="+moduleName+" because it is missing an initializer value");
            }
        }
    }
}