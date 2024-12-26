#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

for t in ./functionality5/*.sh
do
  output=$( "$t" 2>&1 ) || {
    rc=$?
    echo "$output"
    echo "Test failed: $t"
    exit "$rc"
  }
done
