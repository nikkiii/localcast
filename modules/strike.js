var express = require('express'),
	fs = require('fs'),
	path = require('path'),
	minimatch = require('minimatch'),
	numeral = require('numeral'),
	moment = require('moment');

var PLAYER_CONFIG = {
	setposcommand : -1,
	setvolumecommand : -2
};

var STATUS_FORMAT = 'OnStatus("[name]", "[state]", [currentTime], "[currentTimestamp]", [duration], "[durationTimestamp]", [muted], [volume], "[file]")';

function mpc_args(contents, args) {
	return contents.replace(/\[([a-zA-Z0-9]+)\]/g, function(match, name) {
		return typeof args[name] != 'undefined' ? args[name] : match;
	});
}

var StrikeModule = function(localCast, app) {
	app.get('/strike/player.html', function(req, res) {
		fs.readFile('./web/strike/static/player.html', 'utf8', function(err, data) {
			res.send(mpc_args(data, PLAYER_CONFIG));
		});
	});

	app.get('/strike/status.html', function(req, res) {
		localCast.getStatus(function(err, status) {
			if (!status) {
				res.send('OnStatus(false, false, false, false, false, false, false, false, false)');
				return;
			}
			var media = status.media;

			var data = {
				name : media.contentId.substring(media.contentId.lastIndexOf('/') + 1),
				state : status.playerState,
				currentTime : parseInt(status.currentTime * 1000),
				currentTimestamp : formatHms(parseInt(status.currentTime)),
				duration : parseInt(status.media.duration * 1000),
				durationTimestamp : formatHms(parseInt(status.media.duration)),
				muted : status.volume.muted ? 1 : 0,
				volume : status.volume.level * 100,
				file : media.contentId
			};

			res.send(mpc_args(STATUS_FORMAT, data));
		});
	});

	app.get('/strike/play.html', function(req, res) {
		if (req.query.path) {
			localCast.loadMedia('http://192.168.1.2:3000/stream/' + req.query.path);
			res.redirect('/strike/index.html');
		}
	});

	app.get('/strike/browser.html', function(req, res) {
		if (!req.query.path) {
			req.query.path = '';
		}

		var base = path.resolve(localCast.config.FILE_PATH + req.query.path);

		if (base.charAt(base.length - 1) != '/') {
			base += '/';
		}

		if (base.indexOf(localCast.config.FILE_PATH) != 0) {
			res.send('Invalid directory: ' + base);
			return;
		}

		fs.readdir(base, function(err, list) {
			if (err) {
				res.send('Unable to load directory: ' + err.toString());
				return;
			}

			var directories = [], files = [];

			for (var i = 0; i < list.length; i++) {
				var f = path.resolve(base, list[i]);

				var stat = fs.lstatSync(f);

				if (stat.isDirectory()) {
					directories.push(list[i]);
				} else if (minimatch(list[i], '*.+(mp4|mp3|webm|bmp|gif|jpg|jpeg|webp|mp3|wav)')) {
					files.push({
						name : list[i],
						size : numeral(stat.size).format('0.000 b'),
						mtime : moment(stat.mtime).fromNow()
					});
				}
			}

			var html = '';

			for (var i = 0; i < directories.length; i++) {
				var directory = directories[i];
				html += '<tr><td class="dirname"><a href="browser.html?path=' + path.relative(localCast.config.FILE_PATH, base + directory) + '">' + directory + '</a></td><td class="dirtype">Directory</td><td class="dirsize">&nbsp;</td><td class="dirdate">&nbsp;</td></tr>';
			}

			for (var i = 0; i < files.length; i++) {
				var file = files[i];
				html += '<tr class="mp4"><td><a href="play.html?path=' + path.relative(localCast.config.FILE_PATH, base + file.name) + '">' + file.name + '</a></td><td><span class="nobr">MP4</span></td><td><span class="nobr">398425K</span></td><td><span class="nobr">2014.03.10 03:06</span></td></tr>';
			}

			var args = {
				currentdir : base,
				currentfiles : html
			};

			fs.readFile('./web/strike/static/browser.html', 'utf8', function(err, data) {
				res.send(mpc_args(data, args));
			});
		});
	});

	// MPC API Endpoint
	app.get('/strike/command.html', function(req, res) {
		if (req.query.wm_command) {
			switch (parseInt(req.query.wm_command)) {
				case -1: // SEEK
					break;
				case -2: // SET VOLUME
					break;
				case 887: // PLAY
					localCast.play();
					break;
				case 888: // PAUSE
					localCast.pause();
					break;
				case 890: // STOP
					localCast.stop();
					break;

				case 907: // VOLUME UP
					localCast.volumeUp();
					break;
				case 908: // VOLUME DOWN
					localCast.volumeDown();
					break;
				case 909: // MUTE
					localCast.mute();
					break;
			}
		}
		res.send('success');
	});

	// Static application path for strike web
	app.use('/strike', express.static('./web/strike/static'));
};

function formatHms(time) {
	// Minutes and seconds
	var mins = ~~(time / 60);
	var secs = time % 60;

// Hours, minutes and seconds
	var hrs = ~~(time / 3600);
	var mins = ~~((time % 3600) / 60);
	var secs = time % 60;

// Output like "1:01" or "4:03:59" or "123:03:59"
	ret = "";

	ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
	ret += "" + mins + ":" + (secs < 10 ? "0" : "");
	ret += "" + secs;
	return ret;
}

module.exports = StrikeModule;