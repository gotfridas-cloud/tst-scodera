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
  });

  return router;
}

module.exports = { createPaymentsRouter };
