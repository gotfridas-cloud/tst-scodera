const express = require('express');
const { createPaymentStatusWebhookNotifier } = require('./webhooks');
const { createPaymentStatusUpdateHandler } = require('./paymentStatus');

function createApp({ webhookNotifier } = {}) {
  const app = express();
  const notifyPaymentStatusChanged = webhookNotifier || createPaymentStatusWebhookNotifier();
const { PaymentStore } = require('./paymentStore');
const { createPaymentsRouter } = require('./payments');

const app = express();
const paymentStore = new PaymentStore();

app.locals.paymentStore = paymentStore;
app.use(express.json());
app.use(createPaymentsRouter(paymentStore));
app.use(express.json());
app.use(createPaymentsRouter(paymentStore));
const createPaymentsRouter = require('./payments');
const createPaymentStore = require('./paymentStore');

const app = express();
const paymentStore = createPaymentStore();

app.use(express.json());

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

app.use('/payments', createPaymentsRouter(paymentStore));

app.locals.paymentStore = paymentStore;

module.exports = app;
module.exports.createApp = createApp;
