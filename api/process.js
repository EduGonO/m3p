export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid text parameter' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a rigorous, precise philosophical assistant. Your task is to analyze the text and extract the 10-15 most significant concepts, notions, images, or philosophical ideas.
Return a valid JSON object with a single key "concepts" containing an array of objects.
Each object must have:
- "title": A concise, precise title of the concept (2-4 words, strictly lowercase, e.g. "l'apeiron algorithmique").
- "description": A highly rigorous, precise explanation of this concept's meaning and philosophical weight within the text (1-2 sentences).
- "context": A short verbatim snippet from the text showcasing this concept in action.

Example output:
{
  "concepts": [
    {
      "title": "grammatisation de la mémoire",
      "description": "Le passage d'un flux temporel de la parole vivante à sa discrétisation et spatialisation spatio-temporelle sous forme d'écriture.",
      "context": "la mémoire se matérialise dans des supports techniques..."
    }
  ]
}`
          },
          {
            role: 'user',
            content: text.slice(0, 50000)
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'OpenAI API error' });
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(resultText);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Process error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
