import { watch, onUnmounted } from "vue";

export function useForestAudio(state, notify) {
  let audio, masterGain, birdTimer;
  const noiseGains = {};
  function createAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Audio unavailable");
    audio = new AudioContext();
    masterGain = audio.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audio.destination);
    const buffer = audio.createBuffer(
      1,
      audio.sampleRate * 6,
      audio.sampleRate,
    );
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + white * 0.02) / 1.02;
      data[i] = last * 3.5;
    }
    for (const [name, frequency, q] of [
      ["wind", 330, 0.55],
      ["water", 1700, 0.65],
      ["rain", 4200, 0.4],
    ]) {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = audio.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const gain = audio.createGain();
      gain.gain.value = 0;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      source.start();
      noiseGains[name] = gain;
      if (name === "wind") {
        const lfo = audio.createOscillator();
        lfo.frequency.value = 0.09;
        const modulation = audio.createGain();
        modulation.gain.value = 100;
        lfo.connect(modulation);
        modulation.connect(filter.frequency);
        lfo.start();
      }
    }
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
  function updateAudio() {
    if (!audio) return;
    const time = audio.currentTime;
    masterGain.gain.setTargetAtTime(
      state.playing ? state.master / 100 : 0,
      time,
      0.3,
    );
    for (const [name, gain] of Object.entries(noiseGains))
      gain.gain.setTargetAtTime(
        state.channels[name].enabled
          ? (state.channels[name].volume / 100) * (name === "wind" ? 0.7 : 1.1)
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
    } catch {
      notify("当前浏览器无法播放环境音，可以继续欣赏森林。");
    } finally {
      busy = false;
    }
  }
  watch(() => [state.master, state.playing, state.channels], updateAudio, {
    deep: true,
  });
  onUnmounted(() => {
    clearTimeout(birdTimer);
    audio?.close();
  });
  return { toggleAudio };
}
