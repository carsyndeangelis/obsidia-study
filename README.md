# Obsidia Study v2.4

> AI-powered academic tools built by a student, for students. Real AI chat, gamification, mobile-ready.

**Live:** [obsidia-study.vercel.app](https://obsidia-study.vercel.app)

## Features

### AI Tools (10 specialized pages)
| Tool | What it does |
|------|-------------|
| **Advanced Math** | Step-by-step solver with 4 modes: solve, explain, graph, practice |
| **Essay Writer** | Drafting with humanizer toggle, grade calibration, 4 modes |
| **Study Guide** | 6 methods: flashcards, Cornell notes, mind map, spaced review, outline, quiz |
| **Lecture Notes** | Transcription, summarization, key points, question generation |
| **Double Check** | Fact verification, source finding, answer comparison, bias analysis |
| **Grading** | Multi-scale evaluation (A-F, GPA, Pass/Fail, rubric) with feedback |
| **ACT/SAT Prep** | 6 sections: ACT Math/English/Science, SAT Math/R&W, Strategy |
| **Teacher Tools** | Lesson plans, rubrics, quiz gen, feedback, differentiation, parent email |

### Every tool page includes
- Suggestion chips (3 contextual quick-start prompts)
- File attachment button (paperclip icon for image/PDF uploads)
- Mode toolbar (switches AI behavior per sub-task)
- Streaming AI responses with markdown rendering
- Conversation history (last 10 messages for context)

### Dashboard & Gamification
- Animated stats bar: sessions, streak, XP, weekly goal ring
- XP progress bar with level system (500 XP per level)
- Activity feed showing recent sessions with XP earned
- 12 unlockable achievements with progress tracking

### Full Pages
- **Home** — hero, stats, XP bar, feature grid, 3-column dashboard (activity + upload + chat)
- **Settings** — profile, study goals, preferences, achievements preview
- **Achievements** — full grid of 12 badges with earned/locked/progress states
- **History** — searchable conversation log with filters
- **Feedback** — structured form with categories, star rating, and text

### Auth & Persistence
- Google sign-in via Supabase OAuth
- Postgres database: profiles, sessions, achievements
- Real streak tracking (consecutive day detection)
- Row-level security (users only see own data)

### UI & Navigation
- Dark/light theme toggle (system preference detection)
- Mobile hamburger drawer with profile and streak
- Keyboard shortcuts (press `?` to view all)
- Quick Snap camera button for instant homework photos
- Staggered entrance animations
- 3-step onboarding flow for new users

### PWA
- Installable on phone home screen
- Service worker for offline caching
- Auto-update prompt on new versions

## Quick Start

### 1. Deploy to Vercel
```bash
git clone https://github.com/carsyndeangelis/obsidia-study.git
cd obsidia-study && npm install
vercel
```

### 2. Add API key
In Vercel dashboard → Settings → Environment Variables:
- `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)

### 3. (Optional) Enable auth
Create a free [Supabase](https://supabase.com) project, run `supabase-schema.sql` in the SQL editor, enable Google OAuth, and add your Supabase URL + anon key to the code.

### 4. Local dev
```bash
cp .env.example .env.local   # add your API key
npx vercel dev               # http://localhost:3000
```

## Architecture

```
obsidia-study/
├── public/
│   ├── index.html            # Frontend SPA (all pages)
│   ├── sw.js                 # Service worker
│   ├── manifest.json         # PWA manifest
│   └── icons/                # App icons
├── api/
│   ├── chat.js               # Serverless AI proxy (streaming)
│   └── prompts.js            # 12 system prompts
├── vercel.json               # Routing
├── package.json              # Anthropic SDK
├── supabase-schema.sql       # Database schema
└── .env.example              # API key template
```

## Keyboard Shortcuts

| Action | Keys |
|--------|------|
| Home | `G` `H` |
| Math AI | `G` `M` |
| Essay Writer | `G` `E` |
| Study Guide | `G` `S` |
| Settings | `G` `,` |
| Focus chat | `/` |
| Quick Snap | `Q` |
| Show shortcuts | `?` |

## Cost
Claude Sonnet: ~$0.01-0.03 per 10-message session. Free Anthropic credits cover ~200-500 sessions.

## Roadmap
- **v2.5** — Real conversation history persistence, search across sessions
- **v2.6** — Collaborative study rooms, shared flashcards
- **v3.0** — Native mobile apps (React Native)
