FROM mongooseim/mongooseim:6.1.0-5-gabdcd0b48

ENV JOIN_CLUSTER=false
ENV DUO_USE_VENV=false
ENV PYTHONUNBUFFERED=true

WORKDIR /app

# MongooseIM config
COPY service/chat/container/init-db.sh /init-db.sh
COPY service/chat/container/init.sql /init.sql
COPY service/chat/container/mongooseim.toml /usr/lib/mongooseim/etc/mongooseim.toml

# Proxy
COPY antiabuse/__init__.py /app/antiabuse/__init__.py
COPY antiabuse/antirude /app/antiabuse/antirude
COPY antiabuse/antispam /app/antiabuse/antispam
COPY antiabuse/normalize /app/antiabuse/normalize
COPY database /app/database
COPY duohash /app/duohash
COPY batcher /app/batcher
COPY notify /app/notify
COPY async_lru_cache /app/async_lru_cache
COPY sql /app/sql
COPY service/chat /app/service/chat
COPY chat.main.sh /app
COPY chat.auth.main.sh /app
COPY chat.requirements.txt /app

RUN : \
  && apt update \
  && apt install -y lsb-release wget \
  && sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' \
  && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
  && apt update \
  && apt install -y postgresql-client python3-pip libpq5 \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir -r /app/chat.requirements.txt

CMD : \
  && /init-db.sh \
  && ( /app/chat.main.sh & ) \
  && /start.sh
