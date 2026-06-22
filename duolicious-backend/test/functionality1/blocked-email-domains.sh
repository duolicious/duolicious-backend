#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

bad_email_domains_table_is_respected () {
  q "delete from person"
  q "delete from duo_session"

  q "INSERT INTO bad_email_domain (domain) VALUES ('bad.example.com')";

  ../util/create-user.sh bad-user-1  0 0
  ../util/create-user.sh good-user-1 0 0

  q "
    update
      person
    set
      email = 'bad-user-1@bad.example.com',
      normalized_email = 'bad-user-1@bad.example.com'
    where
      email = 'bad-user-1@example.com'"

  echo "Existing users can continue logging in with a blocked domain"
  assume_role 'bad-user-1@bad.example.com'
  assume_role 'good-user-1@example.com'

  echo "New users can't sign up with a blocked domain"
  ! jc POST /request-otp -d '{ "email": "bad-user-2@bad.example.com" }' || exit 1

  echo "New users can sign up with a non-blocked domain"
    jc POST /request-otp -d '{ "email": "good-user-2@example.com" }'
}

unknown_domains_are_blocked () {
  echo 'unknown domains are blocked'

  q "delete from person"
  q "delete from duo_session"

  ! ../util/create-user.sh user@unknown.example.com 0 0
}

bad_email_domains_table_is_respected
unknown_domains_are_blocked
