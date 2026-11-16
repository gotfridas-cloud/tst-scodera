const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../src/app');

function uniqueKey(prefix = 'key') {
  return `${prefix}-${randomUUID()}`;
}

const validBody = { amount: 1099, currency: 'GBP', card: '4111111111111111' };

describe('PAY-2: POST /payments', () => {
  beforeEach(() => {
    app.locals.paymentStore.payments.clear();
  });

  // 1. Valid body returns 201 with correct fields and status=pending
  test('valid body returns 201 with correct fields and status pending', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      amount: 1099,
      currency: 'GBP',
      card_last4: expect.any(String),
      status: 'pending',
      created_at: expect.any(String),
    });
    // id is UUID v4 shape
    expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    // created_at is ISO 8601
    expect(() => new Date(response.body.created_at).toISOString()).not.toThrow();
  });

  // 2. card_last4 is only the last 4 digits
  test('card_last4 is the last 4 characters of the card number', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ amount: 500, currency: 'USD', card: '9999888877776666' });

    expect(response.status).toBe(201);
    expect(response.body.card_last4).toBe('6666');
  });

  // 3. amount is stored and returned as integer (not float)
  test('amount is stored and returned as integer', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ amount: 2500, currency: 'EUR', card: '1234567890123456' });

    expect(response.status).toBe(201);
    expect(response.body.amount).toBe(2500);
    expect(Number.isInteger(response.body.amount)).toBe(true);

    const stored = app.locals.paymentStore.getById(response.body.id);
    expect(Number.isInteger(stored.amount)).toBe(true);
    expect(stored.amount).toBe(2500);
  });

  // 4. Missing amount -> 400 INVALID_AMOUNT
  test('missing amount returns 400 INVALID_AMOUNT', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ currency: 'EUR', card: '1234567890123456' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_AMOUNT');
  });

  // 5. amount = 0 -> 400 INVALID_AMOUNT
  test('amount 0 returns 400 INVALID_AMOUNT', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ amount: 0, currency: 'EUR', card: '1234567890123456' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_AMOUNT');
  });

  // 6. amount = -1 -> 400 INVALID_AMOUNT
  test('negative amount returns 400 INVALID_AMOUNT', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ amount: -1, currency: 'EUR', card: '1234567890123456' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_AMOUNT');
  });

  // 7. amount = 1.5 -> 400 INVALID_AMOUNT (non-integer)
  test('float amount returns 400 INVALID_AMOUNT', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ amount: 1.5, currency: 'EUR', card: '1234567890123456' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_AMOUNT');
  });

  // 8. Invalid currency -> 400 INVALID_CURRENCY
  test('unsupported currency returns 400 INVALID_CURRENCY', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ amount: 100, currency: 'CAD', card: '1234567890123456' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CURRENCY');
  });

  // 9. Missing card -> 400 MISSING_CARD
  test('missing card returns 400 MISSING_CARD', async () => {
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ amount: 100, currency: 'EUR' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MISSING_CARD');
  });

  // 10. Missing Idempotency-Key -> 400 MISSING_IDEMPOTENCY_KEY
  test('missing Idempotency-Key header returns 400 MISSING_IDEMPOTENCY_KEY', async () => {
    const response = await request(app)
      .post('/payments')
      .send(validBody);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  // 11. Same key + same body -> returns original 201 response
  test('same key and same body returns original 201 response (idempotent replay)', async () => {
    const key = uniqueKey('replay');
    const body = { amount: 1500, currency: 'USD', card: '9999999999999999' };

    const first = await request(app).post('/payments').set('Idempotency-Key', key).send(body);
    const replay = await request(app).post('/payments').set('Idempotency-Key', key).send(body);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
    // No duplicate payment created
    expect(app.locals.paymentStore.size).toBe(1);
  });

  // 12. Same key + different body -> 422 IDEMPOTENCY_CONFLICT
  test('same key with different body returns 422 IDEMPOTENCY_CONFLICT', async () => {
    const key = uniqueKey('conflict');
    const body = { amount: 1500, currency: 'USD', card: '9999999999999999' };

    const first = await request(app).post('/payments').set('Idempotency-Key', key).send(body);
    const conflict = await request(app)
      .post('/payments')
      .set('Idempotency-Key', key)
      .send({ ...body, amount: 2000 });

    expect(first.status).toBe(201);
    expect(conflict.status).toBe(422);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  // Extra: full card number must not appear in response
  test('full card number is not returned in the response', async () => {
    const card = '4111111111111111';
    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', uniqueKey())
      .send({ amount: 999, currency: 'GBP', card });

    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toContain(card);
    expect(response.body.card_last4).toBe('1111');
  });
});
