var LocalCast = require('./localcast'),
	localCast = new LocalCast();

var express = require('express'),
	app = express(),
	http = require('http').Server(app);

if (localCast.config.WEB_ENABLED) {
	// Initialize the media web interface
	require('./modules/webui')(localCast, app);
}

// Initialize media streaming module (required)
require('./modules/stream')(localCast, app);

if (localCast.config.STRIKE_ENABLED) {
	// Initialize MPC API module for Strike
	require('./modules/strike')(localCast, app);
}

http.listen(3000);

// Scan and connect to the first chromecast we can.
// TODO automatically scan/scan on command and let them choose a chromecast to use.
localCast.scan(function(service) {
	localCast.connect(service);
});