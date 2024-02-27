FROM mongooseim/mongooseim:6.1.0-5-gabdcd0b48

ENV JOIN_CLUSTER=false
ENV DUO_API_HOST=http://localhost:5000
ENV DUO_USE_VENV=false
ENV PYTHONUNBUFFERED=true

# MongooseIM config
COPY service/chat/container/auth.sh /usr/lib/mongooseim/etc/auth.sh
COPY service/chat/container/init-db.sh /init-db.sh
COPY service/chat/container/init.sql /init.sql
COPY service/chat/container/jq /bin/jq
COPY service/chat/container/mongooseim.toml /mongooseim.template.toml

# Proxy
COPY database /app/database
COPY duohash /app/duohash
COPY service/chat/__init__.py /app/service/chat/__init__.py
COPY chat.main.sh /app
COPY chat.requirements.txt /app

RUN : \
  && apt update \
  && apt install -y lsb-release wget \
  && sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' \
  && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
  && apt update \
  && apt install -y gettext postgresql-client python3-pip libpq5 \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir -r /app/chat.requirements.txt

CMD : \
  && /init-db.sh \
  && ( /app/chat.main.sh & ) \
  && /start.sh
