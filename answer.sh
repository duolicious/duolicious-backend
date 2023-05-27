#!/bin/bash

set -e

# Read the json file
json_file='answers.json'

put_line() {
  local line=$1

  # Empty the array
  local record=()

  # Extract person_id, question_id, answer and public from each array
  while IFS= read -r line; do
    record+=("$line")
  done < <(echo "$i" | jq -r '.[0], .[1], .[3]')

  local person_id=${record[0]}
  local question_id=${record[1]}
  local answer=${record[2]}

  # Prepare the payload for the PUT request
  local payload=$(cat <<EOF
  {
    "person_id": $person_id,
    "question_id": $question_id,
    "answer": $answer,
    "public": true
  }
EOF
  )

  # Perform the HTTP PUT request
  curl -X PUT -H "Content-Type: application/json" -d "$payload" http://localhost:5000/answer

  echo "$question_id"
}

# Parse the json file with jq
cat $json_file | jq -c '.[]' | while IFS= read -r i; do
  put_line "$i"
done

