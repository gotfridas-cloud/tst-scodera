const express = require('express');
const { createPaymentStatusWebhookNotifier } = require('./webhooks');

const app = express();

app.locals.notifyPaymentStatusChanged = createPaymentStatusWebhookNotifier();

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

module.exports = app;
