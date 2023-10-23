# Duolicious Backend

## Running the tests

Install these:

* Docker Compose
* jq
* curl
* ImageMagick

Then run this:

```bash
./test/util/with-container.sh ./test/functionality.sh
```

You can also do this in one terminal:

```bash
docker-compose up
```

...Then run this in another:

```bash
DUO_DB_PORT=5433 ./test/functionality.sh
```

## Using pg_stat_statements:

```
~/duolicious-backend % sudo docker exec -it $(sudo docker ps | grep duolicious-backend-postgres | cut -d ' ' -f 1) psql -U postgres -d duo_api
[sudo] password for user:
psql (15.3 (Debian 15.3-1.pgdg120+1))
Type "help" for help.

duo_api=# CREATE EXTENSION pg_stat_statements;

duo_api=# select query, mean_exec_time, calls from pg_stat_statements order by total_exec_time desc;
```

## Restoring a dumped database

Terminal A:

```bash
docker-compose down --remove-orphans
docker-compose up postgres
```

Terminal B:
```bash
pg_dump -h ${DB_HOST} -U postgres -d duo_chat -f /tmp/duo_chat.sql
pg_dump -h ${DB_HOST} -U postgres -d duo_api  -f /tmp/duo_api.sql

PGPASSWORD=password psql -U postgres -h localhost -p 5433 -c 'create database duo_api;'
PGPASSWORD=password psql -U postgres -h localhost -p 5433 -c 'create database duo_chat;'

PGPASSWORD=password psql -U postgres -d duo_api  -h localhost -p 5433 < /tmp/duo_api.sql
PGPASSWORD=password psql -U postgres -d duo_chat -h localhost -p 5433 < /tmp/duo_chat.sql
```

Terminal A:

```bash
^C
docker-compose up
```
