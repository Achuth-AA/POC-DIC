// Dashboard: KPIs, latency chart, cache gauge, latency budget, routes, recent sessions.
document.addEventListener('DOMContentLoaded', () => {
  const { esc, pct, ms, badge } = UI;
  const k = MOCK.kpis;

  const kpis = [
    { label: 'Voice calls', value: k.voiceCalls, meta: `${k.voiceMinutes.toLocaleString('en-IN')} billable minutes` },
    { label: 'Chat sessions', value: k.chatSessions, meta: 'completed sessions (billing unit)' },
    { label: 'Median latency', value: ms(k.p50), meta: 'target < 1,000 ms', good: k.p50 < 1000 },
    { label: 'p90 latency', value: ms(k.p90), meta: 'p95 SLA ≤ 1,000 ms', good: k.p90 <= 1000 },
    { label: 'Cache hit rate', value: pct(k.cacheHit), meta: 'target ≥ 40%', good: k.cacheHit >= 0.4 },
    { label: 'Resolved by AI', value: pct(k.resolvedByAi), meta: `${k.handoffs} handoffs to officers` },
    { label: 'Live right now', value: k.activeNow, meta: 'calls + chats' },
    { label: 'Availability', value: pct(k.availability, 2), meta: 'SLA ≥ 99.9%', good: k.availability >= 0.999 },
  ];
  document.getElementById('kpis').innerHTML = kpis.map((c) => `
    <div class="card kpi"><div class="kpi__label">${esc(c.label)}</div><div class="kpi__value">${esc(c.value)}</div>
    <div class="kpi__meta ${c.good === true ? 'good' : c.good === false ? 'bad' : ''}">${esc(c.meta)}</div></div>`).join('');

  const L = MOCK.latency;
  const drawLatency = () => Charts.line(document.getElementById('latencyChart'), {
    labels: L.hours.map((h) => String(h).padStart(2, '0') + ':00'),
    series: [
      { name: 'LLM p50', values: L.llmP50, color: 'var(--c-llm)' },
      { name: 'LLM p90', values: L.llmP90, color: 'var(--c-llm-2)', dashed: true },
      { name: 'Cache p50', values: L.cacheP50, color: 'var(--c-cache)' },
      { name: 'Cache p90', values: L.cacheP90, color: 'var(--c-cache-2)', dashed: true },
    ],
    threshold: { value: 1000, label: '1,000 ms target' },
    height: 260,
  });
  drawLatency();
  window.addEventListener('resize', drawLatency);

  const c = MOCK.cache;
  Charts.ring(document.getElementById('cacheRing'), c.hitRate, { label: 'Cache hit rate', color: 'var(--c-cache)', target: 0.4 });
  document.getElementById('cacheStats').innerHTML = `
    <dt>Status</dt><dd>${c.enabled ? badge('ok', 'Enabled') : badge('muted', 'Disabled')}</dd>
    <dt>Entries</dt><dd>${c.entries.toLocaleString('en-IN')}</dd>
    <dt>Threshold</dt><dd>cosine ≥ ${c.threshold}</dd>
    <dt>False hits</dt><dd>${pct(c.falseHitRate, 1)} (eval set)</dd>
    <dt>Median saving</dt><dd>≈ ${ms(L.llmP50[23] - L.cacheP50[23])} per hit</dd>`;

  const colors = ['var(--c-eos)', 'var(--c-stt)', 'var(--c-ret)', 'var(--c-llm)', 'var(--c-tts)', '#94a3b8'];
  const maxBudget = Math.max(...MOCK.stageBudget.map((s) => s.budget));
  document.getElementById('budget').innerHTML = MOCK.stageBudget.map((s, i) => `
    <div class="budget__row"><span>${esc(s.stage)}</span>
      <span class="budget__bar" title="${s.ms} ms of ${s.budget} ms budget">
        <span style="width:${(s.ms / maxBudget) * 100}%;background:${colors[i]}"></span><i style="left:${(s.budget / maxBudget) * 100}%"></i></span>
      <span class="num">${s.ms} ms</span></div>`).join('') +
    `<div class="budget__row" style="font-weight:700;border-top:1px solid var(--line);padding-top:8px"><span>Total</span><span></span>
      <span class="num">${MOCK.stageBudget.reduce((a, s) => a + s.ms, 0)} ms</span></div>`;

  const routeColors = ['var(--c-cache)', 'var(--c-llm)', 'var(--c-tool)', 'var(--warn)', 'var(--bad)'];
  Charts.bars(document.getElementById('routes'), MOCK.routes.map((r, i) => ({ label: r.route, value: r.share, color: routeColors[i] })));
  Charts.bars(document.getElementById('languages'), MOCK.languages.map((l) => ({ label: l.lang, value: l.share, color: 'var(--accent)' })));

  const p = MOCK.providers;
  const nameOf = (kind) => p[kind].options.find((o) => o.id === p[kind].active);
  document.getElementById('providerList').innerHTML = ['llm', 'stt', 'tts'].map((kind) => {
    const o = nameOf(kind);
    return `<dt>${kind.toUpperCase()}</dt><dd>${esc(o.name)} ${badge(o.health)}</dd>`;
  }).join('');

  const table = document.getElementById('sessions');
  table.innerHTML = `
    <thead><tr><th>Session</th><th>Channel</th><th>Language</th><th>Started</th><th class="num">Turns</th><th class="num">p50</th><th>Outcome</th></tr></thead>
    <tbody>${MOCK.sessions.slice(0, 6).map((s) => `
      <tr class="is-clickable" data-id="${esc(s.id)}" tabindex="0">
        <td><div class="cell-title mono">${esc(s.id)}</div><div class="cell-sub">${esc(s.caller)}</div></td>
        <td>${s.channel === 'voice' ? '📞 Voice' : '💬 Chat'}</td>
        <td>${esc(s.lang)}</td><td>${esc(s.started)}</td>
        <td class="num">${s.turns}</td><td class="num">${s.p50} ms</td>
        <td>${badge(s.outcome)}</td></tr>`).join('')}</tbody>`;
  const open = (row) => { location.href = 'calls.html?id=' + encodeURIComponent(row.dataset.id); };
  table.addEventListener('click', (e) => { const r = e.target.closest('tr[data-id]'); if (r) open(r); });
  table.addEventListener('keydown', (e) => { const r = e.target.closest('tr[data-id]'); if (r && e.key === 'Enter') open(r); });

  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    UI.toast('Range switching uses /v1/metrics once the backend is connected.');
  }));

  document.getElementById('exportBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const blob = new Blob([JSON.stringify({ kpis: MOCK.kpis, latency: MOCK.latency, cache: MOCK.cache, routes: MOCK.routes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'metrics-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
});
