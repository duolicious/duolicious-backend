#!/usr/bin/env bash

sudos=()
if [[ "$1" = "--no-sudo" ]]
then
  :
else
  sudos+=(sudo)
fi

"${sudos[@]}" docker exec "$("${sudos[@]}" docker ps | grep cron | cut -d ' ' -f 1)" \
  python3 -m unittest discover -s service/cron
