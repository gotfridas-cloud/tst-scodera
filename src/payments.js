const express = require('express');

const supportedCurrencies = new Set(['EUR', 'USD', 'GBP']);

function createPaymentsRouter(paymentStore) {
  const router = express.Router();

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
      return response.status(400).json({ error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required' } });
    }
    const normalizedKey = idempotencyKey.trim();
    const existingRequest = paymentStore.checkIdempotency({
      idempotencyKey: normalizedKey,
      body: request.body,
    });
    if (existingRequest) {
      if (existingRequest.kind === 'conflict') {
        return response.status(422).json({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key reused with a different request body' } });
      }
      const p = existingRequest.payment;
      return response.status(201).json({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        card_last4: p.cardLast4,
        status: p.status,
        created_at: p.created_at,
      });
    }
    const { amount, currency, card } = request.body || {};
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return response.status(400).json({ error: { code: 'INVALID_AMOUNT', message: 'amount must be a positive integer' } });
    }
    if (typeof currency !== 'string' || !supportedCurrencies.has(currency)) {
      return response.status(400).json({ error: { code: 'INVALID_CURRENCY', message: 'currency must be EUR, USD, or GBP' } });
    }
    if (typeof card !== 'string' || card.length === 0) {
      return response.status(400).json({ error: { code: 'MISSING_CARD', message: 'card is required' } });
    }
    const result = paymentStore.create({
      idempotencyKey: normalizedKey,
      amount,
      currency,
      card,
      body: request.body,
    });
    if (result.kind === 'conflict') {
      return response.status(422).json({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key reused with a different request body' } });
    }
    const p = result.payment;
    return response.status(201).json({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      card_last4: p.cardLast4,
      status: p.status,
      created_at: p.created_at,
    });
  });

  router.post('/:id/capture', (request, response) => {
    const body = request.body === undefined ? {} : request.body;
    if (typeof body !== 'object' || Array.isArray(body)) {
      return response.status(400).json({ error: 'Request body must be an object' });
    }
    const outcome = paymentStore.capture(request.params.id, body.amount);
    if (outcome.kind === 'not_found') {
      return response.status(404).json({ error: 'Payment not found' });
    }
    if (outcome.kind === 'conflict') {
      return response.status(409).json({ error: 'Payment is not authorized', payment: outcome.payment });
    }
    if (outcome.kind === 'invalid_amount') {
      return response.status(400).json({ error: 'amount must be a positive number' });
    }
    if (outcome.kind === 'amount_exceeds_authorized') {
      return response.status(400).json({ error: 'amount exceeds the authorized amount' });
    }
    const { id, amount, currency, status, captured_amount } = outcome.payment;
    const result = { id, amount, currency, status };
    if (captured_amount !== undefined) {
      result.captured_amount = captured_amount;
    }
    return response.status(200).json(result);
  });

  router.post('/:id/void', (request, response) => {
    const outcome = paymentStore.void(request.params.id);
    if (outcome.kind === 'not_found') {
      return response.status(404).json({ error: 'Payment not found' });
    }
    if (outcome.kind === 'conflict') {
      return response.status(409).json({ error: 'Payment is not authorized', payment: outcome.payment });
    }
    return response.status(200).json(outcome.payment);
  });

  return router;
}

module.exports = { createPaymentsRouter };
