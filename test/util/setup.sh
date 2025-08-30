# Print a high-contrast banner line to make logs readable.
# Example: say "References to audio files are stored in MAM"
say () {
  local text="$1"
  echo -e "\033[1;30;47m${text}\033[0m"
}

# Wrap text in escape codes for a highlighted prompt (used by PS4 below).
# Example: export PS4="$(highlight '${BASH_SOURCE}'):$(highlight '${LINENO}'): "
highlight() {
  local text="$1"
  echo -e "\[\033[1;30;47m\]${text}\[\033[0m\]"
}

export PS4="$(highlight '${BASH_SOURCE}'):$(highlight '${LINENO}'): "

SESSION_TOKEN=""
USER_UUID=""
PERSON_ID=""

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

mkdir ../../test/input 2>/dev/null
printf 1 > ../../test/input/enable-mocking
printf 1 > ../../test/input/disable-ip-rate-limit
printf 1 > ../../test/input/disable-account-rate-limit

# Read from stdin and strip leading and trailing spaces. Useful for psql output.
# Example: echo '  value  ' | trim  # => 'value'
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

# HTTP client wrapper around curl.
# - Adds Authorization header from SESSION_TOKEN if present
# - Defaults base URL to http://localhost:5000 for relative endpoints
# - Prints response body to stdout; exit status is 0 for 2xx, non-zero otherwise
# Example: response=$(c GET '/stats')
# Example (expect failure): ! c GET '/search?n=1&o=0' || exit 1
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

# JSON HTTP client. Same as c() but sets Content-Type: application/json.
# Example: jc POST /request-otp -d '{ "email": "user1@example.com" }'
jc () { c "$@" --header "Content-Type: application/json"; }

# Execute a SQL command against Postgres and trim whitespace.
# Defaults: DB=duo_api, host=localhost, port=5432, user=postgres (override with env vars)
# Example: q "select count(*) from person"
# Example (different DB): q 'select 1' postgres
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

# Dump the duo_api database to a compressed fixture file under test/fixtures/.
# Example: qdump baseline   # writes ../fixtures/duo_api-baseline.zstd
qdump () {
  PGPASSWORD="${DUO_DB_PASS:-password}" pg_dump \
    -U "${DUO_DB_USER:-postgres}" \
    -h "${DUO_DB_HOST:-localhost}" \
    -p "${DUO_DB_PORT:-5432}" \
    --compress=zstd:3 \
    -d duo_api \
    > "../fixtures/duo_api-$1.zstd"
}

# Restore the duo_api database from a compressed fixture created by qdump.
# Example: qrestore baseline
qrestore () {
  q 'drop database duo_api with (force)' postgres

  q 'create database duo_api' postgres

  zstd -d "../fixtures/duo_api-$1.zstd" -c | \
    PGPASSWORD="${DUO_DB_PASS:-password}" psql \
      -U "${DUO_DB_USER:-postgres}" \
      -d duo_api \
      -h "${DUO_DB_HOST:-localhost}" \
      -p "${DUO_DB_PORT:-5432}"
}

# Assert a JSON array has the expected length.
# Example: j_assert_length "$response" 2
j_assert_length () {
  [[ "$(echo "$1" | jq length)" -eq "$2" ]]
}

# Generate a random base64-encoded PNG image (WxH) for testing.
# Example: img=$(rand_image)
rand_image () {
  ./rand-image.sh 100 100 | base64 -w 0
}

# Generate a short random base64-encoded AAC audio clip for testing.
# Example: snd=$(rand_sound)
rand_sound () {
  ./rand-sound.sh 3 | base64 -w 0
}

# Return a deterministic base64-encoded audio clip from fixtures.
# Example: snd=$(const_sound)
const_sound () {
  cat '../fixtures/audio-bio.mp4' | base64 -w 0
}

# Sign in as a user and export SESSION_TOKEN, USER_UUID, PERSON_ID.
# Accepts a username (adds @example.com) or a full email. Uses OTP flow.
# Returns non-zero if the user is not onboarded yet.
# Example: assume_role user1
# Example: assume_role 'reporter@gmail.com'
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

# Lookup an internal numeric person id by email.
# Example: user1id=$(get_id 'user1@example.com')
get_id () {
  q "select id from person where email = '$1'"
}

# Lookup a person's UUID by email.
# Example: user1uuid=$(get_uuid 'user1@example.com')
get_uuid () {
  q "select uuid::text from person where email = '$1'"
}

# Delete all messages from the test SMTP server (MailHog).
# Example: delete_emails
delete_emails () {
  curl -s -X DELETE 'http://localhost:8025/api/v1/messages'
}

# Return success if the MailHog inbox is empty.
# Example: is_inbox_empty || echo "mail remains"
is_inbox_empty () {
  [[ $(curl -s 'http://localhost:8025/api/v1/messages') == '[]' ]]
}

# Pretty-print the latest messages from MailHog (To, From, Subject, Body).
# Example: get_emails | grep "Subject:"
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

# Ensure that photos for a UUID are downloadable from the mock S3 server.
# Accepts optional size list; defaults to original, 900, 450.
# Example: assert_photos_downloadable_by_uuid "$uuid" 900 450
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

# Poll until photos for a UUID disappear from the mock S3 server (<= 5s).
# Example: wait_for_deletion_by_uuid "$uuid" 900 450
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

# Poll until photos for a UUID appear on the mock S3 server (<= 5s).
# Example: wait_for_creation_by_uuid "$uuid" original 900 450
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

# Ensure that an audio file for a UUID is downloadable from the mock S3 server.
# Example: assert_audios_downloadable_by_uuid "$audio_uuid"
assert_audios_downloadable_by_uuid () {
  local uuid=$1

  download_length=$(
    set -o pipefail
    c GET "http://localhost:9090/s3-mock-audio-bucket/${uuid}.aac" | wc -c
  )
  rc=$?

  [[ ${download_length} -ne 0 && ${rc} -eq 0 ]]
}

# Poll until an audio file disappears from the mock S3 server (<= 5s).
# Example: wait_for_audio_deletion_by_uuid "$audio_uuid"
wait_for_audio_deletion_by_uuid () {
  local elapsed=0

  while (( elapsed < 5 ))
  do
    if ! assert_audios_downloadable_by_uuid "$@"
    then
      return 0
    fi

    sleep 1

    (( elapsed += 1 )) || true
  done

  return 1
}

# Poll until an audio file appears on the mock S3 server (<= 5s).
# Example: wait_for_audio_creation_by_uuid "$audio_uuid"
wait_for_audio_creation_by_uuid () {
  local elapsed=0

  while (( elapsed < 5 ))
  do
    if assert_audios_downloadable_by_uuid "$@"
    then
      return 0
    fi

    sleep 1

    (( elapsed += 1 )) || true
  done

  return 1
}


# Authenticate to the XMPP websocket test server using UUID and token.
# Posts config, then a SASL PLAIN auth stanza encoded in base64.
# Example: chat_auth "$userUuid" "$userToken"
chat_auth () {
  local fromUuid=$1
  local fromToken=$2

  local auth64=$(printf '\0%s\0%s' "$fromUuid" "$fromToken" | base64 -w 0);

  read -r -d '' authJson <<EOF || true
{
  "auth": {
    "@xmlns": "urn:ietf:params:xml:ns:xmpp-sasl",
    "@mechanism": "PLAIN",
    "#text": "${auth64}"
  }
}
EOF

  # Set up the connection
  curl -X POST http://localhost:3001/config \
    -H "Content-Type: application/json" \
    -d '{ "server": "ws://chat:5443" }'

  sleep 0.2

  # Authentication
  curl -X POST http://localhost:3001/send \
    -H "Content-Type: application/json" \
    -d "$authJson"
}

# Upload N random photos to the profile via /profile-info.
# Example: add_photos 3
add_photos () {
  for i in $(seq 1 $1)
  do
    local img=$(rand_image)

    jc PATCH /profile-info \
      -d "{
              \"base64_file\": {
                  \"position\": ${i},
                  \"base64\": \"${img}\",
                  \"top\": 0,
                  \"left\": 0
              }
          }"
  done
}
