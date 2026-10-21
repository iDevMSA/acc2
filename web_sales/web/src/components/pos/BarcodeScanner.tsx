import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon';

// ماسح باركود بكاميرا الهاتف: يستخدم BarcodeDetector المدمج في المتصفح (أندرويد كروم) إن وُجد،
// وإلا مكتبة ZXing (آيفون سفاري والمتصفحات الأخرى). مسح متواصل مع صوت واهتزاز عند كل قراءة.

type Detector = { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

const beep = () => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1400;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 90);
  } catch {
    // لا صوت متاح
  }
  try {
    navigator.vibrate?.(60);
  } catch {
    // لا اهتزاز
  }
};

const BarcodeScanner: React.FC<{
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  /** يبقى مفتوحاً بعد كل قراءة (للمسح المتتالي) */
  continuous?: boolean;
  title?: string;
}> = ({ open, onClose, onDetected, continuous, title = 'امسح الباركود' }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const track = useRef<MediaStreamTrack | null>(null);
  const cb = useRef(onDetected);
  cb.current = onDetected;
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;
    let raf = 0;
    const recent = new Map<string, number>();
    setError(null);
    setLast(null);

    const hit = (code: string) => {
      const now = Date.now();
      if ((recent.get(code) || 0) > now - 1500) return;
      recent.set(code, now);
      beep();
      setLast(code);
      cb.current(code);
      if (!continuous) close.current();
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('المتصفح لا يدعم الكاميرا. افتح الصفحة عبر https في كروم أو سفاري.');
        return;
      }
      const BD = (window as any).BarcodeDetector;
      let native: Detector | null = null;
      if (BD) {
        try {
          const supported: string[] = (await BD.getSupportedFormats?.()) || FORMATS;
          native = new BD({ formats: FORMATS.filter((f) => supported.includes(f)) });
        } catch {
          native = null;
        }
      }
      try {
        if (native) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          if (stopped) return stream.getTracks().forEach((t) => t.stop());
          track.current = stream.getVideoTracks()[0];
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          let busy = false;
          const loop = async () => {
            if (stopped) return;
            if (!busy && v.readyState >= 2) {
              busy = true;
              try {
                const codes = await native!.detect(v);
                if (codes[0]?.rawValue) hit(codes[0].rawValue);
              } catch {
                // إطار غير صالح — نكمل
              }
              busy = false;
            }
            raf = requestAnimationFrame(loop);
          };
          loop();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            video.current!,
            (result) => {
              if (result && !stopped) hit(result.getText());
            },
          );
          const s = video.current?.srcObject as MediaStream | null;
          track.current = s?.getVideoTracks()[0] || null;
          if (stopped) zxingControls.stop();
        }
      } catch (e: any) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'لم يُسمح باستخدام الكاميرا. اسمح بها من إعدادات المتصفح ثم أعد المحاولة.'
            : e?.name === 'NotFoundError'
              ? 'لا توجد كاميرا على هذا الجهاز.'
              : 'تعذّر تشغيل الكاميرا.',
        );
      }
    };
    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      track.current = null;
      setTorch(false);
    };
  }, [open, continuous]);

  const toggleTorch = async () => {
    try {
      await track.current?.applyConstraints({ advanced: [{ torch: !torch } as any] });
      setTorch((t) => !t);
    } catch {
      // الفلاش غير مدعوم
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="إغلاق">
          <Icon name="close" size={20} />
        </button>
        <p className="text-sm font-semibold">{title}</p>
        <button onClick={toggleTorch} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="الفلاش" title="الفلاش">
          <Icon name="sparkle" size={18} className={torch ? 'text-amber-300' : ''} />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-40 w-72 max-w-[80vw] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-rose-500" />
          </div>
        </div>
        {error && <p className="absolute inset-x-4 top-4 rounded-lg bg-danger-600 px-3 py-2 text-center text-sm text-white">{error}</p>}
      </div>
      <div className="px-4 py-4 text-center text-sm text-white/80">
        {last ? (
          <span>
            آخر قراءة: <b className="num text-white">{last}</b>
          </span>
        ) : (
          'وجّه الكاميرا إلى الباركود'
        )}
        {continuous && (
          <button onClick={onClose} className="mt-3 block w-full rounded-xl bg-white py-3 font-semibold text-ink">
            تم
          </button>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
