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

## Payment status webhooks

Set `PAYMENT_WEBHOOK_URL` and `PAYMENT_WEBHOOK_SECRET` to enable signed payment status notifications. A payment status handler can wrap its persistence operation with `app.locals.createPaymentStatusUpdateHandler(updateStatus)`. The wrapper sends an event after the store returns a changed payment and does not send one if the update fails or leaves the status unchanged. It posts a JSON `payment.status_changed` event and sends the HMAC-SHA256 signature of the exact request body in the `X-Payment-Webhook-Signature` header as `sha256=<hex>`.

Delivery retries non-2xx responses and transport failures three times after the initial request, waiting 100 ms, 200 ms, and 400 ms. A 2xx response ends delivery. The notifier returns `true` on success and `false` after the retries are exhausted or when no URL is configured. Delivery is held in process memory and does not survive a restart. These event, configuration, signature, and retry conventions are provisional because PAY-8 did not specify a contract. This repository has no payment store or status route; status handlers must wrap their existing store update with the app's adapter.
## Payment capture and void

`POST /payments/{id}/capture` captures an authorized payment. Omit the request body or send `{}` to capture the full authorized amount; send `{ "amount": 25 }` to capture a partial amount. The amount must be a positive number no greater than the payment's authorized `amount`. A payment can be captured only once.

`POST /payments/{id}/void` voids an authorized payment. Capture and void requests for payments that are not authorized return HTTP 409. Unknown payment IDs return HTTP 404.

Payment state is currently held in a transition-only in-memory store. Payment creation and authorization are outside this change; when those flows are added, they must populate the same store. The capture body convention (omitted `amount` for full capture, numeric `amount` for partial capture) is provisional pending API contract confirmation.
## 3-D Secure simulation

Create a 3-D Secure payment with `POST /payments`, sending `amount`, `currency`, and the application test card number `4000 0025 0000 3155` in `card_number` (or `card.number`):
## Create a payment

Create a payment with `POST http://localhost:3000/payments`. Include a unique `Idempotency-Key` header and a JSON body:

```json
{
  "amount": 1250,
  "currency": "USD",
  "card_number": "4000 0025 0000 3155"
}
```

The response has status `requires_action` and includes a `redirect_url`. Complete the challenge with `POST /payments/{id}/3ds` and a JSON body of `{ "result": "success" }` or `{ "result": "fail" }`. Success changes the payment to `authorized`; failure changes it to `failed`. A challenge expires after ten minutes and changes to `failed`. A challenge submission when it is no longer pending returns HTTP 409.
  "currency": "EUR",
  "card": "4242424242424242"
}
```

`amount` is a positive integer in minor units, and `currency` must be `EUR`, `USD`, or `GBP`. The card value is currently checked for a 12–19 digit format and a valid Luhn checksum. The accepted test-card list remains to be defined by PAY-5. Successful requests return HTTP 201 with a payment `id` and `status: "pending"`. Repeating the same key and request returns the same payment; using the key with a different request returns HTTP 422. Validation failures return HTTP 400 with an error code in `error.code`.

## Retrieve a payment

Retrieve a payment with `GET http://localhost:3000/payments/{id}`. A stored payment returns HTTP 200 with its `id`, `status`, `amount`, `currency`, and `cardLast4` fields. The card number is not stored or returned; `cardLast4` contains only its final four digits. An unknown ID returns HTTP 404 with `error.code: "PAYMENT_NOT_FOUND"`.

## End-to-end payment example

After starting the server, this shell flow creates a payment, reads its ID from the response with Node.js, and retrieves that payment. The sample card number passes the API's current format and Luhn checks.

```sh
payment_response=$(curl --fail --silent --show-error \
  -X POST http://localhost:3000/payments \
  -H 'Idempotency-Key: payment-example-001' \
  -H 'Content-Type: application/json' \
  --data '{"amount":1250,"currency":"EUR","card":"4242424242424242"}')

printf '%s\n' "$payment_response"
payment_id=$(printf '%s' "$payment_response" | node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(0, "utf8")).id)')

curl --fail --silent --show-error "http://localhost:3000/payments/$payment_id"
```

The OpenAPI contract is in [openapi.yaml](openapi.yaml).

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
