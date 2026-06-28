/**
 * MediaPipe Face Coach — Client-side interview presence analysis.
 *
 * Uses FaceLandmarker only (no Pose Landmarker) to keep model download small (~4MB).
 * Runs at ~3 fps via setInterval (not requestAnimationFrame) to protect CPU/battery.
 *
 * Produces per-answer aggregate scores:
 *   - interviewPresence: % of frames with face detected and roughly centered
 *   - eyeContact: % of frames with head facing camera (yaw/pitch within threshold)
 *   - bodyLanguage: 100 minus fidgeting and slouch penalties (face-landmark stability proxy)
 *
 * No video or image data leaves this module — only numeric scores.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── Configuration ───────────────────────────────────────────────────────────

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Scoring thresholds
/** ±30% of frame center in normalized coordinates */
const CENTER_TOLERANCE = 0.3;
/** Head yaw threshold (degrees) for "looking at camera" scoring */
const EYE_CONTACT_YAW = 15;
/** Head pitch threshold (degrees) for "looking at camera" scoring */
const EYE_CONTACT_PITCH = 10;
/** Minimum frames with face detected to produce a score (else return null) */
const MIN_USABLE_FRAMES = 5;

// Body language — fidget & slouch thresholds
/** Normalized displacement per frame above which full fidget penalty applies */
const FIDGET_HIGH_THRESHOLD = 0.025;
/** Below this displacement, no fidget penalty */
const FIDGET_LOW_THRESHOLD = 0.005;
/** Normalized vertical drift from baseline at which full slouch penalty applies */
const SLOUCH_THRESHOLD = 0.10;
/** Maximum deduction for fidgeting (out of 100) */
const FIDGET_MAX_PENALTY = 40;
/** Maximum deduction for slouching (out of 100) */
const SLOUCH_MAX_PENALTY = 40;

// Coaching tip thresholds (intentionally wider than scoring thresholds)
/** Consecutive frames without face before the "move into view" tip fires */
const TIP_NO_FACE_FRAMES = 3;
/** Yaw threshold for the "face the camera" coaching tip (degrees) */
const TIP_YAW_THRESHOLD = 25;
/** Pitch threshold for the "eye contact" coaching tip (degrees, positive = looking down) */
const TIP_PITCH_THRESHOLD = 15;
/** Minimum milliseconds between coaching tip changes (debounce) */
const TIP_DEBOUNCE_MS = 6000;

// ─── Module State ────────────────────────────────────────────────────────────

let faceLandmarker = null;
let isInitialized = false;
let initPromise = null;

// Per-answer aggregation
let totalFrames = 0;
let faceDetectedFrames = 0;
let faceCenteredFrames = 0;
let eyeContactFrames = 0;
let displacements = [];
let nosePositions = [];
let baselineNoseY = null;
let noFaceStreak = 0;

// Coaching tip state
let lastTipText = null;
let lastTipChangeTime = 0;

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Estimate head yaw and pitch from face landmark positions.
 * Uses geometric ratios — no transformation matrix parsing needed.
 *
 * Yaw:   ratio of nose-to-left-cheek vs nose-to-right-cheek distance.
 *         When facing forward, both distances are roughly equal.
 * Pitch:  relative nose-tip position between forehead and chin.
 *         When facing the camera, nose tip sits at ~55% of face height from forehead.
 */
function estimateHeadPose(nose, leftCheek, rightCheek, forehead, chin) {
  // Yaw estimation
  const leftDist = Math.sqrt(
    (nose.x - leftCheek.x) ** 2 + (nose.y - leftCheek.y) ** 2,
  );
  const rightDist = Math.sqrt(
    (nose.x - rightCheek.x) ** 2 + (nose.y - rightCheek.y) ** 2,
  );
  const yawRatio = (rightDist - leftDist) / (rightDist + leftDist + 1e-6);
  const yaw = yawRatio * 90; // approximate degrees

  // Pitch estimation
  const faceHeight = chin.y - forehead.y;
  if (faceHeight < 0.01) return { yaw, pitch: 0 };
  const noseRelative = (nose.y - forehead.y) / faceHeight;
  // 0.55 is the typical nose-to-forehead ratio when looking straight at the camera
  const pitchDeviation = noseRelative - 0.55;
  const pitch = pitchDeviation * 80; // approximate degrees, positive = looking down

  return { yaw, pitch };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Lazy-load FaceLandmarker model. Only call when camera is actually granted.
 * Safe to call multiple times — subsequent calls return the same promise.
 * @returns {Promise<boolean>} true if initialization succeeded
 */
export async function initCoach() {
  if (isInitialized && faceLandmarker) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      isInitialized = true;
      return true;
    } catch (err) {
      console.warn('[MediaPipe Coach] FaceLandmarker init failed:', err);
      isInitialized = false;
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Run one inference frame on the given video element.
 * @returns per-frame signals object, or null if not ready.
 */
export function runInference(videoElement) {
  if (!faceLandmarker || !videoElement || videoElement.readyState < 2) {
    return null;
  }

  try {
    const now = performance.now();
    const results = faceLandmarker.detectForVideo(videoElement, now);

    if (!results?.faceLandmarks?.length) {
      noFaceStreak++;
      return {
        faceDetected: false,
        faceCentered: false,
        headYaw: 0,
        headPitch: 0,
        noseX: 0.5,
        noseY: 0.5,
      };
    }

    noFaceStreak = 0;
    const lm = results.faceLandmarks[0];

    // Key face landmarks used for pose estimation
    const nose = lm[1]; // nose tip
    const leftCheek = lm[234]; // left cheek
    const rightCheek = lm[454]; // right cheek
    const forehead = lm[10]; // forehead center
    const chin = lm[152]; // chin

    // Face centering: nose within ±CENTER_TOLERANCE of frame center
    const faceCentered =
      Math.abs(nose.x - 0.5) <= CENTER_TOLERANCE &&
      Math.abs(nose.y - 0.5) <= CENTER_TOLERANCE;

    // Head pose from landmark geometry
    const { yaw, pitch } = estimateHeadPose(
      nose,
      leftCheek,
      rightCheek,
      forehead,
      chin,
    );

    return {
      faceDetected: true,
      faceCentered,
      headYaw: yaw,
      headPitch: pitch,
      noseX: nose.x,
      noseY: nose.y,
    };
  } catch (err) {
    console.warn('[MediaPipe Coach] Inference error:', err);
    return null;
  }
}

/**
 * Reset per-answer aggregation. Call at recording start.
 */
export function resetAggregator() {
  totalFrames = 0;
  faceDetectedFrames = 0;
  faceCenteredFrames = 0;
  eyeContactFrames = 0;
  displacements = [];
  nosePositions = [];
  baselineNoseY = null;
  noFaceStreak = 0;
  lastTipText = null;
  lastTipChangeTime = 0;
}

/**
 * Accumulate one frame's signals into the per-answer aggregation.
 */
export function addFrame(signals) {
  if (!signals) return;

  totalFrames++;

  if (signals.faceDetected) {
    faceDetectedFrames++;
    if (signals.faceCentered) faceCenteredFrames++;

    // Eye contact: head yaw AND pitch within threshold
    if (
      Math.abs(signals.headYaw) <= EYE_CONTACT_YAW &&
      Math.abs(signals.headPitch) <= EYE_CONTACT_PITCH
    ) {
      eyeContactFrames++;
    }

    // Track nose position for stability / slouch analysis
    nosePositions.push({ x: signals.noseX, y: signals.noseY });
    if (baselineNoseY === null) {
      baselineNoseY = signals.noseY;
    }

    // Frame-to-frame displacement (fidgeting proxy)
    if (nosePositions.length >= 2) {
      const prev = nosePositions[nosePositions.length - 2];
      const curr = nosePositions[nosePositions.length - 1];
      const disp = Math.sqrt(
        (curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2,
      );
      displacements.push(disp);
    }
  }
}

/**
 * Produce the per-answer summary.
 *
 * Returns { interviewPresence, eyeContact, bodyLanguage } (each 0-100),
 * or **null** if insufficient usable data was collected (fewer than
 * MIN_USABLE_FRAMES frames with a detected face). Returning null ensures
 * that sessions where the camera was granted but never got good signal
 * are stored identically to audio-only sessions (all three fields null).
 *
 * Scoring heuristics:
 *   interviewPresence = (centered-face frames / total frames) × 100
 *   eyeContact        = (forward-facing frames / total frames) × 100
 *   bodyLanguage       = 100 − fidgetPenalty − slouchPenalty
 *     fidgetPenalty: linear ramp from avg frame-to-frame nose displacement
 *     slouchPenalty: linear ramp from nose-Y drift vs recording-start baseline
 */
export function getSummary() {
  if (faceDetectedFrames < MIN_USABLE_FRAMES) {
    return null;
  }

  // interviewPresence: % of ALL frames with face detected AND centered
  const interviewPresence = Math.round(
    (faceCenteredFrames / totalFrames) * 100,
  );

  // eyeContact: % of ALL frames with head yaw/pitch within threshold
  const eyeContact = Math.round((eyeContactFrames / totalFrames) * 100);

  // bodyLanguage: 100 minus fidget penalty minus slouch penalty
  let fidgetPenalty = 0;
  if (displacements.length > 0) {
    const avgDisplacement =
      displacements.reduce((a, b) => a + b, 0) / displacements.length;
    if (avgDisplacement > FIDGET_LOW_THRESHOLD) {
      const fidgetRatio = Math.min(
        1,
        (avgDisplacement - FIDGET_LOW_THRESHOLD) /
          (FIDGET_HIGH_THRESHOLD - FIDGET_LOW_THRESHOLD),
      );
      fidgetPenalty = Math.round(fidgetRatio * FIDGET_MAX_PENALTY);
    }
  }

  let slouchPenalty = 0;
  if (baselineNoseY !== null && nosePositions.length > 10) {
    // Compare average nose-Y in the last third of the recording to baseline
    const lastThird = nosePositions.slice(
      Math.floor((nosePositions.length * 2) / 3),
    );
    const avgY = lastThird.reduce((sum, p) => sum + p.y, 0) / lastThird.length;
    const drift = Math.abs(avgY - baselineNoseY);
    if (drift > SLOUCH_THRESHOLD * 0.3) {
      const slouchRatio = Math.min(1, drift / SLOUCH_THRESHOLD);
      slouchPenalty = Math.round(slouchRatio * SLOUCH_MAX_PENALTY);
    }
  }

  const bodyLanguage = Math.max(
    0,
    Math.min(100, 100 - fidgetPenalty - slouchPenalty),
  );

  return {
    interviewPresence: Math.max(0, Math.min(100, interviewPresence)),
    eyeContact: Math.max(0, Math.min(100, eyeContact)),
    bodyLanguage,
  };
}

/**
 * Get coaching tip for the current frame. Returns a tip string, or null.
 * Respects TIP_DEBOUNCE_MS minimum interval between tip changes to prevent
 * flicker — even if the underlying signal changes faster, the displayed
 * tip won't update until the debounce window elapses.
 *
 * Tips (from the fixed set, priority order):
 *   1. No face for ≥3 frames → "Move into the camera's view."
 *   2. |yaw| > 25°           → "Try to face the camera directly."
 *   3. pitch > 15° (down)    → "Maintain eye contact with the camera."
 *
 * NOTE: "Improve your lighting" tip is intentionally omitted. Face landmarks
 * alone don't provide a reliable lighting-quality signal, and naive heuristics
 * (e.g., intermittent detection loss) trigger too many false positives under
 * normal lighting conditions. A future enhancement could sample video frame
 * brightness via an offscreen canvas for a reliable measurement.
 */
export function getCoachingTip(signals) {
  const now = Date.now();

  let tip = null;

  if (!signals || !signals.faceDetected) {
    if (noFaceStreak >= TIP_NO_FACE_FRAMES) {
      tip = 'Move into the camera\u2019s view.';
    }
  } else {
    if (Math.abs(signals.headYaw) > TIP_YAW_THRESHOLD) {
      tip = 'Try to face the camera directly.';
    } else if (signals.headPitch > TIP_PITCH_THRESHOLD) {
      tip = 'Maintain eye contact with the camera.';
    }
  }

  // Debounce: only change the displayed tip if enough time has passed
  if (tip !== lastTipText && now - lastTipChangeTime < TIP_DEBOUNCE_MS) {
    return lastTipText; // keep showing the previous tip
  }

  if (tip !== lastTipText) {
    lastTipText = tip;
    lastTipChangeTime = now;
  }

  return lastTipText;
}

/**
 * Release all MediaPipe resources. Call on component unmount or interview finish.
 */
export function dispose() {
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  isInitialized = false;
  initPromise = null;
  resetAggregator();
}
