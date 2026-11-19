import { useState, useCallback, useEffect } from 'react';
import SetupStage from './components/SetupStage.jsx';
import ReviewStage from './components/ReviewStage.jsx';
import ModeSelect from './components/ModeSelect.jsx';
import SessionStage from './components/SessionStage.jsx';
import VoiceSession from './components/VoiceSession.jsx';
import FinishStage from './components/FinishStage.jsx';

export const SAMPLE_SOURCE =
  'Active recall means trying to bring information to mind before seeing the answer. This effort can strengthen later remembering. Progressive support begins with a challenge and gradually makes the target answer easier to perceive when the learner needs help. When the learner starts responding, support stops increasing, and it resumes if they stop before completing a correct response. The goal is to produce the response yourself with only as much help as you need.';

export const SAMPLE_ITEMS = [
  { question: 'What is active recall?', answer: 'Trying to bring information to mind before seeing the answer.', excerpt: 'Active recall means trying to bring information to mind before seeing the answer.' },
  { question: 'What happens to support while the learner responds?', answer: 'It stops increasing, then resumes if they stop before completing a correct response.', excerpt: 'When the learner starts responding, support stops increasing, and it resumes if they stop before completing a correct response.' },
  { question: 'What is the goal of progressive support?', answer: 'To produce the response yourself with only as much help as you need.', excerpt: 'The goal is to produce the response yourself with only as much help as you need.' },
];

async function post(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export { post };

export default function App() {
  const [stage, setStage] = useState('setup');
  const [items, setItems] = useState([]);
  const [demo, setDemo] = useState(false);
  const [recalled, setRecalled] = useState(0);
  const [aiReady, setAiReady] = useState(true);
  const [realtimeReady, setRealtimeReady] = useState(false);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(s => { setAiReady(s.aiReady); setRealtimeReady(s.realtimeReady); })
      .catch(() => {});
  }, []);

  const goSetup = useCallback(() => {
    setItems([]);
    setStage('setup');
  }, []);

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Recall home" onClick={e => { e.preventDefault(); goSetup(); }}>
          <span className="brand-mark">◒</span> recall<span className="brand-dot">.</span>
        </a>
        <span className="top-note">A little help, right when you need it.</span>
      </header>

      <main>
        {stage === 'setup' && (
          <SetupStage
            aiReady={aiReady}
            onItems={(newItems, isDemo) => {
              setItems(newItems);
              setDemo(isDemo);
              setStage('review');
            }}
          />
        )}
        {stage === 'review' && (
          <ReviewStage
            items={items}
            onItemsChange={setItems}
            onBegin={() => { setRecalled(0); setStage('mode'); }}
            onRestart={goSetup}
          />
        )}
        {stage === 'mode' && (
          <ModeSelect
            realtimeReady={realtimeReady}
            onChat={() => setStage('session')}
            onVoice={() => setStage('voice')}
          />
        )}
        {stage === 'session' && (
          <SessionStage
            items={items}
            demo={demo}
            onFinish={finalRecalled => { setRecalled(finalRecalled); setStage('finish'); }}
            onRestart={goSetup}
          />
        )}
        {stage === 'voice' && (
          <VoiceSession
            items={items}
            onFinish={finalRecalled => { setRecalled(finalRecalled); setStage('finish'); }}
            onRestart={goSetup}
          />
        )}
        {stage === 'finish' && (
          <FinishStage
            recalled={recalled}
            total={items.length}
            demo={demo}
            onRestart={goSetup}
          />
        )}
      </main>

      <footer>
        Built for active recall · Inspired by progressive support ·{' '}
        <a href="https://enlumen.eu/en/" target="_blank" rel="noopener noreferrer">
          About the approach ↗
        </a>
      </footer>
    </>
  );
}
