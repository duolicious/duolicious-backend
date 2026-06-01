# syntax=docker.io/docker/dockerfile:1.7-labs
FROM python:3.11

ENV DUO_USE_VENV=false
ENV PYTHONUNBUFFERED=true

WORKDIR /app

COPY \
  --exclude=test \
  --exclude=vm \
  . /app

# `service/cron/autodeactivate2` imports `sessioncache`, which imports
# `duotypes`, which loads the spaCy model `en_core_web_sm` at import time (via
# antiabuse.normalize). Without the model the whole cron process dies on
# startup, taking every cron job down with it. The api and chat images download
# the same model for the same reason.
RUN pip install --no-cache-dir -r /app/requirements.txt \
  && python -m spacy download en_core_web_sm

CMD /app/cron.main.sh
