SESSION_TOKEN=""

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

mkdir ../../test/input  2>/dev/null
mkdir ../../test/output 2>/dev/null

printf 1  > ../../test/input/disable-rate-limit
printf '' > ../../test/output/cron-autodeactivate2-email
printf '' > ../../test/output/cron-emails

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
    -d "${2:-duo_api}" \
    -c "$1;" \
    -t \
    -h "$DUO_DB_HOST" \
    -p "$DUO_DB_PORT" \
    | grep -v '^$' \
    | trim
}

j_assert_length () {
  [[ "$(echo "$1" | jq length)" -eq "$2" ]]
}

rand_image () {
  local characters=({a..z} {A..Z} {0..9})

  # Generate a random index for letter
  local index=$(($RANDOM % ${#characters[@]}))

  # Generate a random color for the background
  local rand_color=$(
    printf "%02x%02x%02x\n" \
      $(($RANDOM % 256)) \
      $(($RANDOM % 256)) \
      $(($RANDOM % 256))
  )

  local filename=/tmp/${RANDOM}.png

  # Create an image with a random letter, a random background color, and a shadow
  convert -size 400x400 xc:"#${rand_color}" -gravity center -pointsize 320 \
      -fill black -annotate +10+10 "${characters[$index]}" \
      -fill white -annotate +0+0 "${characters[$index]}" \
      "$filename"

  echo "$filename"
}

assume_role () {
  local username=$1
  local response=$(jc POST /request-otp -d '{ "email": "'"$username"'@example.com" }')
  SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
  jc POST /check-otp -d '{ "otp": "000000" }'
  export SESSION_TOKEN
}

get_id () {
  q "select id from person where email = '$1'"
}
