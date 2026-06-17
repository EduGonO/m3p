'use strict';

// ============================================================================
// STATE & CONFIG
// ============================================================================

const STATE = {
  concepts: [],        // Extracted concepts from /api/process
  summary: "",         // Document summary
  embeddings: {},      // Embedding vectors mapped by concept index
  coordinates: {},     // [x, y] coordinates in the physics simulation
  velocities: {},      // [vx, vy] velocities for physics
  selectedIdx: -1,
  hoverIdx: -1,
  hoverLink: null,     // {idxA, idxB, sim}
  isProcessing: false,
  canvas: null,
  ctx: null,
  similarities: {},    // Cosine similarities between concepts
  offset: { x: 0, y: 0 },
  targetOffset: { x: 0, y: 0 }, // For smooth panning
  isDragging: false,
  lastMousePos: { x: 0, y: 0 },
  progressInterval: null
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
  STATE.canvas.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  STATE.canvas.addEventListener('click', handleCanvasClick);
  
  // Run continuous animation loop
  requestAnimationFrame(animationLoop);
});

// ============================================================================
// FILE HANDLING & TEXT EXTRACTION
// ============================================================================

async function handleFileUpload(file) {
  if (!file) return;
  
  // Immediate UI update
  showUploadProgress(file.name);
  setProgressBar(5);
  
  STATE.isProcessing = true;
  updateStatus('extraction du texte...');
  
  // Start smooth simulated progress
  startSimulatedProgress(5, 45, 5000); 

  try {
    let text = '';
    
    if (file.type === 'application/pdf') {
      text = await extractTextFromPDF(file);
    } else if (file.name.endsWith('.md') || file.name.endsWith('.txt') || file.type === 'text/plain') {
      text = await extractTextFromFile(file);
    } else {
      throw new Error('format de fichier non supporté');
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error('aucun texte extrait');
    }
    
    updateStatus('analyse sémantique...');
    startSimulatedProgress(45, 80, 15000); // Slower for API call

    const result = await processText(text);
    if (!result.concepts || result.concepts.length === 0) {
      throw new Error('échec de l\'extraction');
    }
    
    // Clear previous state
    STATE.concepts = result.concepts;
    STATE.summary = result.summary || "";
    STATE.embeddings = {};
    STATE.coordinates = {};
    STATE.velocities = {};
    STATE.similarities = {};
    STATE.selectedIdx = -1;
    STATE.hoverIdx = -1;
    STATE.offset = { x: 0, y: 0 };
    STATE.targetOffset = { x: 0, y: 0 };
    
    displaySummary();
    renderNotionsList();
    
    updateStatus('génération de la constellation...');
    // Tie the last 20% to real embedding progress
    await loadEmbeddings(80);
    
    setProgressBar(100);
    stopSimulatedProgress();
    setTimeout(() => hideUploadProgress(), 1000);
    
    updateStatus('paysage de pensée prêt');
    STATE.isProcessing = false;
  } catch (err) {
    console.error(err);
    updateStatus(`erreur: ${err.message.toLowerCase()}`);
    stopSimulatedProgress();
    setProgressBar(0);
    STATE.isProcessing = false;
  }
}

function startSimulatedProgress(start, end, duration) {
  stopSimulatedProgress();
  const startTime = Date.now();
  STATE.progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(end, start + (elapsed / duration) * (end - start));
    setProgressBar(progress);
    if (progress >= end) clearInterval(STATE.progressInterval);
  }, 50);
}

function stopSimulatedProgress() {
  if (STATE.progressInterval) clearInterval(STATE.progressInterval);
}

function showUploadProgress(filename) {
  document.getElementById('uploadContent').style.display = 'none';
  document.getElementById('uploadInfo').style.display = 'block';
  document.getElementById('filenameDisplay').textContent = filename;
}

function hideUploadProgress() {
  document.getElementById('uploadContent').style.display = 'block';
  document.getElementById('uploadInfo').style.display = 'none';
}

function setProgressBar(percent) {
  document.getElementById('progressBar').style.width = `${percent}%`;
}

function displaySummary() {
  const summaryEl = document.getElementById('docSummary');
  const textEl = document.getElementById('summaryText');
  if (STATE.summary) {
    summaryEl.style.display = 'flex';
    textEl.textContent = STATE.summary;
  } else {
    summaryEl.style.display = 'none';
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
    reader.onerror = () => reject(new Error('erreur lecture pdf'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('erreur lecture fichier'));
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
    if (!response.ok) throw new Error(`http ${response.status}`);
    return await response.json();
  } catch (err) { throw err; }
}

async function getEmbedding(text) {
  try {
    const response = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error(`http ${response.status}`);
    const data = await response.json();
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
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
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

async function loadEmbeddings(startPercent) {
  const wrapper = document.querySelector('.canvas-wrapper');
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  const step = (100 - startPercent) / STATE.concepts.length;

  for (let i = 0; i < STATE.concepts.length; i++) {
    const concept = STATE.concepts[i];
    updateStatus(`liaison sémantique: ${concept.title}`);
    const vector = await getEmbedding(`${concept.title}: ${concept.description}`);
    STATE.embeddings[i] = vector;
    STATE.coordinates[i] = [
      w / 2 + (Math.random() - 0.5) * 40,
      h / 2 + (Math.random() - 0.5) * 40
    ];
    STATE.velocities[i] = [0, 0];
    computeSimilaritiesForNode(i);
    renderNotionsList();
    setProgressBar(startPercent + (i + 1) * step);
  }
}

function cosineSimilarity(v1, v2) {
  let dotProduct = 0, mA = 0, mB = 0;
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
  updatePanning();
  draw();
  requestAnimationFrame(animationLoop);
}

function updatePanning() {
  // Smoothly interpolate offset towards targetOffset
  const lerp = 0.08;
  STATE.offset.x += (STATE.targetOffset.x - STATE.offset.x) * lerp;
  STATE.offset.y += (STATE.targetOffset.y - STATE.offset.y) * lerp;
}

function centerNode(idx) {
  if (!STATE.coordinates[idx]) return;
  const canvas = STATE.canvas;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  
  const [nodeX, nodeY] = STATE.coordinates[idx];
  
  // We want node position + current offset to be (w/2, h/2)
  // targetOffset = center - nodePos
  STATE.targetOffset.x = w / 2 - nodeX;
  STATE.targetOffset.y = h / 2 - nodeY;
}

function updatePhysics() {
  const loadedIndices = Object.keys(STATE.coordinates).map(Number);
  const n = loadedIndices.length;
  if (n === 0) return;
  
  const wrapper = document.querySelector('.canvas-wrapper');
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  
  const k = 110; // Reduced distance for more compact layout
  const forcesX = {};
  const forcesY = {};
  
  loadedIndices.forEach(i => { forcesX[i] = 0; forcesY[i] = 0; });
  
  for (let i = 0; i < n; i++) {
    const idxA = loadedIndices[i];
    for (let j = i + 1; j < n; j++) {
      const idxB = loadedIndices[j];
      const dx = STATE.coordinates[idxB][0] - STATE.coordinates[idxA][0];
      const dy = STATE.coordinates[idxB][1] - STATE.coordinates[idxA][1];
      const dist = Math.hypot(dx, dy) || 1;
      const force = (k * k) / dist; // Reduced repulsion constant logic
      const fx = (dx / dist) * force * 0.12;
      const fy = (dy / dist) * force * 0.12;
      forcesX[idxA] -= fx; forcesY[idxA] -= fy;
      forcesX[idxB] += fx; forcesY[idxB] += fy;
    }
  }
  
  for (let i = 0; i < n; i++) {
    const idxA = loadedIndices[i];
    for (let j = i + 1; j < n; j++) {
      const idxB = loadedIndices[j];
      const sim = STATE.similarities[idxA]?.[idxB] || 0;
      if (sim < 0.5) continue;
      const dx = STATE.coordinates[idxB][0] - STATE.coordinates[idxA][0];
      const dy = STATE.coordinates[idxB][1] - STATE.coordinates[idxA][1];
      const dist = Math.hypot(dx, dy) || 1;
      const targetDist = k * (1.1 - sim); // Tighter spring
      const force = (dist - targetDist) * (sim * 0.2);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forcesX[idxA] += fx; forcesY[idxA] += fy;
      forcesX[idxB] -= fx; forcesY[idxB] -= fy;
    }
  }
  
  const centerGravity = 0.05;
  const maxCenterDist = Math.min(w, h) * 0.4;

  loadedIndices.forEach(idx => {
    const dx = w / 2 - STATE.coordinates[idx][0];
    const dy = h / 2 - STATE.coordinates[idx][1];
    const distFromCenter = Math.hypot(dx, dy);
    
    forcesX[idx] += dx * centerGravity;
    forcesY[idx] += dy * centerGravity;

    if (distFromCenter > maxCenterDist) {
      const pull = (distFromCenter - maxCenterDist) * 0.15;
      forcesX[idx] += (dx / distFromCenter) * pull;
      forcesY[idx] += (dy / distFromCenter) * pull;
    }
  });
  
  const damping = 0.72;
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
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.translate(STATE.offset.x, STATE.offset.y);
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-STATE.offset.x, -STATE.offset.y, w, h);
  drawGrid(ctx, w, h);
  
  const loadedIndices = Object.keys(STATE.coordinates).map(Number);
  if (loadedIndices.length === 0) {
    ctx.restore();
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#86868b';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('déposer un texte pour cartographier le paysage conceptuel', w / 2, h / 2);
    ctx.restore();
    return;
  }
  
  let linkToHover = null;
  const mouseWorldX = STATE.lastMousePos.x - STATE.offset.x;
  const mouseWorldY = STATE.lastMousePos.y - STATE.offset.y;

  for (let i = 0; i < loadedIndices.length; i++) {
    const idxA = loadedIndices[i];
    for (let j = i + 1; j < loadedIndices.length; j++) {
      const idxB = loadedIndices[j];
      const sim = STATE.similarities[idxA]?.[idxB] || 0;
      if (sim > 0.55) {
        const [x1, y1] = STATE.coordinates[idxA];
        const [x2, y2] = STATE.coordinates[idxB];
        const distToLine = getPointToSegmentDistance(mouseWorldX, mouseWorldY, x1, y1, x2, y2);
        const isHovered = distToLine < 5;
        if (isHovered) linkToHover = { idxA, idxB, sim };
        ctx.strokeStyle = isHovered ? 'rgba(29, 29, 31, 0.4)' : 'rgba(0, 0, 0, 0.04)';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
  }
  STATE.hoverLink = linkToHover;

  ctx.strokeStyle = 'rgba(210, 210, 215, 0.4)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < loadedIndices.length - 1; i++) {
    const idxA = loadedIndices[i];
    const idxB = loadedIndices[i + 1];
    const [x1, y1] = STATE.coordinates[idxA];
    const [x2, y2] = STATE.coordinates[idxB];
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  loadedIndices.forEach(idx => {
    const [x, y] = STATE.coordinates[idx];
    const isHover = idx === STATE.hoverIdx;
    const isSelected = idx === STATE.selectedIdx;
    const concept = STATE.concepts[idx];
    const weight = concept.weight || 5;
    const baseRadius = 3 + (weight / 3);
    const radius = isSelected ? baseRadius + 2 : isHover ? baseRadius + 3 : baseRadius;
    ctx.fillStyle = isSelected ? '#1d1d1f' : isHover ? '#424245' : '#d2d2d7';
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    if (isHover || isSelected) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, radius + 4, 0, Math.PI * 2); ctx.stroke();
    }
  });

  ctx.restore();
  updateTooltip();
}

function getPointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = '#f5f5f7';
  ctx.lineWidth = 1;
  const size = 80;
  const startX = Math.floor(-STATE.offset.x / size) * size;
  const startY = Math.floor(-STATE.offset.y / size) * size;
  for (let x = startX; x < startX + w + size; x += size) {
    ctx.beginPath(); ctx.moveTo(x, -STATE.offset.y); ctx.lineTo(x, -STATE.offset.y + h); ctx.stroke();
  }
  for (let y = startY; y < startY + h + size; y += size) {
    ctx.beginPath(); ctx.moveTo(-STATE.offset.x, y); ctx.lineTo(-STATE.offset.x + w, y); ctx.stroke();
  }
}

function resizeCanvas() {
  const wrapper = document.querySelector('.canvas-wrapper');
  if (!STATE.canvas) return;
  const dpr = window.devicePixelRatio || 1;
  STATE.canvas.width = wrapper.clientWidth * dpr;
  STATE.canvas.height = wrapper.clientHeight * dpr;
  STATE.ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ============================================================================
// INTERACTIONS & UI UPDATES
// ============================================================================

function handleMouseDown(e) {
  const rect = STATE.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const mouseWorldX = x - STATE.offset.x;
  const mouseWorldY = y - STATE.offset.y;
  const loadedIndices = Object.keys(STATE.coordinates).map(Number);
  let onNode = false;
  loadedIndices.forEach(idx => {
    const dist = Math.hypot(STATE.coordinates[idx][0] - mouseWorldX, STATE.coordinates[idx][1] - mouseWorldY);
    if (dist < 24) onNode = true;
  });
  if (!onNode) {
    STATE.isDragging = true;
    STATE.lastMousePos = { x, y };
  }
}

function handleMouseMove(e) {
  const rect = STATE.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (STATE.isDragging) {
    STATE.offset.x += x - STATE.lastMousePos.x;
    STATE.offset.y += y - STATE.lastMousePos.y;
    STATE.targetOffset.x = STATE.offset.x;
    STATE.targetOffset.y = STATE.offset.y;
    STATE.lastMousePos = { x, y };
  } else {
    STATE.lastMousePos = { x, y };
    const mouseWorldX = x - STATE.offset.x;
    const mouseWorldY = y - STATE.offset.y;
    const loadedIndices = Object.keys(STATE.coordinates).map(Number);
    let nearestIdx = -1, minDist = 24;  
    loadedIndices.forEach(idx => {
      const dist = Math.hypot(STATE.coordinates[idx][0] - mouseWorldX, STATE.coordinates[idx][1] - mouseWorldY);
      if (dist < minDist) { minDist = dist; nearestIdx = idx; }
    });
    STATE.hoverIdx = nearestIdx;
  }
}

function handleMouseUp() {
  STATE.isDragging = false;
}

function updateTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (STATE.hoverIdx >= 0) {
    const concept = STATE.concepts[STATE.hoverIdx];
    tooltip.innerHTML = `<h3>${concept.title}</h3><p>${concept.description}</p>${concept.context ? `<div class="context">« ${concept.context} »</div>` : ''}`;
    tooltip.style.left = (STATE.lastMousePos.x + 16) + 'px';
    tooltip.style.top = (STATE.lastMousePos.y + 16) + 'px';
    tooltip.classList.add('visible');
  } else if (STATE.hoverLink) {
    const conceptA = STATE.concepts[STATE.hoverLink.idxA];
    const conceptB = STATE.concepts[STATE.hoverLink.idxB];
    tooltip.innerHTML = `<h3>relation sémantique</h3><p>proximité sémantique entre <strong>${conceptA.title}</strong> et <strong>${conceptB.title}</strong>: ${Math.round(STATE.hoverLink.sim * 100)}%</p>`;
    tooltip.style.left = (STATE.lastMousePos.x + 16) + 'px';
    tooltip.style.top = (STATE.lastMousePos.y + 16) + 'px';
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
      centerNode(STATE.selectedIdx);
      const activeEl = document.querySelector(`.notion-item[data-idx="${STATE.selectedIdx}"]`);
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function updateStatus(message) {
  document.getElementById('statusIndicator').textContent = message;
}

function renderNotionsList() {
  const list = document.getElementById('notionsList');
  const container = document.getElementById('notionsContainer');
  if (STATE.concepts.length === 0) { list.style.display = 'none'; return; }
  list.style.display = 'flex';
  container.innerHTML = STATE.concepts.map((concept, idx) => {
    const isLoaded = STATE.embeddings[idx] !== undefined;
    const isSelected = idx === STATE.selectedIdx;
    if (!isLoaded) return `<div class="notion-item loading" data-idx="${idx}">${concept.title} (calcul...)</div>`;
    return `
      <div class="notion-item ${isSelected ? 'active' : ''}" data-idx="${idx}">
        <div class="notion-header">
          ${concept.title}
          <span class="notion-weight">${concept.weight}/10</span>
        </div>
        <div class="notion-details">
          <p>${concept.description}</p>
          <div class="citation-block">« ${concept.context} »</div>
        </div>
      </div>
    `;
  }).join('');
  container.querySelectorAll('.notion-item:not(.loading)').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.dataset.idx);
      STATE.selectedIdx = STATE.selectedIdx === idx ? -1 : idx;
      renderNotionsList();
      if (STATE.selectedIdx >= 0) centerNode(STATE.selectedIdx);
    });
  });
}
