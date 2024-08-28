#!/bin/bash
docker exec -it $(docker ps --filter "ancestor=dttdevelopment_nodejs" -q) sh
