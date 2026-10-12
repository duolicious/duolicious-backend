#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

sleep 3 # The chat service takes some time to flush messages to the DB

q "delete from person"
q "delete from banned_person"
q "delete from banned_person_admin_token"
q "delete from duo_session"
q "delete from mam_message"
q "delete from inbox"
q "delete from messaged"
q "delete from intro_hash"

../util/create-user.sh sender 0 0
../util/create-user.sh polite 0 0
../util/create-user.sh recipient 0 0

q "update person set sign_up_time = now() - interval '7 days'"

q "update person
   set intros_notification = 1, chats_notification = 1,
       intro_seconds = 0, chat_seconds = 0"

assume_role sender ; sendertoken=$SESSION_TOKEN
assume_role polite ; politetoken=$SESSION_TOKEN
assume_role recipient ; recipienttoken=$SESSION_TOKEN

senderuuid=$(get_uuid 'sender@example.com')
politeuuid=$(get_uuid 'polite@example.com')
recipientuuid=$(get_uuid 'recipient@example.com')

chat_auth_as () {
  local connectionId=$1
  local fromUuid=$2
  local fromToken=$3

  local auth64=$(printf '\0%s\0%s' "$fromUuid" "$fromToken" | base64 -w 0)

  read -r -d '' authJson <<EOF || true
{
  "auth": {
    "@xmlns": "urn:ietf:params:xml:ns:xmpp-sasl",
    "@mechanism": "PLAIN",
    "#text": "${auth64}"
  }
}
EOF

  curl -X POST "http://localhost:3001/config?id=${connectionId}" \
    -H "Content-Type: application/json" \
    -d '{ "server": "ws://api:5000/chat" }'

  sleep 0.2

  curl -X POST "http://localhost:3001/send?id=${connectionId}" \
    -H "Content-Type: application/json" \
    -d "$authJson"

  sleep 1

  curl -sX GET "http://localhost:3001/pop?id=${connectionId}" > /dev/null
}

send_message_as () {
  local connectionId=$1
  local fromUuid=$2
  local toUuid=$3
  local message=$4

  read -r -d '' payload <<EOF || true
{
  "message": {
    "@type": "chat",
    "@from": "${fromUuid}@duolicious.app",
    "@to": "${toUuid}@duolicious.app",
    "@id": "id1",
    "@xmlns": "jabber:client",
    "body": "${message}",
    "request": {
      "@xmlns": "urn:xmpp:receipts"
    }
  }
}
EOF

  curl -X POST "http://localhost:3001/send?id=${connectionId}" \
    -H "Content-Type: application/json" \
    -d "$payload"

  sleep 2
}

register_push_token_as () {
  local connectionId=$1
  local token=$2

  read -r -d '' payload <<EOF || true
{ "duo_register_push_token": { "@token": "${token}" } }
EOF

  curl -X POST "http://localhost:3001/send?id=${connectionId}" \
    -H "Content-Type: application/json" -d "$payload"
  sleep 1.5
}

query_inbox_snapshot_as () {
  local connectionId=$1

  curl -sX GET "http://localhost:3001/pop?id=${connectionId}" > /dev/null
  sleep 0.5

  curl -X POST "http://localhost:3001/send?id=${connectionId}" \
    -H "Content-Type: application/json" \
    -d '{ "duo_query_inbox": null }'

  sleep 1

  curl -sX GET "http://localhost:3001/pop?id=${connectionId}"
}

# The recipient's view of its conversation with the given person, from the
# latest live inbox entry, as "location|hidden|last_message_read".
entry_fields () {
  local received=$1
  jq -sr '
    [.[] | .duo_inbox_entry | select(. != null)][-1]
    | "\(.location)|\(.hidden)|\(.last_message_read)"
  ' <<< "$received"
}

snapshot_fields () {
  local connectionId=$1
  local personUuid=$2
  query_inbox_snapshot_as "$connectionId" | jq -sr '
    [.[] | .duo_inbox | select(. != null)][0]
    | .conversations[]
    | select(.person_uuid == "'"$personUuid"'")
    | "\(.location)|\(.hidden)|\(.last_message_read)"
  '
}

chat_auth_as sender "$senderuuid" "$sendertoken"
chat_auth_as polite "$politeuuid" "$politetoken"
chat_auth_as recipient "$recipientuuid" "$recipienttoken"

register_push_token_as recipient 'recipient-token'

clear_pushes
curl -sX GET "http://localhost:3001/pop?id=recipient" > /dev/null



echo "A rude intro arrives hidden, already read, with no push"

send_message_as sender "$senderuuid" "$recipientuuid" "ur tiddies look nice"

received=$(curl -sX GET "http://localhost:3001/pop?id=recipient")
[[ "$(entry_fields "$received")" == "intros|true|true" ]]
[[ "$(snapshot_fields recipient "$senderuuid")" == "intros|true|true" ]]
[[ "$(count_pushes_to 'recipient-token')" -eq 0 ]]



echo "A polite follow-up to a hidden intro stays hidden and silent"

send_message_as sender "$senderuuid" "$recipientuuid" "sorry, hope your week is going well"

received=$(curl -sX GET "http://localhost:3001/pop?id=recipient")
[[ "$(entry_fields "$received")" == "intros|true|true" ]]
[[ "$(count_pushes_to 'recipient-token')" -eq 0 ]]
[[ "$(q "select unread_count from inbox
         where luser = '${recipientuuid}'
         and remote_bare_jid = '${senderuuid}@duolicious.app'")" -eq 0 ]]



echo "A polite intro isn't hidden"

send_message_as polite "$politeuuid" "$recipientuuid" "Your answer about road trips made me laugh"

received=$(curl -sX GET "http://localhost:3001/pop?id=recipient")
[[ "$(entry_fields "$received")" == "intros|false|false" ]]
[[ "$(count_pushes_to 'recipient-token')" -eq 1 ]]



echo "Replying to a hidden intro turns it into an ordinary chat"

send_message_as recipient "$recipientuuid" "$senderuuid" "please be nicer"
send_message_as sender "$senderuuid" "$recipientuuid" "ok fair"

received=$(curl -sX GET "http://localhost:3001/pop?id=recipient")
[[ "$(entry_fields "$received")" == "chats|false|false" ]]
[[ "$(count_pushes_to 'recipient-token')" -eq 2 ]]
