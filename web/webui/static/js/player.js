var socket = io();

function loadMedia(mediaUrl) {
	if (!/^http/.test(mediaUrl)) {
		mediaUrl = window.location.origin + '/stream/' + mediaUrl;
	}
	socket.emit('loadMedia', mediaUrl, function(status) {
		timer = setTimeout(updateCurrentTime, 1000);
		$('#ctitle').text(status.media.metadata.title);

		status.lastUpdate = now();

		currentStatus = status;
	});
}

var prevState = 'UNKNOWN';

window.pauseSlider = false;

var currentStatus = null;
var timer = null;

socket.on('playerStatus', function(status) {
	if (status == null) {
		clearTimeout(timer);
		currentStatus = null;
		$('#player').slideUp();
		return;
	}

	status.lastUpdate = now();

	currentStatus = status;

	var state = $('#playpause').mediaState();

	var $player = $('#player');

	if (!$player.is(':visible')) {
		$player.slideDown();
	}

	$('#ctitle').text(status.media.metadata.title);

	if (status.playerState == 'PLAYING' && state == 'paused') {
		$('#playpause').mediaState('playing');
	}

	var $playbackProgress = $('#playback-progress');
	if (status.playerState == 'BUFFERING') {
		$playbackProgress.addClass('progress-bar-striped active');
	} else if ($playbackProgress.hasClass('progress-bar-striped')) {
		$playbackProgress.removeClass('progress-bar-striped active');
	}

	if (!timer) {
		timer = setTimeout(updateCurrentTime, 1000);
	}
});

function updateCurrentTime() {
	if (currentStatus == null) {
		return;
	}

	var cTime = getEstimatedTime();
	var percentage = 100 * cTime / currentStatus.media.duration;

	if (!window.pauseSlider) {
		$('#playback-slider').slider('option', 'now', percentage);
	}

	$('#ctime').text(toHHMMSS(cTime));
	$('#ttime').text(toHHMMSS(currentStatus.media.duration));

	timer = setTimeout(updateCurrentTime, 1000);
}

$('#playpause').click(function(e) {
	e.preventDefault();

	var $playPause = $(this),
		status = $playPause.mediaState();

	$playPause.mediaState('working');

	if (status == 'playing') {
		socket.emit('control', 'pause', function() {
			$playPause.mediaState('paused');
		});
	} else {
		socket.emit('control', 'play', function() {
			$playPause.mediaState('playing');
		});
	}
});

$('#stop').click(function(e) {
	e.preventDefault();

	var $stop = $(this);
	$stop.mediaState('working');

	socket.emit('control', 'stop', function() {
		console.log('stopped');
		$stop.mediaState('stopped');
	});
});

$('#mute').click(function(e) {
	e.preventDefault();

	var $mute = $(this),
		state = $mute.mediaState();

	if (state == 'muted') {
		socket.emit('volume', $('#volume').slider('option', 'now'));
		$mute.mediaState('unmuted');
	} else {
		socket.emit('control', 'mute', function() {
			$mute.mediaState('muted');
		});
	}
});

$('#playback-slider').on('sliderstart', function() {
	window.pauseSlider = true;
});

$('#playback-slider').on('sliderstop', function() {
	window.pauseSlider = false;
});

$('#playback-slider').on('sliderchange', function(e, result) {
	if (result.action == 'drag_stop') {
		socket.emit('seek', result.value * currentStatus.media.duration / 100);
	}
});

$('#volume').on("sliderchange", function(e,result) {
	if (result.action == 'drag_stop') {
		socket.emit('volume', result.value);
	}
});

// This was converted from the Cast extension API.
function getEstimatedTime() {
	if (currentStatus.playerState == 'PLAYING' && 0 <= currentStatus.lastUpdate) {
		// Time since last update
		var a = (now() - currentStatus.lastUpdate) / 1000;
		// currentTime + (playbackRate * timeSinceStart)
		a = currentStatus.currentTime + currentStatus.playbackRate * a;

		if (currentStatus.media && currentStatus.media.duration != null && a > currentStatus.media.duration) {
			a = currentStatus.media.duration;
		}

		0 > a && (a = 0);
		return a;
	}
	return currentStatus.currentTime;
}

function now() {
	return +new Date;
}

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