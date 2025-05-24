# syntax=docker.io/docker/dockerfile:1.7-labs
FROM python:3.11

ENV DUO_USE_VENV=false
ENV PYTHONUNBUFFERED=true

WORKDIR /app

COPY \
  --exclude=test \
  --exclude=vm \
  . /app

RUN pip install --no-cache-dir -r /app/requirements.txt

CMD /app/cron.main.sh
