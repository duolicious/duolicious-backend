FROM ejabberd/ecs

ENV DUO_API_HOST=http://localhost:5000

COPY service/chat/ejabberd.yml /home/ejabberd/conf/ejabberd.yml
COPY service/chat/auth.sh /home/ejabberd/auth.sh
COPY service/chat/jq /bin/jq
