#!/bin/bash
docker exec -it $(docker ps --filter "ancestor=dttdevelopment_nodejs" -q) ./tests/styles.sh
docker exec -it $(docker ps --filter "ancestor=dttdevelopment_nodejs" -q) ./tests/server.sh
docker cp dttdevelopment_nodejs_1:/opt/mean.js/coverage .
