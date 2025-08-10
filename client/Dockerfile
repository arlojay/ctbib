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
ENV HTTP_PORT=80
ENV HTTPS_PORT=443
ENV WEBSERVER_DOMAIN=example.com
ENV CERTIFICATES_DIR=/etc/letsencrypt
ENV API_ENDPOINT=http://api-container:80

CMD envsubst '$HTTP_PORT $HTTPS_PORT $WEBSERVER_DOMAIN $CERTIFICATES_DIR $API_ENDPOINT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'