#!/bin/sh

if [ -z "${DUO_API_HOST}" ]
then
  echo "DUO_API_HOST must be set" >&2
  exit 1
fi

deny  () { printf '\000\002\000\000'; }
allow () { printf '\000\002\000\001'; }

check_auth () {
  user="$1"
  pass="$2"

  person_uuid=$(
    curl \
      -s \
      -X POST \
      --header "Authorization: Bearer $pass" \
      "${DUO_API_HOST}/check-session-token" 2>/dev/null \
      | jq -r .person_uuid 2>/dev/null
  )

  if [ "$person_uuid" = "$user" ]
  then
    allow
  else
    deny
  fi
}

while true
do
  input_length=$(
    dd bs=2 count=1 2>/dev/null \
      | dd conv=swab 2>/dev/null \
      | od -An -tu2 \
      | tr -d ' '
  )

  case $input_length in
    ''|*[!0-9]*)
      # Not a number; something probably went wrong. Kill this script and hope
      # mongooseim recovers.
      exit 2
      ;;
    *)
      # A number
      ;;
  esac


  if [ "$input_length" -le 0 ]
  then
    deny
    continue
  fi

  data=$(dd bs="${input_length}" count=1 2>/dev/null)

  IFS=: read -r op user host pass <<EOF
$data
EOF

  case $op in
    auth)
      check_auth "$user" "$pass"
      ;;
    isuser)
      allow
      ;;
    *)
      deny
      ;;
  esac
done
