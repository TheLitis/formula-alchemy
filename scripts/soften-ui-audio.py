#!/usr/bin/env python3
"""Replace ONLY the five bright UI sounds with dry CC0 wood/cloth taps.

The approved drop, collision, absorption, black-hole samples and site-owner's
music are preserved byte-for-byte. Normal npm builds use committed WAV files.
Maintainer use: python scripts/soften-ui-audio.py [--cache DIR]. Requires ffmpeg.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import math
import struct
import subprocess
import tempfile
import urllib.request
import wave
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip'
DIGEST = '029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8'
# file, original, retained duration, extra soft taps (delay, gain), target peak.
CHOICES = [
    ('click', 'impactWood_light_000.ogg', .14, [], -8),
    ('craft', 'impactWood_light_001.ogg', .16, [(.075, .5)], -7),
    ('discovery', 'impactWood_medium_001.ogg', .20, [(.09, .48), (.18, .24)], -7),
    ('remove', 'footstep_carpet_000.ogg', .17, [], -9),
    ('error', 'impactSoft_medium_001.ogg', .17, [(.14, .65)], -7),
]


def lowpass(samples: list[float], cutoff: float = 1800) -> list[float]:
    """Two cascaded Butterworth sections, no high-frequency resonant boost."""
    w = 2 * math.pi * cutoff / 44100
    co, si = math.cos(w), math.sin(w)
    alpha = si / math.sqrt(2)
    b0, b1, b2 = (1-co)/2/(1+alpha), (1-co)/(1+alpha), (1-co)/2/(1+alpha)
    a1, a2 = -2*co/(1+alpha), (1-alpha)/(1+alpha)
    for _ in range(2):
        result = []
        x1 = x2 = y1 = y2 = 0.
        for x in samples:
            y = b0*x+b1*x1+b2*x2-a1*y1-a2*y2
            result.append(y); x2, x1, y2, y1 = x1, x, y1, y
        samples = result
    return samples


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path)
    args = parser.parse_args()
    output = ROOT / 'public/audio'
    manifest = json.loads((output / 'credits.json').read_text())
    preserved = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in output.glob('*') if p.suffix in ['.wav','.mp3'] and p.stem not in {c[0] for c in CHOICES}}
    cache = args.cache / 'impact.zip' if args.cache else None
    if cache and cache.exists():
        archive_bytes = cache.read_bytes()
    else:
        with urllib.request.urlopen(URL, timeout=90) as response:
            archive_bytes = response.read(20_000_000)
    if hashlib.sha256(archive_bytes).hexdigest() != DIGEST:
        raise ValueError('Kenney archive has changed; review before changing the pin.')
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        for name, original, duration, taps, peak_db in CHOICES:
            source = archive.read('Audio/' + original)
            with tempfile.TemporaryDirectory() as temp:
                ogg = Path(temp) / 'source.ogg'; ogg.write_bytes(source)
                decoded = subprocess.check_output(['ffmpeg','-v','error','-i',str(ogg),'-ac','1','-ar','44100','-f','s16le','-'])
            samples = list(struct.unpack('<'+'h'*(len(decoded)//2), decoded))
            # Trim inaudible leading silence; retain the sample's attack and soften both ends.
            threshold = max(abs(v) for v in samples) * .005
            start = next((i for i,v in enumerate(samples) if abs(v) > threshold), 0)
            samples = samples[max(0,start-88):max(0,start-88)+round(duration*44100)]
            wave_data = lowpass([float(v) for v in samples])
            attack, fade = 176, 1544
            wave_data = [v*min(1,i/attack)*min(1,(len(wave_data)-1-i)/fade) for i,v in enumerate(wave_data)]
            mixed = [0.] * (len(wave_data) + round((max((t[0] for t in taps),default=0))*44100))
            for delay, gain in [(0,1),*taps]:
                at=round(delay*44100)
                for i,v in enumerate(wave_data): mixed[at+i] += gain*v
            peak=max(abs(v) for v in mixed)
            gain=32767*10**(peak_db/20)/peak
            pcm=[round(v*gain) for v in mixed]
            path = output / (name+'.wav')
            with wave.open(str(path),'wb') as f:
                f.setparams((1,2,44100,len(pcm),'NONE','not compressed'))
                f.writeframes(struct.pack('<'+'h'*len(pcm),*pcm))
            record=next(r for r in manifest['files'] if r['file']==path.name)
            record.update({'pack':'Impact Sounds','sourcePage':'https://kenney.nl/assets/impact-sounds','originalFile':'Audio/'+original,
                'sourceSHA256':hashlib.sha256(source).hexdigest(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                'durationSeconds':round(len(pcm)/44100,6),'peakDbFS':round(20*math.log10(max(abs(v) for v in pcm)/32768),2),
                'rmsDbFS':round(20*math.log10(math.sqrt(sum(v*v for v in pcm)/len(pcm))/32768),2),'bytes':path.stat().st_size,
                'processing':{'lowPassHz':1800,'filter':'two Butterworth biquads','attackMs':4,'fadeOutMs':35,'extraTaps':taps,'peakTargetDbFS':peak_db}})
    for name,digest in preserved.items():
        assert hashlib.sha256((output/name).read_bytes()).hexdigest()==digest, f'Approved audio changed: {name}'
    manifest['modifications']='Original OGG samples decoded to mono PCM WAV (44.1 kHz/16-bit). UI click/craft/discovery/remove/error use wood/cloth/soft impacts, low-pass at 1800 Hz, short fades, peaks -7 to -9 dBFS; some have quiet delayed taps. Drop, impacts, black hole, absorption and separately licensed site-owner music remain unchanged. Runtime gains are separate.'
    manifest['uiSoundRevision']=2
    (output/'credits.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Replaced five UI sounds; {len(preserved)} approved audio files preserved exactly.')

if __name__=='__main__': main()
