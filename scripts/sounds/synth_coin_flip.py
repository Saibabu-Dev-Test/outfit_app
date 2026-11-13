"""Synthesize a 1.5 s metallic coin spin ("Euler's disk") for the Outfit Vote coin flip.

A flicked coin rings (disc modes, inharmonic partials), then spins on its edge: the ring is
amplitude-modulated by a rolling wobble whose rate speeds up (8 Hz -> 40 Hz) as it settles,
with tiny contact clicks at each wobble; a clear settle "ting" at ~1.05 s (lands with the 1.5 s
flip) rings out under a smooth raised-cosine fade over the last 0.45 s, reaching silence at 1.5 s.
Writes mono 44.1 kHz 16-bit WAV; loudness is finished by an AGC + tanh soft limiter.
Usage (needs numpy + ffmpeg); gives about -3 LUFS, peak about -1.1 dBFS:
  python3 scripts/sounds/synth_coin_flip.py /tmp/c.wav 10 0.67
  ffmpeg -y -i /tmp/c.wav -af lowpass=f=11000 -c:a libvorbis -q:a 6 -ar 44100 -ac 1 \
    android/app/src/main/res/raw/coin_flip.ogg
"""
import sys, wave
import numpy as np

SR = 44100
DUR = 1.5
n = int(SR * DUR)
t = np.arange(n) / SR
rng = np.random.default_rng(7)

# disc-like inharmonic partials (base ~ 2.1 kHz, a bright small coin)
BASE = 2093.0
PARTIALS = [(1.0, 1.0), (1.594, 0.55), (2.136, 0.42), (2.653, 0.30), (3.156, 0.22), (4.06, 0.14), (5.12, 0.09)]


def ring(t0, amp, decay, base=BASE, detune=0.0):
    out = np.zeros(n)
    i0 = int(t0 * SR)
    tt = t[i0:] - t0
    for k, (r, a) in enumerate(PARTIALS):
        f = base * r * (1 + detune)
        d = decay * (1 + 0.6 * k)  # higher modes die faster
        ph = rng.uniform(0, 2 * np.pi)
        # slight beating pair per partial = shimmering metal
        out[i0:] += a * amp * np.exp(-d * tt) * (np.sin(2 * np.pi * f * tt + ph) + 0.6 * np.sin(2 * np.pi * f * 1.0023 * tt + ph * 1.3))
    # click transient
    cl = int(0.004 * SR)
    burst = rng.standard_normal(cl) * np.exp(-np.linspace(0, 6, cl))
    out[i0:i0 + cl] += amp * 0.9 * burst
    return out


sig = np.zeros(n)
# 1) flick: bright initial ting
sig += ring(0.0, 1.0, 1.4)

# 2) spinning: sustained ring modulated by an accelerating wobble
spin_start, spin_end = 0.10, 1.02
mask = (t >= spin_start) & (t < spin_end)
ts = np.clip(t - spin_start, 0, None)
L = spin_end - spin_start
# wobble frequency rises 6 -> 40 Hz (exponential sweep), phase = integral
f0, f1 = 8.0, 40.0
k = np.log(f1 / f0) / L
phase = 2 * np.pi * f0 * (np.exp(k * np.minimum(ts, L)) - 1) / k
wob = 0.5 + 0.5 * np.cos(phase)
wob = wob ** 3  # peaky: a "whirr" per contact
# pitch drifts up a little as it spins down (Euler disk)
drift = 1 + 0.06 * (np.minimum(ts, L) / L) ** 2
spin = np.zeros(n)
for j, (r, a) in enumerate(PARTIALS[:5]):
    inst = 2 * np.pi * BASE * 0.5 * r * np.cumsum(drift) / SR  # an octave lower body for the roll
    spin += a * np.sin(inst + j)
env = np.where(mask, 0.55 + 0.35 * (np.minimum(ts, L) / L), 0)
fade = np.clip((t - spin_start) / 0.15, 0, 1) * np.clip((spin_end - t) / 0.08, 0, 1)
sig += spin * wob * env * fade
# contact clicks at each wobble peak
peaks = np.where((np.diff(np.mod(phase, 2 * np.pi)) < 0) & mask[1:])[0]
for p in peaks:
    cl = int(0.003 * SR)
    if p + cl < n:
        sig[p:p + cl] += 0.35 * rng.standard_normal(cl) * np.exp(-np.linspace(0, 5, cl))

# 3) settle: final clear ting that lands with the flip, ringing out
sig += ring(1.04, 1.1, 2.6, base=BASE * 1.06)
sig += ring(1.12, 0.45, 3.4, base=BASE * 1.06)

# gentle fades
sig[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
tail = int(0.45 * SR)

sig /= np.max(np.abs(sig))
# slow AGC (compressor) so the whole spin sits loud without hard clipping the tone
win = int(0.03 * SR)
rms = np.sqrt(np.convolve(sig ** 2, np.ones(win) / win, mode='same'))
rms = np.convolve(rms, np.ones(win) / win, mode='same')
g = 1.0 / np.maximum(rms, 0.02) ** 0.85
sig = sig * g
sig /= np.max(np.abs(sig))
# smooth fade-out: raised cosine over the last 0.45 s, exactly 0 at the end (no click)
sig[-tail:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, tail)))
drive = float(sys.argv[2]) if len(sys.argv) > 2 else 6.0
ceil = float(sys.argv[3]) if len(sys.argv) > 3 else 0.86
y = np.tanh(drive * sig) / np.tanh(drive)
y *= ceil
pcm = (np.clip(y, -1, 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('peaks', len(peaks))
