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
            content: `Tu es un assistant philosophique de haute précision, expert en dissection conceptuelle et en analyse de structures argumentatives complexes. Ton rôle est de transformer un texte brut en une cartographie intellectuelle exhaustive et visuellement dense.

Ta tâche consiste à analyser le texte fourni et à produire un objet JSON structuré contenant :

1. "summary" : Un résumé de haut niveau (3-4 phrases), rédigé dans la langue originale du document, synthétisant la thèse centrale et son mouvement.

2. "concepts" : Un réseau dense de 15 à 25 nodes (concepts clés, noms propres, événements historiques, termes techniques, images récurrentes). 
Chaque objet concept doit inclure :
- "title" : Titre concis (2-4 mots, strictement en minuscules).
- "description" : Une explication rigoureuse et profonde (2 phrases) précisant la fonction du concept dans le texte.
- "context" : Un court fragment verbatim (citation).
- "weight" : Un score de 1 à 10 (importance relative).

3. "tensions" : Identification des points de friction ("polemos"). Cherche activement les contradictions, les paradoxes, les oppositions binaires ou les sauts logiques. 
Chaque objet tension doit inclure :
- "source" : Titre exact du premier concept.
- "target" : Titre exact du second concept.
- "explanation" : Explication précise de la contradiction ou de la tension dialectique entre les deux.

CONSIGNES DE RIGUEUR :
- Ne te limite pas à la surface ; creuse les prémisses cachées.
- Le réseau doit être interconnecté : les concepts doivent former une toile logique cohérente.
- Identifie au moins 5 tensions significatives pour nourrir la physique du graphe.`
          },
          {
            role: 'user',
            content: text.slice(0, 50000)
          }
        ],
        temperature: 0.3,
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
