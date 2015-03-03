# LocalCast

This is a VERY EARLY version of an app to stream to Chromecast from multiple devices.

LocalCast was created to get around the issue of not having the cast api in Chrome for Android/etc. It currently has 2 different interfaces, the simple web ui or the Strike interface (Android app).

IT DOES NOT AUTOMATICALLY RECONNECT IF THE CHROMECAST GOES OFFLINE! It will only connect on startup currently.

# TODO

1. Keep mdns open and scan for a while/scan at an interval.
2. Allow selection of device from web ui.
3. Reconnect if connection is lost to the Chromecast.
4. HTTP Proxy to support urls with authentication on Chromecast.
5. Better player interface, fix the slider bug on volume.