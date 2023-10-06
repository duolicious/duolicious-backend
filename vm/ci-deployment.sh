#!/usr/bin/env bash

set -ex

branch=$1
commit_sha=$2

sudo zfs snapshot "dbpool@commit_${commit_sha}"

sed -i "s|{{branch}}|$branch|g" deployment.yaml
sed -i "s|{{commit_sha}}|$commit_sha|g" deployment.yaml

microk8s.kubectl apply -f deployment.yaml

microk8s.kubectl rollout status deployment --timeout=300s
