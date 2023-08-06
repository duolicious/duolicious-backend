FROM python:latest

ENV DUO_USE_VENV=false

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir -r /app/api.requirements.txt

CMD /app/api.main.sh
