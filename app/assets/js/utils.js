var utils = {
    serverResponseHandler: function(baseURL) { //FETCH POLYFILL
        this.debugMode = false;
        this.acceptableHTTPMethods = ["GET", "POST", "PUT", "DELETE"];
        this.acceptableHTTPPrefixes = ["http://","https://"];

        var _this = this;

        if (typeof baseURL === "undefined") {
            return console.error("[UTILS] baseURL undefined in initialization");
        } else {
            let firstChars = baseURL.substring(0,7).toLowerCase();
            if (this.acceptableHTTPPrefixes.indexOf() < 0) {
                //return console.error("[UTILS] Http prefix in ");
            }
            if (this.debugMode) {
                console.log("baseURL: "+baseURL);
            }
            this.baseURL = baseURL;
        }

        this.queryServer = function(urlSuffix, okCallback, errCallback, method) {
            console.log("querying "+urlSuffix)
            if (typeof method !== "string") {
                method = "GET";
            } else if (typeof method !== "function") {
                return console.error("[UTILS] AddListener fn type not function");
            }

            let concisePath = utils.pathJoin([_this.baseURL,urlSuffix]);
            fetch(concisePath, {
                credentials: 'include',
                method: method
            }).then(response => {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        let JSONresponse = response.json();
                        return okCallback(JSONresponse);
                    } catch (e) {
                        let TEXTresponse = response.text();
                        console.log("Response cannot be parsed to json, it will be returned as "+TEXTresponse);
                        return okCallback(TEXTresponse);
                    }
                } else {
                    errCallback(response.statusText);
                }
            }, reason => {
                console.error("Error with request: "+reason)
                errCallback(reason);
            })
        }
    },
    pathJoin: function(parts, sep){
       var separator = sep || '/';
       var replace   = new RegExp(separator+'{1,}', 'g');
       return parts.join(separator).replace(replace, separator);
    }
};