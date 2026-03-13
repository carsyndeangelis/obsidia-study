import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('chat.js handler', () => {
  let handler;

  beforeEach(() => {
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    handler = require('../api/chat');
  });

  function createReq(body = {}, method = 'POST') {
    return { method, body, headers: { 'x-forwarded-for': '127.0.0.1' } };
  }

  function createRes() {
    const res = {
      statusCode: 200, headers: {}, body: null, headersSent: false, written: [],
      setHeader(key, val) { this.headers[key] = val; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      end() { return this; },
      write(data) { this.written.push(data); return this; }
    };
    return res;
  }

  it('rejects non-POST requests', async () => {
    const res = createRes();
    await handler(createReq({}, 'GET'), res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toContain('Method not allowed');
  });

  it('returns 200 on OPTIONS (CORS preflight)', async () => {
    const res = createRes();
    await handler(createReq({}, 'OPTIONS'), res);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('sets correct CORS headers', async () => {
    const res = createRes();
    await handler(createReq({}, 'OPTIONS'), res);
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
  });

  it('rejects missing message', async () => {
    const res = createRes();
    await handler(createReq({}), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Message is required');
  });

  it('rejects empty string message', async () => {
    const res = createRes();
    await handler(createReq({ message: '' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-string message', async () => {
    const res = createRes();
    await handler(createReq({ message: 123 }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects null message', async () => {
    const res = createRes();
    await handler(createReq({ message: null }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.resetModules();
    handler = require('../api/chat');
    const res = createRes();
    await handler(createReq({ message: 'hello' }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('API key');
  });
});
