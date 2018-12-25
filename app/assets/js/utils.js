var utils = {
    serverResponseHandler: function(baseURL) { //FETCH POLYFILL
        this.debugMode = false;
        this.acceptableHTTPMethods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];
        this.acceptableHTTPPrefixes = ["http://","https://"];
        this.HTTPprefix = "";
        this.baseURL = "";

        var _this = this;

        if (typeof baseURL === "undefined") {
            return console.error("[UTILS] baseURL undefined in initialization");
        } else {
            let firstChars; //check if http:// or https:// is invalid
            let bURL;
            if (baseURL[4] == "s") {
                firstChars = baseURL.substring(0,6).toLowerCase();
                bURL = baseURL.substring(6);
            } else if (baseURL[4] == ":") {
                firstChars = baseURL.substring(0,7).toLowerCase();
                bURL = baseURL.substring(7);
            } else {
                return console.error("[UTILS] BaseURL invalid HTTP/HTTPS start. BaseURL must start with either https:// or http://");
            }
            if (this.acceptableHTTPPrefixes.indexOf(firstChars) < 0) {
                return console.error("[UTILS] Http prefix ("+firstChars+") is invalid");
            }
            if (this.debugMode) {
                console.log("srh init, baseURL full: "+baseURL+", bURL: "+bURL+", prefix: "+firstChars);
            }
            this.baseURL = bURL;
            this.HTTPprefix = firstChars;
        }

        this.request = function(urlSuffix, method, stripServerRequests) {
            return new Promise( (resolve, reject) => {
                if (_this.debugMode) {
                    console.log("srh querying "+urlSuffix);
                }
                if (typeof method !== "string") {
                    method = "GET";
                } else if (_this.acceptableHTTPPrefixes.indexOf(method.toUpperCase()) < 0) {
                    return reject("HTTP method "+method+" is invalid");
                }
                if (typeof urlSuffix !== "string") {
                    return reject("URLSuffix "+urlSuffix+" is invalid");
                }
                if (typeof stripServerRequests == "undefined") { //decides whether request should strip the header off the server request or nah
                    stripServerRequests = true;
                }

                if (_this.debugMode) {
                    console.log("srh baseurl: "+_this.baseURL+", prefix: "+_this.HTTPprefix+", urlsuffix: "+urlSuffix)
                }
                let concisePath = _this.HTTPprefix+utils.pathJoin([_this.baseURL,urlSuffix]); //allows for trailing slashes to make full url while maintaining integrity of http:// and http:// statements
                if (_this.debugMode) { 
                    console.log("srh concisePath: "+concisePath);
                }
                fetch(concisePath, {
                    credentials: 'include',
                    method: method
                }).then(response => {
                    if (response.status >= 200 && response.status < 300) {
                        if (response.headers.get('Content-Length') == 0) { //did the server return anything? if so no point trying to convert it
                            return resolve("");
                        } else {
                            let TEXTresponse = response.text() //cvt to text
                            .then( text => {
                                text = text.trim();
                                try {
                                    let json = JSON.parse(text); //yay it parses
                                    if (!stripServerRequests || typeof json.error == "undefined" || typeof json.message == "undefined" || typeof json.wait == "undefined") {
                                        return resolve(json); //not from server/don't want parsing so just return
                                    } else {
                                        if (json.error) {
                                            return reject(json);
                                        } else {
                                            let message = json.message;
                                            try {
                                                return resolve(JSON.parse(message));
                                            } catch(e) {
                                                return resolve(message);
                                            }
                                        }
                                    }
                                } catch(e) { //it didn't parse so return it
                                    if (typeof text == "undefined") {
                                        return resolve("");
                                    }
                                    console.log("Response cannot be parsed to json, it will be returned as ",text,"because "+e);
                                    return resolve(text);
                                }
                            })
                        }
                    } else {
                        return reject(response.statusText);
                    }
                }, reason => {
                    reason = reason.toString(); //cvt to string
                    console.error("Error with request (reqok): "+reason);
                    return reject(reason);
                }).catch( error => {
                    error = error.toString();
                    console.error("Error with request (reqNok): "+error);
                    return reject(error);
                })
            });
        }

        //this.requestUntilNoWait //might implement this at some point ig

        this.requestInterval = function (interval, urlSuffix, doneCallback, waitCallback, errCallback, method) {
            if (_this.debugMode) {
                console.log("req interval querying "+urlSuffix+" timeout "+interval);
            }

            if (isNaN(interval)) {
                return console.error("Interval is not a number");
            }

            this.noRequestCount = 0;
            this.maxNoRequest = 5;

            this.interval = setInterval(() => {
                _this.request(urlSuffix, method, false)
                .then(data => { //query the request
                    if (_this.debugMode) {
                        console.log("Data from reqInterval on dom "+urlSuffix+": ",data,data.message)
                    }
                    if (typeof data.message == "undefined" || typeof data.error == "undefined" || typeof data.wait == "undefined") {
                        clearInterval(this.interval); //we can't wait because it wasn't from server
                        try {
                            doneCallback(data);
                        } catch(e) {
                            console.error("Error running doneCallback: "+e);
                        }
                    } else {
                        if (data.wait && !data.error) { //waiting
                            try {
                                waitCallback(data.message);
                            } catch(e) {
                                console.error("Error running waitCallback: "+e);
                            }
                        } else if (!data.wait && !data.error) { //no error
                            clearInterval(this.interval);
                            try {
                                doneCallback(data.message);
                            } catch(e) {
                                console.error("Error running doneCallback: "+e);
                            }
                        } else { //error
                            clearInterval(this.interval);
                            try {
                                errCallback(data);
                            } catch(e) {
                                console.error("Error running errorCallback: "+e);
                            }
                        }
                    }
                })
                .catch(error => {
                    this.noRequestCount++;
                    if (this.noRequestCount>this.maxNoRequest) {
                        console.error("No request got from server or it is null :( (e="+error+")");
                        clearInterval(this.interval);
                        errCallback(data);
                    } else {
                        console.warn("NORQ")
                    }
                });
            }, interval);
        }
    },
    pathJoin: function(parts, sep){
       let separator = sep || '/';
       let replace   = new RegExp(separator+'{1,}', 'g');
       return parts.join(separator).replace(replace, separator);
    }
};