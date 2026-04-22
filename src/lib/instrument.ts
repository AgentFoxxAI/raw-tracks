// Instrument tags + frequency-based auto-suggest heuristic.
export const INSTRUMENT_TAGS = [
  "bass",
  "guitar",
  "vocals",
  "drums",
  "hihats",
  "keys",
  "synth",
  "other",
] as const;

export type InstrumentTag = (typeof INSTRUMENT_TAGS)[number];

/**
 * Analyze an AudioBuffer and return a suggested instrument tag based on
 * dominant frequency band:
 *   <250Hz       -> bass
 *   250-2kHz     -> guitar (we map vocals/guitar both to guitar by default)
 *   >2kHz        -> drums/hihats -> we return "drums"
 */
export function suggestInstrumentFromBuffer(buffer: AudioBuffer): InstrumentTag {
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  // Use a small FFT-like average of energies via downsampling + DFT on a slice.
  const sliceSize = Math.min(channel.length, 16384);
  const slice = channel.subarray(0, sliceSize);

  // Simple band-energy estimation using zero-crossing rate as a cheap proxy
  // for spectral centroid.
  let zc = 0;
  for (let i = 1; i < slice.length; i++) {
    if ((slice[i - 1] >= 0 && slice[i] < 0) || (slice[i - 1] < 0 && slice[i] >= 0)) {
      zc++;
    }
  }
  const zcr = zc / slice.length;
  // Estimated dominant freq ~ zcr * sampleRate / 2
  const estFreq = zcr * sampleRate * 0.5;

  if (estFreq < 250) return "bass";
  if (estFreq < 2000) return "guitar";
  return "drums";
}

export function generateWaveformData(buffer: AudioBuffer, samples = 96): number[] {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.floor(channel.length / samples);
  const peaks: number[] = [];
  for (let i = 0; i < samples; i++) {
    let max = 0;
    const start = i * blockSize;
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(channel[start + j] || 0);
      if (v > max) max = v;
    }
    peaks.push(Math.min(1, max));
  }
  // Normalize so loudest peak = 1
  const m = Math.max(...peaks, 0.0001);
  return peaks.map((p) => p / m);
}

/** Decode a File (audio or video) to an AudioBuffer in the browser. */
export async function fileToAudioBuffer(file: File): Promise<AudioBuffer> {
  const arrayBuf = await file.arrayBuffer();
  const AudioCtx =
    (window.AudioContext ||
      // @ts-expect-error - webkit prefix
      window.webkitAudioContext) as typeof AudioContext;
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    void ctx.close();
  }
}

/** Encode an AudioBuffer to a 16-bit PCM WAV Blob (for video->audio extraction). */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const ab = new ArrayBuffer(length);
  const view = new DataView(ab);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  let offset = 0;
  writeString(offset, "RIFF"); offset += 4;
  view.setUint32(offset, length - 8, true); offset += 4;
  writeString(offset, "WAVE"); offset += 4;
  writeString(offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * numChannels * 2, true); offset += 4;
  view.setUint16(offset, numChannels * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString(offset, "data"); offset += 4;
  view.setUint32(offset, buffer.length * numChannels * 2, true); offset += 4;

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));

  let pos = offset;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let s = Math.max(-1, Math.min(1, channels[ch][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(pos, s, true);
      pos += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
