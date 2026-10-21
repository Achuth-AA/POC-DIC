// Calls & chats: session list + per-turn audit trail.
document.addEventListener('DOMContentLoaded', () => {
  const { esc, badge } = UI;
  const params = new URLSearchParams(location.search);
  let selected = params.get('id') || MOCK.sessions[0].id;
  let channel = '';

  const STAGES = [
    ['eos', 'End of speech', 'var(--c-eos)'], ['stt', 'STT', 'var(--c-stt)'], ['cache', 'Cache', 'var(--c-cache)'],
    ['retrieval', 'Retrieval', 'var(--c-ret)'], ['tool', 'Tool', 'var(--c-tool)'], ['llm', 'LLM first token', 'var(--c-llm)'], ['tts', 'TTS first audio', 'var(--c-tts)'],
  ];

  // Sessions without a recorded transcript in the mock get a short generic one.
  function turnsFor(s) {
    if (MOCK.turns[s.id]) return MOCK.turns[s.id];
    return [
      { role: 'bot', text: 'Namaste! This is an automated assistant for PM-KISAN.', route: 'greeting' },
      { role: 'user', text: s.lang === 'English' ? 'How much money do farmers get?' : 'Kitna paisa milta hai?' },
      { role: 'bot', text: s.lang === 'English' ? 'Eligible families get ₹6,000 a year in three instalments of ₹2,000.' : 'Paatra parivaron ko saal mein ₹6,000 milte hain, ₹2,000 ki teen kiston mein.', route: 'cache', sources: [['PM-KISAN Operational Guidelines', 2]], latency: { eos: 240, stt: 130, cache: 17, total: 402 }, cacheScore: 0.96 },
      { role: 'user', text: s.lang === 'English' ? 'Is e-KYC mandatory?' : 'e-KYC zaroori hai kya?' },
      { role: 'bot', text: s.lang === 'English' ? 'Yes, e-KYC is mandatory to keep receiving instalments.' : 'Haan, kiston ke liye e-KYC zaroori hai.', route: 'llm', sources: [['PM-KISAN FAQs', 7]], model: 'claude-haiku-5-5', latency: { eos: 260, stt: 140, retrieval: 90, llm: 310, tts: 110, total: 910 } },
    ];
  }

  function renderList() {
    const rows = MOCK.sessions.filter((s) => !channel || s.channel === channel);
    document.getElementById('sessCount').textContent = `${rows.length} sessions today`;
    document.getElementById('sessions').innerHTML = `
      <thead><tr><th>Session</th><th>Lang.</th><th class="num">p50</th><th>Outcome</th></tr></thead>
      <tbody>${rows.map((s) => `
        <tr class="is-clickable ${s.id === selected ? 'is-selected' : ''}" data-id="${esc(s.id)}" tabindex="0" ${s.id === selected ? 'aria-current="true"' : ''}>
          <td><div class="cell-title">${s.channel === 'voice' ? '📞' : '💬'} <span class="mono">${esc(s.id)}</span></div><div class="cell-sub">${esc(s.started)} · ${esc(s.duration)} · ${s.turns} turns</div></td>
          <td>${esc(s.lang)}</td><td class="num">${s.p50} ms</td><td>${badge(s.outcome)}</td></tr>`).join('')}</tbody>`;
  }

  function latencyHtml(l) {
    if (!l || !l.total) return '';
    const parts = STAGES.filter(([k]) => l[k]).map(([k, label, color]) => ({ label, ms: l[k], color }));
    const host = document.createElement('span');
    if (parts.length) Charts.stack(host, parts);
    return `${host.innerHTML}<strong>${l.total} ms</strong>`;
  }

  function renderDetail() {
    const s = MOCK.sessions.find((x) => x.id === selected) || MOCK.sessions[0];
    const turns = turnsFor(s);
    const p = MOCK.providers;
    const llmTurns = turns.filter((t) => t.latency && t.latency.total).map((t) => t.latency.total).sort((a, b) => a - b);
    const median = llmTurns.length ? llmTurns[Math.floor(llmTurns.length / 2)] : 0;
    document.getElementById('detail').innerHTML = `
      <div class="card__head">
        <div><h2>${s.channel === 'voice' ? '📞 Voice call' : '💬 Web chat'} <span class="mono">${esc(s.id)}</span> ${badge(s.outcome)}</h2>
          <p>${esc(s.caller)} · ${esc(s.lang)} · started ${esc(s.started)} · ${esc(s.duration)}</p></div>
        <div class="toolbar"><button class="btn btn--sm" id="dl">Download JSON</button></div>
      </div>
      <div class="card__body" style="display:grid;gap:16px">
        <dl class="kv">
          <dt>Providers</dt><dd class="mono">LLM ${esc(p.llm.active)} · STT ${s.channel === 'voice' ? esc(p.stt.active) : '—'} · TTS ${s.channel === 'voice' ? esc(p.tts.active) : '—'}</dd>
          <dt>Knowledge / prompt</dt><dd>KB v${MOCK.kb.version} · <span class="mono">answer_${s.channel} v3</span></dd>
          <dt>Median turn latency</dt><dd>${median} ms</dd>
          <dt>Billing</dt><dd>${s.channel === 'voice' ? esc(s.duration) + ' voice minutes' : '1 completed chatbot session'}</dd>
        </dl>
        <div class="stack-legend">${STAGES.map(([, label, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join('')}</div>
        <div class="turns">${turns.map((t) => {
          if (t.role === 'system') return `<div class="turn turn--system"><span class="turn__who">System</span><div class="turn__bubble">${esc(t.text)}</div></div>`;
          const who = t.role === 'user' ? (s.channel === 'voice' ? 'Caller' : 'Citizen') : 'AI';
          return `<div class="turn turn--${t.role}">
            <span class="turn__who">${who}</span>
            <div class="turn__bubble">
              <p class="turn__text">${esc(t.text)}</p>
              ${t.role === 'bot' ? `<div class="turn__meta">
                ${t.route ? `<span class="route route--${esc(t.route)}">${esc(t.route)}</span>` : ''}
                ${t.cacheScore ? `<span>similarity ${t.cacheScore}</span>` : ''}
                ${t.model ? `<span class="mono">${esc(t.model)}</span>` : ''}
                ${latencyHtml(t.latency)}</div>` : t.lang ? `<div class="turn__meta"><span class="mono">${esc(t.lang)}</span><span>PII masked before logging</span></div>` : ''}
              ${t.sources ? `<div class="turn__src">📄 ${t.sources.map(([title, page]) => `${esc(title)} p.${page}`).join(' · ')}</div>` : ''}
              ${t.tool ? `<div class="turn__tool">🔧 <span class="mono">${esc(t.tool.name)}(${esc(t.tool.args)})</span> → ${esc(t.tool.status)} · ${t.tool.ms} ms</div>` : ''}
              ${t.note ? `<div class="turn__note">${esc(t.note)}</div>` : ''}
            </div></div>`;
        }).join('')}</div>
      </div>`;
    document.getElementById('dl').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ session: s, turns }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = s.id + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  const table = document.getElementById('sessions');
  const choose = (row) => {
    selected = row.dataset.id;
    history.replaceState(null, '', '?id=' + encodeURIComponent(selected));
    renderList();
    renderDetail();
  };
  table.addEventListener('click', (e) => { const r = e.target.closest('tr[data-id]'); if (r) choose(r); });
  table.addEventListener('keydown', (e) => { const r = e.target.closest('tr[data-id]'); if (r && e.key === 'Enter') choose(r); });

  document.querySelectorAll('#channelSeg button').forEach((b) => b.addEventListener('click', () => {
    channel = b.dataset.ch;
    document.querySelectorAll('#channelSeg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderList();
  }));

  renderList();
  renderDetail();
});
