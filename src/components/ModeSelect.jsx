export default function ModeSelect({ onChat, onVoice, realtimeReady }) {
  return (
    <section className="stage" aria-label="Choose mode">
      <div className="eyebrow">READY TO RECALL <span>✳</span> CHOOSE HOW</div>
      <h1>How would you<br /><em>like to practice?</em></h1>
      <p className="intro">
        Work through your questions by typing, or have a live voice conversation — the AI will ask,
        listen, and guide you the same way.
      </p>

      <div className="mode-cards">
        <button className="mode-card" onClick={onChat}>
          <span className="mode-icon">💬</span>
          <span className="mode-title">Chat</span>
          <span className="mode-desc">Type your answers at your own pace. The answer reveals gradually as you think.</span>
        </button>

        <button
          className={`mode-card${realtimeReady ? '' : ' mode-card-disabled'}`}
          onClick={realtimeReady ? onVoice : undefined}
          disabled={!realtimeReady}
          aria-disabled={!realtimeReady}
        >
          <span className="mode-icon">🎙️</span>
          <span className="mode-title">Voice</span>
          <span className="mode-desc">
            {realtimeReady
              ? 'Speak your answers live. The AI listens and responds in real time.'
              : 'Requires OPENAI_REALTIME_KEY on the server.'}
          </span>
        </button>
      </div>
    </section>
  );
}
