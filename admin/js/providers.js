// Providers & cache: pick active/fallback per kind, confirm, record in the change log.
document.addEventListener('DOMContentLoaded', () => {
  const { esc, badge, toast } = UI;
  const P = MOCK.providers;
  const draft = { llm: { ...P.llm }, stt: { ...P.stt }, tts: { ...P.tts } };
  const host = document.getElementById('providers');

  function card(kind) {
    const p = P[kind];
    const d = draft[kind];
    const changed = d.active !== p.active || d.fallback !== p.fallback;
    return `
      <section class="card" data-kind="${kind}">
        <div class="card__head"><div><h2>${esc(p.label)}</h2><p>${p.options.length} providers configured</p></div>${badge('ok', 'Live')}</div>
        <div class="card__body">
          <fieldset class="opts" style="border:0;padding:0;margin:0">
            <legend class="sr-only">Active ${esc(p.label)}</legend>
            ${p.options.map((o) => `
              <label class="opt ${d.active === o.id ? 'is-active' : ''}">
                <input type="radio" name="active-${kind}" value="${o.id}" ${d.active === o.id ? 'checked' : ''}>
                <span><span class="opt__name">${esc(o.name)}</span> ${o.id === p.active ? badge('info', 'Active') : ''}
                  <span class="opt__meta" style="display:block">${esc(o.vendor)} · ${esc(o.region)}</span>
                  <span class="opt__meta" style="display:block">${esc(o.use)} · <span class="mono">${esc(o.version)}</span></span></span>
                <span class="opt__lat">${o.p50} ms<br>${badge(o.health)}</span>
              </label>`).join('')}
          </fieldset>
          <div class="prov-foot">
            <label class="field"><span>Backup (fallback) provider</span>
              <select data-fallback>${p.options.filter((o) => o.id !== d.active).map((o) => `<option value="${o.id}" ${d.fallback === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
            <div class="toolbar" style="justify-content:space-between">
              <span class="${changed ? 'changed' : 'note'}">${changed ? 'Unsaved change' : 'Version-pinned · rollback ≤ 30 min'}</span>
              <span class="toolbar"><button class="btn btn--sm" data-test>Test</button><button class="btn btn--sm btn--primary" data-apply ${changed ? '' : 'disabled'}>Apply</button></span>
            </div>
          </div>
        </div>
      </section>`;
  }

  function render() { host.innerHTML = ['llm', 'stt', 'tts'].map(card).join(''); }

  host.addEventListener('change', (e) => {
    const c = e.target.closest('[data-kind]');
    if (!c) return;
    const kind = c.dataset.kind;
    if (e.target.name === 'active-' + kind) {
      draft[kind].active = e.target.value;
      if (draft[kind].fallback === e.target.value) draft[kind].fallback = P[kind].options.find((o) => o.id !== e.target.value).id;
    }
    if (e.target.matches('[data-fallback]')) draft[kind].fallback = e.target.value;
    render();
    host.querySelector(`[data-kind="${kind}"] input[value="${draft[kind].active}"]`).focus();
  });

  const modal = document.getElementById('confirm');
  let pending = null;
  host.addEventListener('click', (e) => {
    const c = e.target.closest('[data-kind]');
    if (!c) return;
    const kind = c.dataset.kind;
    const name = (id) => P[kind].options.find((o) => o.id === id).name;
    if (e.target.closest('[data-test]')) {
      const o = P[kind].options.find((x) => x.id === draft[kind].active);
      toast(`${o.name}: test request OK in ${o.p50 + Math.round(Math.random() * 40)} ms`);
      return;
    }
    if (e.target.closest('[data-apply]')) {
      pending = kind;
      document.getElementById('confirmBody').innerHTML = `
        <p><strong>${esc(P[kind].label)}</strong>: ${esc(name(P[kind].active))} → <strong>${esc(name(draft[kind].active))}</strong><br>
        Backup: ${esc(name(draft[kind].fallback))}</p>
        <p>New calls and chats use it immediately. Live sessions keep their current provider. Run an evaluation afterwards to confirm quality.</p>`;
      modal.hidden = false;
      document.getElementById('confirmYes').focus();
    }
  });

  function closeModal() { modal.hidden = true; pending = null; }
  document.getElementById('confirmNo').addEventListener('click', closeModal);
  modal.querySelector('.scrim').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  document.getElementById('confirmYes').addEventListener('click', () => {
    const kind = pending;
    const from = P[kind].active;
    P[kind].active = draft[kind].active;
    P[kind].fallback = draft[kind].fallback;
    MOCK.changeLog.unshift({ at: new Date().toISOString().slice(0, 16).replace('T', ' '), who: 'admin@dic', kind: kind.toUpperCase(), from, to: P[kind].active, note: 'Manual switch from admin console' });
    closeModal();
    render();
    renderLog();
    toast(`${kind.toUpperCase()} switched. The next call uses the new provider.`);
  });

  function renderLog() {
    document.getElementById('log').innerHTML = `
      <thead><tr><th>When</th><th>Who</th><th>What</th><th>From</th><th>To</th><th>Note</th></tr></thead>
      <tbody>${MOCK.changeLog.map((c) => `<tr><td>${esc(c.at)}</td><td>${esc(c.who)}</td><td>${badge('info', c.kind)}</td>
        <td class="mono">${esc(c.from)}</td><td class="mono">${esc(c.to)}</td><td>${esc(c.note)}</td></tr>`).join('')}</tbody>`;
  }

  const th = document.getElementById('threshold');
  th.addEventListener('input', () => { document.getElementById('thVal').textContent = Number(th.value).toFixed(2); });
  th.addEventListener('change', () => {
    MOCK.changeLog.unshift({ at: new Date().toISOString().slice(0, 16).replace('T', ' '), who: 'admin@dic', kind: 'Cache', from: 'threshold ' + MOCK.cache.threshold, to: 'threshold ' + Number(th.value).toFixed(2), note: 'Changed in admin console' });
    MOCK.cache.threshold = Number(th.value).toFixed(2);
    renderLog();
  });
  document.getElementById('cacheOn').addEventListener('change', (e) => toast(e.target.checked ? 'Cache enabled.' : 'Cache disabled: every turn now goes to retrieval + LLM (use this for the no-cache baseline).'));
  document.getElementById('warmCache').addEventListener('click', () => toast('Pre-warming: 127 FAQ questions and paraphrases queued (demo).'));
  document.getElementById('clearCache').addEventListener('click', () => toast('Cache cleared (demo).'));
  document.getElementById('drill').addEventListener('click', () => toast('Drill: STT primary marked down → backup took over in 41 s (simulated).'));

  render();
  renderLog();
});
