# m3p — Archipel Sémantique & Philosopher Database

## Overview

This repository hosts two complementary systems for exploring philosophical ideas:

1. **L'Archipel Sémantique** (main) — Interactive semantic constellation for essays, dissertations, and philosophical texts
2. **Philosopher Database** (database.html) — Static atlas of historical philosophers and their concepts

## L'Archipel Sémantique

A visual knowledge exploration tool that transforms essays, dissertations, or philosophical texts into interactive semantic constellations.

### How It Works

1. **Upload** — Drop a PDF, TXT, or Markdown file (dissertation, essay, philosophy text)
2. **Extract** — Client-side text extraction (PDF.js for PDFs)
3. **Chunk** — Automatic segmentation into semantic paragraphs
4. **Embed** — OpenAI text-embedding-3-small API (via Vercel serverless function)
5. **Reduce** — Dimensionality reduction to 2D coordinates
6. **Visualize** — Interactive constellation: glowing nodes, semantic trajectory lines, hover tooltips

### Technology

- **Frontend:** Vanilla HTML, CSS, JavaScript (zero frameworks)
- **PDF Parsing:** PDF.js (CDN)
- **Embeddings:** OpenAI API (text-embedding-3-small)
- **Serverless:** Vercel Functions (api/embed.js)
- **Rendering:** HTML5 Canvas with requestAnimationFrame
- **Styling:** CSS Grid, CSS Variables, glassmorphism

### Files

- `index.html` — Main entry point
- `archipel.js` — All application logic (text extraction, embedding, visualization)
- `api/embed.js` — Vercel serverless function for OpenAI embeddings
- `archipel.html` — Legacy backup (same content as index.html)

### Deployment

On Vercel, set the environment variable:
```
OPENAI_API_KEY=sk-...
```

The app works at the root domain and automatically falls back to hash-based embeddings if the API is unavailable.

---

## Philosopher Database

Original philosopher atlas system. Access at `/database.html`.

### Files

- `database.html` — Philosopher graph visualization
- `app.js` — Database application logic
- `philosophers.json` — Full philosopher dataset (1536 dim, 119 thinkers, 839 postulates, 952 links)
- `philosophers-data.json` — Canonical supplementary data

### Use

Open `database.html` from a static server, GitHub Pages, or Vercel. Manual data upload supported.

---

## Local Development

```bash
# Serve locally
python3 -m http.server 8000

# Open browser
http://localhost:8000
```

No build step required. All code is vanilla JavaScript.

---

## Design Notes

### Semantic Visualization

- **Nodes** = paragraph chunks of text, colored by sequence
- **Glows** = semantic similarity/embedding proximity
- **Lines** = semantic trajectory (sequential chunks connected)
- **Hover** = preview text fragment
- **Click** = select node, highlight in sidebar

### Accessibility

- Canvas rendering for performance
- Fallback embeddings (hash-based) if API unavailable
- Responsive design (mobile: stacked layout)
- Dark-first color scheme

---

## Future Extensions

- [ ] Multi-document comparison
- [ ] Annotation layer
- [ ] Export constellation as image/SVG
- [ ] Local LLM embedding fallback (Ollama, ONNX)
- [ ] Citation network visualization
- [ ] Thematic clustering overlays
