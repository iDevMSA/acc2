// أصوات قصيرة بعد الحفظ والحذف والخطأ — تُولَّد بـ Web Audio فلا توجد ملفات صوت تُحمَّل.
// التفضيل (تشغيل/إيقاف ومستوى الصوت) خاص بهذا المتصفح، لذا يُحفظ في localStorage لا في السحابة.

export type SoundKind = 'success' | 'delete' | 'error';

export interface SoundPrefs {
  enabled: boolean;
  /** 0..1 */
  volume: number;
}

const KEY = 'erp.sounds';
const DEFAULT: SoundPrefs = { enabled: true, volume: 0.6 };

export const getSoundPrefs = (): SoundPrefs => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

export const setSoundPrefs = (p: Partial<SoundPrefs>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getSoundPrefs(), ...p }));
  } catch {
    // التخزين غير متاح (نافذة خاصة): يبقى الافتراضي
  }
};

// [التردد Hz، بداية النغمة بالثواني، المدة بالثواني]
type Note = [number, number, number];
const TONES: Record<SoundKind, { wave: OscillatorType; gain: number; notes: Note[] }> = {
  success: { wave: 'sine', gain: 0.18, notes: [[784, 0, 0.12], [1175, 0.09, 0.2]] },
  delete: { wave: 'sine', gain: 0.16, notes: [[660, 0, 0.1], [440, 0.08, 0.18]] },
  error: { wave: 'triangle', gain: 0.22, notes: [[220, 0, 0.14], [196, 0.16, 0.22]] },
};

let ctx: AudioContext | null = null;
let last = { kind: '' as SoundKind | '', at: 0 };

export const playSound = (kind: SoundKind, opts: { force?: boolean } = {}) => {
  const prefs = getSoundPrefs();
  if (!opts.force && !prefs.enabled) return;
  // نفس الخطأ قد يُبلَّغ من الحفظ ومن رسالة النموذج معاً: صوت واحد يكفي
  const now = Date.now();
  if (last.kind === kind && now - last.at < 500) return;
  last = { kind, at: now };
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    ctx = ctx || new Ctx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    const { wave, gain, notes } = TONES[kind];
    const t0 = ctx.currentTime + 0.01;
    notes.forEach(([freq, start, dur]) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = wave;
      o.frequency.value = freq;
      // صعود وهبوط سريعان حتى لا تُسمع طقطقة
      const peak = gain * prefs.volume;
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.connect(g);
      g.connect(ctx!.destination);
      o.start(t0 + start);
      o.stop(t0 + start + dur + 0.02);
    });
  } catch {
    // لا صوت متاح
  }
};

/** مسار سجل كامل (لا حقل داخله): accounts/x أو erp/items/x أو products/x في المبيعات */
const isRecordPath = (k: string) => {
  const s = k.split('/');
  return s.length === 2 || (s.length === 3 && s[0] === 'erp' && s[1] !== 'settings') || (s.length === 3 && s[0] === 'clientOps');
};

/** حذف إن أزال سجلاً (أو وضع علامة الحذف الناعم) دون أن يُنشئ سجلاً جديداً في نفس الحفظ */
export const soundOfWrite = (updates: Record<string, unknown>): SoundKind => {
  const entries = Object.entries(updates);
  const removes = entries.some(([k, v]) => k.endsWith('/deletedAt') || (v === null && isRecordPath(k)));
  const creates = entries.some(([, v]) => v !== null && typeof v === 'object');
  return removes && !creates ? 'delete' : 'success';
};
