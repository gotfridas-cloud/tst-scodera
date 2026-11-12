const request = require('supertest');
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
  });
});
