# Progressive recall

An account-free web app for reviewing material you have already studied. See [the MVP plan](docs/MVP.md).

## Development

Requires Node.js 20 or newer.

```sh
npm install
```

Start the Vite dev server (hot-reload, proxies `/api` to Express):

```sh
# Terminal 1 — Express API
OPENAI_API_KEY=your_key npm start

# Terminal 2 — Vite dev server
npm run dev
```

Open <http://localhost:5173>. Optionally set `OPENAI_MODEL` (default: `gpt-4o-mini`) and `PORT`. Put the key in your environment, never in browser code or Git.

Without a key, the example session shows the progressive text interaction. Generating items and checking answers require a configured key. Upload supports UTF-8 `.txt` and `.md` files (up to 1 MiB); PDF and image extraction are future milestones.

## Production build

```sh
npm run build        # writes static assets to dist/
OPENAI_API_KEY=your_key npm start  # Express serves dist/
```

Open <http://localhost:3000>.

## Test

```sh
npm test
```

Runs the Express server tests.

## Stack

- **React 19** via Vite for the browser UI
- **Express 5** API server (`/api/items`, `/api/assess`, `/api/status`)
- **OpenAI** structured outputs for item generation and answer assessment

This is an MVP, not a hosted production service: before opening a public endpoint, add rate limiting, abuse controls, a privacy notice, and an operational budget.
