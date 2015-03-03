var fs = require('fs'),
	path = require('path'),
	express = require('express'),
	minimatch = require("minimatch"),
	numeral = require('numeral'),
	moment = require('moment');

module.exports = function(localCast, app) {
	// Serve the static pages
	app.use(express.static('./web/webui/static'));

	// Register jade as our view engine.
	app.set('views', './web/webui/views');
	app.set('view engine', 'jade');

	// Index page
	app.get('/', function(req, res) {
		res.render('index');
	});

	// Called over ajax to show the file list
	app.get('/directory', function(req, res) {
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
						mtime : moment(stat.mtime).fromNow(),
						icon : file_icon(list[i])
					});
				}
			}

			res.render('filelist', { base : base, directories : directories, files : files, path : path });
		});
	});

	// Websocket control
	var io = require('socket.io')(app);

	io.on('connection', function (socket) {
		if (localCast.currentStatus) {
			socket.emit('playerStatus', localCast.currentStatus);
		}

		localCast.on('playerStatus', function(status) {
			socket.emit('playerStatus', status);
		});

		socket.on('loadMedia', function(mediaUrl, fn) {
			localCast.loadMedia(mediaUrl);
		});

		socket.on('control', function(control, fn) {
			switch (control) {
				case 'play':
					localCast.play(fn);
					break;
				case 'pause':
					localCast.pause(fn);
					break;
				case 'stop':
					localCast.stop(fn);
					break;
				case 'mute':
					localCast.mute(fn);
					break;
			}
		});

		socket.on('seek', function(time, fn) {
			localCast.seek(time, fn);
		});

		socket.on('volume', function(level) {
			localCast.setVolume(level);
		});

		socket.on('disconnect', function() {
		});
	});
};

function file_icon(file) {
	var types = {
		"audio" : ["aif","iff","m3u","m4a","mid","mp3","mpa","ra","wav","wma"],
		"video" : ["avi","mkv","3gp","asf","asx","3g2","flv","m4v","mov","mp4","mpg","rm","srt","swf","vob","wmv"],
		"image" : ["gif","jpg","jpeg","png","psd","pspimage","tga","thm","tif","tiff","yuv","svg","bmp","dds"],
		"text" : ["doc","docx","log","msg","odt","pages","rtf","tex","txt","wpd","wps","pdf"],
		"zip" : ["7z","deb","gz","pkg","rar","rpm",".tar.gz","zip","zipx","jar"],
		"disk" : ["bin","cue","dmg","iso","mdf","toast","vcd"],
		"code" : ["java","c","class","pl","py","sh","cpp","cs","dtd","fla","h","lua","m","sln"],
		"excel" : ["xlr","xls","xlsx"]
	};
	var icons = {
		"audio": "fa-file-audio-o",
		"video": "fa-file-video-o",
		"image": "fa-file-image-o",
		"text": "fa-file-text-o",
		"zip": "fa-file-zip-o",
		"disk": "fa-file-zip-o",
		"code": "fa-file-code-o",
		"excel": "fa-file-excel-o",
		"generic": "fa-file-o"
	};

	var ext = path.extname(file).substring(1);

	for (var x in types) {
		if (types[x].indexOf(ext) !== -1) {
			return icons[x];
		}
	}
	return icons['generic'];
}