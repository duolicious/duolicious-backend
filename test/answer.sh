#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source setup.sh

curl \
  -vvvv \
  localhost:5000/personality/1 \
  -X GET

exit

x=false

if $x
then
  curl \
    -vvvv \
    localhost:5000/answer \
    -X DELETE \
    --header "Content-Type: application/json" \
    -d '
    {
      "person_id": 1,
      "question_id": 1
    }
  '
fi

if ! $x
then
  for n in {1..400}
  do
    curl \
      -s \
      localhost:5000/question/$n | jq -r '.question'

    read -p "answer: " answer

    json_answer=false
    if [[ "$answer" == 'y' ]]
    then
      json_answer=true
    fi

    curl \
      -s \
      localhost:5000/answer \
      -X PUT \
      --header "Content-Type: application/json" \
      -d "
      {
        \"person_id\": 1,
        \"question_id\": $n,
        \"answer\": $json_answer,
        \"public\": true
      }
    "
  done
fi

exit

curl \
  -vvvv \
  localhost:5000/answer \
  -X PUT \
  --header "Content-Type: application/json" \
  -d '
  {
    "person_id": 1,
    "question_id": 1,
    "answer": true,
    "public": true
  }
'

exit
