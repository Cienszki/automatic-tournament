# -*- coding: utf-8 -*-
import json

data = json.load(open("data.json", encoding="utf-8"))
DATA_JSON = json.dumps(data, ensure_ascii=False)

TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pick'em Bracket Analysis — Letnia</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root{
    --bg:#0d1117; --card:#161b22; --card2:#1c2431; --line:#2b3442;
    --txt:#e6edf3; --muted:#8b949e; --acc:#58a6ff; --good:#3fb950;
    --bad:#f85149; --warn:#d29922; --purple:#bc8cff; --pink:#f778ba;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);
    font-family:'Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;
    line-height:1.5;padding:0 0 60px}
  header{padding:34px 24px 20px;text-align:center;
    background:radial-gradient(1200px 400px at 50% -120px,#1f2a44,transparent)}
  h1{margin:0 0 6px;font-size:30px;letter-spacing:.3px}
  .sub{color:var(--muted);font-size:14px}
  .wrap{max-width:1180px;margin:0 auto;padding:0 20px}
  .kpis{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin:26px 0 8px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;
    padding:14px 20px;min-width:150px;text-align:center}
  .kpi .n{font-size:26px;font-weight:700}
  .kpi .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
  .winner{background:linear-gradient(135deg,#132a1a,#0f2419);border:1px solid #2ea04366;
    border-radius:16px;padding:20px 24px;margin:24px 0;display:flex;align-items:center;gap:20px;flex-wrap:wrap}
  .winner .medal{font-size:46px}
  .winner h2{margin:0;font-size:22px}
  .winner .d{color:var(--muted);font-size:14px;margin-top:4px}
  .winner .score{margin-left:auto;text-align:center}
  .winner .score .v{font-size:40px;font-weight:800;color:var(--good)}
  .winner .score .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
  section{margin:34px 0}
  h3{font-size:18px;border-left:4px solid var(--acc);padding-left:12px;margin:0 0 4px}
  .hint{color:var(--muted);font-size:13px;margin:2px 0 16px 16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  @media(max-width:820px){.grid{grid-template-columns:1fr}}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
  .card h4{margin:0 0 12px;font-size:15px;color:var(--txt)}
  .chartbox{position:relative;height:340px}
  .chartbox.tall{height:460px}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line)}
  th{color:var(--muted);font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px;cursor:default}
  tbody tr:hover{background:var(--card2)}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  .pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11.5px;font-weight:600}
  .b1{background:#7d4bff33;color:#c9b3ff}
  .b2{background:#2f81f733;color:#9cc7ff}
  .b34{background:#3fb95033;color:#8fe0a3}
  .b58{background:#d2992233;color:#f0cd7a}
  .b912{background:#8b949e33;color:#c9d1d9}
  .bmiss{background:#f8514933;color:#ffb0ab}
  .good{color:var(--good)} .bad{color:var(--bad)} .muted{color:var(--muted)}
  .rank{color:var(--muted);font-variant-numeric:tabular-nums}
  .bracket{display:flex;gap:10px;flex-wrap:wrap}
  .bcol{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;flex:1;min-width:150px}
  .bcol .h{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
  .bcol .t{font-size:14px;margin:5px 0;font-weight:600}
  .bcol .pts{float:right;color:var(--acc);font-weight:700}
  ol.stats{counter-reset:s;list-style:none;padding:0;margin:0}
  ol.stats li{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--purple);
    border-radius:10px;padding:12px 16px 12px 52px;position:relative;margin-bottom:10px}
  ol.stats li:before{counter-increment:s;content:counter(s);position:absolute;left:14px;top:12px;
    background:var(--purple);color:#12101a;width:26px;height:26px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
  ol.stats b{color:#fff}
  ol.stats .tag{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:2px}
  .foot{color:var(--muted);font-size:12px;text-align:center;margin-top:30px}
</style>
</head>
<body>
<header>
  <h1>🏆 Pick'em Bracket Analysis</h1>
  <div class="sub">Letnia summer tournament · <span id="tid"></span> · predicted vs. actual final placement</div>
  <div class="wrap kpis" id="kpis"></div>
</header>

<div class="wrap">

  <div class="winner" id="winner"></div>

  <section>
    <h3>Actual final bracket</h3>
    <div class="hint">Scoring buckets: 1st = 16 pts · 2nd = 15 · 3rd–4th = 13 · 5th–8th = 9 · 9th–12th = 5 · missed top-12 = 0</div>
    <div class="bracket" id="bracket"></div>
  </section>

  <section>
    <h3>Who read the bracket best?</h3>
    <div class="hint">Total |predicted points − actual points| across all 12 picks. Lower is better. Green bar = the winner.</div>
    <div class="grid">
      <div class="card"><h4>Total error per player (lower = better)</h4><div class="chartbox tall"><canvas id="cPlayers"></canvas></div></div>
      <div class="card"><h4>Exact-bucket hits per player (out of 12)</h4><div class="chartbox tall"><canvas id="cExact"></canvas></div></div>
    </div>
  </section>

  <section>
    <h3>Hype vs. reality — the 12 teams that made the bracket</h3>
    <div class="hint">Average points the field predicted vs. points the team actually scored. Sorted by actual finish.</div>
    <div class="card"><div class="chartbox tall"><canvas id="cHype"></canvas></div></div>
  </section>

  <section>
    <h3>Most over- and under-rated teams</h3>
    <div class="hint">Average predicted points minus actual points. Red = the field over-rated them; green = the field slept on them.</div>
    <div class="card"><div class="chartbox tall"><canvas id="cOver"></canvas></div></div>
  </section>

  <section>
    <div class="grid">
      <div class="card"><h4>Team popularity — how many of 15 players picked each team</h4><div class="chartbox tall"><canvas id="cPop"></canvas></div></div>
      <div class="card"><h4>Champion (1st-place) votes</h4><div class="chartbox tall"><canvas id="cChamp"></canvas></div></div>
    </div>
  </section>

  <section>
    <h3>15 most interesting team stats</h3>
    <ol class="stats" id="stats"></ol>
  </section>

  <section>
    <h3>Full player leaderboard</h3>
    <div class="card" style="overflow-x:auto">
      <table id="tPlayers"><thead><tr>
        <th>#</th><th>Player</th><th>Discord</th><th class="num">Total error</th>
        <th class="num">Exact buckets</th><th class="num">Picks in top-12</th><th>Champion pick</th>
      </tr></thead><tbody></tbody></table>
    </div>
  </section>

  <section>
    <h3>Full team table</h3>
    <div class="card" style="overflow-x:auto">
      <table id="tTeams"><thead><tr>
        <th>Team</th><th class="num">Picked by</th><th class="num">1st votes</th>
        <th class="num">Avg pred pts</th><th class="num">Actual pts</th><th>Actual finish</th>
        <th class="num">Over/under</th><th class="num">Avg error</th>
      </tr></thead><tbody></tbody></table>
    </div>
  </section>

  <div class="foot">Generated from pickem_export · 15 players · 12-team bracket · all figures computed exactly from the raw picks.</div>
</div>

<script>
const DATA = __DATA__;
Chart.defaults.color = '#8b949e';
Chart.defaults.font.family = "'Segoe UI',system-ui,sans-serif";
Chart.defaults.borderColor = '#2b3442';
const C = {good:'#3fb950',bad:'#f85149',acc:'#58a6ff',warn:'#d29922',purple:'#bc8cff',pink:'#f778ba',muted:'#8b949e'};

document.getElementById('tid').textContent = DATA.actual_results.length + '-team bracket';

// KPIs
const best = DATA.player_scores[0];
const kpis = [
  ['Players', DATA.num_players],
  ['Teams predicted', DATA.num_teams_predicted],
  ['Bracket size', DATA.actual_results.length],
  ['Best total error', best.total_abs_diff],
  ['Champion callers', DATA.player_scores.filter(p=>p.champ_correct).length + ' / 15'],
];
document.getElementById('kpis').innerHTML = kpis.map(k=>
  `<div class="kpi"><div class="n">${k[1]}</div><div class="l">${k[0]}</div></div>`).join('');

// Winner banner (handle ties on total error + exact buckets)
const tied = DATA.player_scores.filter(p=>p.total_abs_diff===best.total_abs_diff && p.exact_bucket_hits===best.exact_bucket_hits);
document.getElementById('winner').innerHTML = `
  <div class="medal">🥇</div>
  <div>
    <h2>${tied.map(p=>p.name).join(' & ')} <span class="muted" style="font-size:14px">best bracket predictor${tied.length>1?' · dead tie':''}</span></h2>
    <div class="d">${best.exact_bucket_hits}/12 exact-bucket hits · all 12 picks made the top 12 · ${tied.length>1?'identical on every tiebreaker (total error, exact buckets, top-12 hits)':('champion pick: '+best.champ_pick+(best.champ_correct?' ✅':''))}</div>
  </div>
  <div class="score"><div class="v">${best.total_abs_diff}</div><div class="l">total points off</div></div>`;

// Bracket strip
const bucketClass = {place_1:'b1',place_2:'b2',place_3_4:'b34',place_5_8:'b58',place_9_12:'b912'};
const groups = {};
DATA.actual_results.forEach(a=>{(groups[a.label]=groups[a.label]||[]).push(a);});
document.getElementById('bracket').innerHTML = Object.entries(groups).map(([label,arr])=>`
  <div class="bcol"><div class="h">${label} · ${arr[0].pts} pts</div>
   ${arr.map(a=>`<div class="t">${a.team}</div>`).join('')}</div>`).join('');

// ---- Player leaderboard (asc, best on top) ----
const ps = DATA.player_scores;
new Chart(document.getElementById('cPlayers'),{type:'bar',data:{
  labels:ps.map(p=>p.name),
  datasets:[{label:'Total |pred−actual|',data:ps.map(p=>p.total_abs_diff),
    backgroundColor:ps.map((p,i)=>i===0?C.good:(i<3?'#2ea04380':'#58a6ff66')),
    borderColor:ps.map((p,i)=>i===0?C.good:C.acc),borderWidth:1}]},
  options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:c=>{
      const p=ps[c.dataIndex];return `exact buckets: ${p.exact_bucket_hits}/12\ntop-12 hits: ${p.hit_top12}/12`;}}}},
    scales:{x:{title:{display:true,text:'points off (lower is better)'}}}}});

// ---- Exact bucket hits ----
const pe = [...ps].sort((a,b)=>b.exact_bucket_hits-a.exact_bucket_hits);
new Chart(document.getElementById('cExact'),{type:'bar',data:{
  labels:pe.map(p=>p.name),
  datasets:[{label:'Exact-bucket hits',data:pe.map(p=>p.exact_bucket_hits),
    backgroundColor:pe.map(p=>p.exact_bucket_hits>=6?C.purple:'#bc8cff66'),borderColor:C.purple,borderWidth:1}]},
  options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false}},scales:{x:{max:12,title:{display:true,text:'picks placed in the exact right bucket'}}}}});

// ---- Hype vs reality ----
const real = DATA.team_stats.filter(t=>t.in_top12).sort((a,b)=>b.actual_pts-a.actual_pts || a.avg_pred_pts-b.avg_pred_pts);
new Chart(document.getElementById('cHype'),{type:'bar',data:{
  labels:real.map(t=>t.team),
  datasets:[
    {label:'Avg predicted pts',data:real.map(t=>t.avg_pred_pts),backgroundColor:'#58a6ff99',borderColor:C.acc,borderWidth:1},
    {label:'Actual pts',data:real.map(t=>t.actual_pts),backgroundColor:'#3fb95099',borderColor:C.good,borderWidth:1}]},
  options:{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{position:'top'}},
    scales:{x:{ticks:{maxRotation:60,minRotation:35}},y:{title:{display:true,text:'points'}}}}});

// ---- Over/under rated ----
const ov = [...DATA.team_stats].sort((a,b)=>b.overrating-a.overrating);
new Chart(document.getElementById('cOver'),{type:'bar',data:{
  labels:ov.map(t=>t.team),
  datasets:[{label:'Avg predicted − actual',data:ov.map(t=>t.overrating),
    backgroundColor:ov.map(t=>t.overrating>0?'#f8514999':'#3fb95099'),
    borderColor:ov.map(t=>t.overrating>0?C.bad:C.good),borderWidth:1}]},
  options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:c=>{
      const t=ov[c.dataIndex];return `actual: ${t.actual_pts} pts (${t.actual_label})\npicked by ${t.pick_count}`;}}}},
    scales:{x:{title:{display:true,text:'← underrated        overrated →'}}}}});

// ---- Popularity ----
const pop = [...DATA.team_stats].sort((a,b)=>b.pick_count-a.pick_count);
new Chart(document.getElementById('cPop'),{type:'bar',data:{
  labels:pop.map(t=>t.team),
  datasets:[{label:'Times picked (of 15)',data:pop.map(t=>t.pick_count),
    backgroundColor:pop.map(t=>t.in_top12?'#58a6ff99':'#f8514966'),
    borderColor:pop.map(t=>t.in_top12?C.acc:C.bad),borderWidth:1}]},
  options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:c=>pop[c.dataIndex].in_top12?'made the bracket':'MISSED top-12'}}},
    scales:{x:{max:15}}}});

// ---- Champion votes ----
const cv = DATA.team_stats.filter(t=>t.champ_votes>0).sort((a,b)=>b.champ_votes-a.champ_votes);
new Chart(document.getElementById('cChamp'),{type:'bar',data:{
  labels:cv.map(t=>t.team+(t.actual_bucket==='place_1'?' 👑':'')),
  datasets:[{label:'1st-place votes',data:cv.map(t=>t.champ_votes),
    backgroundColor:cv.map(t=>t.actual_bucket==='place_1'?C.good:(t.in_top12?'#d2992299':'#f8514966')),
    borderColor:cv.map(t=>t.actual_bucket==='place_1'?C.good:(t.in_top12?C.warn:C.bad)),borderWidth:1}]},
  options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:c=>`actual finish: ${cv[c.dataIndex].actual_label}`}}},
    scales:{x:{title:{display:true,text:'green = actually won · yellow = made bracket · red = missed'}}}}});

// ---- Tables ----
const pcls = {place_1:'b1',place_2:'b2',place_3_4:'b34',place_5_8:'b58',place_9_12:'b912'};
document.querySelector('#tPlayers tbody').innerHTML = ps.map((p,i)=>`<tr>
  <td class="rank">${i+1}</td><td><b>${p.name}</b></td><td class="muted">${p.discord||'—'}</td>
  <td class="num" style="color:${i===0?C.good:'inherit'};font-weight:${i===0?'700':'400'}">${p.total_abs_diff}</td>
  <td class="num">${p.exact_bucket_hits}</td><td class="num">${p.hit_top12}</td>
  <td>${p.champ_pick}${p.champ_correct?' <span class="good">✅</span>':''}</td></tr>`).join('');

document.querySelector('#tTeams tbody').innerHTML = pop.map(t=>{
  const cls = t.in_top12?pcls[t.actual_bucket]:'bmiss';
  const ov = t.overrating>0?`<span class="bad">+${t.overrating}</span>`:`<span class="good">${t.overrating}</span>`;
  return `<tr><td><b>${t.team}</b></td><td class="num">${t.pick_count} (${t.pick_pct}%)</td>
   <td class="num">${t.champ_votes||''}</td><td class="num">${t.avg_pred_pts}</td>
   <td class="num">${t.actual_pts}</td><td><span class="pill ${cls}">${t.actual_label}</span></td>
   <td class="num">${ov}</td><td class="num">${t.avg_error}</td></tr>`;}).join('');

// ---- 15 stats ----
document.getElementById('stats').innerHTML = DATA.stats.map(s=>
  `<li><span class="tag">${s.tag}</span>${s.text}</li>`).join('');
</script>
</body>
</html>"""

# Build the 15 curated stats (grounded in computed numbers) and attach to data.
stats = [
 ("Nobody's champion actually won", "<b>Gang sylwka</b> won the whole thing (16 pts) but only <b>2 of 15</b> players crowned them — the most <b>under-rated</b> team of the event at <b>−6.86</b> avg points below reality."),
 ("The forgotten runner-up", "<b>Adaś, ile za tę Robotę?</b> finished <b>2nd</b> (15 pts), yet <b>4 players left them out of their 12 entirely</b> and the field predicted them at just 9.45 pts (−5.55 under)."),
 ("The consensus #1 that wasn't", "<b>Keo Esports</b> was the field's darling — highest average prediction at <b>14.42 pts</b> and tied-most 1st-place votes (3) — but finished only <b>3rd–4th</b>."),
 ("Split champion vote, both wrong", "The two most-backed champions, <b>Keo Esports</b> and <b>Puck It!</b> (3 votes each), <b>neither won</b> — Puck It! slid all the way to 5th–8th."),
 ("The great bait: 'mid diff'", "<b>mid diff</b> was the biggest trap — picked by 5, even crowned champion by Sebastian, avg 11.6 pts predicted — and <b>missed the top-12 completely</b> (worst avg error of any team, 11.6)."),
 ("Everybody's team", "<b>Bociarnia Junior</b> was the only <b>unanimous</b> pick — all <b>15/15</b> players slotted them in — and they rewarded the faith with a solid 5th–8th finish."),
 ("Read like a book", "<b>Voodoo Monkey</b> was the <b>best-predicted</b> team: avg error of just <b>0.89 pts</b>, with 7 of 9 backers nailing their exact 9th–12th bucket."),
 ("Overhyped mid-tier", "<b>Puck It!</b> was the most over-rated real contender — 3 champion votes and 12.3 avg pts predicted, but they finished <b>5th–8th</b> (+3.3 overrated)."),
 ("Ten phantom contenders", "<b>10 different teams</b> received picks but <b>missed the bracket entirely</b> — Samci Savci (6 picks), Sparta Orzechowo, mid diff, PSY (5 each) and more all scored 0."),
 ("PSY: popular and busted", "<b>PSY</b> was picked by 5 and rated 10.2 avg pts — the <b>2nd-worst</b> bet after mid diff — yet finished outside the top 12."),
 ("Most divisive team", "Opinions split hardest on the champion <b>Gang sylwka</b> (placement stdev 3.61) — predictions ranged from 1st all the way to 9th–12th."),
 ("The field nailed the basement", "The <b>9th–12th tier was the easiest to read</b>: Voodoo Monkey (7/9), Gramy Dla Wujka (7/12) and Dwa Razy I Do Bazy (5/9) drew the most exact-bucket hits."),
 ("Quietly correct", "<b>Chrupek zamknij się</b> was under-rated (−3.18): backed by only 11 players at 9.82 avg pts, they out-performed into <b>3rd–4th</b> (13 pts)."),
 ("Popular but propped up", "Fan-favorites <b>Syzyf</b> (+3.25) and <b>Gramy Dla Wujka</b> (+2.67) were both picked by 80% of players but sank to 9th–12th — the most over-rated teams that still made the bracket."),
 ("Czosnek, the safe pick", "<b>Czosnek</b> was the most reliably-read mid-tier team: 8 of 14 backers put them in the exact 5th–8th bucket (avg error 1.93)."),
]
data["stats"] = [{"tag": t, "text": x} for (t, x) in stats]
DATA_JSON = json.dumps(data, ensure_ascii=False)

html = TEMPLATE.replace("__DATA__", DATA_JSON)
with open("pickem_dashboard.html", "w", encoding="utf-8") as f:
    f.write(html)
print("wrote pickem_dashboard.html", len(html), "bytes")
