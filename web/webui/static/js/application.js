$(document).ready(function() {
	var states = {
		'fa-play' : 'paused',
		'fa-pause' : 'playing',
		'fa-volume-off' : 'muted',
		'fa-volume-up' : 'unmuted'
	};

	$.fn.extend({
		loadDirectoryList : function(path) {
			currentPath = path;
			var $this = $(this);
			$.get('directory', { path : path }, function(res) {
				$this.html(res);
			});
		},
		mediaState : function(status) {
			var $this = $(this).children('i');
			if (!status) {
				for (var icon in states) {
					if ($this.hasClass(icon)) {
						return states[icon];
					}
				}
				return 'unknown';
			}

			switch (status) {
				case 'paused':
					$this.attr('class', 'fa fa-play');
					break;
				case 'playing':
					$this.attr('class', 'fa fa-pause');
					break;
				case 'stopped':
					$this.attr('class', 'fa fa-stop');
					break;
				case 'muted':
					$this.attr('class', 'fa fa-volume-off');
					break;
				case 'unmuted':
					$this.attr('class', 'fa fa-volume-up');
					break;
				case 'working':
					$this.attr('class', 'fa fa-circle-o-notch fa-spin');
					break;
			}
		}
	});

	var currentPath = '';

	if (location.hash.length > 1) {
		currentPath = location.hash.substring(1);
	}

	$('table > tbody').loadDirectoryList(currentPath);

	$(window).on('hashchange', function() {
		$('table > tbody').loadDirectoryList(window.location.hash.substring(1));
	});

	$('table > tbody').on('click', 'a.directory-link', function(e) {
		e.preventDefault();

		var path = $(this).data('path');

		if ($(this).hasClass('directory-link-parent')) {
			path = path.substring(0, 2) == '//' ? path.substring(1) : path;
		} else {
			path = currentPath + '/' + $(this).data('path');
		}

		path = path.replace(/\/{2,}/, '');

		window.location.hash = path;
	});

	$('table > tbody').on('click', 'a.file-link', function(e) {
		e.preventDefault();

		var name = $(this).text();

		var url = currentPath + '/' + name;

		console.log('Cast ' + url);

		loadMedia(url);
		//alert(currentPath + '/' + name);
	});

	$('#loadurl').click(function() {
		var url = $('input[name=url]').val();

		if (url.length < 1) {
			alert('Invalid url.');
			return;
		}

		loadMedia(url);
	});
});