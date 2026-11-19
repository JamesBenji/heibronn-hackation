import { useMemo } from 'react';

export default function RevealBox({ answer, progress, thinkMs, revealMs }) {
  const visible = progress <= thinkMs ? 0 : Math.min(1, (progress - thinkMs) / revealMs);
  const percent = Math.round(visible * 100);

  const chars = useMemo(() => Array.from(answer), [answer]);
  const reach = visible * (chars.length + 4);

  return (
    <div className="reveal-box">
      <div className="reveal-heading">
        <span>THE ANSWER, COMING INTO FOCUS</span>
        <span aria-label={`${percent}% revealed`}>{percent}%</span>
      </div>
      <div
        className="reveal-text"
        aria-label="Progressively revealing answer"
        aria-live="off"
      >
        {chars.map((char, i) => {
          const clarity = Math.max(0, Math.min(1, (reach - i) / 4));
          return (
            <span
              key={i}
              style={{
                opacity: clarity,
                filter: `blur(${(1 - clarity) * 5}px)`,
              }}
            >
              {char}
            </span>
          );
        })}
      </div>
      <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-track-fill" style={{ width: `${visible * 100}%` }} />
      </div>
    </div>
  );
}
