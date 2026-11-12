const { createHmac } = require('node:crypto');
const { createServer } = require('node:http');
const { createApp } = require('../src/app');
const { createPaymentStatusWebhookNotifier } = require('../src/webhooks');

function startMockReceiver(handler) {
  const receiver = createServer(handler);

  return new Promise((resolve, reject) => {
    receiver.once('error', reject);
    receiver.listen(0, '127.0.0.1', () => {
      const address = receiver.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Mock receiver did not bind to a TCP port'));
        return;
      }

      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((closeResolve, closeReject) => {
          receiver.close((error) => {
            if (error) {
              closeReject(error);
            } else {
              closeResolve();
            }
          });
        }),
      });
    });
  });
}

function readRequest(request, callback) {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => callback(body));
}

describe('payment status webhooks', () => {
  test('sends an event after a successful payment status update', async () => {
    const received = [];
    const callOrder = [];
    const mockReceiver = await startMockReceiver((request, response) => {
      readRequest(request, (body) => {
        callOrder.push('webhook');
        received.push(JSON.parse(body));
        response.writeHead(204);
        response.end();
      });
    });

    try {
      const app = createApp({
        webhookNotifier: createPaymentStatusWebhookNotifier({
          url: mockReceiver.url,
          secret: 'test-secret',
        }),
      });
      const persistedUpdates = [];
      const updatePaymentStatus = app.locals.createPaymentStatusUpdateHandler(async (paymentId, status) => {
        callOrder.push('status update');
        persistedUpdates.push({ paymentId, status });
        return {
          paymentId,
          previousStatus: 'pending',
          status,
        };
      });

      await expect(updatePaymentStatus('pay-status-change', 'authorized')).resolves.toEqual({
        paymentId: 'pay-status-change',
        previousStatus: 'pending',
        status: 'authorized',
      });

      expect(persistedUpdates).toEqual([{ paymentId: 'pay-status-change', status: 'authorized' }]);
      expect(callOrder).toEqual(['status update', 'webhook']);
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        type: 'payment.status_changed',
        data: {
          paymentId: 'pay-status-change',
          previousStatus: 'pending',
          status: 'authorized',
        },
      });
    } finally {
      await mockReceiver.close();
    }
  });

  test('does not send an event when the status update fails or leaves status unchanged', async () => {
    let notificationCount = 0;
    const notifyPaymentStatusChanged = async () => {
      notificationCount += 1;
    };
    const app = createApp({ webhookNotifier: notifyPaymentStatusChanged });
    const failedUpdate = app.locals.createPaymentStatusUpdateHandler(async () => null);
    const unchangedUpdate = app.locals.createPaymentStatusUpdateHandler(async () => ({
      paymentId: 'pay-unchanged',
      previousStatus: 'authorized',
      status: 'authorized',
    }));
    const rejectedUpdate = app.locals.createPaymentStatusUpdateHandler(async () => {
      throw new Error('payment store failed');
    });

    await expect(failedUpdate('pay-missing', 'authorized')).resolves.toBeNull();
    await expect(unchangedUpdate('pay-unchanged', 'authorized')).resolves.toEqual({
      paymentId: 'pay-unchanged',
      previousStatus: 'authorized',
      status: 'authorized',
    });
    await expect(rejectedUpdate('pay-failed', 'authorized')).rejects.toThrow('payment store failed');

    expect(notificationCount).toBe(0);
  });

  test('sends the event and signs the exact JSON request body', async () => {
    const received = [];
    const mockReceiver = await startMockReceiver((request, response) => {
      readRequest(request, (body) => {
        received.push({ body, signature: request.headers['x-payment-webhook-signature'] });
        response.writeHead(204);
        response.end();
      });
    });

    try {
      const notify = createPaymentStatusWebhookNotifier({
        url: mockReceiver.url,
        secret: 'test-secret',
      });
      const event = {
        paymentId: 'pay-123',
        previousStatus: 'pending',
        status: 'authorized',
        eventId: 'evt-123',
        occurredAt: '2026-11-12T00:00:00.000Z',
      };

      await expect(notify(event)).resolves.toBe(true);

      const expectedBody = JSON.stringify({
        id: 'evt-123',
        type: 'payment.status_changed',
        occurredAt: '2026-11-12T00:00:00.000Z',
        data: {
          paymentId: 'pay-123',
          previousStatus: 'pending',
          status: 'authorized',
        },
      });
      const expectedSignature = `sha256=${createHmac('sha256', 'test-secret')
        .update(expectedBody)
        .digest('hex')}`;

      expect(received).toEqual([{ body: expectedBody, signature: expectedSignature }]);
    } finally {
      await mockReceiver.close();
    }
  });

  test('retries three times with increasing delays after non-2xx responses', async () => {
    const received = [];
    const retryDelays = [];
    const mockReceiver = await startMockReceiver((request, response) => {
      readRequest(request, (body) => {
        received.push({ body, signature: request.headers['x-payment-webhook-signature'] });
        response.writeHead(503);
        response.end();
      });
    });

    try {
      const notify = createPaymentStatusWebhookNotifier({
        url: mockReceiver.url,
        secret: 'test-secret',
        retryDelaysMs: [5, 10, 20],
        sleepImpl: async (delay) => retryDelays.push(delay),
      });

      await expect(notify({
        paymentId: 'pay-456',
        previousStatus: 'authorized',
        status: 'captured',
        eventId: 'evt-456',
      })).resolves.toBe(false);

      // Three retries means four total requests, including the initial delivery.
      expect(received).toHaveLength(4);
      expect(retryDelays).toHaveLength(3);
      expect(retryDelays.every((delay, index) => index === 0 || delay > retryDelays[index - 1])).toBe(true);
      expect(new Set(received.map(({ body }) => body)).size).toBe(1);
      expect(new Set(received.map(({ signature }) => signature)).size).toBe(1);
    } finally {
      await mockReceiver.close();
    }
  });

  test('does not send another request after a successful response', async () => {
    let receivedCount = 0;
    const retryDelays = [];
    const mockReceiver = await startMockReceiver((_request, response) => {
      receivedCount += 1;
      response.writeHead(200);
      response.end();
    });

    try {
      const notify = createPaymentStatusWebhookNotifier({
        url: mockReceiver.url,
        secret: 'test-secret',
        sleepImpl: async (delay) => retryDelays.push(delay),
      });

      await expect(notify({
        paymentId: 'pay-789',
        previousStatus: 'pending',
        status: 'authorized',
      })).resolves.toBe(true);

      expect(receivedCount).toBe(1);
      expect(retryDelays).toEqual([]);
    } finally {
      await mockReceiver.close();
    }
  });

  test('returns false when no webhook URL is configured', async () => {
    const notify = createPaymentStatusWebhookNotifier({ url: '', secret: '' });

    await expect(notify({ paymentId: 'pay-000', status: 'authorized' })).resolves.toBe(false);
  });
});
