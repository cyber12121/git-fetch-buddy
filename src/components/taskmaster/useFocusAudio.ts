import { useRef, useCallback, useEffect } from "react";

export type SoundscapeType = "rain" | "fire" | "brook" | "binaural_40hz" | "binaural_10hz";

export function useFocusAudio(soundEnabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const activeSoundscapeNodeRef = useRef<{
    source: AudioNode;
    gain: GainNode;
    type: SoundscapeType;
    cleanup?: () => void;
  } | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) throw new Error("Web Audio API not supported");
      audioContextRef.current = new AudioCtor();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  const playTickSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn("Audio blocked", e);
    }
  }, [getAudioContext]);

  const playTibetanBell = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const t = ctx.currentTime;
      // Resonant harmonic frequencies of a handcrafted singing bowl
      const partials = [
        { freq: 432, gain: 0.15, decay: 3.5 },
        { freq: 864, gain: 0.08, decay: 2.8 },
        { freq: 1296, gain: 0.04, decay: 2.2 },
        { freq: 1728, gain: 0.02, decay: 1.6 },
        { freq: 2160, gain: 0.01, decay: 1.2 },
      ];

      partials.forEach(({ freq, gain: targetGain, decay }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);

        // Subtle slow warm vibrato/tremolo
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(targetGain, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + decay);
      });
    } catch (err) {
      console.warn("Tibetan bell playback failed", err);
    }
  }, [getAudioContext]);

  const playChime = useCallback(
    (type: "start" | "pause" | "victory") => {
      if (!soundEnabledRef.current) return;
      try {
        const ctx = getAudioContext();
        if (type === "start") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } else if (type === "victory") {
          const notes = [261.63, 329.63, 392.0, 523.25];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
            gain.gain.setValueAtTime(0.06, ctx.currentTime + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.1);
            osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
          });
        } else if (type === "pause") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(500, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        }
      } catch (err) {
        console.warn("Audio Context failed", err);
      }
    },
    [getAudioContext]
  );

  const stopSoundscape = useCallback(() => {
    if (activeSoundscapeNodeRef.current) {
      try {
        const { source, gain, cleanup } = activeSoundscapeNodeRef.current;
        gain.gain.linearRampToValueAtTime(0.0001, (audioContextRef.current?.currentTime || 0) + 0.3);
        setTimeout(() => {
          try {
            cleanup?.();
            (source as AudioBufferSourceNode).stop?.();
            source.disconnect();
            gain.disconnect();
          } catch {}
        }, 350);
      } catch {}
      activeSoundscapeNodeRef.current = null;
    }
  }, []);

  const startSoundscape = useCallback(
    (type: SoundscapeType, volume: number = 0.4) => {
      stopSoundscape();
      try {
        const ctx = getAudioContext();

        // -------------------------------------------------------------
        // Andrew Huberman 40 Hz Gamma Focus & 10 Hz Alpha Binaural Beats
        // -------------------------------------------------------------
        if (type === "binaural_40hz" || type === "binaural_10hz") {
          // Dr. Andrew Huberman specifically highlights 40 Hz Gamma for dopamine, acetylcholine,
          // and prefrontal cortex activation. 10 Hz Alpha is optimal for relaxed alertness / rest.
          const beatFreq = type === "binaural_40hz" ? 40 : 10;
          const baseFreq = 210; // 210 Hz optimal warm carrier for human auditory cortex

          const masterGain = ctx.createGain();
          masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
          masterGain.gain.linearRampToValueAtTime(
            Math.max(0.01, Math.min(1, volume)),
            ctx.currentTime + 0.6
          );

          // Left Ear Tone: baseFreq (e.g. 210 Hz)
          const oscL = ctx.createOscillator();
          oscL.type = "sine";
          oscL.frequency.setValueAtTime(baseFreq, ctx.currentTime);

          // Right Ear Tone: baseFreq + beatFreq (e.g. 250 Hz for 40 Hz Gamma, 220 Hz for 10 Hz Alpha)
          const oscR = ctx.createOscillator();
          oscR.type = "sine";
          oscR.frequency.setValueAtTime(baseFreq + beatFreq, ctx.currentTime);

          const toneGainL = ctx.createGain();
          toneGainL.gain.setValueAtTime(0.14, ctx.currentTime);

          const toneGainR = ctx.createGain();
          toneGainR.gain.setValueAtTime(0.14, ctx.currentTime);

          // Soft pink noise bed underneath to prevent auditory fatigue
          const noiseBufSize = ctx.sampleRate * 3;
          const noiseBuffer = ctx.createBuffer(1, noiseBufSize, ctx.sampleRate);
          const noiseData = noiseBuffer.getChannelData(0);
          let nb0 = 0, nb1 = 0, nb2 = 0;
          for (let i = 0; i < noiseBufSize; i++) {
            const white = Math.random() * 2 - 1;
            nb0 = 0.997 * nb0 + white * 0.05;
            nb1 = 0.985 * nb1 + white * 0.08;
            nb2 = 0.950 * nb2 + white * 0.14;
            noiseData[i] = (nb0 + nb1 + nb2) * 0.012;
          }
          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = noiseBuffer;
          noiseSource.loop = true;

          const noiseFilter = ctx.createBiquadFilter();
          noiseFilter.type = "lowpass";
          noiseFilter.frequency.setValueAtTime(360, ctx.currentTime);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.035, ctx.currentTime);

          noiseSource.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(masterGain);

          // Hard stereo separation so the brain synthesizes the binaural beat
          if (ctx.createStereoPanner) {
            const pannerL = ctx.createStereoPanner();
            pannerL.pan.setValueAtTime(-1, ctx.currentTime);

            const pannerR = ctx.createStereoPanner();
            pannerR.pan.setValueAtTime(1, ctx.currentTime);

            oscL.connect(toneGainL);
            toneGainL.connect(pannerL);
            pannerL.connect(masterGain);

            oscR.connect(toneGainR);
            toneGainR.connect(pannerR);
            pannerR.connect(masterGain);
          } else {
            const merger = ctx.createChannelMerger(2);
            oscL.connect(toneGainL);
            toneGainL.connect(merger, 0, 0);

            oscR.connect(toneGainR);
            toneGainR.connect(merger, 0, 1);
            merger.connect(masterGain);
          }

          masterGain.connect(ctx.destination);

          oscL.start();
          oscR.start();
          noiseSource.start();

          activeSoundscapeNodeRef.current = {
            source: oscL,
            gain: masterGain,
            type,
            cleanup: () => {
              try {
                oscL.stop();
                oscR.stop();
                noiseSource.stop();
                oscL.disconnect();
                oscR.disconnect();
                noiseSource.disconnect();
              } catch {}
            },
          };
          return;
        }

        const bufferSize = ctx.sampleRate * 4; // 4 seconds looped noise
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        let lastOut = 0.0;
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (type === "rain") {
            // Pink noise with subtle high rain patter
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
            b6 = white * 0.115926;
          } else if (type === "fire") {
            // Brown rumble with occasional crackle pop
            lastOut = (lastOut + 0.02 * white) / 1.02;
            let sample = lastOut * 1.5;
            if (Math.random() < 0.0008) {
              sample += (Math.random() * 0.4 - 0.2); // soft crackle
            }
            data[i] = sample * 0.18;
          } else {
            // Brook pink noise (deep, filtered stream)
            b0 = 0.997 * b0 + white * 0.05;
            b1 = 0.985 * b1 + white * 0.08;
            b2 = 0.950 * b2 + white * 0.14;
            lastOut = (b0 + b1 + b2) * 0.06;
            data[i] = lastOut;
          }
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        if (type === "rain") {
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1100, ctx.currentTime);
        } else if (type === "fire") {
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(450, ctx.currentTime);
        } else {
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(650, ctx.currentTime);
          filter.Q.setValueAtTime(0.7, ctx.currentTime);
        }

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(Math.max(0.01, Math.min(1, volume)), ctx.currentTime + 0.5);

        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start();
        activeSoundscapeNodeRef.current = { source, gain: gainNode, type };
      } catch (e) {
        console.warn("Soundscape start failed", e);
      }
    },
    [getAudioContext, stopSoundscape]
  );

  const setSoundscapeVolume = useCallback((volume: number) => {
    if (activeSoundscapeNodeRef.current && audioContextRef.current) {
      try {
        const clamped = Math.max(0, Math.min(1, volume));
        activeSoundscapeNodeRef.current.gain.gain.linearRampToValueAtTime(
          clamped,
          audioContextRef.current.currentTime + 0.1
        );
      } catch {}
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSoundscape();
    };
  }, [stopSoundscape]);

  return {
    playChime,
    playTickSound,
    playTibetanBell,
    startSoundscape,
    stopSoundscape,
    setSoundscapeVolume,
    activeSoundscape: activeSoundscapeNodeRef.current?.type ?? null,
  };
}
