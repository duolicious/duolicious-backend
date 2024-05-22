#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from person"
q "delete from duo_session" duo_chat
q "delete from mam_message" duo_chat
q "delete from mam_server_user" duo_chat
q "delete from last" duo_chat
q "delete from inbox" duo_chat
q "delete from mam_server_user" duo_chat
q "delete from duo_last_notification" duo_chat
q "delete from duo_push_token" duo_chat

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0
../util/create-user.sh user3 0 0

assume_role user1 ; user1token=$SESSION_TOKEN
assume_role user2 ; user2token=$SESSION_TOKEN
assume_role user3 ; user3token=$SESSION_TOKEN

user1uuid=$(get_uuid 'user1@example.com')
user2uuid=$(get_uuid 'user2@example.com')
user3uuid=$(get_uuid 'user3@example.com')

curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
  "service": "ws://chat:5443",
  "domain": "duolicious.app",
  "resource": "testresource",
  "username": "'$user1uuid'",
  "password": "'$user1token'"
}'
sleep 0.5

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<duo_register_push_token token='test-push-token' />
"
sleep 0.5

echo The push token should be acknowledged and inserted into the database
curl -sX GET http://localhost:3000/pop | grep -qF '<duo_registration_successful />'
[[ "$(q "select count(*) from duo_push_token \
    where username = '$user1uuid' \
    and token = 'test-push-token'" duo_chat)" = 1 ]]

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user1uuid@duolicious.app'
    to='$user2uuid@duolicious.app'
    id='id1'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>hello user 2</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"
sleep 3 # MongooseIM takes some time to flush messages to the DB

echo The message should be acknowledged and inserted into the database
curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="id1"/>'
[[ "$(q "select count(*) from mam_message where \
    search_body = 'hello user 2'" duo_chat)" = 2 ]]

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user1uuid@duolicious.app'
    to='$user3uuid@duolicious.app'
    id='id2'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>hello user 3</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"
sleep 3 # MongooseIM takes some time to flush messages to the DB

echo The message should be acknowledged and inserted into the database
curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="id2"/>'
[[ "$(q "select count(*) from mam_message where \
    search_body = 'hello user 3'" duo_chat)" = 2 ]]

assume_role user1
c DELETE /account

echo user 1 should no longer be authorized to chat after deleting their account
curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
  "service": "ws://chat:5443",
  "domain": "duolicious.app",
  "resource": "testresource",
  "username": "'$user1uuid'",
  "password": "'$user1token'"
}'
sleep 0.5

curl -sX GET http://localhost:3000/pop | grep -qF "<failure xmlns='urn:ietf:params:xml:ns:xmpp-sasl'><not-authorized/></failure>"

curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
  "service": "ws://chat:5443",
  "domain": "duolicious.app",
  "resource": "testresource",
  "username": "'$user2uuid'",
  "password": "'$user2token'"
}'
sleep 0.5

echo user2 can still see user1\'s message after user1 deletes their account
curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<iq type='set' id='id3'>
  <inbox xmlns='erlang-solutions.com:xmpp:inbox:0' queryid='id3'>
    <x xmlns='jabber:x:data' type='form'/>
  </inbox>
</iq>
"
sleep 0.5

curl -sX GET http://localhost:3000/pop | grep -qF '<body>hello user 2</body>'

echo user1\'s records are no longer on the server
[[ "$(q "select count(*) from mam_message where user_id in ( \
  select user_id \
  from mam_server_user \
  where user_name = '$user1uuid')" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from last where username = '$user1uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from inbox where luser = '$user1uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from mam_server_user where user_name = '$user1uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from duo_last_notification where username = '$user1uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from duo_push_token where username = '$user1uuid'" duo_chat)" = 0 ]]
