// Knowledge base: one "Update knowledge base" action (add files or a web page → read, chunk, embed,
// safety-check, publish as a new version, clear the cache), the list of live sources, and a retrieval test.
import { useEffect, useMemo, useRef, useState } from 'react';
import Badge from '../components/Badge.jsx';
import { Drawer, Modal } from '../components/Overlay.jsx';
import { useToast } from '../components/Toast.jsx';
import { stamp } from '../lib/format.js';
import { MIN_CONFIDENCE, retrieve } from '../lib/retrieve.js';
import { useStore } from '../store.jsx';
import Icon from '../components/Icon.jsx';

const SUPPORTED = ['PDF', 'DOCX', 'TXT', 'CSV', 'XLSX'];
const FILTERS = [['all', 'All'], ['public', 'Public'], ['internal', 'Officers only'], ['tool', 'Data tables']];

function langOf(doc) {
  if (/[ఀ-౿]/.test(doc.title)) return 'Telugu';
  if (/[ഀ-ൿ]/.test(doc.title)) return 'Malayalam';
  if (/[ऀ-ॿ]/.test(doc.title)) return 'Hindi';
  return 'English';
}
const sizeOf = (doc) => (doc.rows ? `${doc.rows.toLocaleString('en-IN')} rows` : `${doc.chunks} passages${doc.pages ? ` · ${doc.pages} pages` : ''}`);

const TYPE_ICON = { URL: 'globe', CSV: 'table', XLSX: 'table' };

export default function Knowledge() {
  const { documents, setDocuments, chunks, kb, applyKbChange, cache, clearCache, warmCache, changeLog } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [previewId, setPreviewId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const live = documents.filter((d) => d.status === 'published');
  const rows = useMemo(() => documents.filter((d) =>
    (filter === 'all' || d.audience === filter) && (!query || `${d.title} ${d.file}`.toLowerCase().includes(query.trim().toLowerCase()))),
  [documents, filter, query]);
  const preview = documents.find((d) => d.id === previewId);
  const history = changeLog.filter((c) => c.kind === 'Knowledge');
  const lastUpdate = history[0];

  useEffect(() => {
    if (!menuId) return undefined;
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuId]);

  function reindex(doc) {
    setDocuments((docs) => docs.map((d) => (d.id === doc.id ? { ...d, updated: stamp() } : d)));
    const r = applyKbChange(`Re-indexed "${doc.title}"`);
    toast(`Re-indexed "${doc.title}". Now KB v${r.to}; ${r.cleared.toLocaleString('en-IN')} cached answers cleared.`);
  }

  function remove(doc) {
    setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
    const r = applyKbChange(`Removed "${doc.title}"`);
    setRemoving(null);
    setPreviewId(null);
    toast(`Removed "${doc.title}". Now KB v${r.to}; its passages and ${r.cleared.toLocaleString('en-IN')} cached answers are gone.`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Knowledge base</h1>
          <p>What the assistant answers from, on voice, chat and agent assist. Add or replace documents with one update: it becomes a new version and the old cached answers are cleared automatically.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn--primary" onClick={() => setUpdating(true)}>
            <Icon name="plus" />
            Update knowledge base
          </button>
        </div>
      </div>

      <section className="card">
        <div className="kb-status">
          <div className="kb-status__ver"><span className="live-dot" aria-hidden="true" /><div><div className="note">Live version</div><strong>v{kb.version}</strong></div></div>
          <div className="kb-status__stat"><span>Sources</span><b>{live.length}</b></div>
          <div className="kb-status__stat"><span>Passages</span><b>{live.reduce((a, d) => a + (d.chunks || 0), 0).toLocaleString('en-IN')}</b></div>
          <div className="kb-status__stat"><span>Cached answers</span><b>{cache.entries.toLocaleString('en-IN')}</b></div>
          <div className="kb-status__stat"><span>Last update</span><b>{lastUpdate ? lastUpdate.at : '—'}</b></div>
          <div className="kb-status__actions">
            <button type="button" className="btn btn--sm" onClick={() => toast(`Pre-warmed ${warmCache()} FAQ answers for KB v${kb.version}.`)}>Pre-warm cache</button>
            <button type="button" className="btn btn--sm" onClick={() => toast(`Cache cleared (${clearCache('Cleared from knowledge base page').toLocaleString('en-IN')} answers).`)}>Clear cache</button>
            <button type="button" className="btn btn--sm btn--ghost" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}>{showHistory ? 'Hide history' : 'History'}</button>
          </div>
        </div>
        {showHistory && (
          <div className="card__body" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <ol className="versions" aria-label="Version history">
              {history.map((h) => <li key={`${h.at}-${h.to}`}><strong>{h.to}</strong><span>{h.note}</span><span className="note">{h.at} · {h.who}</span></li>)}
            </ol>
          </div>
        )}
      </section>

      <div className="grid grid--3-1">
        <section className="card">
          <div className="card__head">
            <div className="chips" role="group" aria-label="Filter sources">
              {FILTERS.map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}
            </div>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sources" aria-label="Search sources" style={{ width: 220 }} />
          </div>
          <ul className="sources">
            {rows.length === 0 && <li className="empty">No sources match.</li>}
            {rows.map((d) => (
              <li key={d.id} className="source" onClick={() => setPreviewId(d.id)}>
                <span className="source__icon"><Icon name={TYPE_ICON[d.type] || 'file'} size={20} /></span>
                <span style={{ minWidth: 0 }}>
                  <span className="source__title" style={{ display: 'block' }}>{d.title}</span>
                  <span className="source__meta">
                    <span>{d.type}</span><span>·</span><span>{sizeOf(d)}</span><span>·</span><span>{langOf(d)}</span><span>·</span><span>v{d.version} · {d.updated}</span>
                    {d.priority === 'high' && <Badge tone="warn">Priority</Badge>}
                  </span>
                </span>
                <Badge status={d.audience}>{d.audience === 'internal' ? 'Officers only' : undefined}</Badge>
                <span className="source__menu" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="icon-btn" aria-label={`Options for ${d.title}`} aria-expanded={menuId === d.id}
                    onClick={(e) => { e.stopPropagation(); setMenuId(menuId === d.id ? null : d.id); }}>
                    <Icon name="more" size={20} />
                  </button>
                  {menuId === d.id && (
                    <div className="menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); setPreviewId(d.id); }}><Icon name="eye" />Preview</button>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); reindex(d); }}><Icon name="refresh" />Re-index</button>
                      <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuId(null); setRemoving(d); }}><Icon name="trash" />Remove…</button>
                    </div>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <RetrievalTest documents={documents} chunks={chunks} />
      </div>

      <Drawer open={!!preview} onClose={() => setPreviewId(null)} title={preview?.title}
        subtitle={preview && <>{preview.file} · <Badge status={preview.audience} /></>}>
        {preview && <Preview doc={preview} chunks={chunks[preview.id] || []} onReindex={() => { reindex(preview); setPreviewId(null); }} onRemove={() => setRemoving(preview)} />}
      </Drawer>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Remove "${removing?.title}"?`}
        footer={<><button type="button" className="btn" onClick={() => setRemoving(null)}>Cancel</button><button type="button" className="btn btn--primary" onClick={() => remove(removing)}>Remove and update</button></>}>
        <p>Its passages and embeddings are deleted, the knowledge base moves to v{kb.version + 1}, and {cache.entries.toLocaleString('en-IN')} cached answers are cleared. Calls stop using it straight away.</p>
      </Modal>

      <UpdateKnowledge open={updating} onClose={() => setUpdating(false)} />
    </>
  );
}

// ---------- the one-button update ----------
function UpdateKnowledge({ open, onClose }) {
  const { kb, cache, setDocuments, setChunks, applyKbChange, warmCache } = useStore();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState('pick'); // pick | run | done
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function reset() { setItems([]); setUrl(''); setNote(''); setPhase('pick'); setStep(0); setResult(null); }
  function close() { if (phase === 'run') return; onClose(); setTimeout(reset, 200); }

  function addFiles(files) {
    const next = [];
    files.forEach((f) => {
      const ext = (f.name.split('.').pop() || '').toUpperCase();
      if (!SUPPORTED.includes(ext)) { toast(`${f.name}: use PDF, DOCX, TXT, CSV or XLSX`); return; }
      next.push({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 5)}`, name: f.name, type: ext, size: f.size, audience: ext === 'CSV' || ext === 'XLSX' ? 'tool' : 'public' });
    });
    setItems((x) => [...x, ...next]);
  }

  function addUrl(e) {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(u)) { toast('Enter a full web address, starting with https://'); return; }
    setItems((x) => [...x, { id: u, name: u.replace(/^https?:\/\//, ''), type: 'URL', size: 0, audience: 'public' }]);
    setUrl('');
  }

  const steps = [
    `Reading ${items.length} source${items.length === 1 ? '' : 's'}`,
    'Splitting into passages with page numbers',
    'Creating embeddings (bge-m3)',
    'Checking for hidden instructions',
    `Publishing as version v${kb.version + 1}`,
    `Clearing ${cache.entries.toLocaleString('en-IN')} cached answers from v${kb.version}`,
  ];

  function run() {
    setPhase('run');
    setStep(0);
    steps.forEach((_, i) => timers.current.push(setTimeout(() => setStep(i + 1), 650 * (i + 1))));
    timers.current.push(setTimeout(() => {
      const added = items.map((it) => {
        const id = `u${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
        const structured = it.audience === 'tool';
        return {
          id, title: it.type === 'URL' ? it.name : it.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), file: it.name, type: it.type, audience: it.audience,
          version: 1, status: 'published', size: it.type === 'URL' ? 'web page' : `${Math.max(1, Math.round(it.size / 1024))} KB`,
          ...(structured ? { rows: 50 + Math.floor(Math.random() * 900), lookup: 'id', chunks: 0 } : { chunks: 8 + Math.floor(Math.random() * 40), pages: it.type === 'URL' ? undefined : 2 + Math.floor(Math.random() * 20) }),
          updated: stamp(), by: 'admin@dic',
        };
      });
      setDocuments((docs) => [...added, ...docs]);
      setChunks((c) => ({ ...c, ...Object.fromEntries(added.map((d) => [d.id, [{ page: 1, section: 'Preview', text: `Passages from ${d.file} appear here once the ingestion worker processes the real file.` }]])) }));
      const r = applyKbChange(note.trim() || `Added ${added.map((d) => `"${d.title}"`).join(', ')}`);
      setResult({ ...r, added: added.length });
      setPhase('done');
    }, 650 * steps.length + 400));
  }

  return (
    <Modal open={open} onClose={close} title={phase === 'done' ? 'Knowledge base updated' : 'Update knowledge base'}
      footer={phase === 'pick' ? (
        <><button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!items.length} onClick={run}>Update knowledge base</button></>
      ) : phase === 'done' ? (
        <><button type="button" className="btn" onClick={() => toast(`Pre-warmed ${warmCache()} FAQ answers for KB v${result.to}.`)}>Pre-warm cache</button>
          <button type="button" className="btn btn--primary" onClick={close}>Done</button></>
      ) : null}>
      {phase === 'pick' && (
        <div className="upd">
          <div className="upd__pick">
            <button type="button" className={`upd__tile ${over ? 'is-over' : ''}`} onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); addFiles([...e.dataTransfer.files]); }}>
              <Icon name="upload" size={22} />
              <strong>Upload files</strong><span>PDF, DOCX, TXT, CSV, XLSX</span>
            </button>
            <form className="upd__tile" style={{ cursor: 'default' }} onSubmit={addUrl}>
              <Icon name="link" size={22} />
              <strong>Add a web page</strong>
              <span className="upd__url" style={{ width: '100%' }}>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Web page address" />
                <button type="submit" className="btn btn--sm">Add</button>
              </span>
            </form>
          </div>
          <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.csv,.xlsx" className="sr-only" tabIndex={-1}
            onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />

          {items.length > 0 && (
            <ul className="upd__list">
              {items.map((it) => (
                <li key={it.id} className="upd__item">
                  <span className="source__icon" title={it.type}><Icon name={TYPE_ICON[it.type] || 'file'} size={20} /></span>
                  <span className="source__title">{it.name}</span>
                  <select value={it.audience} aria-label={`Who can use ${it.name}`} disabled={it.audience === 'tool'}
                    onChange={(e) => setItems((x) => x.map((y) => (y.id === it.id ? { ...y, audience: e.target.value } : y)))}>
                    {it.audience === 'tool' ? <option value="tool">Data table</option> : <><option value="public">Public</option><option value="internal">Officers only</option></>}
                  </select>
                  <button type="button" className="icon-btn" aria-label={`Remove ${it.name}`} onClick={() => setItems((x) => x.filter((y) => y.id !== it.id))}><Icon name="x" /></button>
                </li>
              ))}
            </ul>
          )}
          <label className="field"><span>What changed? (optional, shown in the version history)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. New e-KYC circular for November" /></label>
          <p className="note" style={{ margin: 0 }}>Live now: v{kb.version}. Updating publishes v{kb.version + 1} and clears {cache.entries.toLocaleString('en-IN')} cached answers, so callers never get an outdated answer.</p>
        </div>
      )}

      {phase === 'run' && (
        <div className="upd" role="status" aria-live="polite">
          <div className="upd__bar"><span style={{ width: `${(step / steps.length) * 100}%` }} /></div>
          <ol className="upd__steps">
            {steps.map((s, i) => (
              <li key={s} className={i < step ? 'is-done' : i === step ? 'is-active' : ''}>
                <span className="tick" aria-hidden="true">{i < step ? <Icon name="check" size={14} /> : ''}</span><span>{s}</span><span className="note">{i < step ? 'done' : ''}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="upd__done">
          <div className="big" aria-hidden="true"><Icon name="check" size={26} /></div>
          <h3>Live as v{result.to}</h3>
          <p>{result.added} source{result.added === 1 ? '' : 's'} added · {result.cleared.toLocaleString('en-IN')} cached answers from v{result.from} cleared. New calls and chats use it now.</p>
        </div>
      )}
    </Modal>
  );
}

function RetrievalTest({ documents, chunks }) {
  const [q, setQ] = useState('What documents are needed to register?');
  const [as, setAs] = useState('public');
  const [result, setResult] = useState(null);
  const confident = result && result.length > 0 && result[0].score >= MIN_CONFIDENCE;
  return (
    <section className="card">
      <div className="card__head"><div><h2>Test a question</h2><p>Runs retrieval exactly as a live call would</p></div></div>
      <div className="card__body" style={{ display: 'grid', gap: 10 }}>
        <form onSubmit={(e) => { e.preventDefault(); setResult(retrieve(q, documents, chunks, { audience: as })); }} style={{ display: 'grid', gap: 8 }}>
          <textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question" />
          <div className="toolbar">
            <select value={as} onChange={(e) => setAs(e.target.value)} aria-label="Search as" style={{ flex: 1 }}>
              <option value="public">As a citizen (public)</option><option value="internal">As an officer (+ internal)</option>
            </select>
            <button className="btn btn--primary" type="submit">Search</button>
          </div>
        </form>
        {result && !confident && (
          <div className="answer answer--warn"><div className="answer__label">No confident match</div>
            The bot would say it doesn't have this information and offer an officer. Consider adding a document.</div>
        )}
        {confident && (
          <>
            <div className="answer">
              <div className="answer__label">The bot would answer from</div>
              {result[0].chunk.text}
              <div className="note" style={{ marginTop: 6 }}>Source: {result[0].doc.title}, p.{result[0].chunk.page}</div>
            </div>
            {result.slice(1).map((h) => (
              <div key={`${h.doc.id}-${h.chunk.page}-${h.chunk.section}`} className="chunk hit">
                <div className="chunk__meta"><span className="score">{h.score.toFixed(2)}</span><span>{h.doc.title}</span><span>p.{h.chunk.page}</span></div>
                <p>{h.chunk.text}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function Preview({ doc, chunks, onReindex, onRemove }) {
  const { tables } = useStore();
  const table = tables[doc.id];
  return (
    <>
      <div className="pipeline" aria-label="Ingestion steps">{['Read', 'Chunked', 'Embedded', 'Safety-checked', 'Live'].map((s) => <span key={s} className="done"><Icon name="check" size={13} />{s}</span>)}</div>
      <dl className="kv">
        <dt>Version</dt><dd>v{doc.version}</dd>
        <dt>Language</dt><dd>{langOf(doc)}</dd>
        <dt>Who can use it</dt>
        <dd>{doc.audience === 'internal' ? 'Officers only (agent assist)'
          : doc.audience === 'tool' ? <>Data table behind the tool <code>{doc.tool || `lookup_${doc.id}`}</code></>
            : 'Citizens, chat and officers'}</dd>
        {doc.pages && <><dt>Pages</dt><dd>{doc.pages}</dd></>}
        {doc.lookup && <><dt>Lookup column</dt><dd><code>{doc.lookup}</code> · needs OTP verification</dd></>}
        <dt>Updated</dt><dd>{doc.updated} by {doc.by}</dd>
      </dl>
      {table ? (
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Data preview</h3>
          <p className="note">The AI never writes SQL. It can only call a fixed lookup by <code>{doc.lookup}</code>.</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{table.rows.map((r) => <tr key={r[0]}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Passages ({doc.chunks || chunks.length}) <span className="note">showing {chunks.length}</span></h3>
          <div className="grid" style={{ gap: 8 }}>
            {chunks.length === 0 && <p className="empty">No passages yet.</p>}
            {chunks.map((c, i) => (
              <div key={i} className="chunk">
                <div className="chunk__meta"><span className="mono">#{i + 1}</span><span>p.{c.page}</span><span>{c.section}</span></div>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="toolbar">
        <button type="button" className="btn" onClick={onReindex}>Re-index</button>
        <button type="button" className="btn btn--danger" onClick={onRemove}>Remove…</button>
      </div>
    </>
  );
}
