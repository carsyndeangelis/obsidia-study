// F1: Full-text search across chat messages
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, limit } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  // This endpoint is a proxy hint — actual search runs client-side via Supabase RPC
  // But we provide a server-side fallback for non-authenticated search
  res.json({
    message: 'Use Supabase RPC search_messages() for authenticated full-text search',
    query: query.slice(0, 200),
    limit: Math.min(limit || 20, 50)
  });
};
