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

## 3-D Secure simulation

Create a 3-D Secure payment with `POST /payments`, sending `amount`, `currency`, and the application test card number `4000 0025 0000 3155` in `card_number` (or `card.number`):

```json
{
  "amount": 1250,
  "currency": "USD",
  "card_number": "4000 0025 0000 3155"
}
```

The response has status `requires_action` and includes a `redirect_url`. Complete the challenge with `POST /payments/{id}/3ds` and a JSON body of `{ "result": "success" }` or `{ "result": "fail" }`. Success changes the payment to `authorized`; failure changes it to `failed`. A challenge expires after ten minutes and changes to `failed`. A challenge submission when it is no longer pending returns HTTP 409.

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
