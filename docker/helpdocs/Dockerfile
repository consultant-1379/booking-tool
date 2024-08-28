FROM armdocker.seli.gic.ericsson.se/dockerhub-ericsson-remote/node:10.16.3-alpine

EXPOSE 8585

WORKDIR /opt/helpdocs/

COPY helpdocs/ /opt/helpdocs/

RUN npm config set @uisdk:registry https://arm.lmera.ericsson.se/artifactory/api/npm/proj-uisdk-npm-local/

RUN npm config set unsafe-perm true \
 && npm install -g @uisdk/cdt2 --ignore-scripts \
 && npm install -g @uisdk/cdt-serve \
 && npm install -g @uisdk/cdt-package \
 && cdt2 package install --autofill \
 && npm prune \
 && npm cache clean --force

CMD cdt2 serve
