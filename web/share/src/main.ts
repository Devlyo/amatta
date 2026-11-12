// WeMoa shared calendar — read-only web viewer (ADR-016, boards SH2–SH4).
// The data comes only from location.hash (never sent to any server). All
// text goes through textContent; nothing from the link is ever parsed as HTML.

import { decodeShare, decodeWireJson, type DecodeResult, type SharePayload } from '../../../src/share/share-codec';

const KID = [
  { source: '#FFA9FF', deep: '#D957D9' },
  { source: '#C0F0AA', deep: '#5E9E40' },
  { source: '#D8E6FF', deep: '#6C8FD9' },
  { source: '#FFE8D2', deep: '#B87A40' },
  { source: '#E0E446', deep: '#A8AD12' },
  { source: '#C7B0FF', deep: '#8E6BE8' },
];
const AVATARS = ['face-wink', 'face-dizzy', 'face-cool', 'face-sleep', 'face-surprise', 'face-calm'];
const TYPE_KO: Record<string, string> = { school: '학교', academy: '학원', activity: '활동', other: '기타' };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const HOUR_H = 44;

type El = HTMLElement;
function el(tag: string, cls?: string, text?: string): El {
  const e = document.createElement(tag);
  if (cls !== undefined) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
/** Local date from YYYY-MM-DD (never `new Date(iso)`, which is UTC). */
function localDate(iso: string): Date {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}
const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayDiff = (a: Date, b: Date): number =>
  Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
function fmt(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h >= 12 ? 'PM' : 'AM'}`;
}
const fmtRange = (s: number, e: number): string => {
  const a = fmt(s);
  const b = fmt(e === 1440 ? 0 : e);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`;
};
const md = (d: Date): string => `${d.getMonth() + 1}월 ${d.getDate()}일`;

function avatar(kidIdx: number, p: SharePayload, size: number): El {
  const k = p.k[kidIdx];
  const wrap = el('span', 'av');
  wrap.style.width = wrap.style.height = `${size}px`;
  if (k === undefined) return wrap;
  wrap.style.background = rgba(KID[k[1]]?.source ?? '#ccc', 0.45);
  const key = AVATARS.includes(k[2]) ? k[2] : AVATARS[k[1]] ?? 'face-wink';
  const img = document.createElement('img');
  img.src = `/avatars/${key}.png`;
  img.alt = '';
  img.width = img.height = Math.round(size * 0.92);
  wrap.append(img);
  return wrap;
}

/** The orange WeMoa wordmark (the app's Fredoka logo, as an image). */
function wordmark(width: number): El {
  const img = document.createElement('img');
  img.src = '/wordmark.png';
  img.alt = 'WeMoa';
  img.className = 'wordmark';
  img.width = width;
  return img;
}

function message(title: string, body: string): void {
  const root = document.getElementById('app') as El;
  root.replaceChildren();
  const box = el('div', 'msg');
  box.append(wordmark(120), el('h1', '', title), el('p', '', body));
  root.append(box);
}

function render(p: SharePayload): void {
  const root = document.getElementById('app') as El;
  const from = localDate(p.f);
  const created = localDate(p.c);
  const today = new Date();
  const todayOff = dayDiff(today, from);
  const hidden = new Set<number>();
  let span = window.innerWidth >= 600 ? 7 : 4;
  let start = Math.min(Math.max(0, todayOff), Math.max(0, p.d - span));
  let sheet: El | null = null;

  const draw = (): void => {
    root.replaceChildren();
    // Header
    const head = el('header');
    const left = el('div');
    const meta = el('div', 'meta');
    meta.append(wordmark(64), el('span', '', `보기 전용 · ${md(created)} 기준`));
    left.append(meta);
    const endDay = addDays(from, Math.min(p.d, start + span) - 1);
    left.append(el('h1', '', `${md(addDays(from, start))} – ${md(endDay)}`));
    const nav = el('div', 'nav');
    const prev = el('button', 'round', '‹');
    const next = el('button', 'round', '›');
    prev.setAttribute('aria-label', '이전');
    next.setAttribute('aria-label', '다음');
    (prev as HTMLButtonElement).disabled = start <= 0;
    (next as HTMLButtonElement).disabled = start + span >= p.d;
    prev.onclick = () => {
      start = Math.max(0, start - span);
      draw();
    };
    next.onclick = () => {
      start = Math.min(Math.max(0, p.d - span), start + span);
      draw();
    };
    const spanBtn = el('button', 'pill-btn', span === 4 ? '7일' : '4일');
    spanBtn.onclick = () => {
      span = span === 4 ? 7 : 4;
      start = Math.min(start, Math.max(0, p.d - span));
      draw();
    };
    nav.append(spanBtn, prev, next);
    head.append(left, nav);
    root.append(head);

    // Old / expired link
    const old = dayDiff(today, created) > 7 || todayOff >= p.d;
    if (old) root.append(el('div', 'banner', `이 링크는 ${md(created)} 기준이에요. 지금과 다를 수 있어요.`));

    // Kid filter
    const pills = el('div', 'pills');
    p.k.forEach((k, i) => {
      const b = el('button', `pill${hidden.has(i) ? ' off' : ''}`);
      const c = KID[k[1]] ?? KID[0];
      b.style.borderColor = c?.deep ?? '#999';
      b.style.background = rgba(c?.source ?? '#ccc', 0.25);
      b.append(avatar(i, p, 20), el('span', '', k[0]));
      b.onclick = () => {
        if (hidden.has(i)) hidden.delete(i);
        else hidden.add(i);
        draw();
      };
      pills.append(b);
    });
    root.append(pills);

    // Columns
    const days = Array.from({ length: Math.min(span, p.d - start) }, (_, i) => start + i);
    const dayHead = el('div', 'dayhead');
    dayHead.append(el('span', 'gutter'));
    days.forEach((off) => {
      const d = addDays(from, off);
      const cell = el('span', `dh${off === todayOff ? ' today' : ''}${d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : ''}`);
      cell.append(el('b', '', String(d.getDate())), el('small', '', WD[d.getDay()]));
      dayHead.append(cell);
    });
    root.append(dayHead);

    const visibleKids = (kidIdx: number[]): number[] => kidIdx.filter((i) => !hidden.has(i));
    const occs = p.o.filter((o) => {
      const s = p.s[o[3]];
      return s !== undefined && visibleKids(s[2]).length > 0 && o[0] >= start && o[0] < start + days.length;
    });

    // All-day strip
    const allDay = occs.filter((o) => o[4] === 1);
    if (allDay.length > 0) {
      const row = el('div', 'allday');
      row.append(el('span', 'gutter', '종일'));
      days.forEach((off) => {
        const col = el('div', 'adcol');
        allDay.filter((o) => o[0] === off).forEach((o) => col.append(chip(o)));
        row.append(col);
      });
      root.append(row);
    }

    // Time grid
    const grid = el('div', 'grid');
    const inner = el('div', 'inner');
    inner.style.height = `${24 * HOUR_H}px`;
    for (let h = 0; h <= 24; h++) {
      const line = el('div', 'hour');
      line.style.top = `${h * HOUR_H}px`;
      if (h > 0 && h < 24) line.append(el('span', '', fmt(h * 60).replace(':00', '')));
      inner.append(line);
    }
    const cols = el('div', 'cols');
    days.forEach((off) => {
      const col = el('div', `col${off === todayOff ? ' today' : ''}`);
      const mine = occs.filter((o) => o[0] === off && o[4] === 0).sort((a, b) => a[1] - b[1] || b[2] - a[2]);
            // Overlapping events sit side by side (iOS): clusters of overlaps share
      // the column width, each event in the first free lane.
      let cluster: { o: SharePayload['o'][number]; lane: number }[] = [];
      let clusterEnd = -1;
      const flush = (): void => {
        const lanes = cluster.reduce((m, x) => Math.max(m, x.lane + 1), 0);
        cluster.forEach(({ o, lane }) => {
          const b = block(o);
          b.style.top = `${(o[1] / 60) * HOUR_H + 1}px`;
          b.style.height = `${Math.max(18, ((o[2] - o[1]) / 60) * HOUR_H - 2)}px`;
          b.style.left = `calc(${(lane / lanes) * 100}% + 1px)`;
          b.style.width = `calc(${100 / lanes}% - 2px)`;
          col.append(b);
        });
        cluster = [];
      };
      mine.forEach((o) => {
        if (o[1] >= clusterEnd && cluster.length > 0) flush();
        const used = new Set(cluster.filter((x) => x.o[2] > o[1]).map((x) => x.lane));
        let lane = 0;
        while (used.has(lane)) lane++;
        cluster.push({ o, lane });
        clusterEnd = Math.max(clusterEnd, o[2]);
      });
      flush();
      cols.append(col);
    });
    inner.append(cols);
    grid.append(inner);
    root.append(grid);
    const first = occs.filter((o) => o[4] === 0).reduce((m, o) => Math.min(m, o[1]), 24 * 60);
    grid.scrollTop = first < 24 * 60 ? Math.max(0, (first / 60 - 0.5) * HOUR_H) : 8 * HOUR_H;

    if (sheet !== null) root.append(sheet);
  };

  const colorOf = (o: SharePayload['o'][number]): { source: string; deep: string } => {
    const s = p.s[o[3]];
    const kidIdx = s === undefined ? [] : s[2].filter((i) => !hidden.has(i));
    const k = p.k[kidIdx[0] ?? 0];
    return KID[k?.[1] ?? 0] ?? { source: '#ccc', deep: '#888' };
  };
  const titleOf = (o: SharePayload['o'][number]): string => o[5] ?? p.s[o[3]]?.[0] ?? '';

  function chip(o: SharePayload['o'][number]): El {
    const c = colorOf(o);
    const b = el('button', 'chip', titleOf(o));
    b.style.background = rgba(c.source, 0.45);
    b.style.borderLeftColor = c.deep;
    b.onclick = () => open(o);
    return b;
  }
  function block(o: SharePayload['o'][number]): El {
    const c = colorOf(o);
    const b = el('button', 'block');
    b.style.background = rgba(c.source, 0.45);
    b.style.setProperty('--bar', c.deep);
    b.append(el('span', 't', titleOf(o)), el('span', 'r', fmtRange(o[1], o[2])));
    b.setAttribute('aria-label', `${titleOf(o)} ${fmtRange(o[1], o[2])}`);
    b.onclick = () => open(o);
    return b;
  }

  function open(o: SharePayload['o'][number]): void {
    const s = p.s[o[3]];
    if (s === undefined) return;
    const back = el('div', 'sheet-back');
    const card = el('div', 'sheet');
    card.append(el('span', 'grab'));
    const who = el('div', 'who');
    const faces = el('span', 'faces');
    s[2].forEach((i) => faces.append(avatar(i, p, 34)));
    const names = s[2].map((i) => p.k[i]?.[0] ?? '').join('·') + (s[3] === 1 ? ' · 보호자 함께' : '');
    const t = el('div');
    t.append(el('div', 'meta', names), el('div', 'big', titleOf(o)));
    who.append(faces, t);
    card.append(who);
    const d = addDays(from, o[0]);
    const when = `${md(d)} ${WD[d.getDay()]}요일 · ${o[4] === 1 ? '하루 종일' : fmtRange(o[1], o[2])}`;
    card.append(el('div', 'line', when));
    const sub = [TYPE_KO[s[1]] ?? '', s[4]].filter((x) => x !== '').join(' · ');
    if (sub) card.append(el('div', 'line muted', sub));
    if (s[5] === 1) card.append(el('div', 'line', `픽업 필요 · ${fmt(o[2])}`));
    if (s[6] !== null && s[6] !== '') card.append(el('div', 'line', `장소 · ${s[6]}`));
    if (o[6].length > 0) {
      card.append(el('div', 'label', '준비물'), el('div', 'line', o[6].map((i) => p.l[i] ?? '').join(', ')));
    }
    if (s[7] !== null && s[7] !== '') card.append(el('div', 'label', '메모'), el('div', 'line', s[7]));
    card.append(el('div', 'note', '보기 전용이에요. 바꾸려면 WeMoa 앱에서 해 주세요.'));
    back.append(card);
    back.onclick = (e) => {
      if (e.target === back) {
        sheet = null;
        back.remove();
      }
    };
    sheet = back;
    root.append(back);
  }

  draw();
}

function b64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Short link: /s/<id>#<key> — fetch the ciphertext, decrypt here (AES-GCM). */
async function loadShort(id: string, key: string): Promise<DecodeResult | 'expired' | 'network'> {
  let res: Response;
  try {
    res = await fetch(`/api/share/${id}`, { cache: 'no-store', credentials: 'omit' });
  } catch {
    return 'network';
  }
  if (res.status === 404) return 'expired';
  if (!res.ok) return 'network';
  try {
    const { c } = (await res.json()) as { c: string };
    const all = b64urlBytes(c);
    const k = await crypto.subtle.importKey('raw', b64urlBytes(key), 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, k, all.slice(12));
    return decodeWireJson(new TextDecoder().decode(pt));
  } catch {
    return { kind: 'invalid' };
  }
}

async function start(): Promise<void> {
  const m = /^\/s\/([A-Za-z0-9]{10})\/?$/.exec(window.location.pathname);
  const hash = window.location.hash.replace(/^#/, '');
  let r: DecodeResult | 'expired' | 'network';
  if (m !== null) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(hash)) {
      message('열 수 없는 링크예요', '링크 끝부분이 잘렸어요. 보낸 분에게 다시 공유해 달라고 해 주세요.');
      return;
    }
    r = await loadShort(m[1] as string, hash);
  } else {
    r = decodeShare(window.location.hash);
  }
  if (r === 'expired') {
    message('기간이 끝난 링크예요', '공유 링크는 14일 동안만 열려요. 보낸 분에게 다시 공유해 달라고 해 주세요.');
    return;
  }
  if (r === 'network') {
    message('불러오지 못했어요', '인터넷 연결을 확인한 뒤 다시 열어 주세요.');
    return;
  }
  if (r.kind === 'newer') {
    message('새 버전 링크예요', '이 링크는 더 새 WeMoa에서 만들었어요. 잠시 후 다시 열어 주세요.');
    return;
  }
  if (r.kind !== 'ok') {
    message('열 수 없는 링크예요', '링크가 잘렸거나 손상됐을 수 있어요. 보낸 분에게 다시 공유해 달라고 해 주세요.');
    return;
  }
  render(r.payload);
}

window.addEventListener('hashchange', () => void start());
void start();
