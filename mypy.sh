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

# TODO: Include more files
if [ -n "$1" ]
then
  python3 -m mypy "${1}"
else
  python3 -m mypy \
    service/chat \
    service/api/__init__.py \
    service/search/__init__.py \
    verification/__init__.py
fi
