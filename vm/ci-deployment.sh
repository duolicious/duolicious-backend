#!/usr/bin/env bash

set -e

commit_sha=$1

sudo zfs snapshot "dbpool@commit_${commit_sha}"

sed -i "s/{{commit_sha}}/$commit_sha/g" deployment.yaml

microk8s.kubectl apply -f deployment.yaml
