const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  test('returns HTTP 200', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
  });
});
