# Developer instructions

## Production deployments

### Environment variables

#### `api` container

* `DUO_ENV` - Should be set to `prod` for production deployments. Setting this to `prod` disables the ability to sign up with an OTP of 000000 by using an @example.com email address.

These environment variables let the `api` container know where your SMTP server is and how to log into it:

* `DUO_SMTP_HOST` - Your SMTP server's hostname. Might be something like [email-smtp.us-west-1.amazonaws.com](email-smtp.us-west-1.amazonaws.com) if you're using AWS SES.
* `DUO_SMTP_PORT` - Your SMTP server's port.
* `DUO_SMTP_USER` - Your SMTP server's username.
* `DUO_SMTP_PASS` - Your SMTP server's password.

The `api` container uses the SMTP server to sent one-time passwords to users who want to sign up or log in.

These environment variables let the `api` container know where your PostgreSQL database is:

* `DUO_DB_HOST` - Your PostgreSQL database's hostname.
* `DUO_DB_PORT` - Your PostgreSQL database's port.
* `DUO_DB_USER` - Your PostgreSQL database's username.
* `DUO_DB_PASS` - Your PostgreSQL database's password.

This environment variable allows the server to indicate any origins (domain, scheme, or port) other than its own from which a browser should permit loading resources:

* `DUO_CORS_ORIGINS` - Defaults to '*' if not set.

These environment variables specify where user-uploaded content is stored:

* `DUO_R2_BUCKET_NAME` - Refers to the bucket where user-uploaded images are stored.
* `DUO_R2_AUDIO_BUCKET_NAME` - Refers to the bucket where user-uploaded audio is stored.
* `DUO_R2_ACCT_ID` - Your account ID. This is assumed to be the same for both buckets (i.e. audio and images).
* `DUO_R2_ACCESS_KEY_ID` - Your access key ID. This is assumed to be the same for both buckets (i.e. audio and images).
* `DUO_R2_ACCESS_KEY_SECRET` - Your access key secret. This is assumed to be the same for both buckets (i.e. audio and images).
* `DUO_BOTO_ENDPOINT_URL` - Your endpoint URL. This defaults to `https://{R2_ACCT_ID}.r2.cloudflarestorage.com` if unset.

These env vars get passed to the `boto3` library, so they're compatible with AWS S3 despite containing `R2` in their names. The `api` container needs to have permissions to upload files to these buckets. Deletion is handled by the `cron` container.

#### `chat` container

These environment variables let the `chat` container know where your PostgreSQL database is:

* `DUO_DB_HOST` - Your PostgreSQL database's hostname.
* `DUO_DB_PORT` - Your PostgreSQL database's port.
* `DUO_DB_USER` - Your PostgreSQL database's username.
* `DUO_DB_PASS` - Your PostgreSQL database's password.

This environment variable determines which port, or ports, workers operate on:

* `DUO_CHAT_PORTS` - This could be a single number (e.g. `5443`) or a range (e.g. `5443-5447`). Specifying a range starts a worker for each port.

If you use more than one worker, you need to place a load balancer between the `chat` container and clients.

#### `cron` container

These environment variables let the `cron` container know where your SMTP server is and how to log into it:

* `DUO_SMTP_HOST` - Your SMTP server's hostname. Might be something like [email-smtp.us-west-1.amazonaws.com](email-smtp.us-west-1.amazonaws.com) if you're using AWS SES.
* `DUO_SMTP_PORT` - Your SMTP server's port.
* `DUO_SMTP_USER` - Your SMTP server's username.
* `DUO_SMTP_PASS` - Your SMTP server's password.

The `cron` container uses the SMTP server to sent message notifications, as well as notifications that a user's account has been deactivated due to inactivity.

These environment variables let the `cron` container know where your PostgreSQL database is:

* `DUO_DB_HOST` - Your PostgreSQL database's hostname.
* `DUO_DB_PORT` - Your PostgreSQL database's port.
* `DUO_DB_USER` - Your PostgreSQL database's username.
* `DUO_DB_PASS` - Your PostgreSQL database's password.

These environment variables specify where user-uploaded content is stored:

* `DUO_R2_BUCKET_NAME` - Refers to the bucket where user-uploaded images are stored.
* `DUO_R2_AUDIO_BUCKET_NAME` - Refers to the bucket where user-uploaded audio is stored.
* `DUO_R2_ACCT_ID` - Your account ID. This is assumed to be the same for both buckets (i.e. audio and images).
* `DUO_R2_ACCESS_KEY_ID` - Your access key ID. This is assumed to be the same for both buckets (i.e. audio and images).
* `DUO_R2_ACCESS_KEY_SECRET` - Your access key secret. This is assumed to be the same for both buckets (i.e. audio and images).
* `DUO_BOTO_ENDPOINT_URL` - Your endpoint URL. This defaults to `https://{R2_ACCT_ID}.r2.cloudflarestorage.com` if unset.

These env vars get passed to the `boto3` library, so they're compatible with AWS S3 despite containing `R2` in their names. The `api` container needs to have permissions to upload files to these buckets. Deletion is handled by the `cron` container.

* `OPENAI_API_KEY` - The OpenAI API key used to query ChatGPT while verifying accounts.

#### Redis

The `api` container requires a Redis instance accessible via `redis://redis:6379`. This address is currently hardcoded, [here](https://github.com/duolicious/duolicious-backend/blob/bb9d811df24fb06ee496e763a1b401f44aa4dd2e/service/application/decorators.py#L78).

### Proxies

Note also that `X-Forwarded-For` headers are treated as the user's real IP by
Duolicious, which assumes that there's a proxy between it and users.

If there's no proxy, `X-Forwarded-For` headers can be spoofed by users. This
will allow malicious users to partially bypass rate limits and bans.

Whether `X-Forwarded-For` is used or not should probably be configurable in
Duolicious, but it's currently not. Although hardcoding the solution isn't too
hard: Simply remove the use of `werkzeug.middleware.proxy_fix.ProxyFix`.

## Running the tests

Install these:

* Docker Compose
* jq
* curl
* ffmpeg

Then run this:

```bash
# Where ${n} is the test you want to run
./test/util/with-container.sh ./test/functionality${n}.sh
```

You can also do this in one terminal:

```bash
docker compose up
```

...Then run this in another:

```bash
# Where ${n} is the test you want to run
DUO_DB_PORT=5433 ./test/functionality${n}.sh
```

## Using pg_stat_statements:

```
~/duolicious-backend % sudo docker exec -it $(sudo docker ps | grep duolicious-backend-postgres | cut -d ' ' -f 1) psql -U postgres -d duo_api
[sudo] password for user:
psql (15.3 (Debian 15.3-1.pgdg120+1))
Type "help" for help.

duo_api=# CREATE EXTENSION pg_stat_statements;

duo_api=# select left(query, 100), mean_exec_time, calls from pg_stat_statements order by total_exec_time desc;

duo_api=# select pg_stat_statements_reset();
```

## Restoring a dumped database

Terminal A:

```bash
docker compose down --remove-orphans
docker compose up postgres
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
docker compose up
```

## Database logs and config (docker)

* /var/lib/postgresql/data/postgresql.conf
* /var/lib/postgresql/data/log/*

## Database logs and config (production)

* /etc/postgresql/16/main/postgresql.conf
* /var/lib/postgresql/16/main/postgresql.auto.conf
* /var/log/postgresql/postgresql-16-main.log
