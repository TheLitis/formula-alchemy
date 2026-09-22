import { createRoot } from 'react-dom/client';
import { App, ErrorBoundary } from './app/App';
import { createSession, SessionContext } from './app/session';
import 'katex/dist/katex.min.css';
import './styles/app.css';
const session = createSession();
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    session.store.patch({ paused: true, trails: false });
const rootElement = document.getElementById('root');
if (!rootElement)
    throw new Error('Missing #root');
createRoot(rootElement).render(<ErrorBoundary><SessionContext.Provider value={session}><App /></SessionContext.Provider></ErrorBoundary>);
if (import.meta.hot)
    import.meta.hot.dispose(() => session.dispose());
