// App-wide state. Today it is seeded from mock data; later each slice loads from the orchestrator API.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createMock } from './data/mock.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [seed] = useState(createMock);
  const [kbVersion, setKbVersion] = useState(seed.kb.version);
  const [documents, setDocuments] = useState(seed.documents);
  const [chunks, setChunks] = useState(seed.chunks);
  const [providers, setProviders] = useState(seed.providers);
  const [cache, setCache] = useState(seed.cache);
  const [changeLog, setChangeLog] = useState(seed.changeLog);
  const [evalReport, setEvalReport] = useState(seed.evalReport);

  const bumpKb = useCallback(() => setKbVersion((v) => v + 1), []);
  const logChange = useCallback((entry) => setChangeLog((log) => [entry, ...log]), []);

  const value = useMemo(() => ({
    ...seed, kb: { ...seed.kb, version: kbVersion },
    documents, setDocuments, chunks, setChunks, bumpKb,
    providers, setProviders, cache, setCache, changeLog, logChange,
    evalReport, setEvalReport,
  }), [seed, kbVersion, documents, chunks, bumpKb, providers, cache, changeLog, logChange, evalReport]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
