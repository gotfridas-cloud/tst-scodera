const express = require('express');

const THREE_DS_CARD_NUMBER = '4000002500003155';

function normalizeCardNumber(value) {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '') : '';
}

function getCardNumber(body) {
  return body.card_number ?? body.card?.number;
}

function paymentResponse(payment) {
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
  };
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

  router.post('/payments', (request, response) => {
    const body = request.body;
    const cardNumber = body && typeof body === 'object' ? getCardNumber(body) : undefined;

    if (normalizeCardNumber(cardNumber) !== THREE_DS_CARD_NUMBER) {
      return response.status(400).json({ error: 'Unsupported card number' });
    }

    const payment = paymentStore.create({
      amount: body.amount,
      currency: body.currency,
    });

    return response.status(201).json({
      ...paymentResponse(payment),
      redirect_url: `/3ds/challenge/${payment.id}`,
    });
  });

  router.post('/payments/:id/3ds', (request, response) => {
    const { result } = request.body || {};

    if (result !== 'success' && result !== 'fail') {
      return response.status(400).json({ error: 'result must be success or fail' });
    }

    const outcome = paymentStore.completeChallenge(request.params.id, result);

    if (outcome.kind === 'not_found') {
      return response.status(404).json({ error: 'Payment not found' });
    }

    if (outcome.kind === 'conflict') {
      return response.status(409).json({
        error: '3-D Secure challenge is no longer pending',
        payment: paymentResponse(outcome.payment),
      });
    }

    return response.status(200).json(paymentResponse(outcome.payment));
  router.get('/:id', (request, response) => {
    const payment = paymentStore.getById(request.params.id);

    if (!payment) {
      return response.status(404).json({ error: { code: 'PAYMENT_NOT_FOUND' } });
    }

    return response.status(200).json(payment);
  });

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

module.exports = { createPaymentsRouter };
module.exports = createPaymentsRouter;
