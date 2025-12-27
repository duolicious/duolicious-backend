#!/bin/bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

set -e

export PYTHONUNBUFFERED=true
export PYTHONDONTWRITEBYTECODE=true
export PYTHONPATH=.

if [ "${DUO_USE_VENV:-true}" = true ] && [ -d venv/mypy/ ]
then
  export PATH=$(readlink -e venv/mypy/bin):$PATH
fi

if [ "${DUO_USE_VENV:-true}" = true ] && [ ! -d venv/mypy/ ]
then
  python3 -m venv venv/mypy/
  export PATH=$(readlink -e venv/mypy/bin):$PATH
  python3 -m pip install -r mypy.requirements.txt
fi

if [ -n "$1" ]
then
  python3 -m mypy "${1}"
else
  python3 -m mypy \
    --exclude 'venv/|antiabuse/normalize/__init__\.py|antiabuse/antiporn/__init__\.py|antiabuse/lodgereport/__init__\.py|duoaudio/__init__\.py|service/cron/cronutil/__init__\.py|service/cron/checkphotos/__init__\.py|service/cron/notifications/test_init\.py|service/cron/verificationjobrunner/__init__\.py|service/person/__init__\.py|service/api/decorators\.py|questions/categorise_questions\.py|questions/archetypeise_questions\.py' \
    .
fi
