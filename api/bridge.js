export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { conceptA, conceptB } = req.body;

  if (!conceptA || !conceptB) {
    return res.status(400).json({ error: 'Missing concepts for bridging' });
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
            content: `You are a philosophical synthesizer. Your task is to perform "anamnesis" by bridging two distinct concepts. 
Analyze the relationship between the two provided concepts and create a NEW "synthetic" concept that bridges them.
This synthetic concept should:
1. Resolve their tension, establish a dialectic synthesis, or find a deeper underlying principle.
2. Be rigorous and precise.

Return a valid JSON object with:
- "title": A concise title for the synthesis (2-4 words, strictly lowercase).
- "description": A highly rigorous explanation of the synthesis (2-3 sentences).
- "weight": A number between 5 and 10 representing its conceptual weight.
- "relationToA": A short explanation of its relationship to the first concept.
- "relationToB": A short explanation of its relationship to the second concept.
- "isTensionA": boolean, whether the link to concept A is a tension.
- "isTensionB": boolean, whether the link to concept B is a tension.`
          },
          {
            role: 'user',
            content: `Concept A: ${conceptA.title} - ${conceptA.description}\nConcept B: ${conceptB.title} - ${conceptB.description}`
          }
        ],
        temperature: 0.7,
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
    console.error('Bridge error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
