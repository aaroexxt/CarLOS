var utils = {
    socketListener: function(socket,evt) {
        this.debugMode = false;
        if (typeof socket === "undefined") {
            console.error("[UILS] Socket undefined in initialization");
            return "error";
        }
        if (typeof evt === "undefined") {
            console.error("[UILS] Evt undefined in initialization");
            return "error";
        }
        this.listeners = [];
        var _this = this;
        this.recvData = function(data) {
            var dat = JSON.stringify(data);
            if (_this.debugMode) {
                console.log("[UTILS_DEBUG] recvdata socket data: "+((dat.length > 100)?"'data too long to show'":dat)+", list "+JSON.stringify(_this.listeners));
            }
            var nonpersist = [];
            for (var i=0; i<_this.listeners.length; i++) {
                if (_this.listeners[i][0] == data.action || _this.listeners[i][3]) {
                    try {
                        if (_this.listeners[i][2] == false || _this.listeners[i][2] == "false") { //non persistent listener
                            nonpersist.push(i); //push it to nonpersist list to remove it later
                        }
                        _this.listeners[i][1](data); //run function
                    } catch(e) {
                        console.error("[UTILS] Error running function in listenerRecieve, e: "+e);
                    }
                }
            }
            if (_this.debugMode) {
                console.log("[UTILS_DEBUG] nonpersist: "+JSON.stringify(nonpersist));
            }
            for (var i=0; i<nonpersist.length; i++) {
                _this.listeners.splice(nonpersist[i],1);
            }
        }
        this.addListener = function(ev,fn) {
            if (typeof ev !== "string") {
                console.error("[UTILS] AddListener ev type not string");
            } else if (typeof fn !== "function") {
                console.error("[UTILS] AddListener fn type not function");
            } else {
                var ignoreAction = false;
                if (ev == "*") {
                    ignoreAction = true;
                }
                this.listeners[this.listeners.length] = [ev,fn,false,ignoreAction];
            }
        }
        this.addPersistentListener = function(ev,fn) {
            if (typeof ev !== "string") {
                console.error("[UTILS] AddListener ev type not string");
            } else if (typeof fn !== "function") {
                console.error("[UTILS] AddListener fn type not function");
            } else {
                var ignoreAction = false;
                if (ev == "*") {
                    ignoreAction = true;
                }
                this.listeners[this.listeners.length] = [ev,fn,true,ignoreAction];
            }
        }
        socket.on(evt,this.recvData); //set up listener on socket
    }
};