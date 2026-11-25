/** Short, soft two-note "ping" for new chat messages (Web Audio, no sound file). Silently does nothing when the
 *  browser blocks audio before the user has interacted with the page. */
let ctx: AudioContext | null = null;

export function playPing() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const [freq, at] of [[880, 0], [1320, 0.12]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.12, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.3);
    }
  } catch {
    /* audio not available */
  }
}
