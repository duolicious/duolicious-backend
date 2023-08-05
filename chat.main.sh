#!/bin/bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

set -e

export PYTHONDONTWRITEBYTECODE=true
export PYTHONPATH=.

if [ "${DUO_USE_VENV:-true}" = true ] && [ -d venv/chat/ ]
then
  export PATH=$(readlink -e venv/chat/bin):$PATH
fi

if [ "${DUO_USE_VENV:-true}" = true ] && [ ! -d venv/chat/ ]
then
  python3 -m venv venv/chat/
  export PATH=$(readlink -e venv/chat/bin):$PATH
  python3 -m pip install -r chat.requirements.txt
fi

if [ -z "$PORT" ]
then
  PORT=5000
fi

python3 service/chat/__init__.py
