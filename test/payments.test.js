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
