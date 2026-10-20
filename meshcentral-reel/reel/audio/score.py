# /// script
# requires-python = ">=3.10"
# dependencies = ["librosa>=0.10", "numpy", "scipy", "soundfile"]
# ///
"""The score under Babak's MeshCentral pitch, plus the placed VO and the beat grid.

    MOTION_REEL_SKILL=<skill> uv run reel/audio/score.py

124.8 BPM, 4/4, 136 beats = 65.385 s. The tempo is chosen so the drop (bar 13, beat 52 = 25.000 s)
lands on the word "MeshCentral" once the take is placed 0.25 s in; the VO itself is never re-cut.

  beats   0-24   problem   D minor, dark pad, ticking 8ths, soft pulse; "یا بدتر؟" stops the bed;
                           the internet-outage line chops the pad on/off (a connection dropping)
  beats  24-44   build     kick enters, minor bass pulse, filter opening
  beats  44-52   turn      drums out, Bb -> C (V of F), riser into the drop
  beats  52-116  main      F major groove, I V vi IV
  beats 116-120  breath    pad only before "I'm Babak"
  beats 120-132  outro     lighter groove under the call to action
  beats 132-136  end       resolve on F add9 with the end card

Reads  reel/audio/vo/meshcentral.mp3 (the supplied narration)
Writes reel/audio/music.wav, reel/audio/vo.wav, reel/beats.json
"""
import json
import os
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy import signal


def _skill_dir():
    if os.environ.get("MOTION_REEL_SKILL"):
        return Path(os.environ["MOTION_REEL_SKILL"])
    found = sorted((Path.home() / ".claude/plugins").glob("**/skills/motion-reel/scripts/dsp.py"))
    if found:
        return found[-1].parent.parent
    sys.exit("can't find the motion-reel skill: set MOTION_REEL_SKILL to the folder that holds its SKILL.md")


sys.path.insert(0, str(_skill_dir() / "scripts"))
from dsp import *  # noqa: E402,F403

HERE = Path(__file__).resolve().parent
FILM = HERE.parent
BPM = 124.8
BEAT = 60 / BPM
NB = 136
DUR = float(json.loads((FILM / "film.json").read_text())["duration"])
N = int(SR * DUR)
VO_AT = 0.25            # the take starts here; "MeshCentral" (24.75 s in the take) lands on beat 52
seed(20261020)


def T(b):
    return b * BEAT


def hash01(i, seed=1):
    """lib/motion.js hash01 (mulberry32), bit for bit, so the picture can flicker with the sound."""
    imul = lambda x, y: (x * y) & 0xFFFFFFFF
    a = (i * 374761393 + seed * 668265263) & 0xFFFFFFFF
    a = (a + 0x6D2B79F5) & 0xFFFFFFFF
    t = imul(a ^ (a >> 15), 1 | a)
    t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
    return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def gate_off(k):
    """Quarter beat k of the outage line (beats 14-24): is the connection down? film.js gateOff() mirrors it."""
    return hash01(k, 7) < 0.32


# ---------------------------------------------------------------- VO

def compress(x, thresh_db=-22, ratio=3.0, attack=0.004, release=0.08, makeup_db=3):
    e = env_follow(x, attack, release)
    over = np.maximum(20 * np.log10(e + 1e-9) - thresh_db, 0)
    return x * 10 ** ((-over * (1 - 1 / ratio) + makeup_db) / 20)


def build_vo():
    y, _ = librosa.load(HERE / "vo" / "meshcentral.mp3", sr=SR, mono=True)
    x = filt(y, "highpass", 85, 2)
    x = peq(x, 240, -2.0, 1.0)       # less boxy
    x = peq(x, 3300, 2.5, 0.9)       # presence over the groove
    x = compress(x)
    out = np.zeros(N)
    a = int(VO_AT * SR)
    n = min(len(x), N - a)
    out[a:a + n] = x[:n]
    return out / (np.abs(out).max() + 1e-9) * 0.7


# ---------------------------------------------------------------- harmony

Dm = (["D3", "A3", "F4", "A4"], "D2")
Bb = (["Bb2", "F3", "D4", "F4"], "Bb1")
F_ = (["F3", "C4", "A4", "C5"], "F2")
C_ = (["C3", "G3", "E4", "G4"], "C2")
Gm = (["G2", "D3", "Bb3", "D4"], "G1")
A_ = (["A2", "E3", "C#4", "E4"], "A1")
PROBLEM = [Dm, Bb, Gm, A_]                 # i VI iv V: unresolved
MAIN = [F_, C_, Dm, Bb]                    # I V vi IV in F


def chord_at(b):
    bar = int(b // 4)
    if b < 44:
        return PROBLEM[bar % 4]
    if b < 52:
        return Bb if b < 48 else C_
    return MAIN[(bar - 13) % 4]


def main():
    drums, bass, music, fx = (Bus(DUR, BPM) for _ in range(4))
    vo = build_vo()

    for b in range(NB):
        notes, root = chord_at(b)
        bar_start = b % 4 == 0
        # ---- problem: a soft pulse and a nervous tick
        if b < 24:
            drums.add(kick(soft=True), b, 0.42)
            if not (12 <= b < 14):
                drums.add(hat(), b + 0.5, 0.10, pan=0.3)
                drums.add(hat(), b + 0.75, 0.05, pan=-0.3)
            if bar_start and not (12 <= b < 14):
                music.add(pad_chord(notes, 4 * BEAT + 0.1, (420, 900), attack=0.3), b, 0.30)
        # ---- build: the kick takes over, the bass pulses, the filter opens
        elif b < 44:
            k = (b - 24) / 20
            drums.add(kick(), b, 0.55 + 0.3 * k)
            drums.add(hat(), b + 0.5, 0.13 + 0.06 * k, pan=0.25)
            if b >= 32 and b % 2 == 1:
                drums.add(clap(tight=True), b, 0.22, pan=0.05)
            for h in (0, 0.5):
                bass.add(bass_note(root, BEAT / 2 * 0.85, 500 + 900 * k), b + h, 0.5)
            if bar_start:
                music.add(pad_chord(notes, 4 * BEAT + 0.1, (700 + 1400 * k, 1100 + 1800 * k), attack=0.08), b, 0.30)
        # ---- turn: no drums, two chords, riser
        elif b < 52:
            if bar_start:
                music.add(pad_chord(notes, 4 * BEAT + 0.15, (1200, 3200), attack=0.15), b, 0.34)
            if b == 44:
                bass.add(bass_note(root, 4 * BEAT, 400), b, 0.45)
            if b == 48:
                bass.add(bass_note(root, 4 * BEAT, 500), b, 0.45)
        # ---- main + outro grooves
        elif b < 116 or 120 <= b < 132:
            light = b >= 120
            drums.add(kick(), b, 0.95 if not light else 0.75)
            if b % 2 == 1:
                drums.add(clap(), b, 0.36 if not light else 0.26, pan=0.05)
            drums.add(hat(), b + 0.5, 0.2, pan=0.25)
            if not light and b >= 60:
                for s in (0.25, 0.75):
                    drums.add(hat(), b + s, 0.06, pan=-0.3)
            for h in (0, 0.5):
                up = h == 0.5
                nt = root[:-1] + str(int(root[-1]) + (1 if up else 0))
                bass.add(bass_note(nt, BEAT / 2 * 0.9, 1100), b + h, 0.55 if h == 0 else 0.42)
            if bar_start:
                music.add(pad_chord(notes, 4 * BEAT + 0.1, 2400, attack=0.02), b, 0.26)
            if b % 2 == 0 and not light:
                music.add(pluck([n[:-1] + str(int(n[-1]) + 1) for n in notes[1:]]), b + 0.5, 0.2, pan=0.18)
            if b >= 84 and not light and b % 4 == 3:          # a rising figure, bars 21+
                for j, nt in enumerate(notes[1:] + [notes[1][:-1] + str(int(notes[1][-1]) + 1)]):
                    music.add(pluck([nt[:-1] + str(int(nt[-1]) + 1)], 0.18, 4200), b + j * 0.25, 0.14, pan=-0.2)
        # ---- breath before "I'm Babak"
        elif b < 120:
            if bar_start:
                music.add(pad_chord(notes, 4 * BEAT + 0.3, (3000, 900), attack=0.05, release=0.4), b, 0.3)

    # "یا بدتر؟" (or worse?): the bed stops dead for two beats
    # the outage line: chop the problem pad like a connection dropping (beats 14-24)
    gate = np.ones(drums.x.shape[1])
    for k in range(40):
        if gate_off(k):
            a, c = int(T(14 + k / 4) * SR), int(T(14 + (k + 1) / 4) * SR)
            gate[a:c] = 0.08
    gate = np.convolve(gate, np.ones(96) / 96, mode="same")

    # transitions
    fx.add(riser(T(52) - T(46)), 46, 0.32)
    fx.add(crash(0.9)[::-1] * 0.7, 52 - 0.9 / BEAT, 0.22)
    drums.add(sub_drop(1.2, 80, 30), 52, 0.65)
    drums.add(crash(1.8), 52, 0.26)
    fx.add(whoosh(1.2, 300, 3000, peak=0.85), 22.8, 0.16)
    fx.add(crash(0.7)[::-1] * 0.6, 120 - 0.7 / BEAT, 0.16)
    drums.add(crash(1.4), 120, 0.16)
    # end: resolve
    notes, root = F_
    music.add(pad_chord(notes + ["G5"], 4 * BEAT + 1.2, (5200, 1400), attack=0.005, release=0.9), 132, 0.46)
    bass.add(bass_note("F1", 4 * BEAT, 600), 132, 0.5)
    drums.add(kick(), 132, 1.0)
    drums.add(crash(2.4), 132, 0.28)
    drums.add(sub_drop(1.4, 70, 28), 132, 0.5)

    # ---- the bed: kick pump on the groove, reverb, the outage gate, the stop
    kicks = [T(b) for b in range(24, 132) if not (44 <= b < 52 or 116 <= b < 120)]
    pump = sidechain(kicks, bass.x.shape[1], 0.45, 0.1)
    ir = reverb_ir(1.6, 0.42)
    wet_src = music.x * 0.4 + fx.x * 0.15
    wet = np.stack([signal.fftconvolve(wet_src[c], ir[c])[: wet_src.shape[1]] for c in range(2)])
    melodic = (bass.x * 0.8 + music.x * 0.8 + wet * 0.45) * pump
    melodic[:, : int(T(24) * SR)] *= gate[: int(T(24) * SR)]
    bed = drums.x * 0.85 + melodic + fx.x * 0.7
    bed = np.stack([filt(ch, "highpass", 28) for ch in bed])[:, :N]
    a, c = int(T(12) * SR), int(T(14) * SR)
    bed[:, a:c] *= np.linspace(1, 0, c - a) ** 8
    bed /= np.abs(bed).max() + 1e-9
    bed *= 0.5
    fade = int(0.4 * SR)
    bed[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    sf.write(HERE / "music.wav", bed.T, SR, subtype="PCM_24")
    sf.write(HERE / "vo.wav", np.stack([vo, vo]).T, SR, subtype="PCM_24")

    # ---- grid, measured on the drums alone
    grid = measure_beats(drums.x[:, :N].mean(axis=0).astype(np.float32), SR, BPM, n_beats=NB + 1)
    grid["beats"] = [b for b in grid["beats"] if b < DUR + 0.5]
    grid["downbeats"] = grid["beats"][::4]
    grid["sections"] = [{"name": "problem", "beat": 0}, {"name": "build", "beat": 24}, {"name": "turn", "beat": 44},
                        {"name": "main", "beat": 52}, {"name": "breath", "beat": 116}, {"name": "outro", "beat": 120},
                        {"name": "end", "beat": 132}]
    mono = bed.mean(axis=0)
    bar_s = grid["period"] * 4
    grid["bar_energy"] = [round(float(np.sqrt(np.mean(mono[int(i * bar_s * SR):int((i + 1) * bar_s * SR)] ** 2) + 1e-12)), 4)
                          for i in range(int(DUR / bar_s))]
    grid["designed_bpm"] = BPM
    grid["vo_offset"] = VO_AT
    grid["duration"] = DUR
    grid["source"] = "reel/audio/score.py drum stem, librosa beat_track + onsets, linear fit"
    (FILM / "beats.json").write_text(json.dumps(grid, indent=1))
    print(f"beats: {grid['bpm']} bpm (designed {BPM}), offset {grid['offset'] * 1000:.1f} ms, "
          f"{grid['fit_inliers']} inliers, fit rms {grid['fit_residual_ms']} ms; beat 52 = {grid['offset'] + 52 * grid['period']:.3f} s")
    print(f"-> {HERE / 'music.wav'}, {HERE / 'vo.wav'}, {FILM / 'beats.json'}")


if __name__ == "__main__":
    main()
