'use strict';

const DATA_URLS = ['philosophers.json', '/philosophers.json', 'https://gist.githubusercontent.com/visnup/28034a969b425c38d4f5b9837503865c/raw/b9cc8bb20ab78a4556aeef3c22eb31ff90c21e8a/philosophers.json'];
const CAT = { on:'ontology/metaphysics', ep:'epistemology', et:'ethics', po:'politics', ae:'aesthetics', th:'theology/religion' };
const CAT_ORDER = ['ontology/metaphysics','epistemology','ethics','politics','aesthetics','theology/religion'];
const ROUTES = [
  {id:'time', title:'TIME / CHANGE', keys:['time','change','becoming','flux','eternal','duration','present','space'], thesis:'Time begins as a cosmological problem, becomes a metaphysical wound, then becomes a condition of experience and historical existence.'},
  {id:'limits', title:'LIMITS OF KNOWLEDGE', keys:['knowledge','truth','certainty','doubt','experience','perception','logic','science','fallible','senses'], thesis:'The history of knowledge is a sequence of limits: sense, proof, language, history, power, embodiment.'},
  {id:'art', title:'ART / REPRESENTATION', keys:['art','aesthetics','beauty','poetry','tragedy','representation','history','image','illusion'], thesis:'Art moves from imitation to catharsis, disclosure, critique, construction, simulation, and the exposure of representation itself.'},
  {id:'language', title:'LANGUAGE / MEANING', keys:['language','words','speech','writing','meaning','sign','reference','symbol','discourse'], thesis:'Meaning shifts from symbolizing mental experience to functioning inside systems, uses, discourses, and power relations.'},
  {id:'power', title:'POWER / STATE / SOCIETY', keys:['power','government','state','law','society','rights','freedom','public','justice','authority'], thesis:'Political philosophy moves from order and sovereignty to rights, liberty, ideology, discipline, justice, and productive power.'},
  {id:'gender', title:'GENDER / SEX / IDENTITY', keys:['gender','women','woman','female','male','body','sex','identity','feminist'], thesis:'Gender is first naturalized as hierarchy, then contested as education, equality, embodiment, discourse, and performative construction.'},
  {id:'god', title:'GOD / RELIGION / SECULARIZATION', keys:['god','religion','faith','soul','evil','divine','theology'], thesis:'God functions as cause, guarantee, order, moral ground, projection, problem, and finally critique of philosophical systems.'},
  {id:'mind', title:'MIND / BODY / SELF', keys:['mind','body','soul','self','consciousness','experience','subject','psychology'], thesis:'The self moves from soul to subject, bundle, will, unconscious, embodiment, language, computation, and consciousness.'}
];

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uniq = xs => [...new Set(xs.filter(Boolean))];
const byCount = xs => Object.entries(xs.reduce((a,x)=>(x&&(a[x]=(a[x]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

let DB = null;
let S = {
  view:'atlas', q:'', concept:null, problem:null, route:'time', person:null, statement:null,
  indexType:'concept', indexKey:null, compare:[], relation:'all', sort:'chrono'
};

boot();

async function boot(){
  wire();
  message('Loading local philosophers.json…');
  try {
    const raw = await loadFirstJSON(DATA_URLS);
    setDB(buildDB(raw));
  } catch (err) {
    message('Auto-load failed. Upload philosophers.json or compatible .txt.', err.message);
    renderInspectorUpload();
  }
}

async function loadFirstJSON(urls){
  let last = null;
  for (const u of urls) {
    try { const r = await fetch(u, {cache:'no-store'}); if (!r.ok) throw new Error(r.status + ' ' + u); return await r.json(); }
    catch(e){ last = e; }
  }
  throw last || new Error('No JSON source loaded.');
}

function wire(){
  $('#q').addEventListener('input', e => { S.q = e.target.value.trim(); render(); });
  $('#theme').onclick = () => { const app=$('#app'); app.dataset.theme = app.dataset.theme === 'dark' ? 'light' : 'dark'; };
  $('#density').onclick = () => { $('#app').classList.toggle('densityCompact'); };
  $('#reset').onclick = () => { S = {...S, q:'', concept:null, problem:null, person:null, statement:null, indexKey:null, relation:'all'}; $('#q').value=''; render(); };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || !DB) return;
    const act = el.dataset.act, val = el.dataset.val, kind = el.dataset.kind;
    if (act === 'view') { S.view = val; if (kind) S.indexType = kind; render(); }
    if (act === 'filter') { if (kind === 'concept') S.concept = val; if (kind === 'problem') S.problem = val; S.person = null; S.view = kind === 'problem' || kind === 'concept' ? 'index' : S.view; S.indexType = kind || S.indexType; S.indexKey = val; render(); }
    if (act === 'clear') { S[val] = null; if (val === 'q') {S.q=''; $('#q').value='';} render(); }
    if (act === 'person') { S.person = Number(val); S.view = 'thinkers'; render(); inspectPerson(Number(val)); }
    if (act === 'statement') { S.statement = Number(val); inspectStatement(Number(val)); if (S.view === 'atlas' || S.view === 'graph') requestAnimationFrame(drawGraph); }
    if (act === 'index') { S.indexType = kind; S.indexKey = val; if (kind === 'concept') S.concept = val; if (kind === 'problem') S.problem = val; S.view = 'index'; render(); }
    if (act === 'route') { S.route = val; S.view = 'routes'; render(); }
    if (act === 'compare') { addCompare(Number(val)); }
    if (act === 'dropCompare') { S.compare = S.compare.filter(x => x !== Number(val)); render(); }
    if (act === 'relation') { S.relation = val; render(); }
  });
}

function message(title, detail=''){
  $('#content').innerHTML = `<div class="empty"><b>${esc(title)}</b>${detail ? `<p>${esc(detail)}</p>` : ''}</div>`;
  $('#inspector').innerHTML = uploadBox(); attachUpload();
}

function buildDB(raw){
  if (!raw || !Array.isArray(raw.people) || !Array.isArray(raw.records)) throw new Error('Invalid JSON shape.');
  const people = raw.people.map(p => ({...p, year:yearOf(p.time), movement:movementOf(p)}));
  const peopleById = Object.fromEntries(people.map(p => [p.id, p]));
  const statements = raw.records.map(r => {
    const p = peopleById[r.person] || {id:r.person,name:`Person ${r.person}`,time:'',movement:'unknown'};
    const categories = (r.cats || []).map(c => CAT[c] || String(c).replaceAll('_','/'));
    const tags = inferTags(r.line, categories);
    const problems = inferProblems(r.line, categories, tags);
    return { id:r.id, personId:r.person, person:p.name, time:p.time || '', year:p.year, loc:p.loc || '', order:r.order || '', text:r.line || '', reference:r.reference || '', categories, tags, allTags:uniq([...categories,...tags]), problems, movement:p.movement, gloss:gloss(r.line, categories, tags), search:'' };
  });
  const statementsById = Object.fromEntries(statements.map(s => [s.id, s]));
  const relations = (raw.links || []).filter(l => statementsById[l.l0] && statementsById[l.l1]).map((l,i) => ({id:i, source:l.l0, target:l.l1, type:l.type === 'p' ? 'support' : 'oppose'}));
  statements.forEach(s => s.search = [s.text,s.person,s.time,s.reference,s.movement,s.gloss,...s.allTags,...s.problems].join(' ').toLowerCase());
  return finishDB({people, statements, relations, title:'philosophers.json'});
}

function finishDB(db){
  db.peopleById = Object.fromEntries(db.people.map(p => [p.id, p]));
  db.statementsById = Object.fromEntries(db.statements.map(s => [s.id, s]));
  db.out = {}; db.in = {}; db.byPerson = {};
  db.statements.forEach(s => (db.byPerson[s.personId] ||= []).push(s));
  db.relations.forEach(r => { (db.out[r.source] ||= []).push(r); (db.in[r.target] ||= []).push(r); });
  db.concepts = byCount(db.statements.flatMap(s => s.allTags)).map(([name,count]) => ({name,count, statements:db.statements.filter(s=>s.allTags.includes(name)).map(s=>s.id)}));
  db.problems = byCount(db.statements.flatMap(s => s.problems)).map(([name,count]) => ({name,count, statements:db.statements.filter(s=>s.problems.includes(name)).map(s=>s.id)}));
  db.routes = ROUTES.map(r => ({...r, statements:routeStatements(db.statements, r).map(s=>s.id)}));
  db.movements = byCount(db.statements.map(s => s.movement)).map(([name,count]) => ({name,count}));
  return db;
}

function setDB(db){ DB = db; render(); inspectHome(); }

function yearOf(time=''){
  const s = String(time); const m=s.match(/\d+/); if(!m) return null;
  let y = Number(m[0]); if (s.includes('BC')) y = -y; return y;
}
function movementOf(p){
  const n = p.name, y = yearOf(p.time);
  if (['Thales','Anaximander','Anaximenes'].includes(n)) return 'presocratic/cosmology';
  if (n === 'Pythagoras') return 'pythagorean/number';
  if (n === 'Xenophanes') return 'presocratic/fallibilism';
  if (n === 'Heraclitus') return 'presocratic/becoming';
  if (['Parmenides','Zeno of Elea'].includes(n)) return 'eleatic/being';
  if (['Leucippus & Democritus','Epicurus'].includes(n)) return 'atomism/materialism';
  if (n === 'Socrates') return 'socratic/ethics'; if (n === 'Plato') return 'platonic/forms'; if (n === 'Aristotle') return 'aristotelian/worldliness';
  if (['Diogenes','Pyrrho','Stoics (Zeno of Citium et al)','Timon of Phlius','Plotinus'].includes(n)) return 'hellenistic/late/ancient';
  if (['Saint Augustine','John Scotus Erigena','Saint Anselm','Thomas Aquinas','William of Ockham'].includes(n)) return 'medieval/reason/faith';
  if (y < 1700) return 'early/modern/metaphysics'; if (y < 1800) return 'enlightenment/empiricism/politics'; if (y < 1870) return 'nineteenth/history/critique'; if (y < 1930) return 'modern/language/science'; return 'contemporary/analytic/continental';
}
function inferTags(text='', cats=[]){
  const l=text.toLowerCase(), tags=[];
  const add=(tag, rx) => { if (rx.test(l)) tags.push(tag); };
  add('time', /\btime\b|timeless|eternal|present|duration|moment|tempor/); add('change', /change|flux|becoming|evolv|process/); add('nature', /nature|natural|world|universe|earth|species/); add('matter', /matter|material|atom|particle|body|corporeal/); add('space', /space|location|world|universe/); add('mind', /mind|mental|conscious|intellect|thought|subject|awareness/); add('body', /body|bodies|corporeal|brain/); add('self', /self|subject|identity|person|soul/); add('reason', /reason|rational|logic|logical|mathemat|proof|deduc/); add('experience', /experience|sens|observ|perception|empirical|impression/); add('knowledge', /knowledge|know|truth|certainty|doubt|belief|explanation/); add('truth', /truth|true|false|certainty|proof/); add('science', /science|scientific|experiment|method|hypothesis|prediction|theory/); add('language', /language|word|speech|writing|sign|symbol|meaning|reference|discourse/); add('art', /art|aesthetic|beauty|poetry|tragedy|image|representation|sublime|illusion/); add('history', /history|historical|generation|past|civilization|tradition/); add('religion', /god|divine|religion|faith|soul|evil|theology/); add('morality', /moral|virtue|good|evil|right|wrong|duty|integrity/); add('justice', /justice|injustice|right|rights|law|equality|fair/); add('society', /society|social|community|public|private|civilization|custom/); add('government', /government|state|authority|sovereign|law|ruler|politic|citizen/); add('power', /power|authority|dominat|control|discipline|govern/); add('freedom', /freedom|free|liberty|will|choice|necessity/); add('death', /death|mortality|die|damned/); add('desire', /desire|passion|pleasure|appetite|emotion|fear|drive/); add('gender', /women|woman|female|male|gender|sex|femin/); add('math', /math|number|geometry|calculation/); add('causality', /cause|effect|causal|causation/); add('machine', /machine|mechanism|mechanical/);
  if (cats.includes('aesthetics')) tags.push('art'); if (cats.includes('politics')) tags.push('society','government'); if (cats.includes('theology/religion')) tags.push('religion');
  return uniq(tags);
}
function inferProblems(line='', cats=[], tags=[]){
  const t=new Set(tags), c=new Set(cats), l=line.toLowerCase(), out=[]; const add=x=>{ if(!out.includes(x)) out.push(x); };
  if (c.has('ontology/metaphysics') || ['reality','existence','nature','matter','space','mind','body','self','causality','machine'].some(x=>t.has(x))) add('What exists?');
  if (c.has('epistemology') || ['knowledge','truth','reason','experience','science','language'].some(x=>t.has(x))) add('How can we know?');
  if (c.has('ethics') || ['morality','justice','death','desire','freedom'].some(x=>t.has(x))) add('How should one live?');
  if (c.has('politics') || ['society','government','power'].some(x=>t.has(x))) add('How should society be governed?');
  if (c.has('aesthetics') || t.has('art')) add('What does art do?');
  if (c.has('theology/religion') || t.has('religion')) add('What is God?');
  if (t.has('time') || t.has('change')) add('What is time?');
  if (t.has('language')) add('What does language mean?');
  if (t.has('science')) add('What is science?');
  if (t.has('gender')) add('What is gender?');
  if (t.has('freedom')) add('What is freedom?');
  if (t.has('mind') || /consciousness|subject/.test(l)) add('What is mind?');
  return out.length ? out.slice(0,5) : ['What is philosophy asking here?'];
}
function gloss(line='', cats=[], tags=[]){
  const l=line.toLowerCase(), t=new Set(tags); const tests=[
    [/time|change|flux|becoming|eternal/, 'reality read through becoming'], [/language|word|speech|sign|meaning|discourse/, 'meaning mediated by signs'], [/art|beauty|poetry|tragedy|image|illusion/, 'representation tests reality'], [/science|experiment|method|prediction|theory/, 'knowledge disciplined by method'], [/gender|women|female|male|sex/, 'identity made philosophically visible'], [/government|state|power|law|society/, 'order explained through power'], [/god|religion|faith|soul|evil/, 'divinity anchors the system'], [/reason|logic|math|proof/, 'reason seeks stable form'], [/experience|sense|observ|perception/, 'knowledge begins at its limit'], [/death|mortality/, 'death reframes value'], [/freedom|liberty|will/, 'freedom tested by necessity'], [/truth|certainty|doubt/, 'truth tested by doubt'], [/nature|matter|atom|machine/, 'nature becomes explanatory ground']
  ];
  for (const [rx,g] of tests) if (rx.test(l)) return g;
  if (cats.includes('ethics')) return 'thought becomes a rule of life'; if (cats.includes('epistemology')) return 'knowledge defined by its conditions'; if (cats.includes('ontology/metaphysics')) return 'being reduced to first principles'; return 'claim positioned in the map';
}
function hay(s){ return s.search || ''; }
function routeStatements(statements, route){ return statements.filter(s => route.keys.some(k => hay(s).includes(k))).sort((a,b)=>(a.year??0)-(b.year??0)); }

function render(){
  if (!DB) return;
  renderShell(); renderActiveBar();
  const views = {atlas:viewAtlas,index:viewIndex,routes:viewRoutes,thinkers:viewThinkers,graph:viewGraph,tensions:viewTensions,compare:viewCompare,upload:viewUpload};
  const title = {atlas:'Atlas',index:'Index Reader',routes:'Reading Routes',thinkers:'Thinkers',graph:'Relation Graph',tensions:'Tensions',compare:'Compare',upload:'Upload Data'}[S.view] || 'Atlas';
  $('#viewTitle').textContent = title;
  const fs=filteredStatements(); $('#sub').textContent = `${fs.length} visible · ${DB.people.length} authors · ${DB.statements.length} postulates · ${DB.relations.length} links`;
  $('#content').innerHTML = (views[S.view] || viewAtlas)();
  $('#bottomNav').innerHTML = [['atlas','Atlas'],['index','Index'],['routes','Routes'],['tensions','Tense'],['compare','Compare']].map(([id,t])=>`<button class="${S.view===id?'active':''}" data-act="view" data-val="${id}">${t}</button>`).join('');
  attachUpload(); if (S.view==='atlas' || S.view==='graph') requestAnimationFrame(drawGraph);
}
function renderShell(){
  $('#stats').innerHTML = `<div class="stat"><strong>${DB.people.length}</strong><span>authors</span></div><div class="stat"><strong>${DB.statements.length}</strong><span>claims</span></div><div class="stat"><strong>${DB.relations.length}</strong><span>links</span></div>`;
  $('#nav').innerHTML = [['atlas','Atlas'],['index','Index'],['routes','Routes'],['thinkers','Authors'],['graph','Graph'],['tensions','Tensions'],['compare','Compare'],['upload','Upload']].map(([id,t])=>`<button class="${S.view===id?'active':''}" data-act="view" data-val="${id}">${t}</button>`).join('');
  $('#conceptRail').innerHTML = DB.concepts.slice(0,34).map(c=>chip(c.name,c.count,'concept',S.concept===c.name)).join('');
  $('#problemRail').innerHTML = DB.problems.slice(0,18).map(p=>chip(p.name,p.count,'problem',S.problem===p.name)).join('');
  $('#routeRail').innerHTML = DB.routes.map(r=>`<button class="chip ${S.route===r.id?'active':''}" data-act="route" data-val="${esc(r.id)}">${esc(r.title.split('/')[0].trim())} <small>${r.statements.length}</small></button>`).join('');
}
function chip(name,count,kind,active=false){ return `<button class="chip ${active?'active':''}" data-act="filter" data-kind="${kind}" data-val="${esc(name)}">${kind==='concept'?'#':''}${esc(name)} <small>${count}</small></button>`; }
function renderActiveBar(){
  const parts = [`<span class="cap">Active</span>`];
  if (S.q) parts.push(`<button class="chip active" data-act="clear" data-val="q">search: ${esc(S.q)} ×</button>`);
  if (S.concept) parts.push(`<button class="chip active" data-act="clear" data-val="concept">#${esc(S.concept)} ×</button>`);
  if (S.problem) parts.push(`<button class="chip active" data-act="clear" data-val="problem">${esc(S.problem)} ×</button>`);
  if (S.person != null) parts.push(`<button class="chip active" data-act="clear" data-val="person">${esc(DB.peopleById[S.person]?.name)} ×</button>`);
  if (parts.length === 1) parts.push(`<span class="muted">none — click concepts, problems, authors, graph nodes, or relations</span>`);
  $('#activeBar').innerHTML = parts.join('');
}
function filteredStatements(){
  const q=S.q.toLowerCase();
  return DB.statements.filter(s => {
    if (S.person != null && s.personId !== S.person) return false;
    if (S.concept && !s.allTags.includes(S.concept)) return false;
    if (S.problem && !s.problems.includes(S.problem)) return false;
    if (S.relation !== 'all') {
      const rels = [...(DB.out[s.id]||[]), ...(DB.in[s.id]||[])]; if (!rels.some(r=>r.type===S.relation)) return false;
    }
    return !q || hay(s).includes(q);
  }).sort(sorter);
}
function sorter(a,b){ if(S.sort==='author') return a.person.localeCompare(b.person)||Number(a.order)-Number(b.order); if(S.sort==='relations') return relCount(b.id)-relCount(a.id); return (a.year??0)-(b.year??0)||a.personId-b.personId||Number(a.order)-Number(b.order); }
function relCount(id){ return (DB.out[id]?.length||0)+(DB.in[id]?.length||0); }

function viewAtlas(){
  const fs=filteredStatements(), concepts=byCount(fs.flatMap(s=>s.allTags)).slice(0,20).map(([name,count])=>({name,count})), problems=byCount(fs.flatMap(s=>s.problems)).slice(0,14).map(([name,count])=>({name,count}));
  return `<div class="grid cols2"><div class="card"><div class="sectionHead"><h2>Cartographic graph</h2><div>${relToggles()}</div></div><p>Chronology runs left → right. Vertical bands are domains. Blue supports, red opposes. Click a node to open its local context.</p><div class="graphBox tall"><svg id="graph"></svg></div></div><div class="grid"><div class="card"><h2>Concept pressure</h2><div class="heat">${heat(concepts,'concept')}</div></div><div class="card"><h2>Problem pressure</h2><div class="heat">${heat(problems,'problem')}</div></div><div class="card"><h2>Current thread suggestions</h2><div class="route">${DB.routes.map(routeStep).join('')}</div></div></div><div class="card" style="grid-column:1/-1"><div class="sectionHead"><h2>Visible postulates</h2><div>${sortTools()}</div></div><div class="grid cards">${fs.slice(0,96).map(claimCard).join('') || empty('No claims match the filters.')}</div></div></div>`;
}
function relToggles(){ return ['all','support','oppose'].map(x=>`<button class="chip ${S.relation===x?'active':''}" data-act="relation" data-val="${x}">${x}</button>`).join(''); }
function sortTools(){ return ['chrono','author','relations'].map(x=>`<button class="chip ${S.sort===x?'active':''}" onclick="S.sort='${x}';render()">${x}</button>`).join(''); }
function heat(items, kind){ const max=Math.max(1,...items.map(i=>i.count)); return items.map(i=>`<button data-act="filter" data-kind="${kind}" data-val="${esc(i.name)}"><b>${kind==='concept'?'#':''}${esc(i.name)}</b><p>${i.count} postulates</p><div class="bar"><i style="width:${Math.round(i.count/max*100)}%"></i></div></button>`).join(''); }
function routeStep(r){ return `<button class="step" data-act="route" data-val="${esc(r.id)}"><h3>${esc(r.title)}</h3><p>${esc(r.thesis)}</p><p>${r.statements.length} postulates</p></button>`; }
function claimCard(s){
  const rels=[...(DB.out[s.id]||[]),...(DB.in[s.id]||[])].slice(0,5);
  return `<article class="claim" data-act="statement" data-val="${s.id}"><div class="who"><span>${esc(s.person)} · ${esc(s.time)}</span><span>${relCount(s.id)} links</span></div><div class="claimText">${esc(s.text)}</div><div class="meta">${s.problems.slice(0,3).map(p=>`<span class="tag problemTag">${esc(p)}</span>`).join('')}${s.allTags.slice(0,7).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div><p>${esc(s.gloss)}</p>${rels.map(r=>relLine(r,s.id)).join('')}</article>`;
}
function relLine(r, focus){ const other = DB.statementsById[r.source===focus ? r.target : r.source]; const sign=r.type==='support'?'+':'−'; return `<div class="rel ${r.type}" data-act="statement" data-val="${other.id}"><b>${sign}</b> ${esc(other.person)} (${esc(other.text)})</div>`; }
function empty(t){ return `<div class="empty">${esc(t)}</div>`; }

function viewIndex(){
  const type=S.indexType||'concept'; const list=type==='concept'?DB.concepts:DB.problems; const key=S.indexKey || (type==='concept'?S.concept:S.problem) || list[0]?.name; S.indexKey=key;
  return `<div class="split"><div class="indexList"><div class="card"><div class="sectionHead"><h2>${type==='concept'?'Concept':'Problem'} index</h2><div><button class="chip ${type==='concept'?'active':''}" onclick="S.indexType='concept';S.indexKey=null;render()">Concepts</button><button class="chip ${type==='problem'?'active':''}" onclick="S.indexType='problem';S.indexKey=null;render()">Problems</button></div></div><input type="text" placeholder="Filter index…" oninput="filterIndex(this.value)"></div><div id="indexItems">${list.map(i=>indexItem(i,type,key)).join('')}</div></div><div class="indexDetail">${indexDetail(type,key)}</div></div>`;
}
function indexItem(i,type,key){ return `<button class="indexItem ${key===i.name?'active':''}" data-act="index" data-kind="${type}" data-val="${esc(i.name)}"><b>${type==='concept'?'#':''}${esc(i.name)}</b><span>${i.count} postulates</span></button>`; }
window.filterIndex = function(v){ const q=v.toLowerCase(); $$('#indexItems .indexItem').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q)?'grid':'none'}); };
function indexDetail(type,key){
  const st = DB.statements.filter(s => type==='concept' ? s.allTags.includes(key) : s.problems.includes(key)).sort(sorter);
  const authors = byCount(st.map(s=>s.person)).slice(0,24).map(([name,count])=>({name,count}));
  const other = byCount(st.flatMap(s=> type==='concept'?s.problems:s.allTags)).slice(0,22).map(([name,count])=>({name,count}));
  const support = st.reduce((n,s)=>n+(DB.out[s.id]||[]).filter(r=>r.type==='support').length+(DB.in[s.id]||[]).filter(r=>r.type==='support').length,0);
  const oppose = st.reduce((n,s)=>n+(DB.out[s.id]||[]).filter(r=>r.type==='oppose').length+(DB.in[s.id]||[]).filter(r=>r.type==='oppose').length,0);
  return `<div class="card"><div class="sectionHead"><div><h2>${type==='concept'?'#':''}${esc(key)}</h2><p>${st.length} postulates · ${authors.length} major authors · ${support} supports · ${oppose} oppositions</p></div><button class="chip" data-act="clear" data-val="${type}">clear filter</button></div><p>${indexThesis(type,key,st)}</p></div><div class="grid cols2"><div class="card"><h2>Authors</h2><div class="heat">${heatPerson(authors)}</div></div><div class="card"><h2>${type==='concept'?'Adjacent problems':'Concept constellation'}</h2><div class="heat">${heat(other,type==='concept'?'problem':'concept')}</div></div></div><div class="card"><h2>All authors / postulates</h2>${groupByAuthor(st)}</div>`;
}
function heatPerson(items){ const max=Math.max(1,...items.map(i=>i.count)); return items.map(i=>{const p=DB.people.find(x=>x.name===i.name); return `<button data-act="person" data-val="${p?.id}"><b>${esc(i.name)}</b><p>${i.count} postulates</p><div class="bar"><i style="width:${Math.round(i.count/max*100)}%"></i></div></button>`}).join(''); }
function indexThesis(type,key,st){
  const earliest=st[0], latest=st[st.length-1], rels=st.flatMap(s=>[...(DB.out[s.id]||[]),...(DB.in[s.id]||[])]);
  return `${type==='concept'?'This concept':'This problem'} is not a label but a route: it runs from ${earliest?earliest.person:'early claims'} toward ${latest?latest.person:'later claims'}, crossing ${uniq(st.flatMap(s=>s.movement)).length} movements and ${rels.length} explicit support/opposition links.`;
}
function groupByAuthor(st){
  const groups = Object.values(st.reduce((a,s)=>((a[s.person] ||= []).push(s),a),{})).sort((a,b)=>(a[0].year??0)-(b[0].year??0));
  return groups.map(g=>`<div class="group"><div class="groupHead"><b data-act="person" data-val="${g[0].personId}">${esc(g[0].person)}</b><span>${esc(g[0].time)} · ${g.length}</span></div><div class="postulates">${g.map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)} <span class="tag">${esc(s.gloss)}</span></div>`).join('')}</div></div>`).join('');
}

function viewRoutes(){
  const r = DB.routes.find(x=>x.id===S.route) || DB.routes[0];
  const st = r.statements.map(id=>DB.statementsById[id]).filter(Boolean).sort(sorter);
  const authors = byCount(st.map(s=>s.person)).slice(0,28).map(([name,count])=>({name,count}));
  return `<div class="grid"><div class="card"><div class="sectionHead"><div><h2>${esc(r.title)}</h2><p>${esc(r.thesis)}</p></div><div class="meta">${DB.routes.map(x=>`<button class="chip ${x.id===r.id?'active':''}" data-act="route" data-val="${x.id}">${esc(x.title.split('/')[0].trim())}</button>`).join('')}</div></div></div><div class="route">${authors.map(a=>{const p=DB.people.find(x=>x.name===a.name); const ss=st.filter(s=>s.person===a.name).slice(0,2); return `<div class="step" data-act="person" data-val="${p?.id}"><h3>${esc(a.name)}</h3><p>${a.count} postulates</p>${ss.map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)}</div>`).join('')}</div>`}).join('')}</div><div class="grid cols2"><div class="card"><h2>Route concept map</h2><div class="heat">${heat(byCount(st.flatMap(s=>s.allTags)).slice(0,24).map(([name,count])=>({name,count})),'concept')}</div></div><div class="card"><h2>Route problems</h2><div class="heat">${heat(byCount(st.flatMap(s=>s.problems)).slice(0,18).map(([name,count])=>({name,count})),'problem')}</div></div></div><div class="card"><h2>All route postulates</h2>${groupByAuthor(st)}</div></div>`;
}

function viewThinkers(){
  const people = DB.people.filter(p => S.person == null || p.id===S.person).filter(p => !S.q || `${p.name} ${p.time} ${p.movement}`.toLowerCase().includes(S.q.toLowerCase()) || (DB.byPerson[p.id]||[]).some(s=>hay(s).includes(S.q.toLowerCase())));
  return `<div class="grid cards">${people.map(personCard).join('')}</div>`;
}
function personCard(p){
  const st=DB.byPerson[p.id]||[], relOut=DB.relations.filter(r=>DB.statementsById[r.source].personId===p.id), relIn=DB.relations.filter(r=>DB.statementsById[r.target].personId===p.id), tags=byCount(st.flatMap(s=>s.allTags)).slice(0,8), probs=byCount(st.flatMap(s=>s.problems)).slice(0,5);
  return `<div class="card"><div class="sectionHead"><div><h2 data-act="person" data-val="${p.id}">${esc(p.name)}</h2><p>${esc(p.time)} · ${esc(p.movement)}</p></div><button class="chip" data-act="compare" data-val="${p.id}">compare</button></div><div class="meta">${tags.map(([t,c])=>`<span class="tag">#${esc(t)} ${c}</span>`).join('')}</div><div class="meta">${probs.map(([t,c])=>`<span class="tag problemTag">${esc(t)} ${c}</span>`).join('')}</div><p>${st.length} postulates · ${relOut.length} outgoing · ${relIn.length} incoming</p>${st.slice(0,8).map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)}</div>`).join('')}</div>`;
}
function viewGraph(){ return `<div class="card"><div class="sectionHead"><h2>Relation graph</h2><div>${relToggles()}</div></div><p>Use search or index filters to sculpt the graph. Click nodes to open local support/opposition neighborhoods.</p><div class="graphBox tall"><svg id="graph"></svg></div></div>`; }
function viewTensions(){
  const q=S.q.toLowerCase(); let rels=DB.relations.filter(r=>r.type==='oppose');
  if(S.concept) rels=rels.filter(r=>DB.statementsById[r.source].allTags.includes(S.concept)||DB.statementsById[r.target].allTags.includes(S.concept));
  if(S.problem) rels=rels.filter(r=>DB.statementsById[r.source].problems.includes(S.problem)||DB.statementsById[r.target].problems.includes(S.problem));
  if(q) rels=rels.filter(r=>hay(DB.statementsById[r.source]).includes(q)||hay(DB.statementsById[r.target]).includes(q));
  return `<div class="grid cards">${rels.slice(0,140).map(r=>{const a=DB.statementsById[r.source], b=DB.statementsById[r.target]; return `<div class="card"><h2>${esc(a.person)} ↔ ${esc(b.person)}</h2><div class="rel oppose" data-act="statement" data-val="${a.id}"><b>A</b> ${esc(a.text)}</div><div class="rel oppose" data-act="statement" data-val="${b.id}"><b>B</b> ${esc(b.text)}</div><div class="meta">${uniq([...a.allTags,...b.allTags]).slice(0,8).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div></div>`}).join('') || empty('No oppositions match.')}</div>`;
}
function addCompare(id){ if(!S.compare.includes(id)) S.compare.push(id); S.compare=S.compare.slice(-4); S.view='compare'; render(); }
function viewCompare(){
  const ids=S.compare.length?S.compare:DB.people.slice(10,14).map(p=>p.id); const people=ids.map(id=>DB.peopleById[id]).filter(Boolean);
  return `<div class="grid"><div class="card"><h2>Compare workspace</h2><p>Add authors from cards or inspector. Compare concepts, problems, claims, and relation vectors.</p></div><div class="cols3">${people.map(compareCol).join('')}</div><div class="card"><h2>Problem × author matrix</h2>${compareMatrix(people)}</div></div>`;
}
function compareCol(p){ const st=DB.byPerson[p.id]||[], tags=byCount(st.flatMap(s=>s.allTags)).slice(0,14), probs=byCount(st.flatMap(s=>s.problems)).slice(0,10); return `<div class="col card"><div class="sectionHead"><h2>${esc(p.name)}</h2><button class="chip" data-act="dropCompare" data-val="${p.id}">×</button></div><p>${esc(p.time)} · ${esc(p.movement)}</p><div class="meta">${tags.map(([t,c])=>`<span class="tag">#${esc(t)} ${c}</span>`).join('')}</div><div class="meta">${probs.map(([t,c])=>`<span class="tag problemTag">${esc(t)} ${c}</span>`).join('')}</div>${st.slice(0,12).map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)}</div>`).join('')}</div>`; }
function compareMatrix(people){ const probs=uniq(people.flatMap(p=>(DB.byPerson[p.id]||[]).flatMap(s=>s.problems))).slice(0,18); document.documentElement.style.setProperty('--cols', people.length); return `<div class="matrix"><div class="cell"></div>${people.map(p=>`<div class="cell"><b>${esc(p.name)}</b></div>`).join('')}${probs.map(pr=>`<div class="cell">${esc(pr)}</div>${people.map(p=>{const n=(DB.byPerson[p.id]||[]).filter(s=>s.problems.includes(pr)).length; return `<div class="cell ${n?'hot':''}" style="--p:${Math.min(85,n*18)}">${n||''}</div>`}).join('')}`).join('')}</div>`; }
function viewUpload(){ return `<div class="card"><h2>Upload compatible data</h2><p>Supports original Deniz JSON, enriched txt, grouped/reflowed txt. Uploaded data replaces the current atlas locally only.</p>${uploadBox()}</div>`; }

function drawGraph(){
  const svg=$('#graph'); if(!svg||!DB) return;
  const fs=filteredStatements().slice(0,230), ids=new Set(fs.map(s=>s.id));
  let rels=DB.relations.filter(r=>ids.has(r.source)&&ids.has(r.target)); if(S.relation!=='all') rels=rels.filter(r=>r.type===S.relation); rels=rels.slice(0,430);
  const w=svg.clientWidth||900,h=svg.clientHeight||520, years=DB.people.map(p=>p.year).filter(Number.isFinite), min=Math.min(...years), max=Math.max(...years), span=max-min||1;
  const band=Object.fromEntries(CAT_ORDER.map((c,i)=>[c,(i+1)/(CAT_ORDER.length+1)])); const pos={};
  fs.forEach((s,i)=>{const p=DB.peopleById[s.personId], x=32+(((p.year??0)-min)/span)*(w-64), y=(band[s.categories[0]]||.55)*h + ((i%9)-4)*5; pos[s.id]=[clamp(x,18,w-18),clamp(y,18,h-18)];});
  const edges=rels.map(r=>{const a=pos[r.source], b=pos[r.target]; return a&&b?`<line class="edge ${r.type}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${r.type==='oppose'?1.5:1}"/>`:''}).join('');
  const nodes=fs.map(s=>{const [x,y]=pos[s.id]; const color=s.categories.includes('politics')?'var(--red)':s.categories.includes('epistemology')?'var(--blue)':s.categories.includes('ethics')?'var(--green)':s.categories.includes('aesthetics')?'var(--violet)':s.categories.includes('theology/religion')?'var(--gold)':'var(--ink)'; return `<g class="node" data-act="statement" data-val="${s.id}"><circle cx="${x}" cy="${y}" r="${S.statement===s.id?6.5:4}" fill="${color}"><title>${esc(s.person)} — ${esc(s.text)}</title></circle></g>`}).join('');
  const labels=uniq(fs.map(s=>s.personId)).slice(0,70).map(id=>{const s=fs.find(x=>x.personId===id), p=pos[s.id]; return `<text class="svglabel" x="${p[0]+6}" y="${p[1]-6}">${esc(s.person)}</text>`}).join('');
  svg.innerHTML=edges+nodes+labels;
}

function inspectHome(){ $('#inspector').innerHTML = `<div><div class="title">Explore.</div><p>Click a graph node, postulate, author, concept, problem, or route. Filters are always visible above the main panel.</p></div>${uploadBox()}`; attachUpload(); }
function inspectPerson(id){ const p=DB.peopleById[id], st=DB.byPerson[id]||[], out=DB.relations.filter(r=>DB.statementsById[r.source].personId===id), inn=DB.relations.filter(r=>DB.statementsById[r.target].personId===id); $('#inspector').innerHTML=`<div><div class="title">${esc(p.name)}</div><p>${esc(p.time)} · ${esc(p.movement)}</p><p>${st.length} postulates · ${out.length} outgoing · ${inn.length} incoming</p><button class="chip" data-act="compare" data-val="${id}">Add to compare</button></div><div class="card"><h2>Dominant concepts</h2><div class="meta">${byCount(st.flatMap(s=>s.allTags)).slice(0,14).map(([t,c])=>`<span class="tag">#${esc(t)} ${c}</span>`).join('')}</div></div>${uploadBox()}`; attachUpload(); }
function inspectStatement(id){ const s=DB.statementsById[id]; if(!s) return; S.statement=id; const out=DB.out[id]||[], inn=DB.in[id]||[]; $('#inspector').innerHTML=`<div><div class="title">${esc(s.person)}</div><p>${esc(s.time)} · ${esc(s.movement)}</p></div><div class="card"><div class="claimText">${esc(s.text)}</div><p>${esc(s.gloss)}</p><div class="meta">${s.problems.map(p=>`<span class="tag problemTag">${esc(p)}</span>`).join('')}${s.allTags.map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div><button class="chip" data-act="compare" data-val="${s.personId}">Compare ${esc(s.person)}</button></div><div class="card"><h2>Supports / extends</h2>${out.filter(r=>r.type==='support').concat(inn.filter(r=>r.type==='support')).map(r=>relLine(r,id)).join('')||'<p>None.</p>'}</div><div class="card"><h2>Opposes / contests</h2>${out.filter(r=>r.type==='oppose').concat(inn.filter(r=>r.type==='oppose')).map(r=>relLine(r,id)).join('')||'<p>None.</p>'}</div>${uploadBox()}`; attachUpload(); }
function renderInspectorUpload(){ $('#inspector').innerHTML = uploadBox(); attachUpload(); }
function uploadBox(){ return `<div class="drop"><b>Upload data</b><p>Original JSON, enriched txt, or grouped txt.</p><input id="fileInput" type="file" accept=".json,.txt,application/json,text/plain"></div>`; }
function attachUpload(){ const input=$('#fileInput'); if(!input) return; input.onchange=async e=>{const f=e.target.files[0]; if(!f) return; const txt=await f.text(); try{ if(f.name.endsWith('.json')||txt.trim().startsWith('{')) setDB(buildDB(JSON.parse(txt))); else setDB(parseTxt(txt, f.name)); } catch(err){ alert('Could not parse: '+err.message); } }; }
function parseTxt(text,title='uploaded txt'){
  const people=[], statements=[], relations=[]; let current=null,last=null,pid=0,sid=0; const getP=(name,time='')=>{let p=people.find(x=>x.name===name); if(!p){p={id:pid++,name,time,loc:'',sortby:name,year:yearOf(time),movement:'uploaded/txt'};people.push(p)} return p};
  for(const raw of text.split(/\r?\n/)){ const line=raw.trimEnd(); if(!line||line.startsWith('#')) continue; const h=line.match(/^(.+?) - \[(.*?)\]$/); if(h){current=getP(h[1].trim(),h[2].trim()); continue;} if(/^- /.test(line)&&!/^\s+-/.test(line)){ if(!current) current=getP('Uploaded'); const body=line.slice(2); const clean=body.split(/\s+#|\s+\(/)[0].trim(); const tags=[...body.matchAll(/#([\w/-]+)/g)].map(m=>m[1].replaceAll('_','/')); const cats=tags.filter(t=>Object.values(CAT).includes(t)); const extra=tags.filter(t=>!cats.includes(t)); const probs=[...body.matchAll(/\(([^)]*\?[^)]*)\)/g)].flatMap(m=>m[1].split('·').map(x=>x.trim())); const mv=(body.match(/@([\w/-]+)/)||[])[1]||current.movement; last={id:sid++,personId:current.id,person:current.name,time:current.time,year:current.year,loc:'',order:'',text:clean,reference:'',categories:cats,tags:extra,allTags:uniq([...cats,...extra]),problems:probs.length?probs:inferProblems(clean,cats,extra),movement:mv,gloss:(body.match(/\/\/\s*(.+)$/)||[])[1]||gloss(clean,cats,extra)}; last.search=[last.text,last.person,last.movement,last.gloss,...last.allTags,...last.problems].join(' ').toLowerCase(); statements.push(last); continue; } if(last&&/^\s+- \(/.test(line)){const m=line.match(/\(([^)]*\?[^)]*)\)(?:\s*\/\/\s*(.+))?/); if(m){last.problems=m[1].split('·').map(x=>x.trim()); if(m[2]) last.gloss=m[2].trim();}} if(last&&/^\s+- #/.test(line)){const tags=[...line.matchAll(/#([\w/-]+)/g)].map(m=>m[1].replaceAll('_','/')); last.categories=tags.filter(t=>Object.values(CAT).includes(t)); last.tags=tags.filter(t=>!last.categories.includes(t)); last.allTags=uniq([...last.categories,...last.tags]); const mv=(line.match(/@([\w/-]+)/)||[])[1]; if(mv) last.movement=mv;} const r=line.match(/^\s+-\s*(?:\[([+-])\]|([+-]))\s*(.+?)(?::|\()\s*(.+?)\)?\.?\s*$/); if(last&&r){const sign=r[1]||r[2], person=r[3].trim(), txt=r[4].trim(); const target=statements.find(s=>s.person===person&&s.text.startsWith(txt.slice(0,35))); if(target) relations.push({id:relations.length,source:last.id,target:target.id,type:sign==='+'?'support':'oppose'});}}
  return finishDB({people,statements,relations,title});
}
