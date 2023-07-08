FROM postgres

RUN : \
  && pgversion=$(psql --version | awk '{print $3}' | cut -d'.' -f1) \
  && apt-get update \
  && apt-get install -y \
    python3-numpy \
    postgis \
    postgresql-${pgversion}-pgvector \
    postgresql-contrib \
    postgresql-plpython3-${pgversion}
