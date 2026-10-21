import { NavLink } from 'react-router-dom';
import { useAssist } from '../store.jsx';
import { useToast } from './Toast.jsx';


export default function Bar() {
  const { state, dispatch } = useAssist();
  const toast = useToast();
  const { officer, status } = state;

  function setStatus(e) {
    dispatch({ type: 'status', status: e.target.value });
    toast(e.target.value === 'available' ? 'You will receive new handoffs.' : 'New handoffs go to other officers, or citizens are offered a callback.');
  }

  return (
    <header className="bar">
      <NavLink className="bar__brand" to="/">
        <svg className="bar__mark" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3C8.8 3 3 8.4 3 15c0 3.2 1.4 6.1 3.6 8.3L5.5 29l6-2.6c1.4.4 2.9.6 4.5.6 7.2 0 13-5.4 13-12S23.2 3 16 3z" fill="#0b57d0" />
          <path d="M10 15v2M13 12v8M16 9.5v13M19 12v8M22 15v2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span><strong>Agent console</strong><small>Live assist · POC</small></span>
      </NavLink>
      <nav className="bar__nav" aria-label="Console">
        <NavLink to="/" end>Live queue</NavLink>
        <NavLink to="/callbacks">Callbacks</NavLink>
      </nav>
      <span className="bar__spacer" />
      <label className="status-select">
        <span className="sr-only">My status</span>
        <span className="status-dot" data-status={status} aria-hidden="true" />
        <select value={status} onChange={setStatus} aria-label="My status">
          <option value="available">Available</option><option value="busy">Busy</option><option value="away">Away</option>
        </select>
      </label>
      <span className="officer">
        <span className="avatar" aria-hidden="true">{officer.short}</span>
        <span className="officer__text"><strong>{officer.name}</strong><small>{officer.role}</small></span>
      </span>
    </header>
  );
}
