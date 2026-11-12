# tst-scodera

Repository initialized.

## Payment test cards

Use these application-defined test card numbers to select deterministic outcomes
in the payment creation flow:

| Card number | Expected outcome |
| --- | --- |
| `4242 4242 4242 4242` | Payment succeeds (`succeeded`). |
| `4000 0000 0000 9995` | Payment is declined for insufficient funds. |
| `4000 0025 0000 3155` | Payment requires 3-D Secure authentication (`requires_action`). |
| `4000 0000 0000 0119` | Simulated technical error; the API returns HTTP 503. |

These numbers define the intended local test behavior and do not represent real
payment credentials. This repository currently contains no payment creation API,
so the outcomes are documented here but are not yet wired to a running flow.
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

## Create a payment

Create a payment with `POST http://localhost:3000/payments`. Include a unique `Idempotency-Key` header and a JSON body:

```json
{
  "amount": 1250,
  "currency": "EUR",
  "card": "4242424242424242"
}
```

`amount` is a positive integer in minor units, and `currency` must be `EUR`, `USD`, or `GBP`. The card value is currently checked for a 12–19 digit format and a valid Luhn checksum. The accepted test-card list remains to be defined by PAY-5. Successful requests return HTTP 201 with a payment `id` and `status: "pending"`. Repeating the same key and request returns the same payment; using the key with a different request returns HTTP 422. Validation failures return HTTP 400 with an error code in `error.code`.

## Retrieve a payment

Retrieve a payment with `GET http://localhost:3000/payments/{id}`. A stored payment returns HTTP 200 with its `id`, `status`, `amount`, `currency`, and `cardLast4` fields. The card number is not stored or returned; `cardLast4` contains only its final four digits. An unknown ID returns HTTP 404 with `error.code: "PAYMENT_NOT_FOUND"`.

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
