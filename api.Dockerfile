# syntax=docker.io/docker/dockerfile:1.7-labs
FROM python:3.11

ENV DUO_USE_VENV=false
ENV PYTHONUNBUFFERED=true

WORKDIR /app

COPY \
  --exclude=antiabuse/antiporn \
  --exclude=test \
  --exclude=vm \
  . /app

RUN : \
  && apt update \
  && apt install -y ffmpeg \
  && pip install --no-cache-dir -r /app/requirements.txt \
  && python -m spacy download en_core_web_sm

CMD /app/api.main.sh
