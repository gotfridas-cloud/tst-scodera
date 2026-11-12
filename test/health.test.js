const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  test('returns HTTP 200 with an ok status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
