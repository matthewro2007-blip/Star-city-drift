/**
 * 2.1.0 online co-op lobby (mockup coop_mockup_lobby.png): Play Online menu (Create / Join), the room code,
 * invite link (Copy / Share…), both player cards with READY + ping, START (host, both ready, versions match).
 * Pure DOM; talks to the session through the callbacks given by hooks.js.
 */
import { animFrame } from '../anim.js';

export function createLobbyUi(cb) {
  let root = null, view = null, raf = 0;
  const $ = (id) => document.getElementById(id);
  function build() {
    if (root) return;
    root = document.createElement('div'); root.id = 'coop-lobby'; root.className = 'overlay coop-overlay hidden';
    root.innerHTML = `
<div class="coop-menu" id="coop-menu">
  <h1 class="coop-h1">PLAY ONLINE</h1>
  <p class="coop-sub">Two-player co-op · Matthew (P1, host) + William Burks (P2)</p>
  <div class="coop-row"><button type="button" class="btn" id="coop-new">Create Game · New Co-op Campaign</button></div>
  <div id="coop-saves"></div>
  <div class="coop-row coop-join"><input id="coop-code" maxlength="8" placeholder="ROOM CODE" autocomplete="off" spellcheck="false" aria-label="Room code"><button type="button" class="btn" id="coop-join">Join Game</button></div>
  <div id="coop-menu-err" class="coop-err"></div>
  <div class="coop-row"><button type="button" class="btn btn-secondary" id="coop-menu-back">Back</button></div>
  <p class="coop-foot">Invite-only: nobody can find your game without the code. No text chat.</p>
</div>
<div class="coop-room hidden" id="coop-room">
  <h1 class="coop-h1">ONLINE CO-OP LOBBY</h1>
  <p class="coop-sub" id="coop-continuing"></p>
  <div class="coop-code-box"><div class="lbl">ROOM CODE</div><div id="coop-room-code">······</div></div>
  <div class="coop-invite" id="coop-invite-row">Invite link: <span id="coop-invite"></span> <button type="button" class="linkbtn" id="coop-copy">[ Copy link ]</button> <button type="button" class="linkbtn" id="coop-share">[ Share… ]</button></div>
  <div class="coop-cards">
    <div class="coop-card" id="coop-card-1"><div class="ready-badge">READY</div><canvas width="200" height="210" id="coop-cv-1"></canvas><div class="nm">Matthew Rose</div><div class="role" id="coop-role-1"></div></div>
    <div class="coop-card" id="coop-card-2"><div class="ready-badge">READY</div><canvas width="200" height="210" id="coop-cv-2"></canvas><div class="nm">William Burks</div><div class="role" id="coop-role-2"></div></div>
  </div>
  <div class="coop-status" id="coop-status"></div>
  <div class="coop-row"><button type="button" class="btn" id="coop-ready">Ready</button><button type="button" class="btn coop-start" id="coop-start" disabled>START</button><button type="button" class="btn btn-secondary" id="coop-leave">Leave</button></div>
  <p class="coop-foot">Co-op save kept on BOTH devices · furthest progress wins on rejoin · Esc: leave lobby (game is saved)</p>
</div>
<div class="coop-menu hidden" id="coop-picker"><h1 class="coop-h1">CONTINUE ONLINE GAME</h1><div id="coop-pick-list"></div><div class="coop-row"><button type="button" class="btn btn-secondary" id="coop-pick-back">Back</button></div></div>`;
    document.body.appendChild(root);
    $('coop-new').onclick = () => cb.create(null);
    $('coop-join').onclick = () => cb.join($('coop-code').value);
    $('coop-code').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') cb.join($('coop-code').value); });
    $('coop-code').addEventListener('keyup', (e) => e.stopPropagation());
    $('coop-menu-back').onclick = () => close();
    $('coop-pick-back').onclick = () => close();
    $('coop-ready').onclick = () => cb.setReady(!(view && view.ready.me));
    $('coop-start').onclick = () => cb.start();
    $('coop-leave').onclick = () => cb.leave();
    $('coop-copy').onclick = () => { try { navigator.clipboard.writeText(view.link); $('coop-copy').textContent = '[ Copied ]'; } catch (_) {} };
    $('coop-share').onclick = async () => {
      const data = { title: 'Streets of Roanoke co-op', text: `Join my game: ${view.pretty}`, url: view.link };
      try { const Sh = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share; if (Sh) await Sh.share(data); else if (navigator.share) await navigator.share(data); else navigator.clipboard.writeText(view.link); } catch (_) {}
    };
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (!$('coop-room').classList.contains('hidden')) cb.leave(); else close(); } });
  }
  function showPane(id) { for (const p of ['coop-menu', 'coop-room', 'coop-picker']) $(p).classList.toggle('hidden', p !== id); }
  function openMenu() {
    build(); root.classList.remove('hidden'); showPane('coop-menu'); $('coop-menu-err').textContent = '';
    const list = cb.sessions();
    $('coop-saves').innerHTML = '';
    for (const e of list) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary'; b.textContent = 'Create Game · Continue co-op save (' + (e.progress?.mainDone || 0) + '/4 main)';
      b.onclick = () => cb.create(e); $('coop-saves').appendChild(b);
    }
    setTimeout(() => $('coop-new').focus(), 0);
  }
  function picker(list, pick) {
    build(); root.classList.remove('hidden'); showPane('coop-picker');
    const el = $('coop-pick-list'); el.innerHTML = '';
    for (const e of list) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary'; b.textContent = `${e.partnerName || 'Partner'} · ${(e.progress?.mainDone || 0)}/4 main · ${new Date(e.updatedAt).toLocaleString()}`; b.onclick = () => pick(e); el.appendChild(b); }
  }
  function open(v) { build(); root.classList.remove('hidden'); showPane('coop-room'); render(v); if (!raf) raf = requestAnimationFrame(drawCards); }
  function close() { if (root) root.classList.add('hidden'); cancelAnimationFrame(raf); raf = 0; }
  function render(v) {
    view = v; if (!root) return;
    $('coop-continuing').textContent = v.continuing;
    $('coop-room-code').textContent = v.pretty ? v.pretty.split('').join(' ') : (v.role === 'guest' ? '······' : '······');
    $('coop-invite-row').classList.toggle('hidden', !(v.role === 'host' && v.code));
    $('coop-invite').textContent = v.link;
    const hostMe = v.role === 'host';
    const r1 = hostMe ? v.ready.me : v.ready.them, r2 = hostMe ? v.ready.them : v.ready.me;
    $('coop-card-1').classList.toggle('is-ready', !!r1); $('coop-card-2').classList.toggle('is-ready', !!r2);
    $('coop-card-2').classList.toggle('empty', !v.partner && hostMe);
    $('coop-role-1').textContent = 'P1 · HOST' + (hostMe ? ' · you' : v.partner ? ` · ${v.rtt} ms` : '');
    $('coop-role-2').textContent = hostMe ? (v.partner ? `P2 · joined · ${v.rtt} ms` : 'P2 · waiting for a friend…') : 'P2 · you';
    $('coop-status').textContent = v.status || '';
    $('coop-status').classList.toggle('bad', !v.versionOk);
    $('coop-ready').textContent = v.ready.me ? 'Not ready' : 'Ready';
    $('coop-ready').disabled = !v.partner || !v.versionOk;
    $('coop-start').classList.toggle('hidden', !hostMe);
    $('coop-start').disabled = !v.canStart;
    $('coop-start').textContent = v.canStart ? 'START  (both ready)' : 'START';
  }
  function drawCards(t) {
    raf = requestAnimationFrame(drawCards);
    for (const [id, key] of [['coop-cv-1', 'matthew'], ['coop-cv-2', 'william']]) {
      const cv = $(id); if (!cv) continue; const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
      if (id === 'coop-cv-2' && view && view.role === 'host' && !view.partner) { c.fillStyle = 'rgba(255,255,255,0.15)'; c.font = 'bold 90px sans-serif'; c.textAlign = 'center'; c.fillText('?', 100, 140); continue; }
      const f = animFrame(key, 'idle_signature', t, 'polo') || animFrame(key, 'idle_personality', t);
      if (!f) continue;
      const k = 190 / Math.max(f.sh, 1), dw = f.sw * k, dh = f.sh * k;
      c.imageSmoothingEnabled = true; c.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 100 - dw / 2, 205 - dh, dw, dh);
    }
    if (view) { /* live ping */ }
  }
  return { open, close, render, openMenu, picker, error: (m) => { openMenu(); $('coop-menu-err').textContent = m; }, setReady: (r) => cb.setReady(r) };
}
