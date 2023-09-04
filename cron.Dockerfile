FROM python:latest

ENV DUO_USE_VENV=false

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir -r /app/cron.requirements.txt

CMD /app/cron.main.sh
