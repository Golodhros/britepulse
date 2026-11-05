import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { sharedLabel } from './shared.js';
import './style.css';

function App() {
  const [value, setValue] = useState(sharedLabel);

  return (
    <main>
      <h1>{value}</h1>
      <button onClick={async () => setValue((await import('consumer-variant')).details)}>
        Load details
      </button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
