(function(){
const $ = s => document.getElementById(s);
const esc = x => String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const GCOLOR = {pokemon:'#ffcb05',onepiece:'#ff3b3b',mtg:'#ff8c42',lorcana:'#7ec8e3',yugioh:'#c084fc'};
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

function needleSvg(score, w, h, sw){
  let arcs='', p=0;
  const bands=[[24,'#ff4d4d'],[44,'#ff6a1c'],[55,'#ffcf33'],[75,'#c6e01a'],[100,'#19e07a']];
  const cx=100, cy=100, r=80;
  bands.forEach(b=>{
    const a0=Math.PI*(1-p/100), a1=Math.PI*(1-b[0]/100);
    arcs+=`<path d="M${cx+r*Math.cos(a0)} ${cy-r*Math.sin(a0)} A${r} ${r} 0 0 1 ${cx+r*Math.cos(a1)} ${cy-r*Math.sin(a1)}" stroke="${b[1]}" stroke-width="${sw||16}" fill="none" opacity=".9"/>`;
    p=b[0];
  });
  return `<svg class="gauge" viewBox="0 0 200 115" style="max-width:${w||360}px">${arcs}
    <line class="needle" data-s="${score}" x1="100" y1="100" x2="48" y2="100" stroke="#fff" stroke-width="${sw?3:3}" stroke-linecap="round" style="transform-origin:100px 100px;transition:transform 1.6s cubic-bezier(.2,.8,.2,1)"/>
    <circle cx="100" cy="100" r="6" fill="#fff"/></svg>`;
}

function spark(pts, color){
  if(!pts||!pts.length) return '';
  const W=220,H=56,p=4;
  const vals=pts.map(x=>x.v);
  const mx=Math.max(...vals,1), mn=Math.min(...vals,0);
  const x=i=>p+i*(W-2*p)/Math.max(1,pts.length-1);
  const y=v=>p+(mx===mn?H/2:(mx-v)/(mx-mn)*(H-2*p));
  let d=pts.map((pt,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(pt.v).toFixed(1)).join(' ');
  const last=pts[pts.length-1].v;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>
    <circle cx="${x(pts.length-1)}" cy="${y(last)}" r="2.4" fill="${color}"/></svg>`;
}

function interestChart(D){
  const series = (D.wiki && D.wiki.series) || {};
  const games=D.games||[];
  // index each series to 100 = 90d max, so momentum is comparable
  const indexed={};
  let dates=[];
  games.forEach(g=>{
    const pts=series[g.id]||[];
    const mx=Math.max(1,...pts.map(p=>p.v));
    indexed[g.id]=pts.map(p=>({d:p.d, v: p.v/mx*100, raw:p.v}));
    if(pts.length>dates.length) dates=pts.map(p=>p.d);
  });
  if(!dates.length) return '<div class=r>No series available.</div>';
  const W=640,H=220,L=36,R=12,T=12,B=28;
  const x=i=>L+i*(W-L-R)/Math.max(1,dates.length-1);
  const y=v=>T+(100-v)/100*(H-T-B);
  let grid='';
  for(let k=0;k<=4;k++){
    const v=k*25;
    grid+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#2a2438"/><text x="4" y="${y(v)+3}" fill="#9a917f" font-size="9">${v}</text>`;
  }
  let months='';
  dates.forEach((d,i)=>{
    if(i&&d.slice(5,7)!==dates[i-1].slice(5,7)){
      months+=`<text x="${x(i)}" y="${H-6}" fill="#9a917f" font-size="9" text-anchor="middle">${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+d.slice(5,7)-1]}</text>
        <line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H-B}" stroke="#1a1624"/>`;
    }
  });
  let paths='';
  games.forEach(g=>{
    const pts=indexed[g.id]||[];
    if(!pts.length) return;
    const d=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.v).toFixed(1)).join(' ');
    paths+=`<path d="${d}" fill="none" stroke="${GCOLOR[g.id]}" stroke-width="2" opacity=".95"/>`;
  });
  const legend=games.map(g=>`<span><i style="background:${GCOLOR[g.id]}"></i>${esc(g.short)}</span>`).join('');
  return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" font-family="JetBrains Mono,monospace">${grid}${months}${paths}</svg></div>
    <div class="legend">${legend}</div>`;
}

function render(D){
  try{
    $('asof').textContent = 'As of '+ (D.asOfIct || ict(D.asOf));
  }catch(e){ERR(e)}

  const fg=D.fearGreed||{}, games=D.games||[], gfg=fg.games||{};
  const moves=D.marketMoves||{};

  // ticker
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

  // news
  try{
    const it=(D.news&&D.news.items)||[];
    const names=Object.fromEntries(games.map(g=>[g.id,g.short]));
    const LIN=x=>`<li><a href="${esc(x.link)}" target="_blank" rel="noopener"><div class="tt">${esc(x.title)}</div>
      <div class="mt">${x.highlight?'<span class="chip br">HIGHLIGHT</span>':''}${x.breaking?'<span class="chip br">NEW</span>':''}
      <span class="chip g-${esc(x.game)}">${esc(names[x.game]||x.game)}</span>
      <span>${esc(x.source)}</span><span>${ago(x.utc)} · ${ict(x.utc)}</span></div></a></li>`;
    h+=`<section class="card wide" id="news"><h2><span class="bkh"><i class="dot"></i>TOP HIGHLIGHTS</span>
      <span class="r" style="font:12px JetBrains Mono,monospace">updated ${D.news&&D.news.updated?ict(D.news.updated):''}</span></h2>
      <ul class="nw">${it.slice(0,6).map(LIN).join('')}</ul>
      ${it.length>6?`<div class="more" id="nmore"><ul class="nw">${it.slice(6).map(LIN).join('')}</ul></div>
      <button class="mbtn" id="nbtn" aria-expanded="false" aria-controls="nmore"><span class="lbl">+${it.length-6} more</span><span class="chev">▾</span></button>`:''}
      <div class="disc">Headlines from public Google News RSS plus official/sourced write-ups. Links open the original article. Not financial advice.</div></section>`;
  }catch(e){ERR(e)}

  // summary
  try{
    const nums=games.map(g=>{
      const s=gfg[g.id]||{}; const mv=moves[g.id];
      const ch=typeof mv==='number'?`<small class="${mv>0?'up':mv<0?'dn':'zero'}">${mv>0?'+':''}${mv}% mo</small>`:'';
      return `<div class="num"><b>${esc(g.short)}</b><span class="v" style="color:${s.color||'#e8c56a'}">${s.score??'—'}</span><small>${esc(s.band||'')}</small>${ch}</div>`;
    }).join('');
    h+=`<section class="card wide sum"><h2>Key Snapshot <i class="tip" data-k="snap" tabindex="0" aria-label="info">ⓘ</i></h2>
      <div class="bottom">${esc('The hobby is split. Yu-Gi-Oh! is the greediest reading in this snapshot — GempireCards has the category +16% on the month and +140% over the year, with Magnificent Maestros just out. Magic is busy for a different reason: Star Trek is in stores, MagicCon Atlanta / World Championship 32 just ran, and Netflix showed Planeswalker for 2027, which shows up as a clear Wikipedia traffic spike. Pokémon’s new Delta Reign set is selling, but chase cards and the category index are cooling after launch (−8% on the month, Mega Rayquaza gold −36% in a week). One Piece is in a pre-release dip ahead of OP-18 on Nov 20, and Lorcana is the most fearful reading after a Core Constructed ban and softer traffic.')}</div>
      <div class="nums">${nums}</div>
      <div class="disc">Monthly % is the GempireCards category index (published 14 Nov 2026), not a single-card price. Fear &amp; Greed scores are computed from the components below — never invented.</div>
    </section>`;
  }catch(e){ERR(e)}

  // overall gauge
  try{
    const score=fg.overall, band=fg.overallBand, col=fg.overallColor;
    const rows=games.map(g=>{
      const s=gfg[g.id]||{};
      const comps=(s.components||[]).map(c=>`${c.score}`).join(' / ');
      return `<tr><td><b>${esc(g.name)}</b><div class="r">${(s.components||[]).map(c=>esc(c.name)+' '+c.score).join(' · ')}</div></td>
        <td class="val" style="color:${s.color}">${s.score}<br><span class="r">${esc(s.band)}</span></td></tr>`;
    }).join('');
    h+=`<section class="card wide"><h2>TCG Fear &amp; Greed <i class="tip" data-k="fg" tabindex="0" aria-label="info">ⓘ</i></h2>
      ${needleSvg(score)}
      <div class="score" data-s="${score}" style="color:${col}">0</div>
      <div class="band" style="color:${col}">${esc((band||'').toUpperCase())}</div>
      <div class="bands">${(fg.bands||[]).map((b,i,a)=>`<span style="color:${b[2]}">${i?a[i-1][0]+1:0}–${b[0]} ${esc(b[1])}</span>`).join('')}</div>
      <div class="minis">${games.map(g=>{
        const s=gfg[g.id]||{};
        return `<div class="mini" data-game="${g.id}"><div class="nm">${esc(g.short)}</div>${needleSvg(s.score,160,90,12)}
          <div class="sc" data-s="${s.score}" style="color:${s.color}">0</div>
          <div class="r">${esc(s.band||'')}</div></div>`;
      }).join('')}</div>
      <table style="margin-top:10px"><tr><td class="r">Game</td><td class="val r">Score</td></tr>${rows}</table>
      <div class="disc">${esc(fg.method||'')} <i class="tip" data-k="sent" tabindex="0">ⓘ</i></div>
    </section>`;
  }catch(e){ERR(e)}

  // interest chart
  try{
    const trendsOk=D.trends&&D.trends.status==='ok';
    const label=trendsOk?D.trends.source: (D.wiki&&D.wiki.source)||'Interest series';
    h+=`<section class="card wide" id="chart"><h2>Search interest <i class="tip" data-k="trend" tabindex="0" aria-label="info">ⓘ</i>
      ${trendsOk?'':'<span class="sample">proxy · not Google Trends</span>'}</h2>
      <div class="r" style="margin-bottom:6px">${trendsOk?esc(D.trends.note):
        'Google Trends was rate-limited when this snapshot was built, so this chart uses English Wikipedia daily pageviews as a labeled traffic proxy — not Google search interest. Each line is indexed to 100 = that game’s own 90-day peak, so you can compare momentum rather than raw fame (Magic’s article is simply much bigger than Lorcana’s).'}</div>
      ${interestChart(D)}
      <div class="disc">Source: ${esc(label)}. Window: last ~90 days (15 Aug–15 Nov 2026). Raw latest daily views are shown on each game card.</div>
    </section>`;
  }catch(e){ERR(e)}

  // per-game cards
  try{
    games.forEach(g=>{
      const s=gfg[g.id]||{}, sent=(D.sentiment||{})[g.id]||{}, tr=(D.trending||{})[g.id]||[];
      const pts=((D.wiki&&D.wiki.series)||{})[g.id]||[];
      const last=pts.length?pts[pts.length-1].v:null;
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
      h+=`<section class="card" data-game="${g.id}">
        <h2><span>${esc(g.name)}</span><span class="badge" style="background:${s.color}22;color:${s.color}">${s.score} ${esc((s.band||'').toUpperCase())}</span></h2>
        <div class="r">Wikipedia traffic (daily) · latest ${last!=null?last.toLocaleString('en-US')+' views': '—'} · 7d avg ${tm.a7??'—'} vs 30d ${tm.a30??'—'}</div>
        ${spark(pts, GCOLOR[g.id])}
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

  // tooltips
  const G={
    snap:{d:'Five equal-weight game scores make the overall index. Each game blends trend momentum (30%), headline sentiment (25%), 14-day news volume (20%) and monthly category price momentum (25%).'},
    fg:{d:'Same zone names as a classic Fear & Greed gauge: 0–24 Extreme Fear, 25–44 Fear, 45–55 Neutral, 56–75 Greed, 76–100 Extreme Greed. The overall number is the average of the five games, not a single-card price.'},
    sent:{d:'Sentiment is a simple headline lexicon: we count a small list of positive words (launch, gains, championship, sold-out…) and negative words (ban, drop, decline, controversy…) in recent headlines, then shrink the raw 0–100 score toward 50 when there are few hits. It is not a model, and it is not social-media sentiment.'},
    trend:{d:'Google Trends (worldwide, last 90 days, five terms compared on one 0–100 scale) is the preferred series. It was rate-limited for this snapshot, so the chart uses English Wikipedia daily pageviews instead, with each line indexed to its own 90-day peak. Trend momentum in the index still uses 7-day vs 30-day averages of that same series — never invented numbers.'}
  };
  const tt=$('tt');
  let cur=null;
  const show=e=>{const k=e.dataset.k; if(!G[k])return; tt.textContent=G[k].d; tt.style.display='block';
    const r=e.getBoundingClientRect(),w=tt.offsetWidth,h=tt.offsetHeight;
    let x=Math.min(Math.max(12,r.left+r.width/2-w/2),innerWidth-w-12), y=r.bottom+8;
    if(y+h>innerHeight-12)y=r.top-h-8; tt.style.left=x+'px'; tt.style.top=Math.max(12,y)+'px'; cur=e};
  const hide=()=>{tt.style.display='none';cur=null};
  const hover=matchMedia('(hover:hover)').matches;
  document.addEventListener('mouseover',e=>{if(hover&&e.target.classList.contains('tip'))show(e.target)});
  document.addEventListener('mouseout',e=>{if(hover&&e.target.classList.contains('tip'))hide()});
  document.addEventListener('click',e=>{const t=e.target.closest('.tip'); if(t){e.preventDefault(); cur===t?hide():show(t)} else hide()});
  addEventListener('scroll',hide,{passive:true});

  const spin=()=>{
    document.querySelectorAll('.needle').forEach(n=>n.style.transform=`rotate(${(+n.dataset.s||0)*1.8}deg)`);
    document.querySelectorAll('.score[data-s], .sc[data-s]').forEach(e=>{
      const t=+e.dataset.s; let n=0;
      const iv=setInterval(()=>{n=Math.min(t,n+Math.max(.5,t/40)); e.textContent=Math.round(n); if(n>=t)clearInterval(iv)},32);
    });
  };
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.querySelectorAll('.needle').forEach(n=>n.style.transform=`rotate(${(+n.dataset.s||0)*1.8}deg)`);
    document.querySelectorAll('.score[data-s], .sc[data-s]').forEach(e=>e.textContent=Math.round(+e.dataset.s));
  } else {
    requestAnimationFrame(()=>setTimeout(spin,200));
  }
}

fetch('data/dashboard.json?t='+Date.now(),{cache:'no-store'})
  .then(r=>{if(!r.ok)throw new Error('data '+r.status); return r.json()})
  .then(render)
  .catch(e=>{
    ERR(e);
    $('main').innerHTML='<section class="card wide"><h2>Couldn’t load data</h2><div class="r">'+esc(e.message)+'. Pull to refresh.</div></section>';
  });
})();
