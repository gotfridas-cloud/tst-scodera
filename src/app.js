const express = require('express');
const { PaymentStore } = require('./paymentStore');
const { createPaymentsRouter } = require('./payments');

const app = express();
const paymentStore = new PaymentStore();

app.use(express.json());
app.use(createPaymentsRouter(paymentStore));
const createPaymentsRouter = require('./payments');
const createPaymentStore = require('./paymentStore');

const app = express();
const paymentStore = createPaymentStore();

app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.use('/payments', createPaymentsRouter(paymentStore));

app.locals.paymentStore = paymentStore;

module.exports = app;
