const { createHmac, randomBytes, randomUUID } = require('node:crypto');

function createPaymentStore() {
  const payments = new Map();
  const idempotencyEntries = new Map();
  const fingerprintSecret = randomBytes(32);

  function canonicalize(value) {
    if (Array.isArray(value)) {
      return value.map(canonicalize);
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonicalize(value[key])]),
      );
    }

    return value;
  }

  function fingerprint(body) {
    const requestBody = JSON.stringify({
      hasBody: body !== undefined,
      body: body === undefined ? null : canonicalize(body),
    });

    return createHmac('sha256', fingerprintSecret).update(requestBody).digest('hex');
  }

  return {
    checkIdempotency({ idempotencyKey, body }) {
      const existingEntry = idempotencyEntries.get(idempotencyKey);

      if (!existingEntry) {
        return null;
      }

      return {
        kind: existingEntry.fingerprint === fingerprint(body) ? 'replay' : 'conflict',
        payment: payments.get(existingEntry.paymentId),
      };
    },

    create({ idempotencyKey, amount, currency, card, body = { amount, currency, card } }) {
      const requestFingerprint = fingerprint(body);
      const existingEntry = idempotencyEntries.get(idempotencyKey);

      if (existingEntry) {
        return {
          kind: existingEntry.fingerprint === requestFingerprint ? 'replay' : 'conflict',
          payment: payments.get(existingEntry.paymentId),
        };
      }

      const payment = Object.freeze({
        id: randomUUID(),
        status: 'pending',
        amount,
        currency,
      });

      payments.set(payment.id, payment);
      idempotencyEntries.set(idempotencyKey, {
        fingerprint: requestFingerprint,
        paymentId: payment.id,
      });

      return { kind: 'created', payment };
    },

    getById(id) {
      return payments.get(id);
    },

    get size() {
      return payments.size;
    },
  };
}

module.exports = createPaymentStore;
