'use strict';

const SOURCE_URL = 'https://gist.githubusercontent.com/visnup/28034a969b425c38d4f5b9837503865c/raw/b9cc8bb20ab78a4556aeef3c22eb31ff90c21e8a/philosophers.json';
const CATS = { on:'ontology/metaphysics', ep:'epistemology', et:'ethics', po:'politics', ae:'aesthetics', th:'theology/religion' };
const THREADS = [
  ['time','Time / Change',['time','change','flux','becoming','eternal'],'From cosmology to lived duration: time moves from world-structure to subject-structure.'],
  ['knowledge','Limits of Knowledge',['knowledge','truth','certainty','experience','perception','science','logic','doubt'],'Philosophy repeatedly defines knowledge by discovering what it cannot secure.'],
  ['art','Art / Representation',['art','aesthetics','beauty','poetry','tragedy','representation','history'],'Art shifts from imitation to disclosure, affect, critique, and simulation.'],
  ['power','Power / Society / State',['power','government','society','law','state','politics','rights'],'Political order moves through fear, legitimacy, rights, discourse, discipline, and justice.'],
  ['language','Language / Meaning',['language','words','speech','meaning','sign','reference'],'Meaning moves from representation to use, structure, reference, and performative force.'],
  ['gender','Gender / Sex / Identity',['gender','women','woman','female','male','body','identity'],'Gender appears first as nature, then as inequality, construction, discourse, and performativity.']
];

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uniq = xs => [...new Set(xs.filter(Boolean))];
const count = xs => Object.entries(xs.reduce((a,x)=>(x&&(a[x]=(a[x]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));

let DATA = null;
let state = { view:'atlas', q:'', concept:null, problem:null, person:null, statement:null, compare:[], thread:'time' };

boot();

async function boot(){
  wireStaticEvents();
  showBoot('Loading data…');
  try {
    let raw = null;
    try {
      const local = await fetch('philosophers-data.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null);
      if (local && local.people && local.records && local.links) raw = local;
      if (!raw && local && local.sourceUrl) raw = await fetch(local.sourceUrl, {cache:'force-cache'}).then(r => r.json());
    } catch (_) {}
    if (!raw) raw = await fetch(SOURCE_URL, {cache:'force-cache'}).then(r => r.json());
    loadRawJSON(raw, 'Deniz C. O. philosophers JSON');
  } catch (err) {
    showUploadOnly('Could not auto-load data. Upload the original JSON or enriched TXT.', err);
  }
}

function wireStaticEvents(){
  $('#q').addEventListener('input', e => { state.q = e.target.value; render(); });
  $('#theme').onclick = () => { const app = $('#app'); app.dataset.theme = app.dataset.theme === 'dark' ? 'light' : 'dark'; };
  $('#reset').onclick = reset;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const a = el.dataset.a, v = el.dataset.v;
    if (a === 'view') { state.view = v; render(); }
    if (a === 'concept') { state.concept = v; state.problem = null; state.person = null; state.view = 'concepts'; render(); }
    if (a === 'problem') { state.problem = v; state.concept = null; state.person = null; state.view = 'problems'; render(); }
    if (a === 'person') { state.person = Number(v); state.view = 'thinkers'; render(); inspectPerson(Number(v)); }
    if (a === 'statement') { state.statement = Number(v); inspectStatement(Number(v)); if (state.view === 'graph' || state.view === 'atlas') drawGraph(); }
    if (a === 'compare') { addCompare(Number(v)); }
    if (a === 'thread') { state.thread = v; state.view = 'threads'; render(); }
    if (a === 'clearCompare') { state.compare = []; render(); }
  });
}

function reset(){ state = {...state, q:'', concept:null, problem:null, person:null, statement:null}; $('#q').value=''; render(); inspectHome(); }
function showBoot(msg){ $('#content').innerHTML = `<div class="card"><h3>${esc(msg)}</h3><p>If this remains visible, use the upload control in the inspector.</p></div>`; $('#inspector').innerHTML = uploadBox(); attachUpload(); }
function showUploadOnly(msg, err){ $('#content').innerHTML = `<div class="card"><h3>${esc(msg)}</h3><p>${esc(err?.message || '')}</p>${uploadBox()}</div>`; $('#inspector').innerHTML = uploadBox(); attachUpload(); }

function loadRawJSON(raw, title='uploaded JSON'){
  if (!raw || !Array.isArray(raw.people) || !Array.isArray(raw.records)) throw new Error('Invalid philosopher JSON.');
  const people = raw.people.map(p => ({
    id:p.id, name:p.name || `Person ${p.id}`, time:p.time || '', loc:p.loc || '', sortby:p.sortby || p.name || '',
    year: yearFromTime(p.time), movement: movementFor(p)
  }));
  const peopleById = Object.fromEntries(people.map(p => [p.id, p]));
  const statements = raw.records.map(r => {
    const p = peopleById[r.person] || {id:r.person,name:`Person ${r.person}`,time:'',movement:'unknown'};
    const categories = (r.cats || []).map(c => CATS[c] || c.replaceAll('_','/'));
    const tags = inferTags(r.line || '', categories);
    return {
      id:r.id, personId:r.person, person:p.name, time:p.time, year:p.year, text:r.line || '', order:r.order || '', reference:r.reference || '',
      categories, tags, allTags:uniq([...categories, ...tags]), problems:inferProblems(r.line || '', categories, tags), movement:p.movement,
      gloss:glossFor(r.line || '', categories, tags)
    };
  });
  const statementsById = Object.fromEntries(statements.map(s => [s.id, s]));
  const relations = (raw.links || []).filter(l => statementsById[l.l0] && statementsById[l.l1]).map((l,i) => ({
    id:i, source:l.l0, target:l.l1, type:l.type === 'p' ? 'support' : 'oppose'
  }));
  setData({title, people, statements, relations});
}

function setData(d){
  d.peopleById = Object.fromEntries(d.people.map(p => [p.id, p]));
  d.statementsById = Object.fromEntries(d.statements.map(s => [s.id, s]));
  d.relations = d.relations.filter(r => d.statementsById[r.source] && d.statementsById[r.target]);
  d.out = {}; d.in = {};
  d.relations.forEach(r => { (d.out[r.source] ||= []).push(r); (d.in[r.target] ||= []).push(r); });
  d.concepts = count(d.statements.flatMap(s => s.allTags || [])).map(([name, n]) => ({name, count:n}));
  d.problems = count(d.statements.flatMap(s => s.problems || [])).map(([name, n]) => ({name, count:n}));
  d.threads = THREADS.map(([id,title,keys,thesis]) => ({ id, title, thesis, statementIds: d.statements.filter(s => keys.some(k => hay(s).includes(k))).map(s => s.id).slice(0,120) }));
  DATA = d;
  render(); inspectHome();
}

function yearFromTime(t=''){
  const m = String(t).match(/\d+/); if (!m) return null;
  let y = Number(m[0]); if (String(t).includes('BC')) y = -y; return y;
}
function movementFor(p){
  const n = p.name, y = yearFromTime(p.time);
  if (['Thales','Anaximander','Anaximenes'].includes(n)) return 'presocratic/cosmology';
  if (n === 'Pythagoras') return 'pythagorean/number/metaphysics';
  if (n === 'Xenophanes') return 'presocratic/fallibilism/theology';
  if (n === 'Heraclitus') return 'presocratic/becoming';
  if (['Parmenides','Zeno of Elea'].includes(n)) return 'eleatic/being/paradox';
  if (['Leucippus & Democritus','Epicurus'].includes(n)) return 'atomism/materialism';
  if (n === 'Socrates') return 'socratic/ethics'; if (n === 'Plato') return 'platonic/forms'; if (n === 'Aristotle') return 'aristotelian/worldliness';
  if (['Saint Augustine','John Scotus Erigena','Saint Anselm','Thomas Aquinas','William of Ockham'].includes(n)) return 'medieval/reason/faith';
  if (y < 0) return 'ancient/ethics/metaphysics'; if (y < 1700) return 'early/modern/rationalism/empiricism'; if (y < 1800) return 'enlightenment/reason/politics'; if (y < 1870) return 'nineteenth/century/history/critique'; if (y < 1930) return 'modern/language/science/phenomenology'; return 'contemporary/analytic/continental';
}
function inferTags(line, cats=[]){
  const l = line.toLowerCase(); const tags=[];
  const vocab = ['reality','nature','matter','space','time','change','knowledge','truth','logic','reason','experience','perception','science','mind','body','soul','self','language','meaning','art','beauty','history','religion','god','morality','justice','society','government','power','law','freedom','death','desire','gender','women','woman','female','male','money','math','causality','machine'];
  vocab.forEach(v => { if (l.includes(v)) tags.push(v === 'women' || v === 'woman' || v === 'female' || v === 'male' ? 'gender' : v); });
  if (cats.includes('aesthetics')) tags.push('art');
  if (cats.includes('politics')) tags.push('society');
  if (cats.includes('theology/religion')) tags.push('religion');
  return uniq(tags);
}
function inferProblems(line, cats, tags){
  const t = new Set(tags), c = new Set(cats), l = line.toLowerCase(), p=[]; const add=x=>!p.includes(x)&&p.push(x);
  if (c.has('ontology/metaphysics') || ['reality','existence','nature','matter','space','mind','body','soul','self','causality'].some(x=>t.has(x))) add('What exists?');
  if (c.has('epistemology') || ['knowledge','truth','logic','perception','experience','science','reason','language'].some(x=>t.has(x))) add('How can we know?');
  if (c.has('ethics') || ['morality','justice','death','desire','freedom'].some(x=>t.has(x))) add('How should one live?');
  if (c.has('politics') || ['society','government','power','law'].some(x=>t.has(x))) add('How should society be governed?');
  if (c.has('aesthetics') || ['art','beauty','history'].some(x=>t.has(x))) add('What does art do?');
  if (c.has('theology/religion') || ['religion','god','soul'].some(x=>t.has(x))) add('What is God?');
  if (t.has('time') || t.has('change') || /flux|becoming|eternal/.test(l)) add('What is time?');
  if (t.has('language') || t.has('meaning') || /words|speech|sign/.test(l)) add('What does language mean?');
  if (t.has('science') || /scientific|experiment|prediction/.test(l)) add('What is science?');
  if (t.has('gender')) add('What is gender?');
  if (t.has('freedom') || /free will|liberty/.test(l)) add('What is freedom?');
  return p.length ? p.slice(0,5) : ['What is philosophy asking here?'];
}
function glossFor(line, cats, tags){
  const l = line.toLowerCase(), t = new Set(tags);
  const rules = [
    [['time','change','flux','becoming'],'reality read through time'], [['art','beauty','poetry','tragedy'],'representation tests reality'], [['language','meaning','words','speech'],'meaning mediated by signs'], [['science','experiment','prediction'],'knowledge disciplined by method'], [['gender','women','female','male'],'identity treated as structure'], [['government','state','power','society'],'order explained through power'], [['god','religion','faith','soul'],'divinity anchors the system'], [['reason','logic','math'],'reason seeks secure form'], [['experience','senses','perception'],'knowledge begins at its limit'], [['death','mortality'],'death reframes value'], [['freedom','liberty'],'freedom contested by necessity'], [['truth','certainty','doubt'],'truth tested by doubt'], [['nature','matter','atoms','machine'],'nature becomes explanatory ground']
  ];
  for (const [ks,g] of rules) if (ks.some(k => l.includes(k) || t.has(k))) return g;
  if (cats.includes('ethics')) return 'thought becomes a rule of life'; if (cats.includes('epistemology')) return 'knowledge defined by its conditions'; if (cats.includes('ontology/metaphysics')) return 'being reduced to first principles'; return 'claim positioned in the map';
}
function hay(s){ return [s.text,s.person,s.movement,s.gloss,...(s.allTags||[]),...(s.problems||[])].join(' ').toLowerCase(); }

function render(){
  if (!DATA) return;
  renderShell();
  const titles = {atlas:'Atlas',thinkers:'Thinkers',concepts:'Concept Lab',problems:'Problem Lab',graph:'Relation Graph',tensions:'Tensions',threads:'Threads',compare:'Compare'};
  $('#viewTitle').textContent = titles[state.view] || 'Atlas';
  const fs = filtered();
  $('#sub').textContent = `${fs.length} visible claims · ${DATA.people.length} thinkers · ${DATA.relations.length} links` + (state.concept ? ` · #${state.concept}` : '') + (state.problem ? ` · ${state.problem}` : '');
  const views = {atlas, thinkers, concepts, problems, graph, tensions, threads, compare};
  $('#content').innerHTML = (views[state.view] || atlas)();
  if (state.view === 'atlas' || state.view === 'graph') drawGraph();
  attachUpload();
}
function renderShell(){
  $('#stats').innerHTML = `<div class="stat"><b>${DATA.people.length}</b><span>thinkers</span></div><div class="stat"><b>${DATA.statements.length}</b><span>claims</span></div><div class="stat"><b>${DATA.relations.length}</b><span>links</span></div>`;
  const vs = [['atlas','Atlas'],['thinkers','Thinkers'],['concepts','Concept Lab'],['problems','Problem Lab'],['graph','Graph'],['tensions','Tensions'],['threads','Threads'],['compare','Compare']];
  $('#nav').innerHTML = vs.map(([id,t]) => `<button class="${state.view===id?'active':''}" data-a="view" data-v="${id}">${t}</button>`).join('');
  $('#concepts').innerHTML = DATA.concepts.slice(0,38).map(c => `<button class="pill" data-a="concept" data-v="${esc(c.name)}">#${esc(c.name)} <small>${c.count}</small></button>`).join('');
  $('#problems').innerHTML = DATA.problems.slice(0,22).map(p => `<button class="pill" data-a="problem" data-v="${esc(p.name)}">${esc(p.name)} <small>${p.count}</small></button>`).join('');
}
function filtered(){
  const q = state.q.trim().toLowerCase();
  return DATA.statements.filter(s => {
    if (state.person != null && s.personId !== state.person) return false;
    if (state.concept && !s.allTags.includes(state.concept)) return false;
    if (state.problem && !s.problems.includes(state.problem)) return false;
    return !q || hay(s).includes(q);
  });
}
function atlas(){
  const fs = filtered(), topConcepts = count(fs.flatMap(s => s.allTags)).slice(0,18).map(([name,count])=>({name,count})), topProblems = count(fs.flatMap(s => s.problems)).slice(0,12).map(([name,count])=>({name,count}));
  return `<div class="grid dash"><div class="card wide"><h3>Chronological relation atlas</h3><p>Nodes are statements; horizontal position follows thinker chronology; vertical position follows dominant field. Blue links support; red links oppose.</p><div class="graph"><svg id="svg"></svg></div></div><div class="card"><h3>Concept intensity</h3><div class="heat">${heat(topConcepts,'concept')}</div></div><div class="card"><h3>Problem pressure</h3><div class="heat">${heat(topProblems,'problem')}</div></div><div class="card wide"><h3>Filtered claims</h3><div class="grid cards">${fs.slice(0,48).map(claim).join('')}</div></div></div>`;
}
function heat(items, type){ const m = Math.max(1,...items.map(x=>x.count)); return items.map(x => `<button data-a="${type}" data-v="${esc(x.name)}"><b>${type==='concept'?'#':''}${esc(x.name)}</b><p style="margin:3px 0 0">${x.count} claims</p><div class="bar"><i style="width:${Math.round(100*x.count/m)}%"></i></div></button>`).join(''); }
function claim(s){
  const rels = [...(DATA.out[s.id]||[]), ...(DATA.in[s.id]||[])].slice(0,4);
  return `<article class="claim" data-a="statement" data-v="${s.id}"><div class="who"><span>${esc(s.person)} · ${esc(s.time)}</span><span>${esc(s.movement)}</span></div><div class="text">${esc(s.text)}</div><div class="meta">${s.problems.slice(0,3).map(p=>`<span class="tag problem">${esc(p)}</span>`).join('')}${s.allTags.slice(0,8).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div><p>${esc(s.gloss)}</p>${rels.map(r=>relLine(r,s.id)).join('')}</article>`;
}
function relLine(r, id){ const oid = r.source === id ? r.target : r.source, o = DATA.statementsById[oid]; return `<div class="rel ${r.type}" data-a="statement" data-v="${oid}"><b>${r.type==='support'?'+':'−'}</b><span>${esc(o.person)} (${esc(o.text)})</span></div>`; }
function thinkers(){
  const people = DATA.people.filter(p => state.person == null || p.id === state.person).filter(p => !state.q || `${p.name} ${p.movement}`.toLowerCase().includes(state.q.toLowerCase()));
  return `<div class="grid cards">${people.map(personCard).join('')}</div>`;
}
function personCard(p){
  const st = DATA.statements.filter(s => s.personId === p.id), tags = count(st.flatMap(s=>s.allTags)).slice(0,8), out = DATA.relations.filter(r=>DATA.statementsById[r.source].personId===p.id), inn = DATA.relations.filter(r=>DATA.statementsById[r.target].personId===p.id);
  return `<div class="card"><h3 data-a="person" data-v="${p.id}">${esc(p.name)}</h3><p>${esc(p.time)} · ${esc(p.movement)}</p><div class="meta">${tags.map(([t,c])=>`<span class="tag">#${esc(t)} ${c}</span>`).join('')}</div><p>${st.length} claims · ${out.length} outgoing · ${inn.length} incoming</p><button class="mini" data-a="compare" data-v="${p.id}">Compare</button>${st.slice(0,5).map(s=>`<div class="tiny" data-a="statement" data-v="${s.id}">${esc(s.text)}</div>`).join('')}</div>`;
}
function concepts(){ const c = state.concept || DATA.concepts[0]?.name, st = DATA.statements.filter(s => s.allTags.includes(c)), probs = count(st.flatMap(s=>s.problems)).slice(0,12).map(([name,count])=>({name,count})); return `<div class="grid dash"><div class="card"><h3>#${esc(c)}</h3><p>${st.length} claims. This lens shows the thinkers and questions gathered by one recurring idea.</p><div class="heat">${heat(probs,'problem')}</div></div><div class="card"><h3>Thinkers</h3><div class="heat">${heat(count(st.map(s=>s.person)).slice(0,16).map(([name,count])=>({name,count})),'noop')}</div></div><div class="card wide"><div class="grid cards">${st.slice(0,90).map(claim).join('')}</div></div></div>`; }
function problems(){ const p = state.problem || DATA.problems[0]?.name, st = DATA.statements.filter(s => s.problems.includes(p)), cons = count(st.flatMap(s=>s.allTags)).slice(0,18).map(([name,count])=>({name,count})); return `<div class="grid dash"><div class="card"><h3>${esc(p)}</h3><p>${st.length} claims. Problems are interpretive questions, not mere labels.</p><div class="heat">${heat(cons,'concept')}</div></div><div class="card"><h3>Thinkers</h3><div class="heat">${heat(count(st.map(s=>s.person)).slice(0,18).map(([name,count])=>({name,count})),'noop')}</div></div><div class="card wide"><div class="grid cards">${st.slice(0,90).map(claim).join('')}</div></div></div>`; }
function graph(){ return `<div class="card"><h3>Relation constellation</h3><p>Filter first, then use this graph to inspect support/opposition neighborhoods.</p><div class="graph"><svg id="svg"></svg></div></div>`; }
function tensions(){ const rs = DATA.relations.filter(r=>r.type==='oppose').filter(r=>!state.q || hay(DATA.statementsById[r.source]).includes(state.q.toLowerCase()) || hay(DATA.statementsById[r.target]).includes(state.q.toLowerCase())).slice(0,100); return `<div class="grid cards">${rs.map(r=>{const a=DATA.statementsById[r.source], b=DATA.statementsById[r.target]; return `<div class="card"><h3>${esc(a.person)} ↔ ${esc(b.person)}</h3><div class="rel oppose" data-a="statement" data-v="${a.id}"><b>A</b><span>${esc(a.text)}</span></div><div class="rel oppose" data-a="statement" data-v="${b.id}"><b>B</b><span>${esc(b.text)}</span></div></div>`}).join('')}</div>`; }
function threads(){ const t = DATA.threads.find(x=>x.id===state.thread) || DATA.threads[0], st = t.statementIds.map(id=>DATA.statementsById[id]).filter(Boolean), groups = Object.values(st.reduce((a,s)=>((a[s.person] ||= []).push(s),a),{})); return `<div class="grid"><div class="card"><h3>${esc(t.title)}</h3><p>${esc(t.thesis)}</p><div class="chips">${DATA.threads.map(x=>`<button class="pill" data-a="thread" data-v="${x.id}">${esc(x.title)} <small>${x.statementIds.length}</small></button>`).join('')}</div></div><div class="route">${groups.slice(0,34).map(g=>`<div class="step"><h3>${esc(g[0].person)}</h3>${g.slice(0,3).map(s=>`<div class="tiny" data-a="statement" data-v="${s.id}">${esc(s.text)}</div>`).join('')}</div>`).join('')}</div><div class="grid cards">${st.slice(0,90).map(claim).join('')}</div></div>`; }
function addCompare(id){ if (!state.compare.includes(id)) state.compare.push(id); state.compare = state.compare.slice(-4); state.view = 'compare'; render(); }
function compare(){ const people = state.compare.length ? state.compare.map(id=>DATA.peopleById[id]).filter(Boolean) : DATA.people.slice(0,3); return `<div class="grid"><div class="card"><h3>Compare workspace</h3><p>Add thinkers from any card. Compare concepts, problems, postulates, and relation vectors.</p><button class="mini" data-a="clearCompare">Clear</button></div><div class="cols">${people.map(p=>{const st=DATA.statements.filter(s=>s.personId===p.id), tags=count(st.flatMap(s=>s.allTags)).slice(0,10), probs=count(st.flatMap(s=>s.problems)).slice(0,6); return `<div class="col"><h3>${esc(p.name)}</h3><p>${esc(p.time)} · ${esc(p.movement)}</p><div class="meta">${tags.map(([t,c])=>`<span class="tag">#${esc(t)} ${c}</span>`).join('')}</div><div class="meta">${probs.map(([t,c])=>`<span class="tag problem">${esc(t)} ${c}</span>`).join('')}</div>${st.slice(0,8).map(s=>`<div class="tiny" data-a="statement" data-v="${s.id}">${esc(s.text)}</div>`).join('')}</div>`}).join('')}</div></div>`; }
function drawGraph(){
  const svg = $('#svg'); if (!svg) return; const fs = filtered().slice(0,175), ids = new Set(fs.map(s=>s.id)), rels = DATA.relations.filter(r=>ids.has(r.source)&&ids.has(r.target)).slice(0,300), w = svg.clientWidth || 900, h = svg.clientHeight || 500;
  const years = DATA.people.map(p=>p.year).filter(x=>x!=null), min = Math.min(...years,-600), max = Math.max(...years,2020), span = max-min || 1, band = {'ontology/metaphysics':.18,epistemology:.33,ethics:.49,politics:.65,aesthetics:.79,'theology/religion':.9}, pos = {};
  fs.forEach((s,i)=>{ const p=DATA.peopleById[s.personId], x=35+(((p.year??0)-min)/span)*(w-70), y=(band[s.categories[0]]||.52)*h+((i%7)-3)*7; pos[s.id]=[Math.max(24,Math.min(w-24,x)),Math.max(22,Math.min(h-22,y))]; });
  const edges = rels.map(r=>{const a=pos[r.source],b=pos[r.target];return a&&b?`<line class="edge ${r.type}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${r.type==='oppose'?1.7:1.2}"/>`:''}).join('');
  const nodes = fs.map(s=>{const [x,y]=pos[s.id], fill=s.categories.includes('politics')?'var(--red)':s.categories.includes('epistemology')?'var(--blue)':s.categories.includes('ethics')?'var(--green)':'var(--ink)'; return `<g class="node" data-a="statement" data-v="${s.id}"><circle cx="${x}" cy="${y}" r="${state.statement===s.id?7:4.7}" fill="${fill}"><title>${esc(s.person)}: ${esc(s.text)}</title></circle></g>`}).join('');
  const labels = uniq(fs.map(s=>s.personId)).slice(0,70).map(id=>{const s=fs.find(x=>x.personId===id), [x,y]=pos[s.id]; return `<text class="svglabel" x="${x+7}" y="${y-7}">${esc(s.person)}</text>`}).join('');
  svg.innerHTML = edges + nodes + labels;
}
function inspectHome(){ $('#inspector').innerHTML = `<div class="title">Ready.</div><p>The atlas loaded. Click any claim, philosopher, chip, graph node, or relation.</p>${uploadBox()}`; attachUpload(); }
function inspectPerson(id){ const p = DATA.peopleById[id], st = DATA.statements.filter(s=>s.personId===id); $('#inspector').innerHTML = `<div class="title">${esc(p.name)}</div><p>${esc(p.time)} · ${esc(p.movement)}</p><p>${st.length} claims</p><button class="mini" data-a="compare" data-v="${id}">Add to compare</button>${uploadBox()}`; attachUpload(); }
function inspectStatement(id){ const s = DATA.statementsById[id]; if (!s) return; const links = [...(DATA.out[id]||[]), ...(DATA.in[id]||[])]; $('#inspector').innerHTML = `<div class="title">${esc(s.person)}</div><p>${esc(s.text)}</p><div class="meta">${s.problems.map(p=>`<span class="tag problem">${esc(p)}</span>`).join('')}${s.allTags.map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div><p>${esc(s.gloss)} · ${esc(s.movement)}</p><button class="mini" data-a="compare" data-v="${s.personId}">Add ${esc(s.person)} to compare</button><h3>Local relations</h3>${links.map(r=>relLine(r,id)).join('') || '<p>No direct links.</p>'}${uploadBox()}`; attachUpload(); }
function uploadBox(){ return `<div class="drop"><b>Upload data</b><p>Supports original JSON, enriched TXT, grouped TXT.</p><input type="file" id="fileInput" accept=".json,.txt,text/plain,application/json"></div>`; }
function attachUpload(){ const input = $('#fileInput'); if (!input) return; input.onchange = async e => { const f = e.target.files[0]; if (!f) return; const text = await f.text(); try { if (f.name.endsWith('.json') || text.trim().startsWith('{')) loadRawJSON(JSON.parse(text), f.name); else setData(parseTxt(text, f.name)); } catch(err) { alert('Could not parse file: ' + err.message); } }; }
function parseTxt(text, title){
  const people=[], statements=[], relations=[]; let current=null, last=null, pid=0, sid=0;
  const getP=(name,time='')=>{let p=people.find(x=>x.name===name); if(!p){p={id:pid++,name,time,loc:'',sortby:name,year:null,movement:'uploaded/txt'};people.push(p)} return p};
  for (const raw of text.split(/\r?\n/)){
    const line = raw.trimEnd(); if(!line || line.startsWith('#')) continue;
    const h = line.match(/^(.+?) - \[(.*?)\]$/); if(h){current=getP(h[1].trim(),h[2].trim()); continue;}
    if (/^- /.test(line) && !/^\s+-/.test(line)){
      if(!current) current=getP('Uploaded'); const body=line.slice(2), clean=body.split(/\s+#|\s+\(/)[0].trim();
      const tags=[...body.matchAll(/#([A-Za-z0-9_/-]+)/g)].map(m=>m[1].replaceAll('_','/'));
      const cats=tags.filter(t=>Object.values(CATS).includes(t)), extra=tags.filter(t=>!cats.includes(t));
      const probs=[...body.matchAll(/\(([^)]*\?[^)]*)\)/g)].flatMap(m=>m[1].split('·').map(x=>x.trim()));
      last={id:sid++,personId:current.id,person:current.name,time:current.time,year:null,text:clean,categories:cats,tags:extra,allTags:uniq([...cats,...extra]),problems:probs.length?probs:inferProblems(clean,cats,extra),movement:(body.match(/@([A-Za-z0-9_/-]+)/)||[])[1]||'uploaded/txt',gloss:(body.match(/\/\/\s*(.+)$/)||[])[1]||glossFor(clean,cats,extra)}; statements.push(last); continue;
    }
    if(last && /^\s+- \(/.test(line)){ const m=line.match(/\(([^)]*\?[^)]*)\)(?:\s*\/\/\s*(.+))?/); if(m){last.problems=m[1].split('·').map(x=>x.trim()); if(m[2]) last.gloss=m[2].trim();}}
    if(last && /^\s+- #/.test(line)){ const tags=[...line.matchAll(/#([A-Za-z0-9_/-]+)/g)].map(m=>m[1].replaceAll('_','/')); last.categories=tags.filter(t=>Object.values(CATS).includes(t)); last.tags=tags.filter(t=>!last.categories.includes(t)); last.allTags=uniq([...last.categories,...last.tags]); const mv=(line.match(/@([A-Za-z0-9_/-]+)/)||[])[1]; if(mv) last.movement=mv;}
    const r=line.match(/^\s+-\s*(?:\[([+-])\]|([+-]))\s*(.+?)(?::|\()\s*(.+?)\)?\.?\s*$/); if(last&&r){const sign=r[1]||r[2], person=r[3].trim(), txt=r[4].trim(); const target=statements.find(s=>s.person===person&&s.text.startsWith(txt.slice(0,35))); if(target) relations.push({id:relations.length,source:last.id,target:target.id,type:sign==='+'?'support':'oppose'});}
  }
  return {title,people,statements,relations};
}
