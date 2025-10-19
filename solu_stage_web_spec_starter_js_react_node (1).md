# Solu Flow — Overview Summary

**Purpose:**  A mobile-first web app designed for worship teams to stay united during worship nights and house-of-prayer sets. It helps musicians, singers, and leaders follow the same service flow with access to songs, chords, lyrics, notes, and real-time coordination.

---

## Core Features

- **Service Planning:** Create structured set lists with songs, prayers, readings, and notes.
- **Song Library:** Store songs with chords, lyrics, BPM, key, and time signature (ChordPro format).
- **Transposition:** Musicians can instantly transpose songs, use Nashville Numbers, and view capo suggestions.
- **Lyrics-Only Mode:** One-tap switch for singers who don’t need chords, showing only lyrics in large readable format.
- **Personal Notes:** Users can add and save private notes on chordsheets (per service).
- **Ad-hoc Mode:** Any user, including guests, can spontaneously browse and view songs, transpose keys, and build temporary local set lists.
- **Shareable Set Lists:** Generate a public link allowing guests to view and follow the set without an account.
- **Leader Mode:** The leader can control which song or section is displayed for everyone. When the leader transposes a song, it transposes for all users who have **Follow Leader** enabled.
- **Real-Time Sync:** All devices stay synchronized through live socket connections, with automatic resync if a device reconnects.
- **Offline Support:** Cached data allows viewing songs and sets even without internet.
- **Uploads:** Only PDFs and images (below 2MB) are allowed as attachments.

---

## Technology Stack

- **Frontend:** React with Bootstrap (mobile-first, responsive design).
- **Backend:** Node.js (Express) managing APIs, authentication, and real-time connections.
- **Database:** PostgreSQL for users, songs, services, and notes.
- **Realtime:** Socket.IO for synchronization.
- **Storage:** Cloud storage for uploaded PDFs and images.

---

## User Roles

- **Admin:** Manages the workspace and permissions.
- **Planner:** Creates services, manages songs, and assigns leaders.
- **Leader:** Controls the live flow, navigation, and transpositions for all followers.
- **Member (Musician/Singer/Speaker):** Views songs, transposes, adds notes.
- **Guest (Unregistered User):**
  - Can view and transpose songs.
  - Can browse ad-hoc songs and create local (non-shared) set lists.
  - Cannot add songs, create shareable links, or save notes.

---

## Key Functions

### For the Planner
- Build set lists using songs, prayers, or readings.
- Assign leaders and share links for guests.
- Add PDF or image attachments below 2MB.

### For the Musician or Singer
- Access the service view on mobile.
- View chords and lyrics clearly with smooth scrolling.
- Transpose songs, switch between lyrics/chords view, and add personal notes (per service).
- Use lyrics-only mode for performance simplicity.

### For the Leader
- Advance segments and songs for all participants.
- Transpose songs for everyone following in real time.
- Lock or unlock the ability for others to navigate independently.
- Add spontaneous songs to the service during live sessions.

### For Guests
- Join via public link to follow or view the set.
- Browse songs ad-hoc and create local personal set lists.
- Transpose and view lyrics or chords but cannot save notes or upload files.

---

## Mobile UI Design Focus

- **Primary Platform:** Mobile phones.
- **Layout:** Vertical scroll-first with collapsible sections.
- **Navigation:** Fixed bottom navbar for Home, Service, Library, Notes, Settings.
- **Buttons:** Large icons, tap-friendly, simple navigation.
- **Song View:** Smooth auto-scroll option and one-tap transpose or lyrics-only toggle.
- **Performance:** Lightweight animations and optimized offline caching.
- **Multilingual Support:** Full support for Hebrew and English lyrics (RTL + LTR display).

---

## Collaboration & Communication

- **Team Chat:** Quick per-service comment threads for communication (e.g., “Repeat bridge 2x”).
- **Stage Display Mode:** Clean, lyrics-only projection option for singers or stage monitors.
- **Real-Time Updates:** Socket.IO syncs all user devices when leader moves between sections or changes keys.
- **Private Data:** Notes and user info are protected; guests only access public data.

---

## Security & Access Control

- JWT-based authentication for registered users.
- Guest access through temporary tokens for shared set links.
- Role-based access ensures only authorized users can modify or upload content.
- Automatic reconnection ensures seamless sync restoration.

---

## Visual & Design Concept

- **Mobile-first Layout:** Two-pane stacked design (segments + content view) optimized for phones.
- **Typography:** Large, clean fonts suitable for stage and low light.
- **Color Palette:** Warm neutrals consistent with Solu branding.
- **Interactivity:** Smooth transitions with clear indicators for leader/follower status.

---

## Development Stages

The app will be developed in well-defined, reviewable stages, allowing for feedback and iteration before moving forward.

### **Stage 1 — Planning & Architecture**
- Define user stories, data models, and page hierarchy.
- Sketch initial mobile wireframes.
- Pause for review before coding.

### **Stage 2 — UI Mockups & Interaction Design**
- Build static UI mockups using mock data.
- Simulate navigation between key pages (Home, Service, Library, Song View).
- Collect visual and UX feedback before backend integration.

### **Stage 3 — Backend Foundation**
- Build database schema, authentication, and REST API routes.
- Integrate mock data with UI for initial flow testing.
- Pause for system review and adjustments.

### **Stage 4 — Core Functionality**
- Implement service creation, song library, and user roles.
- Enable transpose logic, notes, and guest access.
- Integrate uploads for PDFs/images.

### **Stage 5 — Real-Time Sync & Leader Mode**
- Add Socket.IO connections for live leader control and follow sync.
- Implement real-time transposition broadcast.
- Test multi-user sessions with mock data.

### **Stage 6 — Collaboration Features & Mobile Optimization**
- Add team chat, stage display mode, and reconnection logic.
- Refine mobile performance, layout, and accessibility.
- Review full flow on multiple devices.

### **Stage 7 — Launch & Feedback Cycle**
- Deploy beta version for real testing.
- Gather team and user feedback.
- Prioritize feature improvements and bug fixes for next release.

---

## Future Enhancements

- Export or print set lists as PDF.
- Integration with ProPresenter and Planning Center.
- Shared notes visibility per role.
- MIDI/tempo synchronization.

---

**Solu Flow** connects every member of the worship team — musicians, singers, leaders, and guests — into one mobile, real-time platform. It keeps every worship night organized, flexible, and united in the same flow.

