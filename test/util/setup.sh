SESSION_TOKEN=""
USER_UUID=""
PERSON_ID=""

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

mkdir ../../test/input 2>/dev/null
printf 1 > ../../test/input/disable-ip-rate-limit
printf 1 > ../../test/input/disable-account-rate-limit

if [[ "$1" != no-disposable-email-file ]]
then
  printf 0 > ../../test/input/is-disposable-email
fi

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
  PGPASSWORD="${DUO_DB_PASS:-password}" psql \
    -U "${DUO_DB_USER:-postgres}" \
    -d "${2:-duo_api}" \
    -c "$1;" \
    -t \
    -h "${DUO_DB_HOST:-localhost}" \
    -p "${DUO_DB_PORT:-5432}" \
    | grep -v '^$' \
    | trim
}

qdump () {
  PGPASSWORD="${DUO_DB_PASS:-password}" pg_dump \
    -U "${DUO_DB_USER:-postgres}" \
    -h "${DUO_DB_HOST:-localhost}" \
    -p "${DUO_DB_PORT:-5432}" \
    --compress=zstd:3 \
    -d duo_api \
    > "../fixtures/duo_api-$1.zstd"

  PGPASSWORD="${DUO_DB_PASS:-password}" pg_dump \
    -U "${DUO_DB_USER:-postgres}" \
    -h "${DUO_DB_HOST:-localhost}" \
    -p "${DUO_DB_PORT:-5432}" \
    --compress=zstd:3 \
    -d duo_chat \
    > "../fixtures/duo_chat-$1.zstd"
}

qrestore () {
  q "
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = 'duo_api'
    AND pid <> pg_backend_pid()
  " postgres

  q 'drop database duo_api' postgres

  q "
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = 'duo_chat'
    AND pid <> pg_backend_pid()
  " postgres

  q 'drop database duo_chat' postgres

  q 'create database duo_api' postgres

  q 'create database duo_chat' postgres

  zstd -d "../fixtures/duo_api-$1.zstd" -c | \
    PGPASSWORD="${DUO_DB_PASS:-password}" psql \
      -U "${DUO_DB_USER:-postgres}" \
      -d duo_api \
      -h "${DUO_DB_HOST:-localhost}" \
      -p "${DUO_DB_PORT:-5432}"

  zstd -d "../fixtures/duo_chat-$1.zstd" -c | \
    PGPASSWORD="${DUO_DB_PASS:-password}" psql \
      -U "${DUO_DB_USER:-postgres}" \
      -d duo_chat \
      -h "${DUO_DB_HOST:-localhost}" \
      -p "${DUO_DB_PORT:-5432}"
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

  # Create an image with a random letter, a random background color, and a shadow,
  # then output it to stdout and pipe through base64
  convert -size 400x400 xc:"#${rand_color}" -gravity center -pointsize 320 \
      -fill black -annotate +10+10 "${characters[$index]}" \
      -fill white -annotate +0+0 "${characters[$index]}" \
      png:- | base64 -w 0
}

assume_role () {
  local username_or_email=$1
  local email

  # Check if the username_or_email contains an '@' symbol
  if [[ "$username_or_email" == *@* ]]; then
    # Input is an email
    email="$username_or_email"
  else
    # Input is a username, append domain
    email="$username_or_email@example.com"
  fi

  local response=$(jc POST /request-otp -d '{ "email": "'"$email"'" }')
  SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

  if [[ "$username_or_email" == *@example.com ]]
  then
    response=$(jc POST /check-otp -d '{ "otp": "000000" }')
    USER_UUID=$(echo "$response" | jq -r '.person_uuid')
    PERSON_ID=$(echo "$response" | jq -r '.person_id')
  else
    # If we were given a non-@example.com email then the OTP probably won't be
    # 000000.
    local otp=$(
      q "
        select otp
        from duo_session
        where email='$email'
        order by otp_expiry desc
        limit 1
      "
    )
    response=$(jc POST /check-otp -d '{ "otp": "'"$otp"'" }')
    USER_UUID=$(echo "$response" | jq -r '.person_uuid')
    PERSON_ID=$(echo "$response" | jq -r '.person_id')
  fi

  local onboarded=$(echo "$response" | jq -r '.onboarded')

  if [[ "$onboarded" != true ]]; then
    return 1
  else
    export SESSION_TOKEN
    export USER_UUID
    export PERSON_ID
  fi
}

get_id () {
  q "select id from person where email = '$1'"
}

get_uuid () {
  q "select uuid::text from person where email = '$1'"
}

delete_emails () {
  curl -s -X DELETE 'http://localhost:8025/api/v1/messages'
}

is_inbox_empty () {
  [[ $(curl -s 'http://localhost:8025/api/v1/messages') == '[]' ]]
}

get_emails () {
  (
    set +x

    local resp=$(curl -s 'http://localhost:8025/api/v1/messages')

    local to=$(  printf "%s" "$resp" | jq -r '.[].Content.Headers.To')
    local from=$(printf "%s" "$resp" | jq -r '.[].Content.Headers.From')
    local subj=$(printf "%s" "$resp" | jq -r '.[].Content.Headers.Subject')
    local maybe_encoded_body=$(
      printf "%s" "$resp" \
        | jq -r '.[].Content.Body' \
        | grep -v -- '--===============' \
        | tr -d '\r' \
        | tail -n +4)

    if printf "%s" "$maybe_encoded_body" | base64 --decode >/dev/null 2>&1
    then
      local body=$(printf "%s" "$maybe_encoded_body" | base64 --decode)
    else
      local body=${maybe_encoded_body}
    fi

    local body=$(
      echo "$body" \
      | tr -d '\r' \
      | grep -v '^[ \t]*$'
    )

    printf "%s\n" "To: $to"
    printf "%s\n" "From: $from"
    printf "%s\n" "Subj: $subj"
    printf "%s\n" "Body: $body"
  )
}

assert_photos_downloadable_by_uuid () {
  local uuid=$1
  shift
  local sizes=("$@")

  # Default sizes if none are provided
  if [ ${#sizes[@]} -eq 0 ]; then
    sizes=("original" "900" "450")
  fi

  for size in "${sizes[@]}"; do
    c GET "http://localhost:9090/s3-mock-bucket/${size}-${uuid}.jpg" > /dev/null || return 1
  done
}

wait_for_deletion_by_uuid () {
  local elapsed=0

  while (( elapsed < 5 ))
  do
    if ! assert_photos_downloadable_by_uuid "$@"
    then
      return 0
    fi

    sleep 1

    (( elapsed += 1 )) || true
  done

  return 1
}

wait_for_creation_by_uuid () {
  local elapsed=0

  while (( elapsed < 5 ))
  do
    if assert_photos_downloadable_by_uuid "$@"
    then
      return 0
    fi

    sleep 1

    (( elapsed += 1 )) || true
  done

  return 1
}
