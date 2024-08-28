# Deployment Tracking Tool #

The DTT is primarily used to provide an inventory system that catalogues each Deployment, Product, Hardware and All other associated artifacts within a single page web application

More information on DTT available: https://atvdtt.athtem.eei.ericsson.se/helpdocs/#help/app/helpdocs

# Prerequisites #

## Setting up WSL2 on Windows ##

* If working from Windows Environment, WSL2 should be set up
* Steps can be found through this link: https://eteamspace.internal.ericsson.com/display/TST/Docker+on+Windows+10

# .env Variables #

Before running the project in development mode, the .env file is required at the root of the project directory with the following contents:
NOTE: set ISTEST to blank 'ISTEST=', when running locally for development (./dev.sh)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
LDAP_URL=LDAPS://ldap-egad.internal.ericsson.com:3269
BASE_DN_LIST=OU=CA,OU=User,OU=P001,OU=ID,OU=Data,DC=ericsson,DC=se:OU=External,OU=P017,OU=ID,OU=Data,DC=ericsson,DC=se:OU=CA,OU=SvcAccount,OU=P001,OU=ID,OU=Data,DC=ericsson,DC=se:OU=P010,OU=ID,OU=Data,DC=ericsson,DC=se
SEARCH_FILTER=(name={{username}})
DTT_USERNAME=DTTADM100
DTT_PASSWORD=
DTT_EMAIL_ADDRESS=no-reply-dtt@ericsson.com
DTT_EMAIL_PASSWORD=
TEAM_EMAIL=PDLCIINFRA@pdl.internal.ericsson.com
DTT_URL=atvdtt.athtem.eei.ericsson.se
JIRA_URL=jira-oss.seli.wh.rnd.internal.ericsson.com
JIRA_URL_ETEAMS=eteamproject.internal.ericsson.com
JIRA_PREFIX_ETEAMS=GTEC,STSOSS
CI_PORTAL_URL=ci-portal.seli.wh.rnd.internal.ericsson.com
TEAM_INVENTORY_TOOL_URL=https://pdu-oss-tools1.seli.wh.rnd.internal.ericsson.com/team-inventory
UPGRADE_TOOL_URL=http://atvts2716.athtem.eei.ericsson.se
ISTEST=test
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

# Docker Permissions #

To run Docker commands without the need for 'sudo' follow this link: https://docs.docker.com/engine/install/linux-postinstall/.

# Deployment #

* To get the local IP address: `hostname -I`

* Run dev.sh:
 - Navigate to repo directory: `cd /booking-tool`
 - Run the script: `./dev.sh`

* Open a web browser, navigate to 'localhost' or <local_ip_address>

* To stop the tool: press Ctrl+C in the terminal that `dev.sh` was executed

# Import the latest DB #
 - Navigate to directory: `cd tests`
 - To get the local source network name: `docker network ls`
 - To import DBs from a local source: `./import_latest_DB.sh <network_name> local` e.g. `./import_latest_DB.sh dttdevelopment_default local`
 - To import DBs from the live tool: `./import_latest_DB.sh <network_name> live` e.g. `./import_latest_DB.sh dttdevelopment_default live`

# Running the tests #

## Smoke Tests ##

* With tool running, execute: `./smoke_tests_on_dev.sh`
* Without tool running, execute: `./smokeTests.sh`

## Linting and Unit Tests ##

* In a seperate terminal (whilst DTT is running) execute: `./webshellTests.sh`

* To run only Server or Linting tests,
 - Execute `./webshell.sh`
 - Execute `./tests/server.sh` or `./tests/styles.sh`

* To run a single test,
 - add '.only' in front of 'describe' block or 'it' single test case in 'booking-tool/SmokeTests/smoke_test.js' file

# Production Mode #

* To launch production mode locally using
 - (Optional) Setup SSL Certs:[link](https://eteamspace.internal.ericsson.com/display/ENTT/CI+Infra+-+OQS+-+SSL+Certificate+Local+Setup)
 - Execute `./install_local.sh`

* Main Production: Execute `./install.sh <DTT version to install>`

# Change Log #

Change Log link:
- Newer (six months worth using date range): https://arm1s11-eiffel004.eiffel.gic.ericsson.se:8443/nexus/content/sites/tor/booking-tool/latest/changelog.html
- Versions 4.13.2 and older: https://arm1s11-eiffel004.eiffel.gic.ericsson.se:8443/nexus/content/sites/tor/booking-tool/latest/change_log.html


# Authors #

**CI Infra Team** - PDLCIINFRA@pdl.internal.ericsson.com

# License #

ERICSSON 2021
