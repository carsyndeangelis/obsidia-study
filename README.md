# Obsidia Study v2.1

> AI made by a student, for students — now with real AI integration, streaming responses, and Vercel deployment.

## Quick Start (Deploy in 5 minutes)

### 1. Get an API Key
- Go to [console.anthropic.com](https://console.anthropic.com/)
- Create an account and add a payment method (Claude API has pay-as-you-go pricing)
- Go to **API Keys** → **Create Key** → copy it

### 2. Deploy to Vercel
- Push this repo to your GitHub
- Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
- In **Environment Variables**, add:
  - `ANTHROPIC_API_KEY` = your key from step 1
- Hit **Deploy**

### 3. You're live
Your site will be at `your-project.vercel.app`. Every chat tool now uses real Claude AI.

### Local Development
```bash
npm install
# Copy .env.example to .env and add your key
cp .env.example .env
# Edit .env with your actual API key
npx vercel dev
```

---

## Architecture

```
obsidia-study/
├── api/
│   ├── chat.js          # Serverless API endpoint (streams Claude responses)
│   └── prompts.js       # Per-tool system prompts with template variables
├── public/
│   ├── index.html       # Frontend SPA (all UI + streaming client)
│   └── Images/
├── .env.example         # Environment variable template
├── .gitignore
├── package.json         # Anthropic SDK dependency
├── vercel.json          # Routing: /api/* → serverless, /* → static
└── README.md
```

### How it works

1. Student types a message on any page (Math AI, Essay Writer, etc.)
2. Frontend sends POST to `/api/chat` with the message, page name, mode settings, and conversation history
3. Serverless function builds a specialized system prompt for that tool using template variables
4. Streams the response back via Server-Sent Events (SSE)
5. Frontend renders tokens as they arrive with lightweight markdown formatting
6. If the API is unavailable, falls back to demo mode automatically

### Security
- API key is **never** in the frontend code — it lives in Vercel environment variables
- Rate limited: 15 requests/minute per IP
- Messages capped at 4,000 characters
- Conversation history limited to last 10 messages

---

## What's New

### v2.1 — Real AI Integration
- **Streaming responses** — words appear in real-time via SSE, not all at once
- **Specialized system prompts** — each tool (Math, Essay, Study Guide, etc.) has a tuned prompt with mode-specific behavior
- **Conversation history** — the AI remembers context within a session (last 10 messages)
- **Markdown rendering** — AI responses display with bold, italic, code blocks, headers, and lists
- **Demo mode fallback** — if the API key isn't set, the app still works with placeholder responses
- **Rate limiting** — built-in protection against abuse (15 req/min per IP)
- **Vercel-ready architecture** — serverless functions + static frontend, zero-config deploy

### v2.0 — UX & Gamification
- Mobile hamburger drawer with profile and streak display
- Quick Snap camera button in nav bar
- Keyboard shortcuts overlay (press ?)
- Stats bar with animated counters (sessions, streak, XP, weekly goal)
- XP progress bar with level system
- SVG progress ring for weekly goal completion
- Activity feed panel showing recent study sessions
- Full Settings & Profile page
- Staggered entrance animations
- Achievements system

### v1.0 — Foundation
- 10-page SPA with page routing and transitions
- Feature cards with subject-specific color coding
- Drag-and-drop file upload with paste support
- Chat interface with typing indicators
- Per-tool toolbar modes

---

## System Prompts

Each tool gets a specialized prompt. Variables like `{{mode}}`, `{{grade}}`, `{{method}}` are filled in from the UI state:

| Tool | Key Variables | Behavior |
|------|--------------|----------|
| Math AI | `mode` (solve/explain/graph/practice) | Step-by-step solutions, verification |
| Essay Writer | `mode`, `humanizer`, `grade` | Tone calibration, grade-level writing |
| Study Guide | `method` (flashcards/cornell/mindmap/etc.) | Format-specific output |
| Lecture Notes | `mode` (transcribe/summarize/keypoints/questions) | Structured note generation |
| Double Check | `mode` (verify/sources/compare/bias) | Fact-checking with reasoning |
| Grading | `mode`, `scale` | Rubric-based evaluation |
| ACT/SAT Prep | `section` (act-math/sat-rw/strategy/etc.) | Test-format practice problems |
| Teacher Tools | `tool` (lesson/rubric/quizgen/etc.) | Standards-aligned materials |

---

## Cost Estimate

Claude Sonnet pricing (as of 2025):
- ~$3 per 1M input tokens, ~$15 per 1M output tokens
- Average student message: ~100 tokens in, ~500 tokens out
- **~$0.008 per message** (~1.2 cents per message)
- 100 students × 20 messages/day = **~$1.60/day**

Set a monthly budget alert in the Anthropic console to avoid surprises.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Home | `G` then `H` |
| Math AI | `G` then `M` |
| Essay Writer | `G` then `E` |
| Study Guide | `G` then `S` |
| Settings | `G` then `,` |
| Focus Chat | `/` |
| Quick Snap | `Q` |
| Show Shortcuts | `?` |

---

## Next Up (v2.2 Roadmap)

- **Persistence & Auth** — Supabase for user accounts, saved conversations, real streak/XP tracking
- **Dark/Light Theme Toggle**
- **Onboarding Flow** — first-time walkthrough
- **PWA Support** — installable app with offline mode

---

## Browser Support

Chrome, Firefox, Safari, Edge (latest). Mobile-optimized for iOS Safari and Android Chrome.
