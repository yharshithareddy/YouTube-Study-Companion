# YouTube Study Companion ( In Progress)

A **session-based study platform** that transforms YouTube from a passive video player into a **focused, structured learning environment**.

---

## Project Overview

Learning from YouTube is powerful but inefficient. Most learners struggle with:

* Distractions from other tabs and notifications
* Manually copying transcripts
* Notes disconnected from video context
* No clear tracking of study time or consistency
* Needing multiple apps (timer, notes, blockers) for one study session

**YouTube Study Companion** solves these problems by providing a **single, unified study workflow** centered around a **study session**.

---

## Core Idea

> **Everything revolves around a study session.**

A study session:

* Starts from a YouTube video
* Locks distractions
* Tracks focused study time
* Anchors notes, transcripts, and whiteboard sketches
* Ends with persisted history and progress

This removes friction and enforces structure without requiring discipline from the user.

---

## Target Users

* College and university students
* Self-learners using YouTube courses
* Exam preparation students
* Anyone studying from long-form video content

---

## System Architecture

The project is implemented as a **3-layer full-stack system**:

1. **Chrome Extension (Manifest V3)**

   * Detects YouTube videos
   * Starts study sessions
   * Blocks distracting websites during focus

2. **React Frontend**

   * Distraction-free study interface
   * Pomodoro timer and visual progress
   * Notes, transcripts, whiteboard, and history

3. **Node.js Backend + PostgreSQL**

   * Session persistence
   * Notes, transcripts, folders, and analytics
   * Authentication and user settings

---

## Key Features

### Session-Based Study Workflow

* Explicit session lifecycle: **start → pause → resume → end**
* Session persistence ensures consistent tracking
* Resume study from the last timestamp

---

### Focus Lock

* Blocks navigation to all user-configured distracting websites during active sessions
* Automatically unlocks during breaks or after session end
* Enforced by Chrome extension background logic

---

### Contextual Learning Tools

* **Timestamped notes** linked directly to video moments
* **Sticky notes** for quick thoughts
* **Session-linked whiteboard** for sketches and explanations
* All artifacts are scoped to a single study session

---

### Automatic Transcript Extraction

* Extracts YouTube captions automatically
* Converts raw captions into **timestamped (MM:SS) transcript segments**
* Enables context-aware study and note-taking
* Designed to work with YouTube’s single-page navigation

---

### Pomodoro-Driven Study Mode

* Focus and break intervals
* Start, pause, and resume support
* **Real-time visual progress indicator** updates during focus periods

---

### Health & Wellness Reminders

* Screen-break pop-ups at fixed intervals
* Water-break reminders during long sessions
* Triggers only during active study time

---

## Study Tracking & History

* Tracks:

  * Study duration
  * Pause count
  * Resume timestamps
  * Pomodoro progress
* Persists session history for review and consistency tracking

---

## Technology Stack

### Browser Extension

* Chrome Extension (Manifest V3)
* JavaScript, HTML, CSS

### Frontend

* React (Vite)
* Tailwind CSS
* Context API

### Backend

* Node.js + Express
* PostgreSQL
* Prisma ORM
* JWT Authentication

---

## Design Principles

* **Deterministic behavior** over probabilistic outcomes
* **Automation over discipline**
* **Single workflow instead of multiple tools**
* **Session-scoped data ownership**
* **Minimal user configuration**

---

## Why This Project Matters

This project is not about adding features — it is about **reducing cognitive overhead**.

By:

* eliminating manual steps
* enforcing focus
* unifying tools
* and anchoring learning to context

**YouTube Study Companion** makes focused learning the default behavior.

---

## License

This project is proprietary and source-available for viewing purposes only.
Reuse, modification, or redistribution without permission is prohibited.

---

