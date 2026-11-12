const express = require('express');

const supportedCurrencies = new Set(['EUR', 'USD', 'GBP']);

function isValidCardNumber(card) {
  if (typeof card !== 'string') {
    return false;
  }

  const digits = card.replace(/[ -]/g, '');

  if (!/^\d{12,19}$/.test(digits)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function createPaymentsRouter(paymentStore) {
  const router = express.Router();

  router.post('/', (request, response) => {
    const idempotencyKey = request.get('Idempotency-Key');

    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      return response.status(400).json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    }

    const normalizedKey = idempotencyKey.trim();
    const existingRequest = paymentStore.checkIdempotency({
      idempotencyKey: normalizedKey,
      body: request.body,
    });

    if (existingRequest) {
      if (existingRequest.kind === 'conflict') {
        return response.status(422).json({ error: { code: 'IDEMPOTENCY_KEY_REUSED' } });
      }

      return response.status(201).json({
        id: existingRequest.payment.id,
        status: existingRequest.payment.status,
      });
    }

    const { amount, currency, card } = request.body || {};

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return response.status(400).json({ error: { code: 'INVALID_AMOUNT' } });
    }

    if (typeof currency !== 'string' || !supportedCurrencies.has(currency)) {
      return response.status(400).json({ error: { code: 'INVALID_CURRENCY' } });
    }

    if (!isValidCardNumber(card)) {
      return response.status(400).json({ error: { code: 'INVALID_CARD' } });
    }

    const result = paymentStore.create({
      idempotencyKey: normalizedKey,
      amount,
      currency,
      card,
      body: request.body,
    });

    if (result.kind === 'conflict') {
      return response.status(422).json({ error: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    }

    return response.status(201).json({
      id: result.payment.id,
      status: result.payment.status,
    });
  });

  return router;
}

module.exports = createPaymentsRouter;
