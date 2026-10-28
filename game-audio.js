/* Browser playback of original PCM and build-time rendered SMAF. No phone DSP runs here. */
(function(root){
 'use strict';
 const fingerprint=bytes=>{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return (h>>>0).toString(16).padStart(8,'0')+':'+bytes.length;};
 class GameAudio {
  constructor(){this.cache=new Map();this.active=new Set();this.muted=false;this.volume=1;this.playCount=0;}
  report(state){if(root.document)root.document.documentElement.dataset.audioState=state;}
  unlock(){
   try{if(!this.context){const Context=root.AudioContext||root.webkitAudioContext;if(!Context)throw Error('Web Audio 미지원');this.context=new Context();this.master=this.context.createGain();this.master.gain.value=this.muted?0:this.volume;this.master.connect(this.context.destination);}
    // Called synchronously from Start/Unmute, before any network await.
    const silent=this.context.createBufferSource();silent.buffer=this.context.createBuffer(1,1,this.context.sampleRate);silent.connect(this.master);silent.start();
    this.context.resume().then(()=>this.report(this.context.state)).catch(e=>this.error(e));
   }catch(e){this.error(e);}
  }
  error(error){this.report('error');console.warn('Game audio:',error);root.nomAudioError?.('사운드를 재생할 수 없습니다. 소리 버튼을 다시 눌러주세요.');}
  async prepare(slug){
   if(!['nom3','mini1','mini2','mini3'].includes(slug))return;
   const response=await fetch('audio-'+slug+'.json?v=20261029-audio1');if(!response.ok)throw Error('사운드 목록 다운로드 실패');
   const manifest=await response.json(),bank=await fetch(manifest.bank+'?v=20261029-audio1');if(!bank.ok)throw Error('사운드 파일 다운로드 실패');
   this.index=manifest.clips;this.bank=await bank.arrayBuffer();
  }
  create(bytes){const clip={key:fingerprint(bytes),bytes:this.index?null:Uint8Array.from(bytes),volume:1,generation:0,offset:0};clip.pause=()=>this.stop(clip);return clip;}
  async buffer(clip){
   if(this.cache.has(clip.key)){const value=this.cache.get(clip.key);this.cache.delete(clip.key);this.cache.set(clip.key,value);return value;}
   const entry=this.index?.[clip.key];let bytes;
   if(entry){if(entry.offset<0||entry.length<1||entry.offset+entry.length>this.bank.byteLength)throw Error('사운드 인덱스 범위 오류');bytes=this.bank.slice(entry.offset,entry.offset+entry.length);}
   else if(clip.bytes)bytes=clip.bytes.buffer.slice(clip.bytes.byteOffset,clip.bytes.byteOffset+clip.bytes.byteLength);
   else throw Error('복원되지 않은 사운드: '+clip.key);
   const promise=this.context.decodeAudioData(bytes);this.cache.set(clip.key,promise);
   // Limit retained decoded music on mobile; active sources own their playing buffers.
   while(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);
   try{return await promise;}catch(e){this.cache.delete(clip.key);throw e;}
  }
  async play(clip,loop=false,offset=0){
   if(!clip||!this.context)return;
   this.stop(clip);const generation=clip.generation;clip.loop=!!loop;clip.offset=offset;
   try{const buffer=await this.buffer(clip);if(generation!==clip.generation)return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=!!loop;gain.gain.value=clip.volume;source.connect(gain);gain.connect(this.master);
    clip.source=source;clip.gain=gain;clip.startedAt=this.context.currentTime;clip.duration=buffer.duration;
    source.onended=()=>{if(clip.source!==source)return;this.active.delete(clip);clip.source=null;source.disconnect();gain.disconnect();};
    this.active.add(clip);source.start(0,offset%buffer.duration);this.playCount++;
    if(root.document)root.document.documentElement.dataset.audioPlays=String(this.playCount);
    this.report(this.context.state);
   }catch(e){if(generation===clip.generation)this.error(e);}
  }
  stop(clip){if(!clip)return;clip.generation++;if(clip.source){const source=clip.source;clip.source=null;try{source.stop();}catch{}source.disconnect();clip.gain.disconnect();}this.active.delete(clip);clip.offset=0;}
  pause(clip){if(!clip)return;const offset=clip.offset+(clip.source?this.context.currentTime-clip.startedAt:0);this.stop(clip);clip.offset=offset;}
  resume(clip){if(clip)return this.play(clip,clip.loop,clip.offset);}
  setVolume(clip,percent){if(!clip)return;clip.volume=Math.max(0,Math.min(100,percent))/100;if(clip.gain)clip.gain.gain.value=clip.volume;}
  setMasterVolume(percent){this.volume=Math.max(0,Math.min(100,percent))/100;if(this.master)this.master.gain.value=this.muted?0:this.volume;}
  setMute(value){this.muted=!!value;if(this.master)this.master.gain.value=this.muted?0:this.volume;if(!this.muted)this.unlock();}
  stopAll(){for(const clip of [...this.active])this.stop(clip);}
 }
 root.GameAudio=GameAudio;root.arcadeAudio=new GameAudio();
 root.addEventListener?.('pagehide',()=>root.arcadeAudio.stopAll());
})(typeof window==='undefined'?globalThis:window);
