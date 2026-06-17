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
            content: `You are a rigorous, precise philosophical assistant. Your task is to analyze the text and:
1. Provide a concise, high-level summary of the document (3-4 sentences, in the document's original language).
2. Extract the 10-15 most significant concepts, notions, images, or philosophical ideas.

Return a valid JSON object with:
- "summary": The document summary.
- "concepts": An array of objects.

Each concept object must have:
- "title": A concise title (2-4 words, strictly lowercase).
- "description": A highly rigorous explanation (1-2 sentences).
- "context": A short verbatim snippet from the text.
- "weight": A number between 1 and 10 representing the relative importance or presence of this concept in the text.`
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
