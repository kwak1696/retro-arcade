'use strict';
const $=s=>document.querySelector(s);let started=false,rotation=0,loadPromise,codePromise;
const selectedGame=new URLSearchParams(location.search).get('game')==='nom2'?'nom2':'nom';
const gameConfig=selectedGame==='nom2'?{name:'NOM 2',version:'1.0.42',script:'nom2.js',resources:'resources-nom2.json',width:320,height:240}:{name:'NOM',version:'1.0.25',script:'nom.js',resources:'resources.json',width:176,height:208};
document.documentElement.dataset.game=selectedGame;
window.nomHost.storagePrefix=selectedGame==='nom2'?'nom2-native:':'nom-native:';
$('#game-select').value=selectedGame;
$('#game-select').addEventListener('change',event=>{const url=new URL(location.href);url.searchParams.set('game',event.target.value);location.assign(url.href);});
$('#game').width=gameConfig.width;$('#game').height=gameConfig.height;
document.documentElement.style.setProperty('--game-ratio',`${gameConfig.width} / ${gameConfig.height}`);
document.documentElement.style.setProperty('--game-fit-height',`${gameConfig.width/gameConfig.height*100}dvh`);
document.documentElement.style.setProperty('--game-fit-width',`${gameConfig.width/gameConfig.height*100}vw`);
$('#game-name').textContent=gameConfig.name;$('.game-label>span').textContent=selectedGame==='nom2'?'놈투 · FREE RUNNER':'놈 · ORIGINAL JAVA EDITION';$('.archive-tag').textContent=selectedGame==='nom2'?'GAMEVIL / NOM 2':'GAMEVIL / 2003';$('#overlay-name').firstChild.textContent=gameConfig.name;$('#game-version').textContent=gameConfig.version+' · 해외판';$('#screen-resolution').textContent=`${gameConfig.width} × ${gameConfig.height}`;$('#screen-version').textContent=gameConfig.name+' · '+gameConfig.version;
document.title=gameConfig.name+' — Pocket Arcade';
window.nomError=message=>{document.querySelector('#status').textContent='● LOAD ERROR';toast(message);};
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4000);}
function loadResources(){return loadPromise??=fetch(gameConfig.resources).then(r=>{if(!r.ok)throw Error('리소스를 불러올 수 없습니다.');return r.json();}).then(data=>{window.nomHost.resources=data;window.nomHost.properties=data.__properties||{};});}
function loadGameCode(){return codePromise??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=gameConfig.script;script.onload=resolve;script.onerror=()=>reject(Error('게임 코드를 불러오지 못했습니다.'));document.head.append(script);});}
async function start(){if(started)return;const button=$('#start');button.disabled=true;button.innerHTML='게임 불러오는 중… <span>↗</span>';$('#loading-copy').textContent='오리지널 게임을 준비하고 있습니다';$('#status').textContent='● LOADING';try{await Promise.all([loadResources(),loadGameCode()]);if(typeof main!=='function')throw Error('게임 스크립트를 불러오지 못했습니다.');started=true;$('#start-overlay').classList.add('hidden');$('#game').focus({preventScroll:true});main([],error=>{if(error){console.error(error);window.nomError('게임 실행 오류: '+(error.message||error));}});$('#status').textContent='● NOW PLAYING';$('#engine-indicator').textContent='JAVASCRIPT';}catch(error){started=false;button.disabled=false;button.innerHTML='다시 시작 ↗';$('#loading-copy').textContent=error.message;window.nomError(error.message);}}
$('#start').addEventListener('click',start);
function input(key,down){if(!started){if(down)toast('게임 시작 버튼을 먼저 눌러주세요.');return;}const mapped=selectedGame==='nom2'?({50:-1,56:-2,52:-3,54:-4,53:-5}[key]??key):key;window.nomHost.key?.(mapped,down);}
const gameScreen=$('#game');let screenPointer=null;
function releaseScreenPointer(){if(screenPointer===null)return;screenPointer=null;input(53,false);}
gameScreen.addEventListener('pointerdown',event=>{
 if(!started||screenPointer!==null||!event.isPrimary||event.button!==0)return;
 event.preventDefault();screenPointer=event.pointerId;
 gameScreen.setPointerCapture(event.pointerId);
 gameScreen.focus({preventScroll:true});input(53,true);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])gameScreen.addEventListener(event,e=>{if(e.pointerId===screenPointer)releaseScreenPointer();});
window.addEventListener('blur',releaseScreenPointer);
const keymap={ArrowUp:50,ArrowDown:56,ArrowLeft:52,ArrowRight:54,Enter:53,' ':53,Escape:-7,F1:-6,F2:-7};const pressed=new Set();
window.addEventListener('keydown',e=>{if(!started||e.ctrlKey||e.metaKey||e.altKey)return;const key=keymap[e.key]??(/^[0-9]$/.test(e.key)?e.key.charCodeAt(0):e.key==='*'?42:e.key==='#'?35:undefined);if(key===undefined)return;e.preventDefault();if(pressed.has(key))return;pressed.add(key);input(key,true);document.querySelectorAll(`[data-key="${key}"]`).forEach(b=>b.classList.add('pressed'));});
window.addEventListener('keyup',e=>{const key=keymap[e.key]??(/^[0-9]$/.test(e.key)?e.key.charCodeAt(0):undefined);if(key===undefined)return;pressed.delete(key);input(key,false);document.querySelectorAll(`[data-key="${key}"]`).forEach(b=>b.classList.remove('pressed'));});
window.addEventListener('blur',()=>{for(const key of pressed)input(key,false);pressed.clear();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));});
document.querySelectorAll('[data-key]').forEach(button=>{const key=Number(button.dataset.key);button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);input(key,true);button.classList.add('pressed');});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{input(key,false);button.classList.remove('pressed');});});
$('#rotate').addEventListener('click',()=>{rotation=(rotation+90)%360;$('#play-stage').dataset.rotated=String(rotation%180!==0);$('#screen-shell').style.transform=`rotate(${rotation}deg)`;toast(`화면 ${rotation}° 회전`);});
$('#mute').addEventListener('click',()=>{const muted=!window.nomHost.muted;window.nomHost.setMute(muted);$('#mute').textContent=muted?'♩':'♪';$('#mute').setAttribute('aria-label',muted?'소리 켜기':'음소거');$('#mute').setAttribute('aria-pressed',String(muted));toast(muted?'소리를 껐습니다':'소리를 켰습니다');});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#play-stage').requestFullscreen)await $('#play-stage').requestFullscreen();else toast('이 브라우저는 전체 화면을 지원하지 않습니다.');}catch{toast('전체 화면을 열 수 없습니다.');}});
$('#restart').addEventListener('click',()=>location.reload());
window.addEventListener('error',event=>{if(started)window.nomError('게임 실행 중 오류가 발생했습니다. 페이지를 다시 열어주세요.');console.error(event.error);});
loadResources().catch(()=>{});

