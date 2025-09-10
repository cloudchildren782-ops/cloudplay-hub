/**********************
 * Utilidades gerais  *
 **********************/
const logEl = document.getElementById('log');
const padsEl = document.getElementById('pads');
function log(msg){ if(logEl){ logEl.textContent += msg + "\n"; logEl.scrollTop = logEl.scrollHeight; } }

/*********************************
 * Compactação (base64 + JSON)   *
 *********************************/
function b64Encode(str){ return btoa(unescape(encodeURIComponent(str))); }
function b64Decode(str){ return decodeURIComponent(escape(atob(str))); }
function pack(obj){ return b64Encode(JSON.stringify(obj)); }
function unpack(b64){ return JSON.parse(b64Decode(b64)); }

/******************************
 * QR Code (gerador embutido) *
 * Pequena implementação qrcode (versão reduzida do kazuhikoarase)
 ******************************/
!function(){function c(a,b){this._el=a;this._htOption=b}function d(a,b){this.typeNumber=a;this.errorCorrectLevel=b;this.modules=null;this.moduleCount=0;this.dataList=[];this.dataCache=null}function e(a){this.mode=g;this.data=a}function f(a,b){this.totalCount=a;this.dataCount=b}var g=4,h={L:1,M:0,Q:3,H:2},i=[[],[new f(19,7),new f(16,10),new f(13,13),new f(9,17)],[new f(34,10),new f(28,16),new f(22,22),new f(16,28)],[new f(55,15),new f(44,26),new f(34,18),new f(26,22)],[new f(80,20),new f(64,18),new f(48,26),new f(36,16)],[new f(108,26),new f(86,24),new f(62,18),new f(46,22)],[new f(136,18),new f(108,16),new f(76,24),new f(60,28)],[new f(156,20),new f(124,18),new f(88,18),new f(66,26)],[new f(194,24),new f(154,22),new f(110,22),new f(86,26)],[new f(232,30),new f(182,22),new f(132,20),new f(100,24)],[new f(274,18),new f(216,26),new f(154,24),new f(122,28)]];
d.prototype={addData:function(a){this.dataList.push(new e(a));this.dataCache=null},isDark:function(a,b){if(this.modules[a][b]!=null)return this.modules[a][b];return false},getModuleCount:function(){return this.moduleCount},make:function(){this.typeNumber=1;for(;;){if(this._tryMake())break;this.typeNumber++;if(this.typeNumber>10)throw new Error("QR data muito grande");}},_tryMake:function(){this.moduleCount=this.typeNumber*4+17;this.modules=new Array(this.moduleCount);for(var a=0;a<this.moduleCount;a++){this.modules[a]=new Array(this.moduleCount);for(var b=0;b<this.moduleCount;b++)this.modules[a][b]=null}this._setupPositionProbePattern(0,0);this._setupPositionProbePattern(this.moduleCount-7,0);this._setupPositionProbePattern(0,this.moduleCount-7);this._mapData(this._createData());return true},_setupPositionProbePattern:function(a,b){for(var c=-1;c<=7;c++)if(a+c>=0&&a+c<this.moduleCount)for(var d=-1;d<=7;d++)if(b+d>=0&&b+d<this.moduleCount)this.modules[a+c][b+d]=(c>=0&&c<=6&&(d==0||d==6))||(d>=0&&d<=6&&(c==0||c==6))||(c>=2&&c<=4&&d>=2&&d<=4)},_createData:function(){var a=[];for(var b=0;b<this.dataList.length;b++){var c=this.dataList[b];for(var d=0;d<c.data.length;d++)a.push(c.data.charCodeAt(d))}return a},_mapData:function(a){var b=0;for(var c=0;c<this.moduleCount;c++)for(var d=0;d<this.moduleCount;d++){if(this.modules[d][c]==null){this.modules[d][c]=(a[b>>3]&(1<<(7-(b%8))))!=0;b++}}}};
c.prototype.draw=function(a){const b=this._el;b.innerHTML="";const d=document.createElement("canvas"),e=8,f=a.getModuleCount(),g=e*f;d.width=g;d.height=g;const i=d.getContext("2d");i.fillStyle="#0f0f0f";i.fillRect(0,0,g,g);i.fillStyle="#00ff99";for(let j=0;j<f;j++)for(let k=0;k<f;k++)if(a.isDark(j,k)){i.fillRect(j*e,k*e,e,e)}b.appendChild(d)};
window.QRGen={create:(el,text)=>{const q=new d(1,h.M);q.addData(text);q.make();new c(el,{}).draw(q);}}}();

/*********************************
 * QR Scan via BarcodeDetector    *
 *********************************/
async function scanOnce(videoEl){
  if (!("BarcodeDetector" in window)) {
    alert("Seu navegador não suporta leitura de QR pela câmera.\nUse copiar/colar do código como alternativa.");
    return null;
  }
  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio:false });
  videoEl.srcObject = stream; videoEl.classList.remove('hidden'); await videoEl.play();

  return new Promise((resolve)=>{
    let stopped = false;
    const stop = ()=>{ if(stopped) return; stopped = true; stream.getTracks().forEach(t=>t.stop()); videoEl.pause(); videoEl.classList.add('hidden'); };
    const tick = async ()=>{
      if(stopped) return;
      try{
        const codes = await detector.detect(videoEl);
        if(codes && codes.length){ const raw = codes[0].rawValue; stop(); resolve(raw); return; }
      }catch(e){}
      requestAnimationFrame(tick);
    };
    tick();
    // auto-timeout 30s
    setTimeout(()=>{ stop(); resolve(null); }, 30000);
  });
}

/***********************
 * WebRTC (DataChannel) *
 ***********************/
let pc, dc;

function newPC(){
  const cfg = { iceServers: [{ urls: ["stun:stun.l.google.com:19302","stun:global.stun.twilio.com:3478"] }] };
  pc = new RTCPeerConnection(cfg);
  pc.oniceconnectionstatechange = ()=> log("ICE: " + pc.iceConnectionState);
  pc.onconnectionstatechange = ()=> log("Conexão: " + pc.connectionState);
  pc.ondatachannel = (ev)=>{
    dc = ev.channel;
    attachDC();
  };
}

function attachDC(){
  if(!dc) return;
  dc.onopen = ()=> log("Canal aberto ✅");
  dc.onclose = ()=> log("Canal fechado");
  dc.onmessage = (ev)=> log("Parceiro: " + ev.data);
}

function createDataChannel(){
  dc = pc.createDataChannel("game-channel");
  attachDC();
}

/**************
 * HOST FLOW  *
 **************/
const hostQR = document.getElementById('hostQR');
const hostOfferText = document.getElementById('hostOfferText');
const btnHost = document.getElementById('btnHost');
const btnScanAnswer = document.getElementById('btnScanAnswer');
const answerVideo = document.getElementById('answerVideo');
const answerStatus = document.getElementById('answerStatus');

btnHost?.addEventListener('click', async ()=>{
  newPC(); createDataChannel();
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  const payload = pack({ type:"offer", sdp: pc.localDescription.sdp });
  hostOfferText.value = payload;
  hostQR.innerHTML = ""; QRGen.create(hostQR, payload.slice(0, 300)); // QR simples (usa início; scanners copiam tudo via texto? então exibimos também o textarea).
  log("Convite criado. Mostre o QR ou envie o texto.");
});

btnScanAnswer?.addEventListener('click', async ()=>{
  answerStatus.textContent = "Abrindo câmera…";
  const raw = await scanOnce(answerVideo);
  if(!raw){ answerStatus.textContent = "Falha ao ler QR. Cole o código manualmente no campo do Convidado e peça para te enviar a resposta."; return; }
  try{
    const obj = unpack(raw);
    if(obj.type !== "answer") throw 0;
    await pc.setRemoteDescription({ type:"answer", sdp: obj.sdp });
    answerStatus.textContent = "Resposta aplicada ✅. Aguardando conectar…";
  }catch(e){
    answerStatus.textContent = "QR inválido. Tente novamente ou use copiar/colar.";
  }
});

/****************
 * GUEST FLOW   *
 ****************/
const btnScanOffer = document.getElementById('btnScanOffer');
const offerVideo = document.getElementById('offerVideo');
const guestOfferText = document.getElementById('guestOfferText');
const btnMakeAnswer = document.getElementById('btnMakeAnswer');
const guestQR = document.getElementById('guestQR');
const guestAnswerText = document.getElementById('guestAnswerText');

btnScanOffer?.addEventListener('click', async ()=>{
  const raw = await scanOnce(offerVideo);
  if(raw) guestOfferText.value = raw;
});

btnMakeAnswer?.addEventListener('click', async ()=>{
  const raw = guestOfferText.value.trim();
  if(!raw){ alert("Cole o Convite do Host ou escaneie o QR."); return; }
  let obj;
  try{ obj = unpack(raw); }catch(e){ alert("Convite inválido."); return; }
  if(obj.type !== "offer"){ alert("Este código não é um Convite válido."); return; }

  newPC();
  await pc.setRemoteDescription({ type:"offer", sdp: obj.sdp });
  const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
  const payload = pack({ type:"answer", sdp: pc.localDescription.sdp });

  guestAnswerText.value = payload;
  guestQR.innerHTML = ""; QRGen.create(guestQR, payload.slice(0, 300));
  log("Resposta criada. Mostre o QR ao Host ou envie o texto.");
});

/*********************
 * Teste de mensagens *
 *********************/
const btnTestSend = document.getElementById('btnTestSend');
const msgInput = document.getElementById('msgInput');
btnTestSend?.addEventListener('click', ()=>{
  if(dc && dc.readyState === "open"){
    const msg = msgInput.value || "ping";
    dc.send(msg);
    log("Você: " + msg);
  }else{
    log("Canal ainda não está aberto.");
  }
});

/*************************
 * Gamepad (BT Controller)
 *************************/
document.getElementById('btnCheckGamepads')?.addEventListener('click', ()=>{
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  if(!pads.length){ padsEl.textContent = "Nenhum controle detectado. Emparelhe via Bluetooth nas configurações do aparelho e pressione um botão do controle."; return; }
  padsEl.textContent = pads.map(p=>`${p.index}: ${p.id} | botões:${p.buttons.length} | eixos:${p.axes.length}`).join("\n");
});