// =============================================
// main.js — 진입점
// 게임 흐름(새 런 → 배치 → 전투 → 결과)과 자동 전투 엔진
// =============================================
import { CLS, FIELD, BATTLE_TIME, UNIT_R, BOSS_R, rewardOf } from './config.js';
import {
  S, resetPlayer, addRecruit, autoFill, deployed, stats, applyBattleResult, saveBest,
} from './player.js';
import { genEnemies } from './enemy.js';
import { drawBattle, footOf, COLORS } from './assets.js';
import {
  $, render, renderLegend, showBattleView, setBattleTime,
  winModal, loseModal, introModal, initInput,
} from './ui.js';

const { W, H } = FIELD;
const cv = $('cv');
const cx = cv.getContext('2d');

let B = null;      // 진행 중인 전투 상태
let speed = 1;     // 배속
let last = 0;      // 직전 프레임 시각

// ================= 게임 흐름 =================
function newRun() {
  resetPlayer();
  genEnemies();
  render();
}

function startBattle() {
  S.sel = null;
  const F = [
    ...deployed().map((u) => makeFighter(u, 'a')),
    ...S.enemies.map((e) => makeFighter(e, 'e')),
  ];
  B = { F, proj: [], fx: [], t: 0, over: false };
  showBattleView(true);
  last = performance.now();
  requestAnimationFrame(loop);
}

function endBattle(win) {
  const allies = B.F.filter((f) => f.side === 'a');
  const { res, dead } = applyBattleResult(allies, win);
  B = null;
  showBattleView(false);

  if (win) {
    const cleared = S.stage;
    const reward = rewardOf(cleared);
    S.gold += reward;
    S.stage++;
    saveBest(cleared);
    autoFill();
    genEnemies();
    winModal(cleared, reward, res, dead);
  } else {
    loseModal();
  }
  render();
}

// ================= 전투 엔진 =================
// 전투체: 병사 데이터(u) + 전투 중 변하는 값(위치, 체력, 쿨다운...)
function makeFighter(u, side) {
  const st = stats(u, side === 'e');
  // 기준점(x, y) = 발밑. 아군은 오른쪽 열(c=2), 적은 왼쪽 열(c=0)이 전열
  const p = footOf(side, u.pos.c, u.pos.r);
  return {
    u, side, b: CLS[u.cls], ...p,
    hp: st.hp, max: st.hp, atk: st.atk, def: st.def, rng: st.rng, cdMax: st.cd, spd: st.spd, heal: st.heal,
    cd: Math.random() * 0.6,
    r: u.cls === 'boss' ? BOSS_R : UNIT_R,
    kills: 0, dead: false, tgt: null, retgt: 0, lunge: 0, hit: 0, dx: 0,
  };
}
const alive = (side) => B.F.filter((f) => !f.dead && f.side === side);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function loop(now) {
  if (!B) return;
  let dt = Math.min(0.05, (now - last) / 1000) * speed;
  last = now;
  while (dt > 0 && !B.over) {   // 배속이 높아도 1/60초 단위로 잘라 계산
    const s = Math.min(dt, 1 / 60);
    step(s);
    dt -= s;
  }
  drawBattle(cx, B);
  if (!B.over) requestAnimationFrame(loop);
}

function damage(src, tgt, mult = 1) {
  if (tgt.dead) return;
  let dmg = src.atk * mult * (0.9 + Math.random() * 0.2);
  let crit = false;
  if (src.b.crit && Math.random() < src.b.crit) { dmg *= 2; crit = true; }
  dmg = Math.max(1, Math.round(dmg - tgt.def));
  tgt.hp -= dmg;
  tgt.hit = 0.15;
  B.fx.push({ x: tgt.x + (Math.random() * 12 - 6), y: tgt.y - tgt.r * 2 - 14, t: 0.8, s: (crit ? '!' : '') + dmg, c: crit ? COLORS.crit : '#fff' });
  if (tgt.hp <= 0) {
    tgt.dead = true; tgt.hp = 0; src.kills++;
    B.fx.push({ x: tgt.x, y: tgt.y - tgt.r * 0.4, t: 1.2, s: '✕', c: tgt.side === 'a' ? COLORS.ally : COLORS.enemy, big: 1 });
  }
}

function moveToward(f, t, dt) {
  const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy) || 1;
  f.x += (dx / d) * f.spd * dt;
  f.y += (dy / d) * f.spd * dt;
}

// 치유사 행동. 치유(또는 치유하러 이동)했으면 true
function healerAct(f, mates, dt) {
  const hurt = mates.filter((m) => m.hp < m.max).sort((a, b) => a.hp / a.max - b.hp / b.max);
  if (!hurt.length) return false;
  const h = hurt[0];
  if (dist(f, h) > f.rng) { moveToward(f, h, dt); return true; }
  if (f.cd <= 0) {
    for (const m of hurt.slice(0, f.b.multi ? 2 : 1)) {
      if (dist(f, m) > f.rng * 1.2) continue;
      m.hp = Math.min(m.max, m.hp + f.heal);
      B.fx.push({ x: m.x, y: m.y - m.r * 2 - 14, t: 0.8, s: '+' + f.heal, c: COLORS.heal });
      B.proj.push({ x: f.x, y: f.y - f.r, tg: m, heal: 1 });
    }
    f.cd = f.cdMax;
  }
  return true;
}

// 공격 대상 고르기: 도발 > 저격(최저 체력) > 가장 가까운 적
function pickTarget(f, foes) {
  const taunt = foes.filter((o) => o.b.taunt && dist(o, f) < 170);
  if (taunt.length) return taunt.sort((a, b) => dist(a, f) - dist(b, f))[0];
  if (f.b.snipe) return foes.sort((a, b) => a.hp - b.hp)[0];
  return foes.sort((a, b) => dist(a, f) - dist(b, f))[0];
}

function step(dt) {
  B.t += dt;

  for (const f of B.F) {
    if (f.dead) continue;
    f.cd -= dt;
    f.lunge = Math.max(0, f.lunge - dt);
    f.hit = Math.max(0, f.hit - dt);
    const foes = alive(f.side === 'a' ? 'e' : 'a');
    const mates = alive(f.side);
    if (!foes.length) continue;

    if (f.heal && healerAct(f, mates, dt)) continue;

    f.retgt -= dt;
    if (!f.tgt || f.tgt.dead || f.retgt <= 0) { f.retgt = 0.4; f.tgt = pickTarget(f, foes); }

    const t = f.tgt, d = dist(f, t);
    if (d > f.rng + t.r) {
      moveToward(f, t, dt);
    } else if (f.cd <= 0) {
      f.cd = f.cdMax;
      f.lunge = 0.12;
      f.dx = (t.x - f.x) / (d || 1);
      if (f.rng >= 100) {
        B.proj.push({ x: f.x, y: f.y - f.r, tg: t, src: f });   // 원거리: 투사체
      } else {
        damage(f, t);
        if (f.b.cleave) for (const o of foes) if (o !== t && !o.dead && dist(o, t) < 50) damage(f, o, 0.5);
      }
    }
  }

  separate();
  updateProjectiles(dt);

  for (const x of B.fx) { x.t -= dt; x.y -= dt * (x.big ? 0 : 30); }
  B.fx = B.fx.filter((x) => x.t > 0);
  setBattleTime(B.t);

  const a = alive('a').length, e = alive('e').length;
  if (!a || !e || B.t >= BATTLE_TIME) {
    B.over = true;
    setTimeout(() => endBattle(e === 0 && a > 0), 900);
  }
}

// 유닛끼리 겹치지 않게 밀어내기 + 화면 밖으로 못 나가게
function separate() {
  const L = B.F.filter((f) => !f.dead);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, m = a.r + b.r + 2;
    if (d < m) {
      const p = (m - d) / 2;
      a.x -= (dx / d) * p; a.y -= (dy / d) * p;
      b.x += (dx / d) * p; b.y += (dy / d) * p;
    }
  }
  for (const f of L) {
    f.x = Math.max(f.r, Math.min(W - f.r, f.x));
    f.y = Math.max(f.r * 2 + 18, Math.min(H - 6, f.y)); // 발밑 기준이라 위쪽에 머리·체력바 여유
  }
}

function updateProjectiles(dt) {
  for (const p of B.proj) {
    if (p.tg.dead) { p.done = 1; continue; }
    const dx = p.tg.x - p.x, dy = p.tg.y - p.tg.r - p.y, d = Math.hypot(dx, dy); // 몸통 중심을 조준
    const v = (p.heal ? 600 : 520) * dt;
    if (d <= v) { p.done = 1; if (!p.heal) damage(p.src, p.tg); }
    else { p.x += (dx / d) * v; p.y += (dy / d) * v; }
  }
  B.proj = B.proj.filter((p) => !p.done);
}

// ================= 시작 =================
initInput({
  onRecruit: () => { addRecruit(false); render(); },
  onStart: startBattle,
  onRestart: newRun,
  onSpeed: (v) => { speed = v; },
});
renderLegend();
newRun();
introModal();

// 디버그용 (브라우저 콘솔에서 __S, __sp(10) 등으로 사용)
window.__S = S;
window.__sp = (v) => { speed = v; };
