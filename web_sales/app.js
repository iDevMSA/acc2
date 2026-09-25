// ════════════════════════════════════════════════════════════════
//  app.js — المنصة المحاسبية - نظام المبيعات (نسخة الويب)
//  مزامنة حقيقية مع Firebase Realtime Database
// ════════════════════════════════════════════════════════════════
import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref, onValue, set, push, update, remove, get, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── إعدادات Firebase ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDz-jDwiRUoJWd0_oHsZCLnlw--0PcDOXk",
  authDomain:        "alaraby-4ccdd.firebaseapp.com",
  databaseURL:       "https://alaraby-4ccdd-default-rtdb.firebaseio.com",
  projectId:         "alaraby-4ccdd",
  storageBucket:     "alaraby-4ccdd.firebasestorage.app",
  messagingSenderId: "633240001820",
  appId:             "1:633240001820:web:alaraby4ccdd",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ── State ──────────────────────────────────────────────────────
let ownerUid   = null;
let dbRoot     = null;         // ref('sales/{ownerUid}')
let currency   = 'SAR';
let companyInfo = { name:'', phone:'', address:'', email:'' };
let allInvoices = {};
let allBranches = {};
let allWarehouses = {};
let allProducts = {};
let allEmployees = {};
let allLoyalty  = {};
let activeListeners = [];      // لإلغاء الاستماع عند تسجيل الخروج

// قائمة العملات (مُدمجة)
const CURRENCIES = [
  { code:'SAR', name:'ريال سعودي',       sym:'ر.س',  country:'السعودية' },
  { code:'AED', name:'درهم إماراتي',      sym:'د.إ',  country:'الإمارات' },
  { code:'KWD', name:'دينار كويتي',       sym:'د.ك',  country:'الكويت' },
  { code:'QAR', name:'ريال قطري',          sym:'ر.ق',  country:'قطر' },
  { code:'BHD', name:'دينار بحريني',      sym:'د.ب',  country:'البحرين' },
  { code:'OMR', name:'ريال عماني',         sym:'ر.ع',  country:'عمان' },
  { code:'JOD', name:'دينار أردني',       sym:'د.أ',  country:'الأردن' },
  { code:'EGP', name:'جنيه مصري',         sym:'ج.م',  country:'مصر' },
  { code:'IQD', name:'دينار عراقي',       sym:'د.ع',  country:'العراق' },
  { code:'MAD', name:'درهم مغربي',        sym:'د.م',  country:'المغرب' },
  { code:'TND', name:'دينار تونسي',       sym:'د.ت',  country:'تونس' },
  { code:'DZD', name:'دينار جزائري',      sym:'د.ج',  country:'الجزائر' },
  { code:'LYD', name:'دينار ليبي',        sym:'د.ل',  country:'ليبيا' },
  { code:'SYP', name:'ليرة سورية',        sym:'ل.س',  country:'سوريا' },
  { code:'LBP', name:'ليرة لبنانية',      sym:'ل.ل',  country:'لبنان' },
  { code:'YER', name:'ريال يمني',          sym:'ر.ي',  country:'اليمن' },
  { code:'SDG', name:'جنيه سوداني',       sym:'ج.س',  country:'السودان' },
  { code:'USD', name:'دولار أمريكي',      sym:'$',    country:'الولايات المتحدة' },
  { code:'EUR', name:'يورو',               sym:'€',    country:'منطقة اليورو' },
  { code:'GBP', name:'جنيه إسترليني',    sym:'£',    country:'بريطانيا' },
  { code:'JPY', name:'ين ياباني',          sym:'¥',    country:'اليابان' },
  { code:'CNY', name:'يوان صيني',          sym:'¥',    country:'الصين' },
  { code:'CHF', name:'فرنك سويسري',       sym:'Fr',   country:'سويسرا' },
  { code:'CAD', name:'دولار كندي',         sym:'C$',  country:'كندا' },
  { code:'AUD', name:'دولار أسترالي',     sym:'A$',  country:'أستراليا' },
  { code:'INR', name:'روبية هندية',        sym:'₹',    country:'الهند' },
  { code:'PKR', name:'روبية باكستانية',   sym:'₨',    country:'باكستان' },
  { code:'TRY', name:'ليرة تركية',         sym:'₺',    country:'تركيا' },
  { code:'RUB', name:'روبل روسي',          sym:'₽',    country:'روسيا' },
  { code:'BRL', name:'ريال برازيلي',       sym:'R$',  country:'البرازيل' },
  { code:'MXN', name:'بيسو مكسيكي',       sym:'MX$', country:'المكسيك' },
  { code:'ZAR', name:'راند جنوب أفريقي', sym:'R',    country:'جنوب أفريقيا' },
  { code:'SGD', name:'دولار سنغافوري',    sym:'S$',  country:'سنغافورة' },
  { code:'HKD', name:'دولار هونغ كونغ',  sym:'HK$', country:'هونغ كونغ' },
  { code:'MYR', name:'رينغيت ماليزي',     sym:'RM',   country:'ماليزيا' },
  { code:'IDR', name:'روبية إندونيسية',   sym:'Rp',   country:'إندونيسيا' },
  { code:'THB', name:'بات تايلاندي',       sym:'฿',    country:'تايلاند' },
  { code:'NGN', name:'نيرة نيجيرية',       sym:'₦',    country:'نيجيريا' },
  { code:'KRW', name:'وون كوري',           sym:'₩',    country:'كوريا الجنوبية' },
  { code:'PLN', name:'زلوتي بولندي',       sym:'zł',   country:'بولندا' },
  { code:'SEK', name:'كرونة سويدية',      sym:'kr',   country:'السويد' },
  { code:'NOK', name:'كرونة نرويجية',     sym:'kr',   country:'النرويج' },
  { code:'USDT',name:'تيثر',               sym:'USDT', country:'رقمي' },
];

function currencySym(code) {
  return (CURRENCIES.find(c => c.code === code) || { sym: code }).sym;
}

// يمنع XSS المخزّن: أي نص يُدخله المستخدم (اسم حساب/فرع/منتج/موظف،
// بيان عملية، بيانات فاتورة...) يُدرَج عبر innerHTML في هذا الملف،
// فيجب تحويل أحرف HTML الخاصة إلى كيانات نصية قبل إدراجه.
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// نفس قائمة CURRENCIES الكاملة (مع USDT) تُستخدم في كل مكان يُدخل فيه مبلغ بعملة
// — موحّدة مع قائمة العملات في تطبيق الجوال (kAllCurrencies)
function buildOpCurrencyOptions(selected) {
  const sel = document.getElementById('op-currency');
  if (!sel) return;
  sel.innerHTML = CURRENCIES.map(c =>
    `<option value="${c.code}">${c.code} — ${c.name}</option>`).join('');
  sel.value = selected || 'USD';
}

// ── Auth ────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    ownerUid = user.uid;

    // تحقق هل هو مالك أم موظف
    const empSnap = await get(ref(db, `employeeOwnerMap/${user.uid}`));
    if (empSnap.exists()) {
      // هو موظف — استخدم uid المالك
      ownerUid = empSnap.val();
    }

    dbRoot = ref(db, `sales/${ownerUid}`);
    showApp(user.displayName || user.email);
    startListeners();
  } else {
    stopListeners();
    showLogin();
  }
});

function showLogin() {
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('app-screen').style.display = 'none';
}
function showApp(name) {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('sidebar-user').textContent = name || 'المستخدم';
}

// ── Login / Logout ──────────────────────────────────────────────
window.doLogin = async function() {
  const email = document.getElementById('email-input').value.trim();
  const pass  = document.getElementById('pass-input').value;
  const err   = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  const txt   = document.getElementById('login-text');
  const spn   = document.getElementById('login-spinner');

  err.classList.add('hidden');
  txt.classList.add('hidden'); spn.classList.remove('hidden');
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    err.textContent = mapAuthError(e.code);
    err.classList.remove('hidden');
  } finally {
    txt.classList.remove('hidden'); spn.classList.add('hidden');
    btn.disabled = false;
  }
};

window.doLogout = async function() {
  await signOut(auth);
};

function mapAuthError(code) {
  switch(code) {
    case 'auth/user-not-found':     return 'المستخدم غير موجود';
    case 'auth/wrong-password':     return 'كلمة المرور خاطئة';
    case 'auth/invalid-email':      return 'البريد الإلكتروني غير صحيح';
    case 'auth/invalid-credential': return 'بيانات الدخول غير صحيحة';
    default: return 'خطأ في تسجيل الدخول';
  }
}

// ── Real-time Listeners ─────────────────────────────────────────
function startListeners() {
  addListener(`sales/${ownerUid}/settings`,              onSettings);
  addListener(`users/${ownerUid}/companyInfo`, onCompanyInfo);
  addListener(`sales/${ownerUid}/branches`,              onBranches);
  addListener(`sales/${ownerUid}/warehouses`,            onWarehouses);
  addListener(`sales/${ownerUid}/products`,              onProducts);
  addListener(`sales/${ownerUid}/employees`,             onEmployees);
  addListener(`sales/${ownerUid}/invoices`,              onInvoices);
  addListener(`sales/${ownerUid}/loyaltyCustomers`,      onLoyalty);
}

function addListener(path, cb) {
  const r = ref(db, path);
  const unsub = onValue(r, cb);
  activeListeners.push(unsub);
}

function stopListeners() {
  activeListeners.forEach(u => u());
  activeListeners = [];
  stopAccListeners();
  activeSystem = 'sales';
}

// ── Settings ────────────────────────────────────────────────────
function onSettings(snap) {
  const data = snap.val() || {};
  currency = data.currency || 'SAR';
  // تحديث الكيبيات
  refreshDashboard();
  refreshReports();
}

function onCompanyInfo(snap) {
  const data = snap.val() || {};
  companyInfo = {
    name:    data.name    || '',
    phone:   data.phone   || '',
    address: data.address || '',
    email:   data.email   || '',
  };
  document.getElementById('sidebar-company').textContent = companyInfo.name || 'نظام المبيعات';
  document.getElementById('set-company').value = companyInfo.name;
  document.getElementById('set-phone').value   = companyInfo.phone;
  document.getElementById('set-address').value = companyInfo.address;
  document.getElementById('set-email').value   = companyInfo.email;
}

// ── Branches ────────────────────────────────────────────────────
let editingBranchId = null;

function onBranches(snap) {
  allBranches = snap.val() || {};
  renderBranches();
  refreshWHDropdown();
  refreshDashboard();
  refreshEmpBranchDropdown();
}

function renderBranches() {
  const el = document.getElementById('branches-list');
  const entries = Object.entries(allBranches);
  if (!entries.length) { el.innerHTML = emptyState('🏪', 'لا توجد فروع بعد'); return; }
  el.innerHTML = entries.map(([id, b]) => `
    <div class="card-item" onclick="openEditBranch('${id}')">
      <div class="card-icon">🏪</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(b.name)}</div>
        <div class="card-sub">${typeLabel(b.type)}${b.address ? ' · ' + escapeHtml(b.address) : ''}</div>
      </div>
      <span class="badge badge-blue">${typeLabel(b.type)}</span>
    </div>`).join('');
}

function typeLabel(t) {
  const m = { restaurant:'مطعم', cafe:'كافيه', clinic:'عيادة', salon:'صالون', other:'أخرى' };
  return m[t] || 'متجر';
}

window.openAddBranch = function() {
  editingBranchId = null;
  document.getElementById('br-name').value    = '';
  document.getElementById('br-address').value = '';
  document.getElementById('br-type').value    = 'store';
  document.getElementById('branch-modal-title').textContent = 'إضافة فرع جديد';
  document.getElementById('branch-save-btn').textContent    = 'حفظ';
  document.getElementById('branch-del-btn').classList.add('hidden');
  openModal('branch-modal');
};

window.openEditBranch = function(id) {
  editingBranchId = id;
  const b = allBranches[id];
  document.getElementById('br-name').value    = b.name    || '';
  document.getElementById('br-address').value = b.address || '';
  document.getElementById('br-type').value    = b.type    || 'store';
  document.getElementById('branch-modal-title').textContent = 'تعديل الفرع';
  document.getElementById('branch-save-btn').textContent    = 'حفظ التعديلات';
  document.getElementById('branch-del-btn').classList.remove('hidden');
  openModal('branch-modal');
};

window.saveBranch = async function() {
  const name = document.getElementById('br-name').value.trim();
  if (!name) { showToast('أدخل اسم الفرع', 'error'); return; }
  const data = {
    name, ownerUid,
    address: document.getElementById('br-address').value.trim(),
    type:    document.getElementById('br-type').value,
  };
  try {
    if (editingBranchId) {
      await update(ref(db, `sales/${ownerUid}/branches/${editingBranchId}`), data);
      showToast('تم تحديث الفرع ✓', 'success');
    } else {
      await push(ref(db, `sales/${ownerUid}/branches`), { ...data, createdAt: new Date().toISOString() });
      showToast('تم إضافة الفرع ✓', 'success');
    }
    closeModal('branch-modal');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
};

window.deleteBranchFromModal = async function() {
  if (!editingBranchId || !confirm('حذف هذا الفرع؟')) return;
  await remove(ref(db, `sales/${ownerUid}/branches/${editingBranchId}`));
  closeModal('branch-modal');
  showToast('تم الحذف', 'success');
};

window.deleteBranch = async function(id, e) {
  e?.stopPropagation();
  if (!confirm('حذف هذا الفرع؟')) return;
  await remove(ref(db, `sales/${ownerUid}/branches/${id}`));
  showToast('تم الحذف', 'success');
};

// ── Warehouses ──────────────────────────────────────────────────
let editingWarehouseId = null;

function onWarehouses(snap) {
  allWarehouses = snap.val() || {};
  renderWarehouses();
  refreshWHDropdown();
}

function renderWarehouses() {
  const el = document.getElementById('warehouses-list');
  const entries = Object.entries(allWarehouses);
  if (!entries.length) { el.innerHTML = emptyState('🏭', 'لا توجد مخازن بعد'); return; }
  el.innerHTML = entries.map(([id, w]) => `
    <div class="card-item" onclick="openEditWarehouse('${id}')">
      <div class="card-icon">🏭</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(w.name)}</div>
        <div class="card-sub">الفرع: ${escapeHtml(allBranches[w.branchId]?.name || '—')}</div>
      </div>
      <span class="badge badge-orange">${escapeHtml(allBranches[w.branchId]?.name || 'بدون فرع')}</span>
    </div>`).join('');
}

function refreshWHDropdown() {
  const selWH = document.getElementById('wh-branch');
  const selPR = document.getElementById('pr-warehouse');
  const branchOpts = Object.entries(allBranches)
    .map(([id,b]) => `<option value="${id}">${b.name}</option>`).join('');
  const whOpts = Object.entries(allWarehouses)
    .map(([id,w]) => `<option value="${id}">${w.name}</option>`).join('');
  if (selWH) selWH.innerHTML = branchOpts || '<option value="">لا توجد فروع</option>';
  if (selPR) selPR.innerHTML = whOpts     || '<option value="">لا توجد مخازن</option>';
}

window.openAddWarehouse = function() {
  editingWarehouseId = null;
  document.getElementById('wh-name').value = '';
  refreshWHDropdown();
  document.getElementById('warehouse-modal-title').textContent = 'إضافة مخزن جديد';
  document.getElementById('warehouse-save-btn').textContent    = 'حفظ';
  document.getElementById('warehouse-del-btn').classList.add('hidden');
  openModal('warehouse-modal');
};

window.openEditWarehouse = function(id) {
  editingWarehouseId = id;
  const w = allWarehouses[id];
  document.getElementById('wh-name').value = w.name || '';
  refreshWHDropdown();
  document.getElementById('wh-branch').value = w.branchId || '';
  document.getElementById('warehouse-modal-title').textContent = 'تعديل المخزن';
  document.getElementById('warehouse-save-btn').textContent    = 'حفظ التعديلات';
  document.getElementById('warehouse-del-btn').classList.remove('hidden');
  openModal('warehouse-modal');
};

window.saveWarehouse = async function() {
  const name = document.getElementById('wh-name').value.trim();
  const branchId = document.getElementById('wh-branch').value;
  if (!name) { showToast('أدخل اسم المخزن', 'error'); return; }
  const data = { name, branchId, ownerUid };
  try {
    if (editingWarehouseId) {
      await update(ref(db, `sales/${ownerUid}/warehouses/${editingWarehouseId}`), data);
      showToast('تم تحديث المخزن ✓', 'success');
    } else {
      await push(ref(db, `sales/${ownerUid}/warehouses`), data);
      showToast('تم إضافة المخزن ✓', 'success');
    }
    closeModal('warehouse-modal');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
};

window.deleteWarehouseFromModal = async function() {
  if (!editingWarehouseId || !confirm('حذف هذا المخزن؟')) return;
  await remove(ref(db, `sales/${ownerUid}/warehouses/${editingWarehouseId}`));
  closeModal('warehouse-modal');
  showToast('تم الحذف', 'success');
};

window.deleteWarehouse = async function(id, e) {
  e?.stopPropagation();
  if (!confirm('حذف هذا المخزن؟')) return;
  await remove(ref(db, `sales/${ownerUid}/warehouses/${id}`));
  showToast('تم الحذف', 'success');
};

// ── Products ────────────────────────────────────────────────────
let editingProductId = null;

function onProducts(snap) {
  allProducts = snap.val() || {};
  renderProducts();
}

function renderProducts() {
  const el = document.getElementById('products-list');
  let entries = Object.entries(allProducts);

  // Apply text filter
  if (productFilterText) {
    entries = entries.filter(([,p]) =>
      p.name?.toLowerCase().includes(productFilterText) ||
      p.barcode?.toLowerCase().includes(productFilterText) ||
      p.category?.toLowerCase().includes(productFilterText));
  }

  // Apply category filter
  if (productCategoryFilter) {
    entries = entries.filter(([,p]) => p.category === productCategoryFilter);
  }

  if (!entries.length) {
    el.innerHTML = emptyState('📦', 'لا توجد منتجات');
    return;
  }

  el.innerHTML = entries.map(([id, p]) => `
    <div class="card-item" onclick="openEditProduct('${id}')">
      <div class="card-icon">📦</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(p.name)}</div>
        <div class="card-sub">
          ${p.category ? escapeHtml(p.category) + ' · ' : ''}
          الكمية: <b>${p.quantity || 0}</b> ·
          السعر: <b>${p.sellPrice || 0} ${currencySym(currency)}</b>
          ${p.barcode ? ' · ' + escapeHtml(p.barcode) : ''}
        </div>
      </div>
      <div class="card-badge">
        <span class="badge ${(p.quantity||0) > 5 ? 'badge-green' : 'badge-red'}">
          ${(p.quantity||0) > 5 ? 'متوفر' : 'ينفد'}
        </span>
      </div>
    </div>`).join('');
};

window.openAddProduct = function() {
  editingProductId = null;
  ['pr-name','pr-cost','pr-price','pr-qty','pr-vat','pr-barcode','pr-category','pr-desc']
    .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  refreshWHDropdown();
  document.getElementById('product-modal-title').textContent = 'إضافة منتج جديد';
  document.getElementById('product-save-btn').textContent    = 'حفظ المنتج';
  document.getElementById('product-del-btn').classList.add('hidden');
  openModal('product-modal');
};

window.openEditProduct = function(id) {
  editingProductId = id;
  const p = allProducts[id];
  document.getElementById('pr-name').value     = p.name       || '';
  document.getElementById('pr-cost').value     = p.costPrice  || '';
  document.getElementById('pr-price').value    = p.sellPrice  || '';
  document.getElementById('pr-qty').value      = p.quantity   || '';
  document.getElementById('pr-vat').value      = p.vatRate    || '';
  document.getElementById('pr-barcode').value  = p.barcode    || '';
  document.getElementById('pr-category').value = p.category   || '';
  const descEl = document.getElementById('pr-desc');
  if (descEl) descEl.value = p.description || '';
  refreshWHDropdown();
  document.getElementById('pr-warehouse').value = p.warehouseId || '';
  document.getElementById('product-modal-title').textContent = 'تعديل المنتج';
  document.getElementById('product-save-btn').textContent    = 'حفظ التعديلات';
  document.getElementById('product-del-btn').classList.remove('hidden');
  openModal('product-modal');
};

window.saveProduct = async function() {
  const name = document.getElementById('pr-name').value.trim();
  if (!name) { showToast('أدخل اسم المنتج', 'error'); return; }
  const data = {
    name, ownerUid,
    warehouseId:  document.getElementById('pr-warehouse').value,
    costPrice:    parseFloat(document.getElementById('pr-cost').value)     || 0,
    sellPrice:    parseFloat(document.getElementById('pr-price').value)    || 0,
    quantity:     parseFloat(document.getElementById('pr-qty').value)      || 0,
    vatRate:      parseFloat(document.getElementById('pr-vat').value)      || 0,
    barcode:      document.getElementById('pr-barcode').value.trim()       || null,
    category:     document.getElementById('pr-category').value.trim()      || null,
    description:  document.getElementById('pr-desc')?.value.trim()        || null,
  };
  try {
    if (editingProductId) {
      await update(ref(db, `sales/${ownerUid}/products/${editingProductId}`), data);
      showToast('تم تحديث المنتج ✓', 'success');
    } else {
      await push(ref(db, `sales/${ownerUid}/products`), { ...data, createdAt: new Date().toISOString() });
      showToast('تم إضافة المنتج ✓', 'success');
    }
    closeModal('product-modal');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
};

window.deleteProductFromModal = async function() {
  if (!editingProductId || !confirm('حذف هذا المنتج؟')) return;
  await remove(ref(db, `sales/${ownerUid}/products/${editingProductId}`));
  closeModal('product-modal');
  showToast('تم الحذف', 'success');
};

window.deleteProduct = async function(id, e) {
  e?.stopPropagation();
  if (!confirm('حذف هذا المنتج؟')) return;
  await remove(ref(db, `sales/${ownerUid}/products/${id}`));
  showToast('تم الحذف', 'success');
};

// ── Employees ───────────────────────────────────────────────────
let editingEmployeeId = null;

function onEmployees(snap) {
  allEmployees = snap.val() || {};
  renderEmployees();
}

function renderEmployees() {
  const el = document.getElementById('employees-list');
  const entries = Object.entries(allEmployees);
  if (!entries.length) { el.innerHTML = emptyState('👥', 'لا يوجد موظفون'); return; }
  el.innerHTML = entries.map(([id, e]) => `
    <div class="card-item" onclick="openEditEmployee('${id}')">
      <div class="card-icon">👤</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(e.name)}</div>
        <div class="card-sub">
          ${e.email ? escapeHtml(e.email) + ' · ' : ''}
          ${roleLabel(e.role)}
          ${allBranches[e.branchId] ? ' · ' + escapeHtml(allBranches[e.branchId].name) : ''}
        </div>
      </div>
      <span class="badge ${e.role === 'owner' ? 'badge-blue' : e.role === 'manager' ? 'badge-orange' : 'badge-green'}">
        ${roleLabel(e.role)}
      </span>
    </div>`).join('');
}

function roleLabel(r) {
  return r === 'owner' ? 'مالك' : r === 'manager' ? 'مدير' : 'كاشير';
}

function refreshEmpBranchDropdown() {
  const sel = document.getElementById('emp-branch');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">بدون فرع</option>` +
    Object.entries(allBranches)
      .map(([id,b]) => `<option value="${id}" ${id===cur?'selected':''}>${b.name}</option>`)
      .join('');
}

window.openAddEmployee = function() {
  editingEmployeeId = null;
  ['emp-name','emp-email','emp-phone'].forEach(id =>
    { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('emp-role').value = 'cashier';
  refreshEmpBranchDropdown();
  document.getElementById('employee-modal-title').textContent = 'إضافة موظف جديد';
  document.getElementById('employee-save-btn').textContent    = 'حفظ الموظف';
  document.getElementById('employee-del-btn').classList.add('hidden');
  openModal('employee-modal');
};

window.openEditEmployee = function(id) {
  editingEmployeeId = id;
  const e = allEmployees[id];
  document.getElementById('emp-name').value  = e.name  || '';
  document.getElementById('emp-email').value = e.email || '';
  document.getElementById('emp-phone').value = e.phone || '';
  document.getElementById('emp-role').value  = e.role  || 'cashier';
  refreshEmpBranchDropdown();
  document.getElementById('emp-branch').value = e.branchId || '';
  document.getElementById('employee-modal-title').textContent = 'تعديل بيانات الموظف';
  document.getElementById('employee-save-btn').textContent    = 'حفظ التعديلات';
  document.getElementById('employee-del-btn').classList.remove('hidden');
  openModal('employee-modal');
};

window.saveEmployee = async function() {
  const name = document.getElementById('emp-name').value.trim();
  if (!name) { showToast('أدخل اسم الموظف', 'error'); return; }
  const data = {
    name,
    email:    document.getElementById('emp-email').value.trim()  || null,
    phone:    document.getElementById('emp-phone').value.trim()  || null,
    role:     document.getElementById('emp-role').value,
    branchId: document.getElementById('emp-branch').value        || null,
    ownerUid,
  };
  try {
    if (editingEmployeeId) {
      await update(ref(db, `sales/${ownerUid}/employees/${editingEmployeeId}`), data);
      showToast('تم تحديث بيانات الموظف ✓', 'success');
    } else {
      await push(ref(db, `sales/${ownerUid}/employees`), { ...data, createdAt: new Date().toISOString() });
      showToast('تم إضافة الموظف ✓', 'success');
    }
    closeModal('employee-modal');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
};

window.deleteEmployeeFromModal = async function() {
  if (!editingEmployeeId || !confirm('حذف هذا الموظف؟')) return;
  await remove(ref(db, `sales/${ownerUid}/employees/${editingEmployeeId}`));
  closeModal('employee-modal');
  showToast('تم الحذف', 'success');
};

// ── Invoices ────────────────────────────────────────────────────
function onInvoices(snap) {
  allInvoices = snap.val() || {};
  renderInvoices();
  refreshDashboard();
  refreshReports();
}

let invFilter = { from: null, to: null };

function renderInvoices() {
  const el = document.getElementById('invoices-list');
  let entries = Object.entries(allInvoices)
    .filter(([,inv]) => inv.status === 'closed')
    .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));

  if (invFilter.from) {
    entries = entries.filter(([,inv]) => new Date(inv.createdAt) >= invFilter.from);
  }
  if (invFilter.to) {
    entries = entries.filter(([,inv]) => new Date(inv.createdAt) <= invFilter.to);
  }

  if (!entries.length) { el.innerHTML = emptyState('🧾', 'لا توجد فواتير'); return; }
  el.innerHTML = entries.map(([id, inv]) => `
    <div class="card-item" onclick="showInvoiceDetail('${id}')">
      <div class="card-icon">🧾</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(inv.number)}</div>
        <div class="card-sub">${formatDate(inv.createdAt)} · ${escapeHtml(inv.createdByName || '—')}</div>
      </div>
      <div>
        <div class="card-badge">${totalInv(inv).toFixed(2)} ${currencySym(currency)}</div>
        <div style="text-align:center;margin-top:4px">
          <span class="badge ${payBadge(inv.paymentMethod)}">${payLabel(inv.paymentMethod)}</span>
        </div>
      </div>
    </div>`).join('');
}

window.filterInvoices = function() {
  const fromVal = document.getElementById('inv-from').value;
  const toVal   = document.getElementById('inv-to').value;
  invFilter.from = fromVal ? new Date(fromVal + 'T00:00:00') : null;
  invFilter.to   = toVal   ? new Date(toVal   + 'T23:59:59') : null;
  renderInvoices();
};

function totalInv(inv) {
  const sub = (inv.items||[]).reduce((s,i) => s + i.quantity*i.unitPrice, 0);
  const vat = (inv.items||[]).reduce((s,i) => s + i.quantity*i.unitPrice*(i.vatRate||0)/100, 0);
  const tot = sub + vat - (inv.discount||0);
  const frac = tot - Math.floor(tot);
  return frac >= 0.5 ? Math.ceil(tot) : Math.floor(tot);
}

function payLabel(m) {
  return m === 'card' ? 'بطاقة' : m === 'transfer' ? 'تحويل' : 'نقداً';
}
function payBadge(m) {
  return m === 'card' ? 'badge-blue' : m === 'transfer' ? 'badge-orange' : 'badge-green';
}

window.showInvoiceDetail = function(id) {
  const inv = allInvoices[id];
  if (!inv) return;
  document.getElementById('inv-modal-title').textContent = `فاتورة ${inv.number}`;
  const sym = currencySym(currency);
  const sub = (inv.items||[]).reduce((s,i) => s + i.quantity*i.unitPrice, 0);
  const vat = (inv.items||[]).reduce((s,i) => s + i.quantity*i.unitPrice*(i.vatRate||0)/100, 0);
  const tot = totalInv(inv);
  const items = (inv.items||[]).map(i => `
    <tr>
      <td>${escapeHtml(i.productName)}</td>
      <td>×${i.quantity}</td>
      <td>${i.unitPrice.toFixed(2)}</td>
      <td>${(i.vatRate||0).toFixed(0)}%</td>
      <td>${(i.quantity*i.unitPrice).toFixed(2)}</td>
    </tr>`).join('');
  document.getElementById('invoice-detail-body').innerHTML = `
    <div class="inv-header-card">
      <div class="inv-header-row">
        <div>
          <div class="inv-company">${escapeHtml(companyInfo.name || 'الشركة')}</div>
          <div class="inv-sub">فاتورة مبيعات</div>
        </div>
        <div class="inv-badge">فاتورة</div>
      </div>
      <div class="inv-meta-row">
        <div class="inv-meta-item"><label>رقم الفاتورة</label><span>${escapeHtml(inv.number)}</span></div>
        <div class="inv-meta-item"><label>التاريخ</label><span>${formatDate(inv.createdAt)}</span></div>
        <div class="inv-meta-item"><label>الموظف</label><span>${escapeHtml(inv.createdByName||'—')}</span></div>
        <div class="inv-meta-item"><label>طريقة الدفع</label><span>${payLabel(inv.paymentMethod)}</span></div>
      </div>
    </div>
    ${inv.customerName||inv.customerPhone ? `
    <div class="inv-section">
      <div class="inv-section-title">بيانات العميل</div>
      ${inv.customerName ? `<div>الاسم: <b>${escapeHtml(inv.customerName)}</b></div>` : ''}
      ${inv.customerPhone ? `<div>الهاتف: <b dir="ltr">${escapeHtml(inv.customerPhone)}</b></div>` : ''}
    </div>` : ''}
    <div class="inv-section">
      <div class="inv-section-title">تفاصيل الطلب</div>
      <table class="inv-table">
        <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الضريبة</th><th>الإجمالي (${sym})</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
    </div>
    <div class="inv-section">
      <div class="inv-section-title">ملخص الفاتورة</div>
      <div class="totals-box">
        <div class="tot-row"><span>المجموع الفرعي</span><span>${sub.toFixed(2)} ${sym}</span></div>
        ${vat > 0 ? `<div class="tot-row"><span>الضريبة</span><span>${vat.toFixed(2)} ${sym}</span></div>` : ''}
        ${inv.discount > 0 ? `<div class="tot-row"><span>الخصم</span><span>- ${(inv.discount||0).toFixed(2)} ${sym}</span></div>` : ''}
        <div class="tot-row big"><span>الإجمالي</span><span>${tot.toFixed(2)} ${sym}</span></div>
        <div class="tot-row"><span>المدفوع</span><span>${(inv.amountPaid||0).toFixed(2)} ${sym}</span></div>
      </div>
    </div>
    <div class="signature-box">
      <div class="sig-title">تم الإنشاء بواسطة المنصة المحاسبية</div>
      <div class="sig-sub">نسخة مرخصة لصالح: ${escapeHtml(companyInfo.name||'الشركة')}</div>
    </div>`;
  openModal('invoice-detail-modal');
};

// ── Dashboard ───────────────────────────────────────────────────
function getDashboardDateRange() {
  const period = document.getElementById('dashboard-period')?.value || 'today';
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);
  to.setHours(23,59,59,999);

  switch(period) {
    case 'week':
      from.setDate(now.getDate() - now.getDay());
      from.setHours(0,0,0,0);
      break;
    case 'month':
      from.setDate(1);
      from.setHours(0,0,0,0);
      break;
    case 'year':
      from.setMonth(0,1);
      from.setHours(0,0,0,0);
      break;
    case 'today':
    default:
      from.setHours(0,0,0,0);
  }
  return { from, to };
}

function refreshDashboard() {
  const { from, to } = getDashboardDateRange();
  const entries = Object.entries(allInvoices)
    .filter(([,inv]) => inv.status === 'closed' && new Date(inv.createdAt) >= from && new Date(inv.createdAt) <= to);

  const revenue = entries.reduce((s,[,inv]) => s + totalInv(inv), 0);
  const sym = currencySym(currency);
  const count = entries.length;
  const avg = count ? revenue / count : 0;

  // Calculate previous period comparison
  let prevFrom = new Date(from);
  let prevTo = new Date(to);
  const diff = to.getTime() - from.getTime();
  prevFrom.setTime(prevFrom.getTime() - diff - 864e5);
  prevTo.setTime(prevTo.getTime() - diff);

  const prevEntries = Object.entries(allInvoices)
    .filter(([,inv]) => inv.status === 'closed' && new Date(inv.createdAt) >= prevFrom && new Date(inv.createdAt) <= prevTo);
  const prevRevenue = prevEntries.reduce((s,[,inv]) => s + totalInv(inv), 0);
  const prevCount = prevEntries.length;

  const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100).toFixed(1) : 0;
  const invoiceChange = prevCount > 0 ? ((count - prevCount) / prevCount * 100).toFixed(1) : 0;

  document.getElementById('kpi-revenue').textContent   = `${revenue.toFixed(2)} ${sym}`;
  document.getElementById('kpi-revenue-change').textContent = `${revenueChange > 0 ? '↑' : '↓'} ${Math.abs(revenueChange)}%`;
  document.getElementById('kpi-invoices').textContent  = count;
  document.getElementById('kpi-invoices-change').textContent = `${invoiceChange > 0 ? '↑' : '↓'} ${Math.abs(invoiceChange)}%`;
  document.getElementById('kpi-branches').textContent  = Object.keys(allBranches).length;

  // More detailed statistics
  const vatTotal = entries.reduce((s,[,inv]) =>
    s + (inv.items||[]).reduce((ss,i)=>ss + i.quantity*i.unitPrice*(i.vatRate||0)/100, 0), 0);
  const dayCount = Math.ceil((to.getTime() - from.getTime()) / 864e5);
  const dailyAvg = dayCount > 0 ? revenue / dayCount : 0;
  const maxInv = entries.reduce((max, [,inv]) => Math.max(max, totalInv(inv)), 0);

  document.getElementById('stat-avg-invoice').textContent = `${avg.toFixed(2)} ${sym}`;
  document.getElementById('stat-total-vat').textContent = `${vatTotal.toFixed(2)} ${sym}`;
  document.getElementById('stat-daily-avg').textContent = `${dailyAvg.toFixed(2)} ${sym}`;
  document.getElementById('stat-max-invoice').textContent = `${maxInv.toFixed(2)} ${sym}`;

  // صناديق مفتوحة
  const regsSnap = ref(db, `sales/${ownerUid}/cashRegisters`);
  get(regsSnap).then(s => {
    const regs = s.val() || {};
    const open = Object.values(regs).filter(r => r.sessionOpen).length;
    document.getElementById('kpi-registers').textContent = open;
  });

  // Render charts
  renderDashboardCharts(entries);

  // آخر الفواتير
  const recent = entries
    .sort((a,b) => new Date(b[1].createdAt) - new Date(a[1].createdAt))
    .slice(0, 8);
  const el = document.getElementById('recent-invoices');
  if (!recent.length) { el.innerHTML = emptyState('🧾', 'لا توجد فواتير'); return; }
  el.innerHTML = recent.map(([id, inv]) => `
    <div class="card-item" onclick="showInvoiceDetail('${id}')">
      <div class="card-icon">🧾</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(inv.number)}</div>
        <div class="card-sub">${formatTime(inv.createdAt)} · ${escapeHtml(inv.createdByName||'—')}</div>
      </div>
      <div class="card-badge">${totalInv(inv).toFixed(2)} ${sym}</div>
    </div>`).join('');
}

function renderDashboardCharts(entries) {
  const sym = currencySym(currency);

  // Payment methods chart
  const payMap = {};
  entries.forEach(([,inv]) => {
    const pm = inv.paymentMethod || 'النقد';
    payMap[pm] = (payMap[pm] || 0) + totalInv(inv);
  });
  if (Object.keys(payMap).length > 0) {
    createChartIfNeeded('dashPaymentChartCanvas', 'pie', {
      labels: Object.keys(payMap),
      datasets: [{
        data: Object.values(payMap),
        backgroundColor: ['#3b82f6','#10b981','#8b5cf6','#f59e0b'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    });
  }

  // Top products
  const prodMap = {};
  entries.forEach(([,inv]) => {
    (inv.items || []).forEach(item => {
      const pname = item.productName || 'غير معروف';
      prodMap[pname] = (prodMap[pname] || 0) + (item.quantity || 0);
    });
  });
  const top5 = Object.entries(prodMap)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5)
    .reduce((a,[k,v]) => ({...a, [k]:v}), {});
  if (Object.keys(top5).length > 0) {
    createChartIfNeeded('dashTopProductsCanvas', 'bar', {
      labels: Object.keys(top5),
      datasets: [{
        label: 'الوحدات',
        data: Object.values(top5),
        backgroundColor: '#8b5cf6',
        borderColor: '#6d28d9',
        borderWidth: 1
      }]
    });
  }
}

// ── Reports ─────────────────────────────────────────────────────
function refreshReports() {
  const fromEl = document.getElementById('rep-from');
  const toEl   = document.getElementById('rep-to');
  if (!fromEl) return;

  const from = fromEl.value ? new Date(fromEl.value+'T00:00:00') : null;
  const to   = toEl.value   ? new Date(toEl.value+'T23:59:59')   : null;

  let entries = Object.entries(allInvoices)
    .filter(([,inv]) => inv.status === 'closed');
  if (from) entries = entries.filter(([,inv]) => new Date(inv.createdAt) >= from);
  if (to)   entries = entries.filter(([,inv]) => new Date(inv.createdAt) <= to);

  const sym      = currencySym(currency);
  const revenue  = entries.reduce((s,[,inv]) => s + totalInv(inv), 0);
  const count    = entries.length;
  const avg      = count ? revenue/count : 0;
  const vatTotal = entries.reduce((s,[,inv]) =>
    s + (inv.items||[]).reduce((ss,i)=>ss + i.quantity*i.unitPrice*(i.vatRate||0)/100, 0), 0);

  document.getElementById('rep-revenue').textContent = `${revenue.toFixed(2)} ${sym}`;
  document.getElementById('rep-count').textContent   = count;
  document.getElementById('rep-avg').textContent     = `${avg.toFixed(2)} ${sym}`;
  document.getElementById('rep-vat').textContent     = `${vatTotal.toFixed(2)} ${sym}`;

  // طرق الدفع
  const payMap = {};
  entries.forEach(([,inv]) => {
    const k = payLabel(inv.paymentMethod);
    payMap[k] = (payMap[k]||0) + totalInv(inv);
  });
  renderBarChart('payment-chart', payMap, sym);

  // أكثر المنتجات
  const prodMap = {};
  entries.forEach(([,inv]) => {
    (inv.items||[]).forEach(i => {
      prodMap[i.productName] = (prodMap[i.productName]||0) + i.quantity;
    });
  });
  const top10 = Object.fromEntries(
    Object.entries(prodMap).sort((a,b)=>b[1]-a[1]).slice(0,10));
  renderBarChart('products-chart', top10, 'وحدة');

  // مبيعات يومية
  const dayMap = {};
  entries.forEach(([,inv]) => {
    const d = inv.createdAt ? inv.createdAt.substring(0,10) : '—';
    dayMap[d] = (dayMap[d]||0) + totalInv(inv);
  });
  const sortedDays = Object.fromEntries(Object.entries(dayMap).sort((a,b)=>a[0].localeCompare(b[0])));
  renderBarChart('daily-chart', sortedDays, sym);

  // Render Chart.js charts
  if (typeof renderCharts === 'function') {
    renderCharts();
  }
}

window.loadReports = refreshReports;

function renderBarChart(elId, data, unit) {
  const el = document.getElementById(elId);
  if (!el) return;
  const entries = Object.entries(data);
  if (!entries.length) { el.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:20px">لا توجد بيانات</div>`; return; }
  const max = Math.max(...entries.map(e=>e[1]));
  el.innerHTML = entries.map(([label, val]) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(label)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${max>0?val/max*100:0}%"></div>
      </div>
      <div class="bar-val">${typeof val === 'number' ? val.toFixed(val%1===0?0:2) : val} ${unit}</div>
    </div>`).join('');
}

// ── Loyalty ─────────────────────────────────────────────────────
let editingLoyaltyId = null;

function onLoyalty(snap) {
  allLoyalty = snap.val() || {};
  renderLoyalty();
}

let loyaltyFilter = '';
function renderLoyalty() {
  let entries = Object.entries(allLoyalty);
  if (loyaltyFilter) {
    const q = loyaltyFilter.toLowerCase();
    entries = entries.filter(([,c]) =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q));
  }
  document.getElementById('loyal-count').textContent  = Object.keys(allLoyalty).length;
  document.getElementById('loyal-points').textContent =
    Object.values(allLoyalty).reduce((s,c)=>s+(c.points||0), 0);
  const el = document.getElementById('loyalty-list');
  if (!entries.length) { el.innerHTML = emptyState('💖', 'لا يوجد عملاء ولاء'); return; }
  el.innerHTML = entries
    .sort((a,b) => (b[1].points||0) - (a[1].points||0))
    .map(([id,c]) => `
    <div class="card-item" onclick="openEditLoyalty('${id}')">
      <div class="card-icon">💖</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(c.name||'—')}</div>
        <div class="card-sub" dir="ltr">${escapeHtml(c.phone||'')}${c.notes ? ' · ' + escapeHtml(c.notes) : ''}</div>
      </div>
      <div style="text-align:center">
        <div class="card-badge">⭐ ${c.points||0} نقطة</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${tierLabel(c.points||0)}</div>
      </div>
    </div>`).join('');
}

window.filterLoyalty = function() {
  loyaltyFilter = document.getElementById('loyalty-search').value;
  renderLoyalty();
};

function tierLabel(pts) {
  if (pts >= 1000) return '🏆 بلاتيني';
  if (pts >= 500)  return '🥇 ذهبي';
  if (pts >= 200)  return '🥈 فضي';
  return '🟤 برونزي';
}

window.openAddLoyalty = function() {
  editingLoyaltyId = null;
  ['loy-name','loy-phone','loy-notes'].forEach(id =>
    { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('loy-points').value = '0';
  document.getElementById('loyalty-modal-title').textContent = 'إضافة عميل ولاء';
  document.getElementById('loyalty-save-btn').textContent    = 'حفظ العميل';
  document.getElementById('loyalty-del-btn').classList.add('hidden');
  openModal('loyalty-modal');
};

window.openEditLoyalty = function(id) {
  editingLoyaltyId = id;
  const c = allLoyalty[id];
  document.getElementById('loy-name').value   = c.name   || '';
  document.getElementById('loy-phone').value  = c.phone  || '';
  document.getElementById('loy-points').value = c.points || 0;
  document.getElementById('loy-notes').value  = c.notes  || '';
  document.getElementById('loyalty-modal-title').textContent = 'تعديل عميل الولاء';
  document.getElementById('loyalty-save-btn').textContent    = 'حفظ التعديلات';
  document.getElementById('loyalty-del-btn').classList.remove('hidden');
  openModal('loyalty-modal');
};

window.saveLoyaltyCustomer = async function() {
  const name  = document.getElementById('loy-name').value.trim();
  const phone = document.getElementById('loy-phone').value.trim();
  if (!name)  { showToast('أدخل اسم العميل', 'error'); return; }
  if (!phone) { showToast('أدخل رقم الهاتف', 'error'); return; }
  const data = {
    name, phone,
    points: parseInt(document.getElementById('loy-points').value) || 0,
    notes:  document.getElementById('loy-notes').value.trim() || null,
    ownerUid,
  };
  try {
    if (editingLoyaltyId) {
      await update(ref(db, `sales/${ownerUid}/loyaltyCustomers/${editingLoyaltyId}`), data);
      showToast('تم تحديث العميل ✓', 'success');
    } else {
      await push(ref(db, `sales/${ownerUid}/loyaltyCustomers`), { ...data, createdAt: new Date().toISOString() });
      showToast('تم إضافة العميل ✓', 'success');
    }
    closeModal('loyalty-modal');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
};

window.deleteLoyaltyFromModal = async function() {
  if (!editingLoyaltyId || !confirm('حذف هذا العميل من برنامج الولاء؟')) return;
  await remove(ref(db, `sales/${ownerUid}/loyaltyCustomers/${editingLoyaltyId}`));
  closeModal('loyalty-modal');
  showToast('تم الحذف', 'success');
};

// ── Settings ────────────────────────────────────────────────────
window.saveSettings = async function() {
  const btn = document.getElementById('save-settings-btn');
  const txt = document.getElementById('save-text');
  const spn = document.getElementById('save-spinner');
  txt.classList.add('hidden'); spn.classList.remove('hidden');
  btn.disabled = true;
  try {
    // حفظ العملة
    await set(ref(db, `sales/${ownerUid}/settings/currency`), currency);
    // حفظ معلومات الشركة — نفس مصدر النظام المحاسبي الرئيسي (users/{uid}/companyInfo)
    await set(ref(db, `users/${ownerUid}/companyInfo`), {
      name:    document.getElementById('set-company').value.trim(),
      phone:   document.getElementById('set-phone').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      email:   document.getElementById('set-email').value.trim(),
    });
    showToast('تم حفظ الإعدادات ✓', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ: ' + e.message, 'error');
  } finally {
    txt.classList.remove('hidden'); spn.classList.add('hidden');
    btn.disabled = false;
  }
};

// ── Currency Picker ─────────────────────────────────────────────
function buildCurrencyList() {
  const el = document.getElementById('cur-list');
  el.innerHTML = CURRENCIES.map(c => `
    <div class="cur-item ${currency===c.code?'active':''}"
         data-code="${c.code}" onclick="selectCurrency('${c.code}')">
      <div class="sym">${c.sym}</div>
      <div class="cur-info">
        <div class="name">${c.name}</div>
        <div class="code">${c.code} · ${c.country}</div>
      </div>
      ${currency===c.code ? '<span class="check">✓</span>' : ''}
    </div>`).join('');
}

window.toggleCurrencyPicker = function() {
  const el = document.getElementById('currency-picker');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) {
    buildCurrencyList();
    document.getElementById('cur-search').focus();
  }
};

window.filterCurrencies = function() {
  const q = document.getElementById('cur-search').value.toLowerCase();
  const filtered = CURRENCIES.filter(c =>
    c.name.includes(q) || c.code.toLowerCase().includes(q) || c.country.includes(q));
  const el = document.getElementById('cur-list');
  el.innerHTML = filtered.map(c => `
    <div class="cur-item ${currency===c.code?'active':''}"
         data-code="${c.code}" onclick="selectCurrency('${c.code}')">
      <div class="sym">${c.sym}</div>
      <div class="cur-info">
        <div class="name">${c.name}</div>
        <div class="code">${c.code} · ${c.country}</div>
      </div>
      ${currency===c.code ? '<span class="check">✓</span>' : ''}
    </div>`).join('');
};

window.selectCurrency = function(code) {
  currency = code;
  const c = CURRENCIES.find(x => x.code === code);
  document.getElementById('cur-symbol').textContent = c?.sym || code;
  document.getElementById('cur-name').textContent   = `${c?.name||code} (${code})`;
  document.getElementById('currency-picker').classList.add('hidden');
  // إعادة رسم القوائم بالعملة الجديدة
  renderProducts();
  renderInvoices();
  refreshDashboard();
  refreshReports();
};

// إغلاق منتقي العملة بالضغط خارجه
document.addEventListener('click', (e) => {
  const picker = document.getElementById('currency-picker');
  const btn    = document.getElementById('selected-currency-btn');
  if (picker && !picker.contains(e.target) && btn && !btn.contains(e.target)) {
    picker.classList.add('hidden');
  }
});

// ── Navigation ──────────────────────────────────────────────────
const TAB_TITLES = {
  dashboard: 'الرئيسية',
  branches:  'الفروع',
  warehouses:'المخازن',
  products:  'المنتجات',
  employees: 'الموظفون',
  invoices:  'الفواتير',
  reports:   'التقارير',
  loyalty:   'الولاء',
  settings:  'الإعدادات',
};

window.switchTab = function(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');
  document.getElementById('page-title').textContent = TAB_TITLES[name] || name;

  // تأخير رسم التقارير حتى تكون مرئية
  if (name === 'reports') {
    // ضع تواريخ افتراضية إن لم تكن موجودة
    const repFrom = document.getElementById('rep-from');
    const repTo   = document.getElementById('rep-to');
    if (!repFrom.value) {
      const d = new Date(); d.setDate(d.getDate() - 30);
      repFrom.value = d.toISOString().substring(0,10);
    }
    if (!repTo.value) {
      repTo.value = new Date().toISOString().substring(0,10);
    }
    refreshReports();
  }

  // إغلاق الـ sidebar في الموبايل
  document.getElementById('sidebar').classList.remove('open');

  // تحديث ظهور البحث العام
  if (typeof updateGlobalSearch === 'function') {
    updateGlobalSearch();
  }
};

window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
};

// ── Modals ──────────────────────────────────────────────────────
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
};
window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('hidden'); el.style.display = ''; }
};
window.closeModalOutside = function(e, id) {
  if (e.target.id === id) closeModal(id);
};

// ── Toast ───────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast hidden', 3500);
}

// ── Helpers ─────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' });
}
function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' });
}
function emptyState(icon, text) {
  return `<div class="empty-state"><div class="icon">${icon}</div><p>${text}</p></div>`;
}

// ════════════════════════════════════════════════════════════════
//  النظام المحاسبي الرئيسي
//  مسارات Firebase: users/{ownerUid}/accounts  و  users/{ownerUid}/operations
// ════════════════════════════════════════════════════════════════

// ── State ───────────────────────────────────────────────────────
let activeSystem     = 'sales';   // 'sales' | 'accounting'
let allAccounts      = {};        // users/{uid}/accounts
let allOperations    = {};        // users/{uid}/operations
let accActiveListeners = [];      // لإلغاء الاستماع
let accFilter        = { accountId: '', from: null, to: null };
let accAccountFilter = '';
let editingAccountId   = null;
let editingOperationId = null;

// ── System Switcher ─────────────────────────────────────────────
window.switchSystem = function(system) {
  activeSystem = system;

  // تبديل أزرار السويتشر
  document.getElementById('sys-sales-btn').classList.toggle('active', system === 'sales');
  document.getElementById('sys-acc-btn').classList.toggle('active', system === 'accounting');

  // تبديل القوائم الجانبية
  document.getElementById('nav-sales').classList.toggle('hidden', system === 'accounting');
  document.getElementById('nav-accounting').classList.toggle('hidden', system === 'sales');

  if (system === 'sales') {
    // إظهار لوحة المبيعات
    stopAccListeners();
    switchTab('dashboard');
  } else {
    // إظهار لوحة المحاسبة
    startAccListeners();
    switchAccTab('acc-dashboard');
  }
};

// ── Accounting Navigation ───────────────────────────────────────
const ACC_TAB_TITLES = {
  'acc-dashboard':  'النظام المحاسبي — الرئيسية',
  'acc-accounts':   'الحسابات',
  'acc-operations': 'القيود والعمليات',
};

window.switchAccTab = function(name) {
  // إخفاء كل التابات (مبيعات + محاسبة)
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${name}`)?.classList.add('active');
  document.querySelector(`[data-acc-tab="${name}"]`)?.classList.add('active');
  document.getElementById('page-title').textContent = ACC_TAB_TITLES[name] || name;

  // إغلاق الـ sidebar في الموبايل
  document.getElementById('sidebar').classList.remove('open');
};

// ── Accounting Listeners ────────────────────────────────────────
function startAccListeners() {
  if (accActiveListeners.length) return; // مشغّل بالفعل
  addAccListener(`users/${ownerUid}/accounts`,   onAccounts);
  addAccListener(`users/${ownerUid}/operations`, onOperations);
}

function stopAccListeners() {
  accActiveListeners.forEach(u => u());
  accActiveListeners = [];
}

function addAccListener(path, cb) {
  const r = ref(db, path);
  const unsub = onValue(r, cb);
  accActiveListeners.push(unsub);
}

// ── Accounts Handler ────────────────────────────────────────────
function onAccounts(snap) {
  allAccounts = snap.val() || {};
  renderAccounts();
  refreshAccDashboard();
  refreshAccOperationsDropdowns();
}

function renderAccounts() {
  const el = document.getElementById('acc-accounts-list');
  if (!el) return;
  let entries = Object.entries(allAccounts);
  if (accAccountFilter) {
    const q = accAccountFilter.toLowerCase();
    entries = entries.filter(([,a]) =>
      a.name?.toLowerCase().includes(q) ||
      a.phone?.toLowerCase().includes(q) ||
      a.address?.toLowerCase().includes(q));
  }
  if (!entries.length) { el.innerHTML = emptyState('📋', 'لا توجد حسابات بعد'); return; }
  el.innerHTML = entries.map(([id, acc]) => {
    const balance = calcAccountBalance(id);
    const cls = balance >= 0 ? 'op-amount-pos' : 'op-amount-neg';
    return `
    <div class="card-item" onclick="openEditAccount('${id}')">
      <div class="card-icon">${accTypeIcon(acc.type)}</div>
      <div class="card-info">
        <div class="card-title">${acc.code ? escapeHtml(acc.code) + ' - ' : ''}${escapeHtml(acc.name)}</div>
        <div class="card-sub">
          ${accCategoryLabel(acc.category)} · ${accTypeLabel(acc.type)}
          ${acc.phone ? ' · ' + escapeHtml(acc.phone) : ''}
          ${acc.address ? ' · ' + escapeHtml(acc.address) : ''}
        </div>
      </div>
      <div class="acc-balance-tag">
        <div class="bal-val ${cls}">${balance.toFixed(2)} $</div>
        <div class="bal-lbl">الرصيد (USD)</div>
      </div>
    </div>`;
  }).join('');
}

window.filterAccounts = function() {
  accAccountFilter = document.getElementById('acc-accounts-search').value;
  renderAccounts();
};

function calcAccountBalance(accountId) {
  return Object.values(allOperations)
    .filter(op => op.accountId === accountId)
    .reduce((s, op) => s + (op.amountUSD || 0), 0);
}

function accTypeLabel(t) {
  const map = { cash:'نقدي', bank:'بنكي', usdt:'USDT', other:'أخرى' };
  return map[t] || 'أخرى';
}
function accTypeIcon(t) {
  const map = { cash:'💵', bank:'🏦', usdt:'🪙', other:'📋' };
  return map[t] || '📋';
}
function accCategoryLabel(c) {
  const map = { asset:'أصول', liability:'خصوم', equity:'حقوق ملكية', revenue:'إيرادات', expense:'مصروفات', other:'أخرى' };
  return map[c] || 'أخرى';
}

// ── Operations Handler ──────────────────────────────────────────
function onOperations(snap) {
  allOperations = snap.val() || {};
  renderAccDashboard();
  renderOperations();
  refreshAccDashboard();
}

function renderOperations() {
  const el = document.getElementById('acc-operations-list');
  if (!el) return;
  let entries = Object.entries(allOperations)
    .sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''));

  if (accFilter.accountId) {
    entries = entries.filter(([,op]) => op.accountId === accFilter.accountId);
  }
  if (accFilter.from) {
    entries = entries.filter(([,op]) => (op.date || '') >= accFilter.from);
  }
  if (accFilter.to) {
    entries = entries.filter(([,op]) => (op.date || '') <= accFilter.to);
  }

  if (!entries.length) { el.innerHTML = emptyState('📝', 'لا توجد قيود'); return; }
  el.innerHTML = entries.map(([id, op]) => {
    const amt     = op.amountUSD || op.amount || 0;
    const cls     = amt >= 0 ? 'op-amount-pos' : 'op-amount-neg';
    const sign    = amt >= 0 ? '+' : '';
    const accName = allAccounts[op.accountId]?.name || '—';
    const cur     = op.currency || 'USD';
    const orig    = op.amount   || 0;
    return `
    <div class="card-item" onclick="openEditOperation('${id}')">
      <div class="card-icon">${amt >= 0 ? '📥' : '📤'}</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(op.statement || '—')}</div>
        <div class="card-sub">
          ${escapeHtml(accName)} · ${op.date || '—'}
          ${cur !== 'USD' ? ` · ${orig.toFixed(2)} ${cur}` : ''}
        </div>
      </div>
      <div class="${cls}">${sign}${amt.toFixed(2)} $</div>
    </div>`;
  }).join('');
}

window.filterOperations = function() {
  accFilter.accountId = document.getElementById('op-filter-account').value;
  const fv = document.getElementById('op-filter-from').value;
  const tv = document.getElementById('op-filter-to').value;
  accFilter.from = fv || null;
  accFilter.to   = tv || null;
  renderOperations();
};

function refreshAccOperationsDropdowns() {
  // تحديث الفلتر العلوي في صفحة العمليات
  const filterSel = document.getElementById('op-filter-account');
  if (filterSel) {
    const current = filterSel.value;
    filterSel.innerHTML = `<option value="">كل الحسابات</option>` +
      Object.entries(allAccounts)
        .map(([id,a]) => `<option value="${id}" ${id===current?'selected':''}>${a.name}</option>`)
        .join('');
  }
  // تحديث سيليكت مودال القيد
  const opSel = document.getElementById('op-account-select');
  if (opSel) {
    opSel.innerHTML = Object.entries(allAccounts)
      .map(([id,a]) => `<option value="${id}">${a.name} (${accTypeLabel(a.type)})</option>`)
      .join('');
  }
}

// ── Accounting open/edit helpers ────────────────────────────────
window.openAddAccount = function() {
  editingAccountId = null;
  ['acc-name','acc-code','acc-phone','acc-address'].forEach(id =>
    { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('acc-category').value = 'other';
  document.getElementById('acc-type').value     = 'cash';
  document.getElementById('account-modal-title').textContent = 'إضافة حساب جديد';
  document.getElementById('account-save-btn').textContent    = 'حفظ الحساب';
  document.getElementById('account-del-btn').classList.add('hidden');
  openModal('account-modal');
};

window.openEditAccount = function(id) {
  editingAccountId = id;
  const a = allAccounts[id];
  document.getElementById('acc-name').value     = a.name     || '';
  document.getElementById('acc-code').value     = a.code     || '';
  document.getElementById('acc-category').value = a.category || 'other';
  document.getElementById('acc-type').value     = a.type     || 'cash';
  document.getElementById('acc-phone').value    = a.phone    || '';
  document.getElementById('acc-address').value  = a.address  || '';
  document.getElementById('account-modal-title').textContent = 'تعديل الحساب';
  document.getElementById('account-save-btn').textContent    = 'حفظ التعديلات';
  document.getElementById('account-del-btn').classList.remove('hidden');
  openModal('account-modal');
};

window.openAddOperation = function() {
  editingOperationId = null;
  ['op-statement','op-amount'].forEach(id =>
    { const el=document.getElementById(id); if(el) el.value=''; });
  buildOpCurrencyOptions('USD');
  document.getElementById('op-exchange-rate').value  = '1';
  document.getElementById('op-amount-usd').value     = '';
  document.getElementById('op-calc-hint').textContent = '';
  const today = new Date().toISOString().substring(0,10);
  document.getElementById('op-date').value = today;
  refreshAccOperationsDropdowns();
  document.getElementById('operation-modal-title').textContent = 'إضافة قيد محاسبي';
  document.getElementById('operation-save-btn').textContent    = 'حفظ القيد';
  document.getElementById('operation-del-btn').classList.add('hidden');
  openModal('operation-modal');
};

window.openEditOperation = function(id) {
  editingOperationId = id;
  const op = allOperations[id];
  refreshAccOperationsDropdowns();
  document.getElementById('op-account-select').value  = op.accountId      || '';
  document.getElementById('op-statement').value       = op.statement      || '';
  document.getElementById('op-amount').value          = op.amount         || '';
  buildOpCurrencyOptions(op.currency || 'USD');
  document.getElementById('op-exchange-rate').value   = op.exchangeRate   || 1;
  document.getElementById('op-amount-usd').value      = op.amountUSD      || '';
  document.getElementById('op-date').value            = op.date           || '';
  document.getElementById('op-calc-hint').textContent = '';
  document.getElementById('operation-modal-title').textContent = 'تعديل القيد';
  document.getElementById('operation-save-btn').textContent    = 'حفظ التعديلات';
  document.getElementById('operation-del-btn').classList.remove('hidden');
  openModal('operation-modal');
};

// ── Accounting Dashboard ────────────────────────────────────────
function refreshAccDashboard() {
  const allOps = Object.values(allOperations);
  const totalBalance = allOps.reduce((s, op) => s + (op.amountUSD || 0), 0);
  const totalIn      = allOps.filter(op => (op.amountUSD || 0) > 0)
                             .reduce((s, op) => s + op.amountUSD, 0);

  const balEl = document.getElementById('acc-kpi-balance');
  if (balEl) {
    balEl.textContent = `${totalBalance.toFixed(2)} $`;
    balEl.className = `kpi-val ${totalBalance >= 0 ? 'op-amount-pos' : 'op-amount-neg'}`;
  }
  const accEl = document.getElementById('acc-kpi-accounts');
  if (accEl) accEl.textContent = Object.keys(allAccounts).length;
  const opsEl = document.getElementById('acc-kpi-ops');
  if (opsEl) opsEl.textContent = allOps.length;
  const inEl = document.getElementById('acc-kpi-in');
  if (inEl) inEl.textContent = `${totalIn.toFixed(2)} $`;

  renderAccDashboard();
}

function renderAccDashboard() {
  const el = document.getElementById('acc-recent-ops');
  if (!el) return;
  const recent = Object.entries(allOperations)
    .sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''))
    .slice(0, 10);
  if (!recent.length) { el.innerHTML = emptyState('📝', 'لا توجد قيود بعد'); return; }
  el.innerHTML = recent.map(([id, op]) => {
    const amt     = op.amountUSD || op.amount || 0;
    const cls     = amt >= 0 ? 'op-amount-pos' : 'op-amount-neg';
    const sign    = amt >= 0 ? '+' : '';
    const accName = allAccounts[op.accountId]?.name || '—';
    return `
    <div class="card-item" onclick="openEditOperation('${id}')">
      <div class="card-icon">${amt >= 0 ? '📥' : '📤'}</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(op.statement || '—')}</div>
        <div class="card-sub">${escapeHtml(accName)} · ${op.date || '—'}</div>
      </div>
      <div class="${cls}">${sign}${amt.toFixed(2)} $</div>
    </div>`;
  }).join('');
}

// ── CRUD: Accounts ──────────────────────────────────────────────
window.saveAccount = async function() {
  const name = document.getElementById('acc-name').value.trim();
  if (!name) { showToast('أدخل اسم الحساب', 'error'); return; }
  const data = {
    name,
    code:     document.getElementById('acc-code').value.trim(),
    category: document.getElementById('acc-category').value,
    type:     document.getElementById('acc-type').value,
    phone:    document.getElementById('acc-phone').value.trim()   || '',
    address:  document.getElementById('acc-address').value.trim() || '',
  };
  try {
    if (editingAccountId) {
      // update() تدمج فقط الحقول المُمرَّرة ولا تمس allowClientLogin/clientEmail/clientUid
      await update(ref(db, `users/${ownerUid}/accounts/${editingAccountId}`), data);
      showToast('تم تحديث الحساب ✓', 'success');
    } else {
      // نفس تنسيق تطبيق الجوال: يجب أن يحمل السجل حقل id مطابقاً لمفتاح Firebase
      const newRef = push(ref(db, `users/${ownerUid}/accounts`));
      await set(newRef, {
        ...data,
        id: newRef.key,
        allowClientLogin: false,
        clientPhone: '',
        clientEmail: '',
        clientUid: '',
        createdAt: new Date().toISOString(),
      });
      showToast('تم إضافة الحساب ✓', 'success');
    }
    closeModal('account-modal');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
};

window.deleteAccountFromModal = async function() {
  if (!editingAccountId || !confirm('حذف هذا الحساب وكل قيوده؟')) return;
  const opsToDelete = Object.entries(allOperations)
    .filter(([,op]) => op.accountId === editingAccountId)
    .map(([opId]) => remove(ref(db, `users/${ownerUid}/operations/${opId}`)));
  await Promise.all([...opsToDelete, remove(ref(db, `users/${ownerUid}/accounts/${editingAccountId}`))]);
  closeModal('account-modal');
  showToast('تم الحذف', 'success');
};

window.deleteAccount = async function(id, e) {
  e?.stopPropagation();
  if (!confirm('حذف هذا الحساب وكل قيوده؟')) return;
  const opsToDelete = Object.entries(allOperations)
    .filter(([,op]) => op.accountId === id)
    .map(([opId]) => remove(ref(db, `users/${ownerUid}/operations/${opId}`)));
  await Promise.all([...opsToDelete, remove(ref(db, `users/${ownerUid}/accounts/${id}`))]);
  showToast('تم الحذف', 'success');
};

// ── CRUD: Operations ────────────────────────────────────────────
window.saveOperation = async function() {
  const accountId = document.getElementById('op-account-select').value;
  const statement = document.getElementById('op-statement').value.trim();
  const amount    = parseFloat(document.getElementById('op-amount').value);
  const cur       = document.getElementById('op-currency').value;
  const rate      = parseFloat(document.getElementById('op-exchange-rate').value) || 1;
  const date      = document.getElementById('op-date').value || new Date().toISOString().substring(0,10);

  if (!accountId) { showToast('اختر الحساب', 'error'); return; }
  if (!statement) { showToast('أدخل البيان', 'error'); return; }
  if (isNaN(amount)) { showToast('أدخل المبلغ', 'error'); return; }

  const amountUSD = cur === 'USD' ? amount : amount / rate;
  const data = {
    accountId, statement, amount, currency: cur,
    exchangeRate: rate,
    amountUSD:    parseFloat(amountUSD.toFixed(6)),
    date,
  };
  try {
    if (editingOperationId) {
      await update(ref(db, `users/${ownerUid}/operations/${editingOperationId}`), data);
      showToast('تم تحديث القيد ✓', 'success');
    } else {
      // نفس تنسيق تطبيق الجوال: يجب أن يحمل السجل حقل id مطابقاً لمفتاح Firebase
      const newRef = push(ref(db, `users/${ownerUid}/operations`));
      await set(newRef, { ...data, id: newRef.key, createdAt: new Date().toISOString() });
      showToast('تم إضافة القيد ✓', 'success');
    }
    closeModal('operation-modal');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
};

window.deleteOperationFromModal = async function() {
  if (!editingOperationId || !confirm('حذف هذا القيد؟')) return;
  await remove(ref(db, `users/${ownerUid}/operations/${editingOperationId}`));
  closeModal('operation-modal');
  showToast('تم الحذف', 'success');
};

window.deleteOperation = async function(id, e) {
  e?.stopPropagation();
  if (!confirm('حذف هذا القيد؟')) return;
  await remove(ref(db, `users/${ownerUid}/operations/${id}`));
  showToast('تم الحذف', 'success');
};

// ── Auto-calc amountUSD in modal ────────────────────────────────
function setupOpCalc() {
  ['op-amount','op-exchange-rate','op-currency'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', recalcOpUSD);
  });
}
function recalcOpUSD() {
  const amount   = parseFloat(document.getElementById('op-amount').value)         || 0;
  const rate     = parseFloat(document.getElementById('op-exchange-rate').value)  || 1;
  const currency = document.getElementById('op-currency').value;
  const usd      = currency === 'USD' ? amount : amount / rate;
  document.getElementById('op-amount-usd').value = usd ? usd.toFixed(4) : '';
  const hint = document.getElementById('op-calc-hint');
  if (amount && currency !== 'USD') {
    hint.textContent = `${amount} ${currency} ÷ ${rate} = ${usd.toFixed(2)} USD`;
  } else {
    hint.textContent = '';
  }
}

// ── Chart.js implementations ────────────────────────────────────
let chartInstances = {};

function createChartIfNeeded(canvasId, type, data, options = {}) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: type,
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { family: "'Cairo', sans-serif", size: 12 } } } },
      scales: {
        x: { ticks: { font: { family: "'Cairo', sans-serif" } } },
        y: { ticks: { font: { family: "'Cairo', sans-serif" } } }
      },
      ...options
    }
  });
}

function renderCharts() {
  // Payment methods chart (Pie)
  const payMap = {};
  Object.values(allInvoices).forEach(inv => {
    const pm = inv.paymentMethod || 'النقد';
    payMap[pm] = (payMap[pm] || 0) + (inv.total || 0);
  });
  if (Object.keys(payMap).length > 0) {
    createChartIfNeeded('paymentChartCanvas', 'doughnut', {
      labels: Object.keys(payMap),
      datasets: [{
        data: Object.values(payMap),
        backgroundColor: ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    });
  }

  // Top products chart (Horizontal Bar)
  const prodMap = {};
  Object.values(allInvoices).forEach(inv => {
    (inv.items || []).forEach(item => {
      const pname = allProducts[item.productId]?.name || 'غير معروف';
      prodMap[pname] = (prodMap[pname] || 0) + (item.quantity || 0);
    });
  });
  const top10Prods = Object.entries(prodMap)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((a,[k,v]) => ({...a, [k]:v}), {});
  if (Object.keys(top10Prods).length > 0) {
    createChartIfNeeded('productsChartCanvas', 'bar', {
      labels: Object.keys(top10Prods),
      datasets: [{
        label: 'الوحدات المباعة',
        data: Object.values(top10Prods),
        backgroundColor: '#8b5cf6',
        borderColor: '#6d28d9',
        borderWidth: 1
      }]
    }, { indexAxis: 'y' });
  }

  // Daily sales chart (Line)
  const dayMap = {};
  Object.values(allInvoices).forEach(inv => {
    const d = (inv.date || '').substring(0, 10);
    dayMap[d] = (dayMap[d] || 0) + (inv.total || 0);
  });
  const sortedDays = Object.entries(dayMap).sort((a,b) => a[0].localeCompare(b[0]));
  if (sortedDays.length > 0) {
    createChartIfNeeded('dailyChartCanvas', 'line', {
      labels: sortedDays.map(x => x[0]),
      datasets: [{
        label: 'المبيعات اليومية',
        data: sortedDays.map(x => x[1]),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    });
  }

  // Branch revenue chart (Bar)
  const branchMap = {};
  Object.values(allInvoices).forEach(inv => {
    const bname = allBranches[inv.branchId]?.name || 'غير معروف';
    branchMap[bname] = (branchMap[bname] || 0) + (inv.total || 0);
  });
  if (Object.keys(branchMap).length > 0) {
    createChartIfNeeded('branchChartCanvas', 'bar', {
      labels: Object.keys(branchMap),
      datasets: [{
        label: 'الإيرادات حسب الفرع',
        data: Object.values(branchMap),
        backgroundColor: '#10b981',
        borderColor: '#059669',
        borderWidth: 1
      }]
    });
  }
}

// ── PDF Export ──────────────────────────────────────────────────
window.exportReportPDF = async function() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 10;

    // Header
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(16);
    doc.text('التقارير والإحصائيات', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Company info
    doc.setFontSize(10);
    doc.setFont('Cairo', 'normal');
    doc.text(`الشركة: ${companyInfo.name || '—'}`, 10, yPos);
    yPos += 6;
    doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-SA')}`, 10, yPos);
    yPos += 10;

    // KPIs
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(11);
    doc.text('ملخص الأداء:', 10, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont('Cairo', 'normal');
    const repRev = document.getElementById('rep-revenue')?.textContent || '0';
    const repCount = document.getElementById('rep-count')?.textContent || '0';
    const repAvg = document.getElementById('rep-avg')?.textContent || '0';
    const repVat = document.getElementById('rep-vat')?.textContent || '0';

    doc.text(`إجمالي الإيرادات: ${repRev}`, 10, yPos);
    yPos += 6;
    doc.text(`عدد الفواتير: ${repCount}`, 10, yPos);
    yPos += 6;
    doc.text(`متوسط الفاتورة: ${repAvg}`, 10, yPos);
    yPos += 6;
    doc.text(`إجمالي الضريبة: ${repVat}`, 10, yPos);
    yPos += 12;

    // Add charts as images
    const chartCanvases = [
      { id: 'paymentChartCanvas', title: 'توزيع طرق الدفع' },
      { id: 'productsChartCanvas', title: 'أكثر المنتجات مبيعاً' },
      { id: 'dailyChartCanvas', title: 'المبيعات اليومية' },
      { id: 'branchChartCanvas', title: 'الإيرادات حسب الفرع' }
    ];

    for (const chart of chartCanvases) {
      const canvas = document.getElementById(chart.id);
      if (canvas && yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 10;
      }
      if (canvas) {
        const imgData = canvas.toDataURL('image/png');
        doc.text(chart.title, 10, yPos);
        yPos += 6;
        doc.addImage(imgData, 'PNG', 10, yPos, pageWidth - 20, 50);
        yPos += 60;
      }
    }

    doc.save(`تقارير-${new Date().toISOString().substring(0,10)}.pdf`);
    showToast('تم تصدير التقارير بنجاح', 'success');
  } catch(e) {
    showToast('خطأ في التصدير: ' + e.message, 'error');
  }
};

// ── CSV Export ──────────────────────────────────────────────────
window.exportReportCSV = function() {
  try {
    const from = document.getElementById('rep-from')?.value || '';
    const to = document.getElementById('rep-to')?.value || '';

    const headers = ['التاريخ', 'رقم الفاتورة', 'المبلغ', 'الضريبة', 'الإجمالي', 'طريقة الدفع', 'الفرع'];
    const rows = [];

    Object.values(allInvoices)
      .filter(inv => {
        const d = (inv.date || '').substring(0, 10);
        return (!from || d >= from) && (!to || d <= to);
      })
      .forEach(inv => {
        rows.push([
          inv.date || '',
          inv.id || '',
          inv.subtotal || 0,
          inv.tax || 0,
          inv.total || 0,
          inv.paymentMethod || '',
          allBranches[inv.branchId]?.name || ''
        ]);
      });

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقارير-${new Date().toISOString().substring(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير البيانات بنجاح', 'success');
  } catch(e) {
    showToast('خطأ: ' + e.message, 'error');
  }
};

window.exportInvoicesCSV = function() {
  try {
    const from = document.getElementById('inv-from')?.value || '';
    const to = document.getElementById('inv-to')?.value || '';

    const headers = ['التاريخ', 'رقم الفاتورة', 'العميل', 'المبلغ', 'الضريبة', 'الإجمالي', 'طريقة الدفع'];
    const rows = [];

    Object.values(allInvoices)
      .filter(inv => {
        const d = (inv.date || '').substring(0, 10);
        return (!from || d >= from) && (!to || d <= to);
      })
      .forEach(inv => {
        rows.push([
          inv.date || '',
          inv.id || '',
          inv.customerName || '',
          inv.subtotal || 0,
          inv.tax || 0,
          inv.total || 0,
          inv.paymentMethod || ''
        ]);
      });

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `الفواتير-${new Date().toISOString().substring(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير الفواتير بنجاح', 'success');
  } catch(e) {
    showToast('خطأ: ' + e.message, 'error');
  }
};

// ── Search & Filter Functions ──────────────────────────────────
let productFilterText = '';
let productCategoryFilter = '';

window.filterProducts = function() {
  productFilterText = (document.getElementById('product-search')?.value || '').toLowerCase();
  productCategoryFilter = document.getElementById('product-category-filter')?.value || '';
  renderProducts();
};

window.filterEmployees = function() {
  const searchText = (document.getElementById('employee-search')?.value || '').toLowerCase();
  const el = document.getElementById('employees-list');
  if (!el) return;

  const filtered = Object.entries(allEmployees)
    .filter(([,emp]) => {
      const name = (emp.name || '').toLowerCase();
      const phone = (emp.phone || '').toLowerCase();
      const empNo = (emp.employeeNumber || '').toLowerCase();
      return name.includes(searchText) || phone.includes(searchText) || empNo.includes(searchText);
    });

  if (!filtered.length) {
    el.innerHTML = emptyState('👤', 'لا توجد نتائج بحث');
    return;
  }

  el.innerHTML = filtered.map(([id, emp]) => `
    <div class="card-item" onclick="editEmployee('${id}')">
      <div class="card-icon">👤</div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(emp.name || '—')}</div>
        <div class="card-sub">${emp.employeeNumber || '—'} · ${emp.phone || '—'}</div>
      </div>
      <div class="card-badge">${emp.position || '—'}</div>
    </div>`).join('');
};

window.doGlobalSearch = function() {
  const searchText = (document.getElementById('global-search')?.value || '').toLowerCase();
  if (!searchText) return;

  // Search in invoices
  const invoiceMatches = Object.entries(allInvoices)
    .filter(([,inv]) => {
      const num = (inv.number || '').toLowerCase();
      const cust = (inv.customerName || '').toLowerCase();
      return num.includes(searchText) || cust.includes(searchText);
    })
    .slice(0, 5);

  // Search in products
  const productMatches = Object.entries(allProducts)
    .filter(([,prod]) => {
      const name = (prod.name || '').toLowerCase();
      return name.includes(searchText);
    })
    .slice(0, 5);

  // Search in employees
  const employeeMatches = Object.entries(allEmployees)
    .filter(([,emp]) => {
      const name = (emp.name || '').toLowerCase();
      return name.includes(searchText);
    })
    .slice(0, 5);

  // If matches found, navigate to relevant tab and highlight results
  if (invoiceMatches.length > 0) {
    switchTab('invoices');
    showToast(`وجدنا ${invoiceMatches.length} فاتورة`, 'info');
  } else if (productMatches.length > 0) {
    switchTab('products');
    showToast(`وجدنا ${productMatches.length} منتج`, 'info');
  } else if (employeeMatches.length > 0) {
    switchTab('employees');
    showToast(`وجدنا ${employeeMatches.length} موظف`, 'info');
  } else {
    showToast('لم نجد نتائج', 'warning');
  }
};

// Show/hide global search when changing tabs
function updateGlobalSearch() {
  const searchInput = document.getElementById('global-search');
  if (!searchInput) return;

  const currentTab = document.querySelector('.tab-content.active');
  const currentTabId = currentTab?.id || '';

  // Show search for searchable tabs
  const searchableTabs = ['tab-invoices', 'tab-products', 'tab-employees', 'tab-loyalty'];
  searchInput.style.display = searchableTabs.includes(currentTabId) ? 'block' : 'none';
}

// ── Init Dates ──────────────────────────────────────────────────
(function initDates() {
  const today = new Date().toISOString().substring(0,10);
  const month = new Date(Date.now()-30*864e5).toISOString().substring(0,10);
  ['inv-from'].forEach(id => { const el=document.getElementById(id); if(el) el.value=month; });
  ['inv-to'].forEach(id => { const el=document.getElementById(id); if(el) el.value=today; });

  // إعداد منتقي العملة الأولي
  const c = CURRENCIES.find(x => x.code === currency);
  if (c) {
    document.getElementById('cur-symbol').textContent = c.sym;
    document.getElementById('cur-name').textContent   = `${c.name} (${c.code})`;
  }

  // إعداد حساب تلقائي للقيد المحاسبي
  setupOpCalc();

  // تاريخ افتراضي لفلتر العمليات (يعيد استخدام today / month المُعلنتين أعلاه)
  ['op-filter-from'].forEach(id => { const el=document.getElementById(id); if(el) el.value=month; });
  ['op-filter-to','op-date'].forEach(id => { const el=document.getElementById(id); if(el) el.value=today; });
})();
