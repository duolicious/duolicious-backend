#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

set -e

./functionality/onboarding.sh
./functionality/create-user.sh user1 10
./functionality/search.sh
