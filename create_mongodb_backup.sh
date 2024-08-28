#!/bin/bash
# This script is used to create a backup of the data and logging DBs from DTT.
# Note:
# - To create backup of production DBs, use: ./create_mongodb_backup.sh
# - To create backup of another networks DBs, provide the network name: ./create_mongodb_backup.sh <network_name>

NETWORK=dttproduction_default

BACKUP_ROOT="/export/BOOKING/"
DATABASES=("mean" "mean_logging")

for DATABASE in "${DATABASES[@]}"
do
  BACKUP_DIR=$BACKUP_ROOT$DATABASE/`date "+%Y%m%d%H%M%S"`
  echo "Backing up mongodb $DATABASE database to directory $BACKUP_DIR"
  mkdir -p $BACKUP_DIR
  if [[ $? -ne 0 ]]
  then
    exit 1
  fi
  chmod 777 $BACKUP_DIR
  if [[ $1 != "" ]]
  then
      echo "Creating backup via specified network ($1)"
      NETWORK=$1
  fi
  docker run --rm -v $BACKUP_DIR:/backup --network=$NETWORK armdocker.seli.gic.ericsson.se/dockerhub-ericsson-remote/mongo:4.0.14 mongodump --db=$DATABASE --excludeCollection=sessions --out /backup --host mongodb
done
