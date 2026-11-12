const express = require('express');
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
