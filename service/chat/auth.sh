#!/bin/sh

if [ -z "${DUO_API_HOST}" ]
then
  echo "DUO_API_HOST must be set" >&2
  kill -SIGTERM $(pgrep ejabberd)
  exit 1
fi

deny  () { printf '\x00\x02\x00\x00'; }
allow () { printf '\x00\x02\x00\x01'; }

check_auth () {
  user="$1"
  pass="$2"

  person_id=$(
    wget \
      --post-data='' \
      --header="Authorization: Bearer $pass" \
      --output-document=- \
      "${DUO_API_HOST}/check-session-token" | \
      jq .person_id 2>/dev/null
  )

  if [ "$person_id" = "$user" ]
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
    setpass)
      deny
      ;;
    isuser)
      allow
      ;;
    tryregister)
      deny
      ;;
    removeuser)
      deny
      ;;
    removeuser3)
      deny
      ;;
  esac
done
