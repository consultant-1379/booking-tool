#!/bin/sh
npm run develop:client &
npm run develop:server &
while [ ! -f dist/bundle.js ]
do
  sleep 1
done
nodemon --watch dist/bundle.js dist/bundle.js
