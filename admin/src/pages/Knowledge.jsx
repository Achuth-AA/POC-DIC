import { useMemo, useRef, useState } from 'react';
import Badge from '../components/Badge.jsx';
import { Drawer } from '../components/Overlay.jsx';
import { useToast } from '../components/Toast.jsx';
import { stamp } from '../lib/format.js';
import { useStore } from '../store.jsx';

const TYPE_ICON = { PDF: '📕', DOCX: '📘', TXT: '📄', CSV: '📊', XLSX: '📗' };
const SUPPORTED = ['PDF', 'DOCX', 'TXT', 'CSV', 'XLSX'];
const STAGES = ['Uploaded', 'Parsed', 'Chunked', 'Embedded', 'Indexed'];

// Keyword overlap stands in for hybrid search + rerank until the backend exists.
const STOP = new Set('the a an is are to of for and or in on what which how do i my me be can with by at it this that'.split(' '));
const tokens = (s) => s.toLowerCase().match(/[\p{L}\p{N}₹]+/gu)?.filter((w) => !STOP.has(w) && w.length > 1) || [];

export default function Knowledge() {
  const { documents, setDocuments, chunks, setChunks, tables, kb, applyKbChange } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [previewId, setPreviewId] = useState(null);

  const rows = useMemo(() => documents.filter((d) =>
    (!status || d.status === status) && (!query || (d.title + d.file).toLowerCase().includes(query.trim().toLowerCase()))),
  [documents, status, query]);
  const preview = documents.find((d) => d.id === previewId);

  const updateDoc = (id, patch) => setDocuments((docs) => docs.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  function setPublished(doc, publish) {
    updateDoc(doc.id, { status: publish ? 'published' : 'draft' });
    const r = applyKbChange(`${publish ? 'Published' : 'Unpublished'} "${doc.title}"`);
    toast(`${publish ? 'Published' : 'Unpublished'} "${doc.title}". KB v${r.from} → v${r.to}; ${r.cleared.toLocaleString('en-IN')} cached answers cleared.`);
  }

  function remove(doc) {
    setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
    const r = applyKbChange(`Deleted "${doc.title}"`);
    setPreviewId(null);
    toast(`Deleted. Chunks and embeddings removed; KB v${r.to}, ${r.cleared.toLocaleString('en-IN')} cached answers cleared.`);
  }

  function reindex(doc) {
    updateDoc(doc.id, { updated: stamp() });
    const r = applyKbChange(`Re-indexed "${doc.title}"`);
    toast(`Re-indexed "${doc.title}". KB v${r.to}; cache cleared.`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Knowledge base</h1>
          <p>One knowledge base for the voice bot, web chat and agent assist. Only <strong>published</strong> documents are searched; <strong>internal</strong> ones are visible to officers only.</p>
        </div>
      </div>

      <div className="grid grid--3-1">
        <section className="card">
          <div className="card__head">
            <div>
              <h2>Documents</h2>
              <p>{documents.filter((d) => d.status === 'published').length} published · {documents.filter((d) => d.status === 'draft').length} draft · KB version {kb.version}</p>
            </div>
            <div className="toolbar">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents" aria-label="Search documents" />
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="processing">Processing</option>
              </select>
            </div>
          </div>
          <div className="card__body card__body--flush table-wrap">
            <table className="data">
              <thead><tr><th>Document</th><th>Audience</th><th className="num">Ver.</th><th className="num">Chunks / rows</th><th>Status</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} className="empty">No documents match.</td></tr>}
                {rows.map((d) => (
                  <tr key={d.id} className="is-clickable" onClick={() => setPreviewId(d.id)}>
                    <td>
                      <div className="cell-title">{TYPE_ICON[d.type] || '📄'} {d.title} {d.priority === 'high' && <Badge tone="warn">High priority</Badge>}</div>
                      <div className="cell-sub mono">{d.file} · {d.size}</div>
                    </td>
                    <td><Badge status={d.audience} /></td>
                    <td className="num">v{d.version}</td>
                    <td className="num">
                      {d.status === 'processing'
                        ? <span className="progress" aria-label="Processing"><span style={{ width: `${d.progress || 10}%` }} /></span>
                        : d.rows ? `${d.rows.toLocaleString('en-IN')} rows` : d.chunks}
                    </td>
                    <td><Badge status={d.status} /></td>
                    <td><div>{d.updated}</div><div className="cell-sub">{d.by}</div></td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      {d.status === 'draft' && <button type="button" className="btn btn--sm btn--primary" onClick={() => setPublished(d, true)}>Publish</button>}
                      {d.status === 'published' && <button type="button" className="btn btn--sm" onClick={() => setPublished(d, false)}>Unpublish</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid" style={{ alignContent: 'start' }}>
          <VersionCard />
          <Upload setDocuments={setDocuments} setChunks={setChunks} updateDoc={updateDoc} />
          <RetrievalTest documents={documents} chunks={chunks} />
        </div>
      </div>

      <Drawer open={!!preview} onClose={() => setPreviewId(null)} title={preview?.title}
        subtitle={preview && <>{preview.file} · <Badge status={preview.status} /> <Badge status={preview.audience} /></>}>
        {preview && <Preview doc={preview} chunks={chunks[preview.id] || []} table={tables[preview.id]}
          onPublish={() => { setPublished(preview, true); setPreviewId(null); }}
          onReindex={() => { reindex(preview); setPreviewId(null); }}
          onDelete={() => remove(preview)} />}
      </Drawer>
    </>
  );
}

// Current knowledge version, what the cache holds for it, and the version history.
function VersionCard() {
  const { kb, cache, clearCache, warmCache, changeLog } = useStore();
  const toast = useToast();
  const history = changeLog.filter((c) => c.kind === 'Knowledge').slice(0, 4);
  return (
    <section className="card">
      <div className="card__head">
        <div><h2>Version &amp; cache</h2><p>Publishing, unpublishing, deleting or re-indexing creates a new version and clears the cache.</p></div>
        <span className="pill">KB v{kb.version}</span>
      </div>
      <div className="card__body" style={{ display: 'grid', gap: 12 }}>
        <dl className="kv">
          <dt>Live version</dt><dd>v{kb.version} · used by voice, chat and agent assist</dd>
          <dt>Cached answers</dt>
          <dd>{cache.entries.toLocaleString('en-IN')} for v{cache.kbVersion}{cache.entries === 0 && <> · <Badge tone="warn">empty, refills as people ask</Badge></>}</dd>
          <dt>Last cleared</dt><dd>{cache.lastCleared || 'not since start of day'}</dd>
        </dl>
        <div className="toolbar">
          <button type="button" className="btn btn--sm" onClick={() => toast(`Pre-warmed ${warmCache()} FAQ answers for KB v${kb.version}.`)}>Pre-warm from FAQs</button>
          <button type="button" className="btn btn--sm btn--danger" onClick={() => toast(`Cache cleared (${clearCache('Cleared from knowledge base page').toLocaleString('en-IN')} entries).`)}>Clear cache now</button>
        </div>
        {history.length > 0 && (
          <ol className="versions" aria-label="Version history">
            {history.map((h) => (
              <li key={`${h.at}-${h.to}`}><strong>{h.to}</strong><span>{h.note}</span><span className="note">{h.at} · {h.who}</span></li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Upload({ setDocuments, setChunks, updateDoc }) {
  const toast = useToast();
  const [over, setOver] = useState(false);
  const [audience, setAudience] = useState('public');
  const [priority, setPriority] = useState(false);
  const inputRef = useRef(null);

  function ingest(files) {
    files.forEach((f) => {
      const ext = (f.name.split('.').pop() || '').toUpperCase();
      if (!SUPPORTED.includes(ext)) { toast(`${f.name}: unsupported file type`); return; }
      const structured = ext === 'CSV' || ext === 'XLSX';
      const id = `u${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
      setDocuments((docs) => [{
        id, title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), file: f.name, type: ext,
        audience: structured ? 'tool' : audience, version: 1, status: 'processing', progress: 5, chunks: 0,
        size: `${(f.size / 1024).toFixed(0)} KB`, updated: stamp(), by: 'admin@dic', priority: priority ? 'high' : undefined,
      }, ...docs]);
      setChunks((c) => ({ ...c, [id]: [{ page: 1, section: 'Preview', text: 'Parsed text appears here once the ingestion worker (Docling) has processed the file.' }] }));
      [25, 55, 80, 100].forEach((p, i) => setTimeout(() => {
        if (p < 100) { updateDoc(id, { progress: p }); return; }
        updateDoc(id, structured
          ? { progress: 100, status: 'draft', rows: Math.floor(50 + Math.random() * 900), lookup: 'id' }
          : { progress: 100, status: 'draft', chunks: Math.floor(8 + f.size / 4000) % 120 || 12 });
        toast(`${f.name} is ready as a draft. Review it, then publish.`);
      }, 700 * (i + 1)));
    });
  }

  return (
    <section className="card">
      <div className="card__head"><div><h2>Upload</h2><p>PDF, DOCX, TXT, CSV, XLSX · max 50 MB</p></div></div>
      <div className="card__body">
        <label className={`dropzone ${over ? 'is-over' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); setOver(true); }} onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
          onDrop={(e) => { e.preventDefault(); setOver(false); ingest([...e.dataTransfer.files]); }}>
          <strong>Drop files here or click to choose</strong>
          <span className="note">Files are parsed, split into chunks with page numbers, embedded and saved as a draft.</span>
          <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt,.csv,.xlsx" className="sr-only"
            onChange={(e) => { ingest([...e.target.files]); e.target.value = ''; }} />
        </label>
        <div className="upload-opts" role="group" aria-label="Upload options">
          <label><input type="radio" name="aud" checked={audience === 'public'} onChange={() => setAudience('public')} /> Public</label>
          <label><input type="radio" name="aud" checked={audience === 'internal'} onChange={() => setAudience('internal')} /> Internal (officers only)</label>
          <label><input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} /> High priority (circular)</label>
        </div>
      </div>
    </section>
  );
}

function RetrievalTest({ documents, chunks }) {
  const [q, setQ] = useState('What documents are needed to register?');
  const [as, setAs] = useState('public');
  const [result, setResult] = useState(null);

  function search(e) {
    e.preventDefault();
    const qt = tokens(q);
    const hits = [];
    documents
      .filter((d) => d.status === 'published' && (d.audience === 'public' || (as === 'internal' && d.audience === 'internal')))
      .forEach((d) => (chunks[d.id] || []).forEach((c) => {
        const ct = tokens(`${c.text} ${c.section}`);
        const overlap = qt.filter((w) => ct.some((x) => x.startsWith(w.slice(0, 5)))).length;
        if (overlap) hits.push({ d, c, score: Math.min(0.99, 0.42 + overlap / (qt.length + 1)) });
      }));
    hits.sort((a, b) => b.score - a.score);
    setResult(hits.slice(0, 4));
  }

  const confident = result && result.length > 0 && result[0].score >= 0.55;
  return (
    <section className="card">
      <div className="card__head"><div><h2>Test a question</h2><p>Runs retrieval exactly as a live call would</p></div></div>
      <div className="card__body" style={{ display: 'grid', gap: 10 }}>
        <form onSubmit={search} style={{ display: 'grid', gap: 8 }}>
          <textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question" />
          <div className="toolbar">
            <select value={as} onChange={(e) => setAs(e.target.value)} aria-label="Search as">
              <option value="public">As citizen (public only)</option><option value="internal">As officer (public + internal)</option>
            </select>
            <button className="btn btn--primary" type="submit">Search</button>
          </div>
        </form>
        {result && !confident && (
          <div className="answer" style={{ background: 'var(--warn-bg)', borderColor: '#f3d79b' }}>
            <div className="answer__label" style={{ color: 'var(--warn)' }}>No confident match</div>
            The bot would say it doesn't have this information and offer an officer. Consider adding a document.
          </div>
        )}
        {confident && (
          <>
            <div className="answer">
              <div className="answer__label">What the bot would ground its answer on</div>
              {result[0].c.text}
              <div className="note" style={{ marginTop: 6 }}>Source: {result[0].d.title}, p.{result[0].c.page}</div>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {result.map((h) => (
                <div key={`${h.d.id}-${h.c.page}-${h.c.section}`} className="chunk hit">
                  <div className="chunk__meta"><span className="score">{h.score.toFixed(2)}</span><span>{h.d.title}</span><span>p.{h.c.page}</span><Badge status={h.d.audience} /></div>
                  <p>{h.c.text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Preview({ doc, chunks, table, onPublish, onReindex, onDelete }) {
  const done = doc.status === 'processing' ? Math.ceil((doc.progress || 0) / 25) : STAGES.length;
  return (
    <>
      <div className="pipeline" aria-label="Ingestion steps">
        {STAGES.map((s, i) => <span key={s} className={i < done ? 'done' : ''}>{i < done ? '✓ ' : ''}{s}</span>)}
      </div>
      <dl className="kv">
        <dt>Version</dt><dd>v{doc.version}</dd>
        <dt>Audience</dt>
        <dd>{doc.audience === 'internal' ? 'Officers only (agent assist)'
          : doc.audience === 'tool' ? <>Structured data behind the tool <code>{doc.tool || `lookup_${doc.id}`}</code></>
            : 'Citizens, chat and officers'}</dd>
        {doc.pages && <><dt>Pages</dt><dd>{doc.pages}</dd></>}
        {doc.lookup && <><dt>Lookup column</dt><dd><code>{doc.lookup}</code> · needs auth level {doc.minAuth ?? 1}</dd></>}
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
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Chunks ({doc.chunks || chunks.length}) <span className="note">showing {chunks.length}</span></h3>
          <div className="grid" style={{ gap: 8 }}>
            {chunks.length === 0 && <p className="empty">No chunks yet.</p>}
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
        {doc.status === 'draft' && <button type="button" className="btn btn--primary" onClick={onPublish}>Publish</button>}
        <button type="button" className="btn" onClick={onReindex}>Re-index</button>
        <button type="button" className="btn btn--danger" onClick={onDelete}>Delete (erases chunks and cache)</button>
      </div>
    </>
  );
}
