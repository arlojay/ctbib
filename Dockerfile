FROM node:24

WORKDIR /ctbib/
RUN mkdir src
RUN mkdir dist
COPY . src/

WORKDIR /ctbib/src/
RUN pwd
RUN ls -l .
RUN npm run install-all
RUN npm run build

WORKDIR /ctbib/
RUN mkdir dist/client
RUN mkdir dist/server
RUN cp src/client/dist dist/client/dist -r
RUN cp src/server/dist dist/server/dist -r
RUN cp src/package.json dist/package.json
RUN cp src/client/package.json dist/client/package.json
RUN cp src/server/package.json dist/server/package.json

RUN chown 1000:1000 dist/ -R

USER 1000
WORKDIR /ctbib/dist/
CMD npm run start-server