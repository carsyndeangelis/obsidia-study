const Anthropic = require('@anthropic-ai/sdk');
const { buildPrompt } = require('./prompts');

const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 15;

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'API key not configured. Add ANTHROPIC_API_KEY to your Vercel environment variables.'
    });
  }

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  try {
    const { message, page, vars, history, image, model } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Validate vars against allowlists to prevent prompt injection
    const ALLOWED_PAGES = ['general','math','essay','study','notes','doublecheck','grading','testprep','teacher','admin_architect'];
    const ALLOWED_MODES = ['solve','explain','graph','practice','draft','outline','thesis','proofread','transcribe','summarize','keypoints','questions','verify','sources','compare','bias','grade','rubric','feedback'];
    const ALLOWED_MATH_TYPES = ['algebra','geometry','trig','precalc','calculus','multivariable','linalg','diffeq','statistics','discrete'];
    const ALLOWED_SECTIONS = ['act-math','act-english','act-science','sat-math','sat-rw','strategy'];
    const ALLOWED_TOOLS = ['lesson','rubric','quizgen','stfeedback','differentiate','parentemail'];
    const ALLOWED_METHODS = ['flashcards','cornell','mindmap','spaced','outline','quiz'];

    const safeVars = {};
    const rv = vars || {};
    if (rv.mode && ALLOWED_MODES.includes(rv.mode)) safeVars.mode = rv.mode;
    if (rv.mathType && ALLOWED_MATH_TYPES.includes(rv.mathType)) safeVars.mathType = rv.mathType;
    if (rv.section && ALLOWED_SECTIONS.includes(rv.section)) safeVars.section = rv.section;
    if (rv.tool && ALLOWED_TOOLS.includes(rv.tool)) safeVars.tool = rv.tool;
    if (rv.method && ALLOWED_METHODS.includes(rv.method)) safeVars.method = rv.method;
    if (rv.humanizer) safeVars.humanizer = !!rv.humanizer;
    if (rv.grade) safeVars.grade = String(rv.grade).slice(0, 20);
    if (rv.scale) safeVars.scale = String(rv.scale).slice(0, 20);
    const ALLOWED_DETAILS = ['full', 'hints', 'answer'];
    if (rv.detail && ALLOWED_DETAILS.includes(rv.detail)) safeVars.detail = rv.detail;
    if (rv.skillContext && typeof rv.skillContext === 'string') safeVars.skillContext = rv.skillContext.slice(0, 500);
    if (rv.documentContext && typeof rv.documentContext === 'string') safeVars.documentContext = rv.documentContext.slice(0, 8000);
    if (rv.studentProfile && typeof rv.studentProfile === 'string') safeVars.studentProfile = rv.studentProfile.slice(0, 600);
    if (rv.systemOverride && typeof rv.systemOverride === 'string' && page === 'admin_architect') safeVars.systemOverride = rv.systemOverride.slice(0, 1000);

    const trimmedMessage = message.slice(0, 4000);
    const safePage = ALLOWED_PAGES.includes(page) ? page : 'general';
    const systemPrompt = buildPrompt(safePage, safeVars);

    // Build conversation history
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

    // Build user message content (text + optional image)
    const userContent = [];
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      // Extract base64 data and media type
      const match = image.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
      if (match) {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: match[1],
            data: match[2]
          }
        });
      }
    }
    userContent.push({ type: 'text', text: trimmedMessage });
    messages.push({ role: 'user', content: userContent });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Select model based on request
    const modelId = model === 'opus' ? 'claude-opus-4-20250514' : 'claude-sonnet-4-20250514';

    // ── Humanizer validation loop for essay pages ──
    if (safePage === 'essay' && safeVars.humanizer) {
      const MAX_LOOPS = 3;
      let draft = '';

      // Step A: Generate initial draft (non-streamed)
      res.write(`data: ${JSON.stringify({ status: 'Generating initial draft...' })}\n\n`);
      const initial = await client.messages.create({
        model: modelId,
        max_tokens: 2500,
        system: systemPrompt,
        messages: messages,
      });
      draft = initial.content.map(b => b.text || '').join('');

      // Step B & C: Check and rewrite loop
      const CHECKER_PROMPT = `You are a strict AI-content detector similar to Turnitin and GPTZero. Analyze the following essay for signs of AI-generated writing.

Check for these AI markers:
1. Low perplexity (overly predictable word choices)
2. Uniform sentence length and structure
3. Lack of burstiness (human writing alternates between short punchy sentences and long complex ones)
4. Overused AI transitional phrases: "Furthermore", "Moreover", "In conclusion", "It is important to note", "It's worth noting", "Delving into", "In today's world"
5. Overly balanced paragraph structure (each paragraph roughly same length)
6. Generic hedging language ("It can be argued", "One might say")
7. Lack of personal voice, anecdotes, or idiosyncratic word choices

Respond with ONLY a JSON object in this exact format, no other text:
{"verdict":"PASS","feedback":""}
or
{"verdict":"FAIL","feedback":"Specific issues found: ..."}

A PASS means the essay reads as convincingly human-written. A FAIL means AI markers were detected.`;

      for (let attempt = 0; attempt < MAX_LOOPS; attempt++) {
        res.write(`data: ${JSON.stringify({ status: `Checking against AI detectors... (attempt ${attempt + 1}/${MAX_LOOPS})` })}\n\n`);

        const checkResult = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: CHECKER_PROMPT,
          messages: [{ role: 'user', content: draft }],
        });
        const checkText = checkResult.content.map(b => b.text || '').join('');

        let verdict = 'PASS';
        let feedback = '';
        try {
          const parsed = JSON.parse(checkText.match(/\{[\s\S]*\}/)?.[0] || '{}');
          verdict = parsed.verdict || 'PASS';
          feedback = parsed.feedback || '';
        } catch (e) {
          // If parsing fails, assume pass
          break;
        }

        if (verdict === 'PASS') break;

        // Step C: Rewrite with checker feedback
        res.write(`data: ${JSON.stringify({ status: `Rewriting to bypass detectors... (attempt ${attempt + 1}/${MAX_LOOPS})` })}\n\n`);

        const rewriteResult = await client.messages.create({
          model: modelId,
          max_tokens: 2500,
          system: systemPrompt + `\n\nCRITICAL REWRITE INSTRUCTION: An AI detector flagged your previous draft. Here is its feedback:\n${feedback}\n\nYou MUST rewrite the essay to fix every issue listed above. Make it sound genuinely human: vary sentence lengths dramatically, use contractions, add slight imperfections, use colloquial transitions, break the predictable paragraph structure, and inject personal voice. Do NOT just rearrange — fundamentally change the rhythm and word choices.`,
          messages: [{ role: 'user', content: `Rewrite this essay to pass AI detection. Keep the same arguments and evidence but make it sound completely human-written:\n\n${draft}` }],
        });
        draft = rewriteResult.content.map(b => b.text || '').join('');
      }

      // Stream the final draft to the client
      res.write(`data: ${JSON.stringify({ status: 'Delivering final essay...' })}\n\n`);
      // Send in chunks to simulate streaming
      const chunkSize = 20;
      for (let i = 0; i < draft.length; i += chunkSize) {
        res.write(`data: ${JSON.stringify({ text: draft.slice(i, i + chunkSize) })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    // ── Standard streaming path ──
    const stream = await client.messages.stream({
      model: modelId,
      max_tokens: 2500,
      system: systemPrompt,
      messages: messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Chat API error:', err);
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
