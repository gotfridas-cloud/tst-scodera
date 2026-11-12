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
  });
});
