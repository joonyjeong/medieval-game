// =============================================
// config.js — 게임 밸런스 값과 고정 데이터
// 숫자를 바꿔 밸런스를 조정할 때는 이 파일만 고치면 됩니다.
// =============================================

// 병과 정의
// t: 등급(0 신병, 1 1차 전직, 2 2차 전직, 3 보스)
// hp/atk/def: 체력/공격/방어, rng: 사거리(px), cd: 공격 간격(초), spd: 이동 속도(px/초)
// 특수: crit(치명타 확률), cleave(주변 적 50% 피해), taunt(도발), snipe(최저 체력 노림),
//       heal(치유량), multi(2명 동시 치유)
// next: 전직 가능한 병과
export const CLS = {
  recruit: { n: '신병', g: '병', t: 0, c: '#7d7466', hp: 60, atk: 8, def: 1, rng: 30, cd: 1.0, spd: 42, d: '훈련이 덜 된 징집병. Lv3에 전직.', next: ['spear', 'sword', 'archer', 'acolyte'] },
  spear:   { n: '창병', g: '창', t: 1, c: '#5b7d9a', hp: 115, atk: 9, def: 4, rng: 42, cd: 1.1, spd: 36, d: '단단한 전열 담당.', next: ['guard'] },
  sword:   { n: '검사', g: '검', t: 1, c: '#a25a4a', hp: 80, atk: 15, def: 2, rng: 30, cd: 0.8, spd: 52, crit: 0.2, d: '빠른 공격, 20% 치명타.', next: ['blade'] },
  archer:  { n: '궁수', g: '궁', t: 1, c: '#6b8a4e', hp: 55, atk: 11, def: 0, rng: 210, cd: 1.2, spd: 36, d: '후열에서 화살 사격.', next: ['sniper'] },
  acolyte: { n: '수련사', g: '수', t: 1, c: '#b59a5a', hp: 60, atk: 4, def: 1, rng: 160, cd: 1.3, spd: 38, heal: 13, d: '가장 다친 아군을 치유.', next: ['priest'] },
  guard:   { n: '방패기사', g: '방', t: 2, c: '#3f6a8f', hp: 210, atk: 12, def: 8, rng: 42, cd: 1.1, spd: 34, taunt: 1, d: '주변 적의 공격을 끌어당긴다.' },
  blade:   { n: '검성', g: '성', t: 2, c: '#8f3a2c', hp: 125, atk: 24, def: 3, rng: 32, cd: 0.7, spd: 56, crit: 0.25, cleave: 1, d: '치명타 25%, 주변 적까지 벤다.' },
  sniper:  { n: '저격수', g: '저', t: 2, c: '#4d6b33', hp: 70, atk: 24, def: 1, rng: 320, cd: 1.4, spd: 34, snipe: 1, d: '체력이 가장 낮은 적을 노린다.' },
  priest:  { n: '사제', g: '사', t: 2, c: '#c9a640', hp: 85, atk: 6, def: 2, rng: 190, cd: 1.2, spd: 38, heal: 22, multi: 1, d: '두 명을 동시에 치유.' },
  boss:    { n: '족장', g: '왕', t: 3, c: '#5a2a5a', hp: 400, atk: 18, def: 4, rng: 40, cd: 1.2, spd: 32, cleave: 1, d: '5스테이지마다 등장.' },
};

// 1차 → 2차 전직 매핑 (적 생성에 사용)
export const TIER1 = ['spear', 'sword', 'archer', 'acolyte'];
export const TIER2_OF = { spear: 'guard', sword: 'blade', archer: 'sniper', acolyte: 'priest' };

// 신병 이름 풀
export const NAMES = '강철,김돌쇠,박막동,이개똥,최억쇠,정만석,조칠성,윤삼룡,장복남,임판수,한덕배,오길동,서말자,신용팔,권대식,황봉구,안천수,송두만,류기철,홍만복,전갑수,고순돌,문태식,양춘삼,손백호,배동팔,백운학,허달수,남궁철,노덕만,하경팔,곽두식,성칠복,차돌이,주만길,우금동,구판석,민영달,나철구,진성팔'.split(',');

// 경제
export const START_GOLD = 60;      // 시작 군자금
export const START_RECRUITS = 4;   // 시작 병력
export const REC_COST = 25;        // 징병 비용
export const REC_CHEAP = 12;       // 병력 부족 시 할인 비용
export const CHEAP_UNDER = 4;      // 이 인원 미만이면 할인
export const MAX_ROSTER = 20;      // 최대 보유 병력

// 성장
export const MAXLV = 10;
export const LV_GROWTH = 0.1;              // 레벨당 체력·공격 +10%
export const need = (lvl) => 4 + lvl * 5;  // 다음 레벨까지 필요 경험치
export const PROMO_LV = [3, 6];            // [1차, 2차] 전직 레벨
export const xpGain = (stage, kills) => 6 + stage * 3 + kills * 3;

// 스테이지
export const BOSS_EVERY = 5;
export const deployLimitOf = (stage) => Math.min(12, 4 + Math.floor(stage / 2));
export const rewardOf = (stage) => 35 + stage * 6 + (stage % BOSS_EVERY === 0 ? 40 : 0);

// 전투
export const BATTLE_TIME = 120;     // 초. 넘기면 패배
export const FIELD = { W: 960, H: 480 };
export const GRID = { cols: 3, rows: 4 };

// 2.5D 타일 비율 (가로 1 : 세로 0.85). 배치판 CSS의 --tile-ratio와 맞춰 주세요.
export const TILE_RATIO = 0.85;

// 전투 화면 타일 배치 (px, 캔버스 960×480 기준)
// 유닛의 기준점(x, y)은 발밑 = 타일 하단 중앙 근처(FOOT 비율 위치)
export const BTILE = {
  w: 72,                       // 타일 가로
  h: Math.round(72 * 0.85),    // 타일 세로 (2.5D 비율)
  gap: 3,                      // 타일 간격
  allyX: 80,                   // 아군 진형 왼쪽 끝
  enemyX: 960 - 80 - (72 * 3 + 3 * 2), // 적 진형 왼쪽 끝
  top: 125,                    // 진형 위쪽 끝
  foot: 0.8,                   // 타일 높이 중 발 위치 (0=위, 1=아래)
};
export const UNIT_R = 14;      // 유닛 반지름 (이전 20에서 30% 축소)
export const BOSS_R = 21;

// localStorage 키
export const BEST_KEY = 'jjb_best';

// 공용 유틸: HTML 이스케이프
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
