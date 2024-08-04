#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

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
q "delete from duo_push_token" duo_chat
q "delete from intro_hash" duo_chat

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0
../util/create-user.sh user3 0 0

q "update person set intros_notification = 1"

assume_role user1 ; user1token=$SESSION_TOKEN
assume_role user2 ; user2token=$SESSION_TOKEN
assume_role user3 ; user3token=$SESSION_TOKEN

user1uuid=$(get_uuid 'user1@example.com')
user2uuid=$(get_uuid 'user2@example.com')
user3uuid=$(get_uuid 'user3@example.com')

user1id=$(get_id 'user1@example.com')
user2id=$(get_id 'user2@example.com')
user3id=$(get_id 'user3@example.com')

# Report user2 so we can test that banning them deletes their messages
jc POST "/skip/by-uuid/${user2uuid}" -d '{ "report_reason": "smells bad" }'
ban_token=$(
  q "select token from banned_person_admin_token where person_id = $user2id")

curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
  "service": "ws://chat:5443",
  "domain": "duolicious.app",
  "resource": "testresource",
  "username": "'$user1uuid'",
  "password": "'$user1token'"
}'

sleep 0.5



echo If user 2 blocks user 1 then user 1 can no longer message user 2

q "insert into skipped values ($user2id, $user1id, false, 'testing blocking')"

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

[[ "$(q "select count(*) from messaged where \
    subject_person_id = $user1id and \
    object_person_id = $user2id")" = 0 ]]
[[ "$(q "select count(*) from messaged")" = 0 ]]

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_blocked id="id1"/>'

[[ "$(q "select count(*) from mam_message where \
    search_body = 'hello user 2'" duo_chat)" = 0 ]]

q "delete from skipped where subject_person_id = $user2id and object_person_id = $user1id"

sleep 5  # Wait for ttl cache to expire



echo User 1 can message user 2

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

[[ "$(q "select count(*) from messaged where \
    subject_person_id = $user1id and \
    object_person_id = $user2id")" = 1 ]]
[[ "$(q "select count(*) from messaged")" = 1 ]]

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="id1"/>'

[[ "$(q "select count(*) from mam_message where \
    search_body = 'hello user 2'" duo_chat)" = 2 ]]

[[ "$(q "select count(*) from inbox where \
    luser = '${user1uuid}' and \
    remote_bare_jid = '${user2uuid}@duolicious.app' and \
    box = 'chats'" duo_chat)" = 1 ]]

[[ "$(q "select count(*) from inbox where \
    luser = '${user2uuid}' and \
    remote_bare_jid = '${user1uuid}@duolicious.app' and \
    box = 'inbox'" duo_chat)" = 1 ]]



echo The push token should be acknowledged and inserted into the database

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<duo_register_push_token token='user-1-token' />
"

sleep 0.5

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_registration_successful />'
[[ "$(q "select count(*) from duo_push_token \
    where username = '$user1uuid' \
    and token = 'user-1-token'" duo_chat)" = 1 ]]



echo Unoriginal intros are rejected
curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user1uuid@duolicious.app'
    to='$user3uuid@duolicious.app'
    id='id2'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>hello user 2</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 3 # MongooseIM takes some time to flush messages to the DB

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_not_unique id="id2"/>'

[[ "$(q "select count(*) from mam_message where \
    search_body = 'hello user 2'" duo_chat)" = 2 ]]

[[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]



echo 'User 1 can message user 3 and notification is sent'

q "insert into duo_push_token values ('$user2uuid', 'user-2-token')" duo_chat
q "insert into duo_push_token values ('$user3uuid', 'user-3-token')" duo_chat

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user1uuid@duolicious.app'
    to='$user3uuid@duolicious.app'
    id='id3'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>hello user 3</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 3 # MongooseIM takes some time to flush messages to the DB

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="id3"/>'

[[ "$(q "select count(*) from mam_message where \
    search_body = 'hello user 3'" duo_chat)" = 2 ]]

[[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 1 ]]



echo "User 1 can send user 3 an unoriginal message now that they're chatting"

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user1uuid@duolicious.app'
    to='$user3uuid@duolicious.app'
    id='id3'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>hello user 2</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 3 # MongooseIM takes some time to flush messages to the DB

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="id3"/>'

[[ "$(q "select count(*) from mam_message where \
    search_body = 'hello user 2'" duo_chat)" = 4 ]]

[[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 1 ]]



echo user 1 should no longer be authorized to chat after deleting their account

assume_role user1

c DELETE /account

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
[[ "$(q "select count(*) from inbox where luser = '$user1uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from mam_server_user where user_name = '$user1uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from duo_last_notification where username = '$user1uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from duo_push_token where username = '$user1uuid'" duo_chat)" = 0 ]]



echo 'Banning user2 deletes them from the XMPP server'

c GET "/admin/ban/${ban_token}"

[[ "$(q "select count(*) from mam_message where user_id in ( \
  select user_id \
  from mam_server_user \
  where user_name = '$user2uuid')" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from inbox where luser = '$user2uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from mam_server_user where user_name = '$user2uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from duo_last_notification where username = '$user2uuid'" duo_chat)" = 0 ]]
[[ "$(q "select count(*) from duo_push_token where username = '$user2uuid'" duo_chat)" = 0 ]]
