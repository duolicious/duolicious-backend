#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

seq 10 | parallel -j16 ../functionality/create-user.sh "user{}" 100 1
