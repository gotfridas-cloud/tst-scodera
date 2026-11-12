const request = require('supertest');
const app = require('../src/app');

const paymentId = 'payment-1';
const authorizedAmount = 100;

function authorizedPayment(overrides = {}) {
  return {
    id: paymentId,
    amount: authorizedAmount,
    currency: 'USD',
    status: 'authorized',
    ...overrides,
  };
}

function seedPayment(payment) {
  app.locals.paymentStore.payments.clear();
  app.locals.paymentStore.payments.set(payment.id, payment);
}

describe('payment capture and void', () => {
  beforeEach(() => {
    app.locals.paymentStore.payments.clear();
  });

  test('full capture sets the captured amount to the authorized amount and status to captured', async () => {
    seedPayment(authorizedPayment());

    const response = await request(app).post(`/payments/${paymentId}/capture`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      amount: authorizedAmount,
      captured_amount: authorizedAmount,
      status: 'captured',
    });
  });

  test('partial capture at or below the authorized amount captures the requested amount', async () => {
    seedPayment(authorizedPayment());
    const requestedAmount = 40;

    const response = await request(app)
      .post(`/payments/${paymentId}/capture`)
      .send({ amount: requestedAmount });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      amount: authorizedAmount,
      captured_amount: requestedAmount,
      status: 'captured',
    });
  });

  test('capture at exactly the authorized amount is accepted', async () => {
    seedPayment(authorizedPayment());

    const response = await request(app)
      .post(`/payments/${paymentId}/capture`)
      .send({ amount: authorizedAmount });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      captured_amount: authorizedAmount,
      status: 'captured',
    });
  });

  test('capture above the authorized amount is rejected without over-capturing', async () => {
    const payment = authorizedPayment();
    seedPayment(payment);

    const response = await request(app)
      .post(`/payments/${paymentId}/capture`)
      .send({ amount: authorizedAmount + 1 });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(payment.status).toBe('authorized');
    expect(payment.captured_amount).toBeUndefined();
  });

  test('a second capture after capture returns HTTP 409 and preserves the captured amount', async () => {
    const payment = authorizedPayment();
    seedPayment(payment);

    await request(app)
      .post(`/payments/${paymentId}/capture`)
      .send({ amount: 40 });
    const response = await request(app)
      .post(`/payments/${paymentId}/capture`)
      .send({ amount: 30 });

    expect(response.status).toBe(409);
    expect(payment.status).toBe('captured');
    expect(payment.captured_amount).toBe(40);
  });

  test('capture is rejected for a voided payment and leaves its status unchanged', async () => {
    const payment = authorizedPayment({ status: 'voided' });
    seedPayment(payment);

    const response = await request(app)
      .post(`/payments/${paymentId}/capture`)
      .send({ amount: 40 });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(payment.status).toBe('voided');
    expect(payment.captured_amount).toBeUndefined();
  });

  test('voiding an authorized payment changes its status to voided', async () => {
    const payment = authorizedPayment();
    seedPayment(payment);

    const response = await request(app).post(`/payments/${paymentId}/void`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('voided');
    expect(payment.status).toBe('voided');
  });

  test.each(['captured', 'voided', 'pending'])(
    'voiding a payment with status %s is rejected without changing its status',
    async (status) => {
      const payment = authorizedPayment({ status });
      seedPayment(payment);

      const response = await request(app).post(`/payments/${paymentId}/void`);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(payment.status).toBe(status);
    },
  );

  test('concurrent captures allow at most one success and never capture more than authorized', async () => {
    const payment = authorizedPayment();
    seedPayment(payment);

    const responses = await Promise.all([
      request(app).post(`/payments/${paymentId}/capture`).send({ amount: 60 }),
      request(app).post(`/payments/${paymentId}/capture`).send({ amount: 50 }),
    ]);

    expect(responses.filter((response) => response.status === 200).length).toBeLessThanOrEqual(1);
    expect(payment.captured_amount ?? 0).toBeLessThanOrEqual(authorizedAmount);
const jestApi = require('@jest/globals').jest;
const app = require('../src/app');
const { PaymentStore, THREE_DS_CHALLENGE_TTL_MS } = require('../src/paymentStore');

const threeDsCard = '4000 0025 0000 3155';

describe('3-D Secure payments', () => {
  test('creates a payment requiring action and returns a redirect URL', async () => {
    const response = await request(app)
      .post('/payments')
      .send({ amount: 1250, currency: 'USD', card_number: threeDsCard });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      amount: 1250,
      currency: 'USD',
      status: 'requires_action',
    });
    expect(response.body.redirect_url).toBe(`/3ds/challenge/${response.body.id}`);
  });

  test.each([
    ['success', 'authorized'],
    ['fail', 'failed'],
  ])('moves a challenge with result %s to the expected payment status', async (result, expectedStatus) => {
    const created = await request(app)
      .post('/payments')
      .send({ amount: 1250, currency: 'USD', card_number: threeDsCard });

    const completed = await request(app)
      .post(`/payments/${created.body.id}/3ds`)
      .send({ result });

    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe(expectedStatus);
  });

  test('returns 409 when a challenge is completed twice', async () => {
    const created = await request(app)
      .post('/payments')
      .send({ amount: 1250, currency: 'USD', card_number: threeDsCard });

    await request(app)
      .post(`/payments/${created.body.id}/3ds`)
      .send({ result: 'success' });

    const repeated = await request(app)
      .post(`/payments/${created.body.id}/3ds`)
      .send({ result: 'success' });

    expect(repeated.status).toBe(409);
  });

  test('marks a challenge failed when its ten-minute deadline expires', () => {
    jestApi.useFakeTimers();
    const store = new PaymentStore();

    try {
      const payment = store.create({ amount: 1250, currency: 'USD' });
      jestApi.advanceTimersByTime(THREE_DS_CHALLENGE_TTL_MS);

      expect(store.get(payment.id).status).toBe('failed');
      expect(store.get(payment.id).failure_reason).toBe('challenge_timeout');
    } finally {
      jestApi.useRealTimers();
    }
  });

  test('rejects challenge results other than success or fail', async () => {
    const created = await request(app)
      .post('/payments')
      .send({ amount: 1250, currency: 'USD', card_number: threeDsCard });

    const response = await request(app)
      .post(`/payments/${created.body.id}/3ds`)
      .send({ result: 'unknown' });

    expect(response.status).toBe(400);
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../src/app');

describe('POST /payments', () => {
  test('creates a pending payment and stores the amount as an integer', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', `create-${randomUUID()}`)
      .send({ amount: 1250, currency: 'EUR', card: '4242424242424242' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), status: 'pending' });

    const storedPayment = app.locals.paymentStore.getById(response.body.id);
    expect(storedPayment.amount).toBe(1250);
    expect(Number.isInteger(storedPayment.amount)).toBe(true);
  });

  test.each([
    [{ amount: 0, currency: 'EUR', card: '4242424242424242' }, 'INVALID_AMOUNT'],
    [{ amount: 10.5, currency: 'EUR', card: '4242424242424242' }, 'INVALID_AMOUNT'],
    [{ amount: 100, currency: 'CAD', card: '4242424242424242' }, 'INVALID_CURRENCY'],
    [{ amount: 100, currency: 'EUR', card: '123456789012' }, 'INVALID_CARD'],
  ])('rejects invalid payment data with a machine-readable code', async (body, code) => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', `invalid-${randomUUID()}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(code);
  });

  test('returns the original payment when the key and body are repeated', async () => {
    const key = `replay-${randomUUID()}`;
    const body = { amount: 2500, currency: 'USD', card: '4242424242424242' };
    const paymentCount = app.locals.paymentStore.size;

    const firstResponse = await request(app).post('/payments').set('Idempotency-Key', key).send(body);
    const replayResponse = await request(app).post('/payments').set('Idempotency-Key', key).send(body);

    expect(firstResponse.status).toBe(201);
    expect(replayResponse.status).toBe(201);
    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(app.locals.paymentStore.size).toBe(paymentCount + 1);
  });

  test('rejects a reused key with a different body without creating a payment', async () => {
    const key = `conflict-${randomUUID()}`;
    const initialBody = { amount: 2500, currency: 'USD', card: '4242424242424242' };
    const initialResponse = await request(app).post('/payments').set('Idempotency-Key', key).send(initialBody);
    const paymentCount = app.locals.paymentStore.size;

    const conflictResponse = await request(app)
      .post('/payments')
      .set('Idempotency-Key', key)
      .send({ ...initialBody, amount: 3000 });

    expect(initialResponse.status).toBe(201);
    expect(conflictResponse.status).toBe(422);
    expect(conflictResponse.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(app.locals.paymentStore.size).toBe(paymentCount);
  });

  test('rejects a reused key when an additional JSON field changes', async () => {
    const key = `additional-field-conflict-${randomUUID()}`;
    const body = { amount: 2500, currency: 'USD', card: '4242424242424242' };
    const initialResponse = await request(app).post('/payments').set('Idempotency-Key', key).send(body);
    const paymentCount = app.locals.paymentStore.size;

    const conflictResponse = await request(app)
      .post('/payments')
      .set('Idempotency-Key', key)
      .send({ ...body, metadata: { source: 'test' } });

    expect(initialResponse.status).toBe(201);
    expect(conflictResponse.status).toBe(422);
    expect(conflictResponse.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(app.locals.paymentStore.size).toBe(paymentCount);
  });

  test('returns 422 when a reused key has a different invalid body', async () => {
    const key = `invalid-conflict-${randomUUID()}`;
    const initialBody = { amount: 2500, currency: 'USD', card: '4242424242424242' };

    await request(app).post('/payments').set('Idempotency-Key', key).send(initialBody);
    const conflictResponse = await request(app)
      .post('/payments')
      .set('Idempotency-Key', key)
      .send({ ...initialBody, amount: 0 });

    expect(conflictResponse.status).toBe(422);
    expect(conflictResponse.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  test('requires an idempotency key', async () => {
    const response = await request(app)
      .post('/payments')
      .send({ amount: 100, currency: 'EUR', card: '4242424242424242' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });
});

describe('GET /payments/:id', () => {
  test('returns the full stored payment with only the card last four digits', async () => {
    const card = '4242 4242-4242 4242';
    const createResponse = await request(app)
      .post('/payments')
      .set('Idempotency-Key', `retrieve-${randomUUID()}`)
      .send({ amount: 1250, currency: 'EUR', card });

    expect(createResponse.status).toBe(201);

    const loggedMethods = ['debug', 'info', 'log', 'warn', 'error'];
    const logSpies = loggedMethods.map((method) => jest.spyOn(console, method));

    try {
      const response = await request(app).get(`/payments/${createResponse.body.id}`);
      const storedPayment = app.locals.paymentStore.getById(createResponse.body.id);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedPayment);
      expect(response.body).toEqual({
        id: createResponse.body.id,
        status: 'pending',
        amount: 1250,
        currency: 'EUR',
        cardLast4: '4242',
      });
      expect(JSON.stringify(response.body)).not.toContain('4242424242424242');
      expect(logSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    } finally {
      logSpies.forEach((spy) => spy.mockRestore());
    }
  });

  test('returns 404 for an unknown payment id', async () => {
    const response = await request(app).get('/payments/unknown-payment-id');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'PAYMENT_NOT_FOUND' } });
  });
});
