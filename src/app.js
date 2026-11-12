const express = require('express');
const { PaymentStore } = require('./paymentStore');
const { createPaymentsRouter } = require('./payments');

const app = express();
const paymentStore = new PaymentStore();

app.use(express.json());
app.use(createPaymentsRouter(paymentStore));

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

module.exports = app;
