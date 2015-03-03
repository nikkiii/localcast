var vidStreamer = require("vid-streamer");

module.exports = function(localCast, app) {
	app.use('/stream', vidStreamer.settings({
		rootFolder : localCast.config.FILE_PATH,
		rootPath : ''
	}));
};