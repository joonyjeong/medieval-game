// =============================================
// assets.js — 그래픽 요소
// 배치 화면의 병사 토큰(HTML)과 전투 캔버스 그리기
// 나중에 스프라이트 이미지로 바꿀 때 이 파일만 고치면 됩니다.
// =============================================
import { CLS, FIELD, GRID, BTILE, esc } from './config.js';

export const COLORS = {
  ally: '#4a8fe0',
  enemy: '#e0503f',
  hpAlly: '#7cc97a',
  hpEnemy: '#e0503f',
  heal: '#7cc97a',
  crit: '#ffd25e',
  arrow: '#f2e2b0',
  healOrb: '#9be38f',
};

// ----- 배치 화면 토큰 -----
// 타일 전체를 덮는 .tok 안에
//   .lvl  : 좌측 상단 모서리 레벨 숫자
//   .up   : 우측 상단 전직 가능 표시
//   .unit : 하단 중앙 기준점에 서 있는 유닛 (체력바 + 몸체 + 그림자)
// 에셋을 입힐 때는 .body 안의 글자를 <img>로 바꾸면 됩니다.
// opts: { selected: bool, promo: bool, hpRate: 0~1 }
export function tokenHTML(u, side, opts = {}) {
  const b = CLS[u.cls];
  const stars = b.t >= 1 ? '★'.repeat(b.t) : '';
  const hp = Math.round((opts.hpRate ?? 1) * 100);
  return `<div class="tok ${side}${opts.selected ? ' sel' : ''}${u.cls === 'boss' ? ' boss' : ''}" data-id="${esc(u.id)}" title="${esc(u.name)} · ${b.n} Lv${u.lvl}">
    <span class="lvl">${u.lvl}${stars ? `<i>${stars}</i>` : ''}</span>
    ${opts.promo ? '<span class="up">전직</span>' : ''}
    <div class="unit">
      <span class="hp"><i style="width:${hp}%"></i></span>
      <span class="body" style="--c:${b.c}">${b.g}</span>
      <span class="shadow"></span>
    </div>
  </div>`;
}

// ----- 전투 캔버스 -----
const { W, H } = FIELD;
const GRID_H = GRID.rows * BTILE.h + (GRID.rows - 1) * BTILE.gap;

// 진형 타일의 사각형 (side: 'a' 아군, 'e' 적)
export function tileRect(side, c, r) {
  const x0 = side === 'a' ? BTILE.allyX : BTILE.enemyX;
  return { x: x0 + c * (BTILE.w + BTILE.gap), y: BTILE.top + r * (BTILE.h + BTILE.gap), w: BTILE.w, h: BTILE.h };
}
// 유닛 기준점(발밑) = 타일 하단 중앙
export function footOf(side, c, r) {
  const t = tileRect(side, c, r);
  return { x: t.x + t.w / 2, y: t.y + t.h * BTILE.foot };
}
// 원근감: 화면 위쪽(먼 곳)일수록 조금 작게
const depthScale = (y) => Math.max(0.85, Math.min(1.1, 0.9 + (0.2 * (y - BTILE.top)) / GRID_H));

function drawGround(cx) {
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#24211c');
  g.addColorStop(1, '#3a332a');
  cx.fillStyle = g;
  cx.fillRect(0, 0, W, H);
  // 진형 타일 (2.5D: 윗면 + 아래 두께)
  for (const side of ['a', 'e']) {
    for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) {
      const t = tileRect(side, c, r);
      cx.fillStyle = 'rgba(0,0,0,.35)';
      roundRect(cx, t.x, t.y + 4, t.w, t.h, 6); cx.fill();
      cx.fillStyle = side === 'a' ? 'rgba(74,143,224,.10)' : 'rgba(224,80,63,.10)';
      roundRect(cx, t.x, t.y, t.w, t.h, 6); cx.fill();
      cx.strokeStyle = side === 'a' ? 'rgba(74,143,224,.22)' : 'rgba(224,80,63,.22)';
      cx.lineWidth = 1; cx.stroke();
    }
  }
}

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
}

function drawCorpse(cx, f) {
  const R = f.r * depthScale(f.y);
  cx.globalAlpha = 0.3;
  cx.fillStyle = f.side === 'a' ? COLORS.ally : COLORS.enemy;
  cx.beginPath(); cx.ellipse(f.x, f.y, R, R * 0.35, 0, 0, 7); cx.fill();
  cx.globalAlpha = 1;
}

// 유닛 그리기. (f.x, f.y) = 발밑 기준점
function drawFighter(cx, f) {
  const R = f.r * depthScale(f.y);
  const ox = f.lunge > 0 ? f.dx * 6 : 0;   // 공격 시 앞으로 튀어나감
  const cy = f.y - R - 1;                  // 몸체 중심
  // 그림자 (발밑)
  cx.fillStyle = 'rgba(0,0,0,.4)';
  cx.beginPath(); cx.ellipse(f.x, f.y, R * 0.95, R * 0.32, 0, 0, 7); cx.fill();
  // 몸체 (에셋 적용 시 이 부분을 drawImage로 교체)
  const gr = cx.createRadialGradient(f.x + ox - R * 0.3, cy - R * 0.3, 1, f.x + ox, cy, R);
  gr.addColorStop(0, f.hit > 0 ? '#fff' : f.b.c);
  gr.addColorStop(1, f.b.c);
  cx.fillStyle = gr;
  cx.beginPath(); cx.arc(f.x + ox, cy, R, 0, 7); cx.fill();
  cx.lineWidth = 2;
  cx.strokeStyle = f.side === 'a' ? COLORS.ally : COLORS.enemy;
  cx.stroke();
  cx.fillStyle = '#fff';
  cx.font = `${Math.round(R * 1.05)}px "Black Han Sans",sans-serif`;
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(f.b.g, f.x + ox, cy + 1);
  // 머리 위 작은 체력바
  const bw = Math.max(18, R * 1.8), by = cy - R - 7;
  cx.fillStyle = '#000b';
  cx.fillRect(f.x - bw / 2, by, bw, 3);
  cx.fillStyle = f.side === 'a' ? COLORS.hpAlly : COLORS.hpEnemy;
  cx.fillRect(f.x - bw / 2, by, (bw * f.hp) / f.max, 3);
  // 좌측 상단 작은 레벨 숫자
  cx.font = 'bold 9px "Noto Sans KR",sans-serif';
  cx.textAlign = 'right'; cx.textBaseline = 'middle';
  cx.lineWidth = 2.5; cx.strokeStyle = '#000c';
  cx.strokeText(f.u.lvl, f.x - bw / 2 - 2, by + 1.5);
  cx.fillStyle = '#f1e6c8';
  cx.fillText(f.u.lvl, f.x - bw / 2 - 2, by + 1.5);
}

function drawProjectile(cx, p) {
  cx.fillStyle = p.heal ? COLORS.healOrb : COLORS.arrow;
  cx.beginPath(); cx.arc(p.x, p.y, p.heal ? 3 : 2.5, 0, 7); cx.fill();
}

function drawText(cx, x) {
  cx.globalAlpha = Math.min(1, x.t * 2);
  cx.fillStyle = x.c;
  cx.font = x.big ? '22px "Black Han Sans"' : 'bold 12px "Noto Sans KR"';
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
  cx.fillText(x.s, x.x, x.y);
  cx.globalAlpha = 1;
}

// 전투 한 프레임 그리기. B = main.js의 전투 상태
export function drawBattle(cx, B) {
  cx.clearRect(0, 0, W, H);
  drawGround(cx);
  for (const f of B.F) if (f.dead) drawCorpse(cx, f);
  // 2.5D: 화면 위쪽(뒤)부터 그려서 앞 유닛이 뒤 유닛을 가리게
  const live = B.F.filter((f) => !f.dead).sort((a, b) => a.y - b.y);
  for (const f of live) drawFighter(cx, f);
  for (const p of B.proj) drawProjectile(cx, p);
  for (const x of B.fx) drawText(cx, x);
}
