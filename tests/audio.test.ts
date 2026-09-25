import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AudioEngine } from '../src/audio/AudioEngine';
import { MAX_SFX_VOICES, SOUND_IDS, SOUNDS } from '../src/audio/sounds';

class Param { value=0; setValueAtTime(v:number){this.value=v;} linearRampToValueAtTime(v:number){this.value=v;} exponentialRampToValueAtTime(v:number){this.value=v;} setTargetAtTime(v:number){this.value=v;} }
class Node { connect(){} disconnect(){} }
class Source extends Node { buffer:unknown=null; onended:(()=>void)|null=null; started=false; stopped=false; start(){this.started=true;} stop(){this.stopped=true;this.onended?.();} }
class Context {
    static latest:Context;
    state='suspended';currentTime=0;destination=new Node();sources:Source[]=[];
    constructor(){Context.latest=this;}
    createGain(){return Object.assign(new Node(),{gain:new Param()});}
    createDynamicsCompressor(){return Object.assign(new Node(),{threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param()});}
    createStereoPanner(){return Object.assign(new Node(),{pan:new Param()});}
    createBufferSource(){const s=new Source();this.sources.push(s);return s;}
    createOscillator(){return Object.assign(new Source(),{frequency:new Param(),type:'sine'});}
    async decodeAudioData(){return {duration:.5};}
    async resume(){this.state='running';}
    async suspend(){this.state='suspended';}
    async close(){this.state='closed';}
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
let now=1000;let engines:AudioEngine[]=[];
function engine(){const a=new AudioEngine('/formula-alchemy/');engines.push(a);return a;}
beforeEach(()=>{
    now=1000;vi.spyOn(performance,'now').mockImplementation(()=>now);
    vi.stubGlobal('AudioContext',Context);
    vi.stubGlobal('document',Object.assign(new EventTarget(),{hidden:false}));
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)})));
});
afterEach(()=>{for(const a of engines)a.dispose();engines=[];vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('bundled sampled sound lifecycle',()=>{
    it('does not fetch or initialize audio until an intentional unlock',async()=>{
        const a=engine();a.click();a.discovery();a.impact();await flush();
        expect(a.status().state).toBe('locked');expect(fetch).not.toHaveBeenCalled();
    });
    it('fetches/decodes each sample once, from the Pages base directory, with no hotlinks',async()=>{
        const a=engine();await Promise.all([a.unlock(),a.unlock()]);
        expect(fetch).toHaveBeenCalledTimes(SOUND_IDS.length);expect(a.status().loaded).toHaveLength(SOUND_IDS.length);
        for(const [url] of vi.mocked(fetch).mock.calls)expect(String(url)).toMatch(/^\/formula-alchemy\/audio\/[a-z-]+\.wav$/);
        a.click();await flush();now+=100;a.click();await flush();
        expect(a.status().played.click).toBe(2);expect(fetch).toHaveBeenCalledTimes(SOUND_IDS.length);
    });
    it('mute stops active effects immediately without stopping optional music',async()=>{
        const a=engine();await a.unlock();a.setMusic(true);a.blackhole();await flush();
        expect(a.status().activeEffects).toBe(1);expect(a.status().activeNotes).toBeGreaterThan(0);
        a.sound=false;expect(a.status().activeEffects).toBe(0);expect(a.music).toBe(true);
        expect(Context.latest.sources.every(s=>s.stopped)).toBe(true);
        a.click();await flush();expect(a.status().played.click).toBeUndefined();
        a.setMusic(false);expect(a.status().activeNotes).toBe(0);
    });
    it('does not replay an effect that was loading when the user muted and unmuted',async()=>{
        let resolve!:(v:{ok:boolean;arrayBuffer:()=>Promise<ArrayBuffer>})=>void;
        const response=new Promise<{ok:boolean;arrayBuffer:()=>Promise<ArrayBuffer>}>(r=>{resolve=r;});
        vi.stubGlobal('fetch',vi.fn(()=>response));
        const a=engine(),ready=a.unlock();a.discovery();a.sound=false;a.sound=true;
        resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)});await ready;await flush();
        expect(a.status().played.discovery).toBeUndefined();
        now+=500;a.discovery();await flush();expect(a.status().played.discovery).toBe(1);
    });
    it('discards stale first-gesture sounds instead of playing a delayed burst',async()=>{
        const decode=vi.spyOn(Context.prototype,'decodeAudioData');
        let resolve!:(b:{duration:number})=>void;const pending=new Promise<{duration:number}>(r=>{resolve=r;});decode.mockImplementation(()=>pending);
        const a=engine(),ready=a.unlock();a.click();await flush();now+=2000;resolve({duration:.5});await ready;await flush();
        expect(a.status().played.click).toBeUndefined();
    });
    it('throttles shared collision channels and caps simultaneous voices',async()=>{
        const a=engine();await a.unlock();
        for(let i=0;i<30;i++){a.impact(i,500);await flush();}
        expect((a.status().played.impactSoft??0)+(a.status().played.impactHard??0)).toBe(1);
        for(let i=0;i<20;i++){now+=120;a.click();await flush();}
        expect(a.status().activeEffects).toBe(MAX_SFX_VOICES);
    });
    it('warns once on missing assets, consumes failed promises and keeps silent',async()=>{
        vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:404})));
        const a=engine(),error=vi.fn();a.onError=error;await a.unlock();a.click();await flush();
        expect(a.status().failed).toHaveLength(SOUND_IDS.length);expect(error).toHaveBeenCalledTimes(1);expect(a.status().activeEffects).toBe(0);
    });
    it('background tabs suspend audio; foreground resumes without old sound events',async()=>{
        const a=engine();await a.unlock();a.blackhole();await flush();
        Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));
        expect(a.status().state).toBe('suspended');expect(a.status().activeEffects).toBe(0);a.click();await flush();
        Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));await flush();
        expect(a.status().state).toBe('running');expect(a.status().played.click).toBeUndefined();
    });
    it('disposing pending/active audio is safe and makes future calls no-ops',async()=>{
        const a=engine();await a.unlock();a.blackhole();await flush();a.dispose();a.click();await a.unlock();
        expect(a.status().state).toBe('locked');expect(a.status().activeEffects).toBe(0);expect(Context.latest.state).toBe('closed');
    });
});

describe('real authored audio files and licenses',()=>{
    const manifest=JSON.parse(readFileSync(new URL('../public/audio/credits.json',import.meta.url),'utf8'));
    it('every selected event points to a bundled, non-silent, peak-matched WAV',()=>{
        for(const id of SOUND_IDS){
            const def=SOUNDS[id],path=new URL(`../public/audio/${def.file}`,import.meta.url),file=readFileSync(path);
            expect(file.toString('ascii',0,4)).toBe('RIFF');expect(file.toString('ascii',8,12)).toBe('WAVE');
            expect(file.readUInt32LE(24)).toBe(44100);expect(file.readUInt16LE(34)).toBe(16);
            let peak=0,sum=0;for(let i=44;i+1<file.length;i+=2){const value=file.readInt16LE(i);peak=Math.max(peak,Math.abs(value));sum+=value*value;}
            expect(peak).toBeGreaterThan(500);expect(peak).toBeLessThan(23210);expect(sum).toBeGreaterThan(0);
            const credit=manifest.files.find((v:{file:string})=>v.file===def.file);
            expect(credit.author).toBe('Kenney');expect(credit.license).toBe('CC0-1.0');
            expect(createHash('sha256').update(file).digest('hex')).toBe(credit.sha256);
        }
    });
    it('includes original license texts from all three packs and small self-hosted payload',()=>{
        expect(manifest.files.reduce((n:number,f:{bytes:number})=>n+f.bytes,0)).toBeLessThan(500000);
        for(const pack of ['interface','impact','scifi'])expect(readFileSync(new URL(`../public/audio/LICENSE-${pack}.txt`,import.meta.url),'utf8')).toContain('CC0');
    });
});
