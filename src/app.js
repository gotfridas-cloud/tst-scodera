const express = require('express');
const { createPaymentStatusWebhookNotifier } = require('./webhooks');
const { createPaymentStatusUpdateHandler } = require('./paymentStatus');

function createApp({ webhookNotifier } = {}) {
  const app = express();
  const notifyPaymentStatusChanged = webhookNotifier || createPaymentStatusWebhookNotifier();

  app.locals.notifyPaymentStatusChanged = notifyPaymentStatusChanged;
  app.locals.createPaymentStatusUpdateHandler = (updateStatus) => createPaymentStatusUpdateHandler({
    updateStatus,
    notifyPaymentStatusChanged,
  });

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
