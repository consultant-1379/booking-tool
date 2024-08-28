#!/bin/bash
# This script is used to restore a DB Backup for DTT.
# Note:
# - Has to be run outside the container.
# - To restore to production, provide the db folder: ./restore_mongodb_backup.sh <db_folder>
# - To restore to another network, also provide the network name: ./restore_mongodb_backup.sh <db_folder> <network_name>

BACKUP_DIR=$1
NETWORK=dttproduction_default
if [[ $BACKUP_DIR == "" ]] || [[ ! -d $BACKUP_DIR ]]
then
    echo "You must specify a valid directory to restore the database from"
    exit 1
fi
echo "Restoring mongodb database from directory $BACKUP_DIR"
if [[ $2 != "" ]]
then
    echo "Restoring via specified network ($2)"
    NETWORK=$2
fi
docker run --rm -i -v $BACKUP_DIR:/backup --network=$NETWORK armdocker.seli.gic.ericsson.se/dockerhub-ericsson-remote/mongo:4.0.14 mongorestore /backup --host mongodb --drop
