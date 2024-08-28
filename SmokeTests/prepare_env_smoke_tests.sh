#!/bin/sh
export DISPLAY=:10
pkill Xvfb
Xvfb ${DISPLAY} -ac +iglx -screen 0 1920x1080x24 -nolisten tcp &
pkill dbus-demon
/usr/bin/dbus-daemon --system --nopidfile

if [ "$HEALTH_CHECK" = "true" ]; then
    ./node_modules/.bin/mocha smoke_test.js --grep @healthtest --reporter mocha-multi-reporters --reporter-options configFile=mocha-config.json
else
    ./node_modules/.bin/mocha smoke_test.js --reporter mocha-multi-reporters --reporter-options configFile=mocha-config.json
fi
