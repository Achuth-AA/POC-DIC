import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/Badge.jsx';
import { HBars, LineChart, Ring } from '../components/charts.jsx';
import { useToast } from '../components/Toast.jsx';
import { downloadJson, ms, pct } from '../lib/format.js';
import { useStore } from '../store.jsx';

const STAGE_COLORS = ['var(--c-eos)', 'var(--c-stt)', 'var(--c-ret)', 'var(--c-llm)', 'var(--c-tts)', '#94a3b8'];
const ROUTE_COLORS = ['var(--c-cache)', 'var(--c-llm)', 'var(--c-tool)', 'var(--warn)', 'var(--bad)'];

export default function Dashboard() {
  const { kpis: k, latency: L, cache: c, stageBudget, routes, languages, providers, sessions } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [range, setRange] = useState('24 h');

  const cards = [
    { label: 'Voice calls', value: k.voiceCalls, meta: `${k.voiceMinutes.toLocaleString('en-IN')} billable minutes` },
    { label: 'Chat sessions', value: k.chatSessions, meta: 'completed sessions (billing unit)' },
    { label: 'Median latency', value: ms(k.p50), meta: 'target < 1,000 ms', good: k.p50 < 1000 },
    { label: 'p90 latency', value: ms(k.p90), meta: 'p95 SLA ≤ 1,000 ms', good: k.p90 <= 1000 },
    { label: 'Cache hit rate', value: pct(k.cacheHit), meta: 'target ≥ 40%', good: k.cacheHit >= 0.4 },
    { label: 'Resolved by AI', value: pct(k.resolvedByAi), meta: `${k.handoffs} handoffs to officers` },
    { label: 'Live right now', value: k.activeNow, meta: 'calls + chats' },
    { label: 'Availability', value: pct(k.availability, 2), meta: 'SLA ≥ 99.9%', good: k.availability >= 0.999 },
  ];
  const maxBudget = Math.max(...stageBudget.map((s) => s.budget));
  const active = (kind) => providers[kind].options.find((o) => o.id === providers[kind].active);
  const open = (id) => navigate(`/calls?id=${encodeURIComponent(id)}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Today, live. Latency is measured from the end of caller speech to the first audio byte of the reply.</p>
        </div>
        <div className="page-head__actions">
          <div className="seg" role="group" aria-label="Time range">
            {['24 h', '7 days', '30 days'].map((r) => (
              <button key={r} type="button" aria-pressed={range === r}
                onClick={() => { setRange(r); if (r !== '24 h') toast('Range switching uses /v1/metrics once the backend is connected.'); }}>{r}</button>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => downloadJson(`metrics-${new Date().toISOString().slice(0, 10)}.json`, { kpis: k, latency: L, cache: c, routes })}>
            Export metrics (JSON)
          </button>
        </div>
      </div>

      <section className="grid grid--kpi" aria-label="Key numbers">
        {cards.map((card) => (
          <div key={card.label} className="card kpi">
            <div className="kpi__label">{card.label}</div>
            <div className="kpi__value">{card.value}</div>
            <div className={`kpi__meta ${card.good === true ? 'good' : card.good === false ? 'bad' : ''}`}>{card.meta}</div>
          </div>
        ))}
      </section>

      <div className="grid grid--3-1">
        <section className="card">
          <div className="card__head">
            <div><h2>Response latency</h2><p>p50 and p90 per hour, split by cache/rules turns and LLM turns</p></div>
            <div className="legend">
              <span><i style={{ background: 'var(--c-llm)' }} />LLM p50</span>
              <span style={{ color: 'var(--c-llm-2)' }}><i className="dashed" />LLM p90</span>
              <span><i style={{ background: 'var(--c-cache)' }} />Cache p50</span>
              <span style={{ color: 'var(--c-cache-2)' }}><i className="dashed" />Cache p90</span>
            </div>
          </div>
          <div className="card__body">
            <LineChart
              height={260}
              labels={L.hours.map((h) => `${String(h).padStart(2, '0')}:00`)}
              threshold={{ value: 1000, label: '1,000 ms target' }}
              series={[
                { name: 'LLM p50', values: L.llmP50, color: 'var(--c-llm)' },
                { name: 'LLM p90', values: L.llmP90, color: 'var(--c-llm-2)', dashed: true },
                { name: 'Cache p50', values: L.cacheP50, color: 'var(--c-cache)' },
                { name: 'Cache p90', values: L.cacheP90, color: 'var(--c-cache-2)', dashed: true },
              ]}
            />
          </div>
        </section>
        <section className="card">
          <div className="card__head"><div><h2>Semantic cache</h2><p>Target: at least 40% gain</p></div></div>
          <div className="card__body" style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
            <Ring value={c.hitRate} label="Cache hit rate" color="var(--c-cache)" target={0.4} />
            <dl className="kv" style={{ width: '100%' }}>
              <dt>Status</dt><dd>{c.enabled ? <Badge tone="ok">Enabled</Badge> : <Badge tone="muted">Disabled</Badge>}</dd>
              <dt>Entries</dt><dd>{c.entries.toLocaleString('en-IN')}</dd>
              <dt>Threshold</dt><dd>cosine ≥ {c.threshold}</dd>
              <dt>False hits</dt><dd>{pct(c.falseHitRate, 1)} (eval set)</dd>
              <dt>Median saving</dt><dd>≈ {ms(L.llmP50[23] - L.cacheP50[23])} per hit</dd>
            </dl>
          </div>
        </section>
      </div>

      <div className="grid grid--2">
        <section className="card">
          <div className="card__head"><div><h2>Latency budget (LLM path, median)</h2><p>Where the time goes in one turn; tick = budget</p></div></div>
          <div className="card__body">
            <div className="budget">
              {stageBudget.map((s, i) => (
                <div key={s.stage} className="budget__row">
                  <span>{s.stage}</span>
                  <span className="budget__bar" title={`${s.ms} ms of ${s.budget} ms budget`}>
                    <span style={{ width: `${(s.ms / maxBudget) * 100}%`, background: STAGE_COLORS[i] }} />
                    <i style={{ left: `${(s.budget / maxBudget) * 100}%` }} />
                  </span>
                  <span className="num">{s.ms} ms</span>
                </div>
              ))}
              <div className="budget__row" style={{ fontWeight: 700, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <span>Total</span><span /><span className="num">{stageBudget.reduce((a, s) => a + s.ms, 0)} ms</span>
              </div>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card__head"><div><h2>How turns were answered</h2><p>Share of all turns today</p></div></div>
          <div className="card__body"><HBars items={routes.map((r, i) => ({ label: r.route, value: r.share, color: ROUTE_COLORS[i] }))} /></div>
        </section>
      </div>

      <div className="grid grid--3-1">
        <section className="card">
          <div className="card__head">
            <div><h2>Recent calls and chats</h2><p>Click a row to open the full audit trail</p></div>
            <button type="button" className="btn btn--sm" onClick={() => navigate('/calls')}>View all</button>
          </div>
          <div className="card__body card__body--flush table-wrap">
            <table className="data">
              <thead><tr><th>Session</th><th>Channel</th><th>Language</th><th>Started</th><th className="num">Turns</th><th className="num">p50</th><th>Outcome</th></tr></thead>
              <tbody>
                {sessions.slice(0, 6).map((s) => (
                  <tr key={s.id} className="is-clickable" tabIndex={0} onClick={() => open(s.id)} onKeyDown={(e) => e.key === 'Enter' && open(s.id)}>
                    <td><div className="cell-title mono">{s.id}</div><div className="cell-sub">{s.caller}</div></td>
                    <td>{s.channel === 'voice' ? '📞 Voice' : '💬 Chat'}</td>
                    <td>{s.lang}</td><td>{s.started}</td>
                    <td className="num">{s.turns}</td><td className="num">{s.p50} ms</td>
                    <td><Badge status={s.outcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="grid" style={{ alignContent: 'start' }}>
          <section className="card">
            <div className="card__head"><div><h2>Active providers</h2></div><button type="button" className="btn btn--sm" onClick={() => navigate('/providers')}>Change</button></div>
            <div className="card__body">
              <dl className="kv">
                {['llm', 'stt', 'tts'].map((kind) => (
                  <div key={kind} style={{ display: 'contents' }}>
                    <dt>{kind.toUpperCase()}</dt><dd>{active(kind).name} <Badge status={active(kind).health} /></dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
          <section className="card">
            <div className="card__head"><div><h2>Languages</h2></div></div>
            <div className="card__body"><HBars items={languages.map((l) => ({ label: l.lang, value: l.share }))} /></div>
          </section>
        </div>
      </div>
    </>
  );
}
