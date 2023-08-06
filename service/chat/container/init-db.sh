#!/bin/sh

die_env () {
  echo echo "Must be set: $1" >&2
  exit 1
}

[ -z "${DUO_DB_HOST}" ] && die_env DUO_DB_HOST
[ -z "${DUO_DB_PORT}" ] && die_env DUO_DB_PORT
[ -z "${DUO_DB_USER}" ] && die_env DUO_DB_USER
[ -z "${DUO_DB_PASS}" ] && die_env DUO_DB_PASS

PGPASSWORD=$DUO_DB_PASS psql \
  -h "$DUO_DB_HOST" \
  -U "$DUO_DB_USER" \
  -p "$DUO_DB_PORT" \
  -c "CREATE DATABASE duo_chat;"

PGPASSWORD=$DUO_DB_PASS psql \
  -h "$DUO_DB_HOST" \
  -U "$DUO_DB_USER" \
  -d duo_chat \
  -p "$DUO_DB_PORT" \
  -f /usr/lib/mongooseim/lib/mongooseim-6.1.0-5-gabdcd0b48/priv/pg.sql

PGPASSWORD=$DUO_DB_PASS psql \
  -h "$DUO_DB_HOST" \
  -U "$DUO_DB_USER" \
  -d duo_chat \
  -p "$DUO_DB_PORT" \
  -c "CREATE TABLE IF NOT EXISTS intro_hash(hash TEXT PRIMARY KEY);"

envsubst < /mongooseim.template.toml > /tmp/out.toml
mv /tmp/out.toml /usr/lib/mongooseim/etc/mongooseim.toml
