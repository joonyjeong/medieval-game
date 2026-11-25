// =============================================
// ui.js — 화면 그리기와 입력 처리
// 상단 상황판, 배치판, 병사 기록부, 전사자 명부, 모달, 끌어놓기
// =============================================
import { CLS, MAXLV, BOSS_EVERY, BATTLE_TIME, need, esc } from './config.js';
import {
  S, deployLimit, deployed, recruitCost, canRecruit, canPromote, promoteLevel, promote,
  stats, findUnit, unitAt, moveUnit, isEnemy, isDiscounted,
} from './player.js';
import { tokenHTML } from './assets.js';

export const $ = (id) => document.getElementById(id);

// ----- 전체 렌더 -----
export function render() {
  $('hStage').textContent = S.stage;
  $('hGold').textContent = S.gold;
  $('hRoster').textContent = S.units.length;
  $('hFallen').textContent = S.fallen.length;
  $('hBest').textContent = S.best ? S.best + '스테이지' : '-';

  renderAllyGrid();
  renderEnemyGrid();
  $('bench').innerHTML = S.units.filter((u) => !u.pos).map((u) => `<div class="cell mini">${allyToken(u)}</div>`).join('');

  $('deployCount').textContent = `배치 ${deployed().length} / ${deployLimit()}`;
  $('enemyCount').textContent = `적 ${S.enemies.length}명${S.stage % BOSS_EVERY === 0 ? ' · 족장 출현' : ''}`;
  $('btnRecruit').textContent = `징병 (${recruitCost()}금)`;
  $('btnRecruit').disabled = !canRecruit();
  $('recruitHint').textContent = isDiscounted() ? '병력 부족: 징병 비용 할인 중' : '배치 한도는 2스테이지마다 1씩 늘어납니다.';
  $('btnStart').disabled = deployed().length === 0;

  renderDetail();
  renderFallen();
}

const allyToken = (u) => tokenHTML(u, 'ally', { selected: S.sel === u.id, promo: canPromote(u) });

function renderAllyGrid() {
  let h = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const u = unitAt(c, r);
    h += `<div class="cell${S.sel != null ? ' target' : ''}" data-c="${c}" data-r="${r}">${u ? allyToken(u) : ''}</div>`;
  }
  $('allyGrid').innerHTML = h;
}

function renderEnemyGrid() {
  let h = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const e = S.enemies.find((e) => e.pos.c === c && e.pos.r === r);
    h += `<div class="cell">${e ? tokenHTML(e, 'enemy', { selected: S.sel === e.id }) : ''}</div>`;
  }
  $('enemyGrid').innerHTML = h;
}

// ----- 병사 기록부 -----
function renderDetail() {
  const u = S.sel != null && findUnit(S.sel);
  if (!u) {
    $('detail').innerHTML = '<h2>병사 기록부</h2><p class="hint">병사를 눌러 능력치와 전직을 확인하세요.</p>';
    return;
  }
  const enemy = isEnemy(u), b = CLS[u.cls], st = stats(u, enemy);
  let h = `<h2>${esc(u.name)}</h2><div class="kv">
    <span>병과</span><b>${b.n} ${'★'.repeat(b.t)}</b><span>레벨</span><b>${u.lvl}</b>
    <span>체력</span><b>${st.hp}</b><span>공격</span><b>${st.atk}</b><span>방어</span><b>${st.def}</b>
    <span>사거리</span><b>${st.rng}</b>${st.heal ? `<span>치유</span><b>${st.heal}</b>` : ''}</div>
    <p class="hint">${b.d}</p>`;

  if (!enemy) {
    h += `<div class="kv"><span>처치</span><b>${u.kills}</b><span>생존 전투</span><b>${u.stages}</b></div>`;
    h += u.lvl < MAXLV
      ? `<div class="bar"><i style="width:${Math.min(100, (u.xp / need(u.lvl)) * 100)}%"></i></div><div class="hint">경험치 ${u.xp} / ${need(u.lvl)}</div>`
      : '<div class="hint">최고 레벨</div>';
    if (b.next) {
      const ok = canPromote(u);
      h += `<div class="promo">${b.next.map((k) => `<button data-promo="${k}" ${ok ? '' : 'disabled'}><b>${CLS[k].n}(으)로 전직</b><span class="hint">${CLS[k].d}</span></button>`).join('')}</div>`;
      if (!ok) h += `<p class="hint">Lv${promoteLevel(u)}부터 전직할 수 있습니다.</p>`;
    }
    if (u.pos) h += '<button data-unplace="1" style="margin-top:8px;width:100%">대기로 빼기</button>';
  }
  $('detail').innerHTML = h;
}

// ----- 전사자 명부 -----
function renderFallen() {
  if (!S.fallen.length) { $('fallen').innerHTML = '<p class="hint">아직 전사자가 없습니다.</p>'; return; }
  $('fallen').innerHTML = S.fallen.slice().reverse()
    .map((f) => `<div><span>${esc(f.name)} <em>${CLS[f.cls].n} Lv${f.lvl}</em></span><em>${f.stage}스테이지 · ${f.kills}처치</em></div>`)
    .join('');
}

export function renderLegend() {
  $('legend').innerHTML = Object.entries(CLS).filter(([k]) => k !== 'boss')
    .map(([, b]) => `<div><b style="color:${b.c}">${b.g}</b> ${b.n}${b.t ? ' ' + '★'.repeat(b.t) : ''}</div>`)
    .join('');
}

// ----- 화면 전환 / 전투 표시 -----
export function showBattleView(on) {
  $('prep').hidden = on;
  $('battle').hidden = !on;
}
export function setBattleTime(t) {
  $('btime').textContent = `전투 시간 ${Math.floor(t)}초 / ${BATTLE_TIME}초`;
}

// ----- 모달 -----
export function showModal(html) {
  $('mcard').innerHTML = html;
  $('modal').hidden = false;
  $('mcard').querySelector('button')?.focus();
}
export function hideModal() { $('modal').hidden = true; }

export function winModal(cleared, reward, res, dead) {
  showModal(`<h2 class="win">${cleared}스테이지 돌파</h2><p class="hint">군자금 +${reward}금 · 다음 배치 한도 ${deployLimit()}명</p>
  <div class="rows">${res.map((r) => `<div class="${r.up ? 'lvup' : ''}"><span>${esc(r.u.name)} · ${CLS[r.u.cls].n}</span><span>+${r.gain} 경험치${r.kills ? ` · ${r.kills}처치` : ''}${r.up ? ` · Lv${r.u.lvl} 달성` : ''}${canPromote(r.u) ? ' · 전직 가능' : ''}</span></div>`).join('')}
  ${dead.map((u) => `<div class="dead"><span>${esc(u.name)} · ${CLS[u.cls].n} Lv${u.lvl}</span><span>전사</span></div>`).join('')}</div>
  ${dead.length ? `<p class="hint">${dead.length}명이 전사했습니다. 그들은 돌아오지 않습니다.</p>` : '<p class="hint">전원 생존.</p>'}
  <button class="primary" data-close>진형 정비</button>`);
}

export function loseModal() {
  showModal(`<h2 class="lose">부대 궤멸</h2><p>${S.stage - 1}스테이지까지 돌파했습니다. 처음부터 다시 시작합니다.</p>
  <div class="rows"><div><span>총 처치</span><span>${S.kills}</span></div><div><span>전사자</span><span>${S.fallen.length}명</span></div>
  <div><span>최고 기록</span><span>${S.best}스테이지</span></div></div>
  <p class="hint">전사자 명부</p><div class="rows">${S.fallen.slice(-12).reverse().map((f) => `<div class="dead"><span>${esc(f.name)} · ${CLS[f.cls].n} Lv${f.lvl}</span><span>${f.stage}스테이지 · ${f.kills}처치</span></div>`).join('')}</div>
  <button class="primary" data-restart>새 부대로 1스테이지부터</button>`);
}

export function introModal() {
  showModal(`<h2>잔존병</h2><p>죽은 병사는 돌아오지 않습니다. 살아남은 병사만 경험을 쌓고 전직합니다.</p>
  <div class="rows"><div><span>배치</span><span>전투 전 아군 진형만 바꿀 수 있습니다</span></div><div><span>전투</span><span>자동으로 진행됩니다</span></div>
  <div><span>성장</span><span>Lv3 1차 전직 · Lv6 2차 전직</span></div><div><span>패배</span><span>1스테이지부터 새로 시작</span></div></div>
  <button class="primary" data-close>지휘 시작</button>`);
}

// 잠깐 안내 문구 띄우기
let flashTimer;
function flash(msg) {
  $('recruitHint').textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(render, 1600);
}

// ----- 입력 처리 -----
// handlers: { onRecruit, onStart, onRestart, onSpeed(v) }
export function initInput(handlers) {
  initDrag();

  // 빈 칸 클릭: 선택된 병사를 이동
  $('allyGrid').addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || e.target.closest('.tok')) return;
    const cur = S.units.find((u) => u.id === S.sel);
    if (!cur) return;
    tryMove(cur, { c: +cell.dataset.c, r: +cell.dataset.r });
    S.sel = null; render();
  });
  // 대기석 클릭: 선택된 병사를 대기로
  $('bench').addEventListener('click', (e) => {
    if (e.target.closest('.tok')) return;
    const cur = S.units.find((u) => u.id === S.sel);
    if (!cur) return;
    moveUnit(cur, null); S.sel = null; render();
  });
  // 기록부 버튼: 전직 / 대기로 빼기
  $('detail').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    const u = S.units.find((u) => u.id === S.sel);
    if (!b || !u) return;
    if (b.dataset.promo) promote(u, b.dataset.promo);
    if (b.dataset.unplace) moveUnit(u, null);
    render();
  });

  $('btnRecruit').onclick = handlers.onRecruit;
  $('btnStart').onclick = handlers.onStart;

  document.querySelectorAll('[data-sp]').forEach((b) => {
    b.onclick = () => {
      handlers.onSpeed(+b.dataset.sp);
      document.querySelectorAll('[data-sp]').forEach((x) => x.classList.toggle('on', x === b));
    };
  });

  $('modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) hideModal();
    if (e.target.closest('[data-restart]')) { hideModal(); handlers.onRestart(); }
  });
}

function tryMove(u, dest) {
  const err = moveUnit(u, dest);
  if (err) flash(err);
}

// 토큰 클릭: 선택 / 선택된 병사와 자리 교환
function clickToken(id, ally) {
  const cur = S.sel != null && S.units.find((u) => u.id === S.sel);
  if (ally && cur && String(cur.id) !== String(id)) {
    const u = findUnit(id);
    tryMove(cur, u.pos ? { ...u.pos } : null);
    S.sel = null; render(); return;
  }
  const key = ally ? +id : id;
  S.sel = S.sel === key ? null : key;
  render();
}

// 끌어놓기 (마우스·터치 공용 pointer 이벤트)
function initDrag() {
  let drag = null;
  const dropTarget = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el && (el.closest('.grid.ally .cell') || el.closest('.bench'));
  };

  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tok');
    if (!t || $('prep').hidden) return;
    drag = { id: t.dataset.id, x: e.clientX, y: e.clientY, el: t, ghost: null, ally: t.classList.contains('ally') };
  });

  document.addEventListener('pointermove', (e) => {
    if (!drag || !drag.ally) return;
    if (!drag.ghost && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
      drag.ghost = drag.el.cloneNode(true);
      drag.ghost.classList.add('ghost');
      drag.w = drag.el.offsetWidth; drag.h = drag.el.offsetHeight;
      drag.ghost.style.width = drag.w + 'px';
      drag.ghost.style.height = drag.h + 'px';
      document.body.appendChild(drag.ghost);
      drag.el.style.opacity = 0.3;
    }
    if (drag.ghost) {
      // 포인터가 유닛 발밑(하단 중앙) 근처에 오도록
      drag.ghost.style.left = e.clientX - drag.w / 2 + 'px';
      drag.ghost.style.top = e.clientY - drag.h * 0.7 + 'px';
      document.querySelectorAll('.over').forEach((x) => x.classList.remove('over'));
      dropTarget(e)?.classList.add('over');
    }
  });

  document.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) {
      d.ghost.remove();
      const tg = dropTarget(e), u = findUnit(d.id);
      if (tg && u) tryMove(u, tg.classList.contains('cell') ? { c: +tg.dataset.c, r: +tg.dataset.r } : null);
      S.sel = u ? u.id : null;
      render();
      return;
    }
    clickToken(d.id, d.ally);
  });
}
