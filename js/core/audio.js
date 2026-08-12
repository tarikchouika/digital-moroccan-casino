/* ══════════════════════════════════════════
   Digital Moroccan casino — Audio Engine (Web Audio API)
   ═══════════════════════════════════════════ */
"use strict";
let audioContext = null;
/* ── الحصول على AudioContext مع معالجة الحالات ── */
function getAudioContext() {
  if (ST.mute) return null;
  if (!audioContext) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
    } catch (e) {
      console.warn('Audio not supported');
      return null;
    }
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}
/* ── توليد ضوضاء (Noise) ── */
function playNoise(duration, volume, type) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11 * volume;
      }
    } else {
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * volume * (1 - i / length);
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch (e) {
    // صامت — لا نريد كسر اللعبة بسبب الصوت
  }
}
/* ── توليد نغمة (Tone) ── */
function playTone(freq, duration, type, volume, delay, pan) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const startTime = ctx.currentTime + (delay || 0);
    if (pan !== undefined && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(panner);
      panner.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(volume || 0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  } catch (e) {
    // صامت
  }
}
/* ── توليد كورد (Chord) ── */
function playChord(notes, duration, volume, delay) {
  notes.forEach((freq, i) => {
    playTone(
      freq,
      duration,
      'triangle',
      (volume || 0.1) / notes.length,
      (delay || 0) + i * 0.02
    );
  });
}
/* ── مكتبة الأصوات ── */
const SND = {
  click() { playTone(700, 0.05, 'square', 0.07); },
  spin() { for (let i = 0; i < 12; i++) playTone(280 + i * 35, 0.03, 'square', 0.04, i * 0.05); },
  tick() { playTone(1100, 0.03, 'square', 0.05); },
  card() { playTone(950, 0.06, 'triangle', 0.14); playTone(1300, 0.08, 'triangle', 0.08, 0.04); },
  coin() { playTone(1250, 0.08, 'triangle', 0.14); playTone(1650, 0.1, 'triangle', 0.11, 0.06); },
  win() { playChord([523, 659, 784, 1046], 0.25, 0.2); },
  bigWin() { playChord([392, 523, 659, 784, 1046, 1318], 0.3, 0.2); },
  jackpot() { playChord([392, 523, 659, 784, 1046, 1318, 1568, 2093], 0.8, 0.3, 0.6); playNoise(0.5, 0.3, 'pink'); },
  lose() { playChord([320, 240, 170], 0.3, 0.06); },
  boom() { playNoise(0.45, 0.3); playTone(70, 0.4, 'sine', 0.2); playTone(50, 0.5, 'sine', 0.15, 0.1); },
  flip() { playTone(500, 0.07, 'sine', 0.12); playTone(800, 0.07, 'sine', 0.12, 0.07); },
  shuffle() { for (let i = 0; i < 10; i++) playTone(380 + i * 12, 0.04, 'triangle', 0.05, i * 0.04); },
  swap() { playTone(400, 0.12, 'sine', 0.1); playTone(600, 0.12, 'sine', 0.1, 0.1); playTone(800, 0.12, 'sine', 0.1, 0.2); },
  draw() { playTone(600, 0.06, 'triangle', 0.12); playTone(900, 0.06, 'triangle', 0.1, 0.06); },
  match() { playChord([523, 659, 784], 0.2, 0.18); },
  mismatch() { playTone(300, 0.15, 'sawtooth', 0.06); playTone(200, 0.2, 'sawtooth', 0.05, 0.12); },
  dice() { for (let i = 0; i < 6; i++) playTone(400 + Math.random() * 400, 0.05, 'square', 0.06, i * 0.06); },
  notify() { playTone(880, 0.08, 'sine', 0.1); playTone(1174, 0.12, 'sine', 0.09, 0.1); },
  /* نقر الكرة على جيوب الروليت — نغمة خفيفة سريعة */
  tickSoft() { playTone(1500 + Math.random() * 250, 0.03, 'sine', 0.045); },
  /* ارتطام الكرة بأوتاد البليينكو — خشخشة خشبية */
  peg() { playTone(520 + Math.random() * 90, 0.04, 'triangle', 0.05); },
  /* توقف بكرات الفواكه — كلانك معدني */
  reelStop() { playTone(180, 0.07, 'square', 0.05); playTone(95, 0.1, 'sine', 0.09, 0.01); },
  /* توزيع ورقة — حفيف خفيف مرتفع */
  deal() { playTone(700, 0.05, 'triangle', 0.09); playTone(1100, 0.06, 'triangle', 0.06, 0.04); }
};
/* ── كتم / تشغيل الصوت ── */
function toggleMute() {
  ST.mute = !ST.mute;
  sSet('rc_mute', ST.mute ? '1' : '0');
  const btn = document.getElementById('muteBtn');
  if (btn) {
    const ico = document.getElementById('muteIco');
    if (ico) ico.className = ST.mute ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    btn.setAttribute('aria-pressed', ST.mute ? 'true' : 'false');
  }
  if (!ST.mute) SND.click();
}
/* ── Export to global ────────────────── */
window.SND = SND;
window.toggleMute = toggleMute;
window.getAudioContext = getAudioContext;