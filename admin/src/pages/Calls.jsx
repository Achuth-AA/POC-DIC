import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Badge from '../components/Badge.jsx';
import { Stack } from '../components/charts.jsx';
import { downloadJson } from '../lib/format.js';
import { useStore } from '../store.jsx';
import Icon from '../components/Icon.jsx';

const STAGES = [
  ['eos', 'End of speech', 'var(--c-eos)'], ['stt', 'STT', 'var(--c-stt)'], ['cache', 'Cache', 'var(--c-cache)'],
  ['retrieval', 'Retrieval', 'var(--c-ret)'], ['tool', 'Tool', 'var(--c-tool)'], ['llm', 'LLM first token', 'var(--c-llm)'], ['tts', 'TTS first audio', 'var(--c-tts)'],
];

// Sessions without a recorded transcript in the mock get a short generic one in their language.
const GENERIC = {
  English: ['en-IN', 'How much money do farmers get?', 'Eligible families get ₹6,000 a year in three instalments of ₹2,000.', 'Is e-KYC mandatory?', 'Yes, e-KYC is mandatory to keep receiving instalments.', 'PM-KISAN FAQs'],
  Hindi: ['hi-IN', 'Kitna paisa milta hai?', 'Paatra parivaron ko saal mein ₹6,000 milte hain, ₹2,000 ki teen kiston mein.', 'e-KYC zaroori hai kya?', 'Haan, kiston ke liye e-KYC zaroori hai.', 'PM-KISAN FAQs (हिंदी)'],
  Telugu: ['te-IN', 'రైతులకు ఎంత డబ్బు వస్తుంది?', 'అర్హులైన కుటుంబాలకు సంవత్సరానికి ₹6,000, ₹2,000 చొప్పున మూడు విడతల్లో వస్తుంది.', 'e-KYC తప్పనిసరా?', 'అవును, విడతలు అందుతూ ఉండాలంటే e-KYC తప్పనిసరి.', 'PM-KISAN FAQs (తెలుగు)'],
  Malayalam: ['ml-IN', 'കർഷകർക്ക് എത്ര പണം ലഭിക്കും?', 'അർഹരായ കുടുംബങ്ങൾക്ക് വർഷം ₹6,000, ₹2,000 വീതം മൂന്ന് ഗഡുക്കളായി ലഭിക്കും.', 'e-KYC നിർബന്ധമാണോ?', 'അതെ, ഗഡുക്കൾ തുടർന്നും ലഭിക്കാൻ e-KYC നിർബന്ധമാണ്.', 'PM-KISAN FAQs (മലയാളം)'],
};
function genericTurns(s) {
  const [code, q1, a1, q2, a2, faq] = GENERIC[s.lang] || GENERIC.Hindi;
  return [
    { role: 'bot', text: 'Namaste! This is an automated assistant for PM-KISAN.', route: 'greeting' },
    { role: 'user', text: q1, lang: code },
    { role: 'bot', text: a1, route: 'cache', sources: [['PM-KISAN Operational Guidelines', 2]], latency: { eos: 240, stt: 130, cache: 17, total: 402 }, cacheScore: 0.96 },
    { role: 'user', text: q2, lang: code },
    { role: 'bot', text: a2, route: 'llm', sources: [[faq, 7]], model: 'claude-haiku-5-5', latency: { eos: 260, stt: 140, retrieval: 90, llm: 310, tts: 110, total: 910 } },
  ];
}

export default function Calls() {
  const { sessions, turns: allTurns, providers, kb } = useStore();
  const [params, setParams] = useSearchParams();
  const [channel, setChannel] = useState('');
  const selected = params.get('id') || sessions[0].id;
  const s = sessions.find((x) => x.id === selected) || sessions[0];
  const turns = allTurns[s.id] || genericTurns(s);
  const rows = sessions.filter((x) => !channel || x.channel === channel);
  const totals = turns.filter((t) => t.latency?.total).map((t) => t.latency.total).sort((a, b) => a - b);
  const median = totals.length ? totals[Math.floor(totals.length / 2)] : 0;
  const choose = (id) => setParams({ id }, { replace: true });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calls &amp; chats</h1>
          <p>Every turn with its route, sources, model version and latency breakdown. This is the audit trail.</p>
        </div>
        <div className="seg" role="group" aria-label="Channel">
          {[['', 'All'], ['voice', 'Voice'], ['chat', 'Chat']].map(([v, label]) => (
            <button key={v} type="button" aria-pressed={channel === v} onClick={() => setChannel(v)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid--1-2">
        <section className="card">
          <div className="card__head"><div><h2>Sessions</h2><p>{rows.length} sessions today</p></div></div>
          <div className="card__body card__body--flush table-wrap">
            <table className="data">
              <thead><tr><th>Session</th><th>Lang.</th><th className="num">p50</th><th>Outcome</th></tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className={`is-clickable ${x.id === s.id ? 'is-selected' : ''}`} tabIndex={0} aria-current={x.id === s.id || undefined}
                    onClick={() => choose(x.id)} onKeyDown={(e) => e.key === 'Enter' && choose(x.id)}>
                    <td><div className="cell-title"><Icon name={x.channel === 'voice' ? 'phone' : 'chat'} size={16} title={x.channel === 'voice' ? 'Voice' : 'Chat'} /><span className="mono">{x.id}</span></div><div className="cell-sub">{x.started} · {x.duration} · {x.turns} turns</div></td>
                    <td>{x.lang}</td><td className="num">{x.p50} ms</td><td><Badge status={x.outcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" aria-live="polite">
          <div className="card__head">
            <div>
              <h2>{s.channel === 'voice' ? 'Voice call' : 'Web chat'} <span className="mono">{s.id}</span> <Badge status={s.outcome} /></h2>
              <p>{s.caller} · {s.lang} · started {s.started} · {s.duration}</p>
            </div>
            <button type="button" className="btn btn--sm" onClick={() => downloadJson(`${s.id}.json`, { session: s, turns })}>Download JSON</button>
          </div>
          <div className="card__body" style={{ display: 'grid', gap: 16 }}>
            <dl className="kv">
              <dt>Providers</dt>
              <dd className="mono">LLM {providers.llm.active} · STT {s.channel === 'voice' ? providers.stt.active : '—'} · TTS {s.channel === 'voice' ? providers.tts.active : '—'}</dd>
              <dt>Knowledge / prompt</dt><dd>KB v{kb.version} · <span className="mono">answer_{s.channel} v3</span></dd>
              <dt>Median turn latency</dt><dd>{median} ms</dd>
              <dt>Billing</dt><dd>{s.channel === 'voice' ? `${s.duration} voice minutes` : '1 completed chatbot session'}</dd>
            </dl>
            <div className="stack-legend">{STAGES.map(([k, label, color]) => <span key={k}><i style={{ background: color }} />{label}</span>)}</div>
            <div className="turns">{turns.map((t, i) => <Turn key={i} t={t} channel={s.channel} />)}</div>
          </div>
        </section>
      </div>
    </>
  );
}

function Turn({ t, channel }) {
  if (t.role === 'system') {
    return <div className="turn turn--system"><span className="turn__who">System</span><div className="turn__bubble">{t.text}</div></div>;
  }
  const who = t.role === 'user' ? (channel === 'voice' ? 'Caller' : 'Citizen') : 'AI';
  const parts = t.latency ? STAGES.filter(([k]) => t.latency[k]).map(([k, label, color]) => ({ label, ms: t.latency[k], color })) : [];
  return (
    <div className={`turn turn--${t.role}`}>
      <span className="turn__who">{who}</span>
      <div className="turn__bubble">
        <p className="turn__text">{t.text}</p>
        {t.role === 'bot' ? (
          <div className="turn__meta">
            {t.route && <span className={`route route--${t.route}`}>{t.route}</span>}
            {t.cacheScore && <span>similarity {t.cacheScore}</span>}
            {t.model && <span className="mono">{t.model}</span>}
            {t.latency?.total ? <>{parts.length > 0 && <Stack parts={parts} />}<strong>{t.latency.total} ms</strong></> : null}
          </div>
        ) : t.lang && (
          <div className="turn__meta"><span className="mono">{t.lang}</span><span>PII masked before logging</span></div>
        )}
        {t.sources && <div className="turn__src"><Icon name="file" size={14} />{t.sources.map(([title, page]) => `${title} p.${page}`).join(' · ')}</div>}
        {t.tool && <div className="turn__tool"><Icon name="tool" size={14} /><span className="mono">{t.tool.name}({t.tool.args})</span> → {t.tool.status} · {t.tool.ms} ms</div>}
        {t.note && <div className="turn__note">{t.note}</div>}
      </div>
    </div>
  );
}
