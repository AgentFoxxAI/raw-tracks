/**
 * Mock data for the Offcuts demo. Used to populate Discover, DMs, AI search,
 * and timestamped reactions so the social experience feels alive without
 * requiring real users to sign up.
 */

import avatarLo from "@/assets/avatars/lo.jpg";
import avatarJuniper from "@/assets/avatars/juniper.jpg";
import avatarKazu from "@/assets/avatars/kazu.jpg";
import avatarRae from "@/assets/avatars/rae.jpg";
import avatarMarisol from "@/assets/avatars/marisol.jpg";
import avatarDanny from "@/assets/avatars/danny.jpg";
import avatarTunde from "@/assets/avatars/tunde.jpg";
import avatarSarah from "@/assets/avatars/sarah.jpg";

export interface MockArtist {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  location: string;
  instruments: string[];
  influences: string;
  follower_count: number;
  following_count: number;
  collab_status: "open" | "selective" | "closed";
}

export const MOCK_ARTISTS: MockArtist[] = [
  {
    id: "mock-1",
    username: "lo_ferraro",
    display_name: "Lo Ferraro",
    avatar_url: avatarLo,
    bio: "Bedroom producer, broken keys, late nights. Demos always rough on purpose.",
    location: "Brooklyn, NY",
    instruments: ["keys", "drum machine", "vocals"],
    influences: "Mk.gee, Frank Ocean, Dijon",
    follower_count: 1284,
    following_count: 312,
    collab_status: "open",
  },
  {
    id: "mock-2",
    username: "junipergrove",
    display_name: "Juniper Grove",
    avatar_url: avatarJuniper,
    bio: "Folk + ambient field recordings. I write songs while walking.",
    location: "Asheville, NC",
    instruments: ["acoustic guitar", "vocals"],
    influences: "Big Thief, Nick Drake, Adrianne Lenker",
    follower_count: 4310,
    following_count: 89,
    collab_status: "selective",
  },
  {
    id: "mock-3",
    username: "808kazu",
    display_name: "kazu",
    avatar_url: avatarKazu,
    bio: "Beats / lo-fi / boom bap. Open to vocal features.",
    location: "Osaka, JP",
    instruments: ["mpc", "sampler", "bass"],
    influences: "Madlib, Nujabes, Dilla",
    follower_count: 8921,
    following_count: 540,
    collab_status: "open",
  },
  {
    id: "mock-4",
    username: "rae.solos",
    display_name: "Rae",
    avatar_url: avatarRae,
    bio: "Singer-songwriter. Looking for a producer to finish 3 demos sitting on my phone.",
    location: "Austin, TX",
    instruments: ["vocals", "piano"],
    influences: "Phoebe Bridgers, Maggie Rogers",
    follower_count: 612,
    following_count: 220,
    collab_status: "open",
  },
  {
    id: "mock-5",
    username: "marisol.bass",
    display_name: "Marisol",
    avatar_url: avatarMarisol,
    bio: "Bassist for hire. Funk, neo-soul, jazz. DM for stems.",
    location: "Mexico City",
    instruments: ["bass", "synth"],
    influences: "Thundercat, MonoNeon, Hiatus Kaiyote",
    follower_count: 2740,
    following_count: 410,
    collab_status: "open",
  },
  {
    id: "mock-6",
    username: "danny_modular",
    display_name: "Danny K",
    avatar_url: avatarDanny,
    bio: "Modular synth experiments. Cassettes only.",
    location: "Berlin, DE",
    instruments: ["modular", "tape"],
    influences: "Floating Points, Caterina Barbieri",
    follower_count: 5187,
    following_count: 73,
    collab_status: "selective",
  },
  {
    id: "mock-7",
    username: "tunde.drums",
    display_name: "Tunde",
    avatar_url: avatarTunde,
    bio: "Drummer. Loose grooves. Always recording.",
    location: "Lagos, NG",
    instruments: ["drums", "percussion"],
    influences: "Tony Allen, Questlove",
    follower_count: 3402,
    following_count: 198,
    collab_status: "open",
  },
  {
    id: "mock-8",
    username: "saraha.guitar",
    display_name: "Sarah A.",
    avatar_url: avatarSarah,
    bio: "Indie guitarist. Reverb-heavy. I make 90 second songs.",
    location: "Montreal, CA",
    instruments: ["electric guitar"],
    influences: "Alvvays, DIIV, Beach House",
    follower_count: 1102,
    following_count: 488,
    collab_status: "closed",
  },
];

export interface MockDM {
  id: string;
  artist: MockArtist;
  preview: string;
  unread: boolean;
  time_ago: string;
  is_collab_request: boolean;
  collab_status?: "pending" | "approved" | "declined";
  thread: { from: "them" | "me"; text: string; at: string }[];
}

export const MOCK_DMS: MockDM[] = [
  {
    id: "dm-1",
    artist: MOCK_ARTISTS[0],
    preview: "Hey, that guitar riff on 'mid-day fog' is sick. Want to add some keys?",
    unread: true,
    time_ago: "12m",
    is_collab_request: true,
    collab_status: "pending",
    thread: [
      {
        from: "them",
        text: "Yo, just heard 'mid-day fog' — that opening guitar loop is doing something. Mind if I throw some Rhodes on it?",
        at: "12m",
      },
      {
        from: "them",
        text: "I'd send you back a stem so you stay in control. No pressure if you've already got it locked.",
        at: "11m",
      },
    ],
  },
  {
    id: "dm-2",
    artist: MOCK_ARTISTS[3],
    preview: "Approved your collab request — I'll send the vocal stem tonight.",
    unread: true,
    time_ago: "2h",
    is_collab_request: true,
    collab_status: "approved",
    thread: [
      { from: "me", text: "Loved your demo 'porchlight' — would you be open to me producing it?", at: "1d" },
      { from: "them", text: "Yes please. I'll send the vocal stem tonight.", at: "2h" },
      { from: "them", text: "approved your collab request 🤝", at: "2h" },
    ],
  },
  {
    id: "dm-3",
    artist: MOCK_ARTISTS[2],
    preview: "Wanna swap a beat for some live drums? I'll send the BPM grid.",
    unread: false,
    time_ago: "1d",
    is_collab_request: false,
    thread: [
      { from: "them", text: "Wanna swap a beat for some live drums? I'll send the BPM grid.", at: "1d" },
      { from: "me", text: "Down. 92 bpm, half-time?", at: "1d" },
    ],
  },
  {
    id: "dm-4",
    artist: MOCK_ARTISTS[6],
    preview: "Sent you a 16-bar drum take — let me know if the swing is too heavy.",
    unread: false,
    time_ago: "3d",
    is_collab_request: false,
    thread: [
      { from: "them", text: "Sent you a 16-bar drum take — let me know if the swing is too heavy.", at: "3d" },
    ],
  },
  {
    id: "dm-5",
    artist: MOCK_ARTISTS[5],
    preview: "Collab request: modular pad bed for your 'after hours' loop?",
    unread: false,
    time_ago: "5d",
    is_collab_request: true,
    collab_status: "declined",
    thread: [
      { from: "them", text: "Modular pad bed for your 'after hours' loop?", at: "5d" },
      { from: "me", text: "Going a different direction on that one — appreciate it though.", at: "5d" },
    ],
  },
];

/** Demo timestamped reactions to display along the playback waveform. */
export interface MockTimestampReaction {
  id: string;
  username: string;
  emoji: string;
  timestamp_seconds: number;
  note?: string;
}

export function mockTimestampReactionsFor(durationSeconds: number | null): MockTimestampReaction[] {
  const d = Math.max(durationSeconds ?? 60, 12);
  return [
    { id: "r1", username: "junipergrove", emoji: "🔥", timestamp_seconds: d * 0.12, note: "this hook" },
    { id: "r2", username: "808kazu", emoji: "🥁", timestamp_seconds: d * 0.34 },
    { id: "r3", username: "marisol.bass", emoji: "💜", timestamp_seconds: d * 0.51, note: "the way it drops here" },
    { id: "r4", username: "rae.solos", emoji: "✨", timestamp_seconds: d * 0.68 },
    { id: "r5", username: "tunde.drums", emoji: "🤝", timestamp_seconds: d * 0.82, note: "wanna add drums?" },
    { id: "r6", username: "danny_modular", emoji: "🔥", timestamp_seconds: d * 0.93 },
  ];
}

/** Mocked AI search examples for the chatbot widget. */
export const AI_SEARCH_PROMPTS = [
  "Show me guitar riffs from March",
  "Which audio notes have no comments?",
  "Find duplicates in my library",
  "What's my most reacted-to demo?",
  "Show unfinished ideas tagged 'vocals'",
];

export interface AIMockResult {
  id: string;
  title: string;
  meta: string;
}

export function mockAISearchAnswer(query: string): { summary: string; results: AIMockResult[] } {
  const q = query.toLowerCase();
  if (q.includes("guitar")) {
    return {
      summary: "Found 3 guitar-tagged audio notes from the last 30 days.",
      results: [
        { id: "ai-1", title: "mid-day fog (riff)", meta: "guitar · 0:42 · Mar 18" },
        { id: "ai-2", title: "open tuning sketch", meta: "guitar · 1:08 · Mar 24" },
        { id: "ai-3", title: "loop for kazu", meta: "guitar · 0:31 · Mar 29" },
      ],
    };
  }
  if (q.includes("comment")) {
    return {
      summary: "5 audio notes have no comments yet.",
      results: [
        { id: "ai-4", title: "shower hum 4am", meta: "vocals · 0:18" },
        { id: "ai-5", title: "untitled — Tuesday", meta: "keys · 0:54" },
        { id: "ai-6", title: "bus stop melody", meta: "vocals · 0:22" },
      ],
    };
  }
  if (q.includes("duplicate")) {
    return {
      summary: "Likely duplicates detected based on length + waveform similarity.",
      results: [
        { id: "ai-7", title: "porchlight (v1) ↔ porchlight (v1 copy)", meta: "98% match · 1:12" },
        { id: "ai-8", title: "beat 4 ↔ beat 4 final", meta: "94% match · 0:48" },
      ],
    };
  }
  if (q.includes("react") || q.includes("most")) {
    return {
      summary: "Your most-reacted demo this month:",
      results: [
        { id: "ai-9", title: "after hours (loop)", meta: "47 reactions · 12 comments" },
      ],
    };
  }
  return {
    summary: `Searched your library for "${query}". Here's what I found:`,
    results: [
      { id: "ai-10", title: "Untitled idea — last Friday", meta: "keys · 1:04" },
      { id: "ai-11", title: "voice memo 312", meta: "vocals · 0:38" },
      { id: "ai-12", title: "loop B (rough)", meta: "drums · 0:22" },
    ],
  };
}

export const REACTION_EMOJIS = ["🔥", "💜", "🤝", "🥁", "✨", "👏", "😮"];

/** Mock posts for the social feed. Mix of audio and text-only updates from suggested + followed artists. */
export interface MockFeedPost {
  id: string;
  artist: MockArtist;
  /** "audio" cards show a fake waveform + play button. "text" cards are status updates. */
  kind: "audio" | "text";
  title: string;
  description: string;
  duration_seconds: number | null;
  instrument_tag: string;
  created_at: string;
  play_count: number;
  like_count: number;
  comment_count: number;
  repost_count: number;
  /** Reason this is in the feed — drives the X-style header label. */
  reason: "following" | "suggested" | "liked-by-following";
  liked_by?: MockArtist;
  waveform_seed: number;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

export const MOCK_FEED_POSTS: MockFeedPost[] = [
  {
    id: "feed-1",
    artist: MOCK_ARTISTS[0], // Lo Ferraro
    kind: "audio",
    title: "mid-day fog (riff)",
    description: "found this in a voice memo from october. open tuning, half awake. might build it out 🌫️",
    duration_seconds: 42,
    instrument_tag: "guitar",
    created_at: hoursAgo(0.5),
    play_count: 1284,
    like_count: 312,
    comment_count: 18,
    repost_count: 4,
    reason: "following",
    waveform_seed: 1,
  },
  {
    id: "feed-2",
    artist: MOCK_ARTISTS[2], // kazu
    kind: "audio",
    title: "loop B (rough)",
    description: "92 bpm, half-time. looking for vocals on this one — slide in if you fuck with it",
    duration_seconds: 31,
    instrument_tag: "drum machine",
    created_at: hoursAgo(2),
    play_count: 4180,
    like_count: 891,
    comment_count: 64,
    repost_count: 22,
    reason: "following",
    waveform_seed: 2,
  },
  {
    id: "feed-3",
    artist: MOCK_ARTISTS[3], // Rae
    kind: "text",
    title: "",
    description:
      "3 demos sitting on my phone, one of them about my grandma's house. anyone here good with sparse production? 🤍",
    duration_seconds: null,
    instrument_tag: "vocals",
    created_at: hoursAgo(4),
    play_count: 0,
    like_count: 142,
    comment_count: 31,
    repost_count: 6,
    reason: "following",
    waveform_seed: 0,
  },
  {
    id: "feed-4",
    artist: MOCK_ARTISTS[6], // Tunde
    kind: "audio",
    title: "loose pocket #14",
    description: "drum take. swung hi-hat. record on a phone, mix it like it matters.",
    duration_seconds: 58,
    instrument_tag: "drums",
    created_at: hoursAgo(6),
    play_count: 2204,
    like_count: 504,
    comment_count: 40,
    repost_count: 12,
    reason: "liked-by-following",
    liked_by: MOCK_ARTISTS[2],
    waveform_seed: 3,
  },
  {
    id: "feed-5",
    artist: MOCK_ARTISTS[1], // Juniper Grove
    kind: "audio",
    title: "porchlight (v3)",
    description: "rewrote the bridge on the train. think it lives now.",
    duration_seconds: 78,
    instrument_tag: "acoustic guitar",
    created_at: hoursAgo(9),
    play_count: 6701,
    like_count: 1120,
    comment_count: 84,
    repost_count: 41,
    reason: "following",
    waveform_seed: 4,
  },
  {
    id: "feed-6",
    artist: MOCK_ARTISTS[5], // Danny K
    kind: "audio",
    title: "after hours (loop)",
    description: "modular bed, no quantize. let it run for 6 minutes, this is the best 24 seconds.",
    duration_seconds: 24,
    instrument_tag: "modular",
    created_at: hoursAgo(13),
    play_count: 9930,
    like_count: 2104,
    comment_count: 158,
    repost_count: 87,
    reason: "suggested",
    waveform_seed: 5,
  },
  {
    id: "feed-7",
    artist: MOCK_ARTISTS[4], // Marisol
    kind: "text",
    title: "",
    description:
      "PSA: I'll do one free bass take this week for anyone in the feed. drop the BPM + key in replies 🎸",
    duration_seconds: null,
    instrument_tag: "bass",
    created_at: hoursAgo(16),
    play_count: 0,
    like_count: 421,
    comment_count: 96,
    repost_count: 18,
    reason: "suggested",
    waveform_seed: 0,
  },
  {
    id: "feed-8",
    artist: MOCK_ARTISTS[7], // Sarah A.
    kind: "audio",
    title: "90 second song #38",
    description: "reverb-heavy, no chorus on purpose. trying to write less.",
    duration_seconds: 89,
    instrument_tag: "electric guitar",
    created_at: hoursAgo(22),
    play_count: 1402,
    like_count: 287,
    comment_count: 22,
    repost_count: 5,
    reason: "suggested",
    waveform_seed: 6,
  },
  {
    id: "feed-9",
    artist: MOCK_ARTISTS[0], // Lo Ferraro
    kind: "audio",
    title: "rhodes idea over kazu loop",
    description: "took kazu's loop B and threw a rhodes on top. sending him the stem tonight 🤝",
    duration_seconds: 37,
    instrument_tag: "keys",
    created_at: hoursAgo(28),
    play_count: 814,
    like_count: 198,
    comment_count: 14,
    repost_count: 9,
    reason: "following",
    waveform_seed: 7,
  },
];

/** Deterministic fake waveform so each mock card gets a stable shape. */
export function fakeWaveform(seed: number, bars = 56): number[] {
  if (seed === 0) return [];
  const out: number[] = [];
  let s = seed * 9301 + 49297;
  for (let i = 0; i < bars; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    // Shape: rise, peak in middle, taper
    const env = Math.sin((i / bars) * Math.PI);
    out.push(Math.max(0.08, Math.min(1, env * (0.4 + r * 0.7))));
  }
  return out;
}
