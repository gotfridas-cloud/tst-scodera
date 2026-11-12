const { createHmac, randomUUID } = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
const { URL } = require('node:url');

const DEFAULT_RETRY_DELAYS_MS = Object.freeze([100, 200, 400]);

function validateRetryDelays(retryDelaysMs) {
  if (!Array.isArray(retryDelaysMs)
    || retryDelaysMs.some((delay) => !Number.isFinite(delay) || delay < 0)
    || retryDelaysMs.some((delay, index) => index > 0 && delay <= retryDelaysMs[index - 1])) {
    throw new TypeError('retryDelaysMs must contain increasing, non-negative delays');
  }
}

function createPaymentStatusWebhookNotifier({
  url = process.env.PAYMENT_WEBHOOK_URL,
  secret = process.env.PAYMENT_WEBHOOK_SECRET,
  fetchImpl = globalThis.fetch,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  sleepImpl = sleep,
} = {}) {
  validateRetryDelays(retryDelaysMs);

  let webhookUrl;
  if (url) {
    webhookUrl = new URL(url);
    if (!['http:', 'https:'].includes(webhookUrl.protocol)) {
      throw new TypeError('PAYMENT_WEBHOOK_URL must use HTTP or HTTPS');
    }
    if (!secret) {
      throw new Error('PAYMENT_WEBHOOK_SECRET is required when PAYMENT_WEBHOOK_URL is set');
    }
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('A fetch implementation is required when a webhook URL is set');
    }
  }

  return async function notifyPaymentStatusChanged({
    paymentId,
    previousStatus,
    status,
    eventId = randomUUID(),
    occurredAt = new Date().toISOString(),
  }) {
    if (!webhookUrl) {
      return false;
    }

    const body = JSON.stringify({
      id: eventId,
      type: 'payment.status_changed',
      occurredAt,
      data: { paymentId, previousStatus, status },
    });
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        const response = await fetchImpl(webhookUrl, {
          method: 'POST',
          redirect: 'manual',
          headers: {
            'content-type': 'application/json',
            'x-payment-webhook-signature': signature,
          },
          body,
        });
        if (response.status >= 200 && response.status < 300) {
          if (response.body) {
            response.body.cancel().catch(() => {});
          }
          return true;
        }
        await response.arrayBuffer();
      } catch {
        // Treat transport failures like non-2xx responses and use the same retry schedule.
      }

      if (attempt < retryDelaysMs.length) {
        await sleepImpl(retryDelaysMs[attempt]);
      }
    }

    return false;
  };
}

module.exports = { createPaymentStatusWebhookNotifier };
