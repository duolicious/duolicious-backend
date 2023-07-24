FROM mongooseim/mongooseim:6.1.0-5-gabdcd0b48

ENV JOIN_CLUSTER=false
ENV DUO_API_HOST=http://localhost:5000

COPY service/chat/mongooseim.toml /usr/lib/mongooseim/etc/mongooseim.toml
COPY service/chat/auth.sh /usr/lib/mongooseim/etc/auth.sh
COPY service/chat/jq /bin/jq
