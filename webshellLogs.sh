#!/bin/bash
echo 'Printing DTT NodeJS Live Logs...'
docker logs -f --since 5s $(docker ps --filter "ancestor=dttdevelopment_nodejs" -q)
