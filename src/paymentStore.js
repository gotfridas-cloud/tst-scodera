class PaymentStore {
  constructor(payments = new Map()) {
    this.payments = payments;
  }

  capture(id, requestedAmount) {
    const payment = this.payments.get(id);

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
