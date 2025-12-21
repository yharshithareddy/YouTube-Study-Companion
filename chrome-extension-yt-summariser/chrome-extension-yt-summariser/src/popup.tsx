import { createRoot } from 'react-dom/client';

export function Popup() {
  return (
    <div>
      <h1>Tube Talk</h1>
      <p>AI Summaries of YouTube videos</p>
      <img src="icon128.png"/>
    </div>
  );
}

// Get the root element and create a root with React 18's createRoot
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<Popup />);
}
