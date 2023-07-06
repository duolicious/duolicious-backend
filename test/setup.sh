SESSION_TOKEN=""

trim () {
  local trimmed=$(cat)

  # Strip leading spaces.
  while [[ $trimmed == ' '* ]]; do
     trimmed="${trimmed## }"
  done
  # Strip trailing spaces.
  while [[ $trimmed == *' ' ]]; do
      trimmed="${trimmed%% }"
  done

  printf "$trimmed"
}

c () {
  local method=$1
  local endpoint=$2

  local response_file=/tmp/response.$RANDOM

  if [[ ! "$endpoint" == http* ]];
  then
    endpoint=http://localhost:5000"$endpoint"
  fi

  shift 2

  local args=()

  if [[ -n "${SESSION_TOKEN}" ]]
  then
    args+=( --header "Authorization: Bearer $SESSION_TOKEN" )
  fi

  args+=( "$@" )

  status_code=$(
    curl \
      -s \
      -w "%{http_code}" \
      -o "$response_file" \
      -X "$method" \
      "$endpoint" \
      "${args[@]}"
  )
  local rc=$?
  if [[ $rc -ne 0 ]]
  then
    echo "curl failed with $rc" >&2
    return "$rc"
  fi
  cat "$response_file"
  rm "$response_file"
  [ "$status_code" -ge 200 -a "$status_code" -lt 300 ]
}

jc () { c "$@" --header "Content-Type: application/json"; }

q () {
  PGPASSWORD="$DUO_DB_PASS" psql \
    -U "$DUO_DB_USER" \
    -d "$DUO_DB_NAME" \
    -c "$1;" \
    -t \
    -h "$DUO_DB_HOST" \
    -p "$DUO_DB_PORT" \
    | grep -v '^$' \
    | trim
}
