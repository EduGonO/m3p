'use strict';

const DATA_URLS = ['philosophers.json', '/philosophers.json'];
const CAT = { on:'ontology/metaphysics', ep:'epistemology', et:'ethics', po:'politics', ae:'aesthetics', th:'theology/religion' };
const CAT_LABEL = { 'ontology/metaphysics':'Ontology', epistemology:'Knowledge', ethics:'Ethics', politics:'Politics', aesthetics:'Art', 'theology/religion':'Theology' };
const CAT_COLOR = { 'ontology/metaphysics':'var(--brown)', epistemology:'var(--blue)', ethics:'var(--green)', politics:'var(--red)', aesthetics:'var(--violet)', 'theology/religion':'var(--gold)' };
const CAT_ORDER = Object.keys(CAT_LABEL);

const ROUTES = [
  {id:'time', title:'Time', icon:'◷', keys:['time','change','becoming','flux','eternal','duration','present','space'], arc:'cosmos → measure → inner time → condition → finitude'},
  {id:'limits', title:'Knowledge', icon:'○', keys:['knowledge','truth','certainty','doubt','experience','perception','logic','science','fallible','senses'], arc:'sense → proof → doubt → method → language → power'},
  {id:'art', title:'Art', icon:'◇', keys:['art','aesthetics','beauty','poetry','tragedy','representation','history','image','illusion'], arc:'imitation → beauty → judgment → critique → construction'},
  {id:'language', title:'Language', icon:'⌁', keys:['language','words','speech','writing','meaning','sign','reference','symbol','discourse'], arc:'names → signs → use → force → discourse'},
  {id:'power', title:'Power', icon:'□', keys:['power','government','state','law','society','rights','freedom','public','justice','authority'], arc:'law → sovereignty → rights → ideology → discipline'},
  {id:'gender', title:'Gender', icon:'◐', keys:['gender','women','woman','female','male','body','sex','identity','feminist'], arc:'nature → equality → body → discourse → performance'},
  {id:'god', title:'God', icon:'✶', keys:['god','religion','faith','soul','evil','divine','theology'], arc:'cause → guarantee → order → projection → critique'},
  {id:'mind', title:'Mind', icon:'◉', keys:['mind','body','soul','self','consciousness','experience','subject','psychology'], arc:'soul → subject → bundle → will → body → computation'}
];

const CHAPTERS = [
  {id:'origin', label:'origin', hint:'first principles', test:s => (s.year ?? 0) < -300},
  {id:'form', label:'form', hint:'classical system', test:s => (s.year ?? 0) >= -300 && (s.year ?? 0) < 500},
  {id:'faith', label:'faith', hint:'theological order', test:s => (s.year ?? 0) >= 500 && (s.year ?? 0) < 1500},
  {id:'subject', label:'subject', hint:'modern knower', test:s => (s.year ?? 0) >= 1500 && (s.year ?? 0) < 1800},
  {id:'history', label:'history', hint:'critique / becoming', test:s => (s.year ?? 0) >= 1800 && (s.year ?? 0) < 1900},
  {id:'language', label:'language', hint:'meaning / method', test:s => (s.year ?? 0) >= 1900 && (s.year ?? 0) < 1950},
  {id:'systems', label:'systems', hint:'power / identity', test:s => (s.year ?? 0) >= 1950}
];

const $ = (s, r=document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uniq = xs => [...new Set(xs.filter(Boolean))];
const count = xs => Object.entries(xs.reduce((a,x)=>(x&&(a[x]=(a[x]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

let DB = null;
let S = {
  view:'atlas', q:'', concept:null, question:null, domain:null, person:null,
  relation:'all', sort:'author', route:'time', rail:'concepts', inspect:null,
  expanded:new Set(), open:new Set()
};

boot();

async function boot(){
  injectPolishCSS();
  $('#q').addEventListener('input', e => { S.q = e.target.value.trim(); render(); });
  document.addEventListener('click', handleClick);
  try { setDB(buildDB(await loadJSON())); } catch(e) { $('#content').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function injectPolishCSS(){
  if(document.getElementById('claim-polish-css')) return;
  const style = document.createElement('style');
  style.id = 'claim-polish-css';
  style.textContent = `
    .line{grid-template-columns:minmax(0,1fr)!important;}
    .expanded{grid-column:1!important;margin:7px 0 0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;}
    .counts{appearance:none;border:1px solid transparent;background:transparent;border-radius:999px;padding:2px 5px;display:inline-flex;gap:5px;align-items:center;font:10px/1 var(--mono);transition:background .14s ease,border-color .14s ease,box-shadow .14s ease;}
    .counts:hover,.counts[aria-expanded=true]{border-color:color-mix(in srgb,var(--blue) 28%,var(--line));background:rgba(255,255,255,.20);box-shadow:0 6px 18px rgba(36,92,255,.06);}
    .author:hover,.clusterAuthor:hover{background:transparent!important;border-color:transparent!important;box-shadow:none!important;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:.08em;}
    .authorCluster{border-bottom:1px solid var(--hair);padding:9px 10px;}
    .authorCluster:last-child{border-bottom:0;}
    .clusterHead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;margin-bottom:6px;}
    .clusterAuthor{appearance:none;justify-self:start;max-width:100%;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;text-align:left;font-weight:720;font-size:12.5px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .clusterClaims{display:grid;gap:4px;margin-left:4px;padding-left:11px;border-left:1px solid var(--hair);}
    .clusterLine{display:block;width:100%;padding:6px 7px;border:1px solid transparent;border-radius:11px;background:transparent;text-align:left;transition:background .14s ease,border-color .14s ease,box-shadow .14s ease;}
    .clusterLine:hover{border-color:color-mix(in srgb,var(--blue) 30%,var(--line));background:rgba(255,255,255,.16);box-shadow:0 8px 22px rgba(36,92,255,.045);}
    .clusterLine .claimText{font-size:13px;line-height:1.36;}
    .clusterLine .meta{margin-top:5px;}
  `;
  document.head.appendChild(style);
}
async function loadJSON(){
  let err;
  for (const url of DATA_URLS) {
    try { const r = await fetch(url, {cache:'no-store'}); if(!r.ok) throw new Error(`${r.status} ${url}`); return await r.json(); }
    catch(e){ err=e; }
  }
  throw err || new Error('Missing philosophers.json');
}
function handleClick(e){
  const el = e.target.closest('[data-act]'); if(!el || !DB) return;
  e.stopPropagation();
  const {act,val,kind} = el.dataset;
  if(act==='theme'){ const app=$('#app'); app.dataset.theme = app.dataset_theme === 'dark' ? 'light' : 'dark'; return; }
  if(act==='reset'){ reset(); return; }
  if(act==='view'){ S.view=val; S.inspect=null; render(); return; }
  if(act==='rail'){ S.rail=val; render(); return; }
  if(act==='sort'){ S.sort=val; render(); return; }
  if(act==='relation'){ S.relation = S.relation===val && val!=='all' ? 'all' : val; render(); return; }
  if(act==='route'){ S.route=val; S.view='routes'; render(); return; }
  if(act==='filter'){ toggleFilter(kind,val); return; }
  if(act==='clear'){ clearFilter(val); return; }
  if(act==='expand'){ toggleExpand(Number(val)); return; }
  if(act==='inspectStatement'){ S.inspect={type:'statement', id:Number(val)}; renderInspector(); requestAnimationFrame(drawGraph); return; }
  if(act==='inspectPerson'){ S.inspect={type:'person', id:Number(val)}; renderInspector(); return; }
  if(act==='inspectConcept'){ S.inspect={type:'concept', id:val}; renderInspector(); return; }
  if(act==='inspectQuestion'){ S.inspect={type:'question', id:val}; renderInspector(); return; }
  if(act==='inspectDomain'){ S.inspect={type:'domain', id:val}; renderInspector(); return; }
  if(act==='accordion'){ toggleAccordion(val, el); }
}
function toggleFilter(kind,val){
  if(kind==='concept'){ S.concept = S.concept===val ? null : val; S.inspect = S.concept ? {type:'concept', id:val} : null; }
  if(kind==='question'){ S.question = S.question===val ? null : val; S.inspect = S.question ? {type:'question', id:val} : null; }
  if(kind==='domain'){ S.domain = S.domain===val ? null : val; S.inspect = S.domain ? {type:'domain', id:val} : null; }
  if(kind==='person'){ const id=Number(val); S.person = S.person===id ? null : id; S.inspect = S.person ? {type:'person', id:S.person} : null; }
  render();
}
function toggleExpand(id){ S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id); render(); }
function toggleAccordion(key, el){
  const body = document.querySelector(`[data-accordion-body="${CSS.escape(key)}"]`);
  if(!body) return;
  const open = body.hasAttribute('hidden');
  open ? body.removeAttribute('hidden') : body.setAttribute('hidden','');
  open ? S.open.add(key) : S.open.delete(key);
  el.setAttribute('aria-expanded', String(open));
}
function reset(){ S={...S,q:'',concept:null,question:null,domain:null,person:null,relation:'all',sort:'author',inspect:null,expanded:new Set(),open:new Set()}; $('#q').value=''; render(); }
function clearFilter(k){ if(k==='q'){S.q='';$('#q').value='';} else S[k]=null; if(S.inspect?.type===k || (k==='person'&&S.inspect?.type==='person')) S.inspect=null; render(); }

function buildDB(raw){
  if(!raw?.people || !raw?.records || !raw?.links) throw new Error('Invalid philosophers.json');
  const people = raw.people.map(p => ({...p, year:yearOf(p.time), movement:movementOf(p)}));
  const peopleById = Object.fromEntries(people.map(p => [p.id,p]));
  const statements = raw.records.map(r => {
    const p = peopleById[r.person] || {id:r.person,name:`Person ${r.person}`,time:'',movement:'unknown',year:null};
    const domains = (r.cats||[]).map(c => CAT[c] || c);
    const concepts = inferConcepts(r.line, domains);
    const questions = inferQuestions(r.line, domains, concepts);
    const s = {id:r.id, personId:r.person, person:p.name, time:p.time||'', year:p.year, order:r.order||'', text:r.line||'', reference:r.reference||'', domains, concepts, questions, movement:p.movement, summary:summaryFor(r.line, domains)};
    s.search = [s.text,s.person,s.time,s.movement,s.summary,...domains,...concepts,...questions].join(' ').toLowerCase();
    return s;
  });
  const byId = Object.fromEntries(statements.map(s => [s.id,s]));
  const relations = raw.links.filter(l=>byId[l.l0]&&byId[l.l1]).map((l,i)=>({id:i, source:l.l0, target:l.l1, type:l.type==='p'?'support':'challenge'}));
  const db = {people, statements, relations, peopleById, byId, byPerson:{}, out:{}, in:{}};
  statements.forEach(s => (db.byPerson[s.personId] ||= []).push(s));
  relations.forEach(r => { (db.out[r.source] ||= []).push(r); (db.in[r.target] ||= []).push(r); });
  db.concepts = count(statements.flatMap(s=>s.concepts)).map(([name,n])=>({name,count:n}));
  db.questions = count(statements.flatMap(s=>s.questions)).map(([name,n])=>({name,count:n}));
  db.domains = count(statements.flatMap(s=>s.domains)).map(([name,n])=>({name,count:n}));
  db.routes = ROUTES.map(r => ({...r, ids: statements.filter(s=>r.keys.some(k=>s.search.includes(k))).sort(sortChrono).map(s=>s.id)}));
  return db;
}
function setDB(db){ DB=db; $('#q').placeholder=`Search ${db.people.length} authors, ${db.statements.length} postulates, ${db.relations.length} links…`; render(); }

function yearOf(t=''){ const m=String(t).match(/\d+/); if(!m) return null; let y=Number(m[0]); return String(t).includes('BC') ? -y : y; }
function movementOf(p){ const n=p.name, y=yearOf(p.time); if(['Thales','Anaximander','Anaximenes'].includes(n))return'presocratic/cosmos'; if(n==='Pythagoras')return'number/form'; if(n==='Heraclitus')return'becoming'; if(['Parmenides','Zeno of Elea'].includes(n))return'being'; if(['Leucippus & Democritus','Epicurus'].includes(n))return'atomism'; if(n==='Socrates')return'ethics'; if(n==='Plato')return'forms'; if(n==='Aristotle')return'nature/system'; if(y<1700)return'early modern'; if(y<1800)return'enlightenment'; if(y<1870)return'history/critique'; if(y<1930)return'language/science'; return'contemporary'; }
function inferConcepts(text='',domains=[]){ const l=String(text).toLowerCase(), out=[]; const add=(c,rx)=>{if(rx.test(l))out.push(c)}; add('time',/\btime\b|timeless|eternal|present|duration|tempor/);add('change',/change|flux|becoming|evolv|process/);add('nature',/nature|natural|world|universe|earth|species/);add('matter',/matter|material|atom|particle|body|corporeal/);add('space',/space|location|world|universe/);add('mind',/mind|mental|conscious|intellect|thought|subject|awareness/);add('body',/body|corporeal|brain/);add('self',/self|subject|identity|person|soul/);add('reason',/reason|rational|logic|mathemat|proof|deduc/);add('experience',/experience|sens|observ|perception|empirical|impression/);add('knowledge',/knowledge|know|truth|certainty|doubt|belief/);add('truth',/truth|true|false|certainty|proof/);add('science',/science|scientific|experiment|method|hypothesis|theory/);add('language',/language|word|speech|writing|sign|symbol|meaning|reference|discourse/);add('art',/art|aesthetic|beauty|poetry|tragedy|image|representation|sublime|illusion/);add('history',/history|historical|past|civilization|tradition/);add('religion',/god|divine|religion|faith|soul|evil|theology/);add('morality',/moral|virtue|good|evil|right|wrong|duty/);add('justice',/justice|injustice|rights|law|equality|fair/);add('society',/society|social|community|public|private|civilization/);add('government',/government|state|authority|sovereign|law|politic|citizen/);add('power',/power|authority|dominat|control|discipline|govern/);add('freedom',/freedom|free|liberty|will|choice|necessity/);add('death',/death|mortality|die/);add('desire',/desire|passion|pleasure|emotion|fear|drive/);add('gender',/women|woman|female|male|gender|sex|femin/);add('math',/math|number|geometry|calculation/);add('causality',/cause|effect|causal|causation/); if(domains.includes('aesthetics'))out.push('art'); if(domains.includes('politics'))out.push('society','government'); if(domains.includes('theology/religion'))out.push('religion'); return uniq(out); }
function inferQuestions(line='',domains=[],concepts=[]){ const t=new Set(concepts), d=new Set(domains), out=[]; const add=x=>{if(!out.includes(x))out.push(x)}; if(d.has('ontology/metaphysics')||['nature','matter','space','mind','body','self','causality'].some(x=>t.has(x)))add('What exists?'); if(d.has('epistemology')||['knowledge','truth','reason','experience','science','language'].some(x=>t.has(x)))add('How can we know?'); if(d.has('ethics')||['morality','justice','death','desire','freedom'].some(x=>t.has(x)))add('How should one live?'); if(d.has('politics')||['society','government','power'].some(x=>t.has(x)))add('How should society be governed?'); if(d.has('aesthetics')||t.has('art'))add('What does art do?'); if(d.has('theology/religion')||t.has('religion'))add('What is God?'); if(t.has('time')||t.has('change'))add('What is time?'); if(t.has('language'))add('What does language mean?'); if(t.has('science'))add('What is science?'); if(t.has('gender'))add('What is gender?'); if(t.has('freedom'))add('What is freedom?'); if(t.has('mind'))add('What is mind?'); return out.length?out.slice(0,5):['What is at stake?']; }
function summaryFor(line='',domains=[]){ const l=String(line).toLowerCase(); for(const [rx,g] of [[/time|change|flux|becoming|eternal/,'becoming'],[/language|word|speech|sign|meaning|discourse/,'signs'],[/art|beauty|poetry|tragedy|image|illusion/,'representation'],[/science|experiment|method|theory/,'method'],[/gender|women|female|male|sex/,'identity'],[/government|state|power|law|society/,'order'],[/god|religion|faith|soul|evil/,'divinity'],[/reason|logic|math|proof/,'reason'],[/experience|sense|observ|perception/,'experience'],[/death|mortality/,'mortality'],[/freedom|liberty|will/,'freedom'],[/truth|certainty|doubt/,'truth'],[/nature|matter|atom/,'nature']]) if(rx.test(l)) return g; if(domains.includes('ethics'))return'life'; if(domains.includes('epistemology'))return'knowledge'; if(domains.includes('ontology/metaphysics'))return'being'; return'claim'; }
function sortChrono(a,b){ return (a.year??0)-(b.year??0)||a.person.localeCompare(b.person)||Number(a.order||0)-Number(b.order||0); }
function rels(id){ return [...(DB.out[id]||[]), ...(DB.in[id]||[])]; }
function supportCount(id){ return rels(id).filter(r=>r.type==='support').length; }
function challengeCount(id){ return rels(id).filter(r=>r.type==='challenge').length; }
function score(s){ return rels(s.id).length; }
function sorter(a,b){ if(S.sort==='author') return sortChrono(a,b); return sortChrono(a,b); }
function visible(){ const q=S.q.toLowerCase(); return DB.statements.filter(s=>{ if(S.person && s.personId!==S.person)return false; if(S.concept && !s.concepts.includes(S.concept))return false; if(S.question && !s.questions.includes(S.question))return false; if(S.domain && !s.domains.includes(S.domain))return false; if(S.relation!=='all' && !rels(s.id).some(r=>r.type===S.relation))return false; return !q || s.search.includes(q); }).sort(sorter); }
function matchesActive(s){ return (!S.concept||s.concepts.includes(S.concept))&&(!S.question||s.questions.includes(S.question))&&(!S.domain||s.domains.includes(S.domain))&&(!S.person||s.personId===S.person); }

function render(){ if(!DB)return; const st=visible(); renderRail(st); $('#content').innerHTML=({atlas:viewAtlas,read:viewRead,routes:viewRoutes,pressure:viewPressure}[S.view]||viewAtlas)(st); if(S.view==='atlas') requestAnimationFrame(drawGraph); renderInspector(st); }
function nav(){ return [['atlas','Atlas','·'],['read','Read','¶'],['routes','Routes','→'],['pressure','Pressure','±']].map(([id,t,ico])=>`<button class="nav ${S.view===id?'active':''}" data-act="view" data-val="${id}"><i>${ico}</i>${t}</button>`).join(''); }
function renderRail(st){ const filters=[]; if(S.q)filters.push(token('search',S.q,'q')); if(S.person)filters.push(token('author',DB.peopleById[S.person]?.name,'person')); if(S.concept)filters.push(token('concept',pretty(S.concept),'concept')); if(S.question)filters.push(token('question',S.question,'question')); if(S.domain)filters.push(token('domain',CAT_LABEL[S.domain]||pretty(S.domain),'domain')); $('#rail').innerHTML=`<div class="section"><div class="label">Navigate</div><div class="navGrid">${nav()}</div></div><div class="section"><div class="subLabel">Controls</div><div class="tabs"><button class="chip" data-act="theme">Theme</button><button class="chip" data-act="reset">Reset</button></div></div><div class="section"><div class="subLabel">Filters</div><div class="tokens">${filters.join('')||'<span class="subLabel">none</span>'}</div><div class="tabs" style="margin-top:7px"><button class="chip ${S.relation==='all'?'active':''}" data-act="relation" data-val="all">all</button><button class="chip ${S.relation==='support'?'active':''}" data-act="relation" data-val="support">+ only</button><button class="chip ${S.relation==='challenge'?'active':''}" data-act="relation" data-val="challenge">− only</button></div></div><div class="section"><div class="subLabel">Sort</div><div class="tabs"><button class="chip ${S.sort==='author'?'active':''}" data-act="sort" data-val="author">author</button><button class="chip ${S.sort==='time'?'active':''}" data-act="sort" data-val="time">time</button><button class="chip ${S.sort==='era'?'active':''}" data-act="sort" data-val="era">era</button></div></div><div class="section"><div class="subLabel">Browse</div><div class="tabs"><button class="chip ${S.rail==='concepts'?'active':''}" data-act="rail" data-val="concepts">concepts</button><button class="chip ${S.rail==='questions'?'active':''}" data-act="rail" data-val="questions">questions</button><button class="chip ${S.rail==='domains'?'active':''}" data-act="rail" data-val="domains">domains</button><button class="chip ${S.rail==='authors'?'active':''}" data-act="rail" data-val="authors">authors</button></div></div>${railList(st)}`; }
function token(label,val,key){ return `<button class="token" data-act="clear" data-val="${key}"><b>${esc(label)} · ${esc(val)}</b><span>×</span></button>`; }
function railList(st){ if(S.rail==='concepts')return list('Concepts', count(st.flatMap(s=>s.concepts)).slice(0,36).map(([n,c])=>row(pretty(n),c,'concept',n))); if(S.rail==='questions')return list('Questions', count(st.flatMap(s=>s.questions)).slice(0,28).map(([n,c])=>row(n,c,'question',n))); if(S.rail==='domains')return list('Domains', DB.domains.map(d=>row(CAT_LABEL[d.name]||pretty(d.name),d.count,'domain',d.name))); return list('Authors', count(st.map(s=>s.person)).slice(0,32).map(([n,c])=>{const p=DB.people.find(x=>x.name===n); return row(n,c,'person',p?.id)})); }
function list(title, rows){ return `<div class="section"><div class="subLabel">${esc(title)}</div><div class="list">${rows.join('')}</div></div>`; }
function row(label,n,kind,val){ const active=(kind==='person'&&S.person===Number(val))||(kind==='concept'&&S.concept===val)||(kind==='question'&&S.question===val)||(kind==='domain'&&S.domain===val); return `<button class="row ${active?'active':''}" data-act="filter" data-kind="${kind}" data-val="${esc(val)}"><b>${esc(label)}</b><span>${n}</span></button>`; }

function viewAtlas(st){ return `<div class="graph"><svg id="graph"></svg></div>${outline(groupByPeriod(st.slice(0,120)))}`; }
function viewRead(st){ if(S.person) return authorView(DB.peopleById[S.person], st); return outline(groupForRead(st)); }
function viewPressure(st){ const ranked=[...st].sort((a,b)=>score(b)-score(a)||sortChrono(a,b)).slice(0,160); return outline([{title:'±', meta:`${ranked.length}`, items:ranked}], {variant:'pressure'}); }
function viewRoutes(){ const r=DB.routes.find(x=>x.id===S.route)||DB.routes[0]; const st=r.ids.map(id=>DB.byId[id]).filter(matchesActive).sort(sortChrono); const groups=CHAPTERS.map(ch=>({title:ch.label, meta:`${ch.hint} · ${st.filter(ch.test).length}`, items:st.filter(ch.test)})).filter(g=>g.items.length); return `<div class="hero"><div class="tabs">${DB.routes.map(x=>`<button class="chip ${x.id===r.id?'active':''}" data-act="route" data-val="${x.id}">${esc(x.icon)} ${esc(x.title)}</button>`).join('')}</div><p style="margin-top:8px">${esc(r.arc)} · ${st.length}</p></div><div class="chapters">${groups.map(g=>`<section class="chapter"><div class="chapterTitle"><b>${esc(g.title)}</b><span>${esc(g.meta)}</span></div>${renderRuns(g.items.slice(0,18), {variant:'route'})}</section>`).join('')}</div>`; }
function authorView(p, st){ const groups = count(st.flatMap(s=>s.domains)).map(([d])=>({title:CAT_LABEL[d]||pretty(d), meta:d, items:st.filter(s=>s.domains.includes(d))})); return `<div class="hero"><div class="heroTop"><h2>${esc(p.name)}</h2><span class="date">${esc(p.time)}</span></div><p>${esc(p.movement)} · ${st.length} claims · ${count(st.flatMap(s=>s.concepts)).slice(0,4).map(([x])=>pretty(x)).join(' · ')}</p></div>${outline(groups)}`; }
function groupForRead(st){ if(S.sort==='era') return groupByPeriod(st); if(S.sort==='time') return [{title:'time', meta:`${st.length}`, items:[...st].sort(sortChrono)}]; return groupByAuthor(st); }
function groupByAuthor(st){ return Object.values(st.reduce((a,s)=>((a[s.personId]||=[]).push(s),a),{})).sort((a,b)=>sortChrono(a[0],b[0])).map(g=>({title:g[0].person, meta:g[0].time, personId:g[0].personId, items:g.sort(sortChrono)})); }
function groupByPeriod(st){ return CHAPTERS.map(ch=>({title:ch.label, meta:`${ch.hint}`, items:st.filter(ch.test).sort(sortChrono)})).filter(g=>g.items.length); }
function groupTitle(g){ return g.personId ? `<button class="clusterAuthor" data-act="inspectPerson" data-val="${g.personId}">${esc(g.title)}</button>` : `<b>${esc(g.title)}</b>`; }
function outline(groups, opts={}){ return `<div class="outline">${groups.map(g=>`<section class="group"><div class="groupHead">${groupTitle(g)}<span class="count">${esc(g.meta || '')}</span></div>${renderRuns(g.items, opts)}</section>`).join('') || empty('No postulates match.')}</div>`; }
function renderRuns(items, opts={}){
  const runs=[];
  for(const s of items){
    const last=runs[runs.length-1];
    if(last && last[0].personId===s.personId) last.push(s); else runs.push([s]);
  }
  return runs.map(run => run.length>1 ? authorCluster(run, opts) : claimLine(run[0], opts)).join('');
}
function authorCluster(run, opts={}){
  const first=run[0];
  return `<section class="authorCluster"><div class="clusterHead"><button class="clusterAuthor" data-act="inspectPerson" data-val="${first.personId}">${esc(first.person)}</button><span class="date">${esc(first.time)}</span></div><div class="clusterClaims">${run.map(s=>clusterLine(s, opts)).join('')}</div></section>`;
}
function clusterLine(s, opts={}){
  const expanded=S.expanded.has(s.id);
  return `<article class="clusterLine" data-act="inspectStatement" data-val="${s.id}"><div class="claimText">${esc(s.text)}</div><div class="meta">${semanticLine(s)}${opts.variant==='pressure'?`<span class="mono">${score(s)} links</span>`:''}</div>${expanded?expandedBlock(s):''}</article>`;
}
function claimLine(s, opts={}){ const expanded=S.expanded.has(s.id); return `<article class="line" data-act="inspectStatement" data-val="${s.id}"><div class="lineMain"><div class="lineTop"><button class="author" data-act="inspectPerson" data-val="${s.personId}">${esc(s.person)}</button><span class="date">${esc(s.time)}</span></div><div class="claimText">${esc(s.text)}</div><div class="meta">${semanticLine(s)}${opts.variant==='pressure'?`<span class="mono">${score(s)} links</span>`:''}</div>${expanded?expandedBlock(s):''}</div></article>`; }
function expandedBlock(s){ const links=rels(s.id).slice(0,12); return `<div class="expanded"><div class="relList">${links.map(r=>relation(r,s.id)).join('') || '<p>no links</p>'}</div></div>`; }
function semanticLine(s){ const expanded=S.expanded.has(s.id); const ds=s.domains.slice(0,1).map(d=>domain(d,true)).join(''); const cs=s.concepts.slice(0,3).map(c=>`<button class="mono inspectable" data-act="inspectConcept" data-val="${esc(c)}">${esc(pretty(c))}</button>`).join(''); return `${ds}${cs}<button class="counts" data-act="expand" data-val="${s.id}" aria-expanded="${expanded}" title="${expanded?'Collapse links':'Expand links'}"><span class="plus">+${supportCount(s.id)}</span><span class="minus">−${challengeCount(s.id)}</span></button>`; }
function relBadgeText(s){ return `+${supportCount(s.id)} −${challengeCount(s.id)}`; }
function relation(r,focus){ const o=DB.byId[r.source===focus?r.target:r.source]; return `<button class="rel ${r.type}" data-act="inspectStatement" data-val="${o.id}"><span class="mark">${r.type==='support'?'+':'−'}</span><span><b>${esc(o.person)}</b> — ${esc(o.text)}</span></button>`; }
function domain(d,click=false){ return `<${click?'button':'span'} class="domain inspectable" ${click?`data-act="inspectDomain" data-val="${esc(d)}"`:''}><i style="background:${CAT_COLOR[d]||'var(--muted)'}"></i>${esc(CAT_LABEL[d]||pretty(d))}</${click?'button':'span'}>`; }
function pretty(s){ return String(s).replaceAll('_',' ').replaceAll('/',' · '); }
function empty(t){ return `<div class="empty">${esc(t)}</div>`; }

function drawGraph(){ const svg=$('.graph svg'); if(!svg)return; const st=visible().slice(0,240), ids=new Set(st.map(s=>s.id)); let rs=DB.relations.filter(r=>ids.has(r.source)&&ids.has(r.target)); if(S.relation!=='all')rs=rs.filter(r=>r.type===S.relation); const w=svg.clientWidth||900,h=svg.clientHeight||410, years=DB.people.map(p=>p.year).filter(Number.isFinite), min=Math.min(...years), max=Math.max(...years), span=max-min||1, bands=Object.fromEntries(CAT_ORDER.map((c,i)=>[c,(i+1)/(CAT_ORDER.length+1)])), pos={}; st.forEach((s,i)=>{const x=32+(((s.year??0)-min)/span)*(w-64), y=(bands[s.domains[0]]||.55)*h+((i%9)-4)*4.4; pos[s.id]=[clamp(x,18,w-18),clamp(y,18,h-18)];}); svg.innerHTML=rs.slice(0,460).map(r=>{const a=pos[r.source],b=pos[r.target];return a&&b?`<line class="edge ${r.type}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`:''}).join('')+st.map(s=>{const [x,y]=pos[s.id]; return `<g data-act="inspectStatement" data-val="${s.id}"><circle cx="${x}" cy="${y}" r="${S.inspect?.type==='statement'&&S.inspect.id===s.id?6.5:4}" fill="${CAT_COLOR[s.domains[0]]||'var(--ink)'}"><title>${esc(s.person)} — ${esc(s.text)}</title></circle></g>`;}).join('')+uniq(st.map(s=>s.personId)).slice(0,70).map(id=>{const s=st.find(x=>x.personId===id),p=pos[s.id]; return `<text class="svglabel" x="${p[0]+6}" y="${p[1]-6}">${esc(s.person)}</text>`;}).join(''); }

function renderInspector(st=visible()){
  if(!S.inspect) return inspectOverview(st);
  if(S.inspect.type==='statement') return inspectStatement(S.inspect.id);
  if(S.inspect.type==='person') return inspectPerson(S.inspect.id);
  if(S.inspect.type==='concept') return inspectConcept(S.inspect.id);
  if(S.inspect.type==='question') return inspectQuestion(S.inspect.id);
  if(S.inspect.type==='domain') return inspectDomain(S.inspect.id);
}
function inspectOverview(st){ $('#context').innerHTML=`<div class="card"><div class="subLabel">Now</div><div class="miniGrid"><div class="stat"><b>${st.length}</b><span>claims</span></div><div class="stat"><b>${count(st.map(s=>s.person)).length}</b><span>authors</span></div><div class="stat"><b>${count(st.flatMap(s=>s.concepts)).length}</b><span>ideas</span></div><div class="stat"><b>${st.reduce((a,s)=>a+score(s),0)}</b><span>links</span></div></div></div>`; }
function inspectPerson(id){ const p=DB.peopleById[id], st=(DB.byPerson[id]||[]).filter(matchesActive); $('#context').innerHTML=`<div class="card"><div class="lineTop"><h3>${esc(p.name)}</h3><span class="date">${esc(p.time)}</span></div><p>${esc(p.movement)} · ${st.length}</p><div class="meta">${count(st.flatMap(s=>s.concepts)).slice(0,6).map(([c])=>`<button class="mono inspectable" data-act="inspectConcept" data-val="${esc(c)}">${esc(pretty(c))}</button>`).join('')}</div></div><div class="card" style="margin-top:10px"><div class="subLabel">Claims</div><div class="postulates">${st.slice(0,20).map(s=>`<button class="postulate" data-act="inspectStatement" data-val="${s.id}">${esc(s.text)}</button>`).join('')}</div></div>`; }
function inspectStatement(id){ const s=DB.byId[id]; if(!s)return; const links=rels(id); $('#context').innerHTML=`<div class="card"><div class="lineTop"><h3>${esc(s.person)}</h3><span class="date">${esc(s.time)} ${relBadgeText(s)}</span></div><p>${esc(s.summary)} · ${esc(s.movement)}</p><div class="claimText" style="margin-top:8px">${esc(s.text)}</div><div class="meta">${s.domains.map(d=>domain(d,true)).join('')}${s.concepts.map(c=>`<button class="mono inspectable" data-act="inspectConcept" data-val="${esc(c)}">${esc(pretty(c))}</button>`).join('')}${s.questions.slice(0,3).map(q=>`<button class="question inspectable" data-act="inspectQuestion" data-val="${esc(q)}">${esc(q)}</button>`).join('')}</div><div class="relStack relList">${links.map(r=>relation(r,id)).join('') || '<p>None.</p>'}</div></div>`; }
function accordion(key,title,countText,body,openDefault=false){ const open=S.open.has(key)||openDefault; return `<div class="accordion"><button class="accordionHead" data-act="accordion" data-val="${esc(key)}" aria-expanded="${open}"><b>${esc(title)}</b><span class="date">${esc(countText)}</span></button><div class="accordionBody" data-accordion-body="${esc(key)}" ${open?'':'hidden'}>${body}</div></div>`; }
function collapsible(st,prefix){ const groups=groupByAuthor(st); return groups.map((g,i)=>accordion(`${prefix}:${g.items[0].personId}`, g.title, g.meta, `<div class="postulates">${g.items.map(s=>`<button class="postulate" data-act="inspectStatement" data-val="${s.id}">${esc(s.text)}</button>`).join('')}</div>`, i===0)).join(''); }
function inspectConcept(name){ const st=DB.statements.filter(s=>s.concepts.includes(name)); $('#context').innerHTML=`<div class="card"><div class="lineTop"><h3>${esc(pretty(name))}</h3><span class="date">${st.length}</span></div><p>${conceptArc(st)}</p><div class="meta">${count(st.flatMap(s=>s.concepts)).filter(([x])=>x!==name).slice(0,6).map(([c])=>`<button class="mono inspectable" data-act="inspectConcept" data-val="${esc(c)}">${esc(pretty(c))}</button>`).join('')}</div></div><div class="card" style="margin-top:10px"><div class="subLabel">Authors</div>${collapsible(st, `concept:${name}`)}</div>`; }
function inspectQuestion(name){ const st=DB.statements.filter(s=>s.questions.includes(name)); $('#context').innerHTML=`<div class="card"><div class="lineTop"><h3>${esc(name)}</h3><span class="date">${st.length}</span></div><p>${count(st.map(s=>s.person)).length} authors · ${count(st.flatMap(s=>s.concepts)).length} ideas</p><div class="meta">${count(st.flatMap(s=>s.concepts)).slice(0,6).map(([c])=>`<button class="mono inspectable" data-act="inspectConcept" data-val="${esc(c)}">${esc(pretty(c))}</button>`).join('')}</div></div><div class="card" style="margin-top:10px"><div class="subLabel">Authors</div>${collapsible(st, `question:${name}`)}</div>`; }
function inspectDomain(name){ const st=DB.statements.filter(s=>s.domains.includes(name)); $('#context').innerHTML=`<div class="card"><div class="lineTop"><h3>${esc(CAT_LABEL[name]||pretty(name))}</h3><span class="date">${st.length}</span></div><p>${count(st.map(s=>s.person)).length} authors</p><div class="meta">${count(st.flatMap(s=>s.concepts)).slice(0,8).map(([c])=>`<button class="mono inspectable" data-act="inspectConcept" data-val="${esc(c)}">${esc(pretty(c))}</button>`).join('')}</div></div><div class="card" style="margin-top:10px"><div class="subLabel">Authors</div>${collapsible(st, `domain:${name}`)}</div>`; }
function conceptArc(st){ const years=st.map(s=>s.year).filter(Number.isFinite); const a=st[0]?.person||'early', b=st[st.length-1]?.person||'late'; return `${a} → ${b} · ${count(st.map(s=>s.person)).length} authors · ${years.length?Math.min(...years)+' / '+Math.max(...years):''}`; }
