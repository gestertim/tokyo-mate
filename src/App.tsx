import { useState } from 'react';
import { NetworkStatus } from './components/NetworkStatus';
import { UpdatePrompt } from './components/UpdatePrompt';
import { HomeScreen } from './screens/HomeScreen';
import { KnowledgeBrowser } from './screens/KnowledgeBrowser';
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';

export function App() {
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  return (
    <main>
      <NetworkStatus />
      <UpdatePrompt />
      <header>
        <p lang="en">TOKYO MATE</p>
        <h1>東京通</h1>
      </header>
      {knowledgeOpen ? <KnowledgeBrowser onBack={() => setKnowledgeOpen(false)} /> : <HomeScreen onOpenKnowledge={() => setKnowledgeOpen(true)} />}
    </main>
  );
}