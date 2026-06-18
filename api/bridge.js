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
            content: `Tu es un assistant spécialisé dans la synthèse d'idées. Ta tâche est de créer un nouveau concept "synthétique" qui relie deux concepts existants.

Analyse la relation entre les deux concepts fournis et crée une synthèse inédite.
Cette synthèse doit :
1. Résoudre leur tension, établir un pont logique ou trouver un principe commun.
2. Être formulée de manière simple et précise.
3. ÊTRE INTÉGRALEMENT EN FRANÇAIS (titre et descriptions).

Retourne un objet JSON valide avec :
- "title" : Un titre court pour la synthèse (2-4 mots, strictement en minuscules).
- "description" : Une explication simple et précise de la synthèse (2 phrases).
- "weight" : Un nombre entre 5 et 10 représentant son importance.
- "relationToA" : Une courte explication du lien avec le premier concept (en français).
- "relationToB" : Une courte explication du lien avec le second concept (en français).
- "isTensionA" : boolean, si le lien avec le concept A est une tension.
- "isTensionB" : boolean, si le lien avec le concept B est une tension.`
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
