export default function FinishStage({ recalled, total, demo, onRestart }) {
  const summary = demo
    ? 'You explored the reveal. Add an AI key to generate questions from your own material and check your answers.'
    : `You recalled ${recalled} of ${total} ideas before seeing their full answers. Bring another passage whenever you're ready.`;

  return (
    <section className="stage" aria-label="Session complete">
      <div className="eyebrow">SESSION COMPLETE ✳</div>
      <h1>You did the<br /><em>remembering.</em></h1>
      <p className="intro">{summary}</p>
      <button className="primary" onClick={onRestart}>
        Review another passage <span>↗</span>
      </button>
    </section>
  );
}
