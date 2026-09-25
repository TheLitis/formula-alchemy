#!/usr/bin/env python3
"""Maintainer tool: import a small, pinned CC0 sound bank from Kenney's own site.

Normal npm builds use the committed WAV files and never download third-party audio.
Requires Python 3 and ffmpeg. Usage: python scripts/import-cc0-audio.py [--cache DIR]
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
PACKS = {
    "interface": ("Interface Sounds", "https://kenney.nl/assets/interface-sounds", "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip", "f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232"),
    "impact": ("Impact Sounds", "https://kenney.nl/assets/impact-sounds", "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip", "029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8"),
    "scifi": ("Sci-fi Sounds", "https://kenney.nl/assets/sci-fi-sounds", "https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip", "119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04"),
}
SOUNDS = [
    ("click", "interface", "click_001.ogg", "Выбор / кнопки"),
    ("drop", "interface", "drop_001.ogg", "Размещение тела / буквы"),
    ("craft", "interface", "confirmation_003.ogg", "Соединение / повтор рецепта"),
    ("discovery", "interface", "confirmation_004.ogg", "Новое открытие"),
    ("remove", "interface", "minimize_001.ogg", "Удаление / очистка"),
    ("error", "interface", "error_001.ogg", "Недопустимое действие"),
    ("impact-soft", "impact", "impactSoft_medium_000.ogg", "Мягкое столкновение"),
    ("impact-hard", "impact", "impactGeneric_light_000.ogg", "Более сильное столкновение"),
    ("absorb", "scifi", "forceField_000.ogg", "Поглощение чёрной дырой"),
    ("blackhole", "scifi", "lowFrequency_explosion_000.ogg", "Рождение чёрной дыры"),
]

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, help="Directory with interface.zip, impact.zip and scifi.zip")
    args = parser.parse_args()
    out = ROOT / "public/audio"
    out.mkdir(parents=True, exist_ok=True)
    archives: dict[str, zipfile.ZipFile] = {}
    for key, (title, page, url, digest) in PACKS.items():
        path = args.cache / f"{key}.zip" if args.cache else None
        if path and path.exists():
            data = path.read_bytes()
        else:
            with urllib.request.urlopen(url, timeout=90) as response:
                data = response.read(20_000_000)
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError(f"The {title} archive changed; review its license and update the pin deliberately.")
        archives[key] = zipfile.ZipFile(io.BytesIO(data))
        license_name = next(p for p in archives[key].namelist() if p.lower().endswith("license.txt"))
        (out / f"LICENSE-{key}.txt").write_bytes(archives[key].read(license_name))
    records = []
    for name, pack, original, purpose in SOUNDS:
        archive = archives[pack]
        entry = next(p for p in archive.namelist() if p.endswith("/" + original))
        source = archive.read(entry)
        with tempfile.TemporaryDirectory() as temp:
            ogg, wav = Path(temp) / "source.ogg", Path(temp) / "decoded.wav"
            ogg.write_bytes(source)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ogg), "-vn", "-map_metadata", "-1", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", "-bitexact", str(wav)], check=True)
            with wave.open(str(wav), "rb") as f:
                count = f.getnframes()
                samples = list(struct.unpack("<" + "h" * count, f.readframes(count)))
        peak = max(abs(v) for v in samples)
        if peak < 50:
            raise ValueError(f"{original}: unexpectedly quiet input")
        # Peak-match to -3 dBFS without boosting noise more than 4x. No lossy re-encoding.
        gain = min(4.0, (32767 * 10 ** (-3 / 20)) / peak)
        samples = [round(v * gain) for v in samples]
        output = out / (name + ".wav")
        with wave.open(str(output), "wb") as f:
            f.setparams((1, 2, 44100, len(samples), "NONE", "not compressed"))
            f.writeframes(struct.pack("<" + "h" * len(samples), *samples))
        records.append({"file": output.name, "purpose": purpose, "author": "Kenney", "license": "CC0-1.0", "pack": PACKS[pack][0], "sourcePage": PACKS[pack][1], "originalFile": entry, "sourceSHA256": hashlib.sha256(source).hexdigest(), "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "durationSeconds": round(len(samples) / 44100, 6), "peakDbFS": round(20 * math.log10(max(abs(v) for v in samples) / 32768), 2), "rmsDbFS": round(20 * math.log10(math.sqrt(sum(v*v for v in samples)/len(samples)) / 32768), 2), "bytes": output.stat().st_size})
    manifest = {"version": 1, "license": "CC0-1.0", "licenseURL": "https://creativecommons.org/publicdomain/zero/1.0/", "modifications": "Original OGG decoded to mono PCM WAV, 44.1 kHz, 16-bit; peak matched to -3 dBFS (gain capped at 4x). Runtime event gains are separate. No content generated or purchased.", "packs": [{"name": p[0], "page": p[1], "download": p[2], "sha256": p[3]} for p in PACKS.values()], "files": records}
    (out / "credits.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for archive in archives.values():
        archive.close()
    print(f"Imported {len(records)} CC0 samples, {sum(r['bytes'] for r in records):,} bytes, all peak ≤ -3 dBFS.")

if __name__ == "__main__":
    main()
