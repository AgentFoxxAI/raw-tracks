// Singleton "currently playing post" coordinator.
// Ensures only one audio/video element plays at a time across the feed.
type Listener = (id: string | null) => void;

let activeId: string | null = null;
const listeners = new Set<Listener>();

export const ActivePlayer = {
  get current() {
    return activeId;
  },
  set(id: string | null) {
    if (activeId === id) return;
    activeId = id;
    listeners.forEach((l) => l(activeId));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
