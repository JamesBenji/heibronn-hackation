import { useState, useEffect, useRef, useCallback } from 'react';
import { post } from '../App.jsx';
import RevealBox from './RevealBox.jsx';

const THINK_MS = 3000;
const REVEAL_MS = 14000;
const TYPING_PAUSE_MS = 800;

export default function SessionStage({ items, demo, onFinish, onRestart }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [manualPause, setManualPause] = useState(false);
  const [finished, setFinished] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null); // { text, correct }
  const [checking, setChecking] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [history, setHistory] = useState([]);

  // Accumulate recalled count across items without re-render jank
  const recalledRef    = useRef(0);
  const progressRef    = useRef(0);
  const lastFrameRef   = useRef(0);
  const lastTypingRef  = useRef(0);
  const manualPauseRef = useRef(false);
  const finishedRef    = useRef(false);
  const rafRef         = useRef(null);

  // Keep pause/finished refs in sync
  useEffect(() => { manualPauseRef.current = manualPause; }, [manualPause]);
  useEffect(() => { finishedRef.current    = finished; },    [finished]);

  const resetItem = useCallback(() => {
    progressRef.current    = 0;
    lastFrameRef.current   = 0;
    lastTypingRef.current  = 0;
    manualPauseRef.current = false;
    finishedRef.current    = false;
    setProgress(0);
    setManualPause(false);
    setFinished(false);
    setAnswer('');
    setFeedback(null);
    setShowResult(false);
    setHistory([]);
  }, []);

  // Single rAF loop for the whole session mount
  useEffect(() => {
    function tick(now) {
      if (!finishedRef.current) {
        if (!lastFrameRef.current) lastFrameRef.current = now;
        const typing = now - lastTypingRef.current < TYPING_PAUSE_MS;
        if (!manualPauseRef.current && !typing) {
          const delta = Math.min(now - lastFrameRef.current, 200);
          progressRef.current = Math.min(THINK_MS + REVEAL_MS, progressRef.current + delta);
          setProgress(progressRef.current);
        }
        // Always advance lastFrame so pause doesn't cause a catch-up burst
        lastFrameRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswerChange(e) {
    setAnswer(e.target.value);
    lastTypingRef.current = performance.now();
  }

  function togglePause() {
    const next = !manualPause;
    setManualPause(next);
    manualPauseRef.current = next;
  }

  function completeItem(success) {
    if (success) recalledRef.current += 1;
    finishedRef.current    = true;
    progressRef.current    = THINK_MS + REVEAL_MS;
    setFinished(true);
    setProgress(THINK_MS + REVEAL_MS);
    setShowResult(true);
  }

  async function handleSubmit() {
    const trimmed = answer.trim();
    if (!trimmed || finished) return;
    manualPauseRef.current = true;
    setManualPause(true);
    setChecking(true);
    try {
      const result = await post('/api/assess', { item: items[index], answer: trimmed, history });
      setHistory(h => [...h, trimmed]);
      setFeedback({ text: result.feedback, correct: result.verdict === 'correct' });
      if (result.verdict === 'correct') {
        completeItem(true);
      } else {
        setAnswer('');
        manualPauseRef.current = false;
        setManualPause(false);
      }
    } catch (e) {
      setFeedback({ text: 'Could not reach the server — check your connection and try again.', correct: false, error: true });
      manualPauseRef.current = false;
      setManualPause(false);
    } finally {
      setChecking(false);
    }
  }

  function handleNext() {
    const nextIndex = index + 1;
    if (nextIndex < items.length) {
      setIndex(nextIndex);
      resetItem();
    } else {
      onFinish(recalledRef.current);
    }
  }

  const item    = items[index];
  const isLast  = index === items.length - 1;
  const visible = progress <= THINK_MS ? 0 : Math.min(1, (progress - THINK_MS) / REVEAL_MS);

  // Status text — read typing state live per render
  const typing = performance.now() - lastTypingRef.current < TYPING_PAUSE_MS;
  let statusText;
  if (!manualPause && typing)   statusText = 'Paused while you respond.';
  else if (manualPause)         statusText = 'Reveal paused. Take your time.';
  else if (progress < THINK_MS) statusText = 'Think it through. You have a moment.';
  else if (visible >= 1)        statusText = 'The full answer is visible.';
  else                          statusText = 'A little more is coming into focus.';

  return (
    <section className="stage" aria-label="Recall session">
      <div className="session-head">
        <div className="eyebrow" aria-live="polite">
          QUESTION {index + 1} OF {items.length}
        </div>
        <button className="text-button" onClick={onRestart}>
          End session <span>×</span>
        </button>
      </div>

      <div className="session-card">
        <span className="card-label">BRING IT TO MIND</span>
        <h1 className="question">{item.question}</h1>
        <p className="instruction">
          Try answering from memory. The answer will gradually come into view below.
        </p>

        <RevealBox
          answer={item.answer}
          progress={progress}
          thinkMs={THINK_MS}
          revealMs={REVEAL_MS}
        />

        <div className="controls">
          <button
            className="secondary"
            aria-pressed={String(manualPause)}
            onClick={togglePause}
            disabled={finished}
          >
            {manualPause ? <>&#9654;&nbsp; Resume reveal</> : <>&#9208;&nbsp; Pause reveal</>}
          </button>
          <span aria-live="polite">{statusText}</span>
        </div>

        <label className="answer-label" htmlFor="session-answer">YOUR RESPONSE</label>
        <textarea
          id="session-answer"
          placeholder={demo ? 'Configure an API key to check your response.' : 'Explain it in your own words…'}
          rows={3}
          maxLength={1000}
          value={answer}
          onChange={handleAnswerChange}
          disabled={demo || finished}
        />

        <div className="answer-actions">
          {!demo && (
            <button
              className="primary"
              onClick={handleSubmit}
              disabled={checking || finished || !answer.trim()}
            >
              {checking ? 'Checking…' : <>Check my answer <span>↗</span></>}
            </button>
          )}
          {!finished && (
            <button className="text-button" onClick={() => completeItem(false)}>
              Show answer <span>→</span>
            </button>
          )}
        </div>

        {feedback && (
          <div className={`feedback${feedback.correct ? ' correct' : ''}${feedback.error ? ' error-feedback' : ''}`} role="status">
            <span>{feedback.text}</span>
            {feedback.error && (
              <button className="text-button retry-button" onClick={() => { setFeedback(null); }}>
                Try again →
              </button>
            )}
          </div>
        )}

        {showResult && (
          <div className="result">
            <span className="card-label">THE FULL ANSWER</span>
            <p>{item.answer}</p>
            <span className="card-label">FROM YOUR MATERIAL</span>
            <blockquote>{item.excerpt}</blockquote>
            <button className="primary" onClick={handleNext}>
              {isLast ? <>Finish session <span>↗</span></> : <>Next question <span>↗</span></>}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
