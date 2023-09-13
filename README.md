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

## Using pg_stat_statements:

```
~/duolicious-backend % sudo docker exec -it $(sudo docker ps | grep duolicious-backend-postgres | cut -d ' ' -f 1) psql -U postgres -d duo_api
[sudo] password for user:
psql (15.3 (Debian 15.3-1.pgdg120+1))
Type "help" for help.

duo_api=# CREATE EXTENSION pg_stat_statements;

duo_api=# select query, mean_exec_time, calls from pg_stat_statements order by total_exec_time desc;
```
