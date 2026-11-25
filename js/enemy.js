// =============================================
// enemy.js — 스테이지별 적 부대 생성
// 적의 수, 레벨, 병과 등장 확률, 진형 배치를 담당
// =============================================
import { CLS, MAXLV, TIER1, TIER2_OF, BOSS_EVERY } from './config.js';
import { S } from './player.js';

// 스테이지에 따른 난이도 곡선 (여기 숫자를 바꿔 난이도 조절)
const enemyMult = (s) => 0.85 + s * 0.02;                          // 능력치 배율
const enemyCount = (s) => Math.min(12, 2 + Math.floor(s * 0.9));   // 적 수
const enemyLevel = (s) => Math.min(MAXLV, 1 + Math.floor((s - 1) * 0.45));
const tier1Chance = (s) => (s >= 3 ? Math.min(0.9, (s - 2) * 0.15) : 0);
const tier2Chance = (s) => (s >= 9 ? Math.min(0.8, (s - 8) * 0.12) : 0);

function pickClass(s) {
  let cls = 'recruit';
  if (Math.random() < tier1Chance(s)) cls = TIER1[(Math.random() * TIER1.length) | 0];
  if (cls !== 'recruit' && Math.random() < tier2Chance(s)) cls = TIER2_OF[cls];
  return cls;
}

// 근접은 전열(c=0), 원거리는 후열(c=2)부터 배치
function placeEnemies(list) {
  const slots = [];
  for (const c of [0, 1, 2]) for (const r of [1, 2, 0, 3]) slots.push({ c, r });
  const back = [...slots].reverse();
  const taken = new Set();
  const place = (e, arr) => {
    for (const p of arr) {
      const k = p.c + ',' + p.r;
      if (!taken.has(k)) { taken.add(k); e.pos = p; return; }
    }
  };
  const melee = list.filter((e) => CLS[e.cls].rng < 100);
  const ranged = list.filter((e) => CLS[e.cls].rng >= 100);
  melee.sort((a, b) => (b.cls === 'boss') - (a.cls === 'boss')).forEach((e) => place(e, slots));
  ranged.forEach((e) => place(e, back));
}

export function genEnemies() {
  const s = S.stage;
  const boss = s % BOSS_EVERY === 0;
  S.emult = enemyMult(s);
  let n = enemyCount(s);
  if (boss) n = Math.max(2, n - 3);
  const lv = enemyLevel(s);

  const list = [];
  for (let i = 0; i < n; i++) {
    const cls = pickClass(s);
    list.push({ id: 'e' + i, name: '적 ' + CLS[cls].n, cls, lvl: Math.max(1, lv + ((Math.random() * 3) | 0) - 1) });
  }
  if (boss) list.push({ id: 'eb', name: '적 족장', cls: 'boss', lvl: Math.floor(s / BOSS_EVERY) });

  placeEnemies(list);
  S.enemies = list;
}
