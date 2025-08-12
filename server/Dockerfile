FROM node:24 as builder

WORKDIR /var/ctbib/
COPY package.json .
COPY server ./server
COPY common ./common

RUN npm i && npm run install-common && npm run install-server
RUN npm run build-common && npm run build-server

FROM gcr.io/distroless/nodejs24-debian12 as runner
COPY --from=builder /var/ctbib/server/dist/ /var/ctbib/server/

VOLUME /etc/letsencrypt
ENV HOST_CLIENT="false"
EXPOSE 80

USER 1000
WORKDIR /var/ctbib/server/
CMD ["server"]