FROM node:24 as builder

WORKDIR /ctbib/
COPY package.json .
COPY server ./server
COPY common ./common

RUN npm i && npm run install-common && npm run install-server
RUN npm run build-common && npm run build-server

FROM gcr.io/distroless/nodejs24-debian12 as runner
COPY --from=builder /ctbib/server/dist/ /ctbib/server/

VOLUME /etc/letsencrypt
ENV HOST_CLIENT="false"

USER 1000
WORKDIR /ctbib/server/
CMD ["server"]