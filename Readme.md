<p align="center">
<img src="https://avatars.githubusercontent.com/u/134650848?s=100&v=4" alt="Duolicious Hearts Logo" >
<h3 align="center">Duolicious</h3>
<p align="center">
The world's most popular open-source dating app.</p>
</p>

<p align="center">
<a href="https://x.com/duoliciousapp"><img src="https://img.shields.io/twitter/follow/duoliciousapp" alt="Duolicious Twitter"/></a>
<a href="https://www.reddit.com/r/duolicious/"><img src="https://img.shields.io/reddit/subreddit-subscribers/duolicious" alt="Duolicious Reddit"/></a>
</p>

This monorepo contains both halves of Duolicious:

| Directory | What it is |
| --- | --- |
| [`backend/`](backend/) | The API, chat, cron and supporting services (Python + Postgres). See its [README](backend/README.md) and [DEVELOPER.md](backend/DEVELOPER.md). |
| [`frontend/`](frontend/) | The cross-platform app (Expo / React Native, with a web build). See its [README](frontend/README.md) and [DEVELOPER.md](frontend/DEVELOPER.md). |

## Quickstart — run the whole app

Requirements: Docker (with Compose v2.20+).

```bash
git clone https://github.com/duolicious/duolicious
cd duolicious
docker compose up
```

This builds and starts the entire backend stack **and** the frontend web app
from a single command. Once it's up:

- **Frontend (web):** http://localhost:8081
- **API health:** http://localhost:5000/health
- **MailHog (test email UI):** http://localhost:8025
- **Mock S3:** http://localhost:9090
- **Status page:** http://localhost:8080

The frontend's default API URLs already point at the backend's published
localhost ports, so the web app talks to your local backend with no extra
configuration.

To seed a test user once the API is healthy:

```bash
(cd backend && ./test/util/create-user.sh alice 30 1 true)
```

## Working on just one half

You can still develop each side on its own — see the per-directory READMEs
and `DEVELOPER.md` files linked in the table above. The root
`docker compose up` is the easiest way to get everything running at once.

## Tests

CI runs the full test suite for both halves on every push and pull request to
`main` (see [`.github/workflows/`](.github/workflows/)):

- **Backend:** mypy, unit tests, and functionality suites 1–6.
- **Frontend:** ESLint, Jest, Playwright, and TypeScript type checks.

## Contributing

Want to help strangers on the internet find love? There are three ways you can
contribute!

1. Tell your friends about Duolicious and share on social media! This is the
   best way to make it grow.
2. Raise a pull request. Developer instructions live in each half's
   `DEVELOPER.md`.
3. Read the relevant `CONTRIBUTING.md`
   ([backend](backend/CONTRIBUTING.md) ·
   [frontend](frontend/CONTRIBUTING.md)) for coding standards, how
   to run tests, and what makes a great PR.
