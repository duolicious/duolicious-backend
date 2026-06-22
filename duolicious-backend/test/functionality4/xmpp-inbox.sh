#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

sleep 3 # MongooseIM takes some time to flush messages to the DB

q "delete from person"
q "delete from banned_person"
q "delete from banned_person_admin_token"
q "delete from duo_session"
q "delete from mam_message"
q "delete from inbox"
q "delete from intro_hash"

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0
../util/create-user.sh user3 0 0

assume_role user1 ; user1token=$SESSION_TOKEN
assume_role user2 ; user2token=$SESSION_TOKEN
assume_role user3 ; user3token=$SESSION_TOKEN

user1uuid=$(get_uuid 'user1@example.com')
user2uuid=$(get_uuid 'user2@example.com')
user3uuid=$(get_uuid 'user3@example.com')

user1id=$(get_id 'user1@example.com')
user2id=$(get_id 'user2@example.com')
user3id=$(get_id 'user3@example.com')

query_id () {
  cat /tmp/duo_query_id
}

next_query_id () {
  queryId="q$RANDOM"

  printf "%s" "$queryId" > /tmp/duo_query_id
  printf "%s" "$queryId"
}

send_message () {
  local fromUuid=$1
  local fromToken=$2

  local toUuid=$3

  local message=$4

  curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
    "service": "ws://chat:5443",
    "domain": "duolicious.app",
    "resource": "testresource",
    "username": "'$fromUuid'",
    "password": "'$fromToken'"
  }'

  sleep 1

  curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
  <message
      type='chat'
      from='$fromUuid@duolicious.app'
      to='$toUuid@duolicious.app'
      id='id1'
      xmlns='jabber:client'>
    <body>$message</body>
    <request xmlns='urn:xmpp:receipts'/>
  </message>
  "

  sleep 1
}

get_inbox () {
  local userUuid=$1
  local userToken=$2

  local queryId=$(next_query_id)

  curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
    "service": "ws://chat:5443",
    "domain": "duolicious.app",
    "resource": "testresource",
    "username": "'$userUuid'",
    "password": "'$userToken'"
  }'

  sleep 1

  curl -sX GET http://localhost:3000/pop > /dev/null

  sleep 0.5

  local query="
    <iq type='set' id='${queryId}'>
      <inbox xmlns='erlang-solutions.com:xmpp:inbox:0' queryid='${queryId}'/>
    </iq>"

  curl \
    -X POST http://localhost:3000/send \
    -H "Content-Type: application/xml" \
    -d "$query"

  sleep 1

  curl -sX GET http://localhost:3000/pop \
    | sed -E 's/stamp="[0-9TZ:\.-]+"/stamp="redacted"/g'

  sleep 1
}

mark_displayed () {
  local fromUuid=$1
  local fromToken=$2

  local toUuid=$3

  local queryId=$(next_query_id)

  curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
    "service": "ws://chat:5443",
    "domain": "duolicious.app",
    "resource": "testresource",
    "username": "'$fromUuid'",
    "password": "'$fromToken'"
  }'

  sleep 1

  local query="
    <message to='${toUuid}@duolicious.app' from='${fromUuid}@duolicious.app'>
      <displayed xmlns='urn:xmpp:chat-markers:0' id='${queryId}'/>
    </message>
  "

  curl \
    -X POST http://localhost:3000/send \
    -H "Content-Type: application/xml" \
    -d "$query"

  sleep 1
}


echo "The inbox is as expected after users message each other"

# Who messaged who:
# ┌───┐            ┌───┐
# │ 1 │◄───────────│ 2 │
# └───┘     ┌─────►└─┬─┘
#    ▲    ┌─┴─┐      │
#    └────┤ 3 │◄─────┘
#         └───┘
send_message "$user2uuid" "$user2token" "$user1uuid" "from user 2 to user 1"
send_message "$user2uuid" "$user2token" "$user3uuid" "from user 2 to user 3"

send_message "$user3uuid" "$user3token" "$user1uuid" "from user 3 to user 1"
send_message "$user3uuid" "$user3token" "$user2uuid" "from user 3 to user 2"



actual_inbox_1=$(get_inbox "$user1uuid" "$user1token"); query_id_1=$(query_id)
actual_inbox_2=$(get_inbox "$user2uuid" "$user2token"); query_id_2=$(query_id)
actual_inbox_3=$(get_inbox "$user3uuid" "$user3token"); query_id_3=$(query_id)

expected_inbox_1=$(cat << EOF
<message xmlns="jabber:client" from="$user1uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1"><result xmlns="erlang-solutions.com:xmpp:inbox:0" unread="1" queryid="$query_id_1"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="$user2uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1" type="chat"><body>from user 2 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded><read>false</read><box>inbox</box><archive>false</archive><mute>0</mute></result></message>
<message xmlns="jabber:client" from="$user1uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1"><result xmlns="erlang-solutions.com:xmpp:inbox:0" unread="1" queryid="$query_id_1"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="$user3uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1" type="chat"><body>from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded><read>false</read><box>inbox</box><archive>false</archive><mute>0</mute></result></message>
<iq id="$query_id_1" type="result"><fin/></iq>
EOF
)

expected_inbox_2=$(cat << EOF
<message xmlns="jabber:client" from="$user2uuid@duolicious.app" to="$user2uuid@duolicious.app" id="id1"><result xmlns="erlang-solutions.com:xmpp:inbox:0" unread="0" queryid="$query_id_2"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="$user2uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1" type="chat"><body>from user 2 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded><read>true</read><box>chats</box><archive>false</archive><mute>0</mute></result></message>
<message xmlns="jabber:client" from="$user2uuid@duolicious.app" to="$user2uuid@duolicious.app" id="id1"><result xmlns="erlang-solutions.com:xmpp:inbox:0" unread="1" queryid="$query_id_2"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="$user3uuid@duolicious.app" to="$user2uuid@duolicious.app" id="id1" type="chat"><body>from user 3 to user 2</body><request xmlns="urn:xmpp:receipts"/></message></forwarded><read>false</read><box>chats</box><archive>false</archive><mute>0</mute></result></message>
<iq id="$query_id_2" type="result"><fin/></iq>
EOF
)

expected_inbox_3=$(cat << EOF
<message xmlns="jabber:client" from="$user3uuid@duolicious.app" to="$user3uuid@duolicious.app" id="id1"><result xmlns="erlang-solutions.com:xmpp:inbox:0" unread="0" queryid="$query_id_3"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="$user3uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1" type="chat"><body>from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded><read>true</read><box>chats</box><archive>false</archive><mute>0</mute></result></message>
<message xmlns="jabber:client" from="$user3uuid@duolicious.app" to="$user3uuid@duolicious.app" id="id1"><result xmlns="erlang-solutions.com:xmpp:inbox:0" unread="0" queryid="$query_id_3"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="$user3uuid@duolicious.app" to="$user2uuid@duolicious.app" id="id1" type="chat"><body>from user 3 to user 2</body><request xmlns="urn:xmpp:receipts"/></message></forwarded><read>true</read><box>chats</box><archive>false</archive><mute>0</mute></result></message>
<iq id="$query_id_3" type="result"><fin/></iq>
EOF
)

diff -u --color <(echo "$actual_inbox_1") <(echo "$expected_inbox_1")
diff -u --color <(echo "$actual_inbox_2") <(echo "$expected_inbox_2")
diff -u --color <(echo "$actual_inbox_3") <(echo "$expected_inbox_3")



echo "Marking a message displayed updates the inbox"

mark_displayed "$user1uuid" "$user1token" "$user2uuid"

actual_inbox_1=$(get_inbox "$user1uuid" "$user1token"); query_id_1=$(query_id)
expected_inbox_1=$(cat << EOF
<message xmlns="jabber:client" from="$user1uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1"><result xmlns="erlang-solutions.com:xmpp:inbox:0" unread="0" queryid="$query_id_1"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="$user2uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1" type="chat"><body>from user 2 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded><read>true</read><box>inbox</box><archive>false</archive><mute>0</mute></result></message>
<message xmlns="jabber:client" from="$user1uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1"><result xmlns="erlang-solutions.com:xmpp:inbox:0" unread="1" queryid="$query_id_1"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="$user3uuid@duolicious.app" to="$user1uuid@duolicious.app" id="id1" type="chat"><body>from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded><read>false</read><box>inbox</box><archive>false</archive><mute>0</mute></result></message>
<iq id="$query_id_1" type="result"><fin/></iq>
EOF
)

diff -u --color <(echo "$actual_inbox_1") <(echo "$expected_inbox_1")
