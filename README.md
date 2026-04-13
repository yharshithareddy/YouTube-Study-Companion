# Study Companion

Study Companion is a full-stack system that transforms YouTube into a structured, distraction-controlled learning environment.

It combines:

- a Chrome extension for session launch and browser-level blocking
- a React workspace for focus sessions, notes, reminders, and review
- an Express + Prisma backend for persistence and recommendation logic

Instead of keeping learners inside YouTube's default browsing flow, the product moves them into a dedicated study workspace built for focus and guided content discovery.

## Screenshots

### Extension On YouTube

![Study Companion extension](docs/Extension.png)

### Workspace Home

![Study Companion workspace](docs/Workspace.png)

### Blocked-Page Redirect

![Study Companion blocked page](docs/Blocked.png)

## Highlights

- Start study sessions directly from YouTube watch pages
- Run persistent Pomodoro focus sessions with recovery after refresh
- Block distracting sites and optionally restrict YouTube to watch pages during focus mode
- Take timestamped notes tied to a study session
- Manage reminders and lightweight task tracking inside the workspace
- Generate ranked learning-video recommendations from natural-language requests

## Recommendation System

The recommendation pipeline is the most technical part of the project.

It takes a user request such as `learn python basics` or `react project tutorial` and processes it through:

1. user-intent and topic understanding
2. multi-query expansion
3. YouTube candidate retrieval
4. cross-query deduplication
5. early relevance filtering
6. transcript/metadata-based video analysis
7. multi-factor scoring and final ranking

Key design choices:

- structured request understanding instead of raw keyword matching
- rule-based filtering to remove weak or non-learning candidates early
- cached video analysis to avoid repeated processing
- weighted ranking using concept fit, difficulty, teaching quality, and semantic similarity

Measured sample behavior:

- reduced duplicate candidates by ~68% through cross-query deduplication
- removed ~74% of remaining candidates through early filtering before ranking
- achieved ~96% cache reuse across repeated requests

## Architecture

```text
study-companion/
|-- backend/      # Express API, Prisma schema, recommendation pipeline
|-- frontend/     # React workspace and focus mode UI
|-- extension/    # Chrome extension for YouTube integration and blocking
`-- data/         # Discover evaluation data and sample corpora
```

Main flow:

1. The extension detects a YouTube watch page.
2. It creates a session through the backend.
3. It opens the React workspace with the session id.
4. The workspace runs focus mode, notes, reminders, and review.
5. During focus mode, the frontend sends state updates back to the extension.
6. The extension refreshes browser blocking rules in real time.

## Tech Stack

- Frontend: React, Vite, Framer Motion
- Backend: Node.js, Express
- Database: PostgreSQL, Prisma
- Browser Extension: Chrome Extension Manifest V3
- Recommendation Layer: YouTube Data API, transcript fetching, heuristic ranking, optional LLM-assisted analysis

## Local Setup

### Backend

Create `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/study_companion"
PORT=3000
YOUTUBE_API_KEY=your_youtube_api_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

Run:

```bash
cd backend
npm install
npx prisma migrate dev
node src/index.js
```

Backend default:

```text
http://localhost:3000
```

### Frontend

Run:

```bash
cd frontend
npm install
npm run dev
```

Frontend default:

```text
http://localhost:5173
```

### Chrome Extension

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `extension` folder

## How To Use

### Start A Study Session

1. Start backend and frontend
2. Load the extension in Chrome
3. Open a YouTube watch page
4. Open the Study Companion extension popup
5. Start a session
6. Use the workspace for focus mode, notes, reminders, and review

### Use The Recommendation Panel

1. Open the workspace
2. Open `Discover`
3. Enter a learning request
4. Optionally refine by level, goal, style, or duration
5. Review ranked results and open the selected video

## Evaluation Data

The repository includes `data/discover/` and backend scripts for:

- offline scenario evaluation
- corpus-based validation
- live validation request lists

This makes it easier to iterate on recommendation logic without relying only on ad hoc manual testing.

## Current Limitations

- Recommendation quality depends on YouTube metadata and transcript availability
- YouTube API quota can limit repeated live testing
- Some policy and ranking heuristics are still hand-tuned
- The app is set up for local development and is not yet packaged for production deployment

## More Context

- The recommendation pipeline lives primarily in `backend/src/routes/recommendations.js` and the `backend/src/services/recommendations/` directory

## License

All rights reserved. This project is not licensed for use, copying, modification, or redistribution without prior written permission from the author.
