

const API='https://itunes.apple.com';
// Optional YouTube fallback: create config.js beside this file and set YOUTUBE_API_KEY.
// The key is intentionally kept out of this file.
window.YOUTUBE_API_KEY=window.YOUTUBE_API_KEY||'';
const SEED_ARTISTS=['Taylor Swift','The Weeknd','Billie Eilish','Bruno Mars','Ed Sheeran','Ariana Grande','Justin Bieber','Lady Gaga','Dua Lipa','Post Malone','Drake','Kendrick Lamar','Sabrina Carpenter','Olivia Rodrigo','Chappell Roan','Beyoncé','Rihanna','Adele','Coldplay','Imagine Dragons','Maroon 5','OneRepublic','Linkin Park','The Beatles','Queen','Nirvana','Arctic Monkeys','Radiohead','Oasis','The 1975','Harry Styles','Lana Del Rey','SZA','Katy Perry','Doja Cat','Travis Scott','Tyler The Creator','Bad Bunny','ROSÉ','BLACKPINK','BTS','NewJeans','Stray Kids','TWICE','YOASOBI','Fujii Kaze','Kenshi Yonezu','Three Man Down','Tilly Birds','Bodyslam','Cocktail','Getsunova','Polycat','Slot Machine','Jeff Satur','NONT TANONT','4EVE'];
const THAI_ARTISTS=['Bodyslam','Three Man Down','Tilly Birds','Cocktail','Getsunova','Polycat','Slot Machine','Jeff Satur','NONT TANONT','4EVE','PiXXiE','BUS','ATLAS','PROXIE','PERSES','LYKN','D Gerrard','Ink Waruntorn','Bowkylion','Violette Wautier','Billkin','PP Krit','Nanon','MILLI','F.HERO','TATTOO COLOUR','Labanoon','Big Ass','Potato','Palmy','Da Endorphine','Lipta','Scrubb','Safeplanet','Whal & Dolph','LANDOKMAI','Only Monday','MEAN','Klear','Getsunova','Silly Fools','Paradox','Moderndog','Joey Phuwasit','Zom Marie','The Toys','Stamp Apiwat','Num Kala'];
const ENGLISH_ARTISTS=['Taylor Swift','The Weeknd','Billie Eilish','Bruno Mars','Ed Sheeran','Ariana Grande','Justin Bieber','Lady Gaga','Dua Lipa','Post Malone','Drake','Kendrick Lamar','Sabrina Carpenter','Olivia Rodrigo','Chappell Roan','Beyoncé','Rihanna','Adele','Coldplay','Imagine Dragons','Maroon 5','OneRepublic','Linkin Park','The Beatles','Queen','Nirvana','Arctic Monkeys','Radiohead','Oasis','The 1975','Harry Styles','Lana Del Rey','SZA','Katy Perry','Doja Cat','Travis Scott','Tyler The Creator','Bad Bunny','Alicia Keys','Justin Timberlake','Miley Cyrus','Lady Gaga'];
let current=null,tracks=[],pool=[],stage=.1,playing=false,artistMode='__random__',timer=null,round=0,selectedGuess=null,answerRevealed=false;
let languageMode='worldwide';
let randomQueue=[];
let randomQueueKey='';
let languageLoading=false;
function trackLanguage(t){
  const s=String((t?.trackName||'')+' '+(t?.artistName||'')+' '+(t?.collectionName||''));
  if(/[\u0E00-\u0E7F]/.test(s))return 'thai';
  if(/[A-Za-z]/.test(String(t?.trackName||'')) || /[A-Za-z]/.test(String(t?.artistName||'')))return 'english';
  return 'other';
}
function languageFilter(list){
  const a=Array.isArray(list)?list:[];
  if(languageMode==='thai')return a.filter(t=>trackLanguage(t)==='thai');
  if(languageMode==='english')return a.filter(t=>trackLanguage(t)==='english');
  return a;
}
function activeSource(){
  if(artistMode==='__random__')return languageFilter(pool);
  return languageFilter(pool.filter(t=>norm(t.artistName)===norm(artistMode)));
}
function updateLanguageUI(){
  document.querySelectorAll('.langBtn').forEach(b=>b.classList.toggle('active',b.dataset.lang===languageMode));
  const labels={worldwide:'WORLDWIDE',thai:'THAI',english:'ENGLISH'};
  $('languageMeta').textContent=labels[languageMode];
}
async function loadLanguagePool(){
  if(languageMode==='worldwide')return;
  const seeds=languageMode==='thai'?THAI_ARTISTS:ENGLISH_ARTISTS;
  status(languageMode==='thai'?'Loading Thai songs…':'Loading English songs…');
  languageLoading=true;
  const found=[];
  for(let i=0;i<seeds.length;i+=5){
    const batch=seeds.slice(i,i+5);
    try{
      const got=await Promise.all(batch.map(searchArtist));
      found.push(...got.flat());
      pool=cleanTracks([...pool,...found]);
      const live=languageFilter(pool);
      tracks=live.slice();
      updateStats();
      if(live.length>=80)break;
    }catch(e){}
  }
  languageLoading=false;
}
async function setLanguage(mode){
  if(!['worldwide','thai','english'].includes(mode))mode='worldwide';
  if(languageLoading)return;
  languageMode=mode;
  randomQueue=[];randomQueueKey='';
  updateLanguageUI();
  renderQuickArtists();
  let src=activeSource();
  if(!src.length && mode!=='worldwide'){
    await loadLanguagePool();
    src=activeSource();
  }
  tracks=src.slice();
  updateStats();
  if(!src.length){
    current=null;
    clearTimeout(timer); audio.pause(); ytStop(); playing=false;
    $('play').textContent='▷';
    $('result').style.display='none';
    status(mode==='thai'?'No Thai songs found. Try another artist.':mode==='english'?'No English songs found. Try another artist.':'No songs found.');
    $('artistMeta').textContent=artistMode==='__random__'?'Random':artistMode;
    return;
  }
  pick();
}

const audio=document.getElementById('audio');
let ytPlayer=null,ytReady=false,ytPending=null;
function loadYT(){return new Promise((resolve,reject)=>{if(ytReady&&window.YT)return resolve(); if(window.YT&&window.YT.Player){ytReady=true;return resolve();} ytPending=resolve; if(document.querySelector('script[data-yt]'))return; const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.dataset.yt='1';s.onerror=reject;document.head.appendChild(s);});}
window.onYouTubeIframeAPIReady=()=>{ytReady=true;if(ytPending){ytPending();ytPending=null}};
function ytSearch(q,limit=12){if(!window.YOUTUBE_API_KEY)return Promise.resolve([]);return fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults='+limit+'&q='+encodeURIComponent(q)+'&key='+encodeURIComponent(window.YOUTUBE_API_KEY)).then(r=>r.ok?r.json():Promise.reject(new Error('YouTube API '+r.status))).then(x=>(x.items||[]).filter(v=>v.id?.videoId&&isYTOG(v.snippet?.title)).map(v=>({trackId:'yt:'+v.id.videoId,videoId:v.id.videoId,trackName:ytTitle(v.snippet.title),artistName:q.replace(/\s+(official|audio|music video).*$/i,''),collectionName:'YouTube',previewUrl:null,source:'youtube',artworkUrl100:v.snippet.thumbnails?.high?.url||v.snippet.thumbnails?.default?.url})));}
function ytTitle(t){return String(t||'').replace(/\s*\|.*$/,'').replace(/\s*[-–—]\s*(official.*|lyrics?.*|music video.*)$/i,'').trim()}
function isYTOG(t){return !/(remix|remaster(ed)?|live|acoustic|karaoke|instrumental|demo|edit|version|mix|extended|club|sped up|slowed|nightcore|cover|tribute|rework|bootleg|session|alternate|orchestral|piano|stripped|unplugged|radio edit|mono|stereo|anniversary|deluxe|commentary|8d|8-d)/i.test(String(t||''));}
function ytArtistSearch(name){return ytSearch(name+' official audio',20).then(list=>list.map(t=>({...t,artistName:name})));}
function ytStop(){if(ytPlayer&&typeof ytPlayer.stopVideo==='function')ytPlayer.stopVideo();}
function ytEnsure(id){return loadYT().then(()=>new Promise((resolve,reject)=>{if(ytPlayer){ytPlayer.loadVideoById(id);resolve(ytPlayer);return;} ytPlayer=new YT.Player('youtubePlayer',{height:'1',width:'1',videoId:id,playerVars:{playsinline:1,controls:0,disablekb:1,rel:0},events:{onReady:e=>resolve(e.target),onError:()=>reject(new Error('YouTube playback error'))}});}));}
const $=id=>document.getElementById(id),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function jsonp(path){return new Promise((ok,no)=>{let c='cb'+Date.now()+Math.random().toString(36).slice(2),s=document.createElement('script'),t=setTimeout(()=>{delete window[c];s.remove();no(Error('timeout'))},12000);window[c]=d=>{clearTimeout(t);delete window[c];s.remove();ok(d)};s.onerror=()=>{clearTimeout(t);delete window[c];s.remove();no(Error('network'))};s.src=API+path+(path.includes('?')?'&':'?')+'callback='+c;document.body.appendChild(s)})}
function norm(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/เเ/g,'แ').replace(/ํา/g,'ำ').replace(/[’'`]/g,'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim()}
function isOG(t){const title=norm(t?.trackName||''); const bad=[/\b(remix|remaster(ed)?|live|acoustic|karaoke|instrumental|demo|edit|version|mix|radio edit|extended|club|sped up|slowed|nightcore|cover|tribute|rework|bootleg|session|commentary|alternate|alternative|orchestral|piano|stripped|unplugged|mono|stereo|anniversary|deluxe|commentary|8d|8-d)\b/i,/\(([^)]*(remix|remaster|live|acoustic|karaoke|instrumental|demo|edit|version|mix|extended|club|sped up|slowed|cover|alternate|orchestral|piano|stripped|unplugged|8d|8-d)[^)]*)\)/i]; return !bad.some(r=>r.test(title));}
function cleanTracks(arr){return dedupe(arr.filter(t=>t&&t.trackId&&((t.source==='youtube'&&t.videoId)||t.previewUrl)&&isOG(t)))}
function status(t){$('status').textContent=t}
function setProgress(v){const n=Number(v),p=Math.max(0,Math.min(100,isFinite(n)?n:0)),b=document.querySelector('.bar');if(b)b.style.setProperty('--progress',p+'%')}
function updateAudioProgress(){if(!audio||!isFinite(audio.duration)||audio.duration<=0)return;setProgress(audio.currentTime/audio.duration*100)}
function updateYTProgress(){if(!ytPlayer||typeof ytPlayer.getCurrentTime!=='function'||typeof ytPlayer.getDuration!=='function')return;const t=Number(ytPlayer.getCurrentTime()),d=Number(ytPlayer.getDuration());if(d>0&&isFinite(t)&&isFinite(d))setProgress(t/d*100)}
function updateStage(){ $('time').textContent=stage+'s';document.querySelectorAll('.guessTimes button').forEach(b=>b.style.opacity=Number(b.dataset.sec)===stage?'1':'.75') }
function updateStats(){ $('songCount').textContent=tracks.length+' songs'; }
function dedupe(arr){const m=new Map();for(const t of arr){if(t&&t.trackId&&((t.source==='youtube'&&t.videoId)||t.previewUrl))m.set(t.trackId,t)}return [...m.values()]}
async function search(q,limit=50){const query=String(q||'').trim();if(!query)return [];try{const x=await jsonp('/search?term='+encodeURIComponent(query)+'&media=music&entity=song&limit='+limit);const got=cleanTracks(x.results||[]);if(got.length)return got;}catch(e){}try{const yt=await ytSearch(query,Math.min(limit,50));return cleanTracks(yt)}catch(e){return []}}
async function searchArtist(name,target=40){
  let songs=[];
  try {
    const a=await jsonp('/search?term='+encodeURIComponent(name)+'&entity=musicArtist&limit=8');
    const artist=(a.results||[]).find(x=>x.artistName);
    if(artist?.artistId){
      const r=await jsonp('/lookup?id='+artist.artistId+'&entity=song&limit=200');
      songs=cleanTracks((r.results||[]).filter(t=>t.wrapperType==='track'));
    }
  }catch(e){}
  // iTunes first; if it has fewer OG songs, supplement the same artist from YouTube.
  if(songs.length<target){
    try{const yt=await ytArtistSearch(name);songs=cleanTracks([...songs,...yt]).slice(0,target)}catch(e){}
  }
  if(songs.length)return songs;
  try{return await search(name,target)}catch(e){return []}
}
function renderQuickArtists(){
  const box=$('artistButtons');
  const source=languageMode==='thai'?THAI_ARTISTS:languageMode==='english'?ENGLISH_ARTISTS:SEED_ARTISTS;
  const names=[...new Set(source)].slice(0,18);
  box.innerHTML='<button class="active quickArtist" data-artist="__random__">🎲 Random Artist</button>'+names.map(n=>'<button class="quickArtist" data-artist="'+esc(n)+'">'+esc(n)+'</button>').join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>selectArtist(b.dataset.artist));
}
async function loadLibrary(){
  status('Loading worldwide songs…'); $('songCount').textContent='Loading…';
  const results=[];
  // Seed a broad worldwide pool so Random is not limited to only a few Thai artists.
  for(let i=0;i<SEED_ARTISTS.length;i+=6){
    const batch=SEED_ARTISTS.slice(i,i+6);
    const got=await Promise.all(batch.map(searchArtist));
    results.push(...got.flat());
    if(dedupe(results).length>=500)break;
  }
  pool=cleanTracks(results); tracks=languageFilter(pool).slice(); updateStats();
  if(!pool.length){status('โหลดเพลงไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่');$('songCount').textContent='0 songs';return false}
  pick(); return true;
}
function pick(){
  clearTimeout(timer);
  audio.pause();
  audio.loop=false;
  audio.removeAttribute('src');
  audio.load();
  playing=false;
  $('play').textContent='▷';
  const available=activeSource();
  tracks=available.slice();
  updateStats();
  if(!available.length){
    current=null;
    $('result').style.display='none';
    status(languageMode==='thai'?'ไม่พบเพลงไทยในคลังนี้':languageMode==='english'?'ไม่พบเพลงอังกฤษในคลังนี้':'ไม่พบเพลง');
    return;
  }

  if(artistMode==='__random__'){
    const key=languageMode+'|'+available.map(t=>t.trackId).sort().join(',');
    if(randomQueueKey!==key || !randomQueue.length){
      randomQueue=available.slice();
      for(let i=randomQueue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[randomQueue[i],randomQueue[j]]=[randomQueue[j],randomQueue[i]];}
      randomQueueKey=key;
      if(randomQueue.length>1 && current){
        randomQueue=randomQueue.filter(t=>t.trackId!==current.trackId);
      }
    }
    current=randomQueue.shift()||available[Math.floor(Math.random()*available.length)];
  }else{
    let candidates=available.filter(t=>t.trackId!==current?.trackId);
    if(!candidates.length)candidates=available;
    current=candidates[Math.floor(Math.random()*candidates.length)];
  }

  prefetchSmartStart(current);
  stage=.1;
  round++;
  selectedGuess=null;
  answerRevealed=false;
  setProgress(0);
  updateStage();
  setProgress(0);
  $('result').style.display='none';
  $('guess').value='';
  updateGuessButton();
  status('กด ▶ เพื่อฟัง แล้วเลือกคำตอบ');
  $('artistMeta').textContent=artistMode==='__random__'?'Random':current.artistName;
}

async function loadArtistMode(){
  status('Loading '+artistMode+'…');
  const got=await searchArtist(artistMode);
  if(got.length){
    pool=cleanTracks([...pool,...got]);
    let local=languageFilter(got);
    if(!local.length && languageMode!=='worldwide'){
      try{
        const extra=languageFilter(await search(artistMode+' '+(languageMode==='thai'?'เพลง ไทย':'official audio'),40));
        pool=cleanTracks([...pool,...extra]);
        local=languageFilter([...got,...extra]);
      }catch(e){}
    }
    tracks=local.slice();
    updateStats();
    if(local.length)pick();
    else status(languageMode==='thai'?'No Thai songs for this artist.':languageMode==='english'?'No English songs for this artist.':'No playable songs for this artist.');
  }else status('Artist not found');
}
const smartStartCache=new Map();
async function getSmartStart(track){
  if(!track?.previewUrl)return 0;
  if(smartStartCache.has(track.trackId))return smartStartCache.get(track.trackId);
  try{
    const res=await fetch(track.previewUrl,{mode:'cors',cache:'force-cache'});
    if(!res.ok)throw new Error('preview fetch '+res.status);
    const buf=await res.arrayBuffer();
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)throw new Error('Web Audio unavailable');
    const ctx=new AC();
    const data=await ctx.decodeAudioData(buf.slice(0));
    const ch=data.getChannelData(0), sr=data.sampleRate;
    const maxSec=Math.min(25,data.duration), frame=2048, hop=1024, end=Math.floor(maxSec*sr);
    const feats=[]; let prevCentroid=0;
    for(let i=0;i<end;i+=hop){
      let sum=0,z=0,prev=0,low=0,mid=0,high=0;
      const stop=Math.min(i+frame,end);
      for(let j=i;j<stop;j++){
        const x=ch[j], ax=Math.abs(x); sum+=x*x;
        if(j>i && ((x>=0)!==(prev>=0)))z++;
        prev=x;
        // Cheap frequency bands from short-time energy proxy using sample differences.
        if(ax>0.0001){
          mid+=ax; if(Math.abs(x-prev)>0.03)high+=ax; else low+=ax;
        }
      }
      const n=Math.max(1,stop-i), rms=Math.sqrt(sum/n), zcr=z/n;
      const vocal=Math.min(1,(mid/n)/(rms+1e-6))*0.55+Math.min(1,zcr*8)*0.25+Math.min(1,high/(mid+1e-6))*0.20;
      feats.push({t:i/sr,rms,vocal});
    }
    const rmsVals=feats.map(x=>x.rms).sort((a,b)=>a-b);
    const base=rmsVals[Math.floor(rmsVals.length*0.25)]||0;
    const loud=Math.max(base*2.2,0.008);
    let best=0;
    for(let i=0;i<feats.length;i++){
      const f=feats[i];
      const sustained=feats.slice(i,Math.min(i+6,feats.length)).filter(x=>x.rms>loud).length>=Math.min(4,feats.length-i);
      if(f.rms>loud && sustained && f.vocal>0.30){best=Math.max(0,f.t-0.18);break;}
    }
    // Fallback: first clearly audible sustained section, avoiding dead-air intros.
    if(!best){for(let i=0;i<feats.length;i++){if(feats[i].rms>loud && feats.slice(i,i+5).filter(x=>x.rms>loud).length>=4){best=Math.max(0,feats[i].t-0.12);break;}}}
    best=Math.min(best,Math.max(0,data.duration-0.5));
    smartStartCache.set(track.trackId,best);
    await ctx.close();
    return best;
  }catch(e){
    smartStartCache.set(track.trackId,0);
    return 0;
  }
}

function prefetchSmartStart(track){
  if(!track||track.source==='youtube'||!track.previewUrl)return;
  getSmartStart(track).catch(()=>{});
}

async function playAnswer(){
  stopProgressRAF();
  setProgress(0);
  if(!current)return;
  clearTimeout(timer);
  audio.pause();
  ytStop();
  playing=false;
  setProgress(0);
  try{
    if(current.source==='youtube'){
      const p=await ytEnsure(current.videoId);
      p.seekTo(0,true);
      p.setVolume(Math.round(Number($('volume').value)*100));
      p.playVideo();
      playing=true;
      startAnswerProgressRAF();
      $('play').textContent='■';
      status('กำลังเล่นเพลงเฉลย…');
    }else{
      audio.volume=Number($('volume').value);
      audio.src=current.previewUrl;
      audio.currentTime=0;
      await audio.play();
      playing=true;
      startAnswerProgressRAF();
      $('play').textContent='■';
      status('กำลังเล่นเพลงเฉลย…');
    }
  }catch(e){
    playing=false;
    $('play').textContent='▷';
    status('เพลงเฉลยเปิดไม่ได้ — ลองกด Play อีกครั้ง');
  }
}

async function play(force=false){
  if(!current)return;
  stopProgressRAF();
  if(answerRevealed){return playAnswer();}
  if(playing&&!force)return;
  clearTimeout(timer);audio.pause();ytStop();playing=false;setProgress(0);
  try{
    if(current.source==='youtube'){
      const p=await ytEnsure(current.videoId);
      p.seekTo(0,true);p.setVolume(Math.round(Number($('volume').value)*100));p.playVideo();
      playing=true;$('play').textContent='■';status('กำลังเล่น…');
      startStageProgressRAF();
      timer=setTimeout(stopPlayback,stage*1000+80);
    }else{
      audio.volume=Number($('volume').value);
      audio.src=current.previewUrl;
      // Never block playback while analysing the intro. Start immediately, then
      // jump to the detected vocal/active section when the analysis is ready.
      const cached=smartStartCache.get(current.trackId);
      audio.currentTime=Number.isFinite(cached)?cached:0;
      audio.__trackId=current.trackId;
      await audio.play();
      playing=true;
      startAnswerProgressRAF();$('play').textContent='■';status('กำลังเล่น…');
      const targetStage=stage;
      if(!Number.isFinite(cached)){
        getSmartStart(current).then(start=>{
          if(playing&&current&&current.trackId===audio.__trackId && stage===targetStage){
            try{audio.currentTime=start}catch(e){}
          }
        }).catch(()=>{});
      }
      timer=setTimeout(stopPlayback,targetStage*1000+80);
    }
  }catch(e){playing=false;$('play').textContent='▷';status('เพลงนี้เปิดไม่ได้ — ลองเพลงถัดไป');}
}
function stopPlayback(){clearTimeout(timer);stopProgressRAF();audio.pause();ytStop();playing=false;$('play').textContent='▷';if(!answerRevealed)setProgress(100);status(answerRevealed?'เพลงเฉลยจบแล้ว':'ทายเพลงได้เลย')}
function advanceRound(){
  if(!current)return;
  pick();
  setTimeout(()=>{ if(current && !answerRevealed) play(); },0);
}
function next(){
  if(!current)return;
  const a=[.1,.5,2,8,15],i=a.indexOf(stage);
  if(i<a.length-1){
    stage=a[i+1];
    updateStage();
    play();
  }else{
    reveal(false);
  }
}
function reveal(ok){
  clearTimeout(timer);
  audio.pause();
  ytStop();
  playing=false;
  answerRevealed=true;
  $('play').textContent='▷';
  $('result').style.display='block';
  $('guess').value='';
  selectedGuess=null;
  updateGuessButton();
  $('result').innerHTML='<div class="answerState '+(ok?'correct':'wrong')+'">'+(ok?'✓ ถูกต้อง!':'✕ ผิด!')+'</div><img src="'+esc(current.artworkUrl100||'')+'"><b>'+esc(current.trackName)+'</b><span>'+esc(current.artistName)+' · '+esc(current.collectionName||'')+'</span>';
  status(ok?'ถูกต้อง!':'เฉลยเพลงนี้แล้ว');
  $('skip').textContent='Next';
  playAnswer();
}

$('play').onclick=()=>playing?stopPlayback():play();
function updateGuessButton(){
  if(answerRevealed){
    $('skip').textContent='Next';
    return;
  }
  $('skip').textContent=$('guess').value.trim()?'Guess':'Skip';
}
async function submitGuess(){
  if(!current || answerRevealed)return;
  const q=norm($('guess').value);
  if(!q){
    next();
    return;
  }
  let ok=false;
  if(selectedGuess){
    ok=selectedGuess.trackId===current.trackId || (norm(selectedGuess.trackName)===norm(current.trackName)&&norm(selectedGuess.artistName)===norm(current.artistName));
  }else{
    const title=norm(current.trackName), artist=norm(current.artistName);
    ok=q===title || q===title+' '+artist || q===artist+' '+title;
  }
  reveal(ok);
}
$('skip').onclick=async()=>{
  if(answerRevealed){
    advanceRound();
    return;
  }
  if($('guess').value.trim()){
    await submitGuess();
  }else{
    next();
  }
};
$('volume').oninput=e=>{const v=Number(e.target.value);audio.volume=v;if(ytPlayer&&typeof ytPlayer.setVolume==='function')ytPlayer.setVolume(Math.round(v*100));};
$('reroll').onclick=pick;
audio.addEventListener('timeupdate',()=>{ if(answerRevealed) updateAudioProgress(); });
audio.addEventListener('loadedmetadata',()=>{ if(answerRevealed) updateAudioProgress(); });
audio.addEventListener('durationchange',()=>{ if(answerRevealed) updateAudioProgress(); });
audio.addEventListener('ended',()=>{
  if(answerRevealed){
    stopProgressRAF(); playing=false; $('play').textContent='▷'; setProgress(100); status('เพลงเฉลยจบแล้ว');
  } else {
    stopProgressRAF(); playing=false; $('play').textContent='▷'; setProgress(100); status('ช่วงเพลงจบแล้ว');
  }
});

// Smooth progress animation: use requestAnimationFrame instead of a choppy timer/CSS transition.
let progressRAF=0;
function stopProgressRAF(){ if(progressRAF){cancelAnimationFrame(progressRAF);progressRAF=0;} }
function startStageProgressRAF(){
  stopProgressRAF();
  const startedAt=performance.now(), duration=Math.max(0.1,Number(stage)||0.1);
  const tick=()=>{
    if(!playing||answerRevealed){progressRAF=0;return;}
    const elapsed=(performance.now()-startedAt)/1000;
    setProgress(Math.min(100,elapsed/duration*100));
    if(elapsed<duration) progressRAF=requestAnimationFrame(tick); else {setProgress(100);progressRAF=0;}
  };
  progressRAF=requestAnimationFrame(tick);
}
function startAnswerProgressRAF(){
  stopProgressRAF();
  const tick=()=>{
    if(!playing||!answerRevealed){progressRAF=0;return;}
    let t=0,d=0;
    if(current?.source==='youtube'&&ytPlayer&&typeof ytPlayer.getCurrentTime==='function'){
      t=Number(ytPlayer.getCurrentTime())||0; d=Number(ytPlayer.getDuration())||0;
    }else if(audio&&isFinite(audio.currentTime)&&isFinite(audio.duration)&&audio.duration>0){
      t=audio.currentTime; d=audio.duration;
    }
    if(d>0) setProgress(Math.min(100,t/d*100));
    progressRAF=requestAnimationFrame(tick);
  };
  progressRAF=requestAnimationFrame(tick);
}

// Keyboard-friendly controls: Space = play/pause, Enter = guess/next, 1-5 = reveal durations.
document.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName||'').toLowerCase();
  const typing=tag==='input'||tag==='textarea';
  if(e.key==='Escape'){document.querySelectorAll('.dropdown,.artistDropdown').forEach(x=>x.style.display='none');return;}
  if(typing)return;
  if(e.key===' '){e.preventDefault();playing?stopPlayback():play();return;}
  if(e.key==='Enter'){e.preventDefault();if(answerRevealed){advanceRound();return;}$('skip').click();return;}
  if(/^\d$/.test(e.key)&&Number(e.key)>=1&&Number(e.key)<=5){e.preventDefault();const secs=[.1,.5,2,8,15];stage=secs[Number(e.key)-1];updateStage();setProgress(0);play(true);}
});

document.querySelectorAll('.guessTimes button').forEach(b=>b.onclick=()=>{
  stage=Number(b.dataset.sec);
  updateStage();
  setProgress(0);
  play(true);
});
function selectArtist(name){
  artistMode=name;
  randomQueue=[];randomQueueKey='';
  document.querySelectorAll('#artistButtons button').forEach(x=>x.classList.toggle('active',x.dataset.artist===name));
  $('artistMeta').textContent=name==='__random__'?'Random':name;
  const local=activeSource();
  if(local.length){tracks=local.slice();updateStats();pick()}
  else if(name==='__random__'){
    tracks=[];updateStats();
    if(languageMode==='thai'||languageMode==='english')setLanguage(languageMode);
    else status('No songs in this pool');
  }else{
    loadArtistMode();
  }
}
$('modeRandom').onclick=()=>selectArtist('__random__');
$('modeArtist').onclick=()=>status('ค้นหาศิลปินจากช่องด้านซ้าย');
let artistTimer;
$('artistSearch').oninput=()=>{
  clearTimeout(artistTimer);const q=$('artistSearch').value.trim(),box=$('artistDropdown');
  if(!q){box.style.display='none';return}
  artistTimer=setTimeout(async()=>{
    try{
      const x=await jsonp('/search?term='+encodeURIComponent(q)+'&entity=musicArtist&limit=12');
      const list=(x.results||[]).filter(a=>a.artistName).filter((a,i,self)=>i===self.findIndex(b=>b.artistId===a.artistId));
      box.innerHTML=list.map(a=>'<div class="artistItem"><b>'+esc(a.artistName)+'</b><span>Artist</span></div>').join('');
      box.style.display=list.length?'block':'none';
      box.querySelectorAll('.artistItem').forEach((el,i)=>el.onclick=()=>{selectArtist(list[i].artistName);$('artistSearch').value=list[i].artistName;box.style.display='none'})
    }catch(e){box.style.display='none'}
  },180)
};
let timerSearch;
$('guess').oninput=()=>{
  if(!answerRevealed)selectedGuess=null;
  updateGuessButton();
  clearTimeout(timerSearch);const q=$('guess').value.trim(),box=$('dropdown');
  if(q.length<1){box.style.display='none';return}
  timerSearch=setTimeout(async()=>{
    let list=languageFilter(pool.filter(t=>norm(t.trackName).includes(norm(q))||norm(t.artistName).includes(norm(q))||norm(t.collectionName).includes(norm(q)))).slice(0,10);
    try{if(list.length<10){const api=languageFilter(await search(q,30));list=cleanTracks([...list,...api]).slice(0,10)}}catch(e){}
    box.innerHTML=list.map(t=>'<div class="item"><b>'+esc(t.trackName)+'</b><span>'+esc(t.artistName)+' · '+esc(t.collectionName||'')+'</span></div>').join('');
    box.style.display=list.length?'block':'none';
    box.querySelectorAll('.item').forEach((el,i)=>el.onclick=()=>{const t=list[i];selectedGuess=t;$('guess').value=t.trackName+' — '+t.artistName;box.style.display='none';updateGuessButton();status('เลือกคำตอบแล้ว กด Guess เพื่อส่ง')})
  },180)
};
$('artistSearch').addEventListener('keydown',async e=>{
  if(e.key!=='Enter')return;
  e.preventDefault();
  const q=$('artistSearch').value.trim(); if(!q)return;
  const box=$('artistDropdown');
  const first=box.querySelector('.artistItem');
  if(first){first.click();return;}
  status('กำลังค้นหาศิลปิน '+q+'…');
  try{
    const x=await jsonp('/search?term='+encodeURIComponent(q)+'&entity=musicArtist&limit=12');
    const list=(x.results||[]).filter(a=>a.artistName);
    if(list.length){selectArtist(list[0].artistName);$('artistSearch').value=list[0].artistName;box.style.display='none';}
    else status('ไม่พบศิลปิน '+q);
  }catch(e){status('ค้นหาศิลปินไม่สำเร็จ ลองอีกครั้ง');}
});
$('guess').addEventListener('keydown',async e=>{
  if(e.key!=='Enter')return;
  e.preventDefault();
  const q=$('guess').value.trim(); if(!current)return; if(!q){$('skip').click();return;}
  const box=$('dropdown');
  const first=box.querySelector('.item');
  if(first){first.click();$('skip').click();return;}
  status('กำลังค้นหาเพลง '+q+'…');
  try{
    const list=await search(q,20);
    if(list.length){
      const t=list[0]; selectedGuess=t; $('guess').value=t.trackName+' — '+t.artistName; box.style.display='none'; updateGuessButton(); status('เลือกคำตอบแล้ว กด Guess เพื่อส่ง'); $('skip').click();
    }else status('ไม่พบเพลง '+q);
  }catch(e){status('ค้นหาเพลงไม่สำเร็จ ลองอีกครั้ง');}
});
document.addEventListener('click',e=>{if(!e.target.closest('.searchBox'))$('dropdown').style.display='none';if(!e.target.closest('.artistPicker'))$('artistDropdown').style.display='none'});
updateStage();setProgress(0);updateGuessButton();updateLanguageUI();document.querySelectorAll('.langBtn').forEach(b=>b.onclick=()=>setLanguage(b.dataset.lang));renderQuickArtists();loadLibrary();
