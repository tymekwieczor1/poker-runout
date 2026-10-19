/* Poker Runout Online — phone client */
(function(){
"use strict";
const E = window.PokerEngine;
const { MODES, BOARD_N, rn } = E;
const RANKS = "23456789TJQKA";
const SUIT_SYM = ["♠","♥","♦","♣"], SUIT_CLS = ["s-s","s-h","s-d","s-c"], SUIT_PL = ["pik","kier","karo","trefl"];
const STREETS = ["Preflop","Flop","Turn","River","Showdown"];
const STAKES = [5,10,20,50,100];
const MODE_SHORT = { nlhe:"Hold'em", plo4:"PLO4", plo5:"PLO5", plo6:"PLO6", pine:"Ananas" };
const SPEED = { slow:{gap:110, flip:320, board:320, step:2200}, norm:{gap:65, flip:220, board:230, step:1400}, fast:{gap:30, flip:120, board:120, step:700} };
const THROW = { slow:{th:2300, hold:2600}, norm:{th:1800, hold:2100}, fast:{th:1200, hold:1400} };
const ORD = ["pierwsza","druga","trzecia","czwarta","piąta"];
const PIPS = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const STAKE_COLORS = {0:"--chip0",5:"--chip1",10:"--chip2",20:"--chip3",50:"--chip4",100:"--chip5"};
const AV_COLORS = ["--chip1","--chip2","--chip3","--chip4","--chip5","--chip6","--chip7"];
const $ = id => document.getElementById(id);
const PLAY_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1" fill="currentColor"/></svg>';

/* ---------- storage ---------- */
const PREF_KEY = "pro-prefs", SESS_KEY = "pro-session";
const prefs = { speed:"norm", fourColor:true };
function loadJSON(k){ try{ return JSON.parse(localStorage.getItem(k)||"null"); }catch(e){ return null; } }
function saveJSON(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function delKey(k){ try{ localStorage.removeItem(k); }catch(e){} }
(function(){ const p=loadJSON(PREF_KEY); if (p){ if (SPEED[p.speed]) prefs.speed=p.speed; prefs.fourColor=p.fourColor!==false; } })();
let sess = loadJSON(SESS_KEY);   // {code, token, name}

/* ---------- elements ---------- */
const els = {};
["app","codeBtn","codeTxt","scoreBtn","menuBtn","menu","mSettings","mAbort","mRename","mSit","mLeave","speed","fourc",
 "entry","homeFan","eResume","eName","tabJoin","tabCreate","paneJoin","paneCreate","eCode","eJoin","eWatch","eCreate",
 "game","lobbyBar","lobbyTitle","lobbySub","lobbyShare","tableSec","felt","street","handNo","modeName","board","diceRow","diceSet","diceText","banner",
 "controls","primary","autoBtn","autoDiscard","settingsBtn","waitLine","mine","coverBtn","mineCards","mineMade","mineAct","discardBtn","sitNote","seats",
 "shareSheet","bigCode","qrImg","shareLink","copyLink","scoreSheet","scoreBody","scoreNote","undoBtn","resetPts",
 "setSheet","setNote","variants","vHint","stakeChips","stakeIn","boardsChoice","diceChoice","revealChoice","setCount","setPlayers","setSave",
 "readyBar","readyBtn","readyInfo","nameSheet","nameForm","nameIn","leaveSheet","leaveNote","leaveYes","leaveNo","throw","throwFig","throwBubble","netBar","toast","rulesPop","rulesList","rulesNote","rulesOk"
].forEach(id => els[id] = $(id));

let toastTimer=0;
function toast(msg){ els.toast.textContent=msg; els.toast.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{ els.toast.hidden=true; }, 3200); }
const curSpeed = () => (S && S.settings && SPEED[S.settings.speed]) ? S.settings.speed : "norm";   // host decides for the whole table
const sp = () => SPEED[curSpeed()];
let tk = 0;
function later(fn, ms){ const t=tk; setTimeout(()=>{ if (t===tk) fn(); }, ms); }
function fmt(v){ return String(Math.round(v*100)/100).replace(".",","); }
function sg(v){ return (v>0?"+":v<0?"−":"")+fmt(Math.abs(v)); }
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function randInt(n){ const r=new Uint32Array(1); crypto.getRandomValues(r); return r[0]%n; }

/* ---------- cards ---------- */
function cardLabel(c){ return (c>>2===8?"10":RANKS[c>>2])+" "+SUIT_PL[c&3]; }
function makeCard(c, up, delay){
  const el=document.createElement("div");
  el.className="card"; el.dataset.c=c; el.setAttribute("role","img"); el.setAttribute("aria-label", up?cardLabel(c):"zakryta karta");
  const face = c>=0 ? '<div class="face front '+SUIT_CLS[c&3]+'"><span class="r">'+rn(c>>2)+'</span><span class="s">'+SUIT_SYM[c&3]+'</span></div>' : '<div class="face front"></div>';
  el.innerHTML='<div class="inner">'+face+'<div class="face back"></div></div>';
  if (delay!=null){
    el.classList.add("down","deal"); el.style.setProperty("--d", delay+"ms");
    if (up) later(()=>{ el.classList.remove("down"); el.setAttribute("aria-label",cardLabel(c)); }, delay+sp().flip+120);
  } else if (!up) el.classList.add("down");
  return el;
}
function backCard(delay){ const el=makeCard(-1,false,null); if (delay!=null){ el.classList.add("deal"); el.style.setProperty("--d",delay+"ms"); } return el; }
function slot(){ const d=document.createElement("div"); d.className="slot"; return d; }
function avColor(key){ let h=0; for (const ch of String(key)) h=(h*31+ch.charCodeAt(0))>>>0; return "var("+AV_COLORS[h%AV_COLORS.length]+")"; }
function avatar(name, key){ const a=document.createElement("span"); a.className="av"; a.style.setProperty("--c", avColor(key)); a.textContent=((name||"?").trim()[0]||"?").toUpperCase(); a.setAttribute("aria-hidden","true"); return a; }

/* ---------- connection ---------- */
let ws=null, wsOpen=false, retry=0, wantConn=false, viewerCode=null, resumeOK=false;
let S=null, myId=null, viewer=false;
function wsUrl(){ return (location.protocol==="https:"?"wss://":"ws://")+location.host+"/ws"; }
function connect(){
  wantConn=true;
  if (ws && (ws.readyState===0 || ws.readyState===1)) return;
  ws=new WebSocket(wsUrl());
  ws.onopen=()=>{
    wsOpen=true; retry=0; els.netBar.hidden=true;
    if (viewerCode) raw({t:"watch", code:viewerCode});
    else if (sess && sess.token && resumeOK) raw({t:"join", code:sess.code, token:sess.token, name:sess.name});
    flushQueue();
  };
  ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(err){ return; } onMsg(m); };
  ws.onclose=()=>{
    wsOpen=false;
    if (!wantConn) return;
    els.netBar.hidden=false;
    const d=Math.min(5000, 600*Math.pow(1.6, retry++));
    setTimeout(connect, d);
  };
}
document.addEventListener("visibilitychange",()=>{ if (document.visibilityState==="visible" && wantConn && !wsOpen) connect(); });
let queue=[];
function raw(o){ if (ws && ws.readyState===1) ws.send(JSON.stringify(o)); }
function send(o){ if (wsOpen) raw(o); else { queue.push(o); connect(); } }
function flushQueue(){ const q=queue; queue=[]; q.forEach(raw); }

function onMsg(m){
  if (m.t==="joined"){
    sess={code:m.code, token:m.token, name:(els.eName.value||"").trim() || (sess&&sess.name) || ""};
    saveJSON(SESS_KEY, sess); resumeOK=true; viewer=false; showGame();
    return;
  }
  if (m.t==="watching"){ viewer=true; document.body.classList.add("viewer"); showGame(); return; }
  if (m.t==="state"){ onState(m); return; }
  if (m.t==="error"){
    if (m.code==="no_room"){ if (sess && !S){ delKey(SESS_KEY); sess=null; } wantConn=false; try{ ws.close(); }catch(e){} showEntry(); }
    toast(m.msg||"Błąd");
    return;
  }
  if (m.t==="kicked"){ toast("Host usunął cię ze stołu."); leaveLocal(); return; }
  if (m.t==="left"){ leaveLocal(); return; }
  if (m.t==="replaced"){ toast("Ten stół jest otwarty na innym urządzeniu lub karcie."); wantConn=false; return; }
}
function leaveLocal(){ delKey(SESS_KEY); sess=null; S=null; wantConn=false; try{ ws.close(); }catch(e){} showEntry(); }

/* ---------- screens ---------- */
function showEntry(){
  document.body.classList.remove("ingame");
  els.entry.hidden=false; els.game.hidden=true;
  els.codeBtn.hidden=true; els.scoreBtn.hidden=true; els.menuBtn.hidden=true;
  document.body.classList.remove("viewer");
  els.eResume.hidden=!(sess && sess.token);
  if (sess) els.eResume.textContent="Wróć do stołu "+sess.code;
  if (!els.homeFan.childElementCount){
    [[12,0],[11,1],[10,2],[9,3],[12,3]].forEach(([r,su],i)=>{ const c=makeCard(r*4+su,true,null); c.style.transform="rotate("+((i-2)*13)+"deg)"; c.style.animationDelay=(i*70)+"ms"; els.homeFan.appendChild(c); });
  }
}
function showGame(){
  document.body.classList.add("ingame");
  els.entry.hidden=true; els.game.hidden=false;
  els.codeBtn.hidden=false; els.scoreBtn.hidden=viewer; els.menuBtn.hidden=false;
  els.app.classList.toggle("twocolor", !prefs.fourColor);
  els.speed.value=curSpeed();
}
function setTab(join){
  els.tabJoin.setAttribute("aria-selected", String(join)); els.tabCreate.setAttribute("aria-selected", String(!join));
  els.paneJoin.hidden=!join; els.paneCreate.hidden=join;
}
els.tabJoin.addEventListener("click",()=>setTab(true));
els.tabCreate.addEventListener("click",()=>setTab(false));
function myName(){ const n=(els.eName.value||"").trim(); return n; }
els.paneJoin.addEventListener("submit",e=>{
  e.preventDefault();
  const code=(els.eCode.value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if (code.length<4){ toast("Wpisz 4-znakowy kod stołu."); els.eCode.focus(); return; }
  if (!myName()){ toast("Wpisz swoje imię."); els.eName.focus(); return; }
  viewerCode=null; sess=null; S=null; resetTable();
  saveJSON("pro-lastname", myName());
  send({t:"join", code, name:myName()});
});
els.paneCreate.addEventListener("submit",e=>{
  e.preventDefault();
  if (!myName()){ toast("Wpisz swoje imię."); els.eName.focus(); return; }
  viewerCode=null; sess=null; S=null; resetTable();
  saveJSON("pro-lastname", myName());
  send({t:"create", name:myName()});
});
els.eWatch.addEventListener("click",()=>{
  const code=(els.eCode.value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if (code.length<4){ toast("Wpisz kod stołu, który ma pokazywać ten ekran."); els.eCode.focus(); return; }
  viewerCode=code; S=null; resetTable(); connect(); if (wsOpen) raw({t:"watch", code});
});
els.eResume.addEventListener("click",()=>{ if (!sess) return; viewerCode=null; resumeOK=true; S=null; resetTable(); connect(); if (wsOpen) raw({t:"join", code:sess.code, token:sess.token}); });
els.eCode.addEventListener("input",()=>{ els.eCode.value=els.eCode.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4); });

/* ---------- state handling & animation ---------- */
let shown={handId:null, street:-1, diceDone:false, dealing:false, po:false};
let busy=false, pendingRender=false, auto=false, eqCache=null, covered=false, sel=null;
let readyDeadline=0, autoAt=0, autoKey=null;
function readyState(){
  const h=S && S.hand; if (!h || !h.need) return null;
  const need=h.need, done=need.filter(id=>h.ready.includes(id)).length;
  const left=Math.max(0, readyDeadline-Date.now());
  return {need:need.length, done, left, blocked: done<need.length && left>0, mine: need.includes(myId), meReady: h.ready.includes(myId)};
}

function hk(h){ return h ? h.id+":"+h.street+":"+(h.dice?1:0)+":"+(h.playoff&&h.playoff.board?1:0) : "none"; }
function poPending(h){ return !!(h && h.street===4 && h.playoff && !h.playoff.board); }
function poDealt(h){ return !!(h && h.playoff && h.playoff.board); }
function mode(){ return S && S.hand ? S.hand.mode : (S ? S.settings.mode : "nlhe"); }
function me(){ return S && myId ? S.players.find(p=>p.id===myId) : null; }
function isHost(){ return !!(S && S.you && S.you.host); }
function pname(id){ const p=S && S.players.find(x=>x.id===id); return p ? p.name : "Gracz"; }

const APP_VER="1.7";
function onState(st){
  // a phone still running an older app.js than the server: reload once to pick up the new files
  if (st.ver && st.ver!==APP_VER){
    let tried=null; try{ tried=sessionStorage.getItem("prVerReload"); }catch(e){}
    if (tried!==st.ver){ try{ sessionStorage.setItem("prVerReload", st.ver); }catch(e){} location.reload(); return; }
  }
  if (st.hand) readyDeadline = Date.now() + (st.hand.readyLeft||0);
  const prevSettings = S && S.settings;
  S=st; myId=st.you && st.you.id || null; viewer=!!(st.you && st.you.viewer);
  checkRules(prevSettings);
  if (els.game.hidden) showGame();
  renderChrome();
  if (busy){ pendingRender=true; quickRefresh(); return; }
  drive();
}
function drive(){
  const h=S.hand;
  if (!h){
    if (shown.handId!==null){ resetTable(); }
    if (!els.board.childElementCount) renderBoard(null,0,null);
    refresh(); return;
  }
  if (h.id!==shown.handId){ startHand(h); return; }
  if (h.street!==shown.street){ advanceStreet(h); return; }
  if (h.dice && !shown.diceDone){ animateDice(h); return; }
  if (poDealt(h) && !shown.po){ animatePlayoff(h); return; }
  refresh();
}
function done(ms){
  later(()=>{
    busy=false; shown.dealing=false;
    if (pendingRender){ pendingRender=false; drive(); if (busy) return; }
    else refresh();
    maybeAuto();
  }, ms);
}
function resetTable(){
  tk++; poAnim=false; busy=false; pendingRender=false; auto=false; eqCache=null; sel=null;
  shown={handId:null, street:-1, diceDone:false, dealing:false, po:false};
  els.banner.hidden=true; els.diceRow.hidden=true; els.board.innerHTML="";
}
function startHand(h){
  tk++; poAnim=false; eqCache=null; sel=null; covered=false;
  const animate = h.street===0;
  shown={handId:h.id, street:h.street, diceDone:!!h.dice, dealing:animate, po:poDealt(h)};
  els.banner.hidden=true; setMeta(); renderControls();
  renderBoard(h, BOARD_N[h.street], null);
  diceStatic(h);
  busy=true;
  renderMine(animate);
  renderSeats(animate);
  if (h.street===4){ busy=false; shown.dealing=false; refresh(); return; }
  const n=h.order.length, hole=MODES[h.mode].hole;
  done(animate ? hole*n*sp().gap + sp().flip + 450 : 50);
}
function advanceStreet(h){
  tk++; eqCache=null;
  const from=BOARD_N[shown.street];
  const diceToShow = h.street===3 && h.dice && !shown.diceDone;
  shown.street=h.street;
  if (h.dice && !shown.diceDone && !diceToShow){ shown.diceDone=true; diceStatic(h); }
  setMeta();
  if (h.street===4){ showdownRender(h); return; }
  busy=true;
  renderBoard(h, BOARD_N[h.street], from);
  refresh();
  const added=BOARD_N[h.street]-from;
  const wait=Math.max(0,added-1)*sp().board + (h.boards.length-1)*90 + sp().flip + 520;
  if (diceToShow){ later(()=>animateDice(S.hand), wait); return; }
  done(wait);
}
function showdownRender(h){
  busy=true;
  shown.po = poDealt(h);
  renderBoard(h, 5, null); diceStatic(h);
  refresh();
  done(500);
}

let poAnim=false;
function animatePlayoff(h){
  tk++; busy=true; shown.po=true; poAnim=true;
  els.banner.hidden=true;
  renderBoard(h, 5, null, true);
  setMeta(); renderSeats(false); renderControls();
  const t=4*sp().board + sp().flip + 900;
  later(()=>{ poAnim=false; }, t-20);
  done(t);
}

/* ---------- board ---------- */
function dicePos(d,b){ return d && d.rolls[b]<=5 ? d.rolls[b]-1 : -1; }
function boardCardAt(h,b,i){ return (h.dice && !shown.diceDone && dicePos(h.dice,b)===i) ? h.dice.old[b] : h.boards[b][i]; }
function boardsNow(h){ return h.boards.map((bd,b)=>bd.slice(0,BOARD_N[h.street]).map((c,i)=>boardCardAt(h,b,i))); }
function renderBoard(h, count, animFrom, poAnim){
  els.board.innerHTML="";
  const nb = h ? h.boards.length : (S ? S.settings.boards : 1);
  els.board.classList.toggle("multi", nb>1);
  for (let b=0;b<nb;b++){
    const row=document.createElement("div"); row.className="brow";
    if (nb>1){ const l=document.createElement("span"); l.className="blabel"; l.textContent=b+1; row.appendChild(l); }
    for (let i=0;i<5;i++){
      let el;
      if (h && i<count && h.boards[b][i]!=null) el=makeCard(boardCardAt(h,b,i), true, (animFrom!=null && i>=animFrom) ? (i-animFrom)*sp().board + b*90 : null);
      else el=slot();
      el.dataset.b=b; el.dataset.i=i;
      if (i===3||i===4) el.classList.add("gap");
      if (h && h.dice && shown.diceDone && dicePos(h.dice,b)===i && i<count) el.classList.add("swapped");
      row.appendChild(el);
    }
    els.board.appendChild(row);
  }
  // dogrywka board (3-board games, tied lead)
  if (h && h.playoff && h.playoff.board && shown.po){
    const row=document.createElement("div"); row.className="brow po";
    const l=document.createElement("span"); l.className="blabel"; l.textContent="D"; l.title="Dogrywka"; row.appendChild(l);
    h.playoff.board.forEach((c,i)=>{
      const el=makeCard(c, true, poAnim ? i*sp().board + 250 : null);
      el.dataset.b="po"; el.dataset.i=i; if (i===3||i===4) el.classList.add("gap");
      row.appendChild(el);
    });
    els.board.appendChild(row);
  }
}

/* ---------- dice ---------- */
function setDie(n, el){ el.innerHTML=""; for (let i=0;i<9;i++){ const s=document.createElement("span"); if (PIPS[n].includes(i)) s.className="on"; el.appendChild(s); } }
function smallDice(rolls, rolling){
  els.diceSet.innerHTML="";
  const multi=rolls.length>1, out=[];
  rolls.forEach((r,b)=>{
    const w=document.createElement("div"); w.className="dwrap";
    if (multi){ const l=document.createElement("span"); l.className="blabel"; l.textContent=b+1; w.appendChild(l); }
    const d=document.createElement("div"); d.className="die"+(rolling?" rolling":""); d.setAttribute("role","img"); d.setAttribute("aria-label",(multi?"board "+(b+1)+", ":"")+"kostka: "+r);
    setDie(r, d); w.appendChild(d); els.diceSet.appendChild(w); out.push(d);
  });
  return out;
}
function cardTxt(c){ return '<span class="cardtxt '+SUIT_CLS[c&3]+'">'+rn(c>>2)+SUIT_SYM[c&3]+'</span>'; }
function diceMsg(d){
  const nb=d.rolls.length;
  if (nb===1){ const r=d.rolls[0]; return r===6 ? "Wypadło 6: stół bez zmian." : "Wypadło "+r+": "+ORD[r-1]+" karta wymieniona "+cardTxt(d.old[0])+" → "+cardTxt(d.neu[0]); }
  return d.rolls.map((r,b)=>'<span class="dline"><b>'+(b+1)+'</b> · '+(r===6 ? "6, bez zmian" : r+": "+cardTxt(d.old[b])+" → "+cardTxt(d.neu[b]))+'</span>').join("");
}
function diceStatic(h){
  if (!h || !h.dice){ els.diceRow.hidden=true; return; }
  els.diceRow.hidden=false; els.diceRow.classList.toggle("multi", h.dice.rolls.length>1);
  smallDice(h.dice.rolls, false); els.diceText.innerHTML=diceMsg(h.dice);
}
let throwTimers=[], throwState=null;
function restartAnim(e){ e.style.animation="none"; void e.offsetWidth; e.style.animation=""; }
function playThrow(rolls, onDone){
  throwTimers.forEach(clearTimeout); throwTimers=[];
  if (throwState && throwState.spin) clearInterval(throwState.spin);
  const cfg=THROW[curSpeed()]||THROW.norm, th=cfg.th, nb=rolls.length, stag=170;
  const fly=Math.round(th*0.5), start=Math.round(th*0.64);
  const ov=els.throw, fig=els.throwFig;
  ov.classList.remove("show","out","shake");
  ov.querySelectorAll(".dthrow,.burst").forEach(e=>e.remove());
  ov.style.setProperty("--th", th+"ms"); ov.style.setProperty("--fly", fly+"ms");
  fig.classList.remove("cheer","leave"); restartAnim(fig);
  els.throwBubble.textContent = nb>1 ? "Rzucam ×"+nb+"!" : "Rzucam!"; els.throwBubble.classList.remove("res"); restartAnim(els.throwBubble);
  const wraps=rolls.map((r,b)=>{
    const w=document.createElement("div"); w.className="dthrow"+(nb>1?" sm":"");
    const dx=((b-(nb-1)/2)*(nb>2?106:120))+"px";
    w.style.setProperty("--dx", dx); w.style.setProperty("--ds", nb>2?"1.3":"1.5"); w.style.animationDelay=(start+b*stag)+"ms";
    const face=document.createElement("div"); face.className="die"; setDie(1+((b*2+3)%6), face); w.appendChild(face);
    const res=document.createElement("span"); res.className="dres"; res.textContent=(nb>1?(b+1)+": ":"")+(r===6?"bez zmian":(nb>1?r+". karta":ORD[r-1]+" karta")); w.appendChild(res);
    const burst=document.createElement("div"); burst.className="burst"; burst.style.setProperty("--dx", dx);
    ov.appendChild(burst); ov.appendChild(w);
    return {w, face, burst, landed:false};
  });
  ov.hidden=false; void ov.offsetWidth; ov.classList.add("show");
  const st={finished:false, spin:null}; throwState=st;
  let f=0; st.spin=setInterval(()=>{ f++; wraps.forEach((x,b)=>{ if (!x.landed) setDie(1+((f+b*3)%6), x.face); }); }, 85);
  const land=b=>{
    const x=wraps[b]; if (x.landed) return; x.landed=true;
    setDie(rolls[b], x.face); x.w.classList.add("landed"); x.burst.classList.add("go");
    ov.classList.remove("shake"); void ov.offsetWidth; ov.classList.add("shake");
    if (wraps.every(y=>y.landed)){
      clearInterval(st.spin);
      els.throwBubble.textContent = nb===1 ? (rolls[0]===6 ? "6! Bez zmian" : rolls[0]+"!") : rolls.join(" · ");
      els.throwBubble.classList.add("res"); restartAnim(els.throwBubble); fig.classList.add("cheer");
    }
  };
  const finish=()=>{
    if (st.finished) return; st.finished=true;
    throwTimers.forEach(clearTimeout); throwTimers=[]; clearInterval(st.spin);
    ov.classList.add("out"); fig.classList.remove("cheer"); fig.classList.add("leave");
    setTimeout(()=>{ ov.hidden=true; ov.classList.remove("show","out","shake"); if (onDone) onDone(); }, 400);
  };
  rolls.forEach((_,b)=>throwTimers.push(setTimeout(()=>land(b), start+fly+b*stag)));
  throwTimers.push(setTimeout(finish, start+fly+(nb-1)*stag+cfg.hold));
  ov.onclick=()=>{
    if (st.finished) return;
    if (!wraps.every(x=>x.landed)){
      throwTimers.forEach(clearTimeout); throwTimers=[];
      wraps.forEach((x,b)=>{ x.w.style.animation="none"; x.w.style.opacity="1"; x.w.style.transform="translate("+x.w.style.getPropertyValue("--dx")+",-9vh) rotate(720deg) scale("+x.w.style.getPropertyValue("--ds")+")"; land(b); });
      throwTimers.push(setTimeout(finish, 900));
    } else finish();
  };
}
function animateDice(h){
  const d=h.dice, nb=d.rolls.length;
  busy=true; eqCache=null;
  els.diceRow.hidden=false; els.diceRow.classList.toggle("multi", nb>1);
  const smalls=smallDice(d.rolls.map((_,b)=>1+b), true);
  els.diceText.textContent = nb>1 ? "Lecą kostki…" : "Leci kostka…";
  refresh();
  let f=0; const spin=setInterval(()=>smalls.forEach((e,b)=>setDie(1+((f+b*2)%6), e), f++), 80);
  const t0=tk;
  playThrow(d.rolls, ()=>{
    clearInterval(spin);
    if (t0!==tk) return;
    smalls.forEach((e,b)=>{ e.classList.remove("rolling"); setDie(d.rolls[b], e); void e.offsetWidth; e.classList.add("landed"); });
    els.diceText.innerHTML=diceMsg(d);
    const swaps=d.rolls.map((r,b)=>r<=5 ? {b, i:r-1, el:els.board.querySelector('.card[data-b="'+b+'"][data-i="'+(r-1)+'"]')} : null).filter(Boolean);
    if (!swaps.length){ shown.diceDone=true; done(250); return; }
    swaps.forEach(x=>{ if (x.el) x.el.classList.add("down"); });
    later(()=>{
      shown.diceDone=true;
      swaps.forEach((x,k)=>{
        const el=makeCard(d.neu[x.b], true, k*110); el.classList.add("swapped"); if (x.i>=3) el.classList.add("gap");
        el.dataset.b=x.b; el.dataset.i=x.i;
        if (x.el && x.el.parentNode) x.el.parentNode.replaceChild(el, x.el);
      });
      done(sp().flip+520+(swaps.length-1)*110);
    }, 520);
  });
}

/* ---------- derived ---------- */
function effHole(h, id){
  const cards=h.holes[id]; if (!cards) return null;
  const d=h.discards && h.discards[id];
  return (typeof d==="number") ? cards.filter(c=>c!==d) : cards;
}
function allKnown(h){ return h.order.every(id=>h.holes[id]); }
function equity(h){
  if (!allKnown(h) || h.street>=4) return null;
  // while the dice are still flying, keep showing the odds from before the roll (old board card, dice still to come)
  const dicePending = !!(h.dice && !shown.diceDone);
  const key=hk(h)+":"+(dicePending?"p":"")+":"+JSON.stringify(h.discards||{});
  if (eqCache && eqCache.key===key) return eqCache.v;
  const m=MODES[h.mode], kb=boardsNow(h);
  const holes=h.order.map(id=>{ const e=effHole(h,id); return e.length===3 ? E.keep2(e, kb) : e; });
  const dead=[]; if (m.pine) h.order.forEach(id=>h.holes[id].forEach(c=>dead.push(c)));
  const withDice = h.wantDice && (!h.dice || dicePending) && h.street<=3;
  const v=E.equityMulti(holes, kb, m.omaha, withDice, dead);
  if (m.pine && h.discards && h.order.some(id=>typeof h.discards[id]!=="number")) v.approx=true;
  eqCache={key, v}; return v;
}
function resultLocal(h){
  if (h.street!==4 || !allKnown(h)) return null;
  return E.resultFor(h.order.map(id=>effHole(h,id)), h.boards, h.mode, (shown.po && !poAnim && h.playoff && h.playoff.board) || null);
}
function madeTexts(h, id){
  const m=MODES[h.mode], kb=boardsNow(h), eh=effHole(h,id);
  if (!eh) return null;
  const use = eh.length===3 ? E.keep2(eh, kb) : eh;
  if (!kb[0].length) return null;
  return kb.map(bd=>E.describe(E.bestDetailed(use, bd, m.omaha).score));
}
function handLabel(c){
  if (c.length!==2) return null;
  const a=c[0]>>2, b=c[1]>>2, hi=Math.max(a,b), lo=Math.min(a,b);
  if (a===b) return "Para kieszonkowa "+rn(a);
  return rn(hi)+rn(lo)+((c[0]&3)===(c[1]&3)?" w kolorze":" różnokolorowe");
}

/* ---------- rendering ---------- */
function renderChrome(){
  els.codeTxt.textContent=S.code;
  els.app.classList.toggle("twocolor", !prefs.fourColor);
  document.querySelectorAll(".host-only").forEach(e=>e.hidden=!isHost());
  document.querySelectorAll(".player-only").forEach(e=>e.hidden=viewer);
  els.mLeave.hidden=false; els.mLeave.textContent = viewer ? "Zamknij ekran stołu" : "Opuść stół";
  els.mAbort.hidden=!isHost() || !S.hand || (S.hand.street===4 && !poPending(S.hand));
  const m=me(); els.mSit.textContent = m && m.sitOut ? "Wracam do gry" : "Pauzuję (nie rozdawaj mi)";
  els.scoreBtn.hidden=false;
}
function quickRefresh(){ renderSeats(false, true); renderControls(); if (!els.scoreSheet.hidden) renderScore(); }
function setMeta(){
  const h=S.hand;
  els.street.textContent = !h ? "Lobby" : (h.street===3 && h.dice ? "Kostka" : (h.street===4 && h.playoff ? "Dogrywka" : STREETS[h.street]));
  els.handNo.textContent = h ? "#"+h.no+" · pula "+fmt(h.stake*h.order.length) : "";
  els.modeName.textContent = MODE_SHORT[mode()] + (h && h.boards.length>1 ? " ×"+h.boards.length : "");
}
function refresh(){
  setMeta();
  renderLobby();
  renderMine(false);
  renderSeats(false);
  renderBanner();
  renderControls();
  renderReady();
  if (!els.scoreSheet.hidden) renderScore();
}
function renderLobby(){
  const h=S.hand, n=S.players.length;
  const show = !viewer && !h;
  els.lobbyBar.hidden=!show;
  if (show){
    els.lobbyTitle.textContent = "Stół "+S.code;
    els.lobbySub.textContent = n<2 ? "Czekamy na graczy — podaj im kod." : n+" graczy przy stole"+(isHost() ? " · możesz rozdawać" : " · czekamy na hosta");
  }
}
function renderBanner(){
  const h=S.hand, res=h && resultLocal(h);
  const bcards=[...els.board.querySelectorAll(".card")];
  bcards.forEach(c=>c.classList.remove("used","dim"));
  if (!res || busy && shown.street!==4){ els.banner.hidden=true; return; }
  res.per.forEach((p,b)=>{
    const used=new Set(); p.winners.forEach(w=>p.det[w].cards.forEach(c=>used.add(c)));
    els.board.querySelectorAll('.card[data-b="'+b+'"]').forEach(c=>c.classList.add(used.has(+c.dataset.c)?"used":"dim"));
  });
  const deltas=(h.result && h.result.deltas)||{};
  const nmOf=i=>esc(pname(h.order[i]));
  const multi=h.boards.length>1, pot=h.stake*h.order.length;
  els.banner.hidden=false; els.banner.classList.toggle("multi", multi);
  if (!multi){
    const p=res.per[0], w=p.winners;
    els.banner.innerHTML=(w.length===1 ? nmOf(w[0])+" wygrywa"+(pot>0?" "+sg(deltas[h.order[w[0]]]||0)+" pkt":"") : "Remis! Pula dzielona: "+w.map(nmOf).join(" i ")+(pot>0?" · "+sg(deltas[h.order[w[0]]]||0)+" pkt każdy":""))+' <small>· '+E.describe(p.best)+'</small>';
  } else if (res.majority && (res.pending || res.po)){
    const lines=res.per.map((p,b)=>'<span class="bl"><b>'+(b+1)+'</b> · '+(p.winners.length===1 ? nmOf(p.winners[0]) : "remis: "+p.winners.map(nmOf).join(" i "))+' · '+E.describe(p.best)+'</span>');
    const tied=res.leaders.map(nmOf).join(", ");
    let head;
    if (res.pending) head="Remis po "+fmt(Math.round(res.pts[res.leaders[0]]*100)/100)+" boardzie: "+tied+" · dogrywka!";
    else {
      const w=res.po.winners;
      head = w.length===1 ? "Dogrywka: "+nmOf(w[0])+" bierze całą pulę"+(pot>0?" "+sg(deltas[h.order[w[0]]]||0)+" pkt":"")
                          : "Dogrywka: remis "+w.map(nmOf).join(" i ")+(pot>0?" · "+sg(deltas[h.order[w[0]]]||0)+" pkt każdy":"");
      const used=new Set(); w.forEach(i=>res.po.det[i].cards.forEach(c=>used.add(c)));
      els.board.querySelectorAll('.card[data-b="po"]').forEach(c=>c.classList.add(used.has(+c.dataset.c)?"used":"dim"));
      lines.push('<span class="bl"><b>D</b> · '+(w.length===1?nmOf(w[0]):"remis: "+w.map(nmOf).join(" i "))+' · '+E.describe(res.po.best)+'</span>');
    }
    els.banner.innerHTML='<span>'+head+'</span>'+lines.join("");
  } else if (res.majority){
    const lines=res.per.map((p,b)=>'<span class="bl"><b>'+(b+1)+'</b> · '+(p.winners.length===1 ? nmOf(p.winners[0]) : "remis: "+p.winners.map(nmOf).join(" i "))+' · '+E.describe(p.best)+'</span>');
    const L=res.leaders[0];
    els.banner.innerHTML='<span>'+nmOf(L)+' wygrywa '+fmt(Math.round(res.pts[L]*100)/100)+' z 3 boardów i bierze całą pulę'+(pot>0?" "+sg(deltas[h.order[L]]||0)+" pkt":"")+'</span>'+lines.join("");
  } else {
    const lines=res.per.map((p,b)=>'<span class="bl"><b>'+(b+1)+'</b> · '+(p.winners.length===1 ? nmOf(p.winners[0]) : "remis: "+p.winners.map(nmOf).join(" i "))+' · '+E.describe(p.best)+'</span>');
    const gains=h.order.map((_,i)=>i).filter(i=>res.share[i]>0).sort((a,b)=>res.share[b]-res.share[a]).map(i=>nmOf(i)+(pot>0?" "+sg(deltas[h.order[i]]||0):" "+Math.round(res.share[i]*100)+"%"));
    els.banner.innerHTML='<span>'+gains.join(" · ")+'</span>'+lines.join("");
  }
}
function renderMine(animate){
  const h=S.hand;
  const inHand = h && myId && h.holes[myId];
  els.mine.hidden = viewer || !inHand;
  const m=me();
  els.sitNote.hidden = viewer || !!inHand || !m;
  if (!els.sitNote.hidden){
    els.sitNote.textContent = m.sitOut ? "Pauzujesz — nie dostaniesz kart, dopóki nie wrócisz do gry (menu ☰)." :
      (h && h.street<4 ? "Dostaniesz karty od następnego rozdania." : (h ? "Czekamy na następne rozdanie." : (isHost() ? "Gdy wszyscy dołączą, naciśnij „Rozdaj”." : "Czekamy, aż host rozda karty.")));
  }
  if (!inHand) return;
  const cards=h.holes[myId], n=cards.length;
  const disc = h.discards ? h.discards[myId] : null;
  const canPick = h.discards && h.street===1 && disc==null;
  els.mineCards.className="minecards n"+n+(canPick?" pick":"")+(covered?" covered":"");
  els.mineCards.style.setProperty("--n", n);
  if (animate || els.mineCards.dataset.hand!==h.id || els.mineCards.childElementCount!==n || canPick || els.mineCards.dataset.disc!==String(disc)){
    els.mineCards.innerHTML=""; els.mineCards.dataset.hand=h.id; els.mineCards.dataset.disc=String(disc);
    cards.forEach((c,k)=>{
      const el=makeCard(c, true, animate ? (k*h.order.length + h.order.indexOf(myId))*sp().gap : null);
      if (disc===c) el.classList.add("discarded");
      if (canPick){
        el.tabIndex=0; el.setAttribute("aria-label", cardLabel(c)+" — wybierz do wyrzucenia");
        if (sel===c) el.classList.add("sel");
        const pick=()=>{ sel = sel===c ? null : c; renderMine(false); };
        el.addEventListener("click",pick);
        el.addEventListener("keydown",e=>{ if (e.key==="Enter"||e.key===" "){ e.preventDefault(); pick(); } });
      }
      els.mineCards.appendChild(el);
    });
  }
  els.coverBtn.textContent = covered ? "Pokaż" : "Zasłoń";
  els.mineMade.hidden = covered;
  els.mineAct.hidden=!canPick;
  if (canPick){
    els.discardBtn.disabled = sel==null;
    els.discardBtn.textContent = sel==null ? "Dotknij kartę, którą wyrzucasz" : "Wyrzuć "+cardLabel(sel);
  }
  // made hand + equity
  els.mineMade.innerHTML="";
  if (shown.dealing){ return; }
  const txt=madeTexts(h, myId);
  if (txt){
    txt.forEach((t,b)=>{ const d=document.createElement("div"); d.className="mm"; d.innerHTML=(txt.length>1?'<small>Board '+(b+1)+'</small>':'')+esc(t); els.mineMade.appendChild(d); });
  } else {
    const d=document.createElement("div"); d.className="mm";
    d.textContent = MODES[h.mode].pine ? "3 karty · po flopie wyrzucasz jedną" : MODES[h.mode].omaha ? "Gra się 2 z ręki i 3 ze stołu" : (handLabel(cards)||"");
    els.mineMade.appendChild(d);
  }
  if (h.discards && h.street===1 && disc!=null){ const d=document.createElement("div"); d.className="eqline"; d.textContent="Wyrzucone. Czekamy na pozostałych ("+(h.order.length-h.pending.length)+"/"+h.order.length+")."; els.mineMade.appendChild(d); }
  const eq=equity(h);
  if (eq){ const i=h.order.indexOf(myId); const d=document.createElement("div"); d.className="eqline"; d.textContent="Szansa na wygraną: "+(eq.approx?"≈":"")+(eq.eq[i]*100).toFixed(1)+"%"; els.mineMade.appendChild(d); }
}
function renderSeats(animate, light){
  const h=S.hand, res=h && resultLocal(h), eq=h && !busy ? equity(h) : null;
  let maxEq=-1; if (eq) maxEq=Math.max.apply(null, eq.eq);
  const L=S.last;
  els.seats.innerHTML="";
  // in-hand players first (deal order), then the rest
  const ids = h ? h.order.concat(S.players.filter(p=>!h.order.includes(p.id)).map(p=>p.id)) : S.players.map(p=>p.id);
  ids.forEach(id=>{
    const p=S.players.find(x=>x.id===id);
    if (!p) return;
    const i = h ? h.order.indexOf(id) : -1;
    const row=document.createElement("article"); row.className="prow2"+(p.connected?"":" off");
    row.appendChild(avatar(p.name, p.id));
    const main=document.createElement("div"); main.className="main";
    const nm=document.createElement("span"); nm.className="nm";
    if (p.id===S.hostId){ const c=document.createElement("span"); c.className="crown"; c.textContent="♛"; c.title="Host"; nm.appendChild(c); }
    nm.appendChild(document.createTextNode(p.name));
    if (p.id===myId){ const y=document.createElement("span"); y.className="you"; y.textContent="ty"; nm.appendChild(y); }
    main.appendChild(nm);
    const st=document.createElement("span"); st.className="st";
    if (i<0) st.textContent = p.sitOut ? "pauzuje" : (h && h.street<4 ? "dołączy od następnego rozdania" : "czeka na rozdanie");
    else if (h.discards && h.street===1) st.innerHTML = h.discards[id]!=null ? '<span class="ok">✓ wyrzucił kartę</span>' : "wybiera kartę do wyrzucenia…";
    else if (res && res.pending) st.innerHTML = res.leaders.includes(i) ? '<span class="wait">dogrywka</span>' : "przegrywa";
    else if (res){ const sh=res.share[i]; st.textContent = sh>0 ? (sh>=0.999?"wygrywa":"bierze "+Math.round(sh*100)+"% puli") : "przegrywa"; }
    else { const rs=readyState(); if (rs && h.need.includes(id) && (rs.blocked || h.ready.includes(id))) st.innerHTML = h.ready.includes(id) ? '<span class="ok">✓ gotowy</span>' : '<span class="wait">ogląda karty…</span>'; else st.textContent = id===S.hostId ? "prowadzi grę" : "w rozdaniu"; }
    main.appendChild(st);
    row.appendChild(main);
    const pts=document.createElement("span"); const v=p.points;
    pts.className="pts"+(v>0?" pos":v<0?" neg":"");
    pts.innerHTML=sg(v)+" pkt"+(L && L.no && (id in L.d) && h && h.street===4 ? "<small>rozdanie "+sg(L.d[id])+"</small>" : "");
    row.appendChild(pts);
    if (i>=0){
      const cards=document.createElement("div");
      const hideMine = id===myId && covered && h.street<4;   // "Zasłoń" also covers my row in the list
      cards.className="cards"+(hideMine?" covered":"");
      cards.style.setProperty("--n", MODES[h.mode].hole);
      const known=h.holes[id];
      const n=MODES[h.mode].hole;
      for (let k=0;k<n;k++){
        const delay = animate ? (k*h.order.length+i)*sp().gap : null;
        const el = known ? makeCard(known[k], true, delay) : backCard(delay);
        if (known && h.discards && h.discards[id]===known[k]) el.classList.add("discarded");
        if (!known && h.discards && h.discards[id]!=null && k===n-1) el.classList.add("discarded");
        cards.appendChild(el);
      }
      if (eq && h.street<4){
        const pc=document.createElement("span"); pc.className="pct"; pc.textContent=(eq.approx?"≈":"")+(eq.eq[i]*100).toFixed(1)+"%"; cards.appendChild(pc);
        if (eq.eq[i]===maxEq && maxEq>0) row.classList.add("lead");
      }
      if (res && res.pending){ if (!res.leaders.includes(i)) row.classList.add("lose"); else row.classList.add("lead"); }
      else if (res){
        const sh=res.share[i]; row.classList.add(sh>0?"win":"lose");
        if (sh>0){ const used=new Set(); res.per.forEach(pp=>{ if (pp.winners.includes(i)) pp.det[i].cards.forEach(c=>used.add(c)); }); cards.querySelectorAll(".card").forEach(c=>{ if (!c.classList.contains("discarded")) c.classList.add(used.has(+c.dataset.c)?"used":"dim"); }); }
      }
      row.appendChild(cards);
      if (known && !hideMine && !shown.dealing && !animate){
        const kb=boardsNow(h);
        if (kb[0].length){
          const md=document.createElement("div"); md.className="made2";
          const eh=effHole(h,id), use=eh.length===3?E.keep2(eh,kb):eh;
          kb.forEach((bd,b)=>{ const s=document.createElement("span"); s.className="bm"; s.textContent=(kb.length>1?(b+1)+": ":"")+E.describe(E.bestDetailed(use,bd,MODES[h.mode].omaha).score)+(res && res.per[b].winners.includes(i)?" ✓":""); md.appendChild(s); });
          row.appendChild(md);
        }
      }
    }
    els.seats.appendChild(row);
  });
}
function renderReady(){
  const rs=readyState(), h=S && S.hand;
  const pickPending = h && h.discards && h.street===1 && myId && h.discards[myId]==null;
  const show = !!(rs && rs.mine && !viewer && !pickPending && (rs.blocked || rs.meReady) && !busy);
  els.readyBar.hidden=!show;
  if (!show) return;
  els.readyBar.classList.toggle("done", rs.meReady);
  els.readyBtn.disabled = rs.meReady;
  els.readyBtn.textContent = rs.meReady ? "✓ Gotowe" : (h.street===4 ? "Gotowy na następne rozdanie" : "Gotowy");
  els.readyInfo.innerHTML = rs.meReady ? (rs.done<rs.need ? "Czekamy na resztę: <b>"+rs.done+"/"+rs.need+"</b> · <span class=\"timerpill\">"+Math.ceil(rs.left/1000)+" s</span>" : "Wszyscy gotowi.")
    : "Potwierdź, że widzisz karty · <span class=\"timerpill\">"+Math.ceil(rs.left/1000)+" s</span>";
}
els.readyBtn.addEventListener("click", ()=>{
  const h=S && S.hand; if (!h || !myId) return;
  if (!h.ready.includes(myId)) h.ready.push(myId);
  send({t:"ready"}); renderReady(); renderSeats(false);
});
setInterval(()=>{
  if (!S || !S.hand) return;
  const rs=readyState(); if (!rs) return;
  if (rs.need && (rs.blocked || !els.readyBar.hidden)) { renderReady(); renderControls(); }
  // auto-play for the host: move on as soon as the table allows it
  const h=S.hand;
  if (auto && isHost() && !busy && Date.now()>=autoAt && !rs.blocked && !h.pending.length && (h.street<4 || poPending(h)) && autoKey!==hk(h)){ autoKey=hk(h); next(); }
}, 500);
function renderControls(){
  const h=S.hand, host=isHost() && !viewer;
  const pend = h ? h.pending.length : 0;
  const rs = readyState();
  els.primary.hidden=!host;
  els.settingsBtn.hidden=!host || (h && h.street<4) || poPending(h);
  els.autoBtn.hidden=!host || !h || (h.street===4 && !poPending(h));
  els.autoDiscard.hidden=!host || !pend;
  els.autoBtn.innerHTML = auto ? PAUSE_SVG : PLAY_SVG; els.autoBtn.classList.toggle("on", auto); els.autoBtn.setAttribute("aria-label", auto ? "Zatrzymaj odtwarzanie" : "Odtwórz rozdanie do końca");
  if (host){
    const seated=S.players.filter(p=>!p.sitOut).length;
    let label;
    if (!h) label = seated<2 ? "Czekamy na graczy ("+seated+"/2)" : "Rozdaj";
    else if (pend) label = "Czekamy na wyrzucenie ("+(h.order.length-pend)+"/"+h.order.length+")";
    else if (h.street===3 && h.wantDice && !h.dice) label = h.boards.length>1 ? "Rzuć kostkami" : "Rzuć kostką";
    else if (poPending(h)) label = "Dogrywka";
    else label = ["Flop","Turn","River","Pokaż zwycięzcę","Następne rozdanie"][h.street];
    const waitReady = !!(h && !pend && rs && rs.blocked);
    if (waitReady) label = "Czekamy na graczy "+rs.done+"/"+rs.need+" · "+Math.ceil(rs.left/1000)+" s";
    els.primary.textContent=label;
    els.primary.disabled = busy || !!pend || waitReady || (!h && seated<2) || (h && h.street===4 && seated<2);
  }
  els.waitLine.hidden = host || viewer;
  if (!els.waitLine.hidden){
    els.waitLine.innerHTML = !h ? "Rozdaje <b>"+esc(pname(S.hostId))+"</b> (host)." : (pend ? "Czekamy, aż wszyscy wyrzucą kartę ("+(h.order.length-pend)+"/"+h.order.length+")." : (poPending(h) ? "Remis na boardach — <b>"+esc(pname(S.hostId))+"</b> rozda dogrywkę." : h.street===4 ? "Następne rozdanie rozda <b>"+esc(pname(S.hostId))+"</b>." : "Grę prowadzi <b>"+esc(pname(S.hostId))+"</b>."));
  }
}

/* ---------- host actions ---------- */
function next(){
  if (!isHost() || busy) return;
  const h=S.hand;
  send({t:"next", handId: h ? hk(h) : undefined});
}
function maybeAuto(){
  if (!auto || !isHost()) return;
  const h=S.hand;
  if (!h || (h.street===4 && !poPending(h))){ auto=false; renderControls(); return; }
  autoAt = Date.now() + sp().step;   // the 500 ms ticker sends "next" once the table is ready
}
els.primary.addEventListener("click", ()=>{ requestWake(); next(); });
els.autoBtn.addEventListener("click", ()=>{ auto=!auto; autoKey=null; autoAt=0; renderControls(); });
els.autoDiscard.addEventListener("click", ()=>send({t:"autoDiscard"}));
els.settingsBtn.addEventListener("click", openSettings);
els.mSettings.addEventListener("click", openSettings);
els.mAbort.addEventListener("click", ()=>{ auto=false; send({t:"abort"}); });

/* ---------- my actions ---------- */
els.discardBtn.addEventListener("click", ()=>{ if (sel==null) return; send({t:"discard", card:sel}); sel=null; });
els.coverBtn.addEventListener("click", ()=>{ covered=!covered; renderMine(false); renderSeats(false); });
els.mSit.addEventListener("click", ()=>{ const m=me(); if (m) send({t:"sitOut", value:!m.sitOut}); });
els.mRename.addEventListener("click", ()=>{ const m=me(); els.nameIn.value=m?m.name:""; openSheet(els.nameSheet); setTimeout(()=>els.nameIn.focus(),50); });
els.nameForm.addEventListener("submit", e=>{ e.preventDefault(); const n=els.nameIn.value.trim(); if (n){ send({t:"rename", name:n}); if (sess){ sess.name=n; saveJSON(SESS_KEY,sess); } } closeSheet(els.nameSheet); });
els.mLeave.addEventListener("click", ()=>{
  if (viewer){ viewerCode=null; wantConn=false; try{ ws.close(); }catch(e){} S=null; showEntry(); return; }
  els.leaveNote.textContent = isHost() ? "Jesteś hostem — prowadzenie stołu przejdzie na innego gracza. Twoje punkty przepadną." : "Stracisz miejsce przy stole i swoje punkty.";
  els.leaveSheet.hidden=false;
});
els.leaveNo.addEventListener("click", ()=>{ els.leaveSheet.hidden=true; });
els.leaveYes.addEventListener("click", ()=>{ els.leaveSheet.hidden=true; send({t:"leave"}); });

/* ---------- rules pop-up: shown to everyone (except the host who made the change) when the host changes the rules ---------- */
let rulesRevSeen=null;
function rulesRows(s){
  return [
    ["mode","Gra", MODES[s.mode].name + (MODES[s.mode].pine ? " · 3 karty, po flopie wyrzucasz jedną" : MODES[s.mode].omaha ? " · 2 z ręki i 3 ze stołu" : "")],
    ["stake","Stawka", s.stake+" pkt od gracza"],
    ["boards","Boardy", s.boards===1 ? "1 board" : s.boards===2 ? "2 boardy · pula dzielona na 2" : "3 boardy · 2 wygrane = cała pula, remis → dogrywka"],
    ["dice","Kostka po riverze", s.dice ? "tak · 1–5 wymienia kartę, 6 nic" : "bez kostki"],
    ["reveal","Karty graczy", s.reveal ? "odkryte dla wszystkich" : "każdy widzi tylko swoje"]
  ];
}
function checkRules(prev){
  const rev=S.rulesRev||0;
  if (rulesRevSeen===null || !prev){ rulesRevSeen=rev; return; }
  if (rev===rulesRevSeen) return;
  rulesRevSeen=rev;
  if (isHost()){ toast("Zasady zapisane. Gracze dostali powiadomienie."); return; }
  showRules(prev);
}
function showRules(prev){
  const s=S.settings, h=S.hand, mid = h && h.street<4;
  els.rulesList.innerHTML="";
  rulesRows(s).forEach(([k,label,val])=>{
    const ch = prev && prev[k]!==s[k];
    const li=document.createElement("li"); if (ch) li.className="chg";
    li.innerHTML='<span class="rl">'+esc(label)+'</span><span class="rv">'+esc(val)+'</span>'+(ch?'<span class="rnew">nowe</span>':'');
    els.rulesList.appendChild(li);
  });
  els.rulesNote.textContent = (pname(S.hostId)+" zmienił zasady.") + (mid ? " Obowiązują od następnego rozdania." : "");
  els.rulesPop.hidden=false;
  els.rulesOk.focus();
  if (viewer) setTimeout(()=>{ els.rulesPop.hidden=true; }, 10000);   // table screen: nobody to tap OK
}
els.rulesOk.addEventListener("click", ()=>{ els.rulesPop.hidden=true; });
els.rulesPop.addEventListener("click", e=>{ if (e.target===els.rulesPop) els.rulesPop.hidden=true; });

/* ---------- sheets ---------- */
function openSheet(el){ el.hidden=false; }
function closeSheet(el){ el.hidden=true; }
document.querySelectorAll(".sheet").forEach(sh=>{
  sh.addEventListener("click", e=>{ if (e.target===sh || e.target.closest("[data-close]")) closeSheet(sh); });
});
document.addEventListener("keydown", e=>{ if (e.key==="Escape"){ document.querySelectorAll(".sheet").forEach(closeSheet); closeMenu(); } });

// share
function openShare(){
  const link=location.origin+"/"+S.code;
  els.bigCode.textContent=S.code;
  els.qrImg.src="/qr.svg?t="+encodeURIComponent(link);
  els.shareLink.value=link;
  openSheet(els.shareSheet);
}
els.codeBtn.addEventListener("click", openShare);
els.lobbyShare.addEventListener("click", openShare);
els.copyLink.addEventListener("click", ()=>{
  const v=els.shareLink.value;
  const ok=()=>toast("Skopiowano link do stołu.");
  if (navigator.clipboard) navigator.clipboard.writeText(v).then(ok, ()=>{ els.shareLink.select(); });
  else { els.shareLink.select(); try{ document.execCommand("copy"); ok(); }catch(e){} }
});

// scores
function renderScore(){
  const rows=S.players.map(p=>({id:p.id, name:p.name, pts:p.points, wins:p.wins, last: S.last && (p.id in S.last.d) ? S.last.d[p.id] : null}));
  rows.sort((a,b)=>b.pts-a.pts || b.wins-a.wins);
  els.scoreBody.innerHTML="";
  rows.forEach((r,i)=>{
    const tr=document.createElement("tr"); if (i===0 && r.pts>0) tr.className="lead";
    const cls=v=>v>0?"pos":v<0?"neg":"";
    tr.innerHTML='<td>'+(i+1)+'</td><td></td><td class="'+cls(r.last||0)+'">'+(r.last==null?"—":sg(r.last))+'</td><td>'+fmt(r.wins)+'</td><td class="tot '+cls(r.pts)+'">'+sg(r.pts)+'</td>';
    tr.children[1].textContent=r.name;
    els.scoreBody.appendChild(tr);
  });
  els.scoreNote.textContent=(S.hands?"Rozegrane rozdania: "+S.hands+". ":"")+"Suma punktów przy stole wynosi zero (poza graczami, którzy odeszli).";
  els.undoBtn.disabled=!S.last;
  els.undoBtn.textContent=S.last ? "Cofnij punkty z rozdania #"+S.last.no : "Brak rozdania do cofnięcia";
}
els.scoreBtn.addEventListener("click", ()=>{ renderScore(); openSheet(els.scoreSheet); });
els.undoBtn.addEventListener("click", ()=>send({t:"undo"}));
let resetArm=0;
els.resetPts.addEventListener("click", ()=>{
  if (!resetArm){ els.resetPts.textContent="Na pewno? Kliknij ponownie"; els.resetPts.classList.add("warn"); resetArm=setTimeout(()=>{ resetArm=0; els.resetPts.textContent="Wyzeruj punkty"; els.resetPts.classList.remove("warn"); }, 3500); return; }
  clearTimeout(resetArm); resetArm=0; els.resetPts.textContent="Wyzeruj punkty"; els.resetPts.classList.remove("warn");
  send({t:"resetPoints"}); toast("Punkty wyzerowane.");
});

// settings (host)
let draft=null;
function fanFor(key){
  const n=MODES[key].hole, f=document.createElement("span"); f.className="mfan"; f.setAttribute("aria-hidden","true");
  for (let i=0;i<n;i++){ const c=document.createElement("i"); c.style.transform="rotate("+((i-(n-1)/2)*(n>4?11:15))+"deg)"; f.appendChild(c); }
  return f;
}
function openSettings(){
  if (!isHost()) return;
  draft=Object.assign({}, S.settings);
  renderSettings(); openSheet(els.setSheet);
}
function renderSettings(){
  const d=draft, n=S.players.filter(p=>!p.sitOut).length, h=S.hand;
  els.setNote.hidden=!(h && h.street<4);
  els.variants.innerHTML="";
  E.MODE_ORDER.forEach(key=>{
    const b=document.createElement("button"); b.type="button"; b.className="vt";
    b.appendChild(fanFor(key)); const t=document.createElement("b"); t.textContent=MODE_SHORT[key]; b.appendChild(t);
    b.setAttribute("aria-pressed", String(d.mode===key));
    b.addEventListener("click",()=>{ d.mode=key; renderSettings(); });
    els.variants.appendChild(b);
  });
  const m=MODES[d.mode], mx=E.maxPlayersFor(d.mode, d.boards, d.dice), bad=n>mx;
  els.vHint.classList.toggle("err", bad);
  els.vHint.textContent = bad ? MODE_SHORT[d.mode]+(d.boards>1?" na "+d.boards+" boardach":"")+" mieści maksymalnie "+mx+" graczy, a przy stole jest "+n+". Ktoś musi pauzować albo zmień ustawienia." :
    m.pine ? "3 karty w ręce, po flopie każdy wyrzuca jedną." : m.omaha ? m.hole+(m.hole>4?" kart":" karty")+" w ręce, gra się 2 z ręki i 3 ze stołu." : "2 karty w ręce, dowolne 5 z 7.";
  els.stakeChips.innerHTML="";
  STAKES.forEach(v=>{
    const b=document.createElement("button"); b.type="button"; b.className="pchip"; b.textContent=v; b.style.setProperty("--c","var("+STAKE_COLORS[v]+")");
    b.setAttribute("aria-pressed", String(d.stake===v)); b.setAttribute("aria-label", v ? v+" punktów" : "bez punktów");
    b.addEventListener("click",()=>{ d.stake=v; els.stakeIn.value=""; renderSettings(); });
    els.stakeChips.appendChild(b);
  });
  if (document.activeElement!==els.stakeIn) els.stakeIn.value = STAKES.includes(d.stake) ? "" : d.stake;
  els.boardsChoice.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.nb===d.boards)));
  els.diceChoice.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", String((b.dataset.dice==="1")===d.dice)));
  els.revealChoice.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", String((b.dataset.rev==="1")===d.reveal)));
  // players
  els.setCount.textContent=S.players.length+" / 9";
  els.setPlayers.innerHTML="";
  S.players.forEach(p=>{
    const li=document.createElement("li"); li.className="pl";
    li.appendChild(avatar(p.name, p.id));
    const nm=document.createElement("span"); nm.className="pname"; nm.textContent=p.name+(p.id===S.hostId?" ♛":"")+(p.sitOut?" · pauzuje":"")+(p.connected?"":" · offline"); li.appendChild(nm);
    if (p.id!==S.hostId){
      const mk=document.createElement("button"); mk.type="button"; mk.className="mk"; mk.textContent="Zrób hostem";
      mk.addEventListener("click",()=>{ send({t:"makeHost", id:p.id}); closeSheet(els.setSheet); toast(p.name+" jest teraz hostem."); });
      li.appendChild(mk);
      const x=document.createElement("button"); x.type="button"; x.className="x"; x.textContent="×"; x.setAttribute("aria-label","Usuń gracza "+p.name);
      x.addEventListener("click",()=>{ send({t:"kick", id:p.id}); });
      li.appendChild(x);
    }
    els.setPlayers.appendChild(li);
  });
  els.setSave.textContent = h && h.street<4 ? "Zapisz (od następnego rozdania)" : "Zapisz";
}
els.boardsChoice.addEventListener("click",e=>{ const b=e.target.closest("button[data-nb]"); if (!b) return; draft.boards=+b.dataset.nb; renderSettings(); });
els.diceChoice.addEventListener("click",e=>{ const b=e.target.closest("button[data-dice]"); if (!b) return; draft.dice=b.dataset.dice==="1"; renderSettings(); });
els.revealChoice.addEventListener("click",e=>{ const b=e.target.closest("button[data-rev]"); if (!b) return; draft.reveal=b.dataset.rev==="1"; renderSettings(); });
els.stakeIn.addEventListener("input",()=>{ let v=Math.round(+els.stakeIn.value); if (els.stakeIn.value==="" || !isFinite(v) || v<0) return; draft.stake=Math.min(100000,v); renderSettings(); });
els.setSave.addEventListener("click",()=>{ send({t:"settings", settings:draft}); closeSheet(els.setSheet); toast(S.hand && S.hand.street<4 ? "Zapisane — od następnego rozdania." : "Zapisane."); });

/* ---------- menu & prefs ---------- */
function openMenu(){ els.menu.hidden=false; els.menuBtn.setAttribute("aria-expanded","true"); }
function closeMenu(){ els.menu.hidden=true; els.menuBtn.setAttribute("aria-expanded","false"); }
els.menuBtn.addEventListener("click",e=>{ e.stopPropagation(); els.menu.hidden ? openMenu() : closeMenu(); });
document.addEventListener("click",e=>{ if (!els.menu.hidden && !els.menu.contains(e.target) && e.target!==els.menuBtn) closeMenu(); });
els.menu.addEventListener("click",e=>{ if (e.target.closest(".mitem")) closeMenu(); });
els.fourc.checked=prefs.fourColor;
els.speed.addEventListener("change",()=>{ if (!isHost()) return; S.settings.speed=els.speed.value; send({t:"settings", settings:{speed:els.speed.value}}); toast("Tempo animacji zmienione dla wszystkich."); });
els.fourc.addEventListener("change",()=>{ prefs.fourColor=els.fourc.checked; saveJSON(PREF_KEY,prefs); els.app.classList.toggle("twocolor", !prefs.fourColor); });

/* ---------- wake lock ---------- */
let wake=null;
async function requestWake(){ try{ if (navigator.wakeLock && !wake && document.visibilityState==="visible"){ wake=await navigator.wakeLock.request("screen"); wake.addEventListener("release",()=>{ wake=null; }); } }catch(e){ wake=null; } }
document.addEventListener("visibilitychange",()=>{ if (document.visibilityState==="visible" && S) requestWake(); });

/* ---------- boot ---------- */
const lastName=loadJSON("pro-lastname");
const POKER=["Negreanu","Ivey","Hellmuth","Brunson","Moneymaker","Dwan"];
els.eName.value = "";                       // always start empty; the grey hint says what to type
els.eName.placeholder = "Wpisz swoje imię";
const pathCode = (location.pathname.match(/^\/([A-Za-z0-9]{4})$/)||[])[1];
const qCode = new URLSearchParams(location.search).get("k");
const preset = (pathCode || qCode || "").toUpperCase();
if (preset){ els.eCode.value=preset; setTab(true); }
showEntry();
// came back to the same table (phone slept, page reloaded): rejoin straight away
resumeOK = !!(sess && sess.token && (!preset || preset===sess.code));
connect();
if (preset && !(sess && sess.code===preset)) setTimeout(()=>{ if (!els.eName.value) els.eName.focus(); else els.eJoin.focus(); }, 100);
})();
