/* Poker Runout engine: shared by the server (Node) and the browser. */
(function(root, factory){
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PokerEngine = api;
})(typeof self !== "undefined" ? self : this, function(){
"use strict";
const P5 = 371293;
const RANKS = "23456789TJQKA";
const rn = r => r === 8 ? "10" : RANKS[r];
const MODES = {
  nlhe:{name:"Hold'em", hole:2, omaha:false, max:9},
  plo4:{name:"PLO4", hole:4, omaha:true, max:9},
  plo5:{name:"PLO5", hole:5, omaha:true, max:9},
  plo6:{name:"PLO6", hole:6, omaha:true, max:7},
  pine:{name:"Ananas", hole:3, omaha:false, max:9, pine:true}
};
const MODE_ORDER = ["nlhe","plo4","plo5","plo6","pine"];
const BOARD_N = [0,3,4,5,5];
/* ---------- hand evaluator ---------- */
const cnt = new Uint8Array(13);
function popcount(x){ x = x - ((x>>1)&0x55555555); x = (x&0x33333333) + ((x>>2)&0x33333333); return (((x + (x>>4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; }
function eval5(a,b,c,d,e){
  const ra=a>>2, rb=b>>2, rc=c>>2, rd=d>>2, re=e>>2;
  const mask=(1<<ra)|(1<<rb)|(1<<rc)|(1<<rd)|(1<<re);
  if (popcount(mask) === 5){
    const s=a&3;
    const flush=(b&3)===s&&(c&3)===s&&(d&3)===s&&(e&3)===s;
    let sh=-1;
    if (mask === 0x100F) sh = 3;
    else { const hi = 31 - Math.clz32(mask); if ((mask >>> (hi-4)) === 31) sh = hi; }
    if (sh >= 0) return (flush?8:4)*P5 + sh;
    let k=0; for (let r=12;r>=0;r--) if (mask & (1<<r)) k = k*13 + r;
    return (flush?5:0)*P5 + k;
  }
  cnt[ra]++; cnt[rb]++; cnt[rc]++; cnt[rd]++; cnt[re]++;
  let q=-1,t=-1,p1=-1,p2=-1,k=0;
  for (let r=12;r>=0;r--){
    const n=cnt[r]; if (!n) continue;
    if (n===1) k=k*13+r; else if (n===2){ if (p1<0) p1=r; else p2=r; } else if (n===3) t=r; else q=r;
  }
  cnt[ra]=0; cnt[rb]=0; cnt[rc]=0; cnt[rd]=0; cnt[re]=0;
  if (q>=0) return 7*P5 + q*13 + k;
  if (t>=0 && p1>=0) return 6*P5 + t*13 + p1;
  if (t>=0) return 3*P5 + t*169 + k;
  if (p2>=0) return 2*P5 + p1*169 + p2*13 + k;
  return P5 + p1*2197 + k;
}
function describe(score){
  const cat = Math.floor(score / P5), v = score % P5;
  switch(cat){
    case 8: return v===12 ? "Poker królewski" : "Poker do " + rn(v);
    case 7: return "Kareta " + rn(Math.floor(v/13));
    case 6: return "Full " + rn(Math.floor(v/13)) + " na " + rn(v%13);
    case 5: return "Kolor do " + rn(Math.floor(v/28561));
    case 4: return "Strit do " + rn(v);
    case 3: return "Trójka " + rn(Math.floor(v/169));
    case 2: return "Dwie pary " + rn(Math.floor(v/169)) + " i " + rn(Math.floor(v/13)%13);
    case 1: return "Para " + rn(Math.floor(v/2197));
    default: return "Wysoka karta " + rn(Math.floor(v/28561));
  }
}
const comboCache = {};
function combos(n,k){
  const key=n+":"+k; if (comboCache[key]) return comboCache[key];
  const out=[], cur=[];
  (function rec(s){ if (cur.length===k){ out.push(cur.slice()); return; } for (let i=s;i<n;i++){ cur.push(i); rec(i+1); cur.pop(); } })(0);
  return comboCache[key]=out;
}
const FIVE7 = combos(7,5), TRI = combos(5,3);
const c7 = new Array(7);
function scoreHE(h,b){
  c7[0]=h[0]; c7[1]=h[1]; for (let i=0;i<5;i++) c7[i+2]=b[i];
  let best=-1;
  for (let f=0; f<21; f++){ const x=FIVE7[f]; const s=eval5(c7[x[0]],c7[x[1]],c7[x[2]],c7[x[3]],c7[x[4]]); if (s>best) best=s; }
  return best;
}
function scoreO(h,b){
  let best=-1; const n=h.length;
  for (let i=0;i<n;i++) for (let j=i+1;j<n;j++){
    const x=h[i], y=h[j];
    for (let t=0;t<10;t++){ const z=TRI[t]; const s=eval5(x,y,b[z[0]],b[z[1]],b[z[2]]); if (s>best) best=s; }
  }
  return best;
}
function bestDetailed(h,b,omaha){
  let best=-1, cards=null;
  if (b.length < 3) return null;
  if (omaha){
    for (const p of combos(h.length,2)) for (const t of combos(b.length,3)){
      const cs=[h[p[0]],h[p[1]],b[t[0]],b[t[1]],b[t[2]]];
      const s=eval5(cs[0],cs[1],cs[2],cs[3],cs[4]); if (s>best){ best=s; cards=cs; }
    }
  } else {
    const all=h.concat(b);
    for (const f of combos(all.length,5)){
      const cs=f.map(i=>all[i]);
      const s=eval5(cs[0],cs[1],cs[2],cs[3],cs[4]); if (s>best){ best=s; cards=cs; }
    }
  }
  return {score:best, cards};
}

/* ---------- equity ---------- */
function calcEquity(holes, known, omaha, dice, dead){
  const n=holes.length, used=new Uint8Array(52);
  holes.forEach(h=>h.forEach(c=>used[c]=1)); known.forEach(c=>used[c]=1); if (dead) dead.forEach(c=>used[c]=1);
  const rest=[]; for (let c=0;c<52;c++) if (!used[c]) rest.push(c);
  const need=5-known.length, hl=holes[0].length;
  const per = n * (omaha ? (hl*(hl-1)/2)*10 : 21);
  const score = omaha ? scoreO : scoreHE;
  const eq=new Float64Array(n), tie=new Float64Array(n), sc=new Float64Array(n), b=new Array(5);
  for (let i=0;i<known.length;i++) b[i]=known[i];
  let total=0, approx=false;
  function run(wt){
    let best=-1, w=0;
    for (let p=0;p<n;p++){ const s=score(holes[p],b); sc[p]=s; if (s>best){ best=s; w=1; } else if (s===best) w++; }
    const share=wt/w; for (let p=0;p<n;p++) if (sc[p]===best){ eq[p]+=share; if (w>1) tie[p]+=wt; }
    total+=wt;
  }
  const L=rest.length, k0=known.length;
  if (dice && need===0){
    run(1/6);
    for (let pos=0;pos<5;pos++){ const old=b[pos]; for (let i=0;i<L;i++){ b[pos]=rest[i]; run(1/(6*L)); } b[pos]=old; }
  } else if (dice){
    approx=true;
    const iters=Math.max(250, Math.min(3000, Math.floor(450000/per)));
    const pool=rest.slice();
    for (let it=0; it<iters; it++){
      for (let m=0;m<need;m++){
        const r=m+Math.floor(Math.random()*(L-m));
        const tmp=pool[m]; pool[m]=pool[r]; pool[r]=tmp;
        b[k0+m]=pool[m];
      }
      const d=Math.floor(Math.random()*6);
      if (d<5){ const r=need+Math.floor(Math.random()*(L-need)); const old=b[d]; b[d]=pool[r]; run(1); b[d]=old; }
      else run(1);
    }
  }
  else if (need===0) run(1);
  else if (need===1){ for (let i=0;i<L;i++){ b[4]=rest[i]; run(1); } }
  else if (need===2 && (L*(L-1)/2)*per <= 600000){
    for (let i=0;i<L;i++){ b[3]=rest[i]; for (let j=i+1;j<L;j++){ b[4]=rest[j]; run(1); } }
  } else {
    approx=true;
    const iters=Math.max(250, Math.min(3000, Math.floor(450000/per)));
    const pool=rest.slice();
    for (let it=0; it<iters; it++){
      for (let m=0;m<need;m++){
        const r=m+Math.floor(Math.random()*(L-m));
        const tmp=pool[m]; pool[m]=pool[r]; pool[r]=tmp;
        b[k0+m]=pool[m];
      }
      run(1);
    }
  }
  return {eq:Array.from(eq, v=>v/total), tie:Array.from(tie, v=>v/total), approx};
}

function pairScorePre(a,b){ const ra=a>>2, rb=b>>2, hi=Math.max(ra,rb), lo=Math.min(ra,rb); let v=ra===rb ? 100+ra*4 : hi*2+lo; if ((a&3)===(b&3)) v+=4; if (hi-lo===1) v+=2; else if (hi-lo===2) v+=1; return v; }
function keep2(hole, boards){
  if (boards.length && !Array.isArray(boards[0])) boards=[boards];
  let best=null, bv=-1;
  for (const [x,y] of [[0,1],[0,2],[1,2]]){
    const pair=[hole[x],hole[y]];
    let v=pairScorePre(pair[0],pair[1]);
    boards.forEach(bd=>{ if (bd.length>=3) v+=bestDetailed(pair, bd, false).score*1000; });
    if (v>bv){ bv=v; best=pair; }
  }
  return best;
}

function maxPlayersFor(mode, nb, dice){ const m=MODES[mode]; return Math.min(m.max, Math.floor((52-5*nb-(dice?nb:0))/m.hole)); }
/* holes: array of arrays of cards actually played (after discards); boards: arrays of 5 */
function resultFor(holes, boards, mode){
  const m=MODES[mode], nb=boards.length, n=holes.length;
  const per=boards.map(bd=>{
    const det=holes.map(x=>bestDetailed(x, bd, m.omaha));
    const best=Math.max.apply(null, det.map(d=>d.score));
    const winners=[]; det.forEach((d,i)=>{ if (d.score===best) winners.push(i); });
    return {det, best, winners};
  });
  const share=new Array(n).fill(0);
  per.forEach(r=>r.winners.forEach(i=>{ share[i]+=1/nb/r.winners.length; }));
  return {per, share, nb};
}
/* Equity averaged over boards. holesKnown: arrays of each player's hole cards (all known),
   boardsKnown: visible part of each board, dead: other cards out of the deck. */
function equityMulti(holes, boardsKnown, omaha, dice, dead){
  const vs=boardsKnown.map((known,b)=>calcEquity(holes, known, omaha, dice, (dead||[]).concat(boardsKnown.filter((_,j)=>j!==b).flat())));
  const n=holes.length, nb=vs.length, out={eq:[], tie:[], approx:vs.some(x=>x.approx)};
  for (let i=0;i<n;i++){ out.eq[i]=vs.reduce((a,x)=>a+x.eq[i],0)/nb; out.tie[i]=vs.reduce((a,x)=>a+x.tie[i],0)/nb; }
  return out;
}
return {P5, RANKS, rn, MODES, MODE_ORDER, BOARD_N, eval5, describe, combos, bestDetailed, calcEquity, equityMulti, keep2, pairScorePre, maxPlayersFor, resultFor};
});
