export default function ReviewStage({ items, onItemsChange, onBegin, onRestart }) {
  function removeItem(index) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  return (
    <section className="stage" aria-label="Review questions">
      <div className="eyebrow">YOUR REVIEW SET <span>✳</span> EDIT THE LINEUP</div>
      <h1>Pick what's<br /><em>worth a revisit.</em></h1>
      <p className="intro">
        Each question is tied to a passage from your material. Remove any that don't feel useful.
      </p>

      <div className="item-list" role="list">
        {items.map((item, i) => (
          <div key={i} className="item" role="listitem">
            <div>
              <span className="card-label">QUESTION {String(i + 1).padStart(2, '0')}</span>
              <strong>{item.question}</strong>
              <small>Source: &ldquo;{item.excerpt}&rdquo;</small>
            </div>
            <button
              type="button"
              className="item-remove"
              aria-label={`Remove question ${i + 1}`}
              onClick={() => removeItem(i)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="start-row">
        <button className="primary" onClick={onBegin} disabled={items.length === 0}>
          Begin recalling <span>↗</span>
        </button>
        <button className="text-button" onClick={onRestart}>
          Start over <span>→</span>
        </button>
      </div>
    </section>
  );
}
