class PaymentStore {
  constructor(payments = new Map()) {
    this.payments = payments;
  }

  capture(id, requestedAmount) {
    const payment = this.payments.get(id);

const { randomUUID } = require('node:crypto');
const { clearTimeout, setTimeout } = require('node:timers');

const THREE_DS_CHALLENGE_TTL_MS = 10 * 60 * 1000;

class PaymentStore {
  constructor() {
    this.payments = new Map();
  }

  create({ amount, currency }) {
    const createdAt = Date.now();
    const payment = {
      id: randomUUID(),
      amount,
      currency,
      status: 'requires_action',
      created_at: new Date(createdAt).toISOString(),
      challenge_expires_at: new Date(createdAt + THREE_DS_CHALLENGE_TTL_MS).toISOString(),
    };

    payment.timeout = setTimeout(() => this.expireChallenge(payment.id), THREE_DS_CHALLENGE_TTL_MS);
    payment.timeout.unref?.();
    this.payments.set(payment.id, payment);

    return payment;
  }

  get(id) {
    const payment = this.payments.get(id);

    if (payment?.status === 'requires_action' && Date.now() >= Date.parse(payment.challenge_expires_at)) {
      this.expireChallenge(id);
    }

    return payment;
  }

  completeChallenge(id, result) {
    const payment = this.get(id);

    if (!payment) {
      return { kind: 'not_found' };
    }

    if (payment.status !== 'authorized') {
      return { kind: 'conflict', payment };
    }

    const amount = requestedAmount === undefined ? payment.amount : requestedAmount;

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return { kind: 'invalid_amount', payment };
    }

    if (amount > payment.amount) {
      return { kind: 'amount_exceeds_authorized', payment };
    }

    payment.captured_amount = amount;
    payment.status = 'captured';
    payment.captured_at = new Date().toISOString();

    return { kind: 'captured', payment };
  }

  void(id) {
    const payment = this.payments.get(id);

    if (!payment) {
      return { kind: 'not_found' };
    }

    if (payment.status !== 'authorized') {
      return { kind: 'conflict', payment };
    }

    payment.status = 'voided';
    payment.voided_at = new Date().toISOString();

    return { kind: 'voided', payment };
  }
}

module.exports = { PaymentStore };
    if (payment.status !== 'requires_action') {
      return { kind: 'conflict', payment };
    }

    clearTimeout(payment.timeout);
    payment.status = result === 'success' ? 'authorized' : 'failed';
    payment.challenge_completed_at = new Date().toISOString();

    return { kind: 'completed', payment };
  }

  expireChallenge(id) {
    const payment = this.payments.get(id);

    if (payment?.status === 'requires_action') {
      clearTimeout(payment.timeout);
      payment.status = 'failed';
      payment.failure_reason = 'challenge_timeout';
    }
  }
}

module.exports = { PaymentStore, THREE_DS_CHALLENGE_TTL_MS };
const { createHmac, randomBytes, randomUUID } = require('node:crypto');

const allowedTransitions = new Map([
  ['pending', new Set(['authorized', 'failed', 'requires_action'])],
  ['authorized', new Set(['captured', 'voided'])],
  ['requires_action', new Set(['authorized', 'failed'])],
]);

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
        cardLast4: card.replace(/[ -]/g, '').slice(-4),
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

    transitionStatus(id, nextStatus) {
      const payment = payments.get(id);

      if (!allowedTransitions.get(payment?.status)?.has(nextStatus)) {
        const error = new Error('Invalid payment status transition');
        error.statusCode = 409;
        error.code = 'INVALID_PAYMENT_STATUS_TRANSITION';
        throw error;
      }

      const updatedPayment = Object.freeze({ ...payment, status: nextStatus });
      payments.set(id, updatedPayment);

      return updatedPayment;
    },

    get size() {
      return payments.size;
    },
  };
}

module.exports = createPaymentStore;
