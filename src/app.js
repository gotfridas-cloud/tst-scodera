const express = require('express');
const { createPaymentStatusWebhookNotifier } = require('./webhooks');
const { createPaymentStatusUpdateHandler } = require('./paymentStatus');
const { createPaymentsRouter } = require('./payments');
const createPaymentStore = require('./paymentStore');

function createApp({ webhookNotifier } = {}) {
  const app = express();
  const notifyPaymentStatusChanged = webhookNotifier || createPaymentStatusWebhookNotifier();
  const paymentStore = createPaymentStore();

  app.use(express.json());

  app.locals.paymentStore = paymentStore;
  app.locals.notifyPaymentStatusChanged = notifyPaymentStatusChanged;
  app.locals.createPaymentStatusUpdateHandler = (updateStatus) =>
    createPaymentStatusUpdateHandler({
      updateStatus,
      notifyPaymentStatusChanged,
    });

  app.get('/health', (req, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/payments', createPaymentsRouter(paymentStore));

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;