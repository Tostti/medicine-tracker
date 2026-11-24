import ReactDOM from 'react-dom/client';
import App from './App';
// Sets up translations (imports run before the render below, so the first render is translated).
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
