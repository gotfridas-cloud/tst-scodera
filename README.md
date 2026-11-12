# tst-scodera

## Requirements

- Node.js 20
- npm (included with Node.js)

## Setup

Install the project dependencies from the repository root:

```sh
npm ci
```

## Run the server

Start the server with:

```sh
npm start
```

The server listens on port `3000` by default. Set the `PORT` environment variable to use a different port. The health endpoint is available at `GET http://localhost:3000/health` and responds with HTTP 200 and `{ "status": "ok" }`.

## Tests and lint

Run the Jest test suite, which uses Supertest for HTTP requests:

```sh
npm test
```

Check JavaScript with ESLint:

```sh
npm run lint
```

## Run with Docker Compose

Build the Node.js 20 image and start the service with:

```sh
docker compose up --build
```

The health endpoint is available at `http://localhost:3000/health`. Stop the service with `Ctrl+C`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the ticket workflow and Definition of Done. The [changelog](CHANGELOG.md) records repository changes, and [docs/agent-log.md](docs/agent-log.md) records per-ticket agent work.
