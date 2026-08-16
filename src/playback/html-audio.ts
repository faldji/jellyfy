/** Web replace()/HMR can leave extra <audio> elements playing. */
export function silenceHtmlAudio(keep?: HTMLAudioElement | null) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('audio').forEach((node) => {
    if (keep && node === keep) return;
    try {
      node.pause();
    } catch {
      // Ignore nodes the browser has already released.
    }
  });
}