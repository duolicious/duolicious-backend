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

../util/create-user.sh sender 0 0
../util/create-user.sh recipient1 0 0
../util/create-user.sh recipient2 0 0
../util/create-user.sh recipient3 0 0

q "update person set intros_notification = 1"

assume_role sender ; sendertoken=$SESSION_TOKEN

senderuuid=$(get_uuid 'sender@example.com')
recipient1uuid=$(get_uuid 'recipient1@example.com')
recipient2uuid=$(get_uuid 'recipient2@example.com')
recipient3uuid=$(get_uuid 'recipient3@example.com')

sleep 3

curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
  "service": "ws://chat:5443",
  "domain": "duolicious.app",
  "resource": "testresource",
  "username": "'$senderuuid'",
  "password": "'$sendertoken'"
}'

sleep 3

send_intro () {
  local to_uuid=$1
  local id=$2
  curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$senderuuid@duolicious.app'
    to='$to_uuid@duolicious.app'
    id='$id'
    xmlns='jabber:client'>
  <body>the very same intro</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"
}

hash_used_count () {
  q "select coalesce(sum(used_count), 0) from intro_hash"
}



echo The first time an intro is used it is delivered and the count becomes 1

send_intro "$recipient1uuid" m1

sleep 3 # Allow the batched intro_hash upsert to flush and the cache to expire

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="m1"/>'

[[ "$(hash_used_count)" = 1 ]]



echo Reusing the intro is rejected and reports it was already used once

send_intro "$recipient2uuid" m2

sleep 3

curl -sX GET http://localhost:3000/pop | \
  grep -qF '<duo_message_not_unique id="m2" used_count="1"/>'

[[ "$(hash_used_count)" = 2 ]]



echo Reusing the intro again reports the higher count and keeps incrementing

send_intro "$recipient3uuid" m3

sleep 3

curl -sX GET http://localhost:3000/pop | \
  grep -qF '<duo_message_not_unique id="m3" used_count="2"/>'

[[ "$(hash_used_count)" = 3 ]]



echo A distinct intro has its own independent count

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$senderuuid@duolicious.app'
    to='$recipient3uuid@duolicious.app'
    id='m4'
    xmlns='jabber:client'>
  <body>a completely different intro</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 3

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="m4"/>'

[[ "$(q "select used_count from intro_hash order by last_used_at desc limit 1")" = 1 ]]
[[ "$(q "select count(*) from intro_hash")" = 2 ]]
