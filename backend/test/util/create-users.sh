#!/usr/bin/env bash
# Create multiple test users concurrently using ./create-user.sh.
# - Generates users: user1..user10 ("user{}" expands 1..10 via seq)
# - Runs up to 16 jobs in parallel (requires GNU parallel)
# - Each user answers 100 questions and uploads 1 photo
#
# Usage:
#   ./create-users.sh
#
# Notes:
# - Relies on ./create-user.sh and its prerequisites
# - Edit the last line to change count, parallelism, questions, photos, or username prefix

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

seq 10 | parallel -j16 ./create-user.sh "user{}" 100 1
