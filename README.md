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

## Payment capture and void

`POST /payments/{id}/capture` captures an authorized payment. Omit the request body or send `{}` to capture the full authorized amount; send `{ "amount": 25 }` to capture a partial amount. The amount must be a positive number no greater than the payment's authorized `amount`. A payment can be captured only once.

`POST /payments/{id}/void` voids an authorized payment. Capture and void requests for payments that are not authorized return HTTP 409. Unknown payment IDs return HTTP 404.

Payment state is currently held in a transition-only in-memory store. Payment creation and authorization are outside this change; when those flows are added, they must populate the same store. The capture body convention (omitted `amount` for full capture, numeric `amount` for partial capture) is provisional pending API contract confirmation.

## Tests and lint

Run the Jest test suite, which uses Supertest for HTTP requests:

```sh
npm test
```

Check JavaScript with ESLint:

```sh
npm run lint
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the ticket workflow and Definition of Done. The [changelog](CHANGELOG.md) records repository changes, and [docs/agent-log.md](docs/agent-log.md) records per-ticket agent work.
