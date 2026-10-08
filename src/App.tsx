import { useState } from 'react';
import { NetworkStatus } from './components/NetworkStatus';
import { UpdatePrompt } from './components/UpdatePrompt';
import { HomeScreen } from './screens/HomeScreen';
import { KnowledgeBrowser } from './screens/KnowledgeBrowser';
import { PaidFeatureQuotaBanner } from './screens/PaidFeatureQuotaBanner';
import { AdminDashboardScreen } from './screens/admin/AdminDashboardScreen';
import { SelfServiceScreen } from './screens/SelfServiceScreen';
import { RequestEpochPanel } from './screens/RequestEpochPanel';
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';

export function App() {
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(window.location.pathname === '/admin');
  const [selfOpen, setSelfOpen] = useState(false);

  return (
    <main>
      <NetworkStatus />
      <UpdatePrompt />
      <header>
        <p lang="en">TOKYO MATE</p>
        <h1>東京通</h1>
      </header>
      {adminOpen ? <AdminDashboardScreen onBack={() => { window.history.replaceState(null, '', '/'); setAdminOpen(false); }} /> :
        selfOpen ? <SelfServiceScreen onBack={() => setSelfOpen(false)} /> :
        knowledgeOpen ? <KnowledgeBrowser onBack={() => setKnowledgeOpen(false)} /> : <>
          <button onClick={() => setSelfOpen(true)}>本人申請與操作狀態</button>
          <PaidFeatureQuotaBanner onOpenPublic={() => setKnowledgeOpen(true)} />
          <RequestEpochPanel />
          <HomeScreen onOpenKnowledge={() => setKnowledgeOpen(true)} />
        </>}
    </main>
  );
}