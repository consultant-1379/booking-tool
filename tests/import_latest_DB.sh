#!/bin/bash
# This script is used to import and restore the latest backed up data and logging DBs from DTT.
# Note:
# - Has to be run outside the container.
# - To import DBs from a local source: ./import_latest_DB.sh <network_name> local
# - To import DBs from the live tool: ./import_latest_DB.sh <network_name> live

if [[ $2 == "" ]]
then
    echo "You must provide a <source> argument: ./import_latest_DB.sh <network_name> <source>"
    exit -1
fi

LOCATIONS=("/export/BOOKING/mean" "/export/BOOKING/mean_logging")
cd $(dirname $0)
echo "Restoring '$2' DBs."
if [[ $2 == "local" ]]
then
    for LOCATION in "${LOCATIONS[@]}"
    do
        echo "Finding latest backed up Deployment Tracking Tool DB from Local Source in $LOCATION"
        LATEST=`ls -lrt $LOCATION | grep -oe "[0-9]\{14\}" | tail -1`
        echo "Restoring database from $LATEST..."
        .././restore_mongodb_backup.sh "$LOCATION/$LATEST" $1
    done
elif [[ $2 == "live" ]]
then
    for LOCATION in "${LOCATIONS[@]}"
    do
        echo "Finding latest backed up Deployment Tracking Tool DB from the Live Tool in $LOCATION"
        LATEST=`sshpass -pstratus@dmin ssh root@atvdtt.athtem.eei.ericsson.se -oStrictHostKeyChecking=no ls -lrt $LOCATION | grep -oe "[0-9]\{14\}" | tail -1`
        echo "Found $LATEST, copying to local location"
        sshpass -pstratus@dmin scp -r root@atvdtt.athtem.eei.ericsson.se:$LOCATION/$LATEST .
        echo "Restoring database from $LATEST..."
        .././restore_mongodb_backup.sh $PWD"/$LATEST" $1
        echo "Cleaning up DB files and folders..."
        rm -rf $LATEST
    done
else
    echo "Invalid <source> argument. '$2' must be either 'local' or 'live'."
fi
