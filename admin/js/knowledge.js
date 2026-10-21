// Knowledge base: list, upload (simulated ingestion), publish/unpublish, preview drawer, retrieval test.
document.addEventListener('DOMContentLoaded', () => {
  const { esc, badge, toast } = UI;
  const docs = MOCK.documents;
  const table = document.getElementById('docs');
  const search = document.getElementById('docSearch');
  const filter = document.getElementById('docFilter');

  const typeIcon = { PDF: '📕', DOCX: '📘', TXT: '📄', CSV: '📊', XLSX: '📗' };

  function bumpVersion() {
    MOCK.kb.version += 1;
    document.querySelectorAll('[data-kb-version]').forEach((n) => { n.textContent = MOCK.kb.version; });
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const f = filter.value;
    const rows = docs.filter((d) => (!f || d.status === f) && (!q || (d.title + d.file).toLowerCase().includes(q)));
    document.getElementById('docCount').textContent =
      `${docs.filter((d) => d.status === 'published').length} published · ${docs.filter((d) => d.status === 'draft').length} draft · KB version ${MOCK.kb.version}`;
    table.innerHTML = `
      <thead><tr><th>Document</th><th>Audience</th><th class="num">Ver.</th><th class="num">Chunks / rows</th><th>Status</th><th>Updated</th><th><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${rows.length ? rows.map((d) => `
        <tr class="is-clickable" data-id="${d.id}">
          <td><div class="cell-title">${typeIcon[d.type] || '📄'} ${esc(d.title)} ${d.priority === 'high' ? badge('warn', 'High priority') : ''}</div>
              <div class="cell-sub mono">${esc(d.file)} · ${esc(d.size)}</div></td>
          <td>${badge(d.audience)}</td>
          <td class="num">v${d.version}</td>
          <td class="num">${d.status === 'processing' ? `<span class="progress" aria-label="Processing"><span style="width:${d.progress || 10}%"></span></span>` : d.rows ? d.rows.toLocaleString('en-IN') + ' rows' : d.chunks}</td>
          <td>${badge(d.status)}</td>
          <td><div>${esc(d.updated)}</div><div class="cell-sub">${esc(d.by)}</div></td>
          <td class="num">${d.status === 'draft' ? `<button class="btn btn--sm btn--primary" data-act="publish">Publish</button>`
            : d.status === 'published' ? `<button class="btn btn--sm" data-act="unpublish">Unpublish</button>` : ''}</td>
        </tr>`).join('') : `<tr><td colspan="7" class="empty">No documents match.</td></tr>`}</tbody>`;
  }

  table.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const doc = docs.find((d) => d.id === row.dataset.id);
    const act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation();
      if (act.dataset.act === 'publish') {
        doc.status = 'published';
        bumpVersion();
        toast(`Published "${doc.title}". KB is now v${MOCK.kb.version}; cached answers from older versions stop matching.`);
      } else {
        doc.status = 'draft';
        bumpVersion();
        toast(`"${doc.title}" is no longer searched by live calls.`);
      }
      render();
      return;
    }
    openPreview(doc);
  });
  search.addEventListener('input', render);
  filter.addEventListener('change', render);

  // ---------- upload (simulated ingestion pipeline) ----------
  const zone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', (e) => ingest([...e.dataTransfer.files]));
  fileInput.addEventListener('change', () => { ingest([...fileInput.files]); fileInput.value = ''; });

  function ingest(files) {
    const audience = document.querySelector('input[name=aud]:checked').value;
    const priority = document.getElementById('priority').checked ? 'high' : undefined;
    files.forEach((f) => {
      const ext = (f.name.split('.').pop() || '').toUpperCase();
      if (!['PDF', 'DOCX', 'TXT', 'CSV', 'XLSX'].includes(ext)) { toast(`${f.name}: unsupported file type`); return; }
      const structured = ext === 'CSV' || ext === 'XLSX';
      const doc = {
        id: 'u' + Date.now() + Math.random().toString(36).slice(2, 5), title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
        file: f.name, type: ext, audience: structured ? 'tool' : audience, version: 1, status: 'processing', progress: 5,
        chunks: 0, size: (f.size / 1024).toFixed(0) + ' KB', updated: new Date().toISOString().slice(0, 16).replace('T', ' '), by: 'admin@dic', priority,
      };
      docs.unshift(doc);
      MOCK.chunks[doc.id] = [{ page: 1, section: 'Preview', text: 'Parsed text appears here once the ingestion worker (Docling) has processed the file.' }];
      render();
      const steps = [25, 55, 80, 100];
      steps.forEach((p, i) => setTimeout(() => {
        doc.progress = p;
        if (p === 100) {
          doc.status = 'draft';
          if (structured) { doc.rows = Math.floor(50 + Math.random() * 900); doc.lookup = 'id'; } else { doc.chunks = Math.floor(8 + f.size / 4000) % 120 || 12; }
          toast(`${f.name} is ready as a draft. Review it, then publish.`);
        }
        render();
      }, 700 * (i + 1)));
    });
  }

  // ---------- preview drawer ----------
  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('scrim');
  function openPreview(doc) {
    document.getElementById('drawerTitle').textContent = doc.title;
    document.getElementById('drawerSub').innerHTML = `${esc(doc.file)} · ${badge(doc.status)} ${badge(doc.audience)}`;
    const stages = ['Uploaded', 'Parsed', 'Chunked', 'Embedded', 'Indexed'];
    const doneCount = doc.status === 'processing' ? Math.ceil((doc.progress || 0) / 25) : stages.length;
    let body = `
      <div class="pipeline" aria-label="Ingestion steps">${stages.map((s, i) => `<span class="${i < doneCount ? 'done' : ''}">${i < doneCount ? '✓ ' : ''}${s}</span>`).join('')}</div>
      <dl class="kv">
        <dt>Version</dt><dd>v${doc.version}</dd>
        <dt>Audience</dt><dd>${doc.audience === 'internal' ? 'Officers only (agent assist)' : doc.audience === 'tool' ? `Structured data behind the tool <code>${esc(doc.tool || 'lookup_' + doc.id)}</code>` : 'Citizens, chat and officers'}</dd>
        ${doc.pages ? `<dt>Pages</dt><dd>${doc.pages}</dd>` : ''}
        ${doc.lookup ? `<dt>Lookup column</dt><dd><code>${esc(doc.lookup)}</code> · needs auth level ${doc.minAuth ?? 1}</dd>` : ''}
        <dt>Updated</dt><dd>${esc(doc.updated)} by ${esc(doc.by)}</dd>
      </dl>`;
    const tbl = MOCK.tables[doc.id];
    if (tbl) {
      body += `<div><h3 style="font-size:14px;margin-bottom:8px">Data preview</h3>
        <p class="note">The AI never writes SQL. It can only call a fixed lookup by <code>${esc(doc.lookup)}</code>.</p>
        <div class="table-wrap"><table class="data"><thead><tr>${tbl.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${tbl.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    } else {
      const ch = MOCK.chunks[doc.id] || [];
      body += `<div><h3 style="font-size:14px;margin-bottom:8px">Chunks (${doc.chunks || ch.length}) <span class="note">showing ${ch.length}</span></h3>
        <div class="grid" style="gap:8px">${ch.map((c, i) => `
          <div class="chunk"><div class="chunk__meta"><span class="mono">#${i + 1}</span><span>p.${c.page}</span><span>${esc(c.section)}</span></div><p>${esc(c.text)}</p></div>`).join('') || '<p class="empty">No chunks yet.</p>'}</div></div>`;
    }
    body += `<div class="toolbar">
      ${doc.status === 'draft' ? '<button class="btn btn--primary" data-drawer="publish">Publish</button>' : ''}
      <button class="btn" data-drawer="reindex">Re-index</button>
      <button class="btn btn--danger" data-drawer="delete">Delete (erases chunks and cache)</button></div>`;
    const bodyEl = document.getElementById('drawerBody');
    bodyEl.innerHTML = body;
    bodyEl.onclick = (e) => {
      const b = e.target.closest('[data-drawer]');
      if (!b) return;
      if (b.dataset.drawer === 'publish') { doc.status = 'published'; bumpVersion(); toast(`Published. KB is now v${MOCK.kb.version}.`); }
      if (b.dataset.drawer === 'reindex') toast('Re-index queued (demo).');
      if (b.dataset.drawer === 'delete') { docs.splice(docs.indexOf(doc), 1); bumpVersion(); toast('Deleted. Chunks, embeddings and cached answers are removed.'); }
      closePreview();
      render();
    };
    drawer.hidden = false;
    requestAnimationFrame(() => { drawer.classList.add('is-open'); scrim.classList.add('is-open'); });
    document.getElementById('drawerClose').focus();
  }
  function closePreview() {
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    setTimeout(() => { drawer.hidden = true; }, 200);
  }
  document.getElementById('drawerClose').addEventListener('click', closePreview);
  scrim.addEventListener('click', closePreview);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closePreview(); });

  // ---------- retrieval test (keyword overlap stands in for hybrid search + rerank) ----------
  const STOP = new Set('the a an is are to of for and or in on what which how do i my me be can with by at it this that'.split(' '));
  const tokens = (s) => s.toLowerCase().match(/[\p{L}\p{N}₹]+/gu)?.filter((w) => !STOP.has(w) && w.length > 1) || [];
  document.getElementById('testForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('testQ').value;
    const aud = document.getElementById('testAud').value;
    const qt = tokens(q);
    const hits = [];
    docs.filter((d) => d.status === 'published' && (d.audience === 'public' || (aud === 'internal' && d.audience === 'internal'))).forEach((d) => {
      (MOCK.chunks[d.id] || []).forEach((c) => {
        const ct = tokens(c.text + ' ' + c.section);
        const overlap = qt.filter((w) => ct.some((x) => x.startsWith(w.slice(0, 5)))).length;
        if (overlap) hits.push({ d, c, score: Math.min(0.99, 0.42 + overlap / (qt.length + 1)) });
      });
    });
    hits.sort((a, b) => b.score - a.score);
    const top = hits.slice(0, 4);
    const out = document.getElementById('testOut');
    if (!top.length || top[0].score < 0.55) {
      out.innerHTML = `<div class="answer" style="background:var(--warn-bg);border-color:#f3d79b"><div class="answer__label" style="color:var(--warn)">No confident match</div>
        The bot would say it doesn't have this information and offer an officer. Consider adding a document.</div>`;
      return;
    }
    out.innerHTML = `
      <div class="answer"><div class="answer__label">What the bot would ground its answer on</div>${esc(top[0].c.text)}
        <div class="note" style="margin-top:6px">Source: ${esc(top[0].d.title)}, p.${top[0].c.page}</div></div>
      <div class="grid" style="gap:8px">${top.map((h) => `
        <div class="chunk hit"><div class="chunk__meta"><span class="score">${h.score.toFixed(2)}</span><span>${esc(h.d.title)}</span><span>p.${h.c.page}</span>${badge(h.d.audience)}</div><p>${esc(h.c.text)}</p></div>`).join('')}</div>`;
  });

  render();
});
