#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh
mapfile -t greetings < ../fixtures/greetings.txt

max_intros_per_day=35

set -xe

sleep 3 # MongooseIM takes some time to flush messages to the DB

q "delete from person"
q "delete from banned_person"
q "delete from banned_person_admin_token"
q "delete from duo_session"
q "delete from mam_message" duo_chat
q "delete from mam_server_user" duo_chat
q "delete from last" duo_chat
q "delete from inbox" duo_chat
q "delete from mam_server_user" duo_chat
q "delete from duo_last_notification" duo_chat
q "delete from duo_push_token" duo_chat
q "delete from intro_hash" duo_chat

../util/create-user.sh sender1 0 0
seq $((max_intros_per_day + 1)) | xargs -I'{}' ../util/create-user.sh "recipient{}" 0 0

assume_role sender1
sender1token=$SESSION_TOKEN

sender1uuid=$(get_uuid 'sender1@example.com')




sleep 3



curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
  "service": "ws://chat:5443",
  "domain": "duolicious.app",
  "resource": "testresource",
  "username": "'$sender1uuid'",
  "password": "'$sender1token'"
}'



sleep 3



for i in $(seq $((max_intros_per_day - 1)) )
do
  recipientUuid=$(get_uuid "recipient$i@example.com")

  curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
  <message
      type='chat'
      from='$sender1uuid@duolicious.app'
      to='$recipientUuid@duolicious.app'
      id='id$i'
      xmlns='jabber:client'>
    <body>${greetings[$i]}</body>
    <request xmlns='urn:xmpp:receipts'/>
  </message>
  "
done

sleep 1 # Wait for testing service to receive messages

curl -sX GET http://localhost:3000/pop > /dev/null

echo "The ${max_intros_per_day}-th recipient can still be messaged"

recipientNUuid=$(get_uuid "recipient${max_intros_per_day}@example.com")

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$sender1uuid@duolicious.app'
    to='$recipientNUuid@duolicious.app'
    id='id${max_intros_per_day}'
    xmlns='jabber:client'>
  <body>${greetings[$max_intros_per_day]}</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 1 # Wait for testing service to receive messages

curl -sX GET http://localhost:3000/pop \
  | grep -qF "<duo_message_delivered id=\"id${max_intros_per_day}\"/>"

sleep 6 # Wait for the ttl cache to expire

echo "The $((max_intros_per_day + 1))-th recipient cannot be messaged"

recipientN1Uuid=$(get_uuid "recipient$((max_intros_per_day + 1))@example.com")

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$sender1uuid@duolicious.app'
    to='$recipientN1Uuid@duolicious.app'
    id='id$((max_intros_per_day + 1))'
    xmlns='jabber:client'>
    <body>${greetings[$((max_intros_per_day + 1))]}</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 1 # Wait for testing service to receive messages

curl -sX GET http://localhost:3000/pop \
  | grep -qF "<duo_message_blocked id=\"id$((max_intros_per_day + 1))\" reason=\"rate-limited-1day\"/>"

echo Rate limiting resets after 1 day

q "
update
  messaged
set
  created_at = now() - interval '1.01 days'
where
  object_person_id = (select id from person where uuid = '$recipientNUuid')
"

sleep 6 # Wait for the ttl cache to expire


curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$sender1uuid@duolicious.app'
    to='$recipientN1Uuid@duolicious.app'
    id='id$((max_intros_per_day + 2))'
    xmlns='jabber:client'>
    <body>${greetings[$((max_intros_per_day + 2))]}</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 1 # Wait for testing service to receive messages

curl -sX GET http://localhost:3000/pop \
  | grep -qF "<duo_message_delivered id=\"id$((max_intros_per_day + 2))\"/>"
