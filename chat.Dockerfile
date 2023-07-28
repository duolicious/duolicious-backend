FROM mongooseim/mongooseim:6.1.0-5-gabdcd0b48

ENV JOIN_CLUSTER=false
ENV DUO_API_HOST=http://localhost:5000

COPY service/chat/container/auth.sh /usr/lib/mongooseim/etc/auth.sh
COPY service/chat/container/init-db.sh /init-db.sh
COPY service/chat/container/jq /bin/jq
COPY service/chat/container/mongooseim.toml /mongooseim.template.toml

RUN : \
  && apt update \
  && apt install -y gettext postgresql-client \
  && rm -rf /var/lib/apt/lists/*

CMD : \
  && /init-db.sh \
  && /start.sh
