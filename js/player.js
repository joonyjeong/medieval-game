// =============================================
// player.js — 게임 상태(S)와 아군 부대 관리
// 징병, 배치, 능력치 계산, 전직, 전투 후 경험치·전사 처리
// =============================================
import {
  CLS, NAMES, START_GOLD, START_RECRUITS, REC_COST, REC_CHEAP, CHEAP_UNDER, MAX_ROSTER,
  MAXLV, LV_GROWTH, need, PROMO_LV, xpGain, deployLimitOf, BEST_KEY,
} from './config.js';

// 게임 전체 상태. 다른 모듈은 이 객체를 import 해서 읽고 씁니다.
export const S = {
  stage: 1, gold: 0, units: [], enemies: [], fallen: [], kills: 0,
  sel: null,  // 선택된 병사 id
  nid: 1,     // 다음 병사 id
  emult: 1,   // 적 능력치 배율 (enemy.js에서 설정)
  best: 0,
};

// ----- 최고 기록 -----
try { S.best = +localStorage.getItem(BEST_KEY) || 0; } catch (e) { /* 저장소 없음 */ }
export function saveBest(stage) {
  if (stage <= S.best) return;
  S.best = stage;
  try { localStorage.setItem(BEST_KEY, stage); } catch (e) { /* 무시 */ }
}

// ----- 새 런 초기화 -----
export function resetPlayer() {
  Object.assign(S, { stage: 1, gold: START_GOLD, units: [], enemies: [], fallen: [], kills: 0, sel: null, nid: 1 });
  for (let i = 0; i < START_RECRUITS; i++) addRecruit(true);
}

// ----- 조회 -----
export const deployLimit = () => deployLimitOf(S.stage);
export const deployed = () => S.units.filter((u) => u.pos);
export const isDiscounted = () => S.units.length < CHEAP_UNDER;
export const recruitCost = () => (isDiscounted() ? REC_CHEAP : REC_COST);
export const canRecruit = () => S.gold >= recruitCost() && S.units.length < MAX_ROSTER;
export const isEnemy = (u) => String(u.id).startsWith('e');
export function findUnit(id) {
  return S.units.find((u) => String(u.id) === String(id)) || S.enemies.find((e) => e.id === id);
}
export const unitAt = (c, r) => S.units.find((u) => u.pos && u.pos.c === c && u.pos.r === r);

// 빈 칸 찾기: 전열(오른쪽, c=2)부터 채움
export function freeCell() {
  for (const c of [2, 1, 0]) for (let r = 0; r < 4; r++) if (!unitAt(c, r)) return { c, r };
  return null;
}

// ----- 징병 -----
function randomName() {
  const used = new Set(S.units.map((u) => u.name));
  const pool = NAMES.filter((n) => !used.has(n));
  const list = pool.length ? pool : NAMES;
  return list[(Math.random() * list.length) | 0];
}
export function addRecruit(free = false) {
  if (!free) {
    if (!canRecruit()) return false;
    S.gold -= recruitCost();
  }
  const u = { id: S.nid++, name: randomName(), cls: 'recruit', lvl: 1, xp: 0, kills: 0, stages: 0, pos: null };
  if (deployed().length < deployLimit()) u.pos = freeCell();
  S.units.push(u);
  return true;
}

// 대기 병력을 배치 한도까지 자동으로 채움
export function autoFill() {
  for (const u of S.units) if (!u.pos && deployed().length < deployLimit()) u.pos = freeCell();
}

// ----- 능력치 -----
export function stats(u, enemy = false) {
  const b = CLS[u.cls];
  const k = 1 + LV_GROWTH * (u.lvl - 1);
  const m = enemy ? S.emult : 1;
  return {
    hp: Math.round(b.hp * k * m),
    atk: Math.round(b.atk * k * m * 10) / 10,
    def: b.def + Math.floor((u.lvl - 1) / 2),
    rng: b.rng, cd: b.cd, spd: b.spd,
    heal: b.heal ? Math.round(b.heal * k) : 0,
  };
}

// ----- 전직 -----
export function promoteLevel(u) {
  const t = CLS[u.cls].t;
  return t === 0 ? PROMO_LV[0] : t === 1 ? PROMO_LV[1] : null;
}
export function canPromote(u) {
  const b = CLS[u.cls];
  return !!b.next && u.lvl >= promoteLevel(u);
}
export function promote(u, cls) {
  if (!canPromote(u) || !CLS[u.cls].next.includes(cls)) return false;
  u.cls = cls;
  return true;
}

// ----- 배치 이동 -----
// dest: {c,r} 또는 null(대기석). 실패 시 에러 메시지 반환
export function moveUnit(u, dest) {
  if (!dest) { u.pos = null; return null; }
  const other = unitAt(dest.c, dest.r);
  if (other === u) return null;
  if (!u.pos && !other && deployed().length >= deployLimit()) return '배치 한도에 도달했습니다';
  if (other) other.pos = u.pos ? { ...u.pos } : null;  // 자리 교환
  u.pos = { ...dest };
  return null;
}

// ----- 전투 결과 반영 -----
// fighters: 전투에 참가한 아군 전투체 목록 (main.js의 fighter 객체)
// 반환: { res: 생존자 결과 목록, dead: 전사한 병사 목록 }
export function applyBattleResult(fighters, win) {
  const res = [], dead = [];
  for (const f of fighters) {
    const u = f.u;
    u.kills += f.kills;
    S.kills += f.kills;
    if (f.dead) {
      dead.push(u);
      S.fallen.push({ name: u.name, cls: u.cls, lvl: u.lvl, kills: u.kills, stage: S.stage });
      continue;
    }
    const gain = win ? xpGain(S.stage, f.kills) : 0;
    const before = u.lvl;
    u.xp += gain;
    if (win) u.stages++;
    while (u.lvl < MAXLV && u.xp >= need(u.lvl)) { u.xp -= need(u.lvl); u.lvl++; }
    if (u.lvl >= MAXLV) u.xp = 0;
    res.push({ u, gain, up: u.lvl - before, kills: f.kills });
  }
  S.units = S.units.filter((u) => !dead.includes(u));  // 죽은 병사는 영구 제거
  return { res, dead };
}
