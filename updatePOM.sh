#!/bin/sh
# Run this command to update pom.xml with the version in VERSION file
VERSION=`cat VERSION`
echo 'Current version in pom.xml:'
sed -n 7p pom.xml
sed -i "7s/.*/  <version>$VERSION-SNAPSHOT<\/version>/" pom.xml
echo 'New version in pom.xml:'
sed -n 7p pom.xml