#!/bin/bash
# Script used to backup MongoDB data and logging DBs from DTT
# To be run nightly at 11pm via crontab entry
# 0 23 * * * /booking-tool/booking-tool/backup_retention_policy.sh

LOCATIONS=(/export/BOOKING/mean /export/BOOKING/mean_logging)

for LOCATION in "${LOCATIONS[@]}"
do
  TODAYS_BACKUPS=$LOCATION/`date "+%Y%m%d"`
  RENTENTION_PERIOD=$((30*24*60)) #30 days
  echo "Performing daily backup of mongoDB database to $TODAYS_BACKUPS.zip"
  zip -r $TODAYS_BACKUPS $TODAYS_BACKUPS*
  if [[ $? -ne 0 ]]
  then
    exit 1
  fi
  echo "Removing hourly backup folders as they are no longer needed."
  rm -rf $TODAYS_BACKUPS*/
  echo "Removing backups older than 30 days from $LOCATION."
  find $LOCATION -name "*.zip" -type f -mmin +$RENTENTION_PERIOD | xargs rm -rf
done

echo "Remove dangling Docker networks, containers and images..."
docker system prune -af
