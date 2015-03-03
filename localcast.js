var cast = require('castv2-client'),
	Client = cast.Client,
	DefaultMediaReceiver = cast.DefaultMediaReceiver;

var util = require('util'),
	EventEmitter = require("events").EventEmitter;

var mdns = require('mdns');

var MetaDataType = {GENERIC: 0, TV_SHOW: 1, MOVIE: 2, MUSIC_TRACK: 3, PHOTO: 4};

function LocalCast() {
	this.config = require('./config');
	this.client = null;
	this.player = null;

	this.handlers = [
		require('./handlers/tvseries'),
		require('./handlers/movie'),
		require('./handlers/generic')
	];

	EventEmitter(this);
}

util.inherits(LocalCast, EventEmitter);

// Client stuff

LocalCast.prototype.scan = function(callback) {
	var browser = mdns.createBrowser(mdns.tcp('googlecast'));

	browser.on('error', function(err) {
		browser.stop();

		console.log('mdns error', err);
	});

	browser.on('serviceUp', function(service) {
		console.log('found device "%s" at %s:%d', service.name, service.addresses[0], service.port);
		callback(service.addresses[0]);
		browser.stop();
	});

	browser.start();
};

// Called when we wish to connect to a device.
LocalCast.prototype.connect = function(host) {
	var self = this;

	var client = this.client = new Client();

	client.connect(host, function() {
		self.emit('connected');
	});

	client.on('error', onerror);
	client.client.on('error', onerror);

	function onerror(err) {
		console.log('client error=%s', err.message);

		if (err.message == 'Device timeout' || err.message == 'ETIMEDOUT') {
			self.client = null;
			self.emit('disconnect');
		}
	}

	client.on('disconnect', function() {
		console.log('client disconnected');
		self.emit('disconnect');
	});
};

// Called when we wish to get a player for playback.
LocalCast.prototype.initPlayer = function(callback) {
	var self = this;

	if (this.player) {
		callback(this.player);
		return;
	}

	this.client.launch(DefaultMediaReceiver, function(err, player) {
		self.player = player;

		if (callback) {
			callback(player);
		}

		player.on('status', function(status) {
			self.status(status);

			if (status) {
				console.log('status broadcast playerState=%s', status.playerState);
			}
		});

		player.on('close', function() {
			self.player = null;
			console.log('player closed');
		});
	});
};

LocalCast.prototype.loadMedia = function(mediaUrl, callback) {
	if (!this.client) {
		callback(new Error("Client not initialized"));
		return;
	}

	var fileName = mediaUrl;

	if (fileName.indexOf('/') !== -1) {
		fileName = fileName.substring(mediaUrl.lastIndexOf('/') + 1);
	}

	var self = this;

	var media = {
		contentId: mediaUrl,
		contentType: 'video/mp4',
		streamType: 'BUFFERED', // or LIVE

		// Title and cover displayed while buffering
		metadata: {
			type: 0,
			metadataType: MetaDataType.GENERIC,
			title: fileName
		}
	};

	this.initPlayer(function(player) {
		var loaded = function(media) {
			console.log('Start media');
			// startPlayer will either return currentPlayer or a new player
			player.load(media, { autoplay: true }, function(err, status) {
				self.status(status);

				if (callback) {
					callback(status);
				}
			});
		};

		var chain = new HandlerChain(self.handlers, [ self, player, media, loaded ]);
		chain.next();
	});
};

LocalCast.prototype.getStatus = function(callback) {
	this.player.getStatus(callback);
}

LocalCast.prototype.play = function(callback) {
	if (!this.player) {
		callback(new Error("Player not initialized"));
		return;
	}
	this.player.play(function() {
		if (callback) {
			callback(null);
		}
	});
};

LocalCast.prototype.pause = function(callback) {
	if (!this.player) {
		callback(new Error("Player not initialized"));
		return;
	}
	this.player.pause(function() {
		if (callback) {
			callback(null);
		}
	});
};

LocalCast.prototype.stop = function(callback) {
	if (!this.player) {
		callback(new Error("Player not initialized"));
		return;
	}
	this.player.stop(function() {
		if (callback) {
			callback(null);
		}
	});
};

LocalCast.prototype.mute = function(callback) {
	if (!this.client) {
		callback(new Error("Client not initialized"));
		return;
	}

	var self = this;
	this.client.setVolume({ muted : true }, function() {
		self.emit('mute');

		if (callback) {
			callback(null);
		}
	});
};

LocalCast.prototype.setVolume = function(level, callback) {
	if (!this.client) {
		callback(new Error("Client not initialized"));
		return;
	}

	this.client.setVolume({ level : level / 100}, function() {
		if (callback) {
			callback(null);
		}
	});
};

LocalCast.prototype.volumeUp = function(callback) {
	if (!this.client) {
		callback(new Error("Client not initialized"));
		return;
	}

	var self = this;

	this.client.getVolume(function(err, volume) {
		var level = volume.level * 100;
		level += 10;
		if (level > 100) {
			level = 100;
		}
		self.setVolume(level, callback);
	});
};

LocalCast.prototype.volumeDown = function(callback) {
	if (!this.client) {
		callback(new Error("Client not initialized"));
		return;
	}

	var self = this;

	this.client.getVolume(function(err, volume) {
		var level = volume.level * 100;
		level -= 10;
		if (level < 0) {
			level = 0;
		}
		self.setVolume(level, callback);
	});
};

LocalCast.prototype.seek = function(time, callback) {
	if (!this.player) {
		callback(new Error("Player not initialized"));
		return;
	}

	this.player.seek(time, function() {
		if (callback) {
			callback(null);
		}
	});
};

LocalCast.prototype.checkIdle = function() {
	if (!this.currentStatus && this.player) {
		this.player.close();
	}
};

LocalCast.prototype.status = function(status) {
	var self = this;

	if (status.playerState == 'IDLE') {
		this.currentStatus = null;

		setTimeout(function() {
			self.checkIdle();
		}, 60000);
	} else if (this.currentStatus == null) {
		this.currentStatus = status;
	} else {
		// Set all details
		for (var x in status) {
			this.currentStatus[x] = status[x];
		}
	}

	this.emit('playerStatus', this.currentStatus);
};

// Used for media handlers, allows passing a function to advance to the next handler.
function HandlerChain(handlers, arguments, callback) {
	this.handlers = handlers;
	this.arguments = arguments;
	this.callback = callback;
	this.index = 0;
}

HandlerChain.prototype.next = function() {
	if (this.index < this.handlers.length - 1) {
		var self = this;

		var args = this.arguments.slice();

		args.push(function() {
			self.next();
		});

		this.handlers[this.index++].apply(null, args);
	} else {
		if (this.callback) {
			this.callback.apply(null, this.arguments.slice());
		}
	}
};

module.exports = LocalCast;