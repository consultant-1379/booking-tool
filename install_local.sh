#!/bin/bash
export COMPOSE_PROJECT_NAME="dttproduction_local"
time docker-compose -f docker-compose-production-local.yml up --build --force-recreate
