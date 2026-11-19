import { useState, useEffect, useRef, useCallback } from 'react';

const SPELL_DELAY_MS = 2000;

function buildSystemPrompt(items) {
  const itemList = items.map((item, i) =>
    `Question ${i + 1}: ${item.question}\nAnswer: ${item.answer}\nContext: "${item.excerpt}"`
  ).join('\n\n');

  return `You are a warm, natural study coach having a voice conversation with a learner. You are helping them recall ${items.length} concept(s).

${itemList}

YOUR ROLE:
- Keep responses to 1-2 sentences. Sound like a person, not a robot.
- Start with a brief intro — tell the learner that after each question, if they pause, you'll begin spelling out the answer letter by letter as a hint. Keep the intro to one sentence.
- Then ask Question 1.
- When the learner answers correctly, affirm them warmly and move to the next question.
- When they're close, acknowledge what they got right and give a short nudge.
- When they're wrong, encourage them to try again.
- When asked by the system to spell, spell each letter slowly and clearly with a pause between each — e.g. "V... O... L... T... A... G... E" — then say the full word once.
- After all questions, wrap up warmly and tell them how many they got right.`;
}

function buildSpellPrompt(answer) {
  return `The learner hasn't answered yet. Spell out the answer letter by letter as a hint, slowly and clearly. The answer is: "${answer}". Spell each letter individually then say the full word.`;
}

export default function VoiceSession({ items, onFinish, onRestart }) {
  const [status, setStatus]             = useState('idle');
  const [transcript, setTranscript]     = useState([]);
  const [error, setError]               = useState('');
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [aiSpeaking, setAiSpeaking]     = useState(false);
  const [spelling, setSpelling]         = useState(false);

  const pcRef         = useRef(null);
  const dcRef         = useRef(null);
  const streamRef     = useRef(null);
  const audioElRef    = useRef(null);
  const statusRef     = useRef('idle');
  const spellTimerRef   = useRef(null);
  const spellingRef     = useRef(false); // suppress transcript during spelling turn
  const askedQuestionRef = useRef(false); // was the last AI turn a question
  const currentQRef   = useRef(0);     // index of current question
  const userSpoke     = useRef(false); // did user speak since last AI turn ended

  const addLine = useCallback((role, text) => {
    setTranscript(t => [...t, { role, text }]);
  }, []);

  function clearSpellTimer() {
    if (spellTimerRef.current) {
      clearTimeout(spellTimerRef.current);
      spellTimerRef.current = null;
    }
  }

  function triggerSpelling() {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;
    const item = items[currentQRef.current];
    if (!item) return;
    setSpelling(true);
    spellingRef.current = true;
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: buildSpellPrompt(item.answer) }],
      },
    }));
    dc.send(JSON.stringify({ type: 'response.create' }));
  }

  function scheduleSpelling() {
    clearSpellTimer();
    userSpoke.current = false;
    spellTimerRef.current = setTimeout(() => {
      // Only spell if user hasn't spoken since AI finished
      if (!userSpoke.current) triggerSpelling();
    }, SPELL_DELAY_MS);
  }

  function setupAudio(stream) {
    if (!audioElRef.current) {
      audioElRef.current = document.createElement('audio');
      audioElRef.current.autoplay = true;
    }
    audioElRef.current.srcObject = stream;
  }

  const stop = useCallback(() => {
    clearSpellTimer();
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    dcRef.current     = null;
    pcRef.current     = null;
    streamRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    statusRef.current = 'connecting';
    setError('');
    setTranscript([]);
    setSpelling(false);
    currentQRef.current = 0;
    userSpoke.current = false;
    askedQuestionRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = e => setupAudio(e.streams[0]);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus('active');
        statusRef.current = 'active';
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: buildSystemPrompt(items),
            output_modalities: ['audio'],
            audio: {
              input: {
                transcription: { model: 'gpt-realtime-whisper' },
                turn_detection: {
                  type: 'semantic_vad',
                  eagerness: 'auto',
                  create_response: true,
                  interrupt_response: true,
                },
              },
              output: { voice: 'marin' },
            },
          },
        }));
        dc.send(JSON.stringify({ type: 'response.create' }));
      };

      dc.onmessage = e => {
        try {
          const ev = JSON.parse(e.data);
          console.log('[oai-event]', ev.type, ev);
          handleEvent(ev);
        } catch {}
      };

      dc.onerror = () => {
        setError('Connection error. Please try again.');
        setStatus('error');
        statusRef.current = 'error';
      };

      dc.onclose = () => {
        if (statusRef.current !== 'done' && statusRef.current !== 'error') {
          setStatus('idle');
          statusRef.current = 'idle';
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch('/api/realtime-sdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp,
      });
      if (!sdpRes.ok) {
        const err = await sdpRes.text();
        throw new Error(`SDP exchange failed: ${err}`);
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() });

    } catch (err) {
      setError(err.message);
      setStatus('error');
      statusRef.current = 'error';
      stop();
    }
  }, [items, stop]);

  function handleEvent(event) {
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        // User started speaking — cancel any pending spell timer
        userSpoke.current = true;
        clearSpellTimer();
        setSpelling(false);
        setUserSpeaking(true);
        break;
      case 'input_audio_buffer.speech_stopped':
        setUserSpeaking(false);
        break;
      case 'response.output_audio.delta':
        setAiSpeaking(true);
        break;
      case 'response.output_audio.done':
        // Only start spell countdown if the AI just asked a question
        setAiSpeaking(false);
        if (askedQuestionRef.current) scheduleSpelling();
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript?.trim()) addLine('user', event.transcript.trim());
        break;
      case 'response.output_audio_transcript.done': {
        const text = event.transcript?.trim() ?? '';
        // Don't show the spelled answer in the transcript
        if (text && !spellingRef.current) addLine('assistant', text);
        spellingRef.current = false;
        const lower = text.toLowerCase();
        // Mark whether this turn was a question (so audio.done knows to arm the timer)
        askedQuestionRef.current = text.includes('?');
        // Detect correct answer / question advance → reset spelling state and advance question index
        if (lower.includes('next question') || lower.includes('moving on') ||
            lower.includes("that's right") || lower.includes('correct') ||
            lower.includes('well done') || lower.includes('exactly')) {
          setSpelling(false);
          askedQuestionRef.current = false;
          currentQRef.current = Math.min(currentQRef.current + 1, items.length - 1);
        }
        break;
      }
      case 'error':
        setError(event.error?.message || 'An error occurred.');
        setStatus('error');
        statusRef.current = 'error';
        break;
    }
  }

  function handleStop() {
    stop();
    setStatus('idle');
    statusRef.current = 'idle';
  }

  function handleDone() {
    setStatus('done');
    statusRef.current = 'done';
    stop();
    onFinish(0);
  }

  useEffect(() => () => stop(), [stop]);

  return (
    <section className="stage" aria-label="Voice session">
      <div className="session-head">
        <div className="eyebrow">VOICE SESSION <span>✳</span> {items.length} QUESTION{items.length !== 1 ? 'S' : ''}</div>
        <button className="text-button" onClick={onRestart}>End session <span>×</span></button>
      </div>

      <div className="session-card voice-card">
        {status === 'idle' && (
          <div className="voice-idle">
            <p className="instruction">
              The AI asks you each question out loud. If you pause, it will start spelling the answer letter by letter — jump in any time you remember.
            </p>
            <button className="primary" onClick={connect}>
              Start voice session <span>↗</span>
            </button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="voice-connecting">
            <div className="voice-orb voice-orb-pulse" />
            <p>Connecting…</p>
          </div>
        )}

        {status === 'active' && (
          <div className="voice-active">
            <div className={`voice-orb${aiSpeaking ? ' voice-orb-ai' : userSpeaking ? ' voice-orb-user' : ' voice-orb-idle'}`} />
            <p className="voice-status">
              {aiSpeaking
                ? (spelling ? 'Spelling hint…' : 'AI is speaking…')
                : userSpeaking
                  ? 'Listening…'
                  : 'Your turn — speak your answer'}
            </p>
            {spelling && !aiSpeaking && (
              <p className="voice-hint-level">Spelling hint incoming…</p>
            )}
            <div className="voice-controls">
              <button className="secondary" onClick={handleStop}>End call <span>×</span></button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="voice-error">
            <p className="error" role="alert">{error}</p>
            <button className="primary" onClick={connect}>Try again <span>↗</span></button>
          </div>
        )}

        {transcript.length > 0 && (
          <div className="voice-transcript">
            <span className="card-label">TRANSCRIPT</span>
            <div className="transcript-lines">
              {transcript.map((line, i) => (
                <div key={i} className={`transcript-line transcript-${line.role}`}>
                  <span className="transcript-speaker">{line.role === 'user' ? 'You' : 'AI'}</span>
                  <span>{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'active' && transcript.length > 0 && (
          <button className="text-button" style={{ marginTop: 20 }} onClick={handleDone}>
            Finish session <span>↗</span>
          </button>
        )}
      </div>
    </section>
  );
}
