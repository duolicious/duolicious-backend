FROM python:3.11

ENV DUO_USE_VENV=false
ENV PYTHONUNBUFFERED=true

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir -r /app/cron.requirements.txt

CMD /app/cron.main.sh
