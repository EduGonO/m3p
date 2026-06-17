'use strict';

// ============================================================================
// STATE & CONFIG
// ============================================================================

const STATE = {
  chunks: [],
  embeddings: [],
  coordinates: [],
  selectedChunkIdx: -1,
  hoverChunkIdx: -1,
  isProcessing: false,
  canvas: null,
  ctx: null
};

// API endpoint — uses Vercel environment or falls back to browser-based local inference
const API_BASE = '/api';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  STATE.canvas = document.getElementById('archipelCanvas');
  STATE.ctx = STATE.canvas.getContext('2d');
  
  // Set canvas to window size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // File input
  const fileInput = document.getElementById('fileInput');
  const uploadZone = document.getElementById('uploadZone');
  
  fileInput.addEventListener('change', e => handleFileUpload(e.target.files[0]));
  uploadZone.addEventListener('click', () => fileInput.click());
  
  // Drag and drop
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });
  
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFileUpload(e.dataTransfer.files[0]);
  });
  
  // Canvas interactions
  STATE.canvas.addEventListener('mousemove', handleCanvasMouseMove);
  STATE.canvas.addEventListener('click', handleCanvasClick);
  
  // Initial draw
  draw();
});

// ============================================================================
// FILE HANDLING & TEXT EXTRACTION
// ============================================================================

async function handleFileUpload(file) {
  if (!file) return;
  
  updateStatus('processing', 'Extracting text...');
  STATE.isProcessing = true;
  
  try {
    let text = '';
    
    if (file.type === 'application/pdf') {
      text = await extractTextFromPDF(file);
    } else if (file.name.endsWith('.md') || file.name.endsWith('.txt') || file.type === 'text/plain') {
      text = await extractTextFromFile(file);
    } else {
      throw new Error('Unsupported file type. Use PDF, TXT, or Markdown.');
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text extracted from file.');
    }
    
    // Chunk the text
    updateStatus('processing', 'Segmenting text...');
    await chunkText(text);
    
    // Get embeddings
    updateStatus('processing', `Getting embeddings (${STATE.chunks.length} chunks)...`);
    await getEmbeddings();
    
    // Reduce to 2D
    updateStatus('processing', 'Reducing dimensions...');
    reduceTo2D();
    
    // Render list and canvas
    renderChunksList();
    draw();
    
    updateStatus('success', `Constellation ready (${STATE.chunks.length} nodes)`);
    STATE.isProcessing = false;
  } catch (err) {
    console.error(err);
    updateStatus('error', err.message);
    STATE.isProcessing = false;
  }
}

async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          text += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        resolve(text);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read PDF'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ============================================================================
// TEXT CHUNKING
// ============================================================================

async function chunkText(text) {
  // Split by paragraphs (double newline or more)
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20);  // Minimum meaningful length
  
  STATE.chunks = paragraphs.map((text, idx) => ({
    id: idx,
    text: text.length > 500 ? text.substring(0, 500) + '…' : text,
    fullText: text,
    length: text.length
  }));
  
  document.getElementById('chunkCount').textContent = STATE.chunks.length;
}

// ============================================================================
// EMBEDDINGS & DIMENSIONALITY REDUCTION
// ============================================================================

async function getEmbeddings() {
  STATE.embeddings = [];
  
  // Try to use the Vercel API endpoint (like app.js does)
  // If that fails, fall back to a simple local hashing approach for demo
  
  for (let i = 0; i < STATE.chunks.length; i++) {
    try {
      const embedding = await getEmbedding(STATE.chunks[i].fullText);
      STATE.embeddings.push(embedding);
      document.getElementById('embeddingCount').textContent = STATE.embeddings.length;
    } catch (err) {
      console.warn(`Failed to get embedding for chunk ${i}:`, err);
      // Fall back to deterministic hash-based embedding
      STATE.embeddings.push(generateFallbackEmbedding(STATE.chunks[i].fullText));
      document.getElementById('embeddingCount').textContent = STATE.embeddings.length;
    }
  }
}

async function getEmbedding(text) {
  // Attempt to call OpenAI API via Vercel
  try {
    const response = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.embedding) throw new Error('No embedding in response');
    
    return data.embedding;
  } catch (err) {
    // Try direct OpenAI if available via environment
    // Otherwise use fallback
    throw err;
  }
}

function generateFallbackEmbedding(text) {
  // Deterministic hash-based 1536-dim embedding for fallback
  // Uses text words, length, unique chars to generate pseudo-semantic vector
  const words = text.toLowerCase().split(/\s+/);
  const dim = 1536;  // text-embedding-3-small output size
  const embedding = new Array(dim).fill(0);
  
  // Hash each word and distribute across dimensions
  words.forEach((word, idx) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;  // Convert to 32bit int
    }
    
    const pos = Math.abs(hash) % dim;
    embedding[pos] += (Math.sin(hash / 1000) + Math.cos(idx)) / 2;
  });
  
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => norm > 0 ? v / norm : 0);
}

function reduceTo2D() {
  // Simple PCA-like reduction: use top 2 components via covariance
  if (STATE.embeddings.length === 0) return;
  
  const dim = STATE.embeddings[0].length;
  const n = STATE.embeddings.length;
  
  // Compute mean
  const mean = new Array(dim).fill(0);
  STATE.embeddings.forEach(emb => {
    emb.forEach((v, i) => mean[i] += v);
  });
  mean.forEach((_, i) => mean[i] /= n);
  
  // Center data
  const centered = STATE.embeddings.map(emb =>
    emb.map((v, i) => v - mean[i])
  );
  
  // Compute covariance matrix (full is O(d^2), so use random projection)
  // For speed, project onto random basis and take top 2
  const v1 = new Array(dim).fill(0);
  const v2 = new Array(dim).fill(0);
  
  for (let i = 0; i < dim; i++) {
    v1[i] = Math.sin(i * 0.1);
    v2[i] = Math.cos(i * 0.1 + 1.57);
  }
  
  // Project each centered vector onto v1, v2
  STATE.coordinates = centered.map(vec => [
    vec.reduce((sum, v, i) => sum + v * v1[i], 0),
    vec.reduce((sum, v, i) => sum + v * v2[i], 0)
  ]);
  
  // Normalize to canvas bounds
  normalizeCoordinates();
}

function normalizeCoordinates() {
  if (STATE.coordinates.length === 0) return;
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  STATE.coordinates.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  
  const padding = 80;
  const w = STATE.canvas.width - padding * 2;
  const h = STATE.canvas.height - padding * 2;
  
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  
  STATE.coordinates = STATE.coordinates.map(([x, y]) => [
    padding + ((x - minX) / rangeX) * w,
    padding + ((y - minY) / rangeY) * h
  ]);
}

// ============================================================================
// CANVAS RENDERING
// ============================================================================

function draw() {
  const canvas = STATE.canvas;
  const ctx = STATE.ctx;
  const w = canvas.width;
  const h = canvas.height;
  
  // Clear with dark background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);
  
  // Draw subtle grid
  drawGrid(ctx, w, h);
  
  if (STATE.coordinates.length === 0) {
    ctx.fillStyle = '#444';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Upload a document to create the constellation', w / 2, h / 2);
    return;
  }
  
  // Draw connections (trajectory)
  drawConnections(ctx);
  
  // Draw nodes
  drawNodes(ctx);
  
  requestAnimationFrame(draw);
}

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  
  const gridSize = 100;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawConnections(ctx) {
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < STATE.coordinates.length - 1; i++) {
    const [x1, y1] = STATE.coordinates[i];
    const [x2, y2] = STATE.coordinates[i + 1];
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function drawNodes(ctx) {
  STATE.coordinates.forEach((coord, idx) => {
    const [x, y] = coord;
    const isHover = idx === STATE.hoverChunkIdx;
    const isSelected = idx === STATE.selectedChunkIdx;
    
    // Calculate color based on position and density
    const hue = (idx / STATE.coordinates.length) * 360;
    const saturation = isHover ? 100 : 70;
    const lightness = isSelected ? 60 : 50;
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    
    // Glow effect
    const radius = isHover ? 12 : isSelected ? 10 : 6;
    const glowRadius = radius * 2;
    
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    glow.addColorStop(0, color + '40');
    glow.addColorStop(1, color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Core dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight ring
    if (isHover || isSelected) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function resizeCanvas() {
  const wrapper = document.querySelector('.canvas-wrapper');
  if (!STATE.canvas) return;
  
  const dpr = window.devicePixelRatio || 1;
  STATE.canvas.width = wrapper.clientWidth * dpr;
  STATE.canvas.height = wrapper.clientHeight * dpr;
  
  STATE.ctx.scale(dpr, dpr);
  
  // Recenter coordinates if they exist
  if (STATE.coordinates.length > 0) {
    normalizeCoordinates();
  }
}

// ============================================================================
// INTERACTIONS
// ============================================================================

function handleCanvasMouseMove(e) {
  const rect = STATE.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Find nearest chunk
  let nearest = -1;
  let minDist = 20;  // Hover radius
  
  STATE.coordinates.forEach((coord, idx) => {
    const dist = Math.hypot(coord[0] - x, coord[1] - y);
    if (dist < minDist) {
      minDist = dist;
      nearest = idx;
    }
  });
  
  STATE.hoverChunkIdx = nearest;
  
  // Update tooltip
  const tooltip = document.getElementById('tooltip');
  if (nearest >= 0) {
    const chunk = STATE.chunks[nearest];
    tooltip.textContent = chunk.fullText.substring(0, 200);
    tooltip.style.left = (e.clientX - rect.left + 10) + 'px';
    tooltip.style.top = (e.clientY - rect.top + 10) + 'px';
    tooltip.classList.remove('hidden');
    tooltip.classList.add('visible');
  } else {
    tooltip.classList.add('hidden');
    tooltip.classList.remove('visible');
  }
}

function handleCanvasClick(e) {
  if (STATE.hoverChunkIdx >= 0) {
    STATE.selectedChunkIdx = STATE.selectedChunkIdx === STATE.hoverChunkIdx ? -1 : STATE.hoverChunkIdx;
    renderChunksList();
  }
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateStatus(type, message) {
  const statusBar = document.getElementById('statusBar');
  const statusLabel = document.getElementById('statusLabel');
  
  statusBar.textContent = message;
  statusBar.className = 'status-bar';
  
  if (type === 'processing') {
    statusBar.classList.add('processing');
    statusLabel.textContent = 'processing…';
  } else if (type === 'error') {
    statusBar.classList.add('error');
    statusLabel.textContent = 'error';
  } else if (type === 'success') {
    statusBar.classList.add('success');
    statusLabel.textContent = 'ready';
    setTimeout(() => {
      statusBar.className = 'status-bar';
      statusBar.textContent = 'Ready';
    }, 3000);
  }
}

function renderChunksList() {
  const list = document.getElementById('chunksList');
  const container = document.getElementById('chunksContainer');
  
  if (STATE.chunks.length === 0) {
    list.style.display = 'none';
    return;
  }
  
  list.style.display = 'block';
  container.innerHTML = STATE.chunks.map((chunk, idx) => `
    <div class="chunk-item ${idx === STATE.selectedChunkIdx ? 'active' : ''}" data-idx="${idx}">
      ${chunk.text.substring(0, 50)}…
    </div>
  `).join('');
  
  container.querySelectorAll('.chunk-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.dataset.idx);
      STATE.selectedChunkIdx = STATE.selectedChunkIdx === idx ? -1 : idx;
      renderChunksList();
    });
  });
}