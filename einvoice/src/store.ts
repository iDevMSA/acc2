// تخزين مجرّد فوق Realtime Database حتى تُختبر الخدمة بذاكرة مؤقتة.
//
// المسارات:
//   einvoiceVault/{uid}/zatca|eta   أسرار لا يقرؤها أي مستخدم (لا توجد لها قواعد قراءة؛ Admin SDK فقط)
//   users/{uid}/einvoice/...        بيانات يقرؤها الويب: البائع، الإعدادات، بيانات العملاء الضريبية،
//                                   حالة التسجيل، وحالة كل مستند وملفه XML
// لا نكتب أبداً في العقد التي يكتبها تطبيق الهاتف.

export interface Store {
  get<T = any>(path: string): Promise<T | null>;
  update(updates: Record<string, unknown>): Promise<void>;
  /** يعيد true إذا نجح الحجز */
  transaction<T>(path: string, fn: (current: T | null) => T | undefined): Promise<boolean>;
}

export const paths = {
  vault: (uid: string, p: 'zatca' | 'eta') => `einvoiceVault/${uid}/${p}`,
  base: (uid: string) => `users/${uid}/einvoice`,
  doc: (uid: string, key: string) => `users/${uid}/einvoice/docs/${key}`,
  xml: (uid: string, key: string) => `users/${uid}/einvoice/xml/${key}`,
};

/** قفل بسيط لكل مستخدم ومزوّد حتى لا يُستخدم نفس عدّاد الفواتير (ICV) مرتين */
export const withLock = async <T>(store: Store, path: string, fn: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const ok = await store.transaction<number>(path, (cur) => (cur && now - cur < 120_000 ? undefined : now));
  if (!ok) throw new Error('هناك عملية إرسال أخرى قيد التنفيذ، حاول بعد دقيقة');
  try {
    return await fn();
  } finally {
    await store.update({ [path]: null });
  }
};

export class MemoryStore implements Store {
  data: any = {};
  private node(path: string, create: boolean) {
    const parts = path.split('/').filter(Boolean);
    let cur = this.data;
    for (const p of parts.slice(0, -1)) {
      if (cur[p] === undefined || cur[p] === null || typeof cur[p] !== 'object') {
        if (!create) return { parent: undefined, key: parts[parts.length - 1] };
        cur[p] = {};
      }
      cur = cur[p];
    }
    return { parent: cur, key: parts[parts.length - 1] };
  }
  async get(path: string) {
    const { parent, key } = this.node(path, false);
    const v = parent?.[key];
    return v === undefined ? null : JSON.parse(JSON.stringify(v));
  }
  async update(updates: Record<string, unknown>) {
    for (const [path, value] of Object.entries(updates)) {
      const { parent, key } = this.node(path, true);
      if (value === null || value === undefined) delete parent[key];
      else parent[key] = JSON.parse(JSON.stringify(value));
    }
  }
  async transaction<T>(path: string, fn: (c: T | null) => T | undefined) {
    const next = fn(await this.get(path));
    if (next === undefined) return false;
    await this.update({ [path]: next });
    return true;
  }
}
