// app-tokens.jsx — Shared design tokens, data, and small primitives for 아마따
// All variants pull from this so palettes/data stay in lockstep.

// ─── Palette ────────────────────────────────────────────────────────────────
// Synced to DESIGN_SYSTEM.md v1 (2026.05.25).
const AMATTA = {
  // Surfaces
  cream: '#FFFFFF', // surface — base background
  creamWarm: '#FAF8F2', // surface-warm — alt surface
  surfaceSoft: '#F5F3EE', // surface-soft — kid grouping background
  softGray: '#F5F3EE', // back-compat alias (legacy consumers)
  // Text — opacity-based ink scale on #1D1D1B
  ink: '#1D1D1B', // text_primary
  inkSub: '#7A756E', // text_secondary — warm gray
  ink70: 'rgba(29,29,27,0.70)',
  ink50: 'rgba(29,29,27,0.50)',
  ink30: 'rgba(29,29,27,0.30)',
  ink12: 'rgba(29,29,27,0.12)',
  ink06: 'rgba(29,29,27,0.06)',
  ink04: 'rgba(29,29,27,0.04)',
  hair: '#ECEAE4',
  // Brand — Sunset Orange
  primary: '#FF7144', // Sunset Orange
  primaryDeep: '#D8501F', // hover / pressed
  primaryTint: '#FFE2D0', // spec-correct tint (was #FFD8C2)
  fab: '#FF7144',
  tint: '#FFE2D0', // alias of primaryTint
  // Semantic
  success: '#00C951', // 완료 · 저장 · 픽업 완료
  danger: '#FF4444', // 삭제 · 경고 (spec); was #E84A2D
  warningDot: '#FFB000' // 일정 예외 6px dot (info-level)
};

// 4 kid palette sets — user can switch via Tweaks. Default 'hyflow' is now
// 1:1 with DESIGN_SYSTEM.md §2-3 — 6 saturated source colors, bg derived as
// color-mix(in srgb, source 15%, #FFFFFF), block ink always = AMATTA.ink.
const KID_PALETTES = {
  hyflow: { // ✨ 아마따 spec palette — Petunia/Mint/Glacier/Peach/Citrus/Lavender
    // existing keys map to spec slots 0..3 (matches KIDS order: 민준/서윤/지호/서아)
    peach: { bg: '#FFF2FF', block: '#FFF2FF', ink: '#1D1D1B', dot: '#FFA9FF' }, // 0 · Petunia Pink — 민준
    mint: { bg: '#F6FDF2', block: '#F6FDF2', ink: '#1D1D1B', dot: '#C0F0AA' }, // 1 · Vibrant Mint — 서윤
    sky: { bg: '#F9FBFF', block: '#F9FBFF', ink: '#1D1D1B', dot: '#D8E6FF' }, // 2 · Glacier Blue — 지호
    butter: { bg: '#FFFCF8', block: '#FFFCF8', ink: '#1D1D1B', dot: '#FFE8D2' }, // 3 · Soft Peach — 서아
    citrus: { bg: '#FAFBE3', block: '#FAFBE3', ink: '#1D1D1B', dot: '#E0E446' }, // 4 · Citrus Green
    lavender: { bg: '#F7F3FF', block: '#F7F3FF', ink: '#1D1D1B', dot: '#C7B0FF' } // 5 · French Lavender
  },
  earthy: { // muted, warm-leaning
    peach: { bg: '#FAEADF', block: '#E9C8B0', ink: '#7B432A', dot: '#C77F56' },
    mint: { bg: '#EDEEDF', block: '#CFD2BB', ink: '#525E3D', dot: '#8A9968' },
    sky: { bg: '#E8EBEE', block: '#C5CCD4', ink: '#3F4A58', dot: '#76849A' }
  },
  warm: { // all in same warm family — like vintage paper
    peach: { bg: '#FBEFE5', block: '#F0CDAE', ink: '#8C4A28', dot: '#D08758' },
    mint: { bg: '#F8F1DC', block: '#E8D9A8', ink: '#7A6020', dot: '#C5A85F' },
    sky: { bg: '#F7E6E2', block: '#ECC8C0', ink: '#8C4A48', dot: '#C68077' }
  },
  dusty: { // dusty pastel — modern, low chroma
    peach: { bg: '#F8E6D4', block: '#EAC49E', ink: '#7E4220', dot: '#C2783F' },
    mint: { bg: '#EFEDDC', block: '#D3D2BC', ink: '#56552F', dot: '#959568' },
    sky: { bg: '#EAE5F0', block: '#D2CADF', ink: '#463E72', dot: '#8377AE' }
  },
  bright: { // original — kept for comparison
    peach: { bg: '#FFF1E6', block: '#FFD9B8', ink: '#9C4A14', dot: '#FF9F66' },
    mint: { bg: '#E8F4EC', block: '#C8E6D2', ink: '#2F6B47', dot: '#5BAE7E' },
    sky: { bg: '#E6F0FA', block: '#C6DCF0', ink: '#2B5C8F', dot: '#6CA0D6' }
  }
};

// Active kid palette — components read this. Swap by mutating in place
// (see Daily View.html `applyPalette` effect).
const KID_PALETTE = {
  peach: { ...KID_PALETTES.hyflow.peach },
  mint: { ...KID_PALETTES.hyflow.mint },
  sky: { ...KID_PALETTES.hyflow.sky },
  butter: { ...KID_PALETTES.hyflow.butter },
  citrus: { ...KID_PALETTES.hyflow.citrus },
  lavender: { ...KID_PALETTES.hyflow.lavender }
};

// ─── Sample data (KST, 2026-05-05 Tue) ─────────────────────────────────────
const TODAY = { y: 2026, m: 5, d: 5, label: '5월 5일', weekday: '화', display: 'TODAY' };
const NOW_HHMM = '14:20'; // mocked "current time" for the smart-scroll + now line

const KIDS = [
{ id: 'minjun', name: '민준', grade: '초3', age: 10, palette: 'peach', avatar: 'face-wink' },
{ id: 'seoyun', name: '서윤', grade: '초1', age: 8, palette: 'mint', avatar: 'face-dizzy' },
{ id: 'jiho', name: '지호', grade: '유치원', age: 5, palette: 'sky', avatar: 'face-cool' },
{ id: 'seoa', name: '서아', grade: '어린이집', age: 3, palette: 'butter', avatar: 'face-sleep' }];


// kind: school | academy | activity | etc
const SCHEDULE = {
  minjun: [
  { id: 'm1', kind: 'school', title: '학교', start: '08:30', end: '14:30', place: '교실', pickup: false },
  { id: 'm2', kind: 'activity', title: '수영', start: '15:00', end: '16:00', place: '센터수영장', pickup: true },
  { id: 'm3', kind: 'academy', title: '영어', start: '17:00', end: '18:30', place: '윤스영어', pickup: false }],

  seoyun: [
  { id: 's1', kind: 'school', title: '학교', start: '09:00', end: '13:30', place: '교실', pickup: false },
  { id: 's2', kind: 'academy', title: '미술', start: '14:30', end: '15:30', place: '아트스페이스', pickup: true },
  { id: 's3', kind: 'activity', title: '발레', start: '16:30', end: '17:30', place: '발레학원', pickup: false }],

  jiho: [
  { id: 'j1', kind: 'school', title: '햇살유치원', start: '09:00', end: '14:00', place: '햇살반', pickup: false },
  { id: 'j2', kind: 'activity', title: '태권도', start: '15:30', end: '16:30', place: '태권관', pickup: true }],

  seoa: [
  { id: 'a1', kind: 'school', title: '어린이집', start: '09:30', end: '15:30', place: '햇살어린이집', pickup: true },
  { id: 'a2', kind: 'activity', title: '놀이수업', start: '16:00', end: '17:00', place: '집', pickup: false }]

};

// Next pickup — derived (mocked) for the hero card.
const NEXT_PICKUP = { time: '15:30', who: '지호', what: '태권도', minutesAway: 70 };

// To-do mock for the second top tab
const TODOS = [
{ id: 't0', kid: 'minjun', title: '학교 알림장 확인', due: '07:30', done: true },
{ id: 't1', kid: 'minjun', title: '수영가방 챙기기', due: '14:30', done: false },
{ id: 't2', kid: 'seoyun', title: '미술 준비물 (붓)', due: '14:30', done: true },
{ id: 't3', kid: 'jiho', title: '간식 파우치', due: '15:00', done: true },
{ id: 't4', kid: 'jiho', title: '도복 챙기기', due: '15:00', done: false },
{ id: 't5', kid: 'seoyun', title: '발레슈즈', due: '16:00', done: false },
{ id: 't6', kid: 'minjun', title: '영어 단어장', due: '17:00', done: false },
{ id: 't7', kid: 'minjun', title: '수학 숙제 마무리', due: '20:00', done: false }];


// Parent-level admin tasks (할일) — flat list, not tied to a specific kid
const TASKS = [
{ id: 'k1', title: '영어학원 등록비 입금', due: '5/8', done: false },
{ id: 'k2', title: '병원 예약 변경 (5/14)', due: null, done: true },
{ id: 'k3', title: '체험학습 신청서 출력', due: '5/9', done: false },
{ id: 'k4', title: '발레학원 결제 마감', due: '5/10', done: false }];


// Category emoji — 4 categories per PRD
const KIND_EMOJI = {
  school: '🏫',
  academy: '📚',
  activity: '🎨',
  etc: '📌'
};

// ─── Time helpers ──────────────────────────────────────────────────────────
const TIME_START = 6 * 60; // 06:00
const TIME_END = 23 * 60; // 23:00
const SLOT_MIN = 30;
const toMin = (hhmm) => {const [h, m] = hhmm.split(':').map(Number);return h * 60 + m;};
const fmtKo = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? '오전' : '오후';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${ap} ${hh}:${String(m).padStart(2, '0')}`;
};
const slotIndex = (hhmm) => (toMin(hhmm) - TIME_START) / SLOT_MIN;
const slotSpan = (start, end) => (toMin(end) - toMin(start)) / SLOT_MIN;
// Short 12-hour format used inside schedule blocks: "3:30PM" / "9:00AM"
const fmt12hrShort = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`;
};

// ─── Hero icons (filled, hand-drafted to match heroicons solid feel) ───────
const Icon = {
  car: (p = {}) =>
  <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path d="M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.4L19 11h.5a1.5 1.5 0 011.5 1.5V17a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-4.5A1.5 1.5 0 014.5 11H5zm2.6-1h8.8l-.9-2.7a.5.5 0 00-.5-.3H9a.5.5 0 00-.5.3L7.6 10zm-1 4.5a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2zm10.8 0a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2z" />
    </svg>,

  search: (p = {}) =>
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path fillRule="evenodd" d="M10.5 3a7.5 7.5 0 015.9 12.16l4.22 4.22a1 1 0 01-1.42 1.42l-4.22-4.22A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" clipRule="evenodd" />
    </svg>,

  grid: (p = {}) =>
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>,

  chevL: (p = {}) =>
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke={p.stroke || 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>,

  chevR: (p = {}) =>
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke={p.stroke || 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>,

  chevD: (p = {}) =>
  <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke={p.stroke || 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "12px" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>,

  home: (p = {}) =>
  <svg width={p.size || 22} height={p.size || 22} viewBox="0 0 24 24" fill={p.fill || 'currentColor'} style={{ width: "26px", height: "24px" }}>
      <path d="M4.5 18.9969V10.1507C4.5 9.86452 4.564 9.59344 4.692 9.33744C4.82017 9.08127 4.99717 8.87035 5.223 8.70469L10.9155 4.41619C11.2313 4.17519 11.5923 4.05469 11.9985 4.05469C12.4047 4.05469 12.7667 4.17519 13.0845 4.41619L18.777 8.70469C19.0028 8.87035 19.1798 9.08127 19.308 9.33744C19.436 9.59344 19.5 9.86452 19.5 10.1507V18.9969C19.5 19.4059 19.3523 19.7582 19.0568 20.0537C18.7613 20.3492 18.409 20.4969 18 20.4969H14.8077C14.5516 20.4969 14.3369 20.4103 14.1637 20.2369C13.9904 20.0638 13.9038 19.8491 13.9038 19.5929V14.7084C13.9038 14.4524 13.8172 14.2378 13.644 14.0644C13.4708 13.8913 13.2562 13.8047 13 13.8047H11C10.7438 13.8047 10.5292 13.8913 10.356 14.0644C10.1828 14.2378 10.0963 14.4524 10.0963 14.7084V19.5929C10.0963 19.8491 10.0096 20.0638 9.83625 20.2369C9.66308 20.4103 9.44842 20.4969 9.19225 20.4969H6C5.591 20.4969 5.23875 20.3492 4.94325 20.0537C4.64775 19.7582 4.5 19.4059 4.5 18.9969Z" />
    </svg>,

  gear: (p = {}) =>
  <svg width={p.size || 22} height={p.size || 22} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path d="M10.8927 21.5C10.5517 21.5 10.2572 21.3868 10.0092 21.1605C9.76107 20.9343 9.61007 20.6558 9.55623 20.325L9.31198 18.4538C9.04415 18.3641 8.76948 18.2385 8.48798 18.077C8.20665 17.9153 7.95507 17.7423 7.73323 17.5577L6.00048 18.2943C5.68632 18.4328 5.37065 18.4462 5.05348 18.3345C4.73615 18.223 4.48965 18.0205 4.31398 17.727L3.18698 15.773C3.01132 15.4795 2.96073 15.1689 3.03523 14.8413C3.10957 14.5138 3.28007 14.2436 3.54673 14.0308L5.04473 12.9058C5.02173 12.7571 5.0054 12.6077 4.99573 12.4578C4.98607 12.3077 4.98123 12.1583 4.98123 12.0095C4.98123 11.8673 4.98607 11.7228 4.99573 11.576C5.0054 11.4292 5.02173 11.2686 5.04473 11.0943L3.54673 9.96925C3.28007 9.75642 3.11115 9.48458 3.03998 9.15375C2.96882 8.82308 3.02107 8.51092 3.19673 8.21725L4.31398 6.29225C4.48965 6.00508 4.73615 5.80417 5.05348 5.6895C5.37065 5.57467 5.68632 5.5865 6.00048 5.725L7.72348 6.452C7.96465 6.261 8.22207 6.08633 8.49573 5.928C8.7694 5.76967 9.03832 5.64242 9.30248 5.54625L9.55623 3.675C9.61007 3.34417 9.76107 3.06567 10.0092 2.8395C10.2572 2.61317 10.5517 2.5 10.8927 2.5H13.1082C13.4492 2.5 13.7437 2.61317 13.9917 2.8395C14.2399 3.06567 14.3909 3.34417 14.4447 3.675L14.689 5.55575C14.989 5.66475 15.2604 5.792 15.5032 5.9375C15.7462 6.083 15.9915 6.2545 16.239 6.452L18.0102 5.725C18.3242 5.5865 18.6399 5.57467 18.9572 5.6895C19.2746 5.80417 19.521 6.00508 19.6965 6.29225L20.814 8.227C20.9896 8.5205 21.0402 8.83108 20.9657 9.15875C20.8914 9.48625 20.7209 9.75642 20.4542 9.96925L18.9177 11.123C18.9536 11.2845 18.9731 11.4355 18.9765 11.576C18.9796 11.7163 18.9812 11.8577 18.9812 12C18.9812 12.1358 18.978 12.274 18.9715 12.4145C18.9651 12.5548 18.9421 12.7154 18.9025 12.8963L20.41 14.0308C20.6766 14.2436 20.8488 14.5138 20.9265 14.8413C21.004 15.1689 20.9549 15.4795 20.7792 15.773L19.6465 17.7172C19.471 18.0109 19.223 18.2135 18.9025 18.325C18.582 18.4365 18.2646 18.423 17.9505 18.2845L16.239 17.548C15.9915 17.7455 15.7389 17.9202 15.4812 18.072C15.2236 18.224 14.9595 18.3481 14.689 18.4443L14.4447 20.325C14.3909 20.6558 14.2399 20.9343 13.9917 21.1605C13.7437 21.3868 13.4492 21.5 13.1082 21.5H10.8927ZM12.012 15C12.844 15 13.552 14.708 14.136 14.124C14.72 13.54 15.012 12.832 15.012 12C15.012 11.168 14.72 10.46 14.136 9.876C13.552 9.292 12.844 9 12.012 9C11.1696 9 10.4591 9.292 9.88023 9.876C9.3014 10.46 9.01198 11.168 9.01198 12C9.01198 12.832 9.3014 13.54 9.88023 14.124C10.4591 14.708 11.1696 15 12.012 15Z" />
    </svg>,

  plus: (p = {}) =>
  <svg width={p.size || 24} height={p.size || 24} viewBox="0 0 24 24" fill="none" stroke={p.stroke || 'currentColor'} strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>,

  check: (p = {}) =>
  <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke={p.stroke || 'currentColor'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5 9-11" />
    </svg>,

  xMark: (p = {}) =>
  <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke={p.stroke || 'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>,

  xMark: (p = {}) =>
  <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke={p.stroke || 'currentColor'} strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>,

  bell: (p = {}) =>
  <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path d="M12 2a6 6 0 00-6 6v3.4l-1.7 3.4A1 1 0 005.2 16h13.6a1 1 0 00.9-1.2L18 11.4V8a6 6 0 00-6-6zm-3 16a3 3 0 006 0H9z" />
    </svg>,

  sparkle: (p = {}) =>
  <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path d="M12 2c.6 4 2 5.4 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.6 5.4-2 6-6z" />
    </svg>,

  // ── Category icons (학교/학원/활동/기타) — Set C · 사물 메타포 ──
  // 가방 · 졸업모 · 팔레트 · 클립. 활동/기타는 추후 대안으로 교체 가능.
  school: (p = {}) =>
  <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path d="M7.30775 21.4986C6.80258 21.4986 6.375 21.3236 6.025 20.9736C5.675 20.6236 5.5 20.196 5.5 19.6909V11.9986C5.5 10.6461 5.866 9.44196 6.598 8.38613C7.33017 7.33029 8.27183 6.55629 9.423 6.06413V5.49863C9.423 4.78079 9.673 4.17188 10.173 3.67188C10.673 3.17188 11.282 2.92188 12 2.92188C12.718 2.92188 13.327 3.17188 13.827 3.67188C14.327 4.17188 14.577 4.78079 14.577 5.49863V6.06413C15.7282 6.55629 16.6698 7.33029 17.402 8.38613C18.134 9.44196 18.5 10.6461 18.5 11.9986V19.6909C18.5 20.196 18.325 20.6236 17.975 20.9736C17.625 21.3236 17.1974 21.4986 16.6923 21.4986H7.30775ZM15 15.7486C15.2128 15.7486 15.391 15.6768 15.5345 15.5331C15.6782 15.3896 15.75 15.2115 15.75 14.9986V14.0564C15.75 13.5577 15.5734 13.1317 15.2203 12.7784C14.8669 12.4252 14.4409 12.2486 13.9423 12.2486H9C8.78717 12.2486 8.609 12.3205 8.4655 12.4641C8.32183 12.6076 8.25 12.7858 8.25 12.9986C8.25 13.2115 8.32183 13.3896 8.4655 13.5331C8.609 13.6768 8.78717 13.7486 9 13.7486H13.9423C14.0321 13.7486 14.1058 13.7775 14.1635 13.8351C14.2212 13.8928 14.25 13.9665 14.25 14.0564V14.9986C14.25 15.2115 14.3218 15.3896 14.4655 15.5331C14.609 15.6768 14.7872 15.7486 15 15.7486ZM10.923 5.61788C11.1128 5.57821 11.2923 5.54838 11.4615 5.52838C11.6308 5.50854 11.8103 5.49863 12 5.49863C12.1897 5.49863 12.3692 5.50854 12.5385 5.52838C12.7077 5.54838 12.8872 5.57821 13.077 5.61788V5.49863C13.077 5.19613 12.9732 4.94104 12.7655 4.73338C12.5577 4.52554 12.3025 4.42162 12 4.42162C11.6975 4.42162 11.4423 4.52554 11.2345 4.73338C11.0268 4.94104 10.923 5.19613 10.923 5.49863V5.61788Z" />
    </svg>,

  academy: (p = {}) =>
  <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path d="M5.30775 21.4981C4.80258 21.4981 4.375 21.3231 4.025 20.9731C3.675 20.6231 3.5 20.1955 3.5 19.6903V6.30581C3.5 5.80065 3.675 5.37306 4.025 5.02306C4.375 4.67306 4.80258 4.49806 5.30775 4.49806H6.69225V3.15181C6.69225 2.93398 6.76617 2.75131 6.914 2.60381C7.06167 2.45648 7.24467 2.38281 7.463 2.38281C7.68133 2.38281 7.86383 2.45648 8.0105 2.60381C8.15733 2.75131 8.23075 2.93398 8.23075 3.15181V4.49806H15.8077V3.13281C15.8077 2.92031 15.8797 2.74215 16.0235 2.59831C16.1672 2.45465 16.3453 2.38281 16.558 2.38281C16.7707 2.38281 16.9488 2.45465 17.0922 2.59831C17.2359 2.74215 17.3077 2.92031 17.3077 3.13281V4.49806H18.6923C19.1974 4.49806 19.625 4.67306 19.975 5.02306C20.325 5.37306 20.5 5.80065 20.5 6.30581V19.6903C20.5 20.1955 20.325 20.6231 19.975 20.9731C19.625 21.3231 19.1974 21.4981 18.6923 21.4981H5.30775ZM5.30775 19.9981H18.6923C18.7692 19.9981 18.8398 19.966 18.9038 19.9018C18.9679 19.8378 19 19.7673 19 19.6903V10.3058H5V19.6903C5 19.7673 5.03208 19.8378 5.09625 19.9018C5.16025 19.966 5.23075 19.9981 5.30775 19.9981ZM8 13.7481C7.7875 13.7481 7.60942 13.6761 7.46575 13.5323C7.32192 13.3885 7.25 13.2103 7.25 12.9978C7.25 12.7851 7.32192 12.6071 7.46575 12.4636C7.60942 12.3199 7.7875 12.2481 8 12.2481H16C16.2125 12.2481 16.3906 12.32 16.5343 12.4638C16.6781 12.6076 16.75 12.7858 16.75 12.9983C16.75 13.211 16.6781 13.3891 16.5343 13.5326C16.3906 13.6762 16.2125 13.7481 16 13.7481H8ZM8 17.7481C7.7875 17.7481 7.60942 17.6761 7.46575 17.5323C7.32192 17.3885 7.25 17.2103 7.25 16.9978C7.25 16.7851 7.32192 16.6071 7.46575 16.4636C7.60942 16.3199 7.7875 16.2481 8 16.2481H13C13.2125 16.2481 13.3906 16.32 13.5343 16.4638C13.6781 16.6076 13.75 16.7858 13.75 16.9983C13.75 17.211 13.6781 17.3891 13.5343 17.5326C13.3906 17.6762 13.2125 17.7481 13 17.7481H8Z" />
    </svg>,

  activity: (p = {}) =>
  <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path d="M11.9983 15.7308C12.7352 15.7308 13.3923 15.5092 13.9693 15.0662C14.5461 14.6234 14.9666 14.059 15.2308 13.373H8.76925C9.03342 14.059 9.45333 14.6234 10.029 15.0662C10.6048 15.5092 11.2612 15.7308 11.9983 15.7308ZM9.6945 11.9615C10.0585 11.9615 10.3671 11.8342 10.6202 11.5795C10.8734 11.3248 11 11.0155 11 10.6515C11 10.2877 10.8727 9.97917 10.618 9.726C10.3632 9.47283 10.0538 9.34625 9.69 9.34625C9.32617 9.34625 9.01767 9.47358 8.7645 9.72825C8.51133 9.98292 8.38475 10.2922 8.38475 10.656C8.38475 11.02 8.51208 11.3286 8.76675 11.5817C9.02142 11.8349 9.33067 11.9615 9.6945 11.9615ZM14.31 11.9615C14.6738 11.9615 14.9823 11.8342 15.2355 11.5795C15.4887 11.3248 15.6152 11.0155 15.6152 10.6515C15.6152 10.2877 15.4879 9.97917 15.2333 9.726C14.9786 9.47283 14.6693 9.34625 14.3055 9.34625C13.9415 9.34625 13.6329 9.47358 13.3798 9.72825C13.1266 9.98292 13 10.2922 13 10.656C13 11.02 13.1273 11.3286 13.382 11.5817C13.6368 11.8349 13.9462 11.9615 14.31 11.9615ZM7.875 6.74625L10.5787 3.198C10.7583 2.95783 10.9714 2.7815 11.2183 2.669C11.4651 2.55633 11.7257 2.5 12 2.5C12.2743 2.5 12.5349 2.55633 12.7817 2.669C13.0286 2.7815 13.2417 2.95783 13.4212 3.198L16.125 6.74625L20.2595 8.14225C20.6545 8.26925 20.9625 8.49317 21.1835 8.814C21.4047 9.135 21.5152 9.4895 21.5152 9.8775C21.5152 10.0567 21.4891 10.2353 21.4368 10.4133C21.3844 10.5913 21.2984 10.7618 21.1788 10.925L18.4865 14.6615L18.5865 18.627C18.6032 19.1535 18.4296 19.5972 18.0658 19.9583C17.7021 20.3194 17.2783 20.5 16.7943 20.5C16.7801 20.5 16.6128 20.4782 16.2923 20.4345L12 19.2038L7.70775 20.4345C7.62442 20.4678 7.53842 20.4871 7.44975 20.4923C7.36108 20.4974 7.27975 20.5 7.20575 20.5C6.71725 20.5 6.29225 20.3194 5.93075 19.9583C5.56925 19.5972 5.39683 19.1535 5.4135 18.627L5.5135 14.6365L2.8365 10.925C2.71683 10.7612 2.63083 10.5899 2.5785 10.4113C2.52617 10.2324 2.5 10.0537 2.5 9.875C2.5 9.49783 2.60983 9.14708 2.8295 8.82275C3.04917 8.49842 3.356 8.26842 3.75 8.13275L7.875 6.74625Z" />
    </svg>,

  etc: (p = {}) =>
  <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill={p.fill || 'currentColor'}>
      <path d="M9.19188 18.5C8.84572 18.5 8.52038 18.4218 8.21588 18.2653C7.91155 18.1089 7.6613 17.891 7.46513 17.6115L4.24763 13.0443C4.0233 12.7262 3.91113 12.3782 3.91113 12C3.91113 11.6218 4.0233 11.2737 4.24763 10.9557L7.46513 6.40775C7.6613 6.12825 7.90997 5.90708 8.21113 5.74425C8.51247 5.58142 8.83938 5.5 9.19188 5.5H18.6919C19.1905 5.5 19.6165 5.67658 19.9699 6.02975C20.323 6.38308 20.4996 6.80908 20.4996 7.30775V16.6923C20.4996 17.1909 20.323 17.6169 19.9699 17.9703C19.6165 18.3234 19.1905 18.5 18.6919 18.5H9.19188ZM9.44188 12.8845C9.68672 12.8845 9.89538 12.7983 10.0679 12.626C10.2404 12.4535 10.3266 12.2448 10.3266 12C10.3266 11.7552 10.2404 11.5465 10.0679 11.374C9.89538 11.2017 9.68672 11.1155 9.44188 11.1155C9.19705 11.1155 8.98838 11.2017 8.81588 11.374C8.64355 11.5465 8.55738 11.7552 8.55738 12C8.55738 12.2448 8.64355 12.4535 8.81588 12.626C8.98838 12.7983 9.19705 12.8845 9.44188 12.8845ZM12.9419 12.8845C13.1867 12.8845 13.3954 12.7983 13.5679 12.626C13.7404 12.4535 13.8266 12.2448 13.8266 12C13.8266 11.7552 13.7404 11.5465 13.5679 11.374C13.3954 11.2017 13.1867 11.1155 12.9419 11.1155C12.697 11.1155 12.4884 11.2017 12.3159 11.374C12.1435 11.5465 12.0574 11.7552 12.0574 12C12.0574 12.2448 12.1435 12.4535 12.3159 12.626C12.4884 12.7983 12.697 12.8845 12.9419 12.8845ZM16.4419 12.8845C16.6867 12.8845 16.8954 12.7983 17.0679 12.626C17.2404 12.4535 17.3266 12.2448 17.3266 12C17.3266 11.7552 17.2404 11.5465 17.0679 11.374C16.8954 11.2017 16.6867 11.1155 16.4419 11.1155C16.197 11.1155 15.9884 11.2017 15.8159 11.374C15.6435 11.5465 15.5574 11.7552 15.5574 12C15.5574 12.2448 15.6435 12.4535 15.8159 12.626C15.9884 12.7983 16.197 12.8845 16.4419 12.8845Z" />
    </svg>

};

// ─── Kid Character ────────────────────────────────────────────────────────
// Silhouette-only animal avatars (rabbit/panda/penguin/bear). Inside the
// silhouette: just two dot eyes + a small kitty-style ω mouth — matching the
// Parkette mascot reference. Fill uses the kid's palette dot color so each
// child gets a distinct hue while staying in the brand system.

// face features are drawn at a shared "face zone" (cx=50, cy~58 in 100×100 vb)
// and each silhouette is laid out so the face sits there.
function KidFace({ ink = '#1d1d1b', cy = 58 }) {
  const eyeY = cy - 2;
  return (
    <g>
      {/* eyes — small dots */}
      <circle cx="40" cy={eyeY} r="3.2" fill={ink} />
      <circle cx="60" cy={eyeY} r="3.2" fill={ink} />
      {/* tiny triangle nose, apex pointing down */}
      <path d={`M50 ${cy + 4.5} L46 ${cy + 1.2} L54 ${cy + 1.2} Z`} fill={ink} />
      {/* ω mouth */}
      <path
        d={`M50 ${cy + 5}
            Q47 ${cy + 8.5} 43.8 ${cy + 6.6}
            M50 ${cy + 5}
            Q53 ${cy + 8.5} 56.2 ${cy + 6.6}`}
        fill="none" stroke={ink} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </g>);

}

// Per-animal silhouette paths. All sit in a 100×100 viewBox.
// Ears are positioned to overlap the head so they read as ATTACHED, not floating.
const KID_SILHOUETTES = {
  rabbit: (fill, ink) =>
  <g fill={fill}>
      {/* long upright ears, slight outward tilt */}
      <ellipse cx="38" cy="24" rx="7.5" ry="20" transform="rotate(-4 38 24)" />
      <ellipse cx="62" cy="24" rx="7.5" ry="20" transform="rotate(4 62 24)" />
      {/* wide round head */}
      <ellipse cx="50" cy="62" rx="38" ry="30" />
    </g>,

  panda: (fill, ink) =>
  <g fill={fill}>
      <ellipse cx="22" cy="36" rx="13" ry="11" />
      <ellipse cx="78" cy="36" rx="13" ry="11" />
      <ellipse cx="50" cy="62" rx="36" ry="30" />
    </g>,

  bear: (fill, ink) =>
  <g fill={fill}>
      {/* head first, then small round ears poking up at top corners */}
      <ellipse cx="50" cy="60" rx="40" ry="32" />
      <circle cx="26" cy="28" r="9" />
      <circle cx="74" cy="28" r="9" />
    </g>,

  cat: (fill, ink) =>
  <g>
      <g fill={fill}>
        {/* head + pointed triangle ears */}
        <ellipse cx="50" cy="60" rx="37" ry="32" />
        <path d="M20 40 L30 12 L48 36 Z" />
        <path d="M80 40 L70 12 L52 36 Z" />
      </g>
      {/* darker marks — forehead stripes + whiskers */}
      <g stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.55" fill="none">
        <path d="M45 32 L45.5 38" />
        <path d="M50 30 L50 38" />
        <path d="M55 32 L54.5 38" />
        <path d="M30 58 L14 56" />
        <path d="M30 62 L13 63" />
        <path d="M30 66 L15 70" />
        <path d="M70 58 L86 56" />
        <path d="M70 62 L87 63" />
        <path d="M70 66 L85 70" />
      </g>
    </g>,

  penguin: (fill, ink) =>
  <g fill={fill}>
      <path d="M50 8 C 30 8, 19 28, 19 54 C 19 80, 32 94, 50 94 C 68 94, 81 80, 81 54 C 81 28, 70 8, 50 8 Z" />
    </g>,

  deer: (fill, ink) =>
  <g>
      <g fill={fill}>
        {/* head */}
        <ellipse cx="50" cy="60" rx="38" ry="32" />
        {/* small round ears on sides, slightly tilted */}
        <ellipse cx="20" cy="42" rx="8" ry="6" transform="rotate(-30 20 42)" />
        <ellipse cx="80" cy="42" rx="8" ry="6" transform="rotate(30 80 42)" />
      </g>
      {/* Y-shaped antlers in the fill color */}
      <g stroke={fill} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M34 32 L28 10" />
        <path d="M30 20 L20 14" />
        <path d="M66 32 L72 10" />
        <path d="M70 20 L80 14" />
      </g>
    </g>

};

// faceCy per silhouette — where the eye/mouth feature block should center
const KID_FACE_CY = {
  rabbit: 62,
  panda: 62,
  bear: 60,
  cat: 62,
  penguin: 52,
  deer: 60
};

function KidCharacter({ kind = 'bear', fill = '#FF9302', ink = '#1C1A17', size = 40 }) {
  const draw = KID_SILHOUETTES[kind] || KID_SILHOUETTES.bear;
  const cy = KID_FACE_CY[kind] || 58;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
    style={{ display: 'block', flex: '0 0 auto', overflow: 'visible' }}
    aria-label={kind}>
      {draw(fill, ink)}
      <KidFace ink={ink} cy={cy} />
    </svg>);

}

// ─── Avatar wrapper — keeps the existing AvatarPH API ──────────────────────
// Old API: <AvatarPH kid size ring badge/>. Now renders the silhouette.
function AvatarPH({ kid, size = 36, ring = false, badge = false }) {
  const pal = KID_PALETTE[kid.palette];
  // Map kid.avatar → PNG file. Falls back to KidCharacter SVG if missing.
  const PNG_MAP = {
    rabbit: 'rabbit', panda: 'bear', bear: 'bear', cat: 'cat', deer: 'deer',
    // Expression-based face avatars
    'face-wink': 'face-wink',
    'face-dizzy': 'face-dizzy',
    'face-cool': 'face-cool',
    'face-sleep': 'face-sleep',
    'face-surprise': 'face-surprise',
    'face-calm': 'face-calm',
    'face-happy': 'face-happy'
  };
  const pngKey = PNG_MAP[kid.avatar];
  return (
    <div style={{
      width: size, height: size,
      display: 'grid', placeItems: 'center',
      position: 'relative', flex: '0 0 auto',
      ...(ring ? {
        borderRadius: size / 2,
        boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${pal.dot}`
      } : {})
    }}>
      {pngKey ?
      <img src={`assets/avatar-${pngKey}.png`} alt={kid.name}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} /> :
      <KidCharacter kind={kid.avatar} fill={pal.dot} ink={AMATTA.ink} size={size} />}
      {badge && <span style={{
        position: 'absolute', bottom: -2, right: -2,
        width: size * 0.32, height: size * 0.32, borderRadius: 99,
        background: '#fff', color: pal.ink, fontSize: size * 0.18,
        display: 'grid', placeItems: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        fontFamily: '"Pretendard", sans-serif', fontWeight: 700
      }}>{kid.name[0]}</span>}
    </div>);

}

// ─── Helper: render the correct category icon by kind ────────────────────
function KindIcon({ kind, size = 12, fill = 'currentColor' }) {
  const K = Icon[kind];
  return K ? <K size={size} fill={fill} /> : null;
}

Object.assign(window, {
  AMATTA, KID_PALETTE, KID_PALETTES, TODAY, NOW_HHMM, KIDS, SCHEDULE, NEXT_PICKUP, TODOS, TASKS, KIND_EMOJI,
  TIME_START, TIME_END, SLOT_MIN, toMin, fmtKo, slotIndex, slotSpan, fmt12hrShort,
  Icon, AvatarPH, KidCharacter, KidFace, KID_SILHOUETTES, KindIcon
});