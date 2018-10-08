/*
* authentication.js by Aaron Becker
* Script to manage user authentication and API routing for CarOS
* Much love to Evan Gow for his great tutorial at https://medium.com/@evangow/server-authentication-basics-express-sessions-passport-and-curl-359b7456003d
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

//express deps
const express = require("express");
const session = require('express-session');
const FileStore = require('session-file-store')(session);

//create app instance
const app = express();
const server = require('http').Server(app);

//express modules
const finalHandler = require('finalhandler');
const serveFavicon = require('serve-favicon');
const bodyParser = require('body-parser');
const uuid = require('uuid/v4');

//authentication deps
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const CustomStrategy = require('passport-custom').Strategy;

const bcrypt = require('bcrypt');
const fs = require('fs');
//var url = require('url');

var authenticationUtils = {
    init: function(cwd, runtimeSettings) {
        return new Promise( (resolve, reject) => {
            if (typeof runtimeSettings == "undefined" || typeof cwd == "undefined") {
                return reject("[AUTH] RuntimeSettings or CWD undefined");
            } else {
                console.log("[AUTH] Init begun");
                console.log("[AUTH] Initializing modules...");
                authenticationUtils.initModules(cwd, runtimeSettings).then( () => {
                    console.log("[AUTH] Module init OK (1/5)");
                    authenticationUtils.initDB(runtimeSettings).then( () => {
                        console.log("[AUTH] DB init OK (2/5)");
                        authenticationUtils.initStrategies(runtimeSettings).then( () => {
                            console.log("[AUTH] Strategy init OK (3/5)");
                            authenticationUtils.initRoutes(cwd, runtimeSettings).then( () => {
                                console.log("[AUTH] Route init OK (4/5)");
                                authenticationUtils.initServer(runtimeSettings).then( () => {
                                    console.log("[AUTH] Server init OK (5/5)");
                                    return resolve(server); //resolve with server passthrough
                                }).catch( err => {
                                    return reject("[AUTH] Failed to initialize routes because: "+err);
                                })
                            }).catch( err => {
                                return reject("[AUTH] Failed to initialize routes because: "+err);
                            })
                        }).catch( err => {
                            return reject("[AUTH] Failed to initialize strategies because: "+err);
                        })
                    }).catch( err => {
                        return reject("[AUTH] Failed to initialize database because: "+err);
                    })
                }).catch( err => {
                    return reject("[AUTH] Failed to initialize modules because: "+err);
                })
            }
        })
    },

    initRoutes: function(cwd, runtimeSettings) {
        return new Promise( (resolve, reject) => {
            if (typeof runtimeSettings == "undefined" || typeof cwd == "undefined") {
                return reject("[AUTH] RuntimeSettings or CWD undefined");
            } else {
                console.log("[AUTH] Init routes begun");
                app.get("/client", function(req, res) { //COS main route
                    var done = finalHandler(req, res, {
                        onerror: function(err) {
                            console.log("[HTTP] Error: "+err.stack || err.toString())
                        }
                    });

                    fs.readFile(cwd+runtimeSettings.defaultFileDirectory+"/"+runtimeSettings.defaultClientFile, function (err, buf) {
                        if (err) {
                            return done(err);
                        } else {
                            //res.setHeader('Content-Type', 'text/html')
                            res.end(buf);
                        }
                    })
                });

                app.get("/console", function(req, res) { //console route
                    var done = finalHandler(req, res, {
                        onerror: function(err) {
                            console.log("[HTTP] Error: "+err.stack || err.toString())
                        }
                    });

                    res.send("Umm... It's not made yet, so check back later");
                    res.end();
                });

                app.use(function(req, res, next){
                  res.status(404); //crappy 404 page
                  res.send("<h1>Uhoh, you tried to go to a page that doesn't exist.</h1><br> Navigate to /client to go to the main page.");
                });

                return resolve();
            }
        })
    },

    initModules: function(cwd, runtimeSettings) {
        return new Promise( (resolve, reject) => {
            if (typeof runtimeSettings == "undefined" || typeof cwd == "undefined") {
                return reject("[AUTH] RuntimeSettings or CWD undefined");
            } else {
                console.log("[AUTH] Init modules begun");
                app.use(serveFavicon(cwd+runtimeSettings.faviconDirectory)); //serve favicon

                app.use(express.static(cwd+runtimeSettings.assetsDirectory)); //define a static directory

                app.use(bodyParser.urlencoded({ extended: false })) //bodyparser for getting json data
                app.use(bodyParser.json())

                app.use(session({
                    genid: (req) => {
                        console.log('Inside UUID-generation');
                        return uuid(); // use UUIDs for session IDs
                    },
                    store: new FileStore(), //filestore for sessions
                    secret: "k3yB0ARdC@3t5s!", //set secret to new ID
                    resave: false,
                    saveUninitialized: true
                }));

                app.use(passport.initialize()); //passport.js init
                app.use(passport.session());

                /*app.use(function(req, res, next) {
                  if (tooBusyLatestLag > runtimeSettings.tooBusyLagThreshold) {
                    res.send(503, "Server is busy, cannot complete your request at this time. (Latency: "+tooBusyLatestLag+")");
                    res.end();
                  } else {
                    next();
                  }
                });*/

                //TODODODODODODODO FINISH THIS
                app.use(function(req, res, next) { //default listener that sets session values
                    //if (req.session.authenticated)
                    next();
                });

                return resolve();
            }
        })
    },

    initDB: function(runtimeSettings) {
        return new Promise( (resolve, reject) => {
            if (typeof runtimeSettings == "undefined") {
                return reject("[AUTH] RuntimeSettings undefined");
            } else {
                console.log("[AUTH] Init database begun");
                return resolve();
            }
        })
    },

    initStrategies: function(runtimeSettings) {
        return new Promise( (resolve, reject) => {
            if (typeof runtimeSettings == "undefined") {
                return reject("[AUTH] RuntimeSettings undefined");
            } else {
                console.log("[AUTH] Init strategies begun");
                // configure passport.js to use the local strategy
                passport.use(new LocalStrategy(
                  { usernameField: 'name' },
                  (name, password, done) => {
                    console.log('Passport localStrategy found, looking up user w/name: '+name+", passwd: "+password);
                    axios.get(`http://localhost:5000/users?name=${name}`)
                    .then(res => {
                        let user = res.data[0]; //get the first user
                        if (!user) {
                            return done(null, false, { message: 'Invalid credentials (user not found).\n' });
                        } else if (!bcrypt.compareSync(password, user.password)) {
                            return done(null, false, { message: 'Invalid credentials (password invalid).\n' });
                        } else {
                            return done(null, user);
                        }
                    })
                    .catch(error => done(error));
                  }
                ));
                passport.use('openCV', new CustomStrategy( function(req, done) {
                    console.log("DOING CV SHIT");
                    done(null, users[0]);
                }));

                //User serialization and deserialization
                passport.serializeUser((user, done) => {
                    done(null, user.id);
                });

                passport.deserializeUser((id, done) => {
                      axios.get(`http://localhost:5000/users/${id}`)
                      .then(res => done(null, res.data) )
                      .catch(error => done(error, false))
                });
                return resolve();
            }
        })
    },

    initServer: function(runtimeSettings) {
        return new Promise( (resolve, reject) => {
            if (typeof runtimeSettings == "undefined") {
                return reject("[AUTH] RuntimeSettings undefined");
            } else {
                console.log("[AUTH] Init server begun");
                server.listen(runtimeSettings.serverPort, () => {
                    console.log((new Date()) + ' Node server is listening on port ' + runtimeSettings.serverPort);
                    return resolve();
                });
            }
        })
    }
}


module.exports = authenticationUtils;

