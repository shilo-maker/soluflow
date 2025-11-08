# Leader/Follower Sync Test Plan

## Test Setup
1. Open two browsers/devices
2. Leader: User A (service leader)
3. Follower: User B (in follow mode)
4. Create a service with 3+ songs with different preset transpositions

## Critical Fixes Applied
1. ✅ Fixed event name mismatch: `leader-change-font` → `leader-font-size`
2. ✅ Removed duplicate transposition emission from initialization
3. ✅ Added `leaderCommandReceivedRef` to prevent race conditions
4. ✅ Increased delay to 300ms for transposition after navigation
5. ✅ Added socket connection checks before emitting

## Test Scenarios

### Test 1: Navigation from /service page
**Steps:**
1. Leader and follower both on `/service` page
2. Leader clicks on different songs in the setlist
3. Leader navigates between songs using arrow keys

**Expected:**
- ✅ Follower navigates to same song
- ✅ Follower sees correct preset transposition
- ✅ Navigation is smooth, no lag

---

### Test 2: Navigation from /song/:id full-page view
**Steps:**
1. Leader and follower both viewing song in full-page mode
2. Leader uses arrow buttons to navigate next/previous
3. Songs have different preset transpositions (Song 1: +2, Song 2: 0, Song 3: -3)

**Expected:**
- ✅ Follower navigates to same song
- ✅ Follower sees correct preset transposition immediately
- ✅ No flicker between original key and transposed key

---

### Test 3: Transposition changes
**Steps:**
1. Leader transposes up (+1)
2. Leader transposes down (-1)
3. Leader uses key selector modal to jump to different key
4. Leader resets transposition

**Expected:**
- ✅ All transposition changes sync to follower
- ✅ Follower sees changes within 100ms

---

### Test 4: Font size changes
**Steps:**
1. Leader zooms in (increases font)
2. Leader zooms out (decreases font)

**Expected:**
- ✅ Follower font size changes match leader
- ✅ Changes are smooth

---

### Test 5: Mixed navigation and transposition
**Steps:**
1. Leader navigates to Song 1 (preset: +2)
2. Leader transposes to +4
3. Leader navigates to Song 2 (preset: 0)
4. Follower should see preset (0), not leader's previous (+4)

**Expected:**
- ✅ Each song shows its OWN preset transposition
- ✅ Previous song's manual transposition doesn't carry over

---

### Test 6: Reconnection scenarios
**Steps:**
1. Follower disconnects (close browser tab)
2. Leader navigates and transposes
3. Follower reconnects

**Expected:**
- ✅ Follower receives current state via `sync-state` event
- ✅ Follower shows correct song and transposition

---

### Test 7: Free mode toggle
**Steps:**
1. Follower toggles to "Free" mode
2. Leader navigates/transposes
3. Follower should NOT follow
4. Follower toggles back to "Follow" mode
5. Follower should resume following

**Expected:**
- ✅ Free mode prevents following
- ✅ Follow mode resumes sync

---

## Console Logging

### Leader should log:
```
[SongView] Leader navigating to next song, emitting navigation
[SongView] Leader will emit transposition for next song: 2
[SongView] Leader emitting transposition NOW: 2
```

### Follower should log:
```
[SongView] Follower received leader-navigated: 123 1
[SongView] Skipping initialization - waiting for leader command
[SongView] Follower received leader-transposed: 2
```

## Known Issues to Watch For
1. ❌ Race condition: Transposition emission before follower loads song
2. ❌ Double transposition: Both initialization and leader command setting transposition
3. ❌ Event name mismatch: Wrong socket event names
4. ❌ Socket not connected when emitting

## Success Criteria
✅ All 7 test scenarios pass
✅ No console errors
✅ Follower experience is smooth and instant
✅ No key flicker or wrong keys displayed
