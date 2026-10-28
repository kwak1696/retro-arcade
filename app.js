'use strict';
const $=s=>document.querySelector(s);let started=false,rotation=0,loadPromise,codePromise;
const games={
 nom:{name:'NOM',version:'1.0.25',script:'nom.js',resources:'resources.json',width:176,height:208,label:'놈 · ORIGINAL JAVA EDITION'},
 nom3:{name:'NOM 3 · 놈 3',version:'1.0.1',wipi:true,width:240,height:320,label:'국내 WIPI판 · 베타'},
 nom2:{name:'NOM 2',version:'1.0.42',script:'nom2.js',resources:'resources-nom2.json',width:320,height:240,label:'놈투 · FREE RUNNER'},
 mini1:{name:'미니게임천국 1',version:'2.0.3',wipi:true,width:176,height:220,label:'국내 WIPI판 · 베타'},
 mini2:{name:'미니게임천국 2',version:'1.0.1',wipi:true,width:176,height:220,label:'국내 WIPI판 · 베타'},
 mini3:{name:'미니게임천국 3',version:'1.0.2',wipi:true,width:240,height:320,label:'국내 WIPI판 · 베타'}
};
const requestedGame=new URLSearchParams(location.search).get('game');
const selectedGame=Object.hasOwn(games,requestedGame)?requestedGame:'nom';
const gameConfig=games[selectedGame];
document.documentElement.dataset.game=selectedGame;
window.nomHost.storagePrefix=selectedGame==='nom2'?'nom2-native:':'nom-native:';
$('#game-select').value=selectedGame;
$('#game-select').addEventListener('change',event=>{const url=new URL(location.href);url.searchParams.set('game',event.target.value);location.assign(url.href);});
$('#game').width=gameConfig.width;$('#game').height=gameConfig.height;
document.documentElement.style.setProperty('--game-ratio',`${gameConfig.width} / ${gameConfig.height}`);
document.documentElement.style.setProperty('--game-fit-height',`${gameConfig.width/gameConfig.height*100}dvh`);
document.documentElement.style.setProperty('--game-fit-width',`${gameConfig.width/gameConfig.height*100}vw`);
$('#game-name').textContent=gameConfig.name;$('.game-label>span').textContent=gameConfig.label;$('#overlay-name').firstChild.textContent=gameConfig.name;$('#screen-resolution').textContent=`${gameConfig.width} × ${gameConfig.height}`;$('#screen-version').textContent=gameConfig.name+' · '+gameConfig.version;
document.title=gameConfig.name+' — Pocket Arcade';
window.nomError=message=>{document.querySelector('#status').textContent='● LOAD ERROR';toast(message);};
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4000);}
function loadResources(){if(gameConfig.wipi)return Promise.resolve();return loadPromise??=fetch(gameConfig.resources).then(r=>{if(!r.ok)throw Error('리소스를 불러올 수 없습니다.');return r.json();}).then(data=>{window.nomHost.resources=data;window.nomHost.properties=data.__properties||{};});}
function loadGameCode(){if(gameConfig.wipi)return codePromise??=import('./wipi-player.mjs?v=20261029-nom3-fix1');return codePromise??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=gameConfig.script;script.onload=resolve;script.onerror=()=>reject(Error('게임 코드를 불러오지 못했습니다.'));document.head.append(script);});}
async function start(){if(started)return;const button=$('#start');button.disabled=true;button.innerHTML='게임 불러오는 중… <span>↗</span>';$('#loading-copy').textContent='오리지널 게임을 준비하고 있습니다';$('#status').textContent='● LOADING';try{await Promise.all([loadResources(),loadGameCode()]);if(gameConfig.wipi){const player=await loadGameCode();await player.startWipi(selectedGame,$('#game'),error=>{console.error(error);window.nomError('게임 실행 오류: '+error.message);});}else if(typeof main!=='function')throw Error('게임 스크립트를 불러오지 못했습니다.');started=true;$('#start-overlay').classList.add('hidden');$('#game').focus({preventScroll:true});if(!gameConfig.wipi)main([],error=>{if(error){console.error(error);window.nomError('게임 실행 오류: '+(error.message||error));}});$('#status').textContent='● NOW PLAYING';$('#engine-indicator').textContent='JAVASCRIPT';}catch(error){started=false;button.disabled=false;button.innerHTML='다시 시작 ↗';$('#loading-copy').textContent=error.message;window.nomError(error.message);}}
if(gameConfig.wipi){
 document.documentElement.dataset.wipi='true';
 $('#game').setAttribute('aria-label',gameConfig.name+' 게임 화면. 방향키로 이동, Enter 또는 Space로 확인');
 $('.overlay-overline').textContent='MINIGAME COLLECTION';
 $('.start-overlay p').textContent='짧게 즐기는 추억의 미니게임.';
 $('#loading-copy').textContent='베타 · 현재 사운드 미지원';
 $('.control-panel h2').textContent='추억의 미니게임을 다시.';
 $('.control-copy').textContent='방향키로 게임을 선택하고 OK로 시작하세요. 베타 버전으로 일부 기능과 사운드는 지원하지 않습니다.';
 $('.touch-caption').textContent='플레이 화면 터치 / 클릭으로도 확인';
 $('.action-key span').textContent='OK';$('.action-key b').textContent='5';
 $('.keyboard-hint').lastChild.textContent=' 확인 / 액션';
 $('#mute').disabled=true;$('#mute').title='이 게임은 현재 사운드를 지원하지 않습니다';
}
if(selectedGame==='nom3'){$('.overlay-overline').textContent='ONE-BUTTON RUNNER';$('.start-overlay p').textContent='돌리고, 뛰고, 다시 달리고.';$('.control-panel h2').textContent='돌리고, 뛰고, 다시 달리고.';$('.control-copy').textContent='장애물 앞에서 타이밍에 맞춰 점프하세요. 화면 터치 또는 OK로 확인하고 점프합니다. 베타 버전으로 현재 사운드는 지원하지 않습니다.';}
$('#start').addEventListener('click',start);
function input(key,down,raw=false){if(!started){if(down)toast('게임 시작 버튼을 먼저 눌러주세요.');return;}const mapped=(gameConfig.wipi&&selectedGame!=='nom3')?(raw?key:({50:-1,56:-2,52:-3,54:-4}[key]??key)):(selectedGame==='nom2'||gameConfig.wipi)?({50:-1,56:-2,52:-3,54:-4,53:-5}[key]??key):key;window.nomHost.key?.(mapped,down);}
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
const keymap=(gameConfig.wipi&&selectedGame!=='nom3')?{ArrowUp:-1,ArrowDown:-2,ArrowLeft:-3,ArrowRight:-4,Enter:-5,' ':53,Escape:-7,F1:-6,F2:-7}:{ArrowUp:50,ArrowDown:56,ArrowLeft:52,ArrowRight:54,Enter:53,' ':53,Escape:-7,F1:-6,F2:-7};const pressed=new Set();
window.addEventListener('keydown',e=>{if(!started||e.ctrlKey||e.metaKey||e.altKey)return;const key=keymap[e.key]??(/^[0-9]$/.test(e.key)?e.key.charCodeAt(0):e.key==='*'?42:e.key==='#'?35:undefined);if(key===undefined)return;e.preventDefault();if(pressed.has(key))return;pressed.add(key);input(key,true,true);document.querySelectorAll(`[data-key="${key}"]`).forEach(b=>b.classList.add('pressed'));});
window.addEventListener('keyup',e=>{const key=keymap[e.key]??(/^[0-9]$/.test(e.key)?e.key.charCodeAt(0):undefined);if(key===undefined)return;pressed.delete(key);input(key,false,true);document.querySelectorAll(`[data-key="${key}"]`).forEach(b=>b.classList.remove('pressed'));});
window.addEventListener('blur',()=>{for(const key of pressed)input(key,false,true);pressed.clear();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));});
// Fullscreen controls stay in letterbox space, outside the rotating display.
const stage=$('#play-stage');
const fullscreenPad=document.createElement('div');fullscreenPad.className='fullscreen-pad hidden';fullscreenPad.setAttribute('aria-label','전체 화면 방향키');
fullscreenPad.innerHTML='<div class="dpad"><button data-key="50" class="up" aria-label="위">↑</button><button data-key="52" class="left" aria-label="왼쪽">←</button><span class="dpad-center" aria-hidden="true">✦</span><button data-key="54" class="right" aria-label="오른쪽">→</button><button data-key="56" class="down" aria-label="아래">↓</button></div>';
const fullscreenOK=document.createElement('button');fullscreenOK.className='fullscreen-ok hidden';fullscreenOK.dataset.key=gameConfig.wipi?'-5':'53';fullscreenOK.textContent='OK';fullscreenOK.setAttribute('aria-label','확인 / 점프');stage.append(fullscreenPad,fullscreenOK);
function releaseTouchButtons(){document.querySelectorAll('[data-key].pressed').forEach(button=>{input(Number(button.dataset.key),false);button.classList.remove('pressed');});}
function letterboxControls(width,height,screen){
 const gap=16,pad=156,ok=64;
 const {left,right,top,bottom}=screen;
 const bars=[{x:0,y:0,w:Math.max(0,left),h:height},{x:right,y:0,w:Math.max(0,width-right),h:height},{x:0,y:0,w:width,h:Math.max(0,top)},{x:0,y:bottom,w:width,h:Math.max(0,height-bottom)}];
 const fits=(r,w,h)=>r.w>=w+gap*2&&r.h>=h+gap*2;
 if(fits(bars[0],pad,pad)&&fits(bars[1],ok,ok))return [[(left-pad)/2,(height-pad)/2],[right+(width-right-ok)/2,(height-ok)/2]];
 const bar=[bars[3],bars[2],bars[0],bars[1]].find(r=>fits(r,pad+ok+gap,pad));
 if(!bar)return null;
 const x=bar.x+(bar.w-pad-ok-gap)/2,y=bar.y+(bar.h-pad)/2;
 return [[x,y],[x+pad+gap,y+(pad-ok)/2]];
}
function layoutFullscreenControls(){
 releaseTouchButtons();fullscreenPad.classList.add('hidden');fullscreenOK.classList.add('hidden');
 if(document.fullscreenElement!==stage)return;
 const outer=stage.getBoundingClientRect(),screen=gameScreen.getBoundingClientRect();
 const positions=letterboxControls(outer.width,outer.height,{left:screen.left-outer.left,right:screen.right-outer.left,top:screen.top-outer.top,bottom:screen.bottom-outer.top});
 if(!positions)return;
 [fullscreenPad,fullscreenOK].forEach((el,i)=>{el.style.left=`${positions[i][0]}px`;el.style.top=`${positions[i][1]}px`;el.classList.remove('hidden');});
}
// Observe the display too: rotating it can change the available bars.
document.addEventListener('fullscreenchange',layoutFullscreenControls);
new ResizeObserver(layoutFullscreenControls).observe(stage);
new ResizeObserver(layoutFullscreenControls).observe(gameScreen);
window.addEventListener('blur',releaseTouchButtons);
if(gameConfig.wipi&&selectedGame!=='nom3'){const ok=document.createElement('button');ok.dataset.key='-5';ok.textContent='확인 / OK';$('.soft-keys').append(ok);$('.action-key span').textContent='ACTION';}
document.querySelectorAll('[data-key]').forEach(button=>{const key=Number(button.dataset.key);let pointer=null;button.addEventListener('pointerdown',e=>{if(e.button!==0||pointer!==null)return;e.preventDefault();pointer=e.pointerId;button.setPointerCapture(e.pointerId);input(key,true);button.classList.add('pressed');});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(e.pointerId!==pointer)return;pointer=null;input(key,false);button.classList.remove('pressed');});});
$('#rotate').addEventListener('click',()=>{rotation=(rotation+90)%360;$('#play-stage').dataset.rotated=String(rotation%180!==0);$('#screen-shell').style.transform=`rotate(${rotation}deg)`;requestAnimationFrame(layoutFullscreenControls);toast(`화면 ${rotation}° 회전`);});
$('#mute').addEventListener('click',()=>{const muted=!window.nomHost.muted;window.nomHost.setMute(muted);$('#mute').textContent=muted?'♩':'♪';$('#mute').setAttribute('aria-label',muted?'소리 켜기':'음소거');$('#mute').setAttribute('aria-pressed',String(muted));toast(muted?'소리를 껐습니다':'소리를 켰습니다');});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#play-stage').requestFullscreen)await $('#play-stage').requestFullscreen();else toast('이 브라우저는 전체 화면을 지원하지 않습니다.');}catch{toast('전체 화면을 열 수 없습니다.');}});
$('#restart').addEventListener('click',()=>location.reload());
window.addEventListener('error',event=>{if(started)window.nomError('게임 실행 중 오류가 발생했습니다. 페이지를 다시 열어주세요.');console.error(event.error);});
loadResources().catch(()=>{});

