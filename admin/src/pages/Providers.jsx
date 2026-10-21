import { useState } from 'react';
import Badge from '../components/Badge.jsx';
import { Modal } from '../components/Overlay.jsx';
import { useToast } from '../components/Toast.jsx';
import { stamp } from '../lib/format.js';
import { useStore } from '../store.jsx';

const KINDS = ['llm', 'stt', 'tts'];

export default function Providers() {
  const { providers, setProviders, cache, setCache, clearCache, warmCache, kb, changeLog, logChange } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState(() => Object.fromEntries(KINDS.map((k) => [k, { active: providers[k].active, fallback: providers[k].fallback }])));
  const [pending, setPending] = useState(null);
  const [threshold, setThreshold] = useState(Number(cache.threshold));

  const name = (kind, id) => providers[kind].options.find((o) => o.id === id).name;

  function choose(kind, active) {
    setDraft((d) => {
      const fallback = d[kind].fallback === active ? providers[kind].options.find((o) => o.id !== active).id : d[kind].fallback;
      return { ...d, [kind]: { active, fallback } };
    });
  }

  function apply() {
    const kind = pending;
    const from = providers[kind].active;
    setProviders((p) => ({ ...p, [kind]: { ...p[kind], ...draft[kind] } }));
    logChange({ at: stamp(), who: 'admin@dic', kind: kind.toUpperCase(), from, to: draft[kind].active, note: 'Manual switch from admin console' });
    setPending(null);
    toast(`${kind.toUpperCase()} switched. The next call uses the new provider.`);
  }

  function saveThreshold() {
    if (threshold.toFixed(2) === Number(cache.threshold).toFixed(2)) return;
    logChange({ at: stamp(), who: 'admin@dic', kind: 'Cache', from: `threshold ${cache.threshold}`, to: `threshold ${threshold.toFixed(2)}`, note: 'Changed in admin console' });
    setCache((c) => ({ ...c, threshold: threshold.toFixed(2) }));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Providers &amp; cache</h1>
          <p>Switch the LLM, speech-to-text or text-to-speech provider by configuration. New calls use the change at once; live calls keep their provider.</p>
        </div>
      </div>

      <div className="prov-grid">
        {KINDS.map((kind) => {
          const p = providers[kind];
          const d = draft[kind];
          const changed = d.active !== p.active || d.fallback !== p.fallback;
          return (
            <section key={kind} className="card">
              <div className="card__head"><div><h2>{p.label}</h2><p>{p.options.length} providers configured</p></div><Badge tone="ok">Live</Badge></div>
              <div className="card__body">
                <fieldset className="opts" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="sr-only">Active {p.label}</legend>
                  {p.options.map((o) => (
                    <label key={o.id} className={`opt ${d.active === o.id ? 'is-active' : ''}`}>
                      <input type="radio" name={`active-${kind}`} value={o.id} checked={d.active === o.id} onChange={() => choose(kind, o.id)} />
                      <span>
                        <span className="opt__name">{o.name}</span> {o.id === p.active && <Badge tone="info">Active</Badge>}
                        <span className="opt__meta" style={{ display: 'block' }}>{o.vendor} · {o.region}</span>
                        <span className="opt__meta" style={{ display: 'block' }}>{o.use} · <span className="mono">{o.version}</span></span>
                      </span>
                      <span className="opt__lat">{o.p50} ms<br /><Badge status={o.health} /></span>
                    </label>
                  ))}
                </fieldset>
                <div className="prov-foot">
                  <label className="field"><span>Backup (fallback) provider</span>
                    <select value={d.fallback} onChange={(e) => setDraft((x) => ({ ...x, [kind]: { ...x[kind], fallback: e.target.value } }))}>
                      {p.options.filter((o) => o.id !== d.active).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </label>
                  <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                    <span className={changed ? 'changed' : 'note'}>{changed ? 'Unsaved change' : 'Version-pinned · rollback ≤ 30 min'}</span>
                    <span className="toolbar">
                      <button type="button" className="btn btn--sm" onClick={() => {
                        const o = p.options.find((x) => x.id === d.active);
                        toast(`${o.name}: test request OK in ${o.p50 + Math.round(Math.random() * 40)} ms`);
                      }}>Test</button>
                      <button type="button" className="btn btn--sm btn--primary" disabled={!changed} onClick={() => setPending(kind)}>Apply</button>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid grid--2">
        <section className="card">
          <div className="card__head"><div><h2>Semantic cache</h2><p>Grounded, non-personal answers only. Key: helpline + language + KB version + prompt version + channel.</p></div></div>
          <div className="card__body" style={{ display: 'grid', gap: 16 }}>
            <p className="note" style={{ margin: 0 }}>Now holding <strong>{cache.entries.toLocaleString('en-IN')}</strong> answers for KB v{cache.kbVersion}. Publishing a knowledge change clears it automatically.</p>
            <label className="switch">
              <input type="checkbox" checked={cache.enabled} onChange={(e) => {
                setCache((c) => ({ ...c, enabled: e.target.checked }));
                toast(e.target.checked ? 'Cache enabled.' : 'Cache disabled: every turn now goes to retrieval + LLM (use this for the no-cache baseline).');
              }} />
              <span className="switch__ui" /><span>Cache enabled</span>
            </label>
            <div className="field">
              <span>Similarity threshold</span>
              <div className="range">
                <input type="range" min="0.80" max="0.99" step="0.01" value={threshold} aria-describedby="thHelp"
                  onChange={(e) => setThreshold(Number(e.target.value))} onPointerUp={saveThreshold} onKeyUp={saveThreshold} onBlur={saveThreshold} />
                <strong className="mono">{threshold.toFixed(2)}</strong>
              </div>
              <p className="note" id="thHelp">Higher = fewer wrong cached answers but fewer hits. 0.92 kept false hits at 0.6% in eval run #15.</p>
            </div>
            <div className="toolbar">
              <button type="button" className="btn" onClick={() => toast(`Pre-warmed ${warmCache()} FAQ answers for KB v${kb.version}.`)}>Pre-warm from FAQs</button>
              <button type="button" className="btn btn--danger" onClick={() => toast(`Cache cleared (${clearCache('Cleared from providers page').toLocaleString('en-IN')} entries).`)}>Clear cache</button>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card__head"><div><h2>Automatic failover</h2><p>RFP: switch to the backup provider within 15 minutes</p></div></div>
          <div className="card__body" style={{ display: 'grid', gap: 12 }}>
            <label className="switch"><input type="checkbox" defaultChecked /><span className="switch__ui" /><span>Fail over automatically after 3 failed health checks</span></label>
            <dl className="kv">
              <dt>Health check</dt><dd>every 20 s per provider</dd>
              <dt>LLM per request</dt><dd>LiteLLM falls back on error or after 8 s</dd>
              <dt>STT / TTS mid-call</dt><dd>worker rebuilds the plugin with the backup and says "one moment"</dd>
              <dt>Last drill</dt><dd>2026-10-19 · LLM failover in 6 min · passed</dd>
            </dl>
            <button type="button" className="btn" style={{ justifySelf: 'start' }}
              onClick={() => toast('Drill: STT primary marked down → backup took over in 41 s (simulated).')}>Run failover drill</button>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card__head"><div><h2>Change log</h2><p>Every configuration change is recorded (model governance, Annexure 14)</p></div></div>
        <div className="card__body card__body--flush table-wrap">
          <table className="data">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>From</th><th>To</th><th>Note</th></tr></thead>
            <tbody>
              {changeLog.map((c, i) => (
                <tr key={`${c.at}-${i}`}><td>{c.at}</td><td>{c.who}</td><td><Badge tone="info">{c.kind}</Badge></td>
                  <td className="mono">{c.from}</td><td className="mono">{c.to}</td><td>{c.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!pending} onClose={() => setPending(null)} title="Apply provider change?"
        footer={<><button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button><button type="button" className="btn btn--primary" onClick={apply}>Apply now</button></>}>
        {pending && (
          <>
            <p><strong>{providers[pending].label}</strong>: {name(pending, providers[pending].active)} → <strong>{name(pending, draft[pending].active)}</strong><br />
              Backup: {name(pending, draft[pending].fallback)}</p>
            <p>New calls and chats use it immediately. Live sessions keep their current provider. Run an evaluation afterwards to confirm quality.</p>
          </>
        )}
      </Modal>
    </>
  );
}
