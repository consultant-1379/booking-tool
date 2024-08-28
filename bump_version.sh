#!/bin/bash
if [ $# -ne 1 ] || ([ $1 != "patch" ] && [ $1 != "minor" ] && [ $1 != "major" ]); then
    echo "Please pass in either patch, minor, or major"
    exit 1;
fi

RELEASE_TYPE=$1

# bump version
docker run --rm -v "$PWD":/app armdocker.seli.gic.ericsson.se/dockerhub-ericsson-remote/treeder/bump $RELEASE_TYPE
