/*
* stateMachine.js by Aaron Becker
* Manages server state
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
var stateMachine = {
    
}