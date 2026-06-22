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
../util/create-user.sh user4 0 0

assume_role user1 ; user1token=$SESSION_TOKEN
assume_role user2 ; user2token=$SESSION_TOKEN
assume_role user3 ; user3token=$SESSION_TOKEN
assume_role user4 ; user4token=$SESSION_TOKEN

user1uuid=$(get_uuid 'user1@example.com')
user2uuid=$(get_uuid 'user2@example.com')
user3uuid=$(get_uuid 'user3@example.com')
user4uuid=$(get_uuid 'user4@example.com')

user1id=$(get_id 'user1@example.com')
user2id=$(get_id 'user2@example.com')
user3id=$(get_id 'user3@example.com')
user4id=$(get_id 'user4@example.com')

query_id () {
  local _query_id=$(cat /tmp/duo_query_id 2> /dev/null)

  if [[ -z "$_query_id" ]]
  then
    echo 0
  else
    echo "$_query_id"
  fi
}

next_query_id () {
  local _next_query_id=$(( "$(query_id)" + 1 ))

  printf "%s" "$_next_query_id" > /tmp/duo_query_id
  printf "%s" "$_next_query_id"
}

send_messages () {
  local fromUuid=$1
  local fromToken=$2
  local toUuid=$3

  local messages=("${@:4}")

  curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
    "service": "ws://chat:5443",
    "domain": "duolicious.app",
    "resource": "testresource",
    "username": "'$fromUuid'",
    "password": "'$fromToken'"
  }'

  sleep 1

  for message in "${messages[@]}"; do
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
  done

  sleep 1
}

get_stanza_id () {
  grep -oP '<result[^>]+id="\K[^"]+' || true
}

get_first_stanza_id () {
  head -n1 | get_stanza_id
}

assert_fin () {
  local id=$1

  tail -n1 \
    | grep -P '<iq[^>]+id="'"$id"'"' \
    | grep -P '<iq[^>]+type="result"' \
    | grep -P '<fin ' \
    > /dev/null
}

get_conversation () {
  local userUuid=$1
  local userToken=$2
  local otherPersonUuid=$3
  local pageSize=${4:-3}

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

  local beforeId=''

  while true
  do
    local queryId=$(next_query_id)

    local query="
      <iq type='set' id='${queryId}'>
        <query xmlns='urn:xmpp:mam:2' queryid='${queryId}'>
          <x xmlns='jabber:x:data' type='submit'>
            <field var='FORM_TYPE'>
              <value>urn:xmpp:mam:2</value>
            </field>
            <field var='with'>
              <value>${otherPersonUuid}@duolicious.app</value>
            </field>
          </x>
          <set xmlns='http://jabber.org/protocol/rsm'>
            <max>${pageSize}</max>
            <before>${beforeId}</before>
          </set>
        </query>
      </iq>"

    curl \
      -X POST http://localhost:3000/send \
      -H "Content-Type: application/xml" \
      -d "$query"

    sleep 0.2

    local response=$(curl -sX GET http://localhost:3000/pop)

    assert_fin "$queryId" <<< "$response"

    beforeId=$(get_first_stanza_id <<< "$response")

    # Print the messages with hard-to-mock parts redacted
    echo "$response" \
      | sed -E 's/stamp="[0-9TZ:\.-]+"/stamp="redacted"/g' \
      | sed -E 's/(<message [^>]+id=)"[0-9a-z-]+"/\1"redacted"/g' \
      | sed -E 's/(<result [^>]+id=)"[0-9A-Z]+"/\1"redacted"/g'

    if [[ -z "$beforeId" ]]
    then
      break
    fi
  done
}


echo "Conversations are as expected after users message each other"

# Who messaged who:
# ┌───┐            ┌───┐
# │ 1 │◄───────────│ 2 │
# └───┘     ┌─────►└─┬─┘
#    ▲    ┌─┴─┐      │
#    └────┤ 3 │◄─────┘
#         └───┘
#                        ┌───┐
#                        │ 4 │
#                        └───┘

send_messages "$user2uuid" "$user2token" "$user1uuid" \
  "1st message from user 2 to user 1" \
  "2nd message from user 2 to user 1" \
  "3rd message from user 2 to user 1" \
  "4th message from user 2 to user 1" \
  "5th message from user 2 to user 1"

# 2 to 3
send_messages "$user2uuid" "$user2token" "$user3uuid" \
  "1st message from user 2 to user 3"

# 3 to 1
send_messages "$user3uuid" "$user3token" "$user1uuid" \
  "1st from user 3 to user 1" \
  "2st from user 3 to user 1" \
  "3st from user 3 to user 1" \
  "4st from user 3 to user 1" \
  "5st from user 3 to user 1" \
  "6st from user 3 to user 1" \
  "7st from user 3 to user 1"

# 3 to 2
send_messages "$user3uuid" "$user3token" "$user2uuid" \
  "1st from user 3 to user 2" \
  "2st from user 3 to user 2" \
  "3st from user 3 to user 2"


query_id_1=$(query_id)
actual_conversation_2_1=$(get_conversation "$user2uuid" "$user2token" "$user1uuid")

query_id_2=$(query_id)
actual_conversation_2_3=$(get_conversation "$user2uuid" "$user2token" "$user3uuid")

query_id_3=$(query_id)
actual_conversation_3_1=$(get_conversation "$user3uuid" "$user3token" "$user1uuid")

query_id_4=$(query_id)
actual_conversation_3_2=$(get_conversation "$user3uuid" "$user3token" "$user2uuid")

query_id_5=$(query_id)
actual_conversation_3_4=$(get_conversation "$user3uuid" "$user3token" "$user4uuid")



expected_conversation_2_1=$(cat << EOF
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_1 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user2uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>3rd message from user 2 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_1 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user2uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>4th message from user 2 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_1 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user2uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>5th message from user 2 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="$(( $query_id_1 + 1 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_1 + 2 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user2uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>1st message from user 2 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_1 + 2 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user2uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>2nd message from user 2 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="$(( $query_id_1 + 2 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<iq xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="$(( $query_id_1 + 3 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
EOF
)

expected_conversation_2_3=$(cat << EOF
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_2 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user2uuid}@duolicious.app" type="chat"><body>1st from user 3 to user 2</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_2 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user2uuid}@duolicious.app" type="chat"><body>2st from user 3 to user 2</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_2 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user2uuid}@duolicious.app" type="chat"><body>3st from user 3 to user 2</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="$(( $query_id_2 + 1 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<message xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_2 + 2 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user2uuid}@duolicious.app" id="redacted" to="${user3uuid}@duolicious.app" type="chat"><body>1st message from user 2 to user 3</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="$(( $query_id_2 + 2 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<iq xmlns="jabber:client" from="${user2uuid}@duolicious.app" to="${user2uuid}@duolicious.app" id="$(( $query_id_2 + 3 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
EOF
)

expected_conversation_3_1=$(cat << EOF
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_3 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>5st from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_3 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>6st from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_3 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>7st from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="$(( $query_id_3 + 1 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_3 + 2 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>2st from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_3 + 2 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>3st from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_3 + 2 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>4st from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="$(( $query_id_3 + 2 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_3 + 3 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user1uuid}@duolicious.app" type="chat"><body>1st from user 3 to user 1</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="$(( $query_id_3 + 3 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<iq xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="$(( $query_id_3 + 4 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
EOF
)

expected_conversation_3_2=$(cat << EOF
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_4 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user2uuid}@duolicious.app" type="chat"><body>1st from user 3 to user 2</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_4 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user2uuid}@duolicious.app" type="chat"><body>2st from user 3 to user 2</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_4 + 1 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user3uuid}@duolicious.app" id="redacted" to="${user2uuid}@duolicious.app" type="chat"><body>3st from user 3 to user 2</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="$(( $query_id_4 + 1 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<message xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="redacted"><result xmlns="urn:xmpp:mam:2" queryid="$(( $query_id_4 + 2 ))" id="redacted"><forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="redacted"/><message xmlns="jabber:client" from="${user2uuid}@duolicious.app" id="redacted" to="${user3uuid}@duolicious.app" type="chat"><body>1st message from user 2 to user 3</body><request xmlns="urn:xmpp:receipts"/></message></forwarded></result></message>
<iq xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="$(( $query_id_4 + 2 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
<iq xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="$(( $query_id_4 + 3 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
EOF
)

expected_conversation_3_4=$(cat << EOF
<iq xmlns="jabber:client" from="${user3uuid}@duolicious.app" to="${user3uuid}@duolicious.app" id="$(( $query_id_5 + 1 ))" type="result"><fin xmlns="urn:xmpp:mam:2"/></iq>
EOF
)



diff -u --color \
  <(echo "$actual_conversation_2_1") \
  <(echo "$expected_conversation_2_1")

diff -u --color \
  <(echo "$actual_conversation_2_3") \
  <(echo "$expected_conversation_2_3")

diff -u --color \
  <(echo "$actual_conversation_3_1") \
  <(echo "$expected_conversation_3_1")

diff -u --color \
  <(echo "$actual_conversation_3_2") \
  <(echo "$expected_conversation_3_2")

diff -u --color \
  <(echo "$actual_conversation_3_4") \
  <(echo "$expected_conversation_3_4")
