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
    INIT: "init",
    ERROR: "error",
    REGISTERED_NOINIT: "reg_noinit", //registered with statemachine, but not initialized
    RUNNING: "running"
}

var stateMachine = {
    registerModule: function(moduleInit, moduleRunPollvar) {

    }
}