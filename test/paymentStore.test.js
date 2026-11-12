const { randomUUID } = require('node:crypto');
const createPaymentStore = require('../src/paymentStore');

const statuses = ['pending', 'authorized', 'captured', 'failed', 'voided', 'requires_action'];
const allowedTransitions = new Set([
  'pending->authorized',
  'authorized->captured',
  'pending->failed',
  'authorized->voided',
  'pending->requires_action',
  'requires_action->authorized',
  'requires_action->failed',
]);
const transitionCases = statuses.flatMap((fromStatus) =>
  statuses.map((toStatus) => [
    fromStatus,
    toStatus,
    allowedTransitions.has(`${fromStatus}->${toStatus}`),
  ]),
);
const pathFromPending = {
  pending: [],
  authorized: ['authorized'],
  captured: ['authorized', 'captured'],
  failed: ['failed'],
  voided: ['authorized', 'voided'],
  requires_action: ['requires_action'],
};

function createPaymentAtStatus(store, targetStatus) {
  const { payment } = store.create({
    idempotencyKey: randomUUID(),
    amount: 100,
    currency: 'EUR',
    card: '4242424242424242',
  });

  return pathFromPending[targetStatus].reduce(
    (currentPayment, nextStatus) => store.transitionStatus(currentPayment.id, nextStatus),
    payment,
  );
}

describe('payment status transitions', () => {
  test.each(transitionCases)(
    '%s -> %s is %s',
    (fromStatus, toStatus, isAllowed) => {
      const store = createPaymentStore();
      const payment = createPaymentAtStatus(store, fromStatus);

      if (isAllowed) {
        const updatedPayment = store.transitionStatus(payment.id, toStatus);

        expect(updatedPayment.status).toBe(toStatus);
        expect(store.getById(payment.id).status).toBe(toStatus);
        return;
      }

      let transitionError;
      try {
        store.transitionStatus(payment.id, toStatus);
      } catch (error) {
        transitionError = error;
      }

      expect(transitionError).toMatchObject({
        statusCode: 409,
        code: 'INVALID_PAYMENT_STATUS_TRANSITION',
      });
      expect(store.getById(payment.id).status).toBe(fromStatus);
    },
  );
});
