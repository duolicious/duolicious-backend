#!/usr/bin/env bash

set -e

sudos=()
if [[ "$1" = "--no-sudo" ]]
then
  :
else
  sudos+=(sudo)
fi

"${sudos[@]}" docker exec "$("${sudos[@]}" docker ps | grep api- | cut -d ' ' -f 1)" \
  python3 -m unittest discover -s .
