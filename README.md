# Progressive recall

An early, account-free web MVP for reviewing material you have already studied. See [the MVP plan](docs/MVP.md).

## Run

Requires Node.js 20 or newer.

```sh
npm install
OPENAI_API_KEY=your_key npm start
```

Open <http://localhost:3000>. Optionally set `OPENAI_MODEL` (default: `gpt-4o-mini`) and `PORT`. Put the key in your environment, never in browser code or Git.

Without a key, the example session shows the progressive text interaction. Generating items and checking answers require a configured key. Upload supports UTF-8 `.txt` and `.md` files (up to 1 MiB); PDF and image extraction are future milestones.

## Test

```sh
npm test
```

This is an MVP, not a hosted production service: before opening a public endpoint, add rate limiting, abuse controls, a privacy notice, and an operational budget.
