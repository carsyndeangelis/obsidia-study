const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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

// ── Provider routing map ──
// notes → Gemini 1.5 Pro
// grading, testprep → GPT-4o
// math (text-only, no images) → o3-mini (advanced reasoning)
// everything else (math+images, essay, teacher, home, study, doublecheck, general) → Claude 3.5 Sonnet
function getProvider(page, hasImages) {
  if (page === 'notes') return 'gemini';
  if (page === 'grading' || page === 'testprep') return 'openai';
  if (page === 'math' && !hasImages) return 'openai-reasoning';
  return 'anthropic';
}

function getRequiredKey(provider) {
  switch (provider) {
    case 'gemini': return 'GEMINI_API_KEY';
    case 'openai': case 'openai-reasoning': return 'OPENAI_API_KEY';
    case 'anthropic': return 'ANTHROPIC_API_KEY';
  }
}

function getProviderDisplayName(provider) {
  switch (provider) {
    case 'gemini': return 'Gemini 1.5 Pro';
    case 'openai': return 'GPT-4o';
    case 'openai-reasoning': return 'o3-mini';
    case 'anthropic': return 'Claude 3.5 Sonnet';
  }
}

const SELF_VERIFY = 'You are a world-class, critically-thinking AI assistant. Before outputting your final response to the user, you must internally double-check your own work. Rigorously evaluate your answer for absolute factual accuracy, logical consistency, and clarity. Ask yourself: \'Is this the absolute best, most helpful possible answer I can provide?\' If your initial thought process is flawed, correct it before responding. Remove any unnecessary fluff, do not hallucinate resources, and ensure you directly and comprehensively solve the user\'s exact problem. Always strive for the highest tier of mathematical and logical reasoning.';

// ── Anthropic streaming ──
async function streamAnthropic(res, systemPrompt, messages, modelOverride) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const modelId = modelOverride === 'opus' ? 'claude-opus-4-20250514' : 'claude-3-5-sonnet-20241022';

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
}

// ── Anthropic humanizer loop (essay-specific) ──
async function streamAnthropicHumanizer(res, systemPrompt, messages, modelOverride) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const modelId = modelOverride === 'opus' ? 'claude-opus-4-20250514' : 'claude-3-5-sonnet-20241022';
  const MAX_LOOPS = 3;
  let draft = '';

  // Step A: Generate initial draft
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
      break;
    }

    if (verdict === 'PASS') break;

    res.write(`data: ${JSON.stringify({ status: `Rewriting to bypass detectors... (attempt ${attempt + 1}/${MAX_LOOPS})` })}\n\n`);

    const rewriteResult = await client.messages.create({
      model: modelId,
      max_tokens: 2500,
      system: systemPrompt + `\n\nCRITICAL REWRITE INSTRUCTION: An AI detector flagged your previous draft. Here is its feedback:\n${feedback}\n\nYou MUST rewrite the essay to fix every issue listed above. Make it sound genuinely human: vary sentence lengths dramatically, use contractions, add slight imperfections, use colloquial transitions, break the predictable paragraph structure, and inject personal voice. Do NOT just rearrange — fundamentally change the rhythm and word choices.`,
      messages: [{ role: 'user', content: `Rewrite this essay to pass AI detection. Keep the same arguments and evidence but make it sound completely human-written:\n\n${draft}` }],
    });
    draft = rewriteResult.content.map(b => b.text || '').join('');
  }

  // Stream the final draft
  res.write(`data: ${JSON.stringify({ status: 'Delivering final essay...' })}\n\n`);
  const chunkSize = 20;
  for (let i = 0; i < draft.length; i += chunkSize) {
    res.write(`data: ${JSON.stringify({ text: draft.slice(i, i + chunkSize) })}\n\n`);
  }
}

// ── OpenAI streaming (GPT-4o) ──
async function streamOpenAI(res, systemPrompt, messages) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Convert Anthropic-style messages to OpenAI format
  const openaiMessages = [{ role: 'system', content: systemPrompt }];

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Check if content is array (has images)
      if (Array.isArray(msg.content)) {
        const parts = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ type: 'text', text: block.text });
          } else if (block.type === 'image') {
            parts.push({
              type: 'image_url',
              image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` }
            });
          } else if (block.type === 'audio_base64') {
            // Pass audio as text description for OpenAI (it doesn't support inline audio the same way)
            parts.push({ type: 'text', text: '[Audio attachment provided]' });
          }
        }
        openaiMessages.push({ role: 'user', content: parts });
      } else {
        openaiMessages.push({ role: 'user', content: msg.content });
      }
    } else {
      openaiMessages.push({ role: msg.role, content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) });
    }
  }

  const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2500,
    stream: true,
    messages: openaiMessages,
  });

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  }
}

// ── OpenAI reasoning streaming (o3-mini for text-only math) ──
async function streamOpenAIReasoning(res, systemPrompt, messages) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // o3-mini uses the same chat completions API but with reasoning
  const openaiMessages = [{ role: 'system', content: systemPrompt }];

  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      // Extract text only for reasoning model
      const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      openaiMessages.push({ role: msg.role, content: text });
    } else {
      openaiMessages.push({ role: msg.role, content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) });
    }
  }

  const stream = await client.chat.completions.create({
    model: 'o3-mini',
    max_completion_tokens: 4000,
    stream: true,
    messages: openaiMessages,
  });

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  }
}

// ── Gemini streaming (for notes with audio/video support) ──
async function streamGemini(res, systemPrompt, messages) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  // Build Gemini content parts
  const contents = [];

  // Add history messages
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      const parts = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        } else if (block.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: block.source.media_type,
              data: block.source.data
            }
          });
        } else if (block.type === 'audio_base64') {
          parts.push({
            inlineData: {
              mimeType: block.mimeType,
              data: block.data
            }
          });
        }
      }
      contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts });
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
      });
    }
  }

  const chat = model.startChat({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    history: contents.slice(0, -1),
  });

  // Get the last message content for sendMessageStream
  const lastContent = contents[contents.length - 1];
  const result = await chat.sendMessageStream(lastContent.parts);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  try {
    const { message, page, vars, history, image, images, model } = req.body;

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
    const systemPrompt = SELF_VERIFY + '\n\n' + buildPrompt(safePage, safeVars);

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

    // Build user message content (text + optional images/audio)
    const userContent = [];
    const imageList = (Array.isArray(images) && images.length) ? images : (image && typeof image === 'string') ? [image] : [];
    const hasImages = imageList.some(img => typeof img === 'string' && img.startsWith('data:image/'));

    imageList.forEach(function(img) {
      if (typeof img === 'string') {
        if (img.startsWith('data:image/')) {
          const match = img.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
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
        } else if (img.startsWith('data:audio/') || img.startsWith('data:video/')) {
          // Audio/video attachments (used by Gemini for lecture notes)
          const match = img.match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i);
          if (match) {
            userContent.push({
              type: 'audio_base64',
              mimeType: match[1],
              data: match[2]
            });
          }
        }
      }
    });
    userContent.push({ type: 'text', text: trimmedMessage });
    messages.push({ role: 'user', content: userContent });

    // ── Determine provider ──
    const provider = getProvider(safePage, hasImages);
    const requiredKey = getRequiredKey(provider);

    if (!process.env[requiredKey]) {
      return res.status(500).json({
        error: `${requiredKey} not configured. Add ${requiredKey} to your Vercel environment variables. (Needed for ${getProviderDisplayName(provider)} on the "${safePage}" page)`
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // ── Humanizer loop (essay-specific, always via Anthropic) ──
    if (safePage === 'essay' && safeVars.humanizer) {
      if (!process.env.ANTHROPIC_API_KEY) {
        res.write(`data: ${JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured. Humanizer requires Claude.' })}\n\n`);
        res.end();
        return;
      }
      await streamAnthropicHumanizer(res, systemPrompt, messages, model);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    // ── Route to the correct provider ──
    switch (provider) {
      case 'anthropic':
        await streamAnthropic(res, systemPrompt, messages, model);
        break;

      case 'openai':
        await streamOpenAI(res, systemPrompt, messages);
        break;

      case 'openai-reasoning':
        await streamOpenAIReasoning(res, systemPrompt, messages);
        break;

      case 'gemini':
        await streamGemini(res, systemPrompt, messages);
        break;
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Chat API error:', err);
    if (res.headersSent) {
      // Identify the failing provider for better error messages
      let providerHint = '';
      try {
        const page = req.body?.page || 'general';
        const imgs = req.body?.images || req.body?.image;
        const hasImgs = Array.isArray(imgs) ? imgs.some(i => typeof i === 'string' && i.startsWith('data:image/')) : (typeof imgs === 'string' && imgs.startsWith('data:image/'));
        const prov = getProvider(page, hasImgs);
        providerHint = ` [${getProviderDisplayName(prov)}]`;
      } catch (_) {}

      res.write(`data: ${JSON.stringify({ error: `Something went wrong${providerHint}. Please try again.` })}\n\n`);
      res.end();
    } else {
      const status = err.status || err.statusCode || 500;
      let errorMessage = 'Something went wrong. Please try again.';

      if (status === 401) {
        errorMessage = 'Invalid API key. Check your environment variables in Vercel settings.';
      } else if (status === 429) {
        errorMessage = 'AI rate limit reached. Please wait a moment and try again.';
      } else if (err.message) {
        // Include provider context in error
        errorMessage = `API error: ${err.message.slice(0, 200)}`;
      }

      res.status(status).json({ error: errorMessage });
    }
  }
};
