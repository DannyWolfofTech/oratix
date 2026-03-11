

## Problem: All Videos Show 3-Second Duration

This is a **known browser bug** with `MediaRecorder` + WebM format. When the browser writes a WebM file, it must write the duration in the file header *before* recording finishes. Since it doesn't know the final duration upfront, it writes a placeholder value (~3 seconds, matching your countdown + first timeslice). The full video data is there — players just read the wrong duration from the header.

MP4 doesn't have this issue, but most browsers (Chrome, Firefox) only support WebM for `MediaRecorder`.

## Fix

Install the [`fix-webm-duration`](https://www.npmjs.com/package/fix-webm-duration) library, which patches the WebM metadata with the correct duration after recording stops.

### Changes

**1. Add dependency:** `fix-webm-duration`

**2. `src/components/TeleprompterView.tsx`**
- Track recording start time with a ref (`recordingStartRef = Date.now()`)
- In `recorder.onstop`, after creating the blob, if the mime type is WebM, run it through `fixWebmDuration(blob, durationMs)` to produce a corrected blob
- Use the fixed blob for IndexedDB persistence and the review modal

### Key code change (in `recorder.onstop`):

```typescript
import fixWebmDuration from "fix-webm-duration";

// When starting:
recordingStartRef.current = Date.now();

// In onstop:
const rawBlob = new Blob(chunks, { type: mimeType });
const duration = Date.now() - recordingStartRef.current;

if (mimeType.includes("webm")) {
  fixWebmDuration(rawBlob, duration, (fixedBlob) => {
    // use fixedBlob for IndexedDB + review modal
  });
} else {
  // use rawBlob directly (MP4 doesn't need fixing)
}
```

No changes needed to `ReviewRecordingModal.tsx`.

