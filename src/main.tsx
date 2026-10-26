import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { SearchDockProvider } from './context/SearchDock';
import { loadCatalog } from './services/catalog';
import './index.css';

const root = createRoot(document.getElementById('root')!);

/**
 * The catalog is loaded before the first render so every component can read it
 * synchronously — no per-component loading states, no layout shift.
 */
loadCatalog()
  .then(() => {
    root.render(
      <StrictMode>
        <ThemeProvider>
            <SearchDockProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </SearchDockProvider>
        </ThemeProvider>
      </StrictMode>,
    );
  })
  .catch((err: unknown) => {
    root.render(
      <div style={{ padding: '4rem 1.5rem', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Couldn't load the gift card catalog</h1>
        <p style={{ marginTop: '0.75rem', opacity: 0.7 }}>{String((err as Error)?.message ?? err)}</p>
        <p style={{ marginTop: '1.5rem', opacity: 0.7 }}>
          Run <code>npm run scrape</code> to fetch live prices, then reload.
        </p>
      </div>,
    );
  });
