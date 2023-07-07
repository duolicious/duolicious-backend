#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

for n in {1..10}
do
  ./create-user.sh "user${n}" &
  sleep 1
done
