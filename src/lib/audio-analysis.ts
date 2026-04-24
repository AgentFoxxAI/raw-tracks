/**
 * Lightweight client-side audio analysis for the demo.
 *
 * Real production-grade BPM/key detection would use a worker + a proper
 * library (essentia.js, web-audio-beat-detector). For the demo we use:
 *  - Energy-based onset detection + autocorrelation for BPM
 *  - Inter-onset interval clustering for time signature heuristic
 *  - Chromagram-style pitch class energy for musical key (Krumhansl profile)
 *  - RMS-windowed energy curve for sections + overall "energy" score
 *
 * Everything is deterministic for the same input and runs in <300ms on
 * a typical 60s mono buffer.
 */

export type TimeSignature = "3/4" | "4/4" | "5/4" | "6/8" | "7/8";

export interface SongSection {
  /** Section start in seconds */
  start: number;
  /** Section end in seconds */
  end: number;
  /** Inferred role: intro / verse / build / drop / outro */
  label: "intro" | "verse" | "build" | "drop" | "outro" | "break";
  /** Average energy 0-1 in this section */
  energy: number;
}

export interface AudioMetadata {
  bpm: number;
  /** Confidence 0-1 for the BPM estimate */
  bpm_confidence: number;
  time_signature: TimeSignature;
  key: string; // e.g. "C minor"
  /** Overall track energy 0-1 */
  energy: number;
  /** Loudness in dBFS */
  loudness_db: number;
  /** Estimated tonality (major/minor) */
  mode: "major" | "minor";
  sections: SongSection[];
}

const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Krumhansl-Schmuckler key profiles (normalized)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Downsample a Float32Array channel to a target rate to speed up analysis. */
function downsample(channel: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (targetRate >= sourceRate) return channel;
  const ratio = sourceRate / targetRate;
  const newLen = Math.floor(channel.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    out[i] = channel[Math.floor(i * ratio)];
  }
  return out;
}

/** Compute onset envelope using windowed energy difference (spectral flux proxy). */
function onsetEnvelope(channel: Float32Array, sampleRate: number, hopMs = 10): { env: Float32Array; hopRate: number } {
  const hop = Math.max(1, Math.floor((sampleRate * hopMs) / 1000));
  const win = hop * 4;
  const frames = Math.floor((channel.length - win) / hop);
  const env = new Float32Array(Math.max(0, frames));
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * hop;
    for (let i = 0; i < win; i++) {
      const v = channel[start + i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / win);
    env[f] = Math.max(0, rms - prev);
    prev = rms;
  }
  // Normalize
  let max = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > max) max = env[i];
  if (max > 0) for (let i = 0; i < env.length; i++) env[i] /= max;
  return { env, hopRate: sampleRate / hop };
}

/** Estimate BPM via autocorrelation of the onset envelope between 60-200 BPM. */
function estimateBpm(env: Float32Array, hopRate: number): { bpm: number; confidence: number } {
  if (env.length < 32) return { bpm: 120, confidence: 0 };
  const minLag = Math.floor((hopRate * 60) / 200); // 200 BPM
  const maxLag = Math.floor((hopRate * 60) / 60); // 60 BPM
  let bestLag = minLag;
  let bestScore = -Infinity;
  let total = 0;
  for (let lag = minLag; lag <= Math.min(maxLag, env.length - 1); lag++) {
    let score = 0;
    for (let i = 0; i < env.length - lag; i++) {
      score += env[i] * env[i + lag];
    }
    total += score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  const bpm = (60 * hopRate) / bestLag;
  // Snap into 70-180 by doubling/halving
  let snapped = bpm;
  while (snapped < 70) snapped *= 2;
  while (snapped > 180) snapped /= 2;
  const confidence = total > 0 ? Math.min(1, bestScore / (total / (maxLag - minLag)) / 4) : 0;
  return { bpm: Math.round(snapped), confidence };
}

/** Detect onsets by peak-picking the envelope. */
function detectOnsets(env: Float32Array, hopRate: number): number[] {
  const out: number[] = [];
  const threshold = 0.18;
  for (let i = 2; i < env.length - 2; i++) {
    if (env[i] > threshold && env[i] > env[i - 1] && env[i] > env[i - 2] && env[i] >= env[i + 1]) {
      out.push(i / hopRate);
    }
  }
  return out;
}

/** Heuristic: cluster inter-onset intervals against beat duration to guess meter. */
function estimateTimeSignature(onsets: number[], bpm: number): TimeSignature {
  if (onsets.length < 6) return "4/4";
  const beat = 60 / bpm;
  // Bucket onsets to nearest beat & count beats per recurring accent
  const accents: number[] = [];
  let lastAccent = 0;
  for (let i = 1; i < onsets.length; i++) {
    const gap = onsets[i] - onsets[i - 1];
    // Accent = larger-than-beat gap
    if (gap > beat * 1.3) {
      const beatsBetween = Math.round((onsets[i] - lastAccent) / beat);
      if (beatsBetween > 1 && beatsBetween < 12) accents.push(beatsBetween);
      lastAccent = onsets[i];
    }
  }
  if (!accents.length) return "4/4";
  // Mode of accents
  const counts = new Map<number, number>();
  accents.forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1));
  let bestN = 4;
  let bestC = 0;
  counts.forEach((c, n) => {
    if (c > bestC) {
      bestC = c;
      bestN = n;
    }
  });
  if (bestN === 3) return "3/4";
  if (bestN === 5) return "5/4";
  if (bestN === 6) return "6/8";
  if (bestN === 7) return "7/8";
  return "4/4";
}

/** Build a coarse 12-bin pitch chromagram via Goertzel-style filtering at note frequencies. */
function chromagram(channel: Float32Array, sampleRate: number): number[] {
  const chroma = new Array(12).fill(0);
  // Sample 4 octaves: A2 (110Hz) to A6 (1760Hz)
  const baseFreqs = [
    32.7, 34.65, 36.71, 38.89, 41.2, 43.65, 46.25, 49.0, 51.91, 55.0, 58.27, 61.74,
  ];
  const windowSize = Math.min(channel.length, sampleRate * 4); // 4s window
  const slice = channel.subarray(0, windowSize);
  for (let pc = 0; pc < 12; pc++) {
    let energy = 0;
    for (let oct = 1; oct <= 5; oct++) {
      const freq = baseFreqs[pc] * Math.pow(2, oct);
      if (freq > sampleRate / 2) break;
      // Goertzel
      const k = (2 * Math.PI * freq) / sampleRate;
      const cosK = 2 * Math.cos(k);
      let q1 = 0;
      let q2 = 0;
      for (let i = 0; i < slice.length; i++) {
        const q0 = cosK * q1 - q2 + slice[i];
        q2 = q1;
        q1 = q0;
      }
      const power = q1 * q1 + q2 * q2 - q1 * q2 * cosK;
      energy += power;
    }
    chroma[pc] = energy;
  }
  // Normalize
  const max = Math.max(...chroma, 1);
  return chroma.map((v) => v / max);
}

/** Correlate chromagram with all 24 key profiles, return best. */
function estimateKey(chroma: number[]): { key: string; mode: "major" | "minor" } {
  let bestKey = 0;
  let bestMode: "major" | "minor" = "major";
  let bestScore = -Infinity;
  for (let rot = 0; rot < 12; rot++) {
    const rotated = chroma.map((_, i) => chroma[(i + rot) % 12]);
    const majScore = correlate(rotated, MAJOR_PROFILE);
    const minScore = correlate(rotated, MINOR_PROFILE);
    if (majScore > bestScore) {
      bestScore = majScore;
      bestKey = rot;
      bestMode = "major";
    }
    if (minScore > bestScore) {
      bestScore = minScore;
      bestKey = rot;
      bestMode = "minor";
    }
  }
  return { key: `${PITCH_CLASSES[bestKey]} ${bestMode}`, mode: bestMode };
}

function correlate(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** Build coarse song sections by RMS energy curve + change points. */
function detectSections(channel: Float32Array, sampleRate: number, totalDuration: number): SongSection[] {
  const winSec = 2;
  const winSamples = Math.floor(sampleRate * winSec);
  const numWindows = Math.max(2, Math.floor(channel.length / winSamples));
  const energies: number[] = [];
  for (let w = 0; w < numWindows; w++) {
    let sum = 0;
    const start = w * winSamples;
    for (let i = 0; i < winSamples && start + i < channel.length; i++) {
      const v = channel[start + i];
      sum += v * v;
    }
    energies.push(Math.sqrt(sum / winSamples));
  }
  const max = Math.max(...energies, 0.0001);
  const norm = energies.map((e) => e / max);
  // Group consecutive windows with similar energy band into a section
  const sections: SongSection[] = [];
  const bandOf = (v: number): number => Math.floor(v * 4); // 0-3 bands
  let segStart = 0;
  let segBand = bandOf(norm[0] ?? 0);
  for (let i = 1; i <= norm.length; i++) {
    const b = i < norm.length ? bandOf(norm[i]) : -1;
    if (b !== segBand || i === norm.length) {
      const start = segStart * winSec;
      const end = Math.min(totalDuration, i * winSec);
      const slice = norm.slice(segStart, i);
      const avg = slice.reduce((a, c) => a + c, 0) / Math.max(1, slice.length);
      sections.push({
        start,
        end,
        label: labelSection(segStart, i, norm, sections.length),
        energy: avg,
      });
      segStart = i;
      segBand = b;
    }
  }
  // Merge tiny sections (<3s) into neighbors
  return mergeSmallSections(sections, 3);
}

function labelSection(
  startIdx: number,
  endIdx: number,
  norm: number[],
  alreadyCount: number,
): SongSection["label"] {
  const slice = norm.slice(startIdx, endIdx);
  const avg = slice.reduce((a, c) => a + c, 0) / Math.max(1, slice.length);
  const rising = slice.length > 1 && slice[slice.length - 1] - slice[0] > 0.2;
  const falling = slice.length > 1 && slice[0] - slice[slice.length - 1] > 0.2;
  if (alreadyCount === 0 && avg < 0.5) return "intro";
  if (rising) return "build";
  if (avg > 0.75) return "drop";
  if (avg < 0.3) return "break";
  if (falling && endIdx >= norm.length - 1) return "outro";
  return "verse";
}

function mergeSmallSections(sections: SongSection[], minSeconds: number): SongSection[] {
  if (sections.length < 2) return sections;
  const out: SongSection[] = [sections[0]];
  for (let i = 1; i < sections.length; i++) {
    const prev = out[out.length - 1];
    const cur = sections[i];
    if (cur.end - cur.start < minSeconds) {
      prev.end = cur.end;
      prev.energy = (prev.energy + cur.energy) / 2;
    } else {
      out.push(cur);
    }
  }
  return out;
}

/** Compute simple RMS loudness in dBFS. */
function loudnessDb(channel: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i];
  const rms = Math.sqrt(sum / Math.max(1, channel.length));
  if (rms < 1e-6) return -60;
  return Math.max(-60, Math.round(20 * Math.log10(rms)));
}

/** Run all analysis on an AudioBuffer. */
export function analyzeAudio(buffer: AudioBuffer): AudioMetadata {
  // Always work on a downsampled mono channel for speed
  const target = 11025;
  const mono = downsample(buffer.getChannelData(0), buffer.sampleRate, target);

  const { env, hopRate } = onsetEnvelope(mono, target);
  const { bpm, confidence } = estimateBpm(env, hopRate);
  const onsets = detectOnsets(env, hopRate);
  const time_signature = estimateTimeSignature(onsets, bpm);

  const chroma = chromagram(mono, target);
  const { key, mode } = estimateKey(chroma);

  const sections = detectSections(mono, target, buffer.duration);
  const energyAvg = sections.length
    ? sections.reduce((a, s) => a + s.energy, 0) / sections.length
    : 0.5;

  return {
    bpm,
    bpm_confidence: Math.round(confidence * 100) / 100,
    time_signature,
    key,
    energy: Math.round(energyAvg * 100) / 100,
    loudness_db: loudnessDb(mono),
    mode,
    sections,
  };
}

/** Deterministic mock metadata for demo feed posts. */
export function mockMetadataFromSeed(seed: number, durationSeconds: number | null): AudioMetadata {
  // Pseudo-random but stable from seed
  const rand = (n: number) => {
    let s = (seed * 9301 + n * 49297) % 233280;
    return s / 233280;
  };
  const bpmChoices = [72, 80, 84, 92, 96, 104, 110, 118, 124, 128, 138, 140, 150, 160, 174];
  const tsChoices: TimeSignature[] = ["4/4", "4/4", "4/4", "4/4", "3/4", "6/8", "7/8"];
  const keyChoices = [
    "C major", "G major", "D major", "A minor", "E minor", "B minor",
    "F# minor", "F major", "Bb major", "Eb major", "C# minor", "G minor",
  ];
  const bpm = bpmChoices[Math.floor(rand(1) * bpmChoices.length)];
  const time_signature = tsChoices[Math.floor(rand(2) * tsChoices.length)];
  const key = keyChoices[Math.floor(rand(3) * keyChoices.length)];
  const energy = Math.round((0.3 + rand(4) * 0.65) * 100) / 100;
  const dur = durationSeconds ?? 60;
  const sectionLabels: SongSection["label"][] = ["intro", "verse", "build", "drop", "outro"];
  const numSections = Math.min(sectionLabels.length, Math.max(2, Math.floor(dur / 12)));
  const sectionLen = dur / numSections;
  const sections: SongSection[] = Array.from({ length: numSections }, (_, i) => ({
    start: Math.round(i * sectionLen),
    end: Math.round((i + 1) * sectionLen),
    label: sectionLabels[i] ?? "verse",
    energy: Math.min(1, Math.max(0.1, energy + (rand(5 + i) - 0.5) * 0.4)),
  }));
  return {
    bpm,
    bpm_confidence: 0.7 + rand(6) * 0.3,
    time_signature,
    key,
    energy,
    loudness_db: -18 + Math.floor(rand(7) * 12),
    mode: key.includes("minor") ? "minor" : "major",
    sections,
  };
}
