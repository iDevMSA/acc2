// ============================================================
// lib/acc_sys/client_portal.dart — بوابة العميل
// تصميم مطابق للشاشة الرئيسية
// ============================================================

import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../welcome.dart';

// ══════════════════════════════════════════════════════════
//  بوابة العميل — الشاشة الرئيسية
// ══════════════════════════════════════════════════════════
class ClientPortalScreen extends StatefulWidget {
  final String ownerUid;
  final String accountId;
  const ClientPortalScreen({super.key, required this.ownerUid, required this.accountId});
  @override State<ClientPortalScreen> createState() => _ClientPortalState();
}

class _ClientPortalState extends State<ClientPortalScreen> {
  String   _accountName   = '';
  String   _currency      = 'USD';
  String   _ownerCompany  = '';
  String   _ownerPhone    = '';
  String   _ownerAddress  = '';
  List<_Op> _ops = [];
  bool     _loading = true;

  DateTime _from = DateTime(DateTime.now().year, 1, 1);
  DateTime _to   = DateTime.now();

  StreamSubscription? _accSub, _opsSub;

  @override
  void initState() {
    super.initState();
    _loadCompanyInfo();
    _watchAccount();
    _watchOps();
  }

  @override
  void dispose() {
    _accSub?.cancel(); _opsSub?.cancel();
    super.dispose();
  }

  // ── تحميل معلومات الشركة ─────────────────────────────
  Future<void> _loadCompanyInfo() async {
    try {
      final snap = await FirebaseDatabase.instance
          .ref('users/${widget.ownerUid}/companyInfo').get();
      if (snap.exists && snap.value != null) {
        final m = Map<String, dynamic>.from(snap.value as Map);
        if (mounted) setState(() {
          _ownerCompany  = (m['name']    as String?) ?? '';
          _ownerPhone    = (m['phone']   as String?) ?? '';
          _ownerAddress  = (m['address'] as String?) ?? '';
        });
      }
    } catch (_) {}
  }

  // ── مراقبة بيانات الحساب ─────────────────────────────
  void _watchAccount() {
    _accSub = FirebaseDatabase.instance
        .ref('users/${widget.ownerUid}/accounts/${widget.accountId}')
        .onValue
        .listen((event) {
      if (!event.snapshot.exists || event.snapshot.value == null) return;
      final m = Map<String, dynamic>.from(event.snapshot.value as Map);
      if (mounted) setState(() {
        _accountName = (m['name'] as String?) ?? '';
        _currency    = (m['currency'] as String?) ?? 'USD';
      });
    });
  }

  // ── مراقبة العمليات ───────────────────────────────────
  // يقرأ من users/{ownerUid}/clientOps/{accountId} — عقدة مُفرَّغة تحتوي
  // فقط عمليات هذا الحساب بالذات (وليس عمليات كل عملاء الشركة)،
  // مطابقةً لقواعد الأمان التي تمنح العميل صلاحية القراءة على مستوى
  // هذا المسار المحدد فقط.
  void _watchOps() {
    _opsSub = FirebaseDatabase.instance
        .ref('users/${widget.ownerUid}/clientOps/${widget.accountId}')
        .onValue
        .listen((event) {
      if (!event.snapshot.exists || event.snapshot.value == null) {
        if (mounted) setState(() { _ops = []; _loading = false; });
        return;
      }
      final m = Map<String, dynamic>.from(event.snapshot.value as Map);
      final all = m.entries.map((e) {
        final j = Map<String, dynamic>.from(e.value as Map);
        return _Op(
          id:        (j['id']        as String?) ?? e.key,
          amount:    (j['amount']    as num?)?.toDouble() ?? 0,
          statement: (j['statement'] as String?) ?? '',
          date:      DateTime.tryParse((j['date'] as String?) ?? '') ?? DateTime.now(),
          currency:  (j['currency']  as String?) ?? 'USD',
        );
      }).toList()
        ..sort((a, b) => b.date.compareTo(a.date));

      if (mounted) setState(() { _ops = all; _loading = false; });
    });
  }

  // ── فلترة حسب التاريخ ────────────────────────────────
  List<_Op> get _filtered => _ops.where((o) =>
    !o.date.isBefore(_from) &&
    !o.date.isAfter(_to.add(const Duration(days: 1)))).toList();

  // ── الرصيد الكلي (بدون فلتر) ─────────────────────────
  double get _balance => _ops.fold(0.0, (s, o) => s + o.amount);

  // ── رمز العملة ───────────────────────────────────────
  String get _sym => switch (_currency) {
    'USD' => r'$', 'EUR' => '€', 'SAR' => 'ر.س',
    'AED' => 'د.إ', 'KWD' => 'د.ك', _ => _currency,
  };

  // ── تصدير PDF ─────────────────────────────────────────
  // الخط مُضمَّن محلياً (assets/fonts) بدل جلبه من الشبكة عبر
  // PdfGoogleFonts — يعمل بدون إنترنت ولا يعتمد على سرعة الاتصال.
  Future<void> _exportPdf() async {
    final fontData     = await rootBundle.load('assets/fonts/Cairo-Regular.ttf');
    final boldFontData = await rootBundle.load('assets/fonts/Cairo-Bold.ttf');
    final font     = pw.Font.ttf(fontData);
    final fontBold = pw.Font.ttf(boldFontData);
    final ops = _filtered;
    double running = 0;
    final fmt = DateFormat('yyyy/MM/dd');

    final doc = pw.Document();
    doc.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      textDirection: pw.TextDirection.rtl,
      theme: pw.ThemeData.withFont(base: font, bold: fontBold),
      header: (ctx) => pw.Container(
        padding: const pw.EdgeInsets.fromLTRB(0, 0, 0, 10),
        decoration: const pw.BoxDecoration(
            border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300))),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text(_ownerCompany.isNotEmpty ? _ownerCompany : 'منصتي المحاسبية',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14, color: PdfColors.indigo700)),
            if (_ownerPhone.isNotEmpty)
              pw.Text(_ownerPhone, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
            if (_ownerAddress.isNotEmpty)
              pw.Text(_ownerAddress, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
          ])),
          pw.SizedBox(width: 20),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: pw.BoxDecoration(color: PdfColors.indigo700, borderRadius: pw.BorderRadius.circular(6)),
              child: pw.Text('كشف حساب',
                  style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 13)),
            ),
            pw.SizedBox(height: 4),
            pw.Text(_accountName, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
            pw.Text('الفترة: ${fmt.format(_from)} — ${fmt.format(_to)}',
                style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey400)),
          ]),
        ]),
      ),
      footer: (ctx) => pw.Row(children: [
        pw.Text('صفحة ${ctx.pageNumber} من ${ctx.pagesCount}',
            style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey)),
        pw.Spacer(),
        pw.Text('تاريخ الطباعة: ${fmt.format(DateTime.now())}',
            style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey)),
      ]),
      build: (ctx) => [
        // ملخص الرصيد
        pw.Container(
          padding: const pw.EdgeInsets.all(12),
          margin: const pw.EdgeInsets.only(bottom: 16),
          decoration: pw.BoxDecoration(
            color: PdfColors.indigo50,
            border: pw.Border.all(color: PdfColors.indigo200),
            borderRadius: pw.BorderRadius.circular(8),
          ),
          child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
            pw.Text('${_balance.toStringAsFixed(2)} $_sym',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16,
                    color: _balance >= 0 ? PdfColors.indigo700 : PdfColors.red700)),
            pw.Text('الرصيد الإجمالي',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.indigo700)),
          ]),
        ),
        // جدول الحركات
        pw.TableHelper.fromTextArray(
          headers: ['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'],
          data: ops.map((o) {
            running += o.amount;
            return [
              fmt.format(o.date), o.statement,
              o.amount > 0 ? o.amount.toStringAsFixed(2) : '-',
              o.amount < 0 ? o.amount.abs().toStringAsFixed(2) : '-',
              running.toStringAsFixed(2),
            ];
          }).toList(),
          headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.white, fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: PdfColors.indigo700),
          cellStyle: const pw.TextStyle(fontSize: 9),
          cellAlignment: pw.Alignment.center,
          oddRowDecoration: const pw.BoxDecoration(color: PdfColors.grey50),
          border: pw.TableBorder.all(color: PdfColors.grey200, width: 0.5),
        ),
      ],
    ));
    await Printing.layoutPdf(onLayout: (_) => doc.save());
  }

  // ── اختيار تاريخ ─────────────────────────────────────
  Future<void> _pickDate(bool isFrom) async {
    final d = await showDatePicker(
      context: context, initialDate: isFrom ? _from : _to,
      firstDate: DateTime(2020), lastDate: DateTime.now(),
    );
    if (d != null && mounted) setState(() { if (isFrom) _from = d; else _to = d; });
  }

  @override
  Widget build(BuildContext context) {
    final ops = _filtered;
    final h = MediaQuery.of(context).size.height;

    return Scaffold(
      body: Stack(children: [

        // ── طبقة ١: الخلفية المتدرجة (الجزء العلوي) ──────
        Positioned(
          top: 0, left: 0, right: 0,
          height: h * 0.55,
          child: const DecoratedBox(decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft, end: Alignment.bottomRight,
              colors: [Color(0xFF021B79), Color(0xFF0575E6)],
            ),
          )),
        ),

        // ── طبقة ٢: خلفية بيضاء دائمة من منتصف الشاشة ──
        // تضمن أن overscroll من الأسفل يكون دائماً أبيض
        Positioned(
          top: h * 0.44,
          left: 0, right: 0, bottom: 0,
          child: const ColoredBox(color: Colors.white),
        ),

        // ── طبقة ٣: المحتوى القابل للتمرير ───────────────
        RefreshIndicator(
          color: Colors.white, backgroundColor: const Color(0xFF021B79),
          onRefresh: () async {
            setState(() => _loading = true);
            await Future.delayed(const Duration(milliseconds: 300));
            if (mounted) setState(() => _loading = false);
          },
          child: CustomScrollView(slivers: [

            // ── SliverAppBar ──────────────────────────
            SliverAppBar(
              expandedHeight: h * 0.36,
              pinned: true,
              backgroundColor: Colors.transparent,
              elevation: 0,
              leading: const SizedBox.shrink(),
              actions: [
                IconButton(
                  icon: const Icon(Icons.picture_as_pdf_outlined, color: Colors.white),
                  tooltip: 'تصدير كشف حساب PDF',
                  onPressed: _exportPdf,
                ),
                IconButton(
                  icon: const Icon(Icons.logout_rounded, color: Colors.white70),
                  tooltip: 'تسجيل الخروج',
                  onPressed: () async {
                    await FirebaseAuth.instance.signOut();
                    if (context.mounted) {
                      Navigator.pushAndRemoveUntil(context,
                          MaterialPageRoute(builder: (_) => const WelcomeScreen()),
                          (_) => false);
                    }
                  },
                ),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      // اسم الشركة صغير في الأعلى
                      if (_ownerCompany.isNotEmpty)
                        Text(_ownerCompany,
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.55),
                                fontSize: 11)),
                      const SizedBox(height: 6),
                      // ترحيب
                      Text('مرحباً،',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 14)),
                      const SizedBox(height: 2),
                      Text(_accountName.isNotEmpty ? _accountName : '...',
                          style: const TextStyle(color: Colors.white, fontSize: 22,
                              fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 20),

                      // بطاقة الرصيد الرئيسية
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                        ),
                        child: Column(children: [
                          Text('الرصيد الإجمالي', style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.75), fontSize: 12)),
                          const SizedBox(height: 8),
                          _loading
                            ? const SizedBox(height: 36, width: 36,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : TweenAnimationBuilder<double>(
                                tween: Tween(begin: 0, end: _balance),
                                duration: const Duration(milliseconds: 800),
                                curve: Curves.easeOutCubic,
                                builder: (_, val, __) => Text(
                                  '${val >= 0 ? '' : '-'}${val.abs().toStringAsFixed(2)} $_sym',
                                  style: TextStyle(
                                    color: _balance >= 0
                                        ? const Color(0xFF69F0AE)
                                        : const Color(0xFFFF5252),
                                    fontSize: 32, fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                          const SizedBox(height: 4),
                          Text(_currency, style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.55), fontSize: 11)),
                        ]),
                      ),
                    ]),
                  ),
                ),
              ),
            ),

            // ── البطاقة البيضاء (الحركات) — تمتد للأسفل ─
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.only(top: 16),
                // لا حد سفلي — تمتد مع ListView
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                child: Column(children: [
                  // مقبض السحب
                  Container(
                    margin: const EdgeInsets.symmetric(vertical: 12),
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                  ),
                  // فلتر التاريخ
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: Row(children: [
                      // زر PDF
                      _ActionBtn(icon: Icons.picture_as_pdf, color: Colors.red.shade600,
                          label: 'PDF', onTap: _exportPdf),
                      const Spacer(),
                      _DateChip(label: 'إلى', date: _to, onTap: () => _pickDate(false)),
                      const SizedBox(width: 8),
                      _DateChip(label: 'من', date: _from, onTap: () => _pickDate(true)),
                    ]),
                  ),
                  // ملخص الفترة
                  if (ops.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Row(children: [
                        Expanded(child: _MiniCard(
                          label: 'إجمالي الدائن',
                          value: ops.where((o) => o.amount < 0).fold(0.0, (s, o) => s + o.amount.abs()),
                          color: Colors.green.shade600, sym: _sym)),
                        const SizedBox(width: 8),
                        Expanded(child: _MiniCard(
                          label: 'إجمالي المدين',
                          value: ops.where((o) => o.amount > 0).fold(0.0, (s, o) => s + o.amount),
                          color: Colors.orange.shade600, sym: _sym)),
                      ]),
                    ),
                  // عنوان قائمة الحركات
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Row(children: [
                      Text('${ops.length} حركة', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                      const Spacer(),
                      const Text('آخر الحركات', style: TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF021B79))),
                    ]),
                  ),
                ]),
              ),
            ),

            // ── قائمة الحركات ─────────────────────────
            if (_loading)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator(color: Color(0xFF021B79))),
                ),
              )
            else if (ops.isEmpty)
              SliverToBoxAdapter(child: _Empty())
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    if (i == ops.length) return const SizedBox(height: 40);
                    return _OpCard(op: ops[i], sym: _sym);
                  },
                  childCount: ops.length + 1,
                ),
              ),

            // ── آخر sliver: أبيض يملأ المساحة المتبقية ─
            // hasScrollBody: false + fillOverscroll: true
            // يضمن أبيض عند over-scroll من الأسفل
            const SliverFillRemaining(
              hasScrollBody: false,
              fillOverscroll: true,
              child: ColoredBox(color: Colors.white),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ── بطاقة عملية ────────────────────────────────────────
class _OpCard extends StatelessWidget {
  final _Op op; final String sym;
  const _OpCard({required this.op, required this.sym});

  @override
  Widget build(BuildContext context) {
    final isDebit = op.amount > 0;
    final color   = isDebit ? Colors.orange.shade600 : Colors.green.shade600;
    final fmt     = DateFormat('dd/MM/yyyy');

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          // المبلغ والرصيد
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${isDebit ? '+' : '-'}${op.amount.abs().toStringAsFixed(2)} $sym',
                style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 15)),
          ]),
          const Spacer(),
          // البيان والتاريخ
          Expanded(flex: 2, child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(op.statement.isEmpty ? 'عملية محاسبية' : op.statement,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.right),
            const SizedBox(height: 3),
            Text(fmt.format(op.date),
                style: const TextStyle(color: Colors.grey, fontSize: 11)),
          ])),
          const SizedBox(width: 12),
          // أيقونة
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12)),
            child: Icon(isDebit ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                color: color, size: 20),
          ),
        ]),
      ),
    );
  }
}

// ── بطاقة ملخص صغيرة ───────────────────────────────────
class _MiniCard extends StatelessWidget {
  final String label, sym; final double value; final Color color;
  const _MiniCard({required this.label, required this.value, required this.color, required this.sym});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: Colors.white, borderRadius: BorderRadius.circular(12),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 6)],
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
      Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
      const SizedBox(height: 4),
      Text('${value.toStringAsFixed(2)} $sym',
          style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 13)),
    ]),
  );
}

// ── زر إجراء ────────────────────────────────────────────
class _ActionBtn extends StatelessWidget {
  final IconData icon; final Color color; final String label; final VoidCallback onTap;
  const _ActionBtn({required this.icon, required this.color, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap, borderRadius: BorderRadius.circular(10),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.3))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
      ]),
    ),
  );
}

// ── شريحة التاريخ ───────────────────────────────────────
class _DateChip extends StatelessWidget {
  final String label; final DateTime date; final VoidCallback onTap;
  const _DateChip({required this.label, required this.date, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap, borderRadius: BorderRadius.circular(10),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade200)),
      child: Row(children: [
        const Icon(Icons.calendar_today, size: 12, color: Color(0xFF021B79)),
        const SizedBox(width: 5),
        Text('$label: ${DateFormat('dd/MM').format(date)}',
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
      ]),
    ),
  );
}

// ── حالة فارغة ──────────────────────────────────────────
class _Empty extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.receipt_long_outlined, size: 72, color: Colors.grey.shade300),
      const SizedBox(height: 16),
      Text('لا توجد حركات في هذه الفترة',
          style: TextStyle(color: Colors.grey.shade400, fontSize: 15)),
      const SizedBox(height: 8),
      Text('غيّر نطاق التاريخ للبحث',
          style: TextStyle(color: Colors.grey.shade300, fontSize: 12)),
    ]),
  );
}

// ── نموذج العملية ───────────────────────────────────────
class _Op {
  final String id, statement, currency;
  final double amount;
  final DateTime date;
  const _Op({required this.id, required this.amount, required this.statement,
      required this.date, required this.currency});
}
