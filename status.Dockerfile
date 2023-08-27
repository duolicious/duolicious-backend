FROM nginx:alpine

COPY service/status/default.conf /etc/nginx/conf.d/default.conf
COPY service/status/index.html /usr/share/nginx/html/index.html
