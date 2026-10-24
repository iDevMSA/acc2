// Shared building blocks for the phone mockups.
const path = require('path');
const F = path.join(__dirname, 'node_modules/@fontsource/ibm-plex-sans-arabic/files');

const font = (w) => ['arabic', 'latin'].map(s => `@font-face{font-family:Plex;font-weight:${w};src:url(file://${F}/ibm-plex-sans-arabic-${s}-${w}-normal.woff2) format('woff2');}`).join('');

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  chev: '<path d="m14 6-6 6 6 6"/>',
  chevd: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="m10 6 6 6-6 6"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pie: '<path d="M12 3v9h9a9 9 0 1 1-9-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z"/>',
  down: '<path d="M12 3v12m-5-5 5 5 5-5M4 21h16"/>',
  up: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
  scan: '<path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M17 8v8"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2M6 6l9-3 1 3"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2a3 3 0 0 1-3-1.5M12 6v1.5M12 16.5V18"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',
  wifioff: '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2-1.5M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-2"/><rect x="6" y="14" width="12" height="7"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a1 1 0 0 1 1 1v11M2 21h20M8 7h4M8 11h4M8 15h4"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/>',
  crown: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/><path d="m9 13 2 2 4-4"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  finger: '<path d="M12 11v3a8 8 0 0 1-2 5M8 7.5A5 5 0 0 1 17 11v2a12 12 0 0 1-1 4.5M5 11a7 7 0 0 1 1.5-4.3M7.5 14.5A10 10 0 0 0 8 11a4 4 0 0 1 8 0"/>',
  transfer: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
  pdf: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M8 16v-4h1.5a1.2 1.2 0 0 1 0 2.5H8M12.5 16v-4h1a2 2 0 0 1 0 4zM17 12h-1.5v4M15.5 14H17"/>',
  star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z"/>',
};
const ic = (n, s = 20, c = 'currentColor', w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`;

// Deterministic fake QR code.
function qr(size = 120, seed = 7) {
  const n = 25, c = size / n; let r = seed, out = '';
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const finder = (x, y) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}" fill="#0F172A"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" fill="#fff"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}" fill="#0F172A"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const inF = (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16);
    if (!inF && rnd() > 0.52) out += `<rect x="${x * c}" y="${y * c}" width="${c}" height="${c}" fill="#0F172A"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/>${out}${finder(0, 0)}${finder(18, 0)}${finder(0, 18)}</svg>`;
}

const CSS = `
${font(400)}${font(500)}${font(600)}${font(700)}
*{box-sizing:border-box;margin:0;padding:0}
:root{--b:#021B79;--b2:#0575E6;--bg:#F3F5FA;--card:#fff;--ink:#0F172A;--mu:#64748B;--li:#E6EAF2;--g:#059669;--r:#DC2626;--a:#D97706;--p:#7C3AED;--t:#0F766E}
body{font-family:Plex,sans-serif;background:#E9EDF5;color:var(--ink);padding:44px 40px 50px}
.board-h{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px;padding:0 6px}
.board-h h1{font-size:30px;font-weight:700;color:var(--b)}
.board-h p{font-size:15px;color:var(--mu);margin-top:4px}
.board-h .tag{font-size:13px;font-weight:600;color:#fff;background:linear-gradient(135deg,var(--b),var(--b2));padding:8px 16px;border-radius:999px}
.row{display:flex;gap:36px;justify-content:center}
.cell{display:flex;flex-direction:column;align-items:center;gap:14px}
.cap{font-size:15px;font-weight:600;color:var(--ink);text-align:center}
.cap small{display:block;font-size:12.5px;font-weight:400;color:var(--mu);margin-top:3px;max-width:330px;line-height:1.5}
.phone{width:372px;height:790px;border-radius:46px;background:#0B1020;padding:9px;box-shadow:0 30px 60px -20px rgba(2,27,121,.35),0 0 0 1px rgba(0,0,0,.08)}
.scr{position:relative;width:100%;height:100%;border-radius:38px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column}
.sb{height:44px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 26px;font-size:14px;font-weight:600;direction:ltr}
.sb .isl{width:96px;height:28px;background:#000;border-radius:20px}
.sb.w{color:#fff}
.body{flex:1;overflow:hidden;padding:0 16px;display:flex;flex-direction:column;gap:12px}
.top{display:flex;align-items:center;justify-content:space-between;padding:6px 16px 10px;flex:none}
.top h2{font-size:19px;font-weight:700}
.ibtn{width:38px;height:38px;border-radius:12px;background:#fff;border:1px solid var(--li);display:flex;align-items:center;justify-content:center;color:var(--ink);position:relative}
.ibtn .dot{position:absolute;top:6px;left:7px;width:9px;height:9px;border-radius:50%;background:var(--r);border:2px solid #fff}
.card{background:var(--card);border-radius:18px;border:1px solid var(--li);padding:14px}
.hero{background:linear-gradient(135deg,var(--b) 0%,#0A3BB0 60%,var(--b2) 100%);color:#fff}
.mu{color:var(--mu)}.g{color:var(--g)}.r{color:var(--r)}.a{color:var(--a)}.bl{color:var(--b2)}
.f11{font-size:11px}.f12{font-size:12px}.f13{font-size:13px}.f14{font-size:14px}.f15{font-size:15px}.f16{font-size:16px}.f18{font-size:18px}.f20{font-size:20px}.f24{font-size:24px}.f28{font-size:28px}
.b5{font-weight:500}.b6{font-weight:600}.b7{font-weight:700}
.fx{display:flex;align-items:center}.sp{justify-content:space-between}.g4{gap:4px}.g6{gap:6px}.g8{gap:8px}.g10{gap:10px}.g12{gap:12px}.col{flex-direction:column;align-items:stretch}.f1{flex:1}
.num{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;background:#EEF2FF;color:var(--b);white-space:nowrap}
.chip.g{background:#E7F7F0;color:var(--g)}.chip.r{background:#FDECEC;color:var(--r)}.chip.a{background:#FEF3E2;color:var(--a)}.chip.p{background:#F2ECFE;color:var(--p)}.chip.gr{background:#F1F5F9;color:var(--mu)}
.seg{display:flex;background:#E8ECF4;border-radius:12px;padding:3px;gap:2px}
.seg div{flex:1;text-align:center;font-size:12.5px;font-weight:600;color:var(--mu);padding:7px 4px;border-radius:9px}
.seg .on{background:#fff;color:var(--b);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.chips{display:flex;gap:6px;overflow:hidden}
.chips span{font-size:12.5px;font-weight:500;padding:6px 13px;border-radius:999px;background:#fff;border:1px solid var(--li);white-space:nowrap;color:var(--mu)}
.chips .on{background:var(--b);border-color:var(--b);color:#fff}
.inp{background:#fff;border:1px solid var(--li);border-radius:13px;padding:11px 13px;font-size:13.5px;display:flex;align-items:center;gap:8px}
.inp .ph{color:#94A3B8}
.lbl{font-size:12px;color:var(--mu);font-weight:500;margin-bottom:5px}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:600;border-radius:14px;padding:13px;background:linear-gradient(135deg,var(--b),var(--b2));color:#fff}
.btn.o{background:#fff;color:var(--b);border:1px solid var(--li)}
.btn.sm{font-size:13px;padding:9px 12px;border-radius:11px}
.list{background:#fff;border-radius:18px;border:1px solid var(--li);overflow:hidden}
.li{display:flex;align-items:center;gap:11px;padding:11px 14px;border-bottom:1px solid #EEF1F6}
.li:last-child{border-bottom:none}
.av{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none}
.av.c{border-radius:50%}
.t-b{background:#EAF0FF;color:var(--b)}.t-g{background:#E7F7F0;color:var(--g)}.t-r{background:#FDECEC;color:var(--r)}.t-a{background:#FEF3E2;color:var(--a)}.t-p{background:#F2ECFE;color:var(--p)}.t-t{background:#E3F4F2;color:var(--t)}.t-s{background:#E8F3FE;color:var(--b2)}.t-gr{background:#F1F5F9;color:var(--mu)}
.sec{font-size:13px;font-weight:700;color:var(--mu);margin:2px 4px -4px}
.nav{flex:none;height:78px;background:#fff;border-top:1px solid var(--li);display:flex;align-items:flex-start;justify-content:space-around;padding:10px 6px 0;position:relative}
.nav .it{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;font-weight:600;color:#94A3B8;width:62px}
.nav .it.on{color:var(--b)}
.nav .fab{width:54px;height:54px;border-radius:18px;margin-top:-26px;background:linear-gradient(135deg,var(--b),var(--b2));color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px -6px rgba(5,117,230,.6);border:4px solid var(--bg)}
.hi{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:130px;height:5px;border-radius:3px;background:#0F172A}
.sheet-bg{position:absolute;inset:0;background:rgba(15,23,42,.45)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:26px 26px 0 0;padding:10px 18px 30px}
.grab{width:42px;height:5px;border-radius:3px;background:#CBD5E1;margin:0 auto 14px}
.tile{display:flex;flex-direction:column;align-items:center;gap:7px;font-size:11.5px;font-weight:600;text-align:center;color:var(--ink)}
.tile .av{width:50px;height:50px;border-radius:16px}
.bar{border-radius:6px 6px 3px 3px;background:#C7D7FE}
.prog{height:7px;border-radius:4px;background:#E8ECF4;overflow:hidden}.prog i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--b2),var(--b))}
.tog{width:40px;height:23px;border-radius:12px;background:#CBD5E1;position:relative;flex:none}.tog::after{content:'';position:absolute;top:2.5px;right:2.5px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.tog.on{background:var(--b2)}.tog.on::after{right:auto;left:2.5px}
.hr{height:1px;background:var(--li)}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}.tbl th{font-weight:600;color:var(--mu);text-align:right;padding:7px 4px;border-bottom:1px solid var(--li);font-size:11.5px}.tbl td{padding:8px 4px;border-bottom:1px solid #F1F4F8}
`;

const statusBar = (white) => `<div class="sb${white ? ' w' : ''}"><span>9:41</span><span class="isl"></span><span class="fx g4"><svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="7" width="3" height="5" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="9.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg><svg width="26" height="13" viewBox="0 0 26 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor"/><rect x="23.5" y="4" width="2" height="5" rx="1" fill="currentColor" opacity=".5"/></svg></span></div>`;

const NAV = [['home', 'الرئيسية'], ['book', 'الحسابات'], null, ['chart', 'التقارير'], ['gear', 'الإعدادات']];
const nav = (on) => `<div class="nav">${NAV.map((n, i) => n ? `<div class="it${i === on ? ' on' : ''}">${ic(n[0], 23, 'currentColor', i === on ? 2.2 : 1.8)}<span>${n[1]}</span></div>` : `<div class="fab">${ic('plus', 26, '#fff', 2.4)}</div>`).join('')}<div class="hi"></div></div>`;

// phone({inner, nav: index|null, white: status bar text white, bg: custom bg style, overlay})
const phone = (o) => `<div class="phone"><div class="scr" style="${o.bg || ''}">${o.head || ''}${statusBar(o.white)}${o.top || ''}<div class="body" style="${o.bodyStyle || ''}">${o.body}</div>${o.nav != null ? nav(o.nav) : (o.foot || '<div style="height:28px;flex:none;position:relative"><div class="hi"></div></div>')}${o.overlay || ''}</div></div>`;

const topBar = (title, { back = true, actions = '' } = {}) => `<div class="top"><div class="fx g10">${back ? `<div class="ibtn bk">${ic('back', 20)}</div>` : ''}<h2>${title}</h2></div><div class="fx g8">${actions}</div></div>`;

global.__cells = global.__cells || [];
const board = (title, sub, cells, tag) => (global.__cells.push({ title, cells }), 0) || `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="board-h"><div><h1>${title}</h1><p>${sub}</p></div><span class="tag">${tag || 'منصتي المحاسبية · تطبيق الهاتف'}</span></div><div class="row">${cells.map(c => `<div class="cell">${c.html}<div class="cap">${c.cap}<small>${c.note || ''}</small></div></div>`).join('')}</div></body></html>`;

module.exports = { ic, qr, phone, topBar, board, nav };
