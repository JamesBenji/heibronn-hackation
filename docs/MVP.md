# Progressive recall MVP

## Goal

Give someone who has already studied a source a short, source-grounded recall session. The learner produces the answer, while the interface progressively provides only enough support to complete the attempt. The site is open without accounts.

## First complete flow

1. Paste previously studied text or upload a UTF-8 `.txt`/`.md` file.
2. Generate up to three review items containing a cue, concise target answer, and exact supporting excerpt. Review and discard weak items.
3. Begin an attempt with an initial thinking period. The answer gradually becomes visible. The learner may pause and resume the reveal.
4. While the learner types, the reveal stops advancing. After a short idle interval it resumes. The learner submits an answer for meaning-based assessment against the source. A partly correct answer receives a short follow-up and stays on the same attempt.
5. A correct response ends the attempt and displays the complete answer and source excerpt. An explicit `Show answer` escape hatch lets the learner move on without counting the item as recalled.

## Architecture

- **Browser:** local session state and a deterministic, time-based text reveal. It never receives an API key.
- **Express server:** static files and two bounded JSON endpoints, `/api/items` and `/api/assess`.
- **Model adapter:** structured item generation and response assessment. It treats uploaded material as data, grounds each item in a verbatim excerpt, and checks the excerpt exists in the submitted source.

The server holds no account or database. The source stays in browser memory during the session; each model request transmits only the text needed for that operation. A configured OpenAI API key on the server is required for AI-generated items and assessment. The included example lets a contributor inspect the reveal interaction without a key.

## Next small units

1. Validate the typed interaction with learners and tune thinking delay, reveal speed, and interruption behavior.
2. Extract text from PDFs, with review of the extracted text before generation.
3. Add labelled-image items with explicitly selected target regions, keeping context visible while target details progressively clarify through opacity and Gaussian blur.
4. Add speech input, audio output, and scheduled calls only after the core session works.

## References and boundary

- [Enlumen's Progressive Hinting and AnswerSense](https://enlumen.eu/en/)
- [DE102024101561B4](https://patents.google.com/patent/DE102024101561B4/en)

The source describes several reveal treatments; Gaussian blur is one visual mechanism, not a requirement that all text be blurred in the same way. Before publicly presenting this as an Enlumen implementation, establish rights to the patented method and use of its names.
