#!/bin/bash
echo 'Starting Smoke Tests'

count=1
max=10
DTT_IP=`docker inspect -f "{{ .NetworkSettings.Networks.dttdevelopment_default.Gateway }}" $(docker ps --filter "ancestor=dttdevelopment_nginx" -q)`

until $(http_proxy= curl --output /dev/null --silent --head --fail $DTT_IP/authentication/signin); do
    echo -n 'Attempt '$count'/'$max': Waiting for container to come up at '
    echo $DTT_IP/authentication/signin
    sleep 10
    count=`expr $count + 1`
    if [ $count -gt $max ]
    then
        echo "Container didn't come up. Smoke Tests Failed. Exiting..."
        exit 1
    fi
done

# Run Smoke Tests
cd SmokeTests
sudo rm -rf images/
./prepare_db_for_smoke_tests.sh dttdevelopment_default
docker build . -t smoketest --force-rm
docker run --rm -e "HEALTH_CHECK=false" -e "BASE_URL=$DTT_IP" -e "TEST_USERNAME=dttadm100" -e "TEST_PASSWORD=Hilstfsr3v1ZSfQ67H92" -v "$PWD"/images:/opt/SmokeTest/images -v "$PWD"/allure-results:/opt/SmokeTest/allure-results smoketest

if [[ $? -ne 0 ]]
then
    echo 'Smoke tests failed.'
    exit 1
fi
