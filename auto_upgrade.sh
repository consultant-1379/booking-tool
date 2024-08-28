#!/bin/bash
#To upgrade production DTT to a specific version, run ./auto_upgrade.sh <version>
#Example:
#./auto_upgrade.sh 0.0.632

UPGRADE_VERSION=$1

echo "Stopping Grafana and Prometheus containers";
cd ../dockprom
docker-compose down

echo "Going back to DTT folder";
cd ../booking-tool

echo "Checking out the latest DTT code...";
git checkout -f master
git reset --hard origin/master
git pull -f

TAG=`git tag -l booking-tool-$UPGRADE_VERSION`
if [[ $UPGRADE_VERSION == "" ]] || [[ $TAG == "" ]]
then
    echo "Version incorrect or not found. Please specify a valid DTT version e.g 0.0.632";
    exit 1
else
    echo "Running git checkout -f "$TAG;
    git checkout -f $TAG
fi

read -p "Are you sure you want to upgrade DTT to $UPGRADE_VERSION (Y/N)?" -n 1 -r
echo #move to a new line
if [[ $REPLY =~ ^[Y]$ ]]
then
    echo "Performing DTT upgrade...";
    cp SmokeTests/.env .
    ./upgrade.sh $UPGRADE_VERSION
    if [[ $? -ne 0 ]]
    then
        echo "DTT upgrade failed.";
    else
        echo "DTT upgrade complete.";
        echo "Starting Grafana and Prometheus containers";
        cd ../dockprom
        docker-compose up -d
    fi
else
    echo "DTT upgrade cancelled.";
fi

echo "Remove dangling Docker networks, containers and images..."
docker system prune -af
