(function(){
const $ = s => document.getElementById(s);
const esc = x => String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const GCOLOR = {pokemon:'#ffcb05',onepiece:'#e10600',mtg:'#ff8c42',lorcana:'#19b5e0',yugioh:'#8b2be2'};
const ERRS=[]; const ERR=e=>{ERRS.push(String(e&&e.message||e)); try{console.error(e)}catch(_){}};

function ago(u){
  const m=Math.max(0,Math.round((Date.now()-Date.parse(u))/60000));
  return m<60?m+'m ago':m<1440?Math.floor(m/60)+'h ago':Math.floor(m/1440)+'d ago';
}
function ict(u){
  return new Date(Date.parse(u)+7*3600e3).toISOString().replace('T',' ').slice(0,16)+' ICT';
}
function money(v){
  if(v==null||v==='') return '—';
  const n=+v; if(!isFinite(n)) return esc(v);
  return n>=100 ? '$'+Math.round(n).toLocaleString('en-US') : '$'+n.toFixed(2);
}

/* Original 16×16 pixel icons — geometric shapes, not copied sprites. */
function icon(id){
  const px=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  let body='';
  if(id==='pokemon'){
    body = px(5,1,6,3,'#ee1515')+px(3,3,2,3,'#ee1515')+px(11,3,2,3,'#ee1515')+
           px(5,12,6,3,'#fff7d6')+px(3,10,2,3,'#fff7d6')+px(11,10,2,3,'#fff7d6')+
           px(2,7,12,2,'#1a1530')+px(6,6,4,4,'#1a1530')+px(7,7,2,2,'#fff7d6');
  } else if(id==='onepiece'){
    // straw hat: brim + crown + a red band
    body = px(1,9,14,2,'#e4b84a')+px(4,4,8,6,'#f0c85a')+px(3,8,10,2,'#e10600')+px(6,3,4,2,'#f0c85a');
  } else if(id==='mtg'){
    // five-point spark / gem (not a mana symbol copy)
    body = px(7,1,2,4,'#ff8c42')+px(7,11,2,4,'#ff8c42')+px(1,7,4,2,'#ff8c42')+px(11,7,4,2,'#ff8c42')+
           px(4,4,2,2,'#ffd19a')+px(10,4,2,2,'#ffd19a')+px(4,10,2,2,'#ffd19a')+px(10,10,2,2,'#ffd19a')+
           px(6,6,4,4,'#fff7d6')+px(7,7,2,2,'#ff8c42');
  } else if(id==='lorcana'){
    // ink bottle with a glow drop
    body = px(6,1,4,2,'#19b5e0')+px(5,3,6,2,'#1a1530')+px(4,5,8,8,'#19b5e0')+px(5,6,6,5,'#0a4a5c')+
           px(7,8,2,2,'#fff')+px(7,13,2,2,'#7c4dff');
  } else if(id==='yugioh'){
    // stylized card with a geometric eye
    body = px(3,1,10,14,'#fff7d6')+px(3,1,10,2,'#8b2be2')+px(3,13,10,2,'#8b2be2')+
           px(5,5,6,2,'#1a1530')+px(6,7,4,3,'#8b2be2')+px(7,8,2,1,'#fff')+px(4,11,8,1,'#1a1530');
  }
  return `<svg class="icon" viewBox="0 0 16 16" width="24" height="24" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}

function pixelGauge(score, maxW){
  const bands=[[24,'#ff4d4d'],[44,'#ff6a1c'],[55,'#ffcf33'],[75,'#c6e01a'],[100,'#19e07a']];
  const cx=100, cy=104, r=70;
  let ticks='';
  for(let i=0;i<20;i++){
    const p0=i*5, p1=(i+1)*5;
    const col=(bands.find(b=>p1<=b[0])||bands[bands.length-1])[1];
    const a0=Math.PI*(1-p0/100), a1=Math.PI*(1-p1/100);
    const x0=cx+r*Math.cos(a0), y0=cy-r*Math.sin(a0);
    const x1=cx+r*Math.cos(a1), y1=cy-r*Math.sin(a1);
    ticks+=`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${col}" stroke-width="16" stroke-linecap="butt"/>`;
  }
  // chunky needle
  return `<svg class="gauge" viewBox="0 0 200 122" style="max-width:${maxW||360}px" shape-rendering="crispEdges">
    <rect x="8" y="14" width="184" height="100" fill="#0b1d12"/>
    ${ticks}
    <rect class="needle-box" data-s="${score}" x="94" y="28" width="12" height="76" fill="#fff7d6" stroke="#1a1530" stroke-width="3"
      style="transform-origin:100px 104px;transition:transform 1.2s steps(12)"/>
    <rect x="90" y="96" width="20" height="12" fill="#fff7d6" stroke="#1a1530" stroke-width="3"/>
  </svg>`;
}

function hpBar(score, band, color){
  const s=Math.max(0,Math.min(100,+score||0));
  return `<div class="hprow"><div class="hp"><div class="hp-well"><b class="hp-pin" data-left="${s}" style="left:${s}%"></b></div></div>
    <div class="hp-meta" style="color:${color||'#1a1530'}">${Math.round(s)} ${esc((band||'').split(' ').pop()||'')}</div></div>`;
}

function spark(pts, color){
  if(!pts||!pts.length) return '';
  const W=220,H=56,p=4;
  const vals=pts.map(x=>x.v);
  const mx=Math.max(...vals,1), mn=0;
  const x=i=>p+i*(W-2*p)/Math.max(1,pts.length-1);
  const y=v=>p+(mx===mn?H/2:(mx-v)/(mx-mn)*(H-2*p));
  let d=pts.map((pt,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(pt.v).toFixed(1)).join(' ');
  const last=pts[pts.length-1].v;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="3"/>
    <rect x="${x(pts.length-1)-2}" y="${y(last)-2}" width="4" height="4" fill="${color}"/></svg>`;
}

function seriesFor(D, mode){
  if(mode==='trends' && D.trends && D.trends.status==='ok' && D.trends.series)
    return {series:D.trends.series, indexed:false, label:D.trends.source, note:D.trends.note};
  const raw=(D.wiki&&D.wiki.series)||{};
  const indexed={};
  (D.games||[]).forEach(g=>{
    const pts=raw[g.id]||[];
    const mx=Math.max(1,...pts.map(p=>p.v));
    indexed[g.id]=pts.map(p=>({d:p.d,v:p.v/mx*100,raw:p.v}));
  });
  return {series:indexed, indexed:true, label:(D.wiki&&D.wiki.source)||'Wikipedia pageviews',
    note:'English Wikipedia daily pageviews, each line indexed to that game’s own 90-day peak (not Google search interest).'};
}

function interestChart(D, mode){
  const pack=seriesFor(D, mode);
  const games=D.games||[];
  let dates=[];
  games.forEach(g=>{const pts=pack.series[g.id]||[]; if(pts.length>dates.length) dates=pts.map(p=>p.d)});
  if(!dates.length) return '<div class=r>No series available.</div>';
  const W=640,H=220,L=36,R=12,T=12,B=28;
  const x=i=>L+i*(W-L-R)/Math.max(1,dates.length-1);
  const y=v=>T+(100-v)/100*(H-T-B);
  let grid='';
  for(let k=0;k<=4;k++){
    const v=k*25;
    grid+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#1e4a2a"/><text x="4" y="${y(v)+3}" fill="#9dffb0" font-size="11">${v}</text>`;
  }
  let months='';
  dates.forEach((d,i)=>{
    if(i&&d.slice(5,7)!==dates[i-1].slice(5,7)){
      months+=`<text x="${x(i)}" y="${H-6}" fill="#9dffb0" font-size="11" text-anchor="middle">${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+d.slice(5,7)-1]}</text>
        <line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H-B}" stroke="#16331c"/>`;
    }
  });
  let paths='';
  games.forEach(g=>{
    const pts=pack.series[g.id]||[];
    if(!pts.length) return;
    const d=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.v).toFixed(1)).join(' ');
    paths+=`<path d="${d}" fill="none" stroke="${GCOLOR[g.id]}" stroke-width="2.5"/>`;
  });
  const legend=games.map(g=>`<span><i style="background:${GCOLOR[g.id]}"></i>${esc(g.short)}</span>`).join('');
  return `<div class="lcd"><div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" font-family="VT323,monospace">${grid}${months}${paths}</svg></div>
    <div class="legend">${legend}</div></div>`;
}

function currentTheme(){ return localStorage.getItem('tcg-theme')||'pixel'; }
function applyTheme(t){
  const css=$('themeCss');
  if(css) css.href = t==='foil' ? 'foil.css' : 'styles.css';
  document.body.dataset.theme=t;
  document.body.classList.toggle('theme-foil', t==='foil');
  const b=$('themeBtn');
  if(b) b.textContent = t==='pixel' ? 'FOIL THEME' : 'PIXEL THEME';
  localStorage.setItem('tcg-theme', t);
}

function render(D){
  try{ $('asof').textContent = 'As of '+ (D.asOfIct || ict(D.asOf)); }catch(e){ERR(e)}

  const fg=D.fearGreed||{}, games=D.games||[], gfg=fg.games||{};
  const moves=D.marketMoves||{};
  const trendsOk=D.trends&&D.trends.status==='ok';

  try{
    const bits=[];
    bits.push(`<span><b>OVERALL</b> ${fg.overall} <span class="${fg.overall>=56?'up':fg.overall<=44?'dn':''}">${esc(fg.overallBand)}</span></span>`);
    games.forEach(g=>{
      const s=gfg[g.id]||{};
      const mv=moves[g.id];
      const ch=typeof mv==='number'?(mv>0?'+':'')+mv+'% mo':'';
      bits.push(`<span><b>${esc(g.short.toUpperCase())}</b> ${s.score} <span class="${s.score>=56?'up':s.score<=44?'dn':''}">${esc(s.band||'')}</span> ${ch?`<span class="${mv>0?'up':mv<0?'dn':'zero'}">${ch}</span>`:''}</span>`);
    });
    const t=bits.join('');
    $('tick').innerHTML=t+t;
  }catch(e){ERR(e)}

  let h='';

  try{
    const it=(D.news&&D.news.items)||[];
    const names=Object.fromEntries(games.map(g=>[g.id,g.short]));
    const LIN=x=>`<li><a href="${esc(x.link)}" target="_blank" rel="noopener"><div class="tt">${esc(x.title)}</div>
      <div class="mt">${x.highlight?'<span class="chip br">HIGHLIGHT</span>':''}${x.breaking?'<span class="chip br">NEW</span>':''}
      <span class="chip g-${esc(x.game)}">${esc(names[x.game]||x.game)}</span>
      <span>${esc(x.source)}</span><span>${ago(x.utc)} · ${ict(x.utc)}</span></div></a></li>`;
    h+=`<section class="card wide" id="news"><h2><span class="bkh"><i class="dot"></i>TOP HIGHLIGHTS</span>
      <span class="r">updated ${D.news&&D.news.updated?ict(D.news.updated):''}</span></h2>
      <ul class="nw">${it.slice(0,6).map(LIN).join('')}</ul>
      ${it.length>6?`<div class="more" id="nmore"><ul class="nw">${it.slice(6).map(LIN).join('')}</ul></div>
      <button class="mbtn" id="nbtn" aria-expanded="false" aria-controls="nmore"><span class="lbl">+${it.length-6} more</span><span class="chev">▾</span></button>`:''}
      <div class="disc">Headlines from public Google News RSS plus official/sourced write-ups. Links open the original article. Not financial advice.</div></section>`;
  }catch(e){ERR(e)}

  try{
    const nums=games.map(g=>{
      const s=gfg[g.id]||{}; const mv=moves[g.id];
      const ch=typeof mv==='number'?`<small class="${mv>0?'up':mv<0?'dn':'zero'}">${mv>0?'+':''}${mv}% mo</small>`:'';
      return `<div class="num"><b>${esc(g.short)}</b><span class="v" style="color:${s.color||'#1a1530'}">${s.score??'—'}</span><small>${esc(s.band||'')}</small>${ch}</div>`;
    }).join('');
    h+=`<section class="card wide sum"><h2>Key Snapshot <i class="tip" data-k="snap" tabindex="0" aria-label="info">ⓘ</i></h2>
      <div class="bottom">The hobby is split. Magic has the greediest Fear &amp; Greed reading in this snapshot — Google Trends interest is up versus its 30-day average around the Star Trek release, MagicCon Atlanta / World Championship 32, and Netflix’s Planeswalker first look. Yu-Gi-Oh! is close behind and still has the strongest price tape (GempireCards +16% on the month, +140% over the year) with Magnificent Maestros just out. Pokémon still dominates raw Google search interest among the five, but chase cards and the category index are cooling after the Delta Reign launch (−8% on the month, Mega Rayquaza gold −36% in a week). One Piece is the weakest Trends tape and sits in a pre-release dip ahead of OP-18 on Nov 20, and Lorcana remains fearful after a Core Constructed ban and soft interest.</div>
      <div class="nums">${nums}</div>
      <div class="disc">Monthly % is the GempireCards category index (published 14 Nov 2026), not a single-card price. Fear &amp; Greed scores are computed from the components below — never invented. Search interest is Google Trends worldwide, five queries on one 0–100 scale (fetched 15 Nov 2026, 18:48 ICT).</div>
    </section>`;
  }catch(e){ERR(e)}

  try{
    const score=fg.overall, band=fg.overallBand, col=fg.overallColor;
    const rows=games.map(g=>{
      const s=gfg[g.id]||{};
      return `<tr><td><span class="gicon">${icon(g.id)}<b>${esc(g.name)}</b></span><div class="r">${(s.components||[]).map(c=>esc(c.name)+' '+c.score).join(' · ')}</div></td>
        <td class="val" style="color:${s.color}">${s.score}<br><span class="r">${esc(s.band)}</span></td></tr>`;
    }).join('');
    h+=`<section class="card wide"><h2>TCG Fear &amp; Greed <i class="tip" data-k="fg" tabindex="0" aria-label="info">ⓘ</i></h2>
      ${pixelGauge(score)}
      <div class="score" data-s="${score}" style="color:${col}">0</div>
      <div class="band" style="color:${col}">${esc((band||'').toUpperCase())}</div>
      ${hpBar(score, band, col)}
      <div class="bands">${(fg.bands||[]).map((b,i,a)=>`<span style="color:${b[2]}">${i?a[i-1][0]+1:0}–${b[0]} ${esc(b[1])}</span>`).join('')}</div>
      <div class="minis">${games.map(g=>{
        const s=gfg[g.id]||{};
        return `<div class="mini" data-game="${g.id}"><div class="nm">${icon(g.id)}${esc(g.short)}</div>
          ${hpBar(s.score,s.band,s.color)}
          <div class="sc" data-s="${s.score}" style="color:${s.color}">0</div>
          <div class="r">${esc(s.band||'')}</div></div>`;
      }).join('')}</div>
      <table style="margin-top:10px"><tr><td class="r">Game</td><td class="val r">Score</td></tr>${rows}</table>
      <div class="disc">${esc(fg.method||'')} <i class="tip" data-k="sent" tabindex="0">ⓘ</i></div>
    </section>`;
  }catch(e){ERR(e)}

  try{
    const defaultMode=trendsOk?'trends':'wiki';
    h+=`<section class="card wide" id="chart"><h2>Search interest <i class="tip" data-k="trend" tabindex="0" aria-label="info">ⓘ</i>
      ${trendsOk?'':'<span class="sample">proxy · not Google Trends</span>'}</h2>
      <div class="chart-toggle">
        <button class="chart-btn" id="btnTrends" type="button" ${trendsOk?'':'disabled'}>GOOGLE TRENDS</button>
        <button class="chart-btn" id="btnWiki" type="button">WIKI VIEWS</button>
      </div>
      <div class="r" id="chartNote" style="margin-bottom:6px"></div>
      <div id="chartDraw"></div>
      <div class="disc" id="chartDisc"></div>
    </section>`;
    // stash for after mount
    D._chartDefault=defaultMode;
  }catch(e){ERR(e)}

  try{
    games.forEach(g=>{
      const s=gfg[g.id]||{}, sent=(D.sentiment||{})[g.id]||{}, tr=(D.trending||{})[g.id]||[];
      const tPts=((D.trends&&D.trends.series)||{})[g.id]||[];
      const wPts=((D.wiki&&D.wiki.series)||{})[g.id]||[];
      const sparkPts = tPts.length?tPts:wPts;
      const tm=s.trend||{};
      const curated=((D.prices&&D.prices.curated)||{})[g.id]||{};
      const live=(D.prices&&D.prices.items&&D.prices.items[g.id])||null;
      let px='';
      if(live&&live.top&&live.top.length){
        px+=`<h3>Live prices · ${esc(live.set||g.short)}</h3>
          <table class="px">${live.top.slice(0,5).map(c=>`<tr><td><a href="${esc(c.url||'#')}" target="_blank" rel="noopener">${esc(c.name)}</a><div class="r">${esc(c.rarity||'')} ${c.collector?'#'+esc(c.collector):''}</div></td>
            <td class="val">${money(c.usd)}${c.usd_foil&&c.usd_foil!==c.usd?`<div class="r">foil ${money(c.usd_foil)}</div>`:''}</td></tr>`).join('')}</table>
          <div class="r">${esc(live.source||'')} · ${live.asof?ict(live.asof):''}</div>`;
      }
      if(curated.items&&curated.items.length){
        px+=`<h3>Dated market reads</h3>
          <table class="px">${curated.items.map(c=>`<tr><td>${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`:esc(c.name)}<div class="r">${esc(c.chg||'')}</div></td>
            <td class="val">${c.usd!=null?money(c.usd):'—'}</td></tr>`).join('')}</table>
          <div class="r">${esc(curated.source||'')}</div>`;
      }
      const latestT=tPts.length?tPts[tPts.length-1].v:null;
      const latestW=wPts.length?wPts[wPts.length-1].v:null;
      h+=`<section class="card" data-game="${g.id}">
        <h2><span class="gicon">${icon(g.id)}${esc(g.name)}</span><span class="badge" style="background:${s.color}22;color:${s.color}">${s.score} ${esc((s.band||'').toUpperCase())}</span></h2>
        ${hpBar(s.score,s.band,s.color)}
        <div class="r">Google Trends (0–100 vs the other four): latest ${latestT??'—'} · 7d avg ${tm.a7??'—'} vs 30d ${tm.a30??'—'}${latestW!=null?` · Wiki views ${latestW.toLocaleString('en-US')}`:''}</div>
        ${spark(sparkPts, GCOLOR[g.id])}
        <div class="nums" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:8px">
          <div class="num"><b>Sentiment</b><span class="v">${sent.score??'—'}</span><small>${sent.pos??0} pos / ${sent.neg??0} neg</small></div>
          <div class="num"><b>Trend</b><span class="v">${tm.score??'—'}</span><small>${tm.ratio!=null?'×'+tm.ratio:'7d / 30d'}</small></div>
          <div class="num"><b>Price mo.</b><span class="v ${typeof moves[g.id]==='number'?(moves[g.id]>0?'up':moves[g.id]<0?'dn':''):''}">${typeof moves[g.id]==='number'?(moves[g.id]>0?'+':'')+moves[g.id]+'%':'—'}</span><small>GempireCards</small></div>
        </div>
        <h3>What’s trending</h3>
        <ul class="tr">${tr.map(t=>`<li>${esc(t.t)} ${t.url?`<a class="r" href="${esc(t.url)}" target="_blank" rel="noopener">↗ ${esc(t.src||'source')}</a>`:''}</li>`).join('')||'<li class="r">No sourced items in this snapshot.</li>'}</ul>
        ${px}
      </section>`;
    });
  }catch(e){ERR(e)}

  $('main').innerHTML=h;
  if(ERRS.length)$('main').insertAdjacentHTML('beforeend','<section class="card wide"><div class="r">Some sections failed to load ('+ERRS.length+'). Pull to refresh.</div></section>');

  const nb=$('nbtn');
  if(nb) nb.addEventListener('click',()=>{
    const o=nb.getAttribute('aria-expanded')!=='true';
    nb.setAttribute('aria-expanded',o);
    $('nmore').classList.toggle('open',o);
    nb.querySelector('.lbl').textContent=o?'Show less':'+'+((D.news.items||[]).length-6)+' more';
  });

  function paintChart(mode){
    const pack=seriesFor(D, mode);
    const draw=$('chartDraw'), note=$('chartNote'), disc=$('chartDisc');
    if(!draw) return;
    draw.innerHTML=interestChart(D, mode);
    if(note) note.textContent=pack.note||'';
    if(disc){
      const fetchAt=D.trends&&D.trends.fetchedAt?(' · fetched '+ict(D.trends.fetchedAt)):'';
      disc.textContent='Source: '+pack.label+'. Window: past 90 days (15 Aug–15 Nov 2026, worldwide)'+(mode==='trends'?fetchAt:'')+'. '+(pack.indexed?'Each line is indexed to that game’s 90-day peak.':'Values are relative 0–100 across the five queries, not absolute search volume.');
    }
    const bt=$('btnTrends'), bw=$('btnWiki');
    if(bt) bt.style.opacity = mode==='trends'?1:.55;
    if(bw) bw.style.opacity = mode==='wiki'?1:.55;
  }
  paintChart(D._chartDefault||'wiki');
  const bt=$('btnTrends'), bw=$('btnWiki');
  if(bt) bt.addEventListener('click',()=>paintChart('trends'));
  if(bw) bw.addEventListener('click',()=>paintChart('wiki'));

  const G={
    snap:{d:'Five equal-weight game scores make the overall index. Each game blends trend momentum (30%), headline sentiment (25%), 14-day news volume (20%) and monthly category price momentum (25%). Trend momentum now uses Google Trends (7-day vs 30-day average of worldwide interest).'},
    fg:{d:'Same zone names as a classic Fear & Greed gauge: 0–24 Extreme Fear, 25–44 Fear, 45–55 Neutral, 56–75 Greed, 76–100 Extreme Greed. The overall number is the average of the five games, not a single-card price. The HP-style bar is the same score.'},
    sent:{d:'Sentiment is a simple headline lexicon: we count a small list of positive words (launch, gains, championship, sold-out…) and negative words (ban, drop, decline, controversy…) in recent headlines, then shrink the raw 0–100 score toward 50 when there are few hits. It is not a model, and it is not social-media sentiment.'},
    trend:{d:'The default chart is Google Trends, worldwide, past 90 days, with all five queries on one 0–100 scale (so they are comparable; this is not absolute search volume). Wikipedia daily pageviews stay available as a labeled fallback via the Wiki Views button. Trend momentum in the index uses 7-day vs 30-day averages of the Trends series.'}
  };
  const tt=$('tt');
  let cur=null;
  const show=e=>{const k=e.dataset.k; if(!G[k])return; tt.textContent=G[k].d; tt.style.display='block';
    const r=e.getBoundingClientRect(),w=tt.offsetWidth,hh=tt.offsetHeight;
    let x=Math.min(Math.max(12,r.left+r.width/2-w/2),innerWidth-w-12), y=r.bottom+8;
    if(y+hh>innerHeight-12)y=r.top-hh-8; tt.style.left=x+'px'; tt.style.top=Math.max(12,y)+'px'; cur=e};
  const hide=()=>{tt.style.display='none';cur=null};
  const hover=matchMedia('(hover:hover)').matches;
  document.addEventListener('mouseover',e=>{if(hover&&e.target.classList.contains('tip'))show(e.target)});
  document.addEventListener('mouseout',e=>{if(hover&&e.target.classList.contains('tip'))hide()});
  document.addEventListener('click',e=>{const t=e.target.closest('.tip'); if(t){e.preventDefault(); cur===t?hide():show(t)} else hide()});
  addEventListener('scroll',hide,{passive:true});

  const spin=()=>{
    document.querySelectorAll('.needle-box,.needle').forEach(n=>{
      n.style.transform=`rotate(${(+n.dataset.s||0)*1.8 - (n.classList.contains('needle-box')?90:0)}deg)`;
    });
    document.querySelectorAll('.score[data-s], .sc[data-s]').forEach(e=>{
      const t=+e.dataset.s; let n=0;
      const iv=setInterval(()=>{n=Math.min(t,n+Math.max(.5,t/40)); e.textContent=Math.round(n); if(n>=t)clearInterval(iv)},32);
    });
  };
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.querySelectorAll('.needle-box,.needle').forEach(n=>n.style.transform=`rotate(${(+n.dataset.s||0)*1.8 - (n.classList.contains('needle-box')?90:0)}deg)`);
    document.querySelectorAll('.score[data-s], .sc[data-s]').forEach(e=>e.textContent=Math.round(+e.dataset.s));
  } else {
    requestAnimationFrame(()=>setTimeout(spin,200));
  }
}

// theme toggle (pixel is the default)
applyTheme(currentTheme());
const tb=$('themeBtn');
if(tb) tb.addEventListener('click',()=>applyTheme(currentTheme()==='pixel'?'foil':'pixel'));

fetch('data/dashboard.json?t='+Date.now(),{cache:'no-store'})
  .then(r=>{if(!r.ok)throw new Error('data '+r.status); return r.json()})
  .then(render)
  .catch(e=>{
    ERR(e);
    $('main').innerHTML='<section class="card wide"><h2>Couldn’t load data</h2><div class="r">'+esc(e.message)+'. Pull to refresh.</div></section>';
  });
})();
