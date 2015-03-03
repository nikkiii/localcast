/**
 * Cast initialization timer delay
 **/
var CAST_API_INITIALIZATION_DELAY = 1000;
/**
 * Progress bar update timer delay
 **/
var PROGRESS_BAR_UPDATE_DELAY = 1000;
/**
 * Session idle time out in miliseconds
 **/
var SESSION_IDLE_TIMEOUT = 300000;

var currentMediaSession = null;
var currentVolume = 0.5;
var progressFlag = 1;
var mediaCurrentTime = 0;
var session = null;
var storedSession = null;
var timer = null;

window.pauseSlider = false;

function toHHMMSS(sec_num) {
	sec_num = parseInt(sec_num, 10);
	var hours   = Math.floor(sec_num / 3600);
	var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	var seconds = sec_num - (hours * 3600) - (minutes * 60);

	if (hours   < 10) {hours   = "0"+hours;}
	if (minutes < 10) {minutes = "0"+minutes;}
	if (seconds < 10) {seconds = "0"+seconds;}
	var time = minutes+':'+seconds;

	if (hours > 0) {
		time = hours + ':' + time;
	}
	return time;
}

/**
 * Call initialization
 */
if (!chrome.cast || !chrome.cast.isAvailable) {
	setTimeout(initializeCastApi, CAST_API_INITIALIZATION_DELAY);
}

/**
 * initialization
 */
function initializeCastApi() {
	// auto join policy can be one of the following three
	// 1) no auto join
	// 2) same appID, same URL, same tab
	// 3) same appID and same origin URL
	var autoJoinPolicyArray = [
		chrome.cast.AutoJoinPolicy.PAGE_SCOPED,
		chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED,
		chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
	];

	// request session
	var sessionRequest = new chrome.cast.SessionRequest(chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
	var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
		sessionListener,
		receiverListener,
		autoJoinPolicyArray[1]);

	chrome.cast.initialize(apiConfig, onInitSuccess, onError);
}

/**
 * initialization success callback
 */
function onInitSuccess() {
	console.log('init success');

	// check if a session ID is saved into localStorage
	storedSession = JSON.parse(localStorage.getItem('storedSession'));
	if (storedSession) {
		var dateString = storedSession.timestamp;
		var now = new Date().getTime();

		if (now - dateString < SESSION_IDLE_TIMEOUT) {
			//document.getElementById('joinsessionbyid').style.display = 'block';
		}
	}
}

/**
 * generic error callback
 * @param {Object} e A chrome.cast.Error object.
 */
function onError(e) {
	console.log('Error', e);
}

/**
 * generic success callback
 * @param {string} message from callback
 */
function onSuccess(message) {
	console.log(message);
}

/**
 * callback on success for stopping app
 */
function onStopAppSuccess() {
	console.log('Session stopped');
}

/**
 * session listener during initialization
 * @param {Object} e session object
 * @this sessionListener
 */
function sessionListener(e) {
	console.log('New session ID: ' + e.sessionId);
	session = e;
	if (session.media.length != 0) {
		onMediaDiscovered('sessionListener', session.media[0]);
	}
	session.addMediaListener(onMediaDiscovered.bind(this, 'addMediaListener'));
	session.addUpdateListener(sessionUpdateListener.bind(this));
	// disable join by session id when auto join already
	if (storedSession) {
		//document.getElementById('joinsessionbyid').style.display = 'none';
	}
}

/**
 * session update listener
 * @param {boolean} isAlive status from callback
 * @this sessionUpdateListener
 */
function sessionUpdateListener(isAlive) {
	if (!isAlive) {
		session = null;
		$('#playpause').mediaStatus('play');

		if (timer) {
			clearInterval(timer);
		} else {
			timer = setInterval(updateCurrentTime.bind(this), PROGRESS_BAR_UPDATE_DELAY);
			$('#playpause').mediaStatus('pause');
		}
	}
}

/**
 * receiver listener during initialization
 * @param {string} e status string from callback
 */
function receiverListener(e) {
	if (e === 'available') {
		console.log('receiver found');
	} else {
		console.log('receiver list empty');
	}
}

/**
 * launch app and request session
 */
function launchApp() {
	console.log('launching app...');
	chrome.cast.requestSession(onRequestSessionSuccess, onLaunchError);
	if (timer) {
		clearInterval(timer);
	}
}

/**
 * callback on success for requestSession call
 * @param {Object} e A non-null new session.
 * @this onRequestSesionSuccess
 */
function onRequestSessionSuccess(e) {
	console.log('session success: ' + e.sessionId);
	saveSessionID(e.sessionId);
	session = e;
	session.addUpdateListener(sessionUpdateListener.bind(this));
	if (session.media.length != 0) {
		onMediaDiscovered('onRequestSession', session.media[0]);
	}
	session.addMediaListener(onMediaDiscovered.bind(this, 'addMediaListener'));
}

/**
 * callback on launch error
 */
function onLaunchError() {
	console.log('launch error');
}

/**
 * save session ID into localStorage for sharing
 * @param {string} sessionId A string for session ID
 */
function saveSessionID(sessionId) {
	// Check browser support of localStorage
	if (typeof(Storage) != 'undefined') {
		// Store sessionId and timestamp into an object
		var object = {id: sessionId, timestamp: new Date().getTime()};
		localStorage.setItem('storedSession', JSON.stringify(object));
	}
}

/**
 * join session by a given session ID
 */
function joinSessionBySessionId() {
	if (storedSession) {
		chrome.cast.requestSessionById(storedSession.id);
	}
}

/**
 * stop app/session
 */
function stopApp() {
	session.stop(onStopAppSuccess, onError);
	if (timer) {
		clearInterval(timer);
	}
}

/**
 * load media
 * @param {string} mediaURL media URL string
 * @this loadMedia
 */
function loadMedia(mediaURL) {
	if (!session) {
		console.log('no session');
		return;
	}

	// Match TV Episode if possible.
	var mediaInfo = new chrome.cast.media.MediaInfo(mediaURL);

	var fileName = mediaURL.substring(mediaURL.lastIndexOf('/') + 1);

	var match = /(.*?)\.S(\d+)E(\d+)/.exec(fileName) || /(.*?)\.(\d+)x(\d+)/.exec(fileName);

	if (match) {
		var seriesTitle = match[1].replace(/\./g, ' '),
			seasonNumber = match[2],
			episodeNumber = match[3];

		mediaInfo.metadata = new chrome.cast.media.TvShowMediaMetadata();
		mediaInfo.metadata.metadataType = chrome.cast.media.MetadataType.TV_SHOW;
		mediaInfo.metadata.seriesTitle = seriesTitle;
		mediaInfo.metadata.season = seasonNumber;
		mediaInfo.metadata.episode = episodeNumber;
		mediaInfo.metadata.title = seriesTitle + " S" + match[2] + "E" + match[3];
	} else {
		mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
		mediaInfo.metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
		mediaInfo.metadata.title = fileName;
	}

	mediaInfo.contentType = 'video/mp4';

	var request = new chrome.cast.media.LoadRequest(mediaInfo);
	request.autoplay = true;
	request.currentTime = 0;

	session.loadMedia(request, onMediaDiscovered.bind(this, 'loadMedia'), onMediaError);
}

/**
 * callback on success for loading media
 * @param {string} how info string from callback
 * @param {Object} mediaSession media session object
 * @this onMediaDiscovered
 */
function onMediaDiscovered(how, mediaSession) {
	$('#playerModal').modal('show');
	$('.modal-title').text(mediaSession.media.metadata.title);

	console.log('new media session ID:' + mediaSession.mediaSessionId);
	currentMediaSession = mediaSession;
	currentMediaSession.addUpdateListener(onMediaStatusUpdate);
	mediaCurrentTime = currentMediaSession.currentTime;

	$('#volume').slider('option', 'now', 100 * currentMediaSession.volume.level);

	$('#playpause').mediaState('play');

	if (!timer) {
		timer = setInterval(updateCurrentTime.bind(this), PROGRESS_BAR_UPDATE_DELAY);

		$('#playpause').mediaState('pause');
	}
}

/**
 * callback on media loading error
 * @param {Object} e A non-null media object
 */
function onMediaError(e) {
	console.log('media error');
}

/**
 * get media status initiated by sender when necessary
 * currentMediaSession gets updated
 * @this getMediaStatus
 */
function getMediaStatus() {
	if (!session || !currentMediaSession) {
		return;
	}

	currentMediaSession.getStatus(null, mediaCommandSuccessCallback.bind(this, 'got media status'), onError);
}

/**
 * callback for media status event
 * @param {boolean} isAlive status from callback
 */
function onMediaStatusUpdate(isAlive) {
	if (!isAlive) {
		currentMediaTime = 0;
	} else {
		if (currentMediaSession.playerState == 'PLAYING') {
			if (progressFlag) {
				var percentage = (100 * currentMediaSession.currentTime / currentMediaSession.media.duration);

				if (!pauseSlider) {
					$('#playback-slider').slider('option', 'now', percentage);
				}

				$('#ctime').text(toHHMMSS(currentMediaSession.currentTime));
				$('#ttime').text(toHHMMSS(currentMediaSession.media.duration));
				progressFlag = 0;
			}

			$('#volume').slider('option', 'now', 100 * currentMediaSession.volume.level);

			$('#playpause').mediaState('pause');
		}
	}
}

/**
 * Updates the progress bar shown for each media item.
 */
function updateCurrentTime() {
	if (!session || !currentMediaSession) {
		return;
	}

	if (currentMediaSession.media && currentMediaSession.media.duration != null) {
		var cTime = currentMediaSession.getEstimatedTime();
		var percentage = 100 * cTime / currentMediaSession.media.duration;

		if (!pauseSlider) {
			$('#playback-slider').slider('option', 'now', percentage);
		}

		$('#ctime').text(toHHMMSS(cTime));
		$('#ttime').text(toHHMMSS(currentMediaSession.media.duration));
	} else {
		$('#playback-slider').slider('option', 'now', 0);
		if (timer) {
			clearInterval(timer);
		}
	}
}

/**
 * play media
 * @this playMedia
 */
function playMedia() {
	if (!currentMediaSession) {
		return;
	}

	if (timer) {
		clearInterval(timer);
	}

	var status = $('#playpause').mediaState();

	console.log('Play status:', status);

	if (currentMediaSession.playerState == 'PLAYING') {
		currentMediaSession.pause(null, mediaCommandSuccessCallback.bind(this, 'paused ' + currentMediaSession.sessionId), onError);
		$('#playpause').mediaState('play');
	} else {
		$('#playpause').mediaState('pause');
		currentMediaSession.play(null, mediaCommandSuccessCallback.bind(this, 'resumed ' + currentMediaSession.sessionId), onError);
		timer = setInterval(updateCurrentTime.bind(this), PROGRESS_BAR_UPDATE_DELAY);
	}
}

/**
 * stop media
 * @this stopMedia
 */
function stopMedia() {
	if (!currentMediaSession)
		return;

	currentMediaSession.stop(null, mediaCommandSuccessCallback.bind(this, 'stopped ' + currentMediaSession.sessionId), onError);

	currentMediaSession = null;

	$('#playpause').mediaState('play');

	if (timer) {
		clearInterval(timer);
	}
}

/**
 * set media volume
 * @param {Number} level A number for volume level
 * @param {Boolean} mute A true/false for mute/unmute
 * @this setMediaVolume
 */
function setMediaVolume(level, mute) {
	if (!currentMediaSession)
		return;

	var volume = new chrome.cast.Volume();
	volume.level = level;
	currentVolume = volume.level;
	volume.muted = mute;
	var request = new chrome.cast.media.VolumeRequest();
	request.volume = volume;
	currentMediaSession.setVolume(request, mediaCommandSuccessCallback.bind(this, 'media set-volume done'), onError);
}

/**
 * set receiver volume
 * @param {Number} level A number for volume level
 * @param {Boolean} mute A true/false for mute/unmute
 * @this setReceiverVolume
 */
function setReceiverVolume(level, mute) {
	if (!session)
		return;

	if (!mute) {
		session.setReceiverVolumeLevel(level, mediaCommandSuccessCallback.bind(this, 'media set-volume done'), onError);
		currentVolume = level;
	} else {
		session.setReceiverMuted(true, mediaCommandSuccessCallback.bind(this, 'media set-volume done'), onError);
	}
}

/**
 * mute media
 */
function muteMedia() {
	if (!session || !currentMediaSession) {
		return;
	}

	var state = $('#mute').mediaState();

	// It's recommended that setReceiverVolumeLevel be used
	// but media stream volume can be set instread as shown in the
	// setMediaVolume(currentVolume, true);
	if (state == 'unmuted') {
		setReceiverVolume(currentVolume, true);
		$('#mute').mediaState('muted');
	} else {
		setReceiverVolume(currentVolume, false);
		$('#mute').mediaState('unmuted');
	}
}

/**
 * seek media position
 * @param {Number} pos A number to indicate percent
 * @this seekMedia
 */
function seekMedia(pos) {
	console.log('Seeking ' + currentMediaSession.sessionId + ':' + currentMediaSession.mediaSessionId + ' to ' + pos + '%');
	progressFlag = 0;
	var request = new chrome.cast.media.SeekRequest();
	request.currentTime = pos * currentMediaSession.media.duration / 100;
	currentMediaSession.seek(request, onSeekSuccess.bind(this, 'media seek done'), onError);
}

/**
 * callback on success for media commands
 * @param {string} info A message string
 */
function onSeekSuccess(info) {
	console.log(info);
	setTimeout(function() {
		progressFlag = 1
	}, PROGRESS_BAR_UPDATE_DELAY);
}

/**
 * callback on success for media commands
 * @param {string} info A message string
 */
function mediaCommandSuccessCallback(info) {
	console.log(info);
}
