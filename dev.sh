#!/bin/bash
export COMPOSE_PROJECT_NAME="dttdevelopment"
time docker-compose down --volumes
# get ip address of host vm
HOST_IP=$(hostname)

if [[ $? -ne 0 ]]
then
    echo ok
fi

time docker-compose build --build-arg HOST_IP=$HOST_IP
if [[ $? -ne 0 ]]
then
    exit 1
fi
time docker-compose up --force-recreate
if [[ $? -ne 0 ]]
then
    exit 1
fi
