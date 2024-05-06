#!/usr/bin/env bash

sudo apt update

sudo apt install -y nginx certbot python3-certbot-nginx

# Create /etc/nginx/sites-available/duolicious.conf

sudo certbot --nginx \
  -d chat.duolicious.app \
  -d api.duolicious.app
