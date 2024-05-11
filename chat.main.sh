#!/bin/bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

set -e

export PYTHONUNBUFFERED=true
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

if [ -z "$DUO_CHAT_PORTS" ]
then
  DUO_CHAT_PORTS='5443'
fi

# Array to hold the PIDs of the child processes
child_pids=()

# Function to kill all child processes
cleanup() {
    echo "Cleaning up child processes..."
    for pid in "${child_pids[@]}"; do
        kill -TERM "$pid" 2>/dev/null
    done
}

# Set trap to call cleanup when the script exits
trap cleanup EXIT

# Helper function to handle port ranges
expand_ports() {
    if [[ $1 =~ ^([0-9]+)-([0-9]+)$ ]]; then
        local lower=${BASH_REMATCH[1]}
        local upper=${BASH_REMATCH[2]}
        seq $lower $upper
    else
        echo $1
    fi
}

# Iterate over all command-line arguments
for port_entry in $DUO_CHAT_PORTS
do
    for duo_chat_port in $(expand_ports $port_entry)
    do
        python3 service/chat/__init__.py "$duo_chat_port" &
        child_pids+=($!)
    done
done

# Wait for all background jobs to complete
wait
