# Solu Flow — Overview Summary

**Purpose:**  
A mobile-first web app designed for worship teams to stay united during worship nights and house-of-prayer sets. It keeps musicians, singers, and leaders aligned with access to songs, chords, lyrics, personal notes, and real-time coordination.

---

## Core Features

- **Service Planning:** Build structured set lists with songs, prayers, and readings.  
- **Song Library:** Store songs with chords, lyrics, BPM, key, and time signature (ChordPro format).  
- **Transposition:** Instantly transpose songs or use Nashville Numbers.  
- **Lyrics-Only Mode:** Quick toggle for singers who don’t need chords.  
- **Personal Notes (Per Song):** Notes can be toggled directly within the current song view — musicians can show or hide their private notes instantly without leaving the flow.  
- **Ad-hoc Mode:** View and transpose songs on the fly; create local set lists.  
- **Shareable Set Lists:** Generate a public link so guests can follow the service.  
- **Leader Mode:** The leader controls what’s displayed for others; if the leader transposes a song, everyone following updates automatically.  
- **Free Mode:** Team members can opt out of leader sync to explore or prepare independently, then rejoin with one tap.  
- **Real-Time Sync:** Socket.IO keeps all connected devices synchronized.  
- **Offline Access:** Cached content allows viewing sets and songs offline.  
- **Uploads:** Support for PDFs and images (under 2MB) as attachments.

---

## User Roles

- **Admin:** Full control of workspace and permissions.  
- **Planner:** Creates services, manages songs, assigns leaders.  
- **Leader:** Controls flow, transposition, and navigation during the service.  
- **Member:** Views and transposes songs, adds per-song notes.  
- **Guest:** Views songs and transposes them ad-hoc, but cannot save notes or upload content.

---

## Mobile UI & Navigation

- **Bottom Navigation:** Main tabs for *Home*, *Service*, and *Library*.  
- **Now Bar:** Displays the current item and follow status (Following Leader / Free).  
- **Setlist Pills:** Horizontal scrollable buttons to navigate between segments when not following the leader.  
- **Notes Toggle Button:** Appears in each song view, allowing quick note visibility without leaving the page.  
- **Prev / Next Buttons:** Easy song-to-song movement when in Free mode.  
- **Layout:** Clean vertical scroll design with large tap zones for mobile usability.  

---

## Collaboration & Communication

- **Leader-Follower Sync:** All connected users stay in sync with the leader’s progression and transpositions.  
- **Free Mode Flexibility:** Users can temporarily step out of leader control and navigate independently.  
- **Team Chat (Future):** Planned addition for quick team communication.  
- **Stage Display (Future):** Minimal lyrics-only projection for singers or stage monitors.

---

## Development Phases

1. **Planning & Architecture:** Define data models, wireframes, and core flows.  
2. **UI Mockups & Feedback:** Build early mockups (like Option B – Bottom Nav) for user input.  
3. **Backend Foundation:** Develop authentication, song storage, and API structure.  
4. **Core Functionality:** Implement services, transposition, leader sync, and notes.  
5. **Real-Time Sync & Follow Logic:** Ensure accurate multi-user updates via Socket.IO.  
6. **UI Polish & Mobile Optimization:** Finalize mobile UX, performance, and offline caching.  
7. **Launch & Feedback:** Deploy beta, collect feedback, refine features.

---

## Design Principles

- **Focus:** Minimal distractions — all song actions (transpose, notes, lyrics-only) within reach.  
- **Clarity:** High-contrast typography and intuitive icons for stage environments.  
- **Consistency:** Unified look across leader, musician, and guest views.  
- **Responsiveness:** Built mobile-first, fully scalable to tablets or desktops.  

---

**Solu Flow** unites worship teams by keeping everyone visually and musically synchronized, with simple mobile controls for lyrics, chords, notes, and flow — all designed for real-world worship dynamics.