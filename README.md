# Obsidia Study v2.1

> AI made by a student, for students — now with real AI, streaming responses, and Vercel deployment.

## Quick Start

### 1. Get your API key (free to start)

Go to [console.anthropic.com](https://console.anthropic.com/) and create an account. You'll get free credits — enough for hundreds of student conversations.

Copy your API key (starts with `sk-ant-...`).

### 2. Deploy to Vercel (free)

Or manually:

```bash
npm install -g vercel
git clone https://github.com/carsyndeangelis/obsidia-study.git
cd obsidia-study
npm install
vercel
```

### 3. Add your API key

In the Vercel dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. Add: `ANTHROPIC_API_KEY` = `sk-ant-your-key-here`
3. Redeploy (Deployments → three dots → Redeploy)

### 4. Local development

```bash
cp .env.example .env.local
# Edit .env.local with your API key
npm install
npx vercel dev
# Opens at http://localhost:3000
```

## Architecture

```
obsidia-study/
├── public/
│   ├── index.html          # Frontend SPA
│   └── Images/             # Static assets
├── api/
│   ├── chat.js             # Serverless AI proxy
│   └── prompts.js          # Per-tool system prompts
├── vercel.json             # Routing config
├── package.json            # Anthropic SDK
├── .env.example            # API key template
└── .gitignore
```

The frontend sends messages to `/api/chat`. The serverless function adds the right system prompt per tool, calls Claude with streaming, and pipes the response back. The API key never touches the browser.

## Per-Tool AI Specializations

| Tool | Behavior |
|------|----------|
| Math AI | Step-by-step solver. Modes: solve, explain, graph, practice |
| Essay Writer | Writing coach with humanizer and grade calibration |
| Study Guide | Flashcards, Cornell notes, mind maps, outlines, quizzes |
| Lecture Notes | Transcription, summarization, key points, questions |
| Double Check | Fact verification, source finding, bias analysis |
| Grading | Multi-scale evaluation with rubric support |
| ACT/SAT Prep | Section-specific practice with strategy coaching |
| Teacher Tools | Lesson plans, rubrics, quizzes, parent comms |

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

## Cost Estimate

Claude Sonnet costs ~$3/M input tokens and ~$15/M output tokens. A typical 10-message session costs $0.01-0.03.

## Roadmap

- **v2.2** — User auth, persistent streak & XP
- **v2.3** — Theme toggle, onboarding, achievements page
- **v2.4** — PWA support, push notifications
