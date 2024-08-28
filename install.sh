#!/bin/bash
export COMPOSE_PROJECT_NAME="dttproduction"
if [[ $1 == "" ]]
then
    echo "Version not found. Please specify a valid DTT version e.g 0.0.632";
    exit 1
fi
time docker-compose -f docker-compose-production.yml pull
if [[ $? -ne 0 ]]
then
    exit 1
fi
time UPGRADE_VERSION=$1 docker-compose -f docker-compose-production.yml up -d
