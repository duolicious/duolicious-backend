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
      -o /tmp/response \
      -X "$method" \
      "$endpoint" \
      "${args[@]}"
  )
  cat /tmp/response
  [ "$status_code" -ge 200 -a "$status_code" -lt 300 ]
}

q () {
  PGPASSWORD=password psql \
    -U postgres \
    -d postgres \
    -c "$1;" \
    -t -h localhost -p 5432 \
    | grep -v '^$' \
    | trim
}

set -xe


