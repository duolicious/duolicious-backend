#!/bin/sh

export PYTHONDONTWRITEBYTECODE=true

if [ -z "$PORT" ]
then
  PORT=5000
fi

if [ "$DUO_ENV" = "prod" ]
then
  gunicorn -w 4 -b "0.0.0.0:$PORT" main:app
elif [ "$DUO_ENV" = "dev" ]
then
  flask --app main.py --debug run --port "$PORT"
else
  echo "The environment variable DUO_ENV must be set and have the value 'env' or 'prod'"
fi
