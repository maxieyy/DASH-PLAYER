import channelsData from './channels.json';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const channelMatch = path.match(/^\/channel\/([a-zA-Z0-9_-]+)$/);
    
    if (channelMatch) {
      const channelId = channelMatch[1];
      const channel = channelsData.find(c => c.id === channelId);
      
      if (channel) {
        return new Response(getChannelPlayerHTML(channel), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "X-Frame-Options": "ALLOWALL"
          }
        });
      } else {
        return new Response('Channel not found', { status: 404 });
      }
    }
    
    return new Response(getHomepageHTML(channelsData), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Frame-Options": "ALLOWALL"
      }
    });
  }
};

function getChannelPlayerHTML(channel) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0">
<title>${channel.name} — Signal Player</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{height:100%;overflow:hidden;background:#000;}
  body{font-family:'Inter',system-ui,-apple-system,sans-serif;color:#fff;-webkit-font-smoothing:antialiased;}
  
  .player-wrapper{
    position:relative;
    width:100%;
    height:100dvh;
    background:#000;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:none;
  }
  .player-wrapper.show-controls{cursor:default;}
  
  video{
    width:100%;
    height:100%;
    object-fit:contain;
    display:block;
    background:#000;
  }

  .loading-overlay{
    position:absolute;
    inset:0;
    display:none;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:16px;
    background:rgba(0,0,0,.75);
    backdrop-filter:blur(4px);
    z-index:10;
  }
  .loading-overlay.active{display:flex;}
  .spinner{
    width:40px;height:40px;
    border-radius:50%;
    border:2px solid rgba(255,255,255,.15);
    border-top-color:#6fffb0;
    animation:spin .8s linear infinite;
  }
  @keyframes spin{to{transform:rotate(360deg);}}
  .loading-text{
    font-family:'JetBrains Mono',monospace;
    font-size:.75rem;
    letter-spacing:.06em;
    text-transform:uppercase;
    color:rgba(255,255,255,.6);
  }

  .controls-overlay{
    position:absolute;
    bottom:0;
    left:0;
    right:0;
    background:linear-gradient(transparent,rgba(0,0,0,.9));
    padding:40px 20px 20px;
    display:flex;
    flex-direction:column;
    gap:14px;
    opacity:0;
    transition:opacity .3s ease;
    z-index:20;
    pointer-events:none;
  }
  .controls-overlay.visible{
    opacity:1;
    pointer-events:all;
  }

  .controls-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
  }

  .controls-left,.controls-right{
    display:flex;align-items:center;gap:10px;
  }

  button.ctrl-btn{
    background:rgba(0,0,0,.6);
    border:1px solid rgba(255,255,255,.15);
    color:#fff;
    width:40px;height:40px;
    border-radius:10px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;
    transition:background .15s,border-color .15s;
    backdrop-filter:blur(8px);
  }
  button.ctrl-btn svg{width:18px;height:18px;stroke:currentColor;fill:none;}
  button.ctrl-btn:hover{background:rgba(0,0,0,.8);border-color:rgba(255,255,255,.3);}
  button.ctrl-btn:active{transform:scale(.94);}

  .channel-name{
    font-family:'JetBrains Mono',monospace;
    font-size:.8rem;
    letter-spacing:.04em;
    color:#fff;
    display:flex;
    align-items:center;
    gap:8px;
    background:rgba(0,0,0,.6);
    padding:8px 14px;
    border-radius:20px;
    border:1px solid rgba(255,255,255,.12);
    backdrop-filter:blur(8px);
  }
  .live-dot{
    width:7px;height:7px;
    border-radius:50%;
    background:#ff5470;
    box-shadow:0 0 8px #ff5470;
    animation:pulse 2s ease-in-out infinite;
    flex-shrink:0;
  }
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}

  /* Quality selector with black background */
  select.quality-select{
    background:#000;
    border:1px solid rgba(255,255,255,.2);
    color:#fff;
    padding:9px 30px 9px 12px;
    border-radius:10px;
    font-family:'JetBrains Mono',monospace;
    font-size:.72rem;
    cursor:pointer;
    outline:none;
    appearance:none;
    -webkit-appearance:none;
    background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M7 10l5 5 5-5z"/></svg>');
    background-repeat:no-repeat;
    background-position:right 10px center;
    max-width:140px;
    transition:border-color .15s;
  }
  select.quality-select:hover{
    border-color:rgba(255,255,255,.4);
    background:#111;
  }
  select.quality-select:focus{
    border-color:#6fffb0;
    background:#0a0a0a;
  }
  select.quality-select option{
    background:#111;
    color:#fff;
    padding:8px;
  }
  select.quality-select option:hover,
  select.quality-select option:checked{
    background:#222;
    color:#6fffb0;
  }

  .top-info{
    position:absolute;
    top:16px;
    left:16px;
    right:16px;
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    opacity:0;
    transition:opacity .3s ease;
    z-index:20;
    pointer-events:none;
  }
  .top-info.visible{
    opacity:1;
    pointer-events:all;
  }
  .top-title{
    font-family:'JetBrains Mono',monospace;
    font-size:.7rem;
    letter-spacing:.08em;
    text-transform:uppercase;
    color:rgba(255,255,255,.7);
    background:rgba(0,0,0,.5);
    padding:6px 12px;
    border-radius:6px;
    backdrop-filter:blur(8px);
  }
</style>
</head>
<body>
<div class="player-wrapper" id="playerWrapper">
  <video id="videoElement" playsinline controlsList="nodownload" disablePictureInPicture autoplay></video>
  
  <div class="loading-overlay active" id="loadingOverlay">
    <div class="spinner"></div>
    <div class="loading-text" id="loadingText">Loading ${channel.name}...</div>
  </div>

  <div class="top-info visible" id="topInfo">
    <div class="top-title">VISIT zabeysports.fun</div>
  </div>

  <div class="controls-overlay" id="controlsOverlay">
    <div class="controls-row">
      <div class="controls-left">
        <button class="ctrl-btn" id="playPauseBtn" title="Play/Pause">
          <svg id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <svg id="pauseIcon" viewBox="0 0 24 24" style="display:none"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
        </button>
        <button class="ctrl-btn" id="muteBtn" title="Mute/Unmute">
          <svg id="volOnIcon" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></svg>
          <svg id="volOffIcon" viewBox="0 0 24 24" style="display:none"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>
        </button>
        <div class="channel-name">
          <span class="live-dot"></span>
          <span>${channel.name}</span>
        </div>
      </div>
      <div class="controls-right">
        <select class="quality-select" id="qualitySelector">
          <option value="auto">Auto</option>
        </select>
        <button class="ctrl-btn" id="fullscreenBtn" title="Fullscreen">
          <svg id="fsEnterIcon" viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4"/></svg>
          <svg id="fsExitIcon" viewBox="0 0 24 24" style="display:none"><path d="M4 9h4V5M20 9h-4V5M4 15h4v4M20 15h-4v4"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.0/shaka-player.compiled.min.js"></script>
<script>
(function(){
  const video = document.getElementById('videoElement');
  const playerWrapper = document.getElementById('playerWrapper');
  const controlsOverlay = document.getElementById('controlsOverlay');
  const topInfo = document.getElementById('topInfo');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const muteBtn = document.getElementById('muteBtn');
  const volOnIcon = document.getElementById('volOnIcon');
  const volOffIcon = document.getElementById('volOffIcon');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const fsEnterIcon = document.getElementById('fsEnterIcon');
  const fsExitIcon = document.getElementById('fsExitIcon');
  const qualitySelector = document.getElementById('qualitySelector');

  let player = null;
  let controlsTimer = null;
  let showControls = true;

  const CHANNEL = {
    id: "${channel.id}",
    name: "${channel.name}",
    mpd: "${channel.mpd}",
    kid: "${channel.kid}",
    key: "${channel.key}"
  };

  function showControlsTemporarily(){
    controlsOverlay.classList.add('visible');
    topInfo.classList.add('visible');
    playerWrapper.classList.add('show-controls');
    showControls = true;
    
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      if(!video.paused){
        hideControls();
      }
    }, 5000);
  }

  function hideControls(){
    controlsOverlay.classList.remove('visible');
    topInfo.classList.remove('visible');
    playerWrapper.classList.remove('show-controls');
    showControls = false;
  }

  function toggleControls(){
    if(showControls){
      hideControls();
    }else{
      showControlsTemporarily();
    }
  }

  playerWrapper.addEventListener('mousemove', () => {
    if(!showControls) showControlsTemporarily();
  });

  playerWrapper.addEventListener('click', (e) => {
    if(e.target === playerWrapper || e.target === video){
      toggleControls();
    }
  });

  function updatePlayPauseIcon(){
    if(video.paused){
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      playPauseBtn.title = 'Play';
    }else{
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      playPauseBtn.title = 'Pause';
    }
  }

  playPauseBtn.addEventListener('click', () => {
    if(video.paused){
      video.play().catch(()=>{});
    }else{
      video.pause();
    }
    updatePlayPauseIcon();
    showControlsTemporarily();
  });

  video.addEventListener('play', updatePlayPauseIcon);
  video.addEventListener('pause', updatePlayPauseIcon);

  function updateMuteIcon(){
    if(video.muted){
      volOnIcon.style.display = 'none';
      volOffIcon.style.display = 'block';
      muteBtn.title = 'Unmute';
    }else{
      volOnIcon.style.display = 'block';
      volOffIcon.style.display = 'none';
      muteBtn.title = 'Mute';
    }
  }

  muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    updateMuteIcon();
    showControlsTemporarily();
  });

  video.addEventListener('volumechange', updateMuteIcon);

  function updateFullscreenIcon(){
    if(document.fullscreenElement){
      fsEnterIcon.style.display = 'none';
      fsExitIcon.style.display = 'block';
      fullscreenBtn.title = 'Exit fullscreen';
    }else{
      fsEnterIcon.style.display = 'block';
      fsExitIcon.style.display = 'none';
      fullscreenBtn.title = 'Fullscreen';
    }
  }

  fullscreenBtn.addEventListener('click', () => {
    if(!document.fullscreenElement){
      playerWrapper.requestFullscreen?.() || playerWrapper.webkitRequestFullscreen?.();
    }else{
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
    showControlsTemporarily();
  });

  document.addEventListener('fullscreenchange', updateFullscreenIcon);

  function updateQualitySelector(){
    if(!player) return;
    const tracks = player.getVariantTracks();
    if(!tracks || tracks.length === 0){
      qualitySelector.innerHTML = '<option value="auto">Auto</option>';
      return;
    }
    const abrEnabled = player.getConfiguration().abr.enabled;
    let html = '<option value="auto"' + (abrEnabled ? ' selected' : '') + '>Auto</option>';
    [...tracks].sort((a,b)=>b.bandwidth-a.bandwidth).forEach(track => {
      const selected = (!abrEnabled && track.active) ? ' selected' : '';
      html += '<option value="' + track.id + '"' + selected + '>' + formatTrackLabel(track) + '</option>';
    });
    qualitySelector.innerHTML = html;
  }

  function formatTrackLabel(track){
    const height = track.height || 0;
    let res = height >= 2160 ? '4K' : height >= 1080 ? '1080p' : height >= 720 ? '720p' : height > 0 ? height+'p' : '?p';
    return res;
  }

  qualitySelector.addEventListener('change', (e) => {
    if(!player) return;
    const value = e.target.value;
    if(value === 'auto'){
      player.configure({ abr: { enabled: true } });
    }else{
      player.configure({ abr: { enabled: false } });
      const trackId = parseInt(value, 10);
      const target = player.getVariantTracks().find(t => t.id === trackId);
      if(target) player.selectVariantTrack(target, true);
    }
    showControlsTemporarily();
  });

  async function initPlayer(){
    try{
      shaka.polyfill.installAll();
      if(!shaka.Player.isBrowserSupported()){
        loadingText.textContent = 'Browser not supported';
        return;
      }

      player = new shaka.Player();
      await player.attach(video);

      player.addEventListener('error', (event) => {
        console.error('Shaka error:', event.detail);
        loadingText.textContent = 'Playback error';
      });

      player.addEventListener('trackschanged', updateQualitySelector);

      player.configure({
        streaming:{
          rebufferingGoal:8,
          bufferBehind:30,
          retryParameters:{ maxAttempts:8, baseDelay:1000, backoffFactor:2 }
        }
      });

      const kidHex = CHANNEL.kid.replace(/-/g,'').toLowerCase();
      const keyHex = CHANNEL.key.replace(/-/g,'').toLowerCase();
      player.configure({ drm: { clearKeys: { [kidHex]: keyHex } } });

      await player.load(CHANNEL.mpd);
      
      video.muted = true;
      updateMuteIcon();
      video.play().catch(()=>{});
      
      loadingOverlay.classList.remove('active');
      updateQualitySelector();

      showControlsTemporarily();
      setTimeout(() => {
        if(!video.paused) hideControls();
      }, 5000);

    }catch(err){
      console.error('Init error:', err);
      loadingText.textContent = 'Failed to load stream';
    }
  }

  document.addEventListener('keydown', (e) => {
    switch(e.key){
      case ' ':
        e.preventDefault();
        playPauseBtn.click();
        break;
      case 'm':
        muteBtn.click();
        break;
      case 'f':
        fullscreenBtn.click();
        break;
      case 'Escape':
        if(document.fullscreenElement){
          document.exitFullscreen();
        }
        break;
    }
  });

  video.addEventListener('waiting', () => {
    

























    loadingOverlay.classList.add('active');
  });

  video.addEventListener('playing', () => {
    loadingOverlay.classList.remove('active');
  });

  window.addEventListener('beforeunload', () => {
    if(player){ player.destroy(); player = null; }
  });

  initPlayer();
})();
</script>
</body>
</html>`;
}

function getHomepageHTML(channels) {
  const channelsJSON = JSON.stringify(channels);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0">
<title>Signal — Stream Player</title>
<style>
  :root{
    --bg:#0a0d10;
    --surface:#12161b;
    --surface-2:#171d24;
    --border:#232a32;
    --text:#e8ecef;
    --text-dim:#8a97a3;
    --accent:#6fffb0;
    --accent-dim:#3a6b52;
    --live:#ff5470;
    --mono:'JetBrains Mono','SF Mono',Consolas,monospace;
    --sans:'Manrope','Inter',system-ui,-apple-system,sans-serif;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{height:100%;overflow:hidden;background:var(--bg);}
  body{
    font-family:var(--sans);
    color:var(--text);
    -webkit-font-smoothing:antialiased;
  }
  .app{
    height:100dvh;
    width:100vw;
    display:flex;
    flex-direction:column;
    overflow:hidden;
  }
  .topbar{
    flex:0 0 auto;
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:10px 18px;
    border-bottom:1px solid var(--border);
    background:var(--surface);
  }
  .brand{
    font-family:var(--mono);
    font-size:.78rem;
    letter-spacing:.14em;
    color:var(--text-dim);
    text-transform:uppercase;
    display:flex;
    align-items:center;
    gap:8px;
  }
  .brand b{color:var(--text);font-weight:600;}
  .scan-dot{
    width:6px;height:6px;border-radius:50%;
    background:var(--accent);
    box-shadow:0 0 8px var(--accent);
    animation:pulse 2s ease-in-out infinite;
  }
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.25;}}
  .panel-toggle{
    display:none;
    font-family:var(--mono);
    font-size:.72rem;
    letter-spacing:.08em;
    text-transform:uppercase;
    background:var(--surface-2);
    border:1px solid var(--border);
    color:var(--text-dim);
    padding:6px 12px;
    border-radius:6px;
    cursor:pointer;
  }
  .main{
    flex:1 1 auto;
    display:flex;
    flex-direction:row;
    min-height:0;
    overflow:hidden;
  }
  .player-col{
    flex:1 1 68%;
    min-width:0;
    display:flex;
    flex-direction:column;
    background:#000;
  }
  .video-wrapper{
    position:relative;
    flex:1 1 auto;
    min-height:0;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#000;
  }
  video{
    width:100%;
    height:100%;
    object-fit:contain;
    display:block;
    background:#000;
  }
  .empty-state{
    position:absolute;
    inset:0;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:10px;
    text-align:center;
    padding:24px;
    color:var(--text-dim);
  }
  .empty-state .glyph{
    width:44px;height:44px;
    border:1px solid var(--border);
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
  }
  .empty-state .glyph svg{width:20px;height:20px;stroke:var(--text-dim);}
  .empty-state p{font-size:.85rem;max-width:280px;line-height:1.5;}
  .empty-state .hint{font-family:var(--mono);font-size:.72rem;color:var(--accent);}

  .loading-overlay{
    position:absolute;
    inset:0;
    display:none;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:14px;
    background:rgba(10,13,16,.82);
    backdrop-filter:blur(3px);
    z-index:4;
  }
  .loading-overlay.active{display:flex;}
  .spinner{
    width:34px;height:34px;
    border-radius:50%;
    border:2px solid var(--border);
    border-top-color:var(--accent);
    animation:spin .8s linear infinite;
  }
  @keyframes spin{to{transform:rotate(360deg);}}
  .loading-overlay p{
    font-family:var(--mono);
    font-size:.72rem;
    letter-spacing:.06em;
    text-transform:uppercase;
    color:var(--text-dim);
  }

  .controls-bar{
    flex:0 0 auto;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding:10px 16px;
    background:var(--surface);
    border-top:1px solid var(--border);
    flex-wrap:wrap;
  }
  .left-controls,.right-controls{
    display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  }
  button.icon-btn{
    background:var(--surface-2);
    border:1px solid var(--border);
    color:var(--text);
    width:36px;height:36px;
    border-radius:8px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;
    transition:border-color .15s, transform .1s;
  }
  button.icon-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;}
  button.icon-btn:hover{border-color:var(--accent-dim);}
  button.icon-btn:active{transform:scale(.94);}

  .channel-tag{
    font-family:var(--mono);
    font-size:.78rem;
    letter-spacing:.04em;
    background:var(--surface-2);
    border:1px solid var(--border);
    padding:7px 12px;
    border-radius:20px;
    display:flex;align-items:center;gap:8px;
    color:var(--text);
    max-width:38vw;
    overflow:hidden;
  }
  .channel-tag span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .live-dot{
    width:6px;height:6px;border-radius:50%;background:var(--live);
    box-shadow:0 0 6px var(--live);
    flex:0 0 auto;
  }

  select{
    background:var(--surface-2);
    border:1px solid var(--border);
    color:var(--text);
    padding:8px 30px 8px 12px;
    border-radius:8px;
    font-family:var(--mono);
    font-size:.76rem;
    cursor:pointer;
    outline:none;
    appearance:none;
    background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="%238a97a3"><path d="M7 10l5 5 5-5z"/></svg>');
    background-repeat:no-repeat;
    background-position:right 10px center;
    max-width:150px;
  }
  select:hover{border-color:var(--accent-dim);}

  .panel-col{
    flex:0 0 340px;
    max-width:38vw;
    display:flex;
    flex-direction:column;
    background:var(--surface);
    border-left:1px solid var(--border);
    min-height:0;
  }
  .panel-body{
    flex:1 1 auto;
    min-height:0;
    overflow-y:auto;
    padding:14px;
  }

  .ch-row{
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border:1px solid var(--border);
    border-radius:10px;
    background:var(--surface-2);
    cursor:pointer;
    transition:border-color .15s;
    margin-bottom:6px;
  }
  .ch-row:hover{border-color:var(--accent-dim);}
  .ch-row.active{border-color:var(--accent);}
  .ch-row .idx{
    font-family:var(--mono);
    font-size:.68rem;
    color:var(--text-dim);
    width:22px;
    flex:0 0 auto;
  }
  .ch-row .name{
    font-size:.85rem;
    font-weight:600;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .ch-row .url-hint{
    margin-left:auto;
    font-family:var(--mono);
    font-size:.6rem;
    color:var(--text-dim);
    opacity:.7;
  }

  @media (max-width:860px){
    .main{flex-direction:column;}
    .player-col{flex:0 0 auto;}
    .video-wrapper{aspect-ratio:16/9;flex:0 0 auto;}
    .panel-col{flex:1 1 auto;max-width:none;border-left:none;border-top:1px solid var(--border);}
    .channel-tag{max-width:60vw;}
    .panel-toggle{display:block;}
    .panel-col:not(.force-open){display:none;}
  }
</style>
</head>
<body>
<div class="app" id="app">
  <div class="topbar">
    <div class="brand"><span class="scan-dot"></span><b>Signal</b>&nbsp;/ Player</div>
    <button class="panel-toggle" id="panelToggleBtn">Channels</button>
  </div>

  <div class="main">
    <div class="player-col">
      <div class="video-wrapper" id="videoWrapper">
        <video id="videoElement" playsinline controlsList="nodownload" disablePictureInPicture></video>
        <div class="empty-state" id="emptyState">
          <div class="glyph"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M9 10l5 3-5 3z" fill="currentColor" stroke="none"/></svg></div>
          <p>No channel loaded.</p>
          <p class="hint">Select a channel to begin.</p>
        </div>
        <div class="loading-overlay" id="loadingOverlay">
          <div class="spinner"></div>
          <p id="loadingText">Loading...</p>
        </div>
      </div>
      <div class="controls-bar">
        <div class="left-controls">
          <button class="icon-btn" id="muteBtn" title="Mute/Unmute">
            <svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></svg>
          </button>
          <div class="channel-tag" id="channelLabel"><span class="live-dot" id="liveDot" style="display:none;"></span><span id="channelLabelText">No channel</span></div>
        </div>
        <div class="right-controls">
          <select id="qualitySelector" title="Video quality">
            <option value="auto">Auto quality</option>
          </select>
          <button class="icon-btn" id="fullscreenBtn" title="Fullscreen">
            <svg viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="panel-col">
      <div class="panel-body">
        <div id="channelList"></div>
      </div>
    </div>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.0/shaka-player.compiled.min.js"></script>
<script>
(function(){
  const CHANNELS = ${channelsJSON};

  const video = document.getElementById('videoElement');
  const muteBtn = document.getElementById('muteBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const qualitySelector = document.getElementById('qualitySelector');
  const channelLabelText = document.getElementById('channelLabelText');
  const liveDot = document.getElementById('liveDot');
  const emptyState = document.getElementById('emptyState');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const videoWrapper = document.getElementById('videoWrapper');

  const channelList = document.getElementById('channelList');
  const panelToggleBtn = document.getElementById('panelToggleBtn');

  let player = null;
  let activeId = null;

  function renderChannelList(){
    channelList.innerHTML = '';
    if(CHANNELS.length === 0){
      channelList.innerHTML = '<p style="color:var(--text-dim);padding:20px;">No channels in channels.json</p>';
      return;
    }
    CHANNELS.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'ch-row' + (c.id === activeId ? ' active' : '');
      row.innerHTML = '<span class="idx">' + String(i+1).padStart(2,'0') + '</span>' +
                       '<span class="name">' + escapeHtml(c.name) + '</span>' +
                       '<span class="url-hint">/channel/' + c.id + '</span>';
      row.addEventListener('click', () => playChannel(c.id));
      channelList.appendChild(row);
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function stopPlayback(){
    if(player){ player.unload(); }
    channelLabelText.textContent = 'No channel';
    liveDot.style.display = 'none';
    emptyState.style.display = 'flex';
    loadingOverlay.classList.remove('active');
    qualitySelector.innerHTML = '<option value="auto">Auto quality</option>';
    activeId = null;
    renderChannelList();
  }

  async function ensurePlayer(){
    if(player) return player;
    shaka.polyfill.installAll();
    if(!shaka.Player.isBrowserSupported()) throw new Error('unsupported');
    player = new shaka.Player();
    await player.attach(video);
    player.addEventListener('error', (e) => console.error(e.detail));
    player.addEventListener('trackschanged', updateQualitySelector);
    player.configure({
      streaming:{
        rebufferingGoal:8,
        bufferBehind:30,
        retryParameters:{ maxAttempts:8, baseDelay:1000, backoffFactor:2 }
      }
    });
    return player;
  }

  async function playChannel(id){
    const channel = CHANNELS.find(c => c.id === id);
    if(!channel) return;
    activeId = id;
    renderChannelList();
    emptyState.style.display = 'none';
    channelLabelText.textContent = channel.name;
    liveDot.style.display = 'inline-block';
    loadingText.textContent = 'Loading ' + channel.name + '...';
    loadingOverlay.classList.add('active');

    try{
      const p = await ensurePlayer();
      const kidHex = channel.kid.replace(/-/g,'').toLowerCase();
      const keyHex = channel.key.replace(/-/g,'').toLowerCase();
      p.configure({ drm: { clearKeys: { [kidHex]: keyHex } } });
      await p.load(channel.mpd);
      video.muted = true;
      video.play().catch(()=>{});
      updateQualitySelector();
      loadingOverlay.classList.remove('active');
    }catch(err){
      console.error(err);
      loadingOverlay.classList.remove('active');
    }
  }

  function updateQualitySelector(){
    if(!player) return;
    const tracks = player.getVariantTracks();
    if(!tracks || tracks.length === 0){
      qualitySelector.innerHTML = '<option value="auto">Auto quality</option>';
      return;
    }
    const abrEnabled = player.getConfiguration().abr.enabled;
    let html = '<option value="auto"' + (abrEnabled ? ' selected' : '') + '>Auto (best)</option>';
    [...tracks].sort((a,b)=>b.bandwidth-a.bandwidth).forEach(track => {
      const selected = (!abrEnabled && track.active) ? ' selected' : '';
      html += '<option value="' + track.id + '"' + selected + '>' + formatTrackLabel(track) + '</option>';
    });
    qualitySelector.innerHTML = html;
  }

  function formatTrackLabel(track){
    const height = track.height || 0;
    let res = height >= 2160 ? '4K' : height >= 1080 ? '1080p' : height >= 720 ? '720p' : height > 0 ? height+'p' : '?p';
    const mbps = ((track.bandwidth||0)/1000000).toFixed(1);
    return res + ' (' + mbps + ' Mbps)';
  }

  qualitySelector.addEventListener('change', e => {
    if(!player) return;
    const value = e.target.value;
    if(value === 'auto'){
      player.configure({ abr: { enabled: true } });
    }else{
      player.configure({ abr: { enabled: false } });
      const trackId = parseInt(value, 10);
      const target = player.getVariantTracks().find(t => t.id === trackId);
      if(target) player.selectVariantTrack(target, true);
    }
  });

  muteBtn.addEventListener('click', () => { video.muted = !video.muted; });
  video.addEventListener('volumechange', () => {
    muteBtn.innerHTML = video.muted 
      ? '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></svg>';
  });

  fullscreenBtn.addEventListener('click', () => {
    if(!document.fullscreenElement){
      (videoWrapper.requestFullscreen || videoWrapper.webkitRequestFullscreen)?.call(videoWrapper);
    }else{
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    }
  });

  video.addEventListener('waiting', () => {
    if(activeId){














































    
      loadingOverlay.classList.add('active');
    }
  });
  video.addEventListener('playing', () => loadingOverlay.classList.remove('active'));

  panelToggleBtn.addEventListener('click', () => {
    document.querySelector('.panel-col').classList.toggle('force-open');
  });

  window.addEventListener('beforeunload', () => { if(player){ player.destroy(); player = null; } });

  renderChannelList();
})();
</script>
</body>
</html>`;
}
