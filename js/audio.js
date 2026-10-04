/**
 * SYNTHWAVE DAMAS - AUDIO ENGINE
 * Procedural Web Audio API Sound Synthesizer & Synthwave BGM Generator
 * Zero external audio files required - 100% procedural 80s analog synth emulation.
 */

class SynthwaveAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.isMuted = false;
        this.isMusicPlaying = false;
        this.bpm = 118;
        this.musicInterval = null;
        this.step = 0;
        this.sfxVolume = 0.7;
        this.musicVolume = 0.35;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Master Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

            // SFX Sub-bus
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            // Music Sub-bus
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            this.musicGain.connect(this.masterGain);

            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API não suportada ou bloqueada:', e);
        }
    }

    resume() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMute(muted) {
        this.isMuted = muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
        }
    }

    setSfxVolume(vol) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        }
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        }
    }

    // ====== SFX SYNTHESIZERS ======

    // 1. Piece Selection (Resonant Neon Blip)
    playSelect() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.Q.setValueAtTime(5, t);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.12);
    }

    // 2. Normal Piece Move (Smooth Cyber Swoosh & Thud)
    playMove() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        // Sub bass drop
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.2);

        // Laser click
        const click = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        click.type = 'sawtooth';
        click.frequency.setValueAtTime(1600, t);
        click.frequency.exponentialRampToValueAtTime(300, t + 0.05);

        clickGain.gain.setValueAtTime(0.15, t);
        clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        click.connect(clickGain);
        clickGain.connect(this.sfxGain);
        click.start(t);
        click.stop(t + 0.06);
    }

    // 3. Capture Explosion (Laser Blast + Synth Snare)
    playCapture(comboCount = 1) {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;

        // Pitch scales up with combo
        const baseFreq = 520 + Math.min(comboCount * 90, 600);

        // FM Laser Zap
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.28);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        // Distortion filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.3);

        // White noise punch for impact
        this.playNoiseSnap(t, 0.2, 0.35);
    }

    // White noise generator for snare/explosion punch
    playNoiseSnap(time, duration = 0.15, volume = 0.25) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, time);
        filter.Q.setValueAtTime(2, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start(time);
        noise.stop(time + duration);
    }

    // 4. King / Dama Promotion (Majestic Retro Arpeggio Fanfare)
    playCrown() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;
        // Synthwave celebratory chord: C5 -> E5 -> G5 -> C6 -> E6
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, idx) => {
            const noteTime = t + idx * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.3, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3500, noteTime);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(noteTime);
            osc.stop(noteTime + 0.42);
        });
    }

    // 5. Invalid Move (Warning Buzz)
    playInvalid() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.setValueAtTime(110, t + 0.08);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.16);
    }

    // 6. Victory Anthem (Epic 80s Victory Synth Lead)
    playVictory() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;
        // F4, G4, A4, C5, D5, F5
        const melody = [
            { f: 349.23, d: 0.18, pause: 0.0 },
            { f: 392.00, d: 0.18, pause: 0.18 },
            { f: 440.00, d: 0.18, pause: 0.36 },
            { f: 523.25, d: 0.28, pause: 0.54 },
            { f: 587.33, d: 0.22, pause: 0.82 },
            { f: 698.46, d: 0.60, pause: 1.04 }
        ];

        melody.forEach(item => {
            const start = t + item.pause;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(item.f, start);

            gain.gain.setValueAtTime(0.35, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + item.d);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(start);
            osc.stop(start + item.d);
        });
    }

    // 7. Defeat Theme (Deep Dark Synthwave chord)
    playDefeat() {
        if (!this.initialized || this.isMuted) return;
        this.resume();
        const t = this.ctx.currentTime;
        const freqs = [196.00, 233.08, 293.66, 146.83]; // G minor sub chord
        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f, t);
            osc.frequency.exponentialRampToValueAtTime(f * 0.85, t + 1.2);

            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 1.4);
        });
    }

    // ====== PROCEDURAL SYNTHWAVE MUSIC GENERATOR ======

    toggleMusic() {
        if (this.isMusicPlaying) {
            this.stopMusic();
            return false;
        } else {
            this.startMusic();
            return true;
        }
    }

    startMusic() {
        if (this.isMusicPlaying) return;
        this.resume();
        this.isMusicPlaying = true;
        this.step = 0;

        const stepTimeMs = (60 / this.bpm / 4) * 1000; // 16th note interval
        this.musicInterval = setInterval(() => {
            if (!this.isMusicPlaying || this.isMuted) return;
            this.tickMusicStep();
        }, stepTimeMs);
    }

    stopMusic() {
        this.isMusicPlaying = false;
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }

    tickMusicStep() {
        const t = this.ctx.currentTime;
        const s16 = this.step % 16;
        const s32 = this.step % 32;
        const s64 = this.step % 64;

        // 1. Kick Drum on beats 1, 5, 9, 13 (four on the floor)
        if (s16 % 4 === 0) {
            this.playKick(t);
        }

        // 2. Snare / Clap on beats 5 and 13 (backbeat)
        if (s16 === 4 || s16 === 12) {
            this.playSnare(t);
        }

        // 3. Hi-hat on every 8th note offbeat (s16 = 2, 6, 10, 14)
        if (s16 % 2 === 1) {
            this.playHiHat(t, s16 % 4 === 2);
        }

        // 4. Synthwave Arpeggiated Bassline (Rolling 16th notes in A minor -> F -> C -> G)
        // Root progression: A (0..15), F (16..31), D (32..47), E (48..63)
        let root = 110.0; // A2
        if (s64 >= 16 && s64 < 32) root = 87.31; // F2
        else if (s64 >= 32 && s64 < 48) root = 73.42; // D2
        else if (s64 >= 48) root = 82.41; // E2

        // Octave bounce pattern
        const bassFreq = (s16 % 2 === 0) ? root : root * 2;
        this.playBassNote(t, bassFreq);

        // 5. Ambient Synth Pad Arpeggio (every 4 steps)
        if (s16 % 4 === 0) {
            const padScale = [220, 261.63, 329.63, 392.00, 440, 523.25];
            const noteIdx = (Math.floor(this.step / 4)) % padScale.length;
            this.playArpLead(t, padScale[noteIdx]);
        }

        this.step++;
    }

    playKick(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    playSnare(t) {
        this.playNoiseSnap(t, 0.16, 0.28);
    }

    playHiHat(t, open = false) {
        const dur = open ? 0.08 : 0.03;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.6;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7500, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(open ? 0.15 : 0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(t);
        noise.stop(t + dur);
    }

    playBassNote(t, freq) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(250, t + 0.11);
        filter.Q.setValueAtTime(4, t);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(t);
        osc.stop(t + 0.13);
    }

    playArpLead(t, freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(t);
        osc.stop(t + 0.36);
    }
}

// Global instance
window.synthAudio = new SynthwaveAudio();
