FROM python:3.11

ENV DUO_USE_VENV=false

WORKDIR /app

COPY . /app

RUN : \
  && apt update \
  && apt install -y lsb-release wget \
  && sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' \
  && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
  && apt update \
  && apt install -y libpq5 \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir -r /app/api.requirements.txt

CMD /app/api.main.sh
