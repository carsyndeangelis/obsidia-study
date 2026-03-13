// F8: Analytics endpoint — returns user study analytics
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Analytics queries run client-side via the Supabase user_analytics view
  // This endpoint generates AI-powered weekly insights
  const Anthropic = require('@anthropic-ai/sdk');
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { stats } = req.body;
  if (!stats) return res.status(400).json({ error: 'Stats required' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: 'You are a study coach analyzing a student\'s weekly learning data. Be encouraging, specific, and actionable. Keep response under 150 words. Use 2-3 bullet points.',
      messages: [{
        role: 'user',
        content: `Analyze this student's study data and give a brief weekly insight:\n${JSON.stringify(stats)}`
      }]
    });

    const insight = message.content[0]?.text || 'Keep studying! Check back next week for insights.';
    res.json({ insight, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('Analytics AI error:', err);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
};
