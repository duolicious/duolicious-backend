#!/bin/sh

export PYTHONDONTWRITEBYTECODE=true

if [ -z "$PORT" ]
then
  PORT=5000
fi

if [ "$1" = "prod" ]
then
  gunicorn -w 4 -b "0.0.0.0:$PORT" main:app
elif [ "$1" = "dev" ]
then
  flask --app main.py --debug run --port "$PORT"
else
  echo "usage: $0 [prod|dev]"
fi
