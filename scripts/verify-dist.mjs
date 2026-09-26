/** Check that Vite emitted relative, local HTML/CSS resources before deployment. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
let checked = 0;
async function check(ref, from) {
    if (ref.startsWith('data:') || ref.startsWith('#'))
        return;
    if (/^(?:[a-z]+:|\/)/i.test(ref))
        throw new Error(`Non-relative asset in ${from}: ${ref}`);
    const file = path.resolve(path.dirname(from), decodeURIComponent(ref.split(/[?#]/)[0]));
    if (!file.startsWith(root + path.sep))
        throw new Error(`Asset escapes dist: ${ref}`);
    await fs.access(file);
    checked++;
}
const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g))
    await check(match[1], path.join(root, 'index.html'));
async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory())
            await walk(file);
        else if (item.name.endsWith('.css'))
            for (const match of (await fs.readFile(file, 'utf8')).matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g))
                await check(match[1], file);
    }
}
await walk(root);
console.log(`Production asset paths verified: ${checked} local HTML/CSS references.`);

const credits = JSON.parse(await fs.readFile(path.join(root, 'audio/credits.json'), 'utf8'));
if (credits.files.length !== 10) throw new Error('Incomplete CC0 sound bank');
for (const audio of credits.files) {
    if (!/^[a-z-]+\.wav$/.test(audio.file)) throw new Error('Unsafe audio filename');
    const bytes = await fs.readFile(path.join(root, 'audio', audio.file));
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || createHash('sha256').update(bytes).digest('hex') !== audio.sha256)
        throw new Error(`Corrupt or missing audio: ${audio.file}`);
}
console.log(`Bundled CC0 sound paths and hashes verified: ${credits.files.length} WAV files.`);

if (!credits.music || credits.music.file !== 'sky-high.mp3' || !/^[a-z0-9-]+\.mp3$/.test(credits.music.file))
    throw new Error('Missing or unsafe bundled music record');
const music = await fs.readFile(path.join(root, 'audio', credits.music.file));
if (music.length !== credits.music.bytes || createHash('sha256').update(music).digest('hex') !== credits.music.sha256)
    throw new Error(`Corrupt or missing music: ${credits.music.file}`);
console.log(`Bundled music path and hash verified: ${credits.music.file}.`);
