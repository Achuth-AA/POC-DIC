// Console state: officer status, handoff queue, the active conversation and callbacks.
// In the real build the queue and live transcript arrive over SSE from GET /v1/sessions/live.
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { createMock } from './data/mock.js';

export const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const ticketId = () => `G-2026-${Math.floor(1000 + Math.random() * 9000)}`;
const callbackRef = () => `CB-${Math.floor(10000 + Math.random() * 90000)}`;

function draftNotes(a) {
  const tickets = a.caller.tickets.length ? ` Grievance ${a.caller.tickets.join(', ')} registered.` : '';
  return `${a.summary.intent} ${a.caller.verified ? 'Caller verified with OTP.' : 'Caller not verified.'} ${a.summary.points.slice(1, 3).join(' ')} Officer explained the instalment periods and next steps.${tickets}`;
}

function withActive(state, fn) {
  return state.active ? { ...state, active: fn(state.active) } : state;
}
const line = (who, text, at = now()) => ({ who, text, at });

function reducer(state, action) {
  switch (action.type) {
    case 'tick':
      return {
        ...state,
        queue: state.queue.map((q) => ({ ...q, waitedSec: q.waitedSec + 1 })),
        active: state.active && !state.active.ended ? { ...state.active, startedSec: state.active.startedSec + 1 } : state.active,
      };
    case 'status':
      return { ...state, status: action.status };
    case 'accept': {
      const item = state.queue.find((q) => q.id === action.id);
      if (!item || state.active) return state;
      return {
        ...state,
        queue: state.queue.filter((q) => q.id !== action.id),
        active: {
          ...item, caller: { ...item.caller, tickets: [...item.caller.tickets] }, startedSec: 0, muted: false, held: false, ended: false, notes: '',
          transcript: [...item.history.map(([who, text]) => line(who, text, '')), line('system', `${state.officer.name} joined`)],
          liveQueue: [...item.live], awaitingCitizen: true,
          lastCitizen: item.history.filter(([w]) => w === 'citizen').pop()?.[1] || '',
        },
      };
    }
    case 'line':
      return withActive(state, (a) => ({
        ...a, transcript: [...a.transcript, line(action.who, action.text)], awaitingCitizen: a.awaitingCitizen || action.who === 'officer',
      }));
    case 'live':
      return withActive(state, (a) => {
        if (!a.liveQueue.length) return a;
        const [[who, text], ...rest] = a.liveQueue;
        return {
          ...a, liveQueue: rest, awaitingCitizen: false, transcript: [...a.transcript, line(who, text)],
          lastCitizen: who === 'citizen' ? text : a.lastCitizen,
        };
      });
    case 'toggle':
      return withActive(state, (a) => {
        const next = { ...a, [action.key]: !a[action.key] };
        return action.key === 'held' ? { ...next, transcript: [...a.transcript, line('system', next.held ? 'Caller put on hold' : 'Caller resumed')] } : next;
      });
    case 'end':
      return withActive(state, (a) => {
        const ended = { ...a, ended: true, transcript: [...a.transcript, line('system', a.channel === 'voice' ? 'Call ended' : 'Chat ended')] };
        return { ...ended, notes: draftNotes(ended) };
      });
    case 'notes':
      return withActive(state, (a) => ({ ...a, notes: action.notes }));
    case 'verify':
      return withActive(state, (a) => ({
        ...a, caller: { ...a.caller, verified: true, authLevel: 1 }, transcript: [...a.transcript, line('system', 'OTP sent and verified · auth level 1')],
      }));
    case 'ticket':
      return withActive(state, (a) => ({
        ...a, caller: { ...a.caller, tickets: [...a.caller.tickets, action.id] },
        transcript: [...a.transcript, line('system', `Grievance ${action.id} registered by officer (${action.category})`)],
      }));
    case 'callback': {
      const a = state.active;
      const cb = { ref: callbackRef(), when: action.slot, lang: a.lang, channel: a.channel, summary: a.summary.intent, verified: a.caller.verified, status: 'scheduled' };
      return { ...state, callbacks: [cb, ...state.callbacks], active: { ...a, transcript: [...a.transcript, line('system', `Callback booked: ${action.slot}`)] } };
    }
    case 'complete':
      return { ...state, active: null, done: state.done + 1 };
    case 'handoff':
      return { ...state, queue: [...state.queue, action.item] };
    case 'callbackDone':
      return { ...state, callbacks: state.callbacks.map((c) => (c.ref === action.ref ? { ...c, status: 'done' } : c)) };
    default:
      return state;
  }
}

const Ctx = createContext(null);

// A new handoff arrives a little after start, to show the queue updating live.
const LATE_HANDOFF = {
  id: 's_c_2311', channel: 'chat', lang: 'Hinglish', waitedSec: 0, reason: 'Caller asked for a person',
  caller: { label: 'Web visitor', phone: '—', verified: true, authLevel: 1, regNo: 'MH98•••••21', state: 'Maharashtra', ekyc: 'Pending', land: 'Verified', last: '₹2,000 on 12 Jun 2026', tickets: [] },
  summary: { intent: 'Instalments on hold; wants to know how to finish e-KYC.', points: ['Verified with OTP (form).', 'Status shows e-KYC pending; payments on hold.', 'AI explained OTP and CSC e-KYC; citizen still wants a person.'], sentiment: 'Frustrated' },
  history: [['ai', 'Your e-KYC is pending, so instalments are on hold. You can complete it with an Aadhaar OTP on the portal or at a CSC.'], ['citizen', 'OTP nahi aa raha, kisi se baat karni hai'], ['system', 'Transferred to officer · AI summary attached']],
  live: [['citizen', 'Aadhaar se mobile number link nahi hai shayad. Ab kya karun?']],
};

export function AssistProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const m = createMock();
    return { ...m, status: 'available', active: null, done: 0 };
  });

  useEffect(() => {
    const clock = setInterval(() => dispatch({ type: 'tick' }), 1000);
    const late = setTimeout(() => dispatch({ type: 'handoff', item: LATE_HANDOFF }), 20000);
    return () => { clearInterval(clock); clearTimeout(late); };
  }, []);

  const value = useMemo(() => ({ state, dispatch, ticketId }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAssist = () => useContext(Ctx);
