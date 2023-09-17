#!/bin/bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

set -e

export PYTHONUNBUFFERED=true
export PYTHONDONTWRITEBYTECODE=true
export PYTHONPATH=.

if [ "${DUO_USE_VENV:-true}" = true ] && [ -d venv/cron/ ]
then
  export PATH=$(readlink -e venv/cron/bin):$PATH
fi

if [ "${DUO_USE_VENV:-true}" = true ] && [ ! -d venv/cron/ ]
then
  python3 -m venv venv/cron/
  export PATH=$(readlink -e venv/cron/bin):$PATH
  python3 -m pip install -r cron.requirements.txt
fi

python3 service/cron/__init__.py
