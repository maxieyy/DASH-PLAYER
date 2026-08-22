import channelsData from './channels.json';

const PLYR_VERSION = '3.8.4';
const SHAKA_VERSION = '4.7.0';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const channelMatch = url.pathname.match(/^\/channel\/([a-zA-Z0-9_-]+)$/);

    if (channelMatch) {
      const channel = channelsData.find((item) => item.id === channelMatch[1]);
      if (!channel) return new Response('Channel not found', { status: 404 });
      return html(getChannelPlayerHTML(channel));
    }

    return html(getHomepageHTML(channelsData));
  },
};

function html(body) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Frame-Options': 'ALLOWALL',
    },
  });
}

function getChannelPlayerHTML(channel) {
  const channelJSON = JSON.stringify({
    id: channel.id,
    name: channel.name,
    mpd: channel.mpd,
    kid: channel.kid,
    key: channel.key,
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(channel.name)} — Signal Player</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@${PLYR_VERSION}/dist/plyr.css">
<style>
:root{--plyr-color-main:#6fffb0}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}body{font-family:Inter,system-ui,sans-serif;color:#fff}
.player-wrapper{position:relative;width:100%;height:100dvh;background:#000;display:flex;align-items:center;justify-content:center}
video{width:100%;height:100%;object-fit:contain;background:#000}
.plyr{width:100%;height:100%;--plyr-color-main:#6fffb0}
.plyr video{height:100%}
.loading-overlay{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);z-index:100}
.loading-overlay.active{display:flex}.spinner{width:40px;height:40px;border:2px solid rgba(255,255,255,.15);border-top-color:#6fffb0;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.loading-text{font:12px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.65)}
.top-info{position:fixed;top:16px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:flex-start;z-index:50;pointer-events:none}.top-title{font:11px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.75);background:rgba(0,0,0,.55);padding:7px 12px;border-radius:6px;backdrop-filter:blur(8px)}
.plyr--full-ui input[type=range]{color:#6fffb0}.plyr__menu__container{background:#080b0d}.plyr__control--overlaid{background:#6fffb0;color:#06100b}
</style>
</head>
<body>
<div class="player-wrapper" id="playerWrapper">
  <video id="videoElement" playsinline autoplay></video>
</div>
<div class="loading-overlay active" id="loadingOverlay"><div class="spinner"></div><div class="loading-text" id="loadingText">Loading ${escapeHtml(channel.name)}...</div></div>
<div class="top-info"><div class="top-title">VISIT zabeysports.fun</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/${SHAKA_VERSION}/shaka-player.compiled.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/plyr@${PLYR_VERSION}/dist/plyr.min.js"></script>
<script>
(async()=>{
  const CHANNEL=${channelJSON};
  const video=document.getElementById('videoElement');
  const loading=document.getElementById('loadingOverlay');
  const loadingText=document.getElementById('loadingText');
  let shakaPlayer=null;
  let plyr=null;

  function uniqueHeights(tracks){
    return [...new Set(tracks.map(t=>Number(t.height)).filter(Boolean))].sort((a,b)=>b-a);
  }

  function labelForHeight(height){
    return height>=2160?'4K':height>=1440?'1440p':height>=1080?'1080p':height>=720?'720p':height+'p';
  }

  function tracksForHeight(height){
    return shakaPlayer.getVariantTracks().filter(t=>Number(t.height)===Number(height));
  }

  function selectBestTrack(tracks){
    return tracks.slice().sort((a,b)=>(b.bandwidth||0)-(a.bandwidth||0))[0];
  }

  try{
    shaka.polyfill.installAll();
    if(!shaka.Player.isBrowserSupported()) throw new Error('Browser is not supported by Shaka Player');

    shakaPlayer=new shaka.Player();
    await shakaPlayer.attach(video);
    shakaPlayer.configure({
      streaming:{rebufferingGoal:8,bufferBehind:30,retryParameters:{maxAttempts:8,baseDelay:1000,backoffFactor:2}},
      drm:{clearKeys:{
        [CHANNEL.kid.replace(/-/g,'').toLowerCase()]:CHANNEL.key.replace(/-/g,'').toLowerCase()
      }}
    });

    // Shaka loads the MPD first. Plyr is created only after real variant
    // heights are available, so there is no destroy/re-initialize cycle.
    await shakaPlayer.load(CHANNEL.mpd);
    const variantTracks=shakaPlayer.getVariantTracks();
    const heights=uniqueHeights(variantTracks);

    plyr=new Plyr(video,{
      controls:['play-large','play','progress','current-time','mute','volume','settings','pip','fullscreen'],
      settings:['quality','speed'],
      quality:{
        default:0,
        options:[0,...heights],
        forced:true,
        onChange:(value)=>{
          const quality=Number(value);
          if(quality===0){
            shakaPlayer.configure({abr:{enabled:true}});
            return;
          }
          const target=selectBestTrack(tracksForHeight(quality));
          if(target){
            shakaPlayer.configure({abr:{enabled:false}});
            shakaPlayer.selectVariantTrack(target,true);
          }
        }
      },
      i18n:{qualityLabel:{0:'Auto',...Object.fromEntries(heights.map(h=>[h,labelForHeight(h)]))}}
    });

    // Plyr's quality UI can be driven directly from the already-known DASH heights.
    shakaPlayer.addEventListener('trackschanged',()=>{
      const active=shakaPlayer.getVariantTracks().find(t=>t.active);
      if(active && shakaPlayer.getConfiguration().abr.enabled){
        plyr.quality=0;
      }
    });

    video.muted=true;
    await video.play().catch(()=>{});
    loading.classList.remove('active');
  }catch(error){
    console.error(error);
    loadingText.textContent='Failed to load stream';
  }

  window.addEventListener('beforeunload',()=>{if(plyr)plyr.destroy();if(shakaPlayer)shakaPlayer.destroy();});
})();
</script>
</body>
</html>`;
}

function getHomepageHTML(channels) {
  const rows = channels.map((channel) => `<a class="channel" href="/channel/${encodeURIComponent(channel.id)}"><span class="dot"></span><span>${escapeHtml(channel.name)}</span></a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signal — Stream Player</title><style>
:root{--bg:#0a0d10;--surface:#12161b;--border:#232a32;--text:#e8ecef;--dim:#8a97a3;--accent:#6fffb0}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px Inter,system-ui,sans-serif}.app{min-height:100vh;display:grid;place-items:center;padding:24px}.panel{width:min(700px,100%);background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px}.brand{font:12px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px;color:var(--dim)}.brand b{color:var(--text)}.channel{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;padding:13px 14px;border:1px solid var(--border);border-radius:10px;margin-top:8px;background:#171d24}.channel:hover{border-color:#3a6b52}.dot{width:7px;height:7px;border-radius:50%;background:#ff5470;box-shadow:0 0 8px #ff5470}.empty{color:var(--dim)}
</style></head><body><main class="app"><section class="panel"><div class="brand"><b>Signal</b> / Player</div>${rows||'<div class="empty">No channels configured.</div>'}</section></main></body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
