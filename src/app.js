const express = require('express');

const app = express();

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

module.exports = app;
