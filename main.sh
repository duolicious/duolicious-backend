#!/bin/bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

set -e

export PYTHONDONTWRITEBYTECODE=true

if [ "${DUO_USE_VENV:-true}" = true ] && [ -d venv/ ]
then
  export PATH=$(readlink -e venv/bin):$PATH
fi

if [ "${DUO_USE_VENV:-true}" = true ] && [ ! -d venv/ ]
then
  python3 -m venv venv/
  export PATH=$(readlink -e venv/bin):$PATH
  python3 -m pip install -r requirements.txt
fi

if [ -z "$PORT" ]
then
  PORT=5000
fi

if [ "$DUO_ENV" = "prod" ]
then
  python3 -m database.init
  exec gunicorn \
    --workers 4 \
    --bind "0.0.0.0:$PORT" \
    --timeout 0 \
    main:app
elif [ "$DUO_ENV" = "dev" ]
then
  python3 -m database.init
  exec flask \
    --app main.py \
    --debug run \
    --host 0.0.0.0 \
    --port "$PORT"
else
  echo "The environment variable DUO_ENV must be set and have the value 'dev' or 'prod'"
fi
