import { watch, onUnmounted } from "vue";

export function useForestAudio(state, notify) {
  let audio, masterGain, limiter, birdTimer, fireTimer;
  let sleepFade = 1;
  const noiseGains = {};
  const noiseBuffers = {};
  function makeNoiseBuffer(color) {
    if (noiseBuffers[color]) return noiseBuffers[color];
    const buffer = audio.createBuffer(1, audio.sampleRate * 6, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (color === "brown") {
        last = (last + white * 0.025) / 1.025;
        data[i] = last * 4.2;
      } else if (color === "pink") {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = pink * 0.11;
      } else data[i] = white * 0.42;
    }
    noiseBuffers[color] = buffer;
    return buffer;
  }
  function createNoiseChannel(name, color, filterType, frequency, q = 0.7, modulation = 0) {
    const source = audio.createBufferSource();
    source.buffer = makeNoiseBuffer(color);
    source.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const textureGain = audio.createGain();
    textureGain.gain.value = modulation ? 0.55 : 1;
    const channelGain = audio.createGain();
    channelGain.gain.value = 0;
    source.connect(filter);
    filter.connect(textureGain);
    textureGain.connect(channelGain);
    channelGain.connect(masterGain);
    source.start();
    noiseGains[name] = channelGain;
    if (modulation) {
      const lfo = audio.createOscillator();
      const depth = audio.createGain();
      lfo.frequency.value = modulation;
      depth.gain.value = 0.42;
      lfo.connect(depth);
      depth.connect(textureGain.gain);
      lfo.start();
    }
    if (name === "wind") {
      const lfo = audio.createOscillator();
      const depth = audio.createGain();
      lfo.frequency.value = 0.09;
      depth.gain.value = 90;
      lfo.connect(depth);
      depth.connect(filter.frequency);
      lfo.start();
    }
  }
  function createAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Audio unavailable");
    audio = new AudioContext();
    masterGain = audio.createGain();
    masterGain.gain.value = 0;
    limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.22;
    masterGain.connect(limiter);
    limiter.connect(audio.destination);
    createNoiseChannel("wind", "pink", "lowpass", 480, 0.65);
    createNoiseChannel("water", "white", "bandpass", 1500, 0.65);
    createNoiseChannel("rain", "white", "highpass", 2800, 0.4);
    createNoiseChannel("white", "white", "lowpass", 9000, 0.7);
    createNoiseChannel("pink", "pink", "lowpass", 2800, 0.7);
    createNoiseChannel("brown", "brown", "lowpass", 850, 0.7);
    createNoiseChannel("fire", "pink", "bandpass", 820, 0.8, 0.22);
    createNoiseChannel("ocean", "brown", "lowpass", 520, 0.65, 0.11);
  }
  function chirp() {
    if (
      !audio ||
      !state.playing ||
      !state.channels.birds.enabled ||
      state.channels.birds.volume === 0
    )
      return;
    const time = audio.currentTime;
    const base = 1800 + Math.random() * 1600;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const pan = audio.createStereoPanner();
      pan.pan.value = Math.random() * 1.5 - 0.75;
      const t = time + i * 0.17;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(base, t);
      oscillator.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.065);
      oscillator.frequency.exponentialRampToValueAtTime(base * 0.87, t + 0.14);
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(
        (state.channels.birds.volume / 100) * 0.09,
        t + 0.02,
      );
      envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      oscillator.connect(envelope);
      envelope.connect(pan);
      pan.connect(masterGain);
      oscillator.start(t);
      oscillator.stop(t + 0.18);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        pan.disconnect();
      };
    }
  }
  function scheduleBird() {
    clearTimeout(birdTimer);
    if (!state.playing) return;
    birdTimer = setTimeout(
      () => {
        chirp();
        scheduleBird();
      },
      2200 + Math.random() * 5200,
    );
  }
  function scheduleFire() {
    clearTimeout(fireTimer);
    if (!audio || !state.playing || !state.channels.fire.enabled) return;
    fireTimer = setTimeout(() => {
      if (!audio || !state.playing || !state.channels.fire.enabled) return;
      const time = audio.currentTime;
      const pops = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pops; i++) {
        const source = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const envelope = audio.createGain();
        const pan = audio.createStereoPanner();
        const start = time + Math.random() * 0.18;
        const length = 0.025 + Math.random() * 0.055;
        source.buffer = makeNoiseBuffer("white");
        filter.type = "bandpass";
        filter.frequency.value = 1300 + Math.random() * 3900;
        filter.Q.value = 0.7 + Math.random() * 1.8;
        pan.pan.value = Math.random() * 1.6 - 0.8;
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(0.025 + Math.random() * 0.045, start + 0.006);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
        source.connect(filter);
        filter.connect(envelope);
        envelope.connect(pan);
        pan.connect(noiseGains.fire);
        source.start(start, Math.random() * 5, length);
        source.stop(start + length + 0.005);
        source.onended = () => {
          source.disconnect();
          filter.disconnect();
          envelope.disconnect();
          pan.disconnect();
        };
      }
      scheduleFire();
    }, 420 + Math.random() * 1180);
  }
  function updateAudio() {
    if (!audio) return;
    const time = audio.currentTime;
    masterGain.gain.setTargetAtTime(
      state.playing ? (state.master / 100) * sleepFade : 0,
      time,
      0.3,
    );
    for (const [name, gain] of Object.entries(noiseGains))
      gain.gain.setTargetAtTime(
        state.channels[name].enabled
          ? (state.channels[name].volume / 100) * (name === "wind" ? 0.7 : 0.9)
          : 0,
        time,
        0.25,
      );
  }

  let busy = false;
  async function toggleAudio() {
    if (busy) return;
    busy = true;
    try {
      if (!audio) createAudio();
      await audio.resume();
      state.playing = !state.playing;
      updateAudio();
      scheduleBird();
      scheduleFire();
    } catch {
      notify("当前浏览器无法播放环境音，可以继续欣赏森林。");
      return false;
    } finally {
      busy = false;
    }
    return true;
  }
  watch(() => [state.master, state.playing, state.channels], updateAudio, {
    deep: true,
  });
  watch(() => [state.playing, state.channels.fire.enabled], scheduleFire);
  onUnmounted(() => {
    clearTimeout(birdTimer);
    clearTimeout(fireTimer);
    audio?.close();
  });
  function setSleepFade(value) {
    sleepFade = Math.min(1, Math.max(0, value));
    updateAudio();
  }

  return { toggleAudio, setSleepFade };
}
