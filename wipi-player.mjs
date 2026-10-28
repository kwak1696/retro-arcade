import {WipiRuntime} from './wipi-runtime.mjs';
async function unpack(url){const response=await fetch(url);if(!response.ok)throw Error('게임 파일을 불러올 수 없습니다.');return new Response(response.body.pipeThrough(new DecompressionStream('gzip')));}
export async function startWipi(slug,canvas,onError){
 const [seed,code]=await Promise.all([unpack(`wipi-${slug}-seed.json.gz`).then(r=>r.json()),unpack(`wipi-${slug}-code.mjs.gz`).then(r=>r.text())]);
 const blob=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));let install;
 try{({default:install}=await import(blob));}finally{URL.revokeObjectURL(blob);}
 const ctx=canvas.getContext('2d'),frame=ctx.createImageData(seed.width,seed.height);
 const Runtime=slug==='nom3'?(await import('./wipi-lgt-runtime.mjs')).LgtRuntime:WipiRuntime;
 const runtime=new Runtime(seed,{storage:localStorage,present:(fb,data)=>{
  const rgba=frame.data;
  for(let y=0;y<fb.h;y++)for(let x=0;x<fb.w;x++){const i=y*fb.stride+x*2,p=data[i]|data[i+1]<<8,j=(y*fb.w+x)*4;rgba[j]=((p>>>11)&31)*255/31;rgba[j+1]=((p>>>5)&63)*255/63;rgba[j+2]=(p&31)*255/31;rgba[j+3]=255;}
  ctx.putImageData(frame,0,0);window.nomHost.frames++;
 }});
 runtime.presentRGBA=image=>{frame.data.set(image.data);ctx.putImageData(frame,0,0);window.nomHost.frames++;};
 install(runtime);if(slug==='nom3'){runtime.initialize();runtime.start();}else{runtime.call(seed.start,[0,0]);runtime.call(seed.paint,[0,0,seed.width,seed.height]);}
 let running=true,last=performance.now(),gameTime=runtime.time;
 window.nomHost.key=(key,down)=>{try{if(slug==='nom3')runtime.call(runtime.u32(runtime.u32(runtime.card)+26*4),[runtime.card,down?1:2,key>>>0]);else runtime.call(seed.input,[down?2:3,key>>>0,0]);}catch(error){running=false;onError(error);}};
 function loop(now){if(!running)return;const elapsed=Math.min(now-last,100);last=now;gameTime+=elapsed;try{if(slug==='nom3'){runtime.repaintRequested=true;runtime.advance(Math.floor(gameTime));}else runtime.tick(Math.floor(gameTime));requestAnimationFrame(loop);}catch(error){running=false;onError(error);}}
 requestAnimationFrame(loop);
 window.addEventListener('pagehide',()=>{running=false;},{once:true});
 return runtime;
}
