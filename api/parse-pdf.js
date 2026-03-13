// F4: PDF text extraction endpoint
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pdf_base64 } = req.body;
  if (!pdf_base64) return res.status(400).json({ error: 'PDF data required' });

  try {
    const pdfParse = require('pdf-parse');
    const buffer = Buffer.from(pdf_base64, 'base64');

    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'PDF too large. Maximum 15 MB.' });
    }

    const data = await pdfParse(buffer);
    res.json({
      text: data.text.slice(0, 50000), // Cap at ~50k chars
      pages: data.numpages,
      info: data.info || {},
      truncated: data.text.length > 50000
    });
  } catch (err) {
    console.error('PDF parse error:', err);
    res.status(500).json({ error: 'Failed to parse PDF. Ensure the file is a valid PDF.' });
  }
};
