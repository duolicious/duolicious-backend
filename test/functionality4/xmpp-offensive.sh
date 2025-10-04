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

assume_role user1 ; user1token=$SESSION_TOKEN
assume_role user2 ; user2token=$SESSION_TOKEN

user1uuid=$(get_uuid 'user1@example.com')
user2uuid=$(get_uuid 'user2@example.com')

user1id=$(get_id 'user1@example.com')
user2id=$(get_id 'user2@example.com')



sleep 3



curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
  "service": "ws://chat:5443",
  "domain": "duolicious.app",
  "resource": "testresource",
  "username": "'$user1uuid'",
  "password": "'$user1token'"
}'



sleep 3



echo A potentially offensive message is blocked

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user1uuid@duolicious.app'
    to='$user2uuid@duolicious.app'
    id='id1'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>CAN I PLEASE BUTT FUCK YOU?</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 3 # MongooseIM takes some time to flush messages to the DB

[[ "$(q "select count(*) from messaged where \
    subject_person_id = $user1id and \
    object_person_id = $user2id")" = 0 ]]
[[ "$(q "select count(*) from messaged")" = 0 ]]

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_blocked id="id1" reason="offensive"/>'

[[ "$(q "select count(*) from mam_message")" = 0 ]]
[[ "$(q "select count(*) from rude_message")" = 1 ]]



echo Another potentially offensive message is blocked

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user1uuid@duolicious.app'
    to='$user2uuid@duolicious.app'
    id='id1'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>We can only talk about porn in later messages</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 3 # MongooseIM takes some time to flush messages to the DB

[[ "$(q "select count(*) from messaged where \
    subject_person_id = $user1id and \
    object_person_id = $user2id")" = 0 ]]
[[ "$(q "select count(*) from messaged")" = 0 ]]

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_blocked id="id1" reason="offensive"/>'

[[ "$(q "select count(*) from mam_message")" = 0 ]]
[[ "$(q "select count(*) from rude_message")" = 2 ]]




echo A benign message is allowed

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user1uuid@duolicious.app'
    to='$user2uuid@duolicious.app'
    id='id1'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>damn I want to volunteer to walk puppies</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 3 # MongooseIM takes some time to flush messages to the DB

[[ "$(q "select count(*) from messaged where \
    subject_person_id = $user1id and \
    object_person_id = $user2id")" = 1 ]]
[[ "$(q "select count(*) from messaged")" = 1 ]]

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="id1"/>'

[[ "$(q "select count(*) from mam_message")" = 2 ]]
[[ "$(q "select count(*) from rude_message")" = 2 ]]



echo 3



echo Poentially offensive messages are allowed during established conversations

curl -X POST http://localhost:3000/config -H "Content-Type: application/json" -d '{
  "service": "ws://chat:5443",
  "domain": "duolicious.app",
  "resource": "testresource",
  "username": "'$user2uuid'",
  "password": "'$user2token'"
}'

echo 3

curl -X POST http://localhost:3000/send -H "Content-Type: application/xml" -d "
<message
    type='chat'
    from='$user2uuid@duolicious.app'
    to='$user1uuid@duolicious.app'
    id='id1'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>We can only talk about porn in later messages</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"

sleep 3 # MongooseIM takes some time to flush messages to the DB

[[ "$(q "select count(*) from messaged where \
    subject_person_id = $user2id and \
    object_person_id = $user1id")" = 1 ]]
[[ "$(q "select count(*) from messaged")" = 2 ]]

curl -sX GET http://localhost:3000/pop | grep -qF '<duo_message_delivered id="id1"/>'

[[ "$(q "select count(*) from mam_message")" = 4 ]]
[[ "$(q "select count(*) from rude_message")" = 2 ]]
