const express = require('express');

function paymentResponse(payment) {
  const response = {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
  };

  if (payment.captured_amount !== undefined) {
    response.captured_amount = payment.captured_amount;
  }

  return response;
}

function createPaymentsRouter(paymentStore) {
  const router = express.Router();

  router.post('/payments/:id/capture', (request, response) => {
    const body = request.body === undefined ? {} : request.body;

    if (typeof body !== 'object' || Array.isArray(body)) {
      return response.status(400).json({ error: 'Request body must be an object' });
    }

    const outcome = paymentStore.capture(request.params.id, body.amount);

    if (outcome.kind === 'not_found') {
      return response.status(404).json({ error: 'Payment not found' });
    }

    if (outcome.kind === 'conflict') {
      return response.status(409).json({
        error: 'Payment is not authorized',
        payment: paymentResponse(outcome.payment),
      });
    }

    if (outcome.kind === 'invalid_amount') {
      return response.status(400).json({ error: 'amount must be a positive number' });
    }

    if (outcome.kind === 'amount_exceeds_authorized') {
      return response.status(400).json({ error: 'amount exceeds the authorized amount' });
    }

    return response.status(200).json(paymentResponse(outcome.payment));
  });

  router.post('/payments/:id/void', (request, response) => {
    const outcome = paymentStore.void(request.params.id);

    if (outcome.kind === 'not_found') {
      return response.status(404).json({ error: 'Payment not found' });
    }

    if (outcome.kind === 'conflict') {
      return response.status(409).json({
        error: 'Payment is not authorized',
        payment: paymentResponse(outcome.payment),
      });
    }

    return response.status(200).json(paymentResponse(outcome.payment));
  });

  return router;
}

module.exports = { createPaymentsRouter, paymentResponse };
