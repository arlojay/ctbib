from node:24 as builder

WORKDIR /ctbib
COPY package.json .
COPY client ./client
COPY common ./common

RUN npm i && npm run install-common && npm run install-client
RUN npm run build-common && npm run build-client

FROM nginx as runner
COPY --from=builder /ctbib/client/dist/ /etc/nginx/html
COPY --from=builder /ctbib/client/nginx/ /etc/nginx

VOLUME /etc/letsencrypt

CMD envsubst '$CERTIFICATE_DIR $WEBSERVER_DOMAIN $API_ENDPOINT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'