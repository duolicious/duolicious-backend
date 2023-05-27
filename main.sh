#!/usr/bin/env bash

export PYTHONDONTWRITEBYTECODE=true

if [[ "$1" == "prod" ]]
then
  gunicorn -w 4 -b 0.0.0.0:5000 main:app
elif [[ "$1" == "dev" ]]
then
  flask --app main.py --debug run
else
  echo "usage: $0 [prod|dev]"
fi
