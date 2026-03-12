const Anthropic = require('@anthropic-ai/sdk');
const { buildPrompt } = require('./prompts');

// Rate limiting: simple in-memory store (resets per cold start, which is fine for basic protection)
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 15; // max requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimits.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Check API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'API key not configured. Add ANTHROPIC_API_KEY to your Vercel environment variables.'
    });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  try {
    const { message, page, vars, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Cap message length
    const trimmedMessage = message.slice(0, 4000);

    // Build system prompt for this specific tool/page
    const systemPrompt = buildPrompt(page || 'general', vars || {});

    // Build conversation history (keep last 10 messages to stay within context limits)
    const messages = [];
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: String(msg.content).slice(0, 4000)
          });
        }
      }
    }
    messages.push({ role: 'user', content: trimmedMessage });

    // Initialize Anthropic client
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    // Signal stream is done
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Chat API error:', err);

    // If we already started streaming, send error in stream format
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'Something went wrong. Please try again.' })}\n\n`);
      res.end();
    } else {
      const status = err.status || 500;
      const message = err.status === 401
        ? 'Invalid API key. Check your ANTHROPIC_API_KEY in Vercel settings.'
        : err.status === 429
          ? 'AI rate limit reached. Please wait a moment and try again.'
          : 'Something went wrong. Please try again.';
      res.status(status).json({ error: message });
    }
  }
};
