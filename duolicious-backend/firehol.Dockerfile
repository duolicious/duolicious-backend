# syntax=docker.io/docker/dockerfile:1.7-labs
FROM python:3.11

ENV PYTHONUNBUFFERED=true
ENV PYTHONDONTWRITEBYTECODE=true
ENV PYTHONPATH=/app

WORKDIR /app

# Uses the monolithic requirements.txt for simpler config management. The
# server only needs `pytricia` + the stdlib, so most of what gets installed is
# unused here, but sharing one requirements file avoids drift.
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY service/firehol /app/service/firehol

CMD ["python3", "service/firehol/__init__.py"]
