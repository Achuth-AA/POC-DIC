import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import { useAssist } from '../store.jsx';
import Icon from '../components/Icon.jsx';

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const WHO = { ai: 'AI assistant', citizen: 'Citizen', officer: 'You' };

export default function Console() {
  const { state, dispatch } = useAssist();
  const a = state.active;

  // Simulated live transcript: the next citizen line arrives a few seconds after accepting (voice keeps
  // going on its own; chat waits for the officer to reply first).
  const liveLeft = a?.liveQueue.length ?? 0;
  const waiting = a?.channel === 'voice' || a?.awaitingCitizen;
  useEffect(() => {
    if (!a || a.ended || a.held || !liveLeft || !waiting) return undefined;
    const first = liveLeft === a.live.length;
    const delay = first ? 3500 : a.channel === 'voice' ? 9000 : 2500;
    const t = setTimeout(() => dispatch({ type: 'live' }), delay);
    return () => clearTimeout(t);
  }, [a?.id, a?.ended, a?.held, liveLeft, waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="workspace">
      <Queue />
      <main className="convo" aria-live="polite">{a ? <Conversation key={a.id} /> : <Empty done={state.done} />}</main>
      <aside className="assist" aria-label="AI assist">{a ? <AssistPanel key={a.id} /> : (
        <div className="panel"><h3>AI assist</h3><p className="note">The AI summary, caller details and live answer suggestions appear here when you take a conversation.</p></div>
      )}</aside>
    </div>
  );
}

function Queue() {
  const { state, dispatch } = useAssist();
  const toast = useToast();
  const items = [...state.queue].sort((x, y) => (y.priority ? 1 : 0) - (x.priority ? 1 : 0) || y.waitedSec - x.waitedSec);
  const canAccept = !state.active && state.status === 'available';

  // Announce handoffs that arrive while the console is open.
  const seen = useRef(state.queue.length);
  useEffect(() => {
    if (state.queue.length > seen.current) toast('New handoff in the queue.');
    seen.current = state.queue.length;
  }, [state.queue.length, toast]);

  function accept(q) {
    dispatch({ type: 'accept', id: q.id });
    toast(q.channel === 'voice' ? 'Call connected. The transcript continues live.' : 'You joined the chat. The citizen sees your name.');
  }

  return (
    <aside className="queue" aria-labelledby="queueTitle">
      <div className="queue__head">
        <h2 id="queueTitle">Waiting for an officer</h2>
        <span className="count">{items.length}</span>
      </div>
      <ul className="queue__list">
        {items.length === 0 && <li className="queue__empty"><Icon name="checkCircle" size={28} />No one is waiting.</li>}
        {items.map((q, idx) => (
          <li key={q.id} className={`qitem ${q.priority ? 'qitem--priority' : ''}`}>
            <div className="qitem__top">
              <span className="qitem__ch"><Icon name={q.channel === 'voice' ? 'phone' : 'chat'} size={16} title={q.channel === 'voice' ? 'Voice call' : 'Web chat'} /></span>
              <strong>{q.caller.label}</strong>
              <span className="tag">{q.lang}</span>
              {q.priority && <span className="tag tag--bad">Priority</span>}
              <span className="qitem__wait">{mmss(q.waitedSec)}</span>
            </div>
            <p className="qitem__reason">{q.reason}</p>
            <p className="qitem__intent">{q.summary.intent}</p>
            <button type="button" className={`btn btn--sm ${idx === 0 ? 'btn--primary' : ''}`} disabled={!canAccept} onClick={() => accept(q)}>
              {q.channel === 'voice' ? 'Answer call' : 'Join chat'}
            </button>
          </li>
        ))}
      </ul>
      <p className="queue__note">Handoffs arrive with the AI summary and the full transcript. Priority items (safety triggers) are listed first.</p>
    </aside>
  );
}

function Empty({ done }) {
  return (
    <div className="convo__empty">
      <div className="convo__empty-icon" aria-hidden="true"><Icon name="headset" size={28} /></div>
      <h2>No active conversation</h2>
      <p>{done ? `${done} completed this session. ` : ''}Accept a handoff from the queue. You will see the AI summary, the full transcript and suggested answers.</p>
    </div>
  );
}

function Conversation() {
  const { state, dispatch } = useAssist();
  const toast = useToast();
  const a = state.active;
  const voice = a.channel === 'voice';
  const listRef = useRef(null);
  const [reply, setReply] = useState('');

  useEffect(() => { const l = listRef.current; if (l) l.scrollTop = l.scrollHeight; }, [a.transcript.length]);
  // "Insert" on a suggestion fills the reply box.
  useEffect(() => {
    const onInsert = (e) => setReply(e.detail);
    window.addEventListener('assist:insert', onInsert);
    return () => window.removeEventListener('assist:insert', onInsert);
  }, []);

  function send(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    dispatch({ type: 'line', who: 'officer', text: reply.trim() });
    setReply('');
  }

  function end() {
    dispatch({ type: 'end' });
    toast('Complete the wrap-up on the right. Notes are pre-drafted by the AI.');
  }

  return (
    <>
      <div className="convo__head">
        <div className="convo__who">
          <span className="convo__ch" aria-hidden="true"><Icon name={voice ? 'phone' : 'chat'} size={20} /></span>
          <div>
            <h2>{a.caller.label} <span className="tag">{a.lang}</span>
              {a.caller.verified ? <span className="tag tag--ok"><Icon name="check" size={14} />OTP verified</span> : <span className="tag tag--warn">Not verified</span>}</h2>
            <p>{voice ? a.caller.phone : 'Web chat'} · session <span className="mono">{a.id}</span> · {mmss(a.startedSec)}{a.ended ? ' · ended' : ''}</p>
          </div>
        </div>
        <div className="convo__controls">
          {voice && (
            <>
              <button type="button" className={`ctl ${a.muted ? 'is-on' : ''}`} aria-pressed={a.muted} disabled={a.ended} onClick={() => dispatch({ type: 'toggle', key: 'muted' })}><Icon name={a.muted ? 'micOff' : 'mic'} size={16} />{a.muted ? 'Unmute' : 'Mute'}</button>
              <button type="button" className={`ctl ${a.held ? 'is-on' : ''}`} aria-pressed={a.held} disabled={a.ended} onClick={() => dispatch({ type: 'toggle', key: 'held' })}><Icon name={a.held ? 'play' : 'pause'} size={16} />{a.held ? 'Resume' : 'Hold'}</button>
            </>
          )}
          <button type="button" className="ctl" disabled={a.ended} onClick={() => toast('Transfer to supervisor or state nodal officer (demo). The AI summary goes with it.')}><Icon name="transfer" size={16} />Transfer</button>
          <button type="button" className="ctl ctl--end" disabled={a.ended} onClick={end}>{voice && <Icon name="phoneOff" size={16} />}{voice ? 'End call' : 'End chat'}</button>
        </div>
      </div>
      {a.held && <p className="banner">Caller is on hold with music. The AI will not speak while on hold.</p>}
      <ol className="transcript" ref={listRef}>
        {a.transcript.map((l, i) => (l.who === 'system'
          ? <li key={i} className="line line--system">{l.text}{l.at ? ` · ${l.at}` : ''}</li>
          : (
            <li key={i} className={`line line--${l.who} ${l.at ? 'is-new' : ''}`}>
              <span className="line__who">{WHO[l.who]}{l.at ? ` · ${l.at}` : ''}</span>
              <p>{l.text}</p>
            </li>
          )))}
      </ol>
      {voice ? (
        <p className="convo__foot"><span className="live-dot" aria-hidden="true" />Live transcript of both sides (speech-to-text). Suggestions update as the caller speaks.</p>
      ) : !a.ended && (
        <form className="composer" onSubmit={send}>
          <label className="sr-only" htmlFor="reply">Reply to citizen</label>
          <textarea id="reply" rows={2} value={reply} onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
            placeholder="Type a reply… (Enter to send, Shift+Enter for a new line)" />
          <button className="btn btn--primary" type="submit"><Icon name="send" size={16} />Send</button>
        </form>
      )}
    </>
  );
}

// Suggestions come from the same knowledge base the bot uses (public + internal), matched on the
// citizen's latest words. Raw snippets with sources, no LLM, so they are instant.
function suggestionsFor(knowledge, text) {
  const words = (text || '').toLowerCase().match(/[a-zऀ-ॿ]+/g) || [];
  return knowledge
    .map((k) => ({ k, score: k.keys.filter((key) => words.some((w) => w.startsWith(key) || (key.startsWith(w) && w.length > 3))).length }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((x) => x.k);
}

function AssistPanel() {
  const { state, dispatch, ticketId } = useAssist();
  const toast = useToast();
  const a = state.active;
  const c = a.caller;
  const [form, setForm] = useState(null); // 'ticket' | 'callback' | null
  const [category, setCategory] = useState('Instalment not received');
  const [details, setDetails] = useState(a.summary.intent);
  const [slot, setSlot] = useState('Tomorrow · 9 am – 12 pm');
  const [disposition, setDisposition] = useState('');
  const wrapRef = useRef(null);
  const dispRef = useRef(null);
  const suggestions = suggestionsFor(state.knowledge, `${a.lastCitizen} ${a.summary.intent}`);

  useEffect(() => { if (a.ended) wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [a.ended]);

  function use(s) {
    if (a.channel === 'chat') window.dispatchEvent(new CustomEvent('assist:insert', { detail: s.text }));
    else { dispatch({ type: 'line', who: 'officer', text: s.text }); toast('Logged as said by you.'); }
  }

  function createTicket(e) {
    e.preventDefault();
    const id = ticketId();
    dispatch({ type: 'ticket', id, category });
    setForm(null);
    toast(`Ticket ${id} created. The citizen gets an SMS.`);
  }

  function bookCallback(e) {
    e.preventDefault();
    dispatch({ type: 'callback', slot });
    setForm(null);
    toast('Callback booked. It appears on the Callbacks page.');
  }

  function complete() {
    if (!disposition) { dispRef.current?.focus(); toast('Choose an outcome first.'); return; }
    toast(`Saved: ${disposition}. Notes attached to session ${a.id}.`);
    dispatch({ type: 'complete' });
  }

  return (
    <>
      <section className="panel panel--summary">
        <h3><Icon name="sparkle" size={16} />AI summary <span className="note">generated at handoff</span></h3>
        <p className="assist__intent">{a.summary.intent}</p>
        <ul className="assist__points">{a.summary.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <p className="note">Sentiment: <strong>{a.summary.sentiment}</strong> · Handoff reason: {a.reason}</p>
      </section>

      <section className="panel">
        <h3>Caller</h3>
        <dl className="kv">
          <dt>Verification</dt><dd>{c.verified ? `OTP · level ${c.authLevel}` : 'Not verified. Verify before sharing personal data.'}</dd>
          {c.regNo && (
            <>
              <dt>Registration</dt><dd className="mono">{c.regNo}</dd><dt>State</dt><dd>{c.state}</dd>
              <dt>Land records</dt><dd>{c.land}</dd><dt>e-KYC</dt><dd>{c.ekyc}</dd><dt>Last instalment</dt><dd>{c.last}</dd>
            </>
          )}
          <dt>Tickets</dt><dd>{c.tickets.length ? c.tickets.join(', ') : 'None'}</dd>
        </dl>
        {!c.verified && <button type="button" className="btn btn--sm" disabled={a.ended} onClick={() => dispatch({ type: 'verify' })}>Send OTP to caller</button>}
      </section>

      <section className="panel">
        <h3>Suggested answers <span className="note">from the knowledge base</span></h3>
        <p className="assist__quote">For: “{a.lastCitizen || a.summary.intent}”</p>
        {suggestions.length === 0 && <p className="note">No matching knowledge yet. Suggestions appear as the citizen speaks.</p>}
        {suggestions.map((s) => (
          <div key={s.text} className="sugg">
            <p>{s.text}</p>
            <div className="sugg__foot">
              <span className="sugg__src"><Icon name="file" size={14} />{s.source} p.{s.page}</span>{s.internal && <span className="tag tag--teal">Internal</span>}
              <button type="button" className="btn btn--sm" onClick={() => use(s)}>{a.channel === 'chat' ? 'Insert' : 'Mark as said'}</button>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>Actions</h3>
        <div className="actions">
          <button type="button" className="btn btn--sm" disabled={a.ended} onClick={() => setForm(form === 'ticket' ? null : 'ticket')}><Icon name="clipboard" size={16} />Register grievance</button>
          <button type="button" className="btn btn--sm" onClick={() => setForm(form === 'callback' ? null : 'callback')}><Icon name="calendar" size={16} />Schedule callback</button>
          <button type="button" className="btn btn--sm" disabled={a.ended} onClick={() => { dispatch({ type: 'line', who: 'system', text: 'SMS sent: link to the beneficiary status page' }); toast('SMS sent (demo).'); }}><Icon name="mail" size={16} />Send SMS with link</button>
        </div>
        {form === 'ticket' && (
          <form className="mini" onSubmit={createTicket}>
            <label className="field"><span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Instalment not received</option><option>Wrong bank details</option><option>e-KYC problem</option><option>Other</option>
              </select>
            </label>
            <label className="field"><span>Details</span><textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
            <button className="btn btn--primary btn--sm" type="submit">Create ticket</button>
          </form>
        )}
        {form === 'callback' && (
          <form className="mini" onSubmit={bookCallback}>
            <label className="field"><span>When</span>
              <select value={slot} onChange={(e) => setSlot(e.target.value)}>
                <option>Tomorrow · 9 am – 12 pm</option><option>Tomorrow · 12 pm – 3 pm</option><option>Tomorrow · 3 pm – 6 pm</option>
              </select>
            </label>
            <button className="btn btn--primary btn--sm" type="submit">Book</button>
          </form>
        )}
      </section>

      <section className={`panel ${a.ended ? 'panel--wrap' : ''}`} ref={wrapRef}>
        <h3>Wrap-up</h3>
        {a.ended ? (
          <>
            <label className="field"><span>After-call notes (AI draft, edit as needed)</span>
              <textarea rows={5} value={a.notes} onChange={(e) => dispatch({ type: 'notes', notes: e.target.value })} /></label>
            <label className="field"><span>Outcome</span>
              <select ref={dispRef} value={disposition} onChange={(e) => setDisposition(e.target.value)}>
                <option value="">Choose…</option>{state.dispositions.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <button type="button" className="btn btn--primary" onClick={complete}>Complete &amp; next</button>
          </>
        ) : <p className="note">End the call or chat to write notes and set the outcome. Notes are drafted by the AI from the transcript.</p>}
      </section>
    </>
  );
}
