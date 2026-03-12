# Obsidia Study v2.0

> AI made by a student, for students — now with gamification, mobile support, and a polished dashboard.

## What's New in v2.0

### Navigation & UX
- **Mobile hamburger drawer** — full slide-out navigation for phones/tablets with profile, streak, and all tools
- **Quick Snap button** — camera icon in the nav bar lets you snap a photo of homework instantly (uses device camera on mobile)
- **Keyboard shortcuts** — press `?` to see all shortcuts. `G+H` for home, `G+M` for math, `/` to focus chat, `Q` for quick snap
- **Staggered entrance animations** — cards and stats fade in sequentially for a polished feel

### Dashboard & Gamification
- **Stats bar** — animated counters showing total sessions, day streak, XP, and weekly goal progress
- **XP progress bar** — shows your current level (LVL 12 Scholar) with a fill bar toward the next level
- **Progress ring** — SVG ring animation showing weekly goal completion percentage
- **Streak flame** — animated flame icon with subtle scaling dance animation
- **Activity feed panel** — new left column showing your recent study sessions with XP earned

### Settings & Profile Page
- **Full settings page** (navigate via gear icon or `G+,`) with four cards:
  - **Profile** — name, email, grade level
  - **Study Goals** — daily sessions, weekly XP target, focus subjects, test prep mode
  - **Preferences** — AI response style, auto-humanizer, sound effects, streak reminders
  - **Achievements** — earned badges, locked badges, progress percentages

### Chat Enhancements
- **Word-by-word typing animation** — AI responses appear word by word instead of all at once
- **Three-column dashboard** — activity feed + upload zone + chat side by side

### Architecture Improvements
- All pages now registered in the router (including settings)
- Cleaner responsive breakpoints for 4 screen sizes
- Footer with keyboard shortcut hint
- Mobile-specific: nav buttons hidden, hamburger shown, single-column layouts

## File Structure

```
obsidia-v2/
├── index.html          # Single-file SPA (HTML + CSS + JS)
├── Images/
│   └── Quick Snap Navigation Button.jpg
└── README.md
```

## Getting Started

1. Open `index.html` in any modern browser
2. No build step, no dependencies, no server required
3. Works offline — all fonts loaded from Google Fonts CDN

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

## Design System

- **Fonts**: Cinzel (display), Inter (UI)
- **Colors**: Dark obsidian (#080808) with gold (#c9a84c) accents
- **Subject colors**: Math (blue), Essay (purple), Study (green), Notes (amber)
- **Radius tokens**: 8px (sm), 14px (md), 20px (lg), 28px (xl)

## Browser Support

Tested on Chrome, Firefox, Safari, Edge (latest versions). Mobile-optimized for iOS Safari and Android Chrome.
