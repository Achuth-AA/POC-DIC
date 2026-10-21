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
        <span className="bar__mark" aria-hidden="true">VA</span>
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
