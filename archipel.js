'use strict';

// ============================================================================
// STATE & CONFIG
// ============================================================================

const STATE = {
  concepts: [],        // Extracted concepts from /api/process
  embeddings: {},      // Embedding vectors mapped by concept index
  coordinates: {},     // [x, y] coordinates in the physics simulation
  velocities: {},      // [vx, vy] velocities for physics
  selectedIdx: -1,
  hoverIdx: -1,
  isProcessing: false,
  canvas: null,
  ctx: null,
  similarities: {}     // Cosine similarities between concepts
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  STATE.canvas = document.getElementById('archipelCanvas');
  STATE.ctx = STATE.canvas.getContext('2d');
  
  // Set canvas size
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
  
  // Run continuous animation loop
  requestAnimationFrame(animationLoop);
});

// ============================================================================
// FILE HANDLING & TEXT EXTRACTION
// ============================================================================

async function handleFileUpload(file) {
  if (!file) return;
  
  STATE.isProcessing = true;
  updateStatus('analyse sémantique du texte...');
  
  try {
    let text = '';
    
    if (file.type === 'application/pdf') {
      text = await extractTextFromPDF(file);
    } else if (file.name.endsWith('.md') || file.name.endsWith('.txt') || file.type === 'text/plain') {
      text = await extractTextFromFile(file);
    } else {
      throw new Error('format de fichier non supporté (utiliser pdf, txt ou markdown)');
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error('aucun texte extrait du fichier');
    }
    
    // Step 1: Process text using GPT to extract high-quality concepts
    const concepts = await processText(text);
    if (!concepts || concepts.length === 0) {
      throw new Error('impossible d\'extraire les concepts du texte');
    }
    
    // Clear previous state
    STATE.concepts = concepts;
    STATE.embeddings = {};
    STATE.coordinates = {};
    STATE.velocities = {};
    STATE.similarities = {};
    STATE.selectedIdx = -1;
    STATE.hoverIdx = -1;
    
    // Render initial list in sidebar (in loading state)
    renderNotionsList();
    
    // Step 2: Fetch embeddings sequentially and animate them as they load
    updateStatus('cartographie des concepts...');
    await loadEmbeddings();
    
    updateStatus('paysage de pensée prêt');
    STATE.isProcessing = false;
  } catch (err) {
    console.error(err);
    updateStatus(`erreur: ${err.message.toLowerCase()}`);
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
    reader.onerror = () => reject(new Error('erreur lors de la lecture du pdf'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('erreur lors de la lecture du fichier'));
    reader.readAsText(file);
  });
}

// ============================================================================
// BACKEND API CLIENTS
// ============================================================================

async function processText(text) {
  try {
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error(`http ${response.status}`);
    }
    
    const data = await response.json();
    return data.concepts || [];
  } catch (err) {
    throw err;
  }
}

async function getEmbedding(text) {
  try {
    const response = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error(`http ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.embedding) throw new Error('no embedding vector');
    
    return data.embedding;
  } catch (err) {
    return generateFallbackEmbedding(text);
  }
}

function generateFallbackEmbedding(text) {
  const words = text.toLowerCase().split(/\s+/);
  const dim = 1536;  
  const embedding = new Array(dim).fill(0);
  
  words.forEach((word, idx) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;  
    }
    
    const pos = Math.abs(hash) % dim;
    embedding[pos] += (Math.sin(hash / 1000) + Math.cos(idx)) / 2;
  });
  
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => norm > 0 ? v / norm : 0);
}

// ============================================================================
// SEQUENTIAL EMBEDDING LOADER
// ============================================================================

async function loadEmbeddings() {
  const wrapper = document.querySelector('.canvas-wrapper');
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  
  for (let i = 0; i < STATE.concepts.length; i++) {
    const concept = STATE.concepts[i];
    
    updateStatus(`calcul de la relation sémantique (${i + 1}/${STATE.concepts.length}): ${concept.title}`);
    
    const vector = await getEmbedding(`${concept.title}: ${concept.description}`);
    STATE.embeddings[i] = vector;
    
    STATE.coordinates[i] = [
      w / 2 + (Math.random() - 0.5) * 50,
      h / 2 + (Math.random() - 0.5) * 50
    ];
    STATE.velocities[i] = [0, 0];
    
    computeSimilaritiesForNode(i);
    renderNotionsList();
  }
}

function cosineSimilarity(v1, v2) {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    mA += v1[i] * v1[i];
    mB += v2[i] * v2[i];
  }
  return mA && mB ? dotProduct / (Math.sqrt(mA) * Math.sqrt(mB)) : 0;
}

function computeSimilaritiesForNode(nodeIdx) {
  STATE.similarities[nodeIdx] = {};
  
  for (let i = 0; i <= nodeIdx; i++) {
    if (i === nodeIdx) {
      STATE.similarities[nodeIdx][i] = 1;
    } else if (STATE.embeddings[i] && STATE.embeddings[nodeIdx]) {
      const sim = cosineSimilarity(STATE.embeddings[i], STATE.embeddings[nodeIdx]);
      STATE.similarities[nodeIdx][i] = sim;
      
      if (!STATE.similarities[i]) STATE.similarities[i] = {};
      STATE.similarities[i][nodeIdx] = sim;
    }
  }
}

// ============================================================================
// ANIMATION & PHYSICS SIMULATION
// ============================================================================

function animationLoop() {
  updatePhysics();
  draw();
  requestAnimationFrame(animationLoop);
}

function updatePhysics() {
  const loadedIndices = Object.keys(STATE.coordinates).map(Number);
  const n = loadedIndices.length;
  if (n === 0) return;
  
  const wrapper = document.querySelector('.canvas-wrapper');
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  
  const k = 150; // Natural distance
  const forcesX = {};
  const forcesY = {};
  
  loadedIndices.forEach(i => {
    forcesX[i] = 0;
    forcesY[i] = 0;
  });
  
  // 1. Repulsive forces between all loaded nodes
  for (let i = 0; i < n; i++) {
    const idxA = loadedIndices[i];
    for (let j = i + 1; j < n; j++) {
      const idxB = loadedIndices[j];
      
      const dx = STATE.coordinates[idxB][0] - STATE.coordinates[idxA][0];
      const dy = STATE.coordinates[idxB][1] - STATE.coordinates[idxA][1];
      const dist = Math.hypot(dx, dy) || 1;
      
      const force = (k * k) / dist;
      const fx = (dx / dist) * force * 0.15;
      const fy = (dy / dist) * force * 0.15;
      
      forcesX[idxA] -= fx;
      forcesY[idxA] -= fy;
      forcesX[idxB] += fx;
      forcesY[idxB] += fy;
    }
  }
  
  // 2. Attractive forces based on cosine similarity
  for (let i = 0; i < n; i++) {
    const idxA = loadedIndices[i];
    for (let j = i + 1; j < n; j++) {
      const idxB = loadedIndices[j];
      
      const sim = STATE.similarities[idxA]?.[idxB] || 0;
      if (sim <= 0) continue;
      
      const dx = STATE.coordinates[idxB][0] - STATE.coordinates[idxA][0];
      const dy = STATE.coordinates[idxB][1] - STATE.coordinates[idxA][1];
      const dist = Math.hypot(dx, dy) || 1;
      
      const targetDist = k * (1 - sim + 0.1);
      const force = (dist - targetDist) * (sim + 0.1) * 0.12;
      
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      
      forcesX[idxA] += fx;
      forcesY[idxA] += fy;
      forcesX[idxB] -= fx;
      forcesY[idxB] -= fy;
    }
  }
  
  // 3. Weak attraction between consecutive nodes to maintain textual narrative flow
  for (let i = 0; i < n - 1; i++) {
    const idxA = loadedIndices[i];
    const idxB = loadedIndices[i + 1];
    
    const dx = STATE.coordinates[idxB][0] - STATE.coordinates[idxA][0];
    const dy = STATE.coordinates[idxB][1] - STATE.coordinates[idxA][1];
    const dist = Math.hypot(dx, dy) || 1;
    
    const force = (dist - 120) * 0.05;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    
    forcesX[idxA] += fx;
    forcesY[idxA] += fy;
    forcesX[idxB] -= fx;
    forcesY[idxB] -= fy;
  }
  
  // 4. Center-gravity forces
  loadedIndices.forEach(idx => {
    const dx = w / 2 - STATE.coordinates[idx][0];
    const dy = h / 2 - STATE.coordinates[idx][1];
    forcesX[idx] += dx * 0.012;
    forcesY[idx] += dy * 0.012;
  });
  
  // Apply forces to update positions
  const damping = 0.78;
  loadedIndices.forEach(idx => {
    STATE.velocities[idx][0] = (STATE.velocities[idx][0] + forcesX[idx] * 0.1) * damping;
    STATE.velocities[idx][1] = (STATE.velocities[idx][1] + forcesY[idx] * 0.1) * damping;
    
    STATE.coordinates[idx][0] += STATE.velocities[idx][0];
    STATE.coordinates[idx][1] += STATE.velocities[idx][1];
  });
}

// ============================================================================
// CANVAS DRAWING
// ============================================================================

function draw() {
  const canvas = STATE.canvas;
  const ctx = STATE.ctx;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  
  // Clear with light background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  
  // Grid
  drawGrid(ctx, w, h);
  
  const loadedIndices = Object.keys(STATE.coordinates).map(Number);
  if (loadedIndices.length === 0) {
    ctx.fillStyle = '#86868b';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('déposer un texte pour cartographier le paysage conceptuel', w / 2, h / 2);
    return;
  }
  
  // Draw similarity links (very thin dashed lines)
  drawSimilarityLinks(ctx, loadedIndices);
  
  // Draw consecutive flow trajectory (continuous thin line)
  drawTrajectory(ctx, loadedIndices);
  
  // Draw nodes
  drawNodes(ctx, loadedIndices);
}

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = '#f5f5f7';
  ctx.lineWidth = 1;
  
  const size = 80;
  for (let x = 0; x < w; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawSimilarityLinks(ctx, indices) {
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  
  for (let i = 0; i < indices.length; i++) {
    const idxA = indices[i];
    for (let j = i + 1; j < indices.length; j++) {
      const idxB = indices[j];
      const sim = STATE.similarities[idxA]?.[idxB] || 0;
      
      if (sim > 0.45 && Math.abs(idxA - idxB) > 1) {
        const [x1, y1] = STATE.coordinates[idxA];
        const [x2, y2] = STATE.coordinates[idxB];
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
}

function drawTrajectory(ctx, indices) {
  ctx.strokeStyle = '#d2d2d7';
  ctx.lineWidth = 1.2;
  
  for (let i = 0; i < indices.length - 1; i++) {
    const idxA = indices[i];
    const idxB = indices[i + 1];
    
    if (STATE.coordinates[idxA] && STATE.coordinates[idxB]) {
      const [x1, y1] = STATE.coordinates[idxA];
      const [x2, y2] = STATE.coordinates[idxB];
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

function drawNodes(ctx, indices) {
  indices.forEach(idx => {
    const [x, y] = STATE.coordinates[idx];
    const isHover = idx === STATE.hoverIdx;
    const isSelected = idx === STATE.selectedIdx;
    
    const radius = isSelected ? 6 : isHover ? 7 : 4.5;
    
    ctx.fillStyle = isSelected ? '#1d1d1f' : isHover ? '#424245' : '#86868b';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    if (isHover || isSelected) {
      ctx.strokeStyle = isSelected ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
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
  
  STATE.ctx.setTransform(1, 0, 0, 1, 0, 0);
  STATE.ctx.scale(dpr, dpr);
}

// ============================================================================
// INTERACTIONS & UI UPDATES
// ============================================================================

function handleCanvasMouseMove(e) {
  const rect = STATE.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const loadedIndices = Object.keys(STATE.coordinates).map(Number);
  let nearestIdx = -1;
  let minDist = 24;  
  
  loadedIndices.forEach(idx => {
    const dist = Math.hypot(STATE.coordinates[idx][0] - x, STATE.coordinates[idx][1] - y);
    if (dist < minDist) {
      minDist = dist;
      nearestIdx = idx;
    }
  });
  
  STATE.hoverIdx = nearestIdx;
  
  const tooltip = document.getElementById('tooltip');
  if (nearestIdx >= 0) {
    const concept = STATE.concepts[nearestIdx];
    
    tooltip.innerHTML = `
      <h3>${concept.title}</h3>
      <p>${concept.description}</p>
      ${concept.context ? `<div class="context">« ${concept.context} »</div>` : ''}
    `;
    
    tooltip.style.left = (e.clientX - rect.left + 16) + 'px';
    tooltip.style.top = (e.clientY - rect.top + 16) + 'px';
    tooltip.classList.add('visible');
  } else {
    tooltip.classList.remove('visible');
  }
}

function handleCanvasClick(e) {
  if (STATE.hoverIdx >= 0) {
    STATE.selectedIdx = STATE.selectedIdx === STATE.hoverIdx ? -1 : STATE.hoverIdx;
    renderNotionsList();
    
    if (STATE.selectedIdx >= 0) {
      const activeEl = document.querySelector(`.notion-item[data-idx="${STATE.selectedIdx}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
}

function updateStatus(message) {
  const indicator = document.getElementById('statusIndicator');
  indicator.textContent = message;
}

function renderNotionsList() {
  const list = document.getElementById('notionsList');
  const container = document.getElementById('notionsContainer');
  
  if (STATE.concepts.length === 0) {
    list.style.display = 'none';
    return;
  }
  
  list.style.display = 'flex';
  container.innerHTML = STATE.concepts.map((concept, idx) => {
    const isLoaded = STATE.embeddings[idx] !== undefined;
    const isSelected = idx === STATE.selectedIdx;
    
    if (!isLoaded) {
      return `
        <div class="notion-item loading" data-idx="${idx}">
          ${concept.title} (calcul...)
        </div>
      `;
    }
    
    return `
      <div class="notion-item ${isSelected ? 'active' : ''}" data-idx="${idx}">
        ${concept.title}
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.notion-item:not(.loading)').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.dataset.idx);
      STATE.selectedIdx = STATE.selectedIdx === idx ? -1 : idx;
      renderNotionsList();
    });
  });
}
