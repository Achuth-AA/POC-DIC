import { useToast } from '../components/Toast.jsx';
import { useAssist } from '../store.jsx';

const STATUS = { scheduled: ['tag', 'Scheduled'], due: ['tag tag--warn', 'Due now'], done: ['tag tag--ok', 'Done'] };

export default function Callbacks() {
  const { state, dispatch } = useAssist();
  const toast = useToast();

  function call(c) {
    dispatch({ type: 'callbackDone', ref: c.ref });
    toast(`Dialling the citizen for ${c.ref} (demo). The summary opens in the console.`);
  }

  return (
    <main className="page">
      <div>
        <h1>Callbacks</h1>
        <p className="page-sub">Booked when no officer was free (for example, a web chat at 11 pm) or by an officer during a call. Each one carries the AI summary and the full transcript.</p>
      </div>
      <div className="card">
        <table className="data">
          <thead><tr><th>Ref.</th><th>When</th><th>Channel</th><th>Language</th><th>AI summary</th><th>Verified</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {state.callbacks.map((c) => (
              <tr key={c.ref}>
                <td className="mono">{c.ref}</td><td>{c.when}</td><td>{c.channel === 'voice' ? '📞 Voice' : '💬 Chat'}</td><td>{c.lang}</td>
                <td>{c.summary}</td><td>{c.verified ? <span className="tag tag--ok">✓ OTP</span> : <span className="tag">No</span>}</td>
                <td><span className={STATUS[c.status][0]}>{STATUS[c.status][1]}</span></td>
                <td>{c.status !== 'done' && <button type="button" className="btn btn--sm btn--primary" onClick={() => call(c)}>Call now</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
