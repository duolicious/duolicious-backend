FROM postgres:16.0

RUN : \
  && pgversion=$(psql --version | awk '{print $3}' | cut -d'.' -f1) \
  && apt-get update \
  && apt-get install -y \
    postgresql-${pgversion}-postgis-3 \
    postgresql-${pgversion}-pgvector \
    postgresql-contrib \
    postgresql-plpython3-${pgversion}
