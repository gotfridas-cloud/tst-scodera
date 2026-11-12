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

## Payment status webhooks

Set `PAYMENT_WEBHOOK_URL` and `PAYMENT_WEBHOOK_SECRET` to enable signed payment status notifications. The app exposes `app.locals.notifyPaymentStatusChanged({ paymentId, previousStatus, status })` for a status handler to call after its status change succeeds. It posts a JSON `payment.status_changed` event and sends the HMAC-SHA256 signature of the exact request body in the `X-Payment-Webhook-Signature` header as `sha256=<hex>`.

Delivery retries non-2xx responses and transport failures three times after the initial request, waiting 100 ms, 200 ms, and 400 ms. A 2xx response ends delivery. The notifier returns `true` on success and `false` after the retries are exhausted or when no URL is configured. Delivery is held in process memory and does not survive a restart. These event, configuration, signature, and retry conventions are provisional because PAY-8 did not specify a contract. This repository does not yet contain a payment status handler; the handler must call the notifier after a successful change.

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
