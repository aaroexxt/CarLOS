var utils = {
    serverResponseHandler: function(baseURL) { //FETCH POLYFILL
        this.debugMode = false;
        this.acceptableHTTPMethods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];
        this.acceptableHTTPPrefixes = ["http://","https://"];
        this.HTTPprefix = "";
        this.baseURL = "";

        this.defaultErrorCallback = function(error) {
            console.error("[UTILS] Error in a request function: '"+error+"' that had no default error callback specified");
        }
        this.defaultOKCallback = function(response) {
            if (_this.debugMode) {
                console.log("[UTILS] Default OK callback since none was specified, response="+response);
            }
        }

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

        this.request = function(urlSuffix, okCallback, errCallback, method) {
            if (_this.debugMode) {
                console.log("srh querying "+urlSuffix);
            }
            if (typeof method !== "string") {
                method = "GET";
            } else if (_this.acceptableHTTPPrefixes.indexOf(method.toUpperCase()) < 0) {
                return console.error("HTTP method "+method+" is invalid");
            }
            if (typeof urlSuffix !== "string") {
                return console.error("URLSuffix "+urlSuffix+" is invalid");
            }
            if (typeof okCallback !== "function") {
                okCallback = _this.defaultOKCallback; //set to default ok callback for fallback
            }
            if (typeof errCallback !== "function") {
                errCallback = _this.defaultErrorCallback; //set to default error callback
            }

            if (_this.debugMode) {
                console.log("srh baseurl: "+_this.baseURL+", prefix: "+_this.HTTPprefix+", urlsuffix: "+urlSuffix)
            }
            let concisePath = _this.HTTPprefix+utils.pathJoin([_this.baseURL,urlSuffix]); //allows for trailing slashes to make full url while maintaining integrity of http:// and http:// statements
            console.log("srh concisePath: "+concisePath);
            fetch(concisePath, {
                credentials: 'include',
                method: method
            }).then(response => {
                if (response.status >= 200 && response.status < 300) {
                    if (response.headers.get('Content-Length') == 0) { //did the server return anything? if so no point trying to convert it
                        return okCallback("");
                    } else {
                        let responseClone = response.clone();
                        let JSONresponse = response.json() //cvt to json
                        .then( json => {
                            return okCallback(json);
                        }).catch(e => {
                            let TEXTresponse = responseClone.text() //need to clone to remove lock
                            .then( text => {
                                if (typeof text == "undefined") {
                                    return okCallback("");
                                }
                                console.log("Response cannot be parsed to json, it will be returned as ",TEXTresponse);
                                return okCallback(TEXTresponse);
                            }).catch(ie => {
                                console.error("Response could not be converted to json or text because: "+ie);
                                return errCallback(ie); //couldn't convert to text or json
                            })
                        });
                    }
                } else {
                    errCallback(response.statusText);
                }
            }, reason => {
                reason = reason.toString(); //cvt to string
                console.error("Error with request (reqok): "+reason);
                errCallback(reason);
            }).catch( error => {
                error = error.toString();
                console.error("Error with request (reqNok): "+error);
                errCallback(error);
            })
        }

        this.requestUntilNoWait

        this.requestInterval = (interval, urlSuffix, doneCallback, waitCallback, errCallback, method) => {
            if (_this.debugMode) {
                console.log("req interval querying "+urlSuffix+" timeout "+interval);
            }

            if (isNaN(interval)) {
                return console.error("Interval is not a number");
            }


            this.interval = setInterval(() => {
                _this.request(urlSuffix, data => { //query the request
                    if (typeof data.wait == "undefined" || typeof data.error == "undefined") {
                        doneCallback(data);
                    } else if (data.wait && !data.error) {
                        waitCallback(data);
                    } else if (!data.wait && !data.error) {
                        doneCallback(data);
                    } else {
                        errCallback(data);
                    }
                }, error => {
                    errCallback(error);
                }, method);
            }, interval);
        }
    },
    pathJoin: function(parts, sep){
       let separator = sep || '/';
       let replace   = new RegExp(separator+'{1,}', 'g');
       return parts.join(separator).replace(replace, separator);
    }
};