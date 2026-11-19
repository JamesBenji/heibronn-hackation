import { useState, useRef } from 'react';
import { SAMPLE_ITEMS, post } from '../App.jsx';

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';
const MAX_BINARY = 10 * 1024 * 1024;
const MAX_TEXT   = 1 * 1024 * 1024;

export default function SetupStage({ aiReady, onItems }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState(aiReady ? '' : 'AI generation is not configured on this server. You can still try the sample reveal.');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const charCount = source.length;

  async function generate(text) {
    const trimmed = text.trim();
    if (trimmed.length < 150 || trimmed.length > 40000) {
      setError('Provide 150 to 40,000 characters of study material.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await post('/api/items', { source: trimmed });
      onItems(data.items, false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDemo() {
    onItems(structuredClone(SAMPLE_ITEMS), true);
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    // reset so the same file can be re-selected
    e.target.value = '';
    setError('');
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'txt' || ext === 'md') {
      if (file.size > MAX_TEXT) { setError('Choose a .txt or .md file no larger than 1 MiB.'); return; }
      const text = (await file.text()).slice(0, 40000);
      setSource(text);
      // auto-submit for text files too
      await generate(text);
      return;
    }

    if (ext === 'pdf' || ext === 'docx') {
      if (file.size > MAX_BINARY) { setError('File too large. Maximum is 10 MiB.'); return; }
      setLoading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch('/api/extract', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Extraction failed.');
        // go straight to question generation — no need to show the text
        await generate(data.text);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
      return;
    }

    setError('Unsupported file type. Use PDF, DOCX, TXT, or MD.');
  }

  return (
    <section className="stage" aria-label="Setup">
      <div className="eyebrow">LEARN WHAT STAYS WITH YOU <span>✳</span> NO ACCOUNT NEEDED</div>
      <h1>Remember it<br /><em>your way.</em></h1>
      <p className="intro">
        Bring something you've already studied. We'll turn it into a few questions and gently reveal
        the answers while you work them out.
      </p>

      <div className="panel source-panel">
        <div className="panel-heading">
          <span className="step-number">01</span>
          <div>
            <h2>Your study material</h2>
            <p>Paste a passage, or upload a PDF, DOCX, TXT, or MD file.</p>
          </div>
        </div>
        <label htmlFor="source" className="sr-only">Study material</label>
        <textarea
          id="source"
          placeholder="Paste something you've already read or studied…"
          maxLength={40000}
          value={source}
          onChange={e => { setSource(e.target.value); setError(''); }}
          disabled={loading}
        />
        <div className="source-actions">
          <div className="upload-area">
            <label className={`file-button${loading ? ' file-button-disabled' : ''}`} htmlFor="file-input">
              {loading ? 'Working…' : '↥ \u00a0 Upload file'}
            </label>
            <input
              id="file-input"
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="file-input"
              onChange={handleFile}
              disabled={loading}
            />
          </div>
          <span>{charCount.toLocaleString()} / 40,000 characters</span>
        </div>
      </div>

      <div className="start-row">
        <button className="primary" onClick={() => generate(source)} disabled={loading}>
          {loading ? 'Making questions…' : <>Make my questions <span>↗</span></>}
        </button>
        <button className="text-button" onClick={handleDemo} disabled={loading}>
          Try the sample <span>→</span>
        </button>
      </div>

      <p className="hint">
        Uploading a file skips to question generation automatically. Supports PDF, DOCX, TXT, and MD up to 10 MiB.
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
