import React, { useEffect, useState } from 'react';
import Icon from '../ui/Icon';
import { cx } from '../ui/primitives';

// صورة المنتج على خلفية بيضاء: نُزيل خلفية الصورة الأصلية (الطاولة، الرف، الظل الفاتح)
// بملء الألوان المتصلة بأطراف الصورة باللون الأبيض ثم نضعها في مربع أبيض.
// المعالجة في المتصفح مرة واحدة لكل صورة وتُحفظ في الذاكرة، والأصل يبقى رابطاً فقط (لا يثقل قاعدة البيانات).

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

const SIZE = 320;

const process = (src: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, (SIZE * 0.9) / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;
        // لون الخلفية = متوسط بكسلات الإطار الخارجي
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        const edge = (x: number, y: number) => {
          const i = (y * w + x) * 4;
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
          n++;
        };
        for (let x = 0; x < w; x++) {
          edge(x, 0);
          edge(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          edge(0, y);
          edge(w - 1, y);
        }
        r /= n;
        g /= n;
        b /= n;
        // ملء متصل من الأطراف: كل بكسل قريب من لون الخلفية أو فاتح جداً يصبح أبيض
        const tol = 42 * 42 * 3;
        const near = (i: number) => {
          const dr = px[i] - r;
          const dg = px[i + 1] - g;
          const db = px[i + 2] - b;
          const light = px[i] > 225 && px[i + 1] > 225 && px[i + 2] > 225;
          return light || dr * dr + dg * dg + db * db < tol;
        };
        const seen = new Uint8Array(w * h);
        const stack: number[] = [];
        const push = (x: number, y: number) => {
          const k = y * w + x;
          if (!seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        };
        for (let x = 0; x < w; x++) {
          push(x, 0);
          push(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          push(0, y);
          push(w - 1, y);
        }
        let cleared = 0;
        while (stack.length) {
          const k = stack.pop()!;
          const i = k * 4;
          if (!near(i)) continue;
          px[i] = px[i + 1] = px[i + 2] = 255;
          cleared++;
          const x = k % w;
          const y = (k - x) / w;
          if (x > 0) push(x - 1, y);
          if (x < w - 1) push(x + 1, y);
          if (y > 0) push(x, y - 1);
          if (y < h - 1) push(x, y + 1);
        }
        // إن ابتلع الملء معظم الصورة فالخلفية والمنتج متشابهان — نُبقي الأصل كما هو
        if (cleared < w * h * 0.85) ctx.putImageData(data, 0, 0);
        else ctx.drawImage(img, 0, 0, w, h);
        const out = document.createElement('canvas');
        out.width = SIZE;
        out.height = SIZE;
        const o = out.getContext('2d')!;
        o.fillStyle = '#fff';
        o.fillRect(0, 0, SIZE, SIZE);
        o.drawImage(c, Math.round((SIZE - w) / 2), Math.round((SIZE - h) / 2));
        resolve(out.toDataURL('image/jpeg', 0.86));
      } catch {
        resolve(src); // الصورة لا تسمح بالمعالجة (CORS) — نعرضها كما هي على خلفية بيضاء
      }
    };
    img.onerror = () => resolve('');
    img.src = src;
  });

export const whiteBackground = (src: string): Promise<string> => {
  if (cache.has(src)) return Promise.resolve(cache.get(src)!);
  if (!pending.has(src))
    pending.set(
      src,
      process(src).then((v) => {
        cache.set(src, v);
        pending.delete(src);
        return v;
      }),
    );
  return pending.get(src)!;
};

const ProductImage: React.FC<{ src?: string; className?: string; iconSize?: number }> = ({ src, className, iconSize = 24 }) => {
  const [out, setOut] = useState<string | undefined>(src ? cache.get(src) : undefined);
  useEffect(() => {
    let alive = true;
    if (!src) return setOut(undefined);
    if (cache.has(src)) return setOut(cache.get(src));
    setOut(undefined);
    whiteBackground(src).then((v) => alive && setOut(v));
    return () => {
      alive = false;
    };
  }, [src]);
  return (
    <div className={cx('grid place-items-center overflow-hidden bg-white', className)}>
      {src && out ? (
        <img src={out} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : src && out === undefined ? (
        <span className="h-full w-full animate-pulse bg-slate-100" />
      ) : (
        <Icon name="box" size={iconSize} className="text-ink-faint" />
      )}
    </div>
  );
};

export default ProductImage;
