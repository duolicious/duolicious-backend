<p align="center">
<img src="https://avatars.githubusercontent.com/u/134650848?s=100&v=4" alt="Duolicious Hearts Logo" >
<h3 align="center">Duolicious Backend</h3>
<p align="center">
The backend of the world's most popular open-source dating app.</p>
</p>

<p align="center">
<a href="https://github.com/duolicious/duolicious-backend/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/duolicious/duolicious-backend/.github%2Fworkflows%2Ftest.yml?label=Tests" alt="Build status"/></a>
<a href="https://duolicious.app/"><img src="https://img.shields.io/badge/Based-True--love_pilled-7700ff" alt="Based and true-love pilled"/></a>
</p>

<p align="center">
<a href="https://x.com/duoliciousapp"><img src="https://img.shields.io/twitter/follow/duoliciousapp" alt="Duolicious Twitter"/></a>
<a href="https://www.reddit.com/r/duolicious/"><img src="https://img.shields.io/reddit/subreddit-subscribers/duolicious" alt="Duolicious Reddit"/></a>
</p>

## Screenshots

There's screenshots of the app at https://github.com/duolicious.

## Quickstart (copy & paste)

Requirements: Docker (with Compose), jq, curl, ffmpeg, zstd

```bash
# 1) Clone and start the full dev stack
git clone https://github.com/duolicious/duolicious-backend
cd duolicious-backend
docker compose up -d

# 2) Wait for the API to be healthy
curl -sf http://localhost:5000/health && echo OK

# 3) Create a test user and seed data (OTP is auto-handled in dev)
./test/util/create-user.sh alice 30 1 true
```

- The command above signs up `alice@example.com`, finishes onboarding, answers questions, adds a photo and an audio bio.
- Use `./test/util/create-user.sh bob 50 2` to create more sample users.

## Run tests

Run one test file in a disposable environment:

```bash
./test/util/with-container.sh ./test/functionality1/status.sh
```

Run an entire test suite (e.g. all tests in functionality1):

```bash
./test/util/with-container.sh ./test/functionality.sh 1
```

## Common local URLs

- API: [http://localhost:5000/health](http://localhost:5000/health)
- Chat (WebSocket): `ws://localhost:5443`
- Mock S3 UI/endpoint: [http://localhost:9090](http://localhost:9090)
- MailHog (test email UI): [http://localhost:8025](http://localhost:8025)
- Postgres (host port): `localhost:5432`
- Status page: [http://localhost:8080](http://localhost:8080)
- PgAdmin: [http://localhost:8090](http://localhost:8090)

## Local development

Prefer Docker? You already started everything with `docker compose up -d`.

Prefer running the services from source (hot reload)? See the "Local development" section in [DEVELOPER.md](DEVELOPER.md).

## Contributing

Want to help strangers on the internet find love? There's three ways you can contribute!

1. Tell your friends about Duolicious and share on social media! This is the best way to make it grow.
2. Raise a pull request. Developer instructions can be found at [DEVELOPER.md](DEVELOPER.md).
3. Read our [CONTRIBUTING guide](CONTRIBUTING.md) for coding standards, how to run tests, and what makes a great PR.
