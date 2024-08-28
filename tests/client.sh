#!/bin/sh
pkill Xvfb
Xvfb ${DISPLAY} -ac +iglx -screen 0 1920x1080x24 -nolisten tcp &
pkill dbus-demon
/usr/bin/dbus-daemon --system --nopidfile
npm run test:client
