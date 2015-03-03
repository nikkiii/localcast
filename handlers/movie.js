var omdb = require('omdb');

var MetaDataType = {GENERIC: 0, TV_SHOW: 1, MOVIE: 2, MUSIC_TRACK: 3, PHOTO: 4};

var Handler = function(localCast, player, media, callback, next) {
	var fileName = media.metadata.title;
	var match = /(.*?[ .])(\d{4})[ .a-zA-Z]*(\d{3,4}p)?/.exec(fileName);

	if (!match) {
		next();
		return;
	}

	var name = match[1],
		year = match[2],
		quality = match[3];

	name = name.replace(/\./g, ' ');
	name = name.trim();

	omdb.get({ title : name, year : year }, function(err, movie) {
		if (err) {
			next();
			return;
		}

		media.metadata.metadataType = MetaDataType.TV_SHOW;

		media.metadata.title = movie.title;
		media.metadata.releaseYear = movie.year;

		if ('poster' in movie) {
			media.metadata.images = [
				{ url: movie.poster }
			];
		}

		callback(media);
	});
};

module.exports = Handler;