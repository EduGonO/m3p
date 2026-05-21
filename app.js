'use strict';

const DATA_URLS = ['philosophers.json', '/philosophers.json', 'https://gist.githubusercontent.com/visnup/28034a969b425c38d4f5b9837503865c/raw/b9cc8bb20ab78a4556aeef3c22eb31ff90c21e8a/philosophers.json'];
const CAT = { on:'ontology/metaphysics', ep:'epistemology', et:'ethics', po:'politics', ae:'aesthetics', th:'theology/religion' };
const CAT_ORDER = ['ontology/metaphysics','epistemology','ethics','politics','aesthetics','theology/religion'];
const CAT_LABEL = {
  'ontology/metaphysics':'Ontology · metaphysics',
  epistemology:'Epistemology', ethics:'Ethics', politics:'Politics', aesthetics:'Aesthetics', 'theology/religion':'Theology · religion'
};
const CAT_COLOR = {
  'ontology/metaphysics':'var(--brown)', epistemology:'var(--blue)', ethics:'var(--green)', politics:'var(--red)', aesthetics:'var(--violet)', 'theology/religion':'var(--gold)'
};
const ROUTES = [
  {id:'time', title:'Time / Change', keys:['time','change','becoming','flux','eternal','duration','present','space'], thesis:'Time begins as cosmology, becomes metaphysics, then becomes experience, history, and finitude.'},
  {id:'limits', title:'Limits of Knowledge', keys:['knowledge','truth','certainty','doubt','experience','perception','logic','science','fallible','senses'], thesis:'Knowledge becomes rigorous each time philosophy discovers a new limit: sense, proof, language, history, power, embodiment.'},
  {id:'art', title:'Art / Representation', keys:['art','aesthetics','beauty','poetry','tragedy','representation','history','image','illusion'], thesis:'Art moves from imitation to catharsis, disclosure, construction, critique, simulation, and self-exposure.'},
  {id:'language', title:'Language / Meaning', keys:['language','words','speech','writing','meaning','sign','reference','symbol','discourse'], thesis:'Meaning shifts from mental representation to systems, use, reference, performative force, and discourse.'},
  {id:'power', title:'Power / State / Society', keys:['power','government','state','law','society','rights','freedom','public','justice','authority'], thesis:'Political order moves from sovereignty and fear to rights, liberty, ideology, discipline, justice, and productive power.'},
  {id:'gender', title:'Gender / Sex / Identity', keys:['gender','women','woman','female','male','body','sex','identity','feminist'], thesis:'Gender is naturalized as hierarchy, then contested as education, equality, embodiment, discourse, and performativity.'},
  {id:'god', title:'God / Religion / Secularization', keys:['god','religion','faith','soul','evil','divine','theology'], thesis:'God functions as cause, guarantee, moral order, projection, problem, and object of critique.'},
  {id:'mind', title:'Mind / Body / Self', keys:['mind','body','soul','self','consciousness','experience','subject','psychology'], thesis:'The self moves from soul to subject, bundle, will, unconscious, embodiment, language, computation, and consciousness.'}
];

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uniq = xs => [...new Set(xs.filter(Boolean))];
const counts = xs => Object.entries(xs.reduce((a,x)=>(x&&(a[x]=(a[x]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

let DB = null;
let S = {
  view:'atlas', q:'', concept:null, problem:null, route:'time', person:null, statement:null,
  indexType:'concept', indexKey:null, compare:[], relation:'all', sort:'chrono'
};

boot();

async function boot(){
  wire();
  setLoading('Loading philosophers.json…');
  try {
    const raw = await loadFirstJSON(DATA_URLS);
    setDB(buildDB(raw));
  } catch (err) {
    setLoading('Could not auto-load data.', err.message);
    renderContextUpload();
  }
}

async function loadFirstJSON(urls){
  let last = null;
  for (const url of urls) {
    try {
      const r = await fetch(url, {cache:'no-store'});
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { last = e; }
  }
  throw last || new Error('No data source available.');
}

function wire(){
  $('#q').addEventListener('input', e => { S.q = e.target.value.trim(); render(); });
  $('#theme').onclick = () => { const app = $('#app'); app.dataset.theme = app.dataset.theme === 'dark' ? 'light' : 'dark'; };
  $('#density').onclick = () => { $('#app').classList.toggle('density'); };
  $('#reset').onclick = resetAll;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !DB) return;
    const a = el.dataset.act, v = el.dataset.val, k = el.dataset.kind;
    if (a === 'view') { S.view = v; if (k) S.indexType = k; render(); }
    if (a === 'filter') { setFilter(k, v); }
    if (a === 'clear') { clearFilter(v); }
    if (a === 'person') { S.person = Number(v); S.view = 'thinkers'; render(); inspectPerson(Number(v)); }
    if (a === 'statement') { S.statement = Number(v); inspectStatement(Number(v)); if (S.view === 'atlas' || S.view === 'graph') requestAnimationFrame(drawGraph); }
    if (a === 'index') { S.indexType = k; S.indexKey = v; if (k === 'concept') S.concept = v; if (k === 'problem') S.problem = v; S.view = 'index'; render(); }
    if (a === 'route') { S.route = v; S.view = 'routes'; render(); }
    if (a === 'compare') { addCompare(Number(v)); }
    if (a === 'dropCompare') { S.compare = S.compare.filter(id => id !== Number(v)); render(); }
    if (a === 'relation') { S.relation = v; render(); }
    if (a === 'sort') { S.sort = v; render(); }
  });
}

function resetAll(){
  S = {...S, q:'', concept:null, problem:null, person:null, statement:null, indexKey:null, relation:'all', sort:'chrono'};
  $('#q').value = '';
  render();
  inspectHome();
}
function setFilter(kind, value){
  if (kind === 'concept') { S.concept = value; S.indexType = 'concept'; S.indexKey = value; }
  if (kind === 'problem') { S.problem = value; S.indexType = 'problem'; S.indexKey = value; }
  S.person = null;
  S.view = 'index';
  render();
}
function clearFilter(key){
  if (key === 'q') { S.q = ''; $('#q').value = ''; }
  if (key === 'concept') S.concept = null;
  if (key === 'problem') S.problem = null;
  if (key === 'person') S.person = null;
  if (key === 'statement') S.statement = null;
  render();
}
function setLoading(title, detail=''){
  $('#content').innerHTML = `<div class="empty"><b>${esc(title)}</b>${detail ? `<p>${esc(detail)}</p>` : ''}</div>`;
  $('#context').innerHTML = uploadBox();
  attachUpload();
}

function buildDB(raw){
  if (!raw || !Array.isArray(raw.people) || !Array.isArray(raw.records)) throw new Error('Invalid JSON shape.');
  const people = raw.people.map(p => ({...p, year:yearOf(p.time), movement:movementOf(p)}));
  const peopleById = Object.fromEntries(people.map(p => [p.id, p]));
  const statements = raw.records.map(r => {
    const p = peopleById[r.person] || {id:r.person, name:`Person ${r.person}`, time:'', loc:'', movement:'unknown', year:null};
    const categories = (r.cats || []).map(c => CAT[c] || String(c).replaceAll('_','/'));
    const tags = inferTags(r.line, categories);
    const problems = inferProblems(r.line, categories, tags);
    const s = {
      id:r.id, personId:r.person, person:p.name, time:p.time || '', year:p.year, loc:p.loc || '', order:r.order || '', text:r.line || '', reference:r.reference || '',
      categories, tags, allTags:uniq([...categories, ...tags]), problems, movement:p.movement, gloss:gloss(r.line, categories, tags)
    };
    s.search = [s.text,s.person,s.time,s.reference,s.movement,s.gloss,...s.allTags,...s.problems].join(' ').toLowerCase();
    return s;
  });
  const statementsById = Object.fromEntries(statements.map(s => [s.id, s]));
  const relations = (raw.links || []).filter(l => statementsById[l.l0] && statementsById[l.l1]).map((l,i) => ({id:i, source:l.l0, target:l.l1, type:l.type === 'p' ? 'support' : 'oppose'}));
  return finishDB({people, statements, relations, title:'philosophers.json'});
}
function finishDB(db){
  db.peopleById = Object.fromEntries(db.people.map(p => [p.id, p]));
  db.statementsById = Object.fromEntries(db.statements.map(s => [s.id, s]));
  db.byPerson = {}; db.out = {}; db.in = {};
  db.statements.forEach(s => (db.byPerson[s.personId] ||= []).push(s));
  db.relations.forEach(r => { (db.out[r.source] ||= []).push(r); (db.in[r.target] ||= []).push(r); });
  db.concepts = counts(db.statements.flatMap(s => s.allTags)).map(([name,count]) => ({name,count, ids:db.statements.filter(s=>s.allTags.includes(name)).map(s=>s.id)}));
  db.problems = counts(db.statements.flatMap(s => s.problems)).map(([name,count]) => ({name,count, ids:db.statements.filter(s=>s.problems.includes(name)).map(s=>s.id)}));
  db.movements = counts(db.statements.map(s => s.movement)).map(([name,count]) => ({name,count}));
  db.routes = ROUTES.map(r => ({...r, ids:routeStatements(db.statements, r).map(s => s.id)}));
  return db;
}
function setDB(db){ DB = db; render(); inspectHome(); }

function yearOf(time=''){
  const m = String(time).match(/\d+/); if (!m) return null;
  let y = Number(m[0]); if (String(time).includes('BC')) y = -y; return y;
}
function movementOf(p){
  const n=p.name, y=yearOf(p.time);
  if (['Thales','Anaximander','Anaximenes'].includes(n)) return 'presocratic/cosmology';
  if (n === 'Pythagoras') return 'pythagorean/number';
  if (n === 'Xenophanes') return 'presocratic/fallibilism';
  if (n === 'Heraclitus') return 'presocratic/becoming';
  if (['Parmenides','Zeno of Elea'].includes(n)) return 'eleatic/being';
  if (['Leucippus & Democritus','Epicurus'].includes(n)) return 'atomism/materialism';
  if (n === 'Socrates') return 'socratic/ethics'; if (n === 'Plato') return 'platonic/forms'; if (n === 'Aristotle') return 'aristotelian/worldliness';
  if (['Diogenes','Pyrrho','Stoics (Zeno of Citium et al)','Timon of Phlius','Plotinus'].includes(n)) return 'hellenistic/late ancient';
  if (['Saint Augustine','John Scotus Erigena','Saint Anselm','Thomas Aquinas','William of Ockham'].includes(n)) return 'medieval/reason faith';
  if (y < 1700) return 'early modern/metaphysics'; if (y < 1800) return 'enlightenment/empiricism politics'; if (y < 1870) return 'nineteenth/history critique'; if (y < 1930) return 'modern/language science'; return 'contemporary/analytic continental';
}
function inferTags(text='', cats=[]){
  const l = String(text).toLowerCase(), tags=[];
  const add=(tag,rx)=>{ if(rx.test(l)) tags.push(tag); };
  add('time',/\btime\b|timeless|eternal|present|duration|moment|tempor/); add('change',/change|flux|becoming|evolv|process/); add('nature',/nature|natural|world|universe|earth|species/); add('matter',/matter|material|atom|particle|body|corporeal/); add('space',/space|location|world|universe/); add('mind',/mind|mental|conscious|intellect|thought|subject|awareness/); add('body',/body|bodies|corporeal|brain/); add('self',/self|subject|identity|person|soul/); add('reason',/reason|rational|logic|logical|mathemat|proof|deduc/); add('experience',/experience|sens|observ|perception|empirical|impression/); add('knowledge',/knowledge|know|truth|certainty|doubt|belief|explanation/); add('truth',/truth|true|false|certainty|proof/); add('science',/science|scientific|experiment|method|hypothesis|prediction|theory/); add('language',/language|word|speech|writing|sign|symbol|meaning|reference|discourse/); add('art',/art|aesthetic|beauty|poetry|tragedy|image|representation|sublime|illusion/); add('history',/history|historical|generation|past|civilization|tradition/); add('religion',/god|divine|religion|faith|soul|evil|theology/); add('morality',/moral|virtue|good|evil|right|wrong|duty|integrity/); add('justice',/justice|injustice|right|rights|law|equality|fair/); add('society',/society|social|community|public|private|civilization|custom/); add('government',/government|state|authority|sovereign|law|ruler|politic|citizen/); add('power',/power|authority|dominat|control|discipline|govern/); add('freedom',/freedom|free|liberty|will|choice|necessity/); add('death',/death|mortality|die|damned/); add('desire',/desire|passion|pleasure|appetite|emotion|fear|drive/); add('gender',/women|woman|female|male|gender|sex|femin/); add('math',/math|number|geometry|calculation/); add('causality',/cause|effect|causal|causation/); add('machine',/machine|mechanism|mechanical/);
  if (cats.includes('aesthetics')) tags.push('art'); if (cats.includes('politics')) tags.push('society','government'); if (cats.includes('theology/religion')) tags.push('religion');
  return uniq(tags);
}
function inferProblems(line='', cats=[], tags=[]){
  const t=new Set(tags), c=new Set(cats), l=String(line).toLowerCase(), out=[]; const add=x=>{ if(!out.includes(x)) out.push(x); };
  if (c.has('ontology/metaphysics') || ['nature','matter','space','mind','body','self','causality','machine'].some(x=>t.has(x))) add('What exists?');
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
  const l=String(line).toLowerCase();
  const rules = [[/time|change|flux|becoming|eternal/,'reality read through becoming'],[/language|word|speech|sign|meaning|discourse/,'meaning mediated by signs'],[/art|beauty|poetry|tragedy|image|illusion/,'representation tests reality'],[/science|experiment|method|prediction|theory/,'knowledge disciplined by method'],[/gender|women|female|male|sex/,'identity made philosophically visible'],[/government|state|power|law|society/,'order explained through power'],[/god|religion|faith|soul|evil/,'divinity anchors the system'],[/reason|logic|math|proof/,'reason seeks stable form'],[/experience|sense|observ|perception/,'knowledge begins at its limit'],[/death|mortality/,'death reframes value'],[/freedom|liberty|will/,'freedom tested by necessity'],[/truth|certainty|doubt/,'truth tested by doubt'],[/nature|matter|atom|machine/,'nature becomes explanatory ground']];
  for (const [rx,g] of rules) if (rx.test(l)) return g;
  if (cats.includes('ethics')) return 'thought becomes a rule of life'; if (cats.includes('epistemology')) return 'knowledge defined by its conditions'; if (cats.includes('ontology/metaphysics')) return 'being reduced to first principles'; return 'claim positioned in the map';
}
function routeStatements(statements, route){ return statements.filter(s => route.keys.some(k => s.search.includes(k))).sort((a,b)=>(a.year??0)-(b.year??0)||a.person.localeCompare(b.person)); }
function relCount(id){ return (DB.out[id]?.length||0)+(DB.in[id]?.length||0); }
function sortFn(a,b){
  if (S.sort === 'author') return a.person.localeCompare(b.person)||Number(a.order||0)-Number(b.order||0);
  if (S.sort === 'relations') return relCount(b.id)-relCount(a.id);
  return (a.year??0)-(b.year??0)||a.personId-b.personId||Number(a.order||0)-Number(b.order||0);
}

function render(){
  if (!DB) return;
  renderTop();
  const visible = filteredStatements();
  $('#viewTitle').textContent = viewTitle();
  $('#sub').textContent = `${visible.length} visible · ${DB.people.length} authors · ${DB.statements.length} postulates · ${DB.relations.length} relations`;
  const map = {atlas:viewAtlas,index:viewIndex,routes:viewRoutes,thinkers:viewThinkers,graph:viewGraph,tensions:viewTensions,compare:viewCompare,upload:viewUpload};
  $('#content').innerHTML = (map[S.view] || viewAtlas)();
  $('#mobileNav').innerHTML = navButtons(true);
  if (!S.statement) inspectHome();
  attachUpload();
  if (S.view === 'atlas' || S.view === 'graph') requestAnimationFrame(drawGraph);
}
function viewTitle(){ return ({atlas:'Discovery Surface',index:'Index Reader',routes:'Reading Routes',thinkers:'Authors',graph:'Relation Graph',tensions:'Tensions',compare:'Compare',upload:'Upload Data'})[S.view] || 'Atlas'; }
function renderTop(){
  $('#stats').innerHTML = `<div class="stat"><strong>${DB.people.length}</strong><span>authors</span></div><div class="stat"><strong>${DB.statements.length}</strong><span>claims</span></div><div class="stat"><strong>${DB.relations.length}</strong><span>links</span></div>`;
  $('#nav').innerHTML = navButtons(false);
  const filters = [`<span class="eyebrow">Active</span>`];
  if (S.q) filters.push(`<button class="chip active" data-act="clear" data-val="q">search · ${esc(S.q)} ×</button>`);
  if (S.concept) filters.push(`<button class="chip active" data-act="clear" data-val="concept">concept · ${esc(pretty(S.concept))} ×</button>`);
  if (S.problem) filters.push(`<button class="chip active" data-act="clear" data-val="problem">problem · ${esc(S.problem)} ×</button>`);
  if (S.person != null) filters.push(`<button class="chip active" data-act="clear" data-val="person">author · ${esc(DB.peopleById[S.person]?.name || '')} ×</button>`);
  filters.push(`<button class="chip ${S.relation==='all'?'active':''}" data-act="relation" data-val="all">all links</button><button class="chip ${S.relation==='support'?'active':''}" data-act="relation" data-val="support">supports</button><button class="chip ${S.relation==='oppose'?'active':''}" data-act="relation" data-val="oppose">opposes</button>`);
  $('#activeBar').innerHTML = filters.join('');
}
function navButtons(mobile){
  const items = mobile ? [['atlas','Atlas'],['index','Index'],['routes','Routes'],['tensions','Tense'],['compare','Compare']] : [['atlas','Atlas'],['index','Index'],['routes','Routes'],['thinkers','Authors'],['graph','Graph'],['tensions','Tensions'],['compare','Compare'],['upload','Upload']];
  return items.map(([id,t])=>`<button class="viewBtn ${S.view===id?'active':''}" data-act="view" data-val="${id}">${t}</button>`).join('');
}
function filteredStatements(){
  const q=S.q.toLowerCase();
  return DB.statements.filter(s => {
    if (S.person != null && s.personId !== S.person) return false;
    if (S.concept && !s.allTags.includes(S.concept)) return false;
    if (S.problem && !s.problems.includes(S.problem)) return false;
    if (S.relation !== 'all') { const rs=[...(DB.out[s.id]||[]),...(DB.in[s.id]||[])]; if (!rs.some(r=>r.type===S.relation)) return false; }
    return !q || s.search.includes(q);
  }).sort(sortFn);
}

function viewAtlas(){
  const st = filteredStatements();
  const concepts = counts(st.flatMap(s=>s.allTags)).slice(0,24).map(([name,count])=>({name,count}));
  const problems = counts(st.flatMap(s=>s.problems)).slice(0,16).map(([name,count])=>({name,count}));
  return `<div class="grid cols2"><div class="card"><div class="panelTitle"><div><h2>Relational map</h2><p>Chronology left to right. Domains are vertical bands. Blue supports; red opposes.</p></div>${sortTools()}</div><div class="graphBox"><svg id="graph"></svg></div></div><div class="grid"><div class="card"><h2>Concept density</h2><div class="heat">${heat(concepts,'concept')}</div></div><div class="card"><h2>Problem density</h2><div class="heat">${heat(problems,'problem')}</div></div></div><div style="grid-column:1/-1" class="grid cards">${st.slice(0,120).map(claimCard).join('') || empty('No postulates match.')}</div></div>`;
}
function heat(items, kind){
  const max = Math.max(1,...items.map(i=>i.count));
  return items.map(i => `<button data-act="filter" data-kind="${kind}" data-val="${esc(i.name)}"><b>${esc(kind==='concept'?pretty(i.name):i.name)}</b><p>${i.count} postulates</p><div class="bar"><i style="width:${Math.round(i.count/max*100)}%"></i></div></button>`).join('');
}
function sortTools(){ return `<div class="semantic"><button class="chip ${S.sort==='chrono'?'active':''}" data-act="sort" data-val="chrono">chrono</button><button class="chip ${S.sort==='author'?'active':''}" data-act="sort" data-val="author">author</button><button class="chip ${S.sort==='relations'?'active':''}" data-act="sort" data-val="relations">relations</button></div>`; }
function claimCard(s){
  const rels = [...(DB.out[s.id]||[]), ...(DB.in[s.id]||[])].slice(0,3);
  return `<article class="claim" data-act="statement" data-val="${s.id}"><div class="claimAuthor"><b>${esc(s.person)}</b><span>${esc(s.time)}</span><span>${esc(s.movement)}</span><span>${relCount(s.id)} links</span></div><div class="claimBody"><div class="claimText">${esc(s.text)}</div><div class="semantic">${domainMarks(s.categories)}${s.problems.slice(0,2).map(p=>`<span class="problem">${esc(shortProblem(p))}</span>`).join('')}${s.tags.slice(0,5).map(t=>`<span class="concept">${esc(pretty(t))}</span>`).join('')}</div><div class="gloss">${esc(s.gloss)}</div>${rels.map(r=>relLine(r,s.id)).join('')}</div></article>`;
}
function domainMarks(cats){ return cats.slice(0,2).map(c=>`<span class="domain"><i style="background:${CAT_COLOR[c]||'var(--muted)'}"></i>${esc(CAT_LABEL[c]||pretty(c))}</span>`).join(''); }
function relLine(r, focus){ const o = DB.statementsById[r.source === focus ? r.target : r.source]; return `<div class="rel ${r.type}" data-act="statement" data-val="${o.id}"><b>${r.type==='support' ? '+' : '−'}</b> ${esc(o.person)} (${esc(o.text)})</div>`; }
function pretty(s){ return String(s).replaceAll('_',' ').replaceAll('/',' · '); }
function shortProblem(p){ return String(p).replace('How should society be governed?','Society?').replace('How should one live?','Life?').replace('How can we know?','Knowledge?').replace('What does language mean?','Language?').replace('What does art do?','Art?').replace('What exists?','Being?').replace('What is time?','Time?').replace('What is God?','God?').replace('What is science?','Science?').replace('What is gender?','Gender?').replace('What is freedom?','Freedom?').replace('What is mind?','Mind?'); }
function empty(t){ return `<div class="empty">${esc(t)}</div>`; }

function viewIndex(){
  const type = S.indexType || 'concept';
  const list = type === 'concept' ? DB.concepts : DB.problems;
  const key = S.indexKey || (type === 'concept' ? S.concept : S.problem) || list[0]?.name;
  S.indexKey = key;
  return `<div class="indexLayout"><div class="indexColumn"><div class="card"><div class="semantic"><button class="chip ${type==='concept'?'active':''}" data-act="view" data-val="index" data-kind="concept">Concepts</button><button class="chip ${type==='problem'?'active':''}" data-act="view" data-val="index" data-kind="problem">Problems</button></div></div>${list.map(i=>indexItem(i,type,key)).join('')}</div><div class="grid">${indexDetail(type,key)}</div></div>`;
}
function indexItem(i,type,key){ return `<button class="indexItem ${key===i.name?'active':''}" data-act="index" data-kind="${type}" data-val="${esc(i.name)}"><b>${esc(type==='concept'?pretty(i.name):i.name)}</b><span>${i.count}</span></button>`; }
function indexDetail(type,key){
  const st = DB.statements.filter(s => type === 'concept' ? s.allTags.includes(key) : s.problems.includes(key)).sort(sortFn);
  const authorItems = counts(st.map(s=>s.person)).slice(0,24).map(([name,count])=>({name,count}));
  const adj = counts(st.flatMap(s => type === 'concept' ? s.problems : s.allTags)).slice(0,24).map(([name,count])=>({name,count}));
  const links = st.reduce((n,s)=>n+relCount(s.id),0);
  return `<div class="card"><div class="panelTitle"><div><h2>${esc(type==='concept'?pretty(key):key)}</h2><p>${st.length} postulates · ${authorItems.length} authors · ${links} local links. ${indexThesis(type,key,st)}</p></div>${sortTools()}</div></div><div class="grid cols2"><div class="card"><h2>Authors</h2><div class="heat">${heatPeople(authorItems)}</div></div><div class="card"><h2>${type==='concept'?'Adjacent problems':'Concept constellation'}</h2><div class="heat">${heat(adj,type==='concept'?'problem':'concept')}</div></div></div><div class="card"><h2>All authors / postulates</h2>${groupByAuthor(st)}</div>`;
}
function indexThesis(type,key,st){ const early=st[0], late=st[st.length-1], moves=uniq(st.map(s=>s.movement)).length; return `${type==='concept'?'Concept':'Problem'} route: ${early?early.person:'early'} → ${late?late.person:'late'}, across ${moves} movements.`; }
function heatPeople(items){
  const max=Math.max(1,...items.map(i=>i.count));
  return items.map(i=>{const p=DB.people.find(x=>x.name===i.name); return `<button data-act="person" data-val="${p?.id ?? ''}"><b>${esc(i.name)}</b><p>${i.count} postulates</p><div class="bar"><i style="width:${Math.round(i.count/max*100)}%"></i></div></button>`}).join('');
}
function groupByAuthor(st){
  const groups = Object.values(st.reduce((a,s)=>((a[s.person] ||= []).push(s),a),{})).sort((a,b)=>(a[0].year??0)-(b[0].year??0));
  return groups.map(g=>`<div class="group"><div class="groupHead"><b data-act="person" data-val="${g[0].personId}">${esc(g[0].person)}</b><span>${esc(g[0].time)} · ${g.length}</span></div><div class="postulates">${g.map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)}</div>`).join('')}</div></div>`).join('');
}

function viewRoutes(){
  const r = DB.routes.find(x=>x.id===S.route) || DB.routes[0];
  const st = r.ids.map(id=>DB.statementsById[id]).filter(Boolean).sort(sortFn);
  const authors = counts(st.map(s=>s.person)).slice(0,32).map(([name,count])=>({name,count}));
  return `<div class="grid"><div class="routeStrip">${DB.routes.map(x=>`<button class="routeCard ${x.id===r.id?'active':''}" data-act="route" data-val="${esc(x.id)}"><h2>${esc(x.title)}</h2><p>${esc(x.thesis)}</p><p>${x.ids.length} postulates</p></button>`).join('')}</div><div class="card"><div class="panelTitle"><div><h2>${esc(r.title)}</h2><p>${esc(r.thesis)}</p></div>${sortTools()}</div></div><div class="timeline">${authors.map(a=>routeAuthor(a,st)).join('')}</div><div class="grid cols2"><div class="card"><h2>Route concepts</h2><div class="heat">${heat(counts(st.flatMap(s=>s.allTags)).slice(0,24).map(([name,count])=>({name,count})),'concept')}</div></div><div class="card"><h2>Route problems</h2><div class="heat">${heat(counts(st.flatMap(s=>s.problems)).slice(0,18).map(([name,count])=>({name,count})),'problem')}</div></div></div><div class="card"><h2>All route postulates</h2>${groupByAuthor(st)}</div></div>`;
}
function routeAuthor(a,st){ const p=DB.people.find(x=>x.name===a.name), ss=st.filter(s=>s.person===a.name).slice(0,3); return `<div class="step"><h2 data-act="person" data-val="${p?.id ?? ''}">${esc(a.name)}</h2><p>${a.count} postulates</p>${ss.map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)}</div>`).join('')}</div>`; }

function viewThinkers(){
  const q=S.q.toLowerCase();
  const people = DB.people.filter(p => S.person == null || p.id === S.person).filter(p => !q || `${p.name} ${p.time} ${p.movement}`.toLowerCase().includes(q) || (DB.byPerson[p.id]||[]).some(s=>s.search.includes(q)));
  return `<div class="grid cards">${people.map(personCard).join('')}</div>`;
}
function personCard(p){
  const st=DB.byPerson[p.id]||[], tags=counts(st.flatMap(s=>s.allTags)).slice(0,10), probs=counts(st.flatMap(s=>s.problems)).slice(0,5);
  const out=DB.relations.filter(r=>DB.statementsById[r.source].personId===p.id).length, inn=DB.relations.filter(r=>DB.statementsById[r.target].personId===p.id).length;
  return `<div class="card"><div class="panelTitle"><div><h2 data-act="person" data-val="${p.id}">${esc(p.name)}</h2><p>${esc(p.time)} · ${esc(p.movement)}</p></div><button class="chip" data-act="compare" data-val="${p.id}">compare</button></div><div class="semantic">${tags.map(([t,c])=>`<span class="concept">${esc(pretty(t))} ${c}</span>`).join('')}</div><div class="semantic">${probs.map(([t,c])=>`<span class="problem">${esc(shortProblem(t))} ${c}</span>`).join('')}</div><p>${st.length} postulates · ${out} outgoing · ${inn} incoming</p><div class="postulates">${st.slice(0,10).map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)}</div>`).join('')}</div></div>`;
}
function viewGraph(){ return `<div class="card"><div class="panelTitle"><div><h2>Relation graph</h2><p>Use filters/search first, then inspect the local neighborhood by clicking nodes.</p></div>${sortTools()}</div><div class="graphBox"><svg id="graph"></svg></div></div>`; }
function viewTensions(){
  const q=S.q.toLowerCase(); let rels=DB.relations.filter(r=>r.type==='oppose');
  if (S.concept) rels=rels.filter(r=>DB.statementsById[r.source].allTags.includes(S.concept)||DB.statementsById[r.target].allTags.includes(S.concept));
  if (S.problem) rels=rels.filter(r=>DB.statementsById[r.source].problems.includes(S.problem)||DB.statementsById[r.target].problems.includes(S.problem));
  if (q) rels=rels.filter(r=>DB.statementsById[r.source].search.includes(q)||DB.statementsById[r.target].search.includes(q));
  return `<div class="grid cards">${rels.slice(0,160).map(r=>{const a=DB.statementsById[r.source], b=DB.statementsById[r.target]; return `<div class="card"><h2>${esc(a.person)} ↔ ${esc(b.person)}</h2><div class="rel oppose" data-act="statement" data-val="${a.id}"><b>A</b> ${esc(a.text)}</div><div class="rel oppose" data-act="statement" data-val="${b.id}"><b>B</b> ${esc(b.text)}</div><div class="semantic">${uniq([...a.allTags,...b.allTags]).slice(0,8).map(t=>`<span class="concept">${esc(pretty(t))}</span>`).join('')}</div></div>`}).join('') || empty('No tensions match.')}</div>`;
}
function addCompare(id){ if(!S.compare.includes(id)) S.compare.push(id); S.compare=S.compare.slice(-4); S.view='compare'; render(); }
function viewCompare(){
  const ids = S.compare.length ? S.compare : DB.people.slice(10,14).map(p=>p.id);
  const people = ids.map(id=>DB.peopleById[id]).filter(Boolean);
  return `<div class="grid"><div class="card"><h2>Compare workspace</h2><p>Add authors from any author/claim inspector. Compare concepts, problems, claims, and relation vectors.</p></div><div class="grid cols3">${people.map(compareColumn).join('')}</div><div class="card"><h2>Problem × author matrix</h2>${compareMatrix(people)}</div></div>`;
}
function compareColumn(p){
  const st=DB.byPerson[p.id]||[], tags=counts(st.flatMap(s=>s.allTags)).slice(0,12), probs=counts(st.flatMap(s=>s.problems)).slice(0,8);
  return `<div class="card"><div class="panelTitle"><div><h2>${esc(p.name)}</h2><p>${esc(p.time)}</p></div><button class="chip" data-act="dropCompare" data-val="${p.id}">remove</button></div><div class="semantic">${tags.map(([t,c])=>`<span class="concept">${esc(pretty(t))} ${c}</span>`).join('')}</div><div class="semantic">${probs.map(([t,c])=>`<span class="problem">${esc(shortProblem(t))} ${c}</span>`).join('')}</div><div class="postulates">${st.slice(0,12).map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)}</div>`).join('')}</div></div>`;
}
function compareMatrix(people){
  const probs=uniq(people.flatMap(p=>(DB.byPerson[p.id]||[]).flatMap(s=>s.problems))).slice(0,18);
  document.documentElement.style.setProperty('--cols', String(people.length));
  return `<div class="matrix"><div class="cell"></div>${people.map(p=>`<div class="cell"><b>${esc(p.name)}</b></div>`).join('')}${probs.map(pr=>`<div class="cell">${esc(shortProblem(pr))}</div>${people.map(p=>{const n=(DB.byPerson[p.id]||[]).filter(s=>s.problems.includes(pr)).length; return `<div class="cell ${n?'hot':''}" style="--p:${Math.min(80,n*16)}">${n||''}</div>`}).join('')}`).join('')}</div>`;
}
function viewUpload(){ return `<div class="card"><h2>Upload data</h2><p>Supports original Deniz JSON, enriched txt, and grouped/reflowed txt. Uploaded data replaces the current atlas locally.</p>${uploadBox()}</div>`; }

function drawGraph(){
  const svg=$('#graph'); if(!svg || !DB) return;
  const fs=filteredStatements().slice(0,240), ids=new Set(fs.map(s=>s.id));
  let rels=DB.relations.filter(r=>ids.has(r.source)&&ids.has(r.target)); if(S.relation!=='all') rels=rels.filter(r=>r.type===S.relation); rels=rels.slice(0,460);
  const w=svg.clientWidth||900, h=svg.clientHeight||480, years=DB.people.map(p=>p.year).filter(Number.isFinite), min=Math.min(...years), max=Math.max(...years), span=max-min||1;
  const band=Object.fromEntries(CAT_ORDER.map((c,i)=>[c,(i+1)/(CAT_ORDER.length+1)])); const pos={};
  fs.forEach((s,i)=>{const p=DB.peopleById[s.personId], x=32+(((p.year??0)-min)/span)*(w-64), y=(band[s.categories[0]]||.55)*h+((i%9)-4)*4.5; pos[s.id]=[clamp(x,18,w-18),clamp(y,18,h-18)];});
  const edges=rels.map(r=>{const a=pos[r.source], b=pos[r.target]; return a&&b?`<line class="edge ${r.type}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${r.type==='oppose'?1.45:1}"/>`:''}).join('');
  const nodes=fs.map(s=>{const [x,y]=pos[s.id], color=CAT_COLOR[s.categories[0]]||'var(--ink)'; return `<g class="node" data-act="statement" data-val="${s.id}"><circle cx="${x}" cy="${y}" r="${S.statement===s.id?6.5:4}" fill="${color}"><title>${esc(s.person)} — ${esc(s.text)}</title></circle></g>`}).join('');
  const labels=uniq(fs.map(s=>s.personId)).slice(0,72).map(id=>{const s=fs.find(x=>x.personId===id), p=pos[s.id]; return `<text class="svglabel" x="${p[0]+6}" y="${p[1]-6}">${esc(s.person)}</text>`}).join('');
  svg.innerHTML = edges + nodes + labels;
}

function inspectHome(){
  if (!DB) return;
  const hotConcepts = DB.concepts.slice(0,12), hotProblems = DB.problems.slice(0,8), tensions = DB.relations.filter(r=>r.type==='oppose').slice(0,4);
  $('#context').innerHTML = `<div class="contextStack"><div class="contextHero"><div class="big">Start anywhere.</div><p>Use this rail as orientation, not empty space: routes, dense concepts, recurring problems, and live tensions.</p></div><div class="card"><h2>Reading routes</h2><div class="semantic">${DB.routes.map(r=>`<button class="chip ${S.route===r.id?'active':''}" data-act="route" data-val="${esc(r.id)}">${esc(r.title)}</button>`).join('')}</div></div><div class="card"><h2>Dense concepts</h2><div class="semantic">${hotConcepts.map(c=>`<button class="chip" data-act="filter" data-kind="concept" data-val="${esc(c.name)}">${esc(pretty(c.name))} · ${c.count}</button>`).join('')}</div></div><div class="card"><h2>Core problems</h2><div class="semantic">${hotProblems.map(p=>`<button class="chip" data-act="filter" data-kind="problem" data-val="${esc(p.name)}">${esc(shortProblem(p.name))} · ${p.count}</button>`).join('')}</div></div><div class="card"><h2>Live tensions</h2>${tensions.map(r=>relPair(r)).join('')}</div>${uploadBox()}</div>`;
  attachUpload();
}
function relPair(r){ const a=DB.statementsById[r.source], b=DB.statementsById[r.target]; return `<div class="rel oppose" data-act="statement" data-val="${a.id}"><b>${esc(a.person)} / ${esc(b.person)}</b> ${esc(a.text)} ↔ ${esc(b.text)}</div>`; }
function inspectPerson(id){
  const p=DB.peopleById[id], st=DB.byPerson[id]||[], out=DB.relations.filter(r=>DB.statementsById[r.source].personId===id), inn=DB.relations.filter(r=>DB.statementsById[r.target].personId===id);
  $('#context').innerHTML = `<div class="contextStack"><div class="contextHero"><div class="big">${esc(p.name)}</div><p>${esc(p.time)} · ${esc(p.movement)}</p><p>${st.length} postulates · ${out.length} outgoing · ${inn.length} incoming</p><button class="chip" data-act="compare" data-val="${id}">Add to compare</button></div><div class="card"><h2>Concept signature</h2><div class="semantic">${counts(st.flatMap(s=>s.allTags)).slice(0,16).map(([t,c])=>`<button class="chip" data-act="filter" data-kind="concept" data-val="${esc(t)}">${esc(pretty(t))} · ${c}</button>`).join('')}</div></div><div class="card"><h2>Problem signature</h2><div class="semantic">${counts(st.flatMap(s=>s.problems)).slice(0,12).map(([t,c])=>`<button class="chip" data-act="filter" data-kind="problem" data-val="${esc(t)}">${esc(shortProblem(t))} · ${c}</button>`).join('')}</div></div><div class="card"><h2>Postulates</h2><div class="postulates">${st.slice(0,12).map(s=>`<div class="postulate" data-act="statement" data-val="${s.id}">${esc(s.text)}</div>`).join('')}</div></div></div>`;
}
function inspectStatement(id){
  const s=DB.statementsById[id]; if(!s) return;
  S.statement = id;
  const supports = [...(DB.out[id]||[]),...(DB.in[id]||[])].filter(r=>r.type==='support');
  const opposes = [...(DB.out[id]||[]),...(DB.in[id]||[])].filter(r=>r.type==='oppose');
  $('#context').innerHTML = `<div class="contextStack"><div class="contextHero"><div class="big">${esc(s.person)}</div><p>${esc(s.time)} · ${esc(s.movement)}</p><div class="claimText">${esc(s.text)}</div><p>${esc(s.gloss)}</p><button class="chip" data-act="compare" data-val="${s.personId}">Compare author</button></div><div class="card"><h2>Semantic profile</h2><div class="semantic">${domainMarks(s.categories)}${s.problems.map(p=>`<button class="problem" data-act="filter" data-kind="problem" data-val="${esc(p)}">${esc(shortProblem(p))}</button>`).join('')}${s.tags.map(t=>`<button class="concept" data-act="filter" data-kind="concept" data-val="${esc(t)}">${esc(pretty(t))}</button>`).join('')}</div></div><div class="card"><h2>Supports / influence</h2>${supports.map(r=>relLine(r,id)).join('') || '<p>None.</p>'}</div><div class="card"><h2>Opposition / tension</h2>${opposes.map(r=>relLine(r,id)).join('') || '<p>None.</p>'}</div></div>`;
}
function renderContextUpload(){ $('#context').innerHTML = uploadBox(); attachUpload(); }
function uploadBox(){ return `<div class="drop"><b>Upload data</b><p>Original JSON, enriched txt, or grouped txt.</p><input id="fileInput" type="file" accept=".json,.txt,application/json,text/plain"></div>`; }
function attachUpload(){
  const input=$('#fileInput'); if(!input) return;
  input.onchange=async e=>{ const f=e.target.files[0]; if(!f) return; const txt=await f.text(); try{ if(f.name.endsWith('.json')||txt.trim().startsWith('{')) setDB(buildDB(JSON.parse(txt))); else setDB(parseTxt(txt, f.name)); } catch(err){ alert('Could not parse: '+err.message); } };
}
function parseTxt(text,title='uploaded txt'){
  const people=[], statements=[], relations=[]; let current=null,last=null,pid=0,sid=0;
  const getP=(name,time='')=>{let p=people.find(x=>x.name===name); if(!p){p={id:pid++,name,time,loc:'',sortby:name,year:yearOf(time),movement:'uploaded/txt'};people.push(p)} return p};
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trimEnd(); if(!line || line.startsWith('#')) continue;
    const h=line.match(/^(.+?) - \[(.*?)\]$/); if(h){current=getP(h[1].trim(),h[2].trim()); continue;}
    if(/^- /.test(line)&&!/^\s+-/.test(line)){
      if(!current) current=getP('Uploaded'); const body=line.slice(2); const clean=body.split(/\s+#|\s+\(/)[0].trim();
      const tags=[...body.matchAll(/#([\w/-]+)/g)].map(m=>m[1].replaceAll('_','/')); const cats=tags.filter(t=>Object.values(CAT).includes(t)); const extra=tags.filter(t=>!cats.includes(t));
      const probs=[...body.matchAll(/\(([^)]*\?[^)]*)\)/g)].flatMap(m=>m[1].split('·').map(x=>x.trim())); const mv=(body.match(/@([\w/-]+)/)||[])[1]||current.movement;
      last={id:sid++,personId:current.id,person:current.name,time:current.time,year:current.year,loc:'',order:'',text:clean,reference:'',categories:cats,tags:extra,allTags:uniq([...cats,...extra]),problems:probs.length?probs:inferProblems(clean,cats,extra),movement:mv,gloss:(body.match(/\/\/\s*(.+)$/)||[])[1]||gloss(clean,cats,extra)};
      last.search=[last.text,last.person,last.movement,last.gloss,...last.allTags,...last.problems].join(' ').toLowerCase(); statements.push(last); continue;
    }
    if(last&&/^\s+- \(/.test(line)){ const m=line.match(/\(([^)]*\?[^)]*)\)(?:\s*\/\/\s*(.+))?/); if(m){last.problems=m[1].split('·').map(x=>x.trim()); if(m[2]) last.gloss=m[2].trim();} }
    if(last&&/^\s+- #/.test(line)){ const tags=[...line.matchAll(/#([\w/-]+)/g)].map(m=>m[1].replaceAll('_','/')); last.categories=tags.filter(t=>Object.values(CAT).includes(t)); last.tags=tags.filter(t=>!last.categories.includes(t)); last.allTags=uniq([...last.categories,...last.tags]); const mv=(line.match(/@([\w/-]+)/)||[])[1]; if(mv) last.movement=mv; }
    const r=line.match(/^\s+-\s*(?:\[([+-])\]|([+-]))\s*(.+?)(?::|\()\s*(.+?)\)?\.?\s*$/); if(last&&r){const sign=r[1]||r[2], person=r[3].trim(), txt=r[4].trim(); const target=statements.find(s=>s.person===person&&s.text.startsWith(txt.slice(0,35))); if(target) relations.push({id:relations.length,source:last.id,target:target.id,type:sign==='+'?'support':'oppose'});}
  }
  return finishDB({people,statements,relations,title});
}
