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
