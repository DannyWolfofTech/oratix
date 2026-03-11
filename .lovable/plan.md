

## Bug Analysis: Videos Not Saving

I found **two critical bugs** causing users to lose their recordings:

### Bug 1: Escape key closes teleprompter during recording review
In `TeleprompterView.tsx` line 106, pressing **Escape** calls `onClose()` which **unmounts the entire component**, including the `ReviewRecordingModal`. The modal is rendered *inside* the teleprompter view, so closing the teleprompter destroys the review modal and the blob reference. The X button (line 314-318) does the same thing with no guard.

### Bug 2: `handleSave` doesn't close the modal on anchor download
In `ReviewRecordingModal.tsx`, the Share API path calls `onClose()` after saving, but the **anchor download fallback** (desktop/Android) never calls `onClose()`. More critically, it calls `clearBlob()` which **deletes the IndexedDB backup** immediately after triggering the download. If the download fails silently (common on mobile in-app browsers), the recording is gone from both memory and IndexedDB.

### Bug 3: `closeCamera` kills the stream before `onstop` fires
In `closeCamera` (line 185-194), if the user closes the camera while recording, `mediaRecorderRef.current.stop()` is called, then the camera tracks are **immediately stopped**. The `onstop` handler fires asynchronously and may fail to produce a valid blob because the underlying stream is already dead.

---

## Plan

### 1. Guard `onClose` during recording review
- Prevent Escape key and X button from closing the teleprompter while `reviewBlob` is set
- Show a confirmation or simply ignore close attempts during review

### 2. Fix `closeCamera` race condition
- In `closeCamera`, only stop the camera tracks **after** the `onstop` event fires (use a Promise or flag)
- If recording is active, call `stopRecording()` first and let the `onstop` handler complete before killing tracks

### 3. Fix `handleSave` in ReviewRecordingModal
- Don't call `clearBlob()` immediately on anchor download — delay it or only clear after user explicitly dismisses the modal
- Add `onClose()` call after anchor download so the modal dismisses properly
- Keep IndexedDB blob as backup until the modal is explicitly discarded

### 4. Add safety net: persist blob before showing modal
- In `recorder.onstop`, store the blob to IndexedDB **before** setting `reviewBlob` state, so even if the component unmounts unexpectedly, the recording survives
- On teleprompter mount, check IndexedDB for an orphaned recording and re-show the review modal

### Files to modify
- `src/components/TeleprompterView.tsx` — guard close, fix closeCamera race, persist blob in onstop
- `src/components/ReviewRecordingModal.tsx` — fix save flow, delay clearBlob

