#!/bin/bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

set -e

export PYTHONDONTWRITEBYTECODE=true
export PYTHONPATH=.

if [ "${DUO_USE_VENV:-true}" = true ] && [ -d venv/api/ ]
then
  export PATH=$(readlink -e venv/api/bin):$PATH
fi

if [ "${DUO_USE_VENV:-true}" = true ] && [ ! -d venv/api/ ]
then
  python3 -m venv venv/api/
  export PATH=$(readlink -e venv/api/bin):$PATH
  python3 -m pip install -r api.requirements.txt
fi

if [ -z "$PORT" ]
then
  PORT=5000
fi

if [ "$DUO_ENV" = "prod" ]
then
  python3 database/init.py
  exec gunicorn \
    --workers 4 \
    --bind "0.0.0.0:$PORT" \
    --timeout 0 \
    service.application:app
elif [ "$DUO_ENV" = "dev" ]
then
  python3 database/init.py
  exec flask \
    --app service.application:app \
    --debug run \
    --host 0.0.0.0 \
    --port "$PORT"
else
  echo "The environment variable DUO_ENV must be set and have the value 'dev' or 'prod'"
fi
