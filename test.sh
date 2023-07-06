#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

set -e

docker-compose up -d

# Wait for API to start
timeout=60
while true
do
  response=$(
    curl \
      --write-out '%{http_code}' \
      --silent \
      --output /dev/null \
      http://localhost:5000/health || true
  )
  if [ "$response" -eq 200 ]; then
    break
  else
    printf '.'
    sleep 1
    ((timeout=timeout-1))
    if [ "$timeout" -le 0 ]; then
      echo "Timed out waiting for API to start"
      exit 1
    fi
  fi
done

export DUO_DB_HOST=localhost
export DUO_DB_PORT=5433
export DUO_DB_NAME=postgres
export DUO_DB_USER=postgres
export DUO_DB_PASS=password

# Run tests
./test/onboarding.sh
./test/create-user.sh user1 10
./test/search.sh

docker-compose kill || true
docker-compose down || true
