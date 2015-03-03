var request = require('request');

var MetaDataType = {GENERIC: 0, TV_SHOW: 1, MOVIE: 2, MUSIC_TRACK: 3, PHOTO: 4};

var Handler = function(localCast, player, media, callback, next) {
	var fileName = media.metadata.title;
	var match = /(.*?)\.S(\d+)E(\d+)/.exec(fileName) || /(.*?)\.(\d+)x(\d+)/.exec(fileName);

	if (!match) {
		next();
		return;
	}

	var seriesTitle = match[1].replace(/\./g, ' ').replace(/_/g, ' '),
		seasonNumber = match[2],
		episodeNumber = match[3];

	var traktTitle = match[1].replace(/\-/g, '').replace(/\./g, '-').replace(/_/g, '-');

	traktTitle = traktTitle.toLowerCase();

	var intSeason = parseInt(seasonNumber, 10),
		intEpisode = parseInt(episodeNumber, 10);

	var traktUrl = 'http://api.trakt.tv/show/episode/summary.json/' + localCast.config.TRAKT_KEY + '/' + traktTitle + '/' + intSeason + '/' + intEpisode;

	request({url: traktUrl, json: true}, function(error, response, body) {
		if (!error && response.statusCode == 200 && body && (!body.status || body.status != 'failure')) {
			media.metadata.metadataType = MetaDataType.TV_SHOW;

			media.metadata.title = body.show.title + ' - ' + intSeason + 'x' + intEpisode + ' - ' + body.episode.title;
			media.metadata.originalAirdate = body.show.first_aired_iso.substring(0, body.show.first_aired_iso.indexOf('T'));
			media.metadata.seriesTitle = body.show.title;
			media.metadata.season = seasonNumber;
			media.metadata.episode = episodeNumber;
			media.metadata.images = [];

			if ('screen' in body.episode.images) {
				media.metadata.images.push({url: body.episode.images.screen});
			} else {
				media.metadata.images.push({url: body.show.images.poster});
			}
		} else {
			media.metadata.metadataType = MetaDataType.TV_SHOW;

			media.metadata.seriesTitle = seriesTitle;
			media.metadata.title = seriesTitle + ' - ' + seasonNumber + 'x' + episodeNumber;
			media.metadata.season = seasonNumber;
			media.metadata.episode = episodeNumber;
		}

		callback(media);
	});
};

module.exports = Handler;