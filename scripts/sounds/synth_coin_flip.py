"""Synthesize the Outfit coin sound: one soft, smooth, pleasant "ting" (gentle coin chime).

Made in-house (no samples, no license). A single gentle strike, no second ting, no noise click:
  - a few low-ish inharmonic metallic partials (~1.25, 1.88, 2.46 kHz) with a slow shimmer
  - soft attack (~5 ms raised-cosine ramp, no click), smooth exponential decay (~0.5 s audible)
  - higher partials die faster, so the tail is rounded, not shrill
  - gentle one-pole low-pass (~4 kHz) after mixing
  - 0.6 s total, raised-cosine fade over the last 100 ms so it ends in true silence
Peak normalized to -6 dBFS (no clipping, no limiter). Mono 44.1 kHz 16-bit WAV.
Usage (needs numpy + ffmpeg):
  python3 scripts/sounds/synth_coin_flip.py /tmp/c.wav
  ffmpeg -y -i /tmp/c.wav -c:a libvorbis -q:a 3 -ar 44100 -ac 1 \
    android/app/src/main/res/raw/coin_flip.ogg
"""
import sys, wave
import numpy as np

SR = 44100
DUR = 0.6
PEAK_DBFS = -6.0
n = int(SR * DUR)
t = np.arange(n) / SR

# (frequency Hz, amplitude, decay time-constant s)
PARTIALS = [
    (1250.0, 1.00, 0.150),
    (1880.0, 0.45, 0.100),
    (2460.0, 0.22, 0.065),
]

x = np.zeros(n)
for f, a, tau in PARTIALS:
    # a very slow beat (+1.5 Hz twin) gives a soft metallic shimmer without harshness
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * (f + 1.5) * t)
    x += a * np.exp(-t / tau) * s

# soft ~5 ms raised-cosine attack (no click)
k = int(0.005 * SR)
x[:k] *= 0.5 * (1 - np.cos(np.linspace(0, np.pi, k)))

# gentle one-pole low-pass ~4 kHz (rounds off any edge)
fc = 4000.0
alpha = 1 - np.exp(-2 * np.pi * fc / SR)
y = np.zeros(n)
acc = 0.0
for i in range(n):
    acc += alpha * (x[i] - acc)
    y[i] = acc
x = y

# fade the last 100 ms to true silence
f = int(0.10 * SR)
x[-f:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, f)))
x[-1] = 0.0

x *= 10 ** (PEAK_DBFS / 20) / np.max(np.abs(x))
pcm = np.round(x * 32767).astype('<i2')

out = sys.argv[1] if len(sys.argv) > 1 else 'coin.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(out, 'peak dBFS', round(20 * np.log10(np.max(np.abs(pcm)) / 32767), 2), 'dur', DUR)
