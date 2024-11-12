FROM python:3.11

ENV DUO_USE_VENV=false
ENV PYTHONUNBUFFERED=true

WORKDIR /app

COPY . /app

RUN : \
  && apt update \
  && apt install -y ffmpeg \
  && pip install --no-cache-dir -r /app/api.requirements.txt

CMD /app/api.main.sh
