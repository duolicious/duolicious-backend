#!/usr/bin/env bash

sudo apt update
sudo apt install -y snapd

sudo snap install core

sudo snap install microk8s --classic

microk8s status --wait-ready

sudo usermod -a -G microk8s "$USER"
sudo chown -R "$USER" ~/.kube
newgrp microk8s

microk8s status --wait-ready

# microk8s enable community
microk8s enable dashboard
microk8s enable dns
microk8s enable registry
microk8s enable ingress
microk8s enable cert-manager
microk8s enable host-access # A new local network interface named lo:microk8s is created with a default IP address of 10.0.1.1.

microk8s.kubectl create secret generic duo-secrets \
  --from-literal=DUO_DB_PASS=your_duo_db_pass_value \
  --from-literal=DUO_EMAIL_KEY=your_duo_email_key_value \
  --from-literal=DUO_R2_ACCT_ID=your_duo_r2_acct_id_value \
  --from-literal=DUO_R2_ACCESS_KEY_ID=your_duo_r2_access_key_id_value \
  --from-literal=DUO_R2_ACCESS_KEY_SECRET=your_duo_r2_access_key_secret_value \
  --from-literal=DUO_REPORT_EMAIL=your_duo_report_email_value \
  --from-literal=DUO_SMTP_USER=your_duo_smtp_user_value \
  --from-literal=DUO_SMTP_PASS=your_duo_smtp_pass_value \
  --dry-run=client \
  -o yaml \
  > secrets.yaml

microk8s.kubectl apply -f secrets.yaml

microk8s.kubectl apply -f deployment.yaml

# Useful commands
#
# kubectl get pods
# kubectl top pods
# kubectl logs --timestamps --tail=50 $pod_name
# kubectl exec -it $pod_name -- /bin/bash
# microk8s.stop
# microk8s.start
# kubectl rollout restart deployment $deployment_name
# kubectl rollout history deployment/$deployent_name
# kubectl rollout undo deployment/your-deployment --to-revision=x
# kubectl rollout undo deployment/$deployent_name
