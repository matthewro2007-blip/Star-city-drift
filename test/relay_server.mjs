// TEST-ONLY local data relay (ws://localhost:9001). Used by ?signal=relay when the browser can't open WebRTC
// data channels (this dev box's managed Chrome policy disables non-proxied UDP). Same link protocol as net.js.
import { WebSocketServer } from 'ws';
const port = Number(process.env.RELAY_PORT || 9001);
const wss = new WebSocketServer({ port, host: '127.0.0.1' });
const rooms = new Map(); let nid = 1;
wss.on('connection', (ws) => {
  ws.id = 'c' + nid++;
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf); } catch { return; }
    if (m.op === 'host') { if (rooms.has(m.room)) { ws.send(JSON.stringify({ op: 'taken' })); return; } rooms.set(m.room, { host: ws, guests: new Map() }); ws.room = m.room; ws.isHost = true; ws.send(JSON.stringify({ op: 'open' })); }
    else if (m.op === 'join') { const r = rooms.get(m.room); if (!r) { ws.send(JSON.stringify({ op: 'nohost' })); return; } ws.room = m.room; r.guests.set(ws.id, ws); r.host.send(JSON.stringify({ op: 'peer', id: ws.id, meta: m.meta || {} })); ws.send(JSON.stringify({ op: 'joined' })); }
    else if (m.op === 'to') { const r = rooms.get(ws.room); const g = r && r.guests.get(m.id); if (g) g.send(JSON.stringify({ op: 'from', m: m.m })); }
    else if (m.op === 'up') { const r = rooms.get(ws.room); if (r) r.host.send(JSON.stringify({ op: 'from', id: ws.id, m: m.m })); }
    else if (m.op === 'drop') { const r = rooms.get(ws.room); const g = r && r.guests.get(m.id); if (g) g.close(); }
  });
  ws.on('close', () => {
    const r = rooms.get(ws.room); if (!r) return;
    if (ws.isHost && r.host === ws) { for (const g of r.guests.values()) g.close(); rooms.delete(ws.room); }
    else if (r.guests.delete(ws.id)) r.host.send(JSON.stringify({ op: 'gone', id: ws.id }));
  });
});
console.log('relay on ws://127.0.0.1:' + port);
