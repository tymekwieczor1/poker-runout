"use strict";
/*
 * Poker Runout Online — server.
 * Holds every table in memory, deals cards, and sends each player only their own hand
 * (plus whatever is public: boards, dice, results).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const QRCode = require("qrcode");
const E = require("./engine.js");

const PORT = process.env.PORT || 3000;
const PUB = __dirname;
const VERSION = "2.0";
// only these files are served (everything sits in one folder, so server.js and package.json must stay private)
const STATIC = new Set(["index.html","app.js","engine.js","style.css","online.css","thrower.jpg"]);
const MAX_PLAYERS = 9;
const STAKES_MAX = 100000;
const READY_MS = +process.env.READY_MS || 30 * 1000;                      // after every stage players have 30 s to confirm
const ROOM_IDLE_MS = 6 * 60 * 60 * 1000;       // forget a table after 6 h without activity
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".json": "application/json", ".webmanifest": "application/manifest+json"
};

/* ---------- helpers ---------- */
const randInt = n => crypto.randomInt(n);
const rid = (bytes = 9) => crypto.randomBytes(bytes).toString("base64url");
function shuffled() { const d = []; for (let i = 0; i < 52; i++) d.push(i); for (let i = 51; i > 0; i--) { const j = randInt(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d; }
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  for (let tries = 0; tries < 1000; tries++) {
    let c = ""; for (let i = 0; i < 4; i++) c += CODE_CHARS[randInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  throw new Error("no free codes");
}
const cleanName = n => String(n || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 18);
const round2 = v => Math.round(v * 100) / 100;

/* ---------- rooms ---------- */
const rooms = new Map();

function makeRoom(hostName) {
  const code = newCode();
  const room = {
    code, created: Date.now(), touched: Date.now(), hostId: null,
    players: [], viewers: new Set(),
    settings: { mode: "nlhe", stake: 10, boards: 1, dice: false, reveal: false, speed: "norm" },
    points: {}, wins: {}, last: null, hands: 0, hand: null, seq: 0, log: [], chat: []
  };
  rooms.set(code, room);
  const p = addPlayer(room, hostName);
  room.hostId = p.id;
  return { room, player: p };
}

function addPlayer(room, name) {
  name = cleanName(name) || "Gracz " + (room.players.length + 1);
  const taken = new Set(room.players.map(p => p.name.toLowerCase()));
  let base = name, i = 2;
  while (taken.has(name.toLowerCase())) name = (base.slice(0, 15) + " " + i++);
  const p = { id: rid(6), token: rid(18), name, ws: null, connected: false, sitOut: false, joined: Date.now() };
  room.players.push(p);
  return p;
}

function findPlayer(room, id) { return room.players.find(p => p.id === id); }

/* ---------- game flow ---------- */
function dealHand(room) {
  const s = room.settings, m = E.MODES[s.mode];
  const seated = room.players.filter(p => !p.sitOut);
  if (seated.length < 2) return "Do rozdania potrzeba co najmniej 2 graczy przy stole.";
  const mx = E.maxPlayersFor(s.mode, s.boards, s.dice);
  if (seated.length > mx) return m.name + (s.boards > 1 ? " na " + s.boards + " boardach" : "") + " mieści maksymalnie " + mx + " graczy.";
  const deck = shuffled();
  const order = seated.map(p => p.id);
  const holes = {};
  order.forEach(id => holes[id] = []);
  for (let k = 0; k < m.hole; k++) order.forEach(id => holes[id].push(deck.pop()));
  const boards = [];
  for (let b = 0; b < s.boards; b++) { const bd = []; for (let i = 0; i < 5; i++) bd.push(deck.pop()); boards.push(bd); }
  room.hands++;
  room.hand = {
    no: room.hands, id: rid(6), mode: s.mode, dice: null, wantDice: s.dice, reveal: s.reveal,
    stake: s.stake, order, holes, boards, deck, street: 0,
    discards: m.pine ? Object.fromEntries(order.map(id => [id, null])) : null,
    result: null
  };
  newStage(room.hand);
  return null;
}

/* ---------- "ready" confirmations ---------- */
function newStage(h) { h.stageAt = Date.now(); h.ready = {}; }
function readyNeed(room) {
  const h = room.hand; if (!h) return [];
  // open cards: once the board is complete nobody needs time to look, so showing the winner (or dealing the dogrywka) never waits
  if (h.reveal && ((h.street === 3 && (!h.wantDice || h.dice)) || (h.street === 4 && h.playoff && !h.playoff.board))) return [];
  return h.order.filter(id => id !== room.hostId && room.players.some(p => p.id === id));
}
function readyBlock(room) {
  const h = room.hand; if (!h) return null;
  const need = readyNeed(room), missing = need.filter(id => !h.ready[id]);
  const left = READY_MS - (Date.now() - h.stageAt);
  if (missing.length && left > 0) return "Czekamy na potwierdzenie graczy (" + (need.length - missing.length) + "/" + need.length + ") albo jeszcze " + Math.ceil(left / 1000) + " s.";
  return null;
}

function pendingDiscards(h) {
  if (!h || !h.discards || h.street !== 1) return [];
  return h.order.filter(id => h.discards[id] == null);
}

function effHole(h, id) {
  const d = h.discards && h.discards[id];
  return d != null ? h.holes[id].filter(c => c !== d) : h.holes[id];
}

function autoDiscardFor(h, id) {
  const keep = E.keep2(h.holes[id], h.boards.map(bd => bd.slice(0, 3)));
  h.discards[id] = h.holes[id].find(c => !keep.includes(c));
}

function showdown(room) {
  const h = room.hand;
  const holes = h.order.map(id => effHole(h, id));
  const res = E.resultFor(holes, h.boards, h.mode, h.playoff && h.playoff.board);
  if (res.pending) {              // 3 boards, tied lead: points wait for the dogrywka board
    h.playoff = { ids: res.leaders.map(i => h.order[i]), board: null };
    h.result = null;
    return;
  }
  const pot = h.stake * h.order.length;
  const d = {}, w = {};
  h.order.forEach((id, i) => { d[id] = round2(pot * res.share[i] - h.stake); if (res.share[i] > 0) w[id] = res.share[i]; });
  const resid = round2(-h.order.reduce((a, id) => a + d[id], 0));
  if (resid !== 0) { let bi = 0; res.share.forEach((v, i) => { if (v > res.share[bi]) bi = i; }); d[h.order[bi]] = round2(d[h.order[bi]] + resid); }
  h.order.forEach(id => {
    room.points[id] = round2((room.points[id] || 0) + d[id]);
    if (w[id]) room.wins[id] = Math.round(((room.wins[id] || 0) + w[id]) * 1000) / 1000;
  });
  room.last = { no: h.no, d, w };
  h.result = {
    share: Object.fromEntries(h.order.map((id, i) => [id, res.share[i]])),
    per: res.per.map(p => ({ winners: p.winners.map(i => h.order[i]), best: p.best })),
    deltas: d
  };
}
function dealPlayoff(h) {
  // a fresh board from the rest of the deck; if it ran short, reshuffle every card that is not in a player's hand
  let pool = h.deck.slice();
  if (pool.length < (h.wantDice ? 6 : 5)) {
    const inHand = new Set(h.order.flatMap(id => h.holes[id]));
    pool = []; for (let c = 0; c < 52; c++) if (!inHand.has(c)) pool.push(c);
    for (let i = pool.length - 1; i > 0; i--) { const j = randInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  }
  h.playoff.board = pool.slice(-5);
  if (h.wantDice) {               // the dogrywka board gets its own die too
    const r = 1 + randInt(6);
    h.playoff.dice = { roll: r, old: null, neu: null };
    if (r <= 5) {
      let neu = pool[pool.length - 6];
      if (neu == null) {          // tiny pool: pick any card not in a hand and not on this board
        const inHand = new Set(h.order.flatMap(id => h.holes[id]).concat(h.playoff.board));
        for (let c = 0; c < 52; c++) if (!inHand.has(c)) { neu = c; break; }
      }
      h.playoff.dice.old = h.playoff.board[r - 1];
      h.playoff.dice.neu = neu;
      h.playoff.board[r - 1] = neu;
    }
  }
}
function handKey(h) { return h.id + ":" + h.street + ":" + (h.dice ? 1 : 0) + ":" + (h.playoff && h.playoff.board ? 1 : 0); }

function advance(room) {
  const h = room.hand;
  const rb = readyBlock(room); if (rb) return rb;
  if (h && h.street === 4 && h.playoff && !h.playoff.board) {   // dogrywka
    dealPlayoff(h); showdown(room); newStage(h);
    return null;
  }
  if (!h || h.street === 4) return dealHand(room);
  if (pendingDiscards(h).length) return "Czekamy, aż wszyscy wyrzucą po 1 karcie.";
  if (h.street === 3 && h.wantDice && !h.dice) {
    h.dice = { rolls: [], old: [], neu: [] };
    h.boards.forEach((bd, b) => {
      const r = 1 + randInt(6); h.dice.rolls[b] = r;
      if (r <= 5) { h.dice.old[b] = bd[r - 1]; h.dice.neu[b] = h.deck.pop(); bd[r - 1] = h.dice.neu[b]; }
      else { h.dice.old[b] = null; h.dice.neu[b] = null; }
    });
    newStage(h);
    return null;
  }
  h.street++;
  newStage(h);
  if (h.street === 4) showdown(room);
  return null;
}

/* ---------- views ---------- */
function viewFor(room, viewerId) {
  const h = room.hand;
  const me = viewerId ? findPlayer(room, viewerId) : null;
  const out = {
    t: "state", seq: room.seq, code: room.code, hostId: room.hostId,
    ver: VERSION,
    you: me ? { id: me.id, name: me.name, host: me.id === room.hostId, sitOut: me.sitOut } : { viewer: true },
    settings: room.settings, rulesRev: room.rulesRev || 0, hands: room.hands, last: room.last,
    players: room.players.map(p => ({
      id: p.id, name: p.name, connected: p.connected, sitOut: p.sitOut,
      points: room.points[p.id] || 0, wins: room.wins[p.id] || 0,
      inHand: !!(h && h.holes[p.id])
    })),
    hand: null
  };
  if (h) {
    const open = h.reveal || h.street === 4;
    const n = E.BOARD_N[h.street];
    const hv = {
      no: h.no, id: h.id, mode: h.mode, street: h.street, stake: h.stake, order: h.order,
      wantDice: h.wantDice, reveal: h.reveal,
      boards: h.boards.map(bd => bd.slice(0, n)),
      dice: h.dice, holes: {}, discards: null, pending: pendingDiscards(h), result: h.result,
      playoff: h.street === 4 ? (h.playoff || null) : null,
      need: readyNeed(room), ready: Object.keys(h.ready || {}), readyLeft: Math.max(0, READY_MS - (Date.now() - (h.stageAt || 0)))
    };
    if (h.dice && n === 5) hv.boards = h.boards.map(bd => bd.slice());
    h.order.forEach(id => { if (open || id === viewerId) hv.holes[id] = h.holes[id]; });
    if (h.discards) {
      hv.discards = {};
      h.order.forEach(id => {
        const v = h.discards[id];
        hv.discards[id] = (open || id === viewerId) ? v : (v == null ? null : true);
      });
    }
    out.hand = hv;
  }
  return out;
}

function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

function broadcast(room) {
  room.seq++;
  room.touched = Date.now();
  room.players.forEach(p => { if (p.ws) send(p.ws, viewFor(room, p.id)); });
  room.viewers.forEach(ws => send(ws, viewFor(room, null)));
}

/* ---------- messages ---------- */
function handle(ws, msg) {
  const t = msg && msg.t;
  if (t === "create") {
    const { room, player } = makeRoom(msg.name);
    attach(ws, room, player);
    send(ws, { t: "joined", code: room.code, playerId: player.id, token: player.token });
    broadcast(room);
    return;
  }
  if (t === "join" || t === "watch") {
    const code = String(msg.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const room = rooms.get(code);
    if (!room) return send(ws, { t: "error", code: "no_room", msg: "Nie ma stołu o kodzie " + (code || "—") + ". Sprawdź kod u hosta." });
    if (t === "watch") {
      detach(ws);
      ws.meta = { code, viewer: true };
      room.viewers.add(ws);
      send(ws, { t: "watching", code });
      send(ws, viewFor(room, null));
      send(ws, { t: "chatlog", list: room.chat.slice(-60) });
      return;
    }
    let p = msg.token ? room.players.find(x => x.token === msg.token) : null;
    if (!p) {
      if (room.players.length >= MAX_PLAYERS) return send(ws, { t: "error", code: "full", msg: "Przy tym stole siedzi już " + MAX_PLAYERS + " graczy." });
      p = addPlayer(room, msg.name);
    }
    attach(ws, room, p);
    send(ws, { t: "joined", code: room.code, playerId: p.id, token: p.token });
    send(ws, { t: "chatlog", list: room.chat.slice(-60) });
    broadcast(room);
    return;
  }
  // everything below needs a seat
  const meta = ws.meta;
  if (!meta || meta.viewer) return;
  const room = rooms.get(meta.code);
  if (!room) return send(ws, { t: "error", code: "no_room", msg: "Ten stół już nie istnieje." });
  const me = findPlayer(room, meta.playerId);
  if (!me) return send(ws, { t: "kicked" });
  const isHost = me.id === room.hostId;
  const err = m => send(ws, { t: "error", msg: m });
  const h = room.hand;

  switch (t) {
    case "chat": {                 // table chat: everyone at the table (and the table screen) gets it
      const text = String(msg.text || "").replace(/\s+/g, " ").trim().slice(0, 240);
      if (!text) return;
      const now = Date.now();
      if (me.lastChat && now - me.lastChat < 500) return;
      me.lastChat = now;
      const m = { id: rid(6), from: me.id, name: me.name, text, at: now };
      room.chat.push(m); if (room.chat.length > 120) room.chat.splice(0, room.chat.length - 120);
      room.touched = now;
      room.players.forEach(p => { if (p.ws) send(p.ws, { t: "chat", m }); });
      room.viewers.forEach(v => send(v, { t: "chat", m }));
      return;
    }
    case "rename": { const n = cleanName(msg.name); if (n) me.name = n; break; }
    case "sitOut": me.sitOut = !!msg.value; break;
    case "leave": {
      removePlayer(room, me.id);
      send(ws, { t: "left" });
      detach(ws, true);
      break;
    }
    case "discard": {
      if (!h || !h.discards || h.street !== 1 || !h.holes[me.id]) return err("Teraz nie wyrzuca się kart.");
      const c = msg.card | 0;
      if (h.discards[me.id] != null) return err("Już wyrzuciłeś kartę.");
      if (!h.holes[me.id].includes(c)) return err("Nie masz tej karty.");
      h.discards[me.id] = c;
      h.ready[me.id] = true;
      break;
    }
    case "ready": {
      if (!h || !h.holes[me.id]) return;
      if (h.ready[me.id]) return;
      h.ready[me.id] = true;
      break;
    }
    default: {
      if (!isHost) return err("Tylko host może to zrobić.");
      switch (t) {
        case "settings": {
          const s = room.settings, v = msg.settings || {}, rulesKey = () => JSON.stringify([s.mode, s.stake, s.boards, s.dice, s.reveal]), before = rulesKey();
          if (E.MODES[v.mode]) s.mode = v.mode;
          if (Number.isFinite(+v.stake)) s.stake = Math.min(STAKES_MAX, Math.max(0, Math.round(+v.stake)));
          if ([1, 2, 3].includes(+v.boards)) s.boards = +v.boards;
          if (typeof v.dice === "boolean") s.dice = v.dice;
          if (typeof v.reveal === "boolean") s.reveal = v.reveal;
          if (["slow", "norm", "fast"].includes(v.speed)) s.speed = v.speed;          // animation tempo is set by the host for the whole table
          if (rulesKey() !== before) room.rulesRev = (room.rulesRev || 0) + 1;   // players get a pop-up with the new rules
          break;
        }
        case "next": {
          if (msg.handId !== undefined && h && msg.handId !== handKey(h)) return; // stale click
          const e = advance(room); if (e) return err(e);
          break;
        }
        case "deal": { const e = dealHand(room); if (e) return err(e); break; }
        case "autoDiscard": {
          if (!h || !h.discards || h.street !== 1) return;
          pendingDiscards(h).forEach(id => autoDiscardFor(h, id));
          break;
        }
        case "abort": room.hand = null; break;
        case "kick": {
          const p = findPlayer(room, msg.id);
          if (!p || p.id === me.id) return;
          removePlayer(room, p.id);
          if (p.ws) { send(p.ws, { t: "kicked" }); detach(p.ws, true); }
          break;
        }
        case "makeHost": { const p = findPlayer(room, msg.id); if (p) room.hostId = p.id; break; }
        case "resetPoints": room.points = {}; room.wins = {}; room.last = null; break;
        case "undo": {
          const L = room.last; if (!L) return;
          Object.keys(L.d).forEach(id => { room.points[id] = round2((room.points[id] || 0) - L.d[id]); });
          Object.keys(L.w).forEach(id => { room.wins[id] = Math.max(0, Math.round(((room.wins[id] || 0) - L.w[id]) * 1000) / 1000); });
          room.last = null;
          break;
        }
        default: return;
      }
    }
  }
  broadcast(room);
}

function removePlayer(room, id) {
  const h = room.hand;
  if (h && h.holes[id] && h.street < 4) {
    // the player's cards are mucked; they don't pay for this hand
    h.order = h.order.filter(x => x !== id);
    delete h.holes[id];
    if (h.discards) delete h.discards[id];
    if (h.order.length < 2) room.hand = null;
  }
  room.players = room.players.filter(p => p.id !== id);
  if (room.hostId === id) {
    const next = room.players.find(p => p.connected) || room.players[0];
    room.hostId = next ? next.id : null;
  }
  if (!room.players.length) rooms.delete(room.code);
}

function attach(ws, room, p) {
  detach(ws);
  if (p.ws && p.ws !== ws) { send(p.ws, { t: "replaced" }); p.ws.meta = null; try { p.ws.close(); } catch (e) {} }
  p.ws = ws; p.connected = true;
  ws.meta = { code: room.code, playerId: p.id };
}

function detach(ws, silent) {
  const meta = ws.meta; if (!meta) return;
  const room = rooms.get(meta.code);
  ws.meta = null;
  if (!room) return;
  if (meta.viewer) { room.viewers.delete(ws); return; }
  const p = findPlayer(room, meta.playerId);
  if (p && p.ws === ws) { p.ws = null; p.connected = false; }
  if (!silent) broadcast(room);
}

/* ---------- http ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/healthz") { res.writeHead(200, { "content-type": "text/plain" }); return res.end("ok"); }
    if (url.pathname === "/qr.svg") {
      const text = String(url.searchParams.get("t") || "").slice(0, 300);
      const svg = await QRCode.toString(text || " ", { type: "svg", margin: 1, color: { dark: "#0a101c", light: "#ffffff" } });
      res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" });
      return res.end(svg);
    }
    let p = decodeURIComponent(url.pathname);
    if (p === "/" || /^\/[A-Za-z0-9]{4}$/.test(p)) p = "/index.html";   // /K7QF opens the join screen
    const name = p.slice(1);
    if (!STATIC.has(name)) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("Nie znaleziono"); }
    const file = path.join(PUB, name);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("Nie znaleziono"); }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": /\.(jpg|png|svg)$/.test(p) ? "public, max-age=3600" : "no-cache" });
      res.end(data);
    });
  } catch (e) { res.writeHead(500); res.end(); }
});

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 8 * 1024 });
wss.on("connection", ws => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", data => {
    let msg; try { msg = JSON.parse(data); } catch (e) { return; }
    try { handle(ws, msg); } catch (e) { console.error(e); send(ws, { t: "error", msg: "Coś poszło nie tak po stronie serwera." }); }
  });
  ws.on("close", () => detach(ws));
});

// heartbeat: drop dead connections so "connected" flags stay honest
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) {} });
}, 25000);
// forget idle tables
setInterval(() => {
  const now = Date.now();
  rooms.forEach((r, code) => { if (now - r.touched > ROOM_IDLE_MS) rooms.delete(code); });
}, 10 * 60 * 1000);

server.listen(PORT, () => console.log("Poker Runout Online działa na porcie " + PORT));
