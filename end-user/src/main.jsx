import { StrictMode, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import SchemePage from './SchemePage.jsx';
import Widget from './widget/Widget.jsx';
import './styles/site.css';

function App() {
  const widgetRef = useRef(null);
  // Page buttons ("Check eligibility", "Know your status", …) open the assistant through this.
  const assistant = useMemo(() => ({ open: (opts) => widgetRef.current?.open(opts) }), []);
  return (
    <>
      <SchemePage assistant={assistant} />
      <Widget ref={widgetRef} tenant="pm-kisan-demo" />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
