// lib/acc_sys/acc_reports.dart
// التقارير المالية — خط Cairo للـ PDF

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

// ══════════════════════════════════════════════════════════
//  نماذج مساعدة
// ══════════════════════════════════════════════════════════
class ReportAccount {
  final String id, name, code, category;
  final double balance;
  const ReportAccount({required this.id, required this.name, required this.code,
      required this.category, required this.balance});
  String get categoryLabel => switch (category) {
    'asset'     => 'أصول',
    'liability' => 'خصوم',
    'equity'    => 'حقوق ملكية',
    'revenue'   => 'إيرادات',
    'expense'   => 'مصروفات',
    _           => 'أخرى',
  };
}

class ReportOperation {
  final String id, accountId, statement, currency;
  final double amount, amountUSD;
  final DateTime date;
  const ReportOperation({required this.id, required this.accountId,
      required this.amount, required this.statement, required this.date,
      required this.currency, required this.amountUSD});
}

class ReportCompanyInfo {
  final String name, phone, address, email;
  const ReportCompanyInfo({this.name = '', this.phone = '', this.address = '', this.email = ''});
}

// ── تحويل dynamic إلى نماذج مساعدة ────────────────────────
List<ReportAccount> toReportAccounts(List<dynamic> accounts, List<dynamic> ops) =>
    accounts.map((a) {
      final acOps = ops.where((o) => (o.accountId as String) == (a.id as String));
      final bal = acOps.fold(0.0, (s, o) => s + (o.amount as num).toDouble());
      return ReportAccount(
        id: a.id as String, name: a.name as String,
        code: (a.code as String?) ?? '',
        category: (a.category as String?) ?? 'other',
        balance: bal,
      );
    }).toList();

List<ReportOperation> toReportOps(List<dynamic> ops) => ops.map((o) => ReportOperation(
  id: o.id as String, accountId: o.accountId as String,
  amount: (o.amount as num).toDouble(),
  statement: (o.statement as String?) ?? '',
  date: o.date as DateTime,
  currency: (o.currency as String?) ?? 'USD',
  amountUSD: (o.amountUSD as num?)?.toDouble() ?? (o.amount as num).toDouble(),
)).toList();

// ══════════════════════════════════════════════════════════
//  شاشة اختيار التقرير
// ══════════════════════════════════════════════════════════
class AccReportsScreen extends StatelessWidget {
  final String ownerUid;
  final List<dynamic> accounts, operations;
  final dynamic company;

  const AccReportsScreen({
    super.key, required this.ownerUid,
    required this.accounts, required this.operations,
    this.company,
  });

  ReportCompanyInfo get _co => ReportCompanyInfo(
    name:    (company?.name    as String?) ?? '',
    phone:   (company?.phone   as String?) ?? '',
    address: (company?.address as String?) ?? '',
    email:   (company?.email   as String?) ?? '',
  );

  @override
  Widget build(BuildContext context) {
    final ra = toReportAccounts(accounts, operations);
    final ro = toReportOps(operations);
    final co = _co;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: AppBar(
        title: const Text('التقارير المالية',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF021B79),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        _ReportTile(icon: Icons.balance,        color: const Color(0xFF021B79),
          title: 'ميزان المراجعة',     subtitle: 'مجموع مدين ودائن لكل حساب',
          onTap: () => _push(context, TrialBalanceScreen(accounts: ra, operations: ro, company: co))),
        _ReportTile(icon: Icons.trending_up,    color: Colors.green.shade700,
          title: 'قائمة الدخل',        subtitle: 'الإيرادات والمصروفات وصافي الربح',
          onTap: () => _push(context, IncomeStatementScreen(accounts: ra, operations: ro, company: co))),
        _ReportTile(icon: Icons.account_balance, color: Colors.indigo,
          title: 'الميزانية العمومية', subtitle: 'الأصول والخصوم وحقوق الملكية',
          onTap: () => _push(context, BalanceSheetScreen(accounts: ra, company: co))),
        _ReportTile(icon: Icons.receipt_long,   color: Colors.orange.shade700,
          title: 'كشف حساب',           subtitle: 'حركة حساب محدد مع الرصيد التراكمي',
          onTap: () => _push(context, AccountStatementScreen(accounts: ra, operations: ro, company: co))),
        _ReportTile(icon: Icons.menu_book,      color: Colors.purple.shade700,
          title: 'دفتر الأستاذ',       subtitle: 'جميع الحركات مرتبة حسب الحسابات',
          onTap: () => _push(context, GeneralLedgerScreen(accounts: ra, operations: ro, company: co))),
        _ReportTile(icon: Icons.people_outline,  color: Colors.red.shade700,
          title: 'تقرير المدينون',     subtitle: 'العملاء الذين لديهم أرصدة مدينة',
          onTap: () => _push(context, DebtorsScreen(accounts: ra, operations: ro, company: co))),
        _ReportTile(icon: Icons.business_center, color: Colors.teal.shade700,
          title: 'تقرير الدائنون',     subtitle: 'الموردون والأطراف الدائنة',
          onTap: () => _push(context, CreditorsScreen(accounts: ra, operations: ro, company: co))),
      ]),
    );
  }

  void _push(BuildContext ctx, Widget screen) =>
      Navigator.push(ctx, MaterialPageRoute(builder: (_) => screen));
}

class _ReportTile extends StatelessWidget {
  final IconData icon; final Color color;
  final String title, subtitle; final VoidCallback onTap;
  const _ReportTile({required this.icon, required this.color,
      required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    elevation: 1,
    child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(16),
      child: Padding(padding: const EdgeInsets.all(16),
        child: Row(children: [
          const Icon(Icons.chevron_left, color: Colors.grey, size: 18),
          const Spacer(),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 3),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ]),
          const SizedBox(width: 12),
          Container(padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color, size: 24)),
        ]),
      ),
    ),
  );
}

// ══════════════════════════════════════════════════════════
//  مساعد توليد PDF مع خط Cairo
// ══════════════════════════════════════════════════════════
Future<pw.Document> _buildPdf(
    String title, ReportCompanyInfo co, String subtitle,
    List<List<String>> rows, List<String> headers,
    {PdfColor headerColor = PdfColors.indigo700,
     String? summaryLabel, String? summaryValue,
     PdfColor? summaryColor}) async {

  // الخط مُضمَّن محلياً (assets/fonts) بدل جلبه من الشبكة عبر
  // PdfGoogleFonts — يعمل بدون إنترنت ولا يعتمد على سرعة الاتصال.
  final fontData     = await rootBundle.load('assets/fonts/Cairo-Regular.ttf');
  final boldFontData = await rootBundle.load('assets/fonts/Cairo-Bold.ttf');
  final font     = pw.Font.ttf(fontData);
  final fontBold = pw.Font.ttf(boldFontData);
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
          pw.Text(co.name.isNotEmpty ? co.name : 'منصتي المحاسبية',
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
          if (co.phone.isNotEmpty)
            pw.Text(co.phone, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
          if (co.address.isNotEmpty)
            pw.Text(co.address, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
        ])),
        pw.SizedBox(width: 20),
        pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: pw.BoxDecoration(color: headerColor, borderRadius: pw.BorderRadius.circular(6)),
            child: pw.Text(title, style: pw.TextStyle(
                color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 13)),
          ),
          pw.SizedBox(height: 4),
          pw.Text(subtitle, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
          pw.Text('تاريخ الطباعة: ${fmt.format(DateTime.now())}',
              style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey400)),
        ]),
      ]),
    ),
    footer: (ctx) => pw.Row(children: [
      pw.Text('صفحة ${ctx.pageNumber} من ${ctx.pagesCount}',
          style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey)),
      pw.Spacer(),
      pw.Text('منصتي المحاسبية', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey)),
    ]),
    build: (ctx) => [
      pw.SizedBox(height: 6),
      pw.TableHelper.fromTextArray(
        headers: headers,
        data: rows,
        headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.white, fontSize: 10),
        headerDecoration: pw.BoxDecoration(color: headerColor),
        cellStyle: const pw.TextStyle(fontSize: 9),
        cellAlignment: pw.Alignment.center,
        cellAlignments: {headers.length - 1: pw.Alignment.centerRight},
        oddRowDecoration: const pw.BoxDecoration(color: PdfColors.grey50),
        border: pw.TableBorder.all(color: PdfColors.grey200, width: 0.5),
      ),
      if (summaryLabel != null) ...[
        pw.SizedBox(height: 12),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: pw.BoxDecoration(
            color: PdfColors.grey100,
            border: pw.Border.all(color: summaryColor ?? PdfColors.indigo700, width: 0.5),
            borderRadius: pw.BorderRadius.circular(6),
          ),
          child: pw.Row(children: [
            pw.Text(summaryValue ?? '', style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold, color: summaryColor ?? PdfColors.indigo700)),
            pw.Spacer(),
            pw.Text(summaryLabel, style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold, color: summaryColor ?? PdfColors.indigo700)),
          ]),
        ),
      ],
    ],
  ));
  return doc;
}

// ══════════════════════════════════════════════════════════
//  ميزان المراجعة
// ══════════════════════════════════════════════════════════
class TrialBalanceScreen extends StatelessWidget {
  final List<ReportAccount> accounts;
  final List<ReportOperation> operations;
  final ReportCompanyInfo company;
  const TrialBalanceScreen({super.key, required this.accounts, required this.operations, required this.company});

  double _debit(String id)  => operations.where((o) => o.accountId == id && o.amount > 0).fold(0.0, (s, o) => s + o.amount);
  double _credit(String id) => operations.where((o) => o.accountId == id && o.amount < 0).fold(0.0, (s, o) => s + o.amount.abs());

  @override
  Widget build(BuildContext context) {
    final td = accounts.fold(0.0, (s, a) => s + _debit(a.id));
    final tc = accounts.fold(0.0, (s, a) => s + _credit(a.id));
    final balanced = (td - tc).abs() < 0.01;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: _appBar('ميزان المراجعة', onPdf: () async {
        final doc = await _buildPdf(
          'ميزان المراجعة', company, 'جميع الحسابات — ${DateFormat('yyyy/MM/dd').format(DateTime.now())}',
          accounts.map((a) {
            final d = _debit(a.id); final c = _credit(a.id);
            return [a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name,
                    a.categoryLabel, d.toStringAsFixed(2), c.toStringAsFixed(2), (d-c).toStringAsFixed(2)];
          }).toList(),
          ['الحساب', 'التصنيف', 'مدين', 'دائن', 'الرصيد'],
          headerColor: PdfColors.indigo700,
          summaryLabel: 'إجمالي: مدين ${td.toStringAsFixed(2)}  |  دائن ${tc.toStringAsFixed(2)}',
          summaryValue: balanced ? 'متوازن' : 'غير متوازن',
          summaryColor: balanced ? PdfColors.green700 : PdfColors.red700,
        );
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      }),
      body: Column(children: [
        _CompanyHeader(company: company),
        _SummaryBar(items: [
          _SI('إجمالي مدين', td, Colors.orange),
          _SI('إجمالي دائن', tc, Colors.green),
          _SI('الفرق', (td-tc).abs(), balanced ? Colors.green : Colors.red),
        ]),
        Expanded(child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          itemCount: accounts.length + 1,
          itemBuilder: (_, i) {
            if (i == 0) return _TH(['الرصيد', 'دائن', 'مدين', 'التصنيف', 'الحساب']);
            final a = accounts[i-1]; final d = _debit(a.id); final c = _credit(a.id);
            return _TR(cells: [
              _tc((d-c).toStringAsFixed(2), color: (d-c) >= 0 ? Colors.orange.shade700 : Colors.green.shade700),
              _tc(c.toStringAsFixed(2), color: Colors.green.shade700),
              _tc(d.toStringAsFixed(2), color: Colors.orange.shade700),
              _tc(a.categoryLabel, color: Colors.grey.shade600),
              _tc(a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name, bold: true, align: TextAlign.right),
            ]);
          },
        )),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  قائمة الدخل
// ══════════════════════════════════════════════════════════
class IncomeStatementScreen extends StatefulWidget {
  final List<ReportAccount> accounts;
  final List<ReportOperation> operations;
  final ReportCompanyInfo company;
  const IncomeStatementScreen({super.key, required this.accounts, required this.operations, required this.company});
  @override State<IncomeStatementScreen> createState() => _IncomeStatementState();
}
class _IncomeStatementState extends State<IncomeStatementScreen> {
  DateTime _from = DateTime(DateTime.now().year, 1, 1);
  DateTime _to   = DateTime.now();

  List<ReportOperation> get _filtered => widget.operations.where((o) =>
      !o.date.isBefore(_from) && !o.date.isAfter(_to.add(const Duration(days: 1)))).toList();

  double _bal(String id) => _filtered.where((o) => o.accountId == id).fold(0.0, (s, o) => s + o.amount);
  List<ReportAccount> _by(String cat) => widget.accounts.where((a) => a.category == cat).toList();

  @override
  Widget build(BuildContext context) {
    final revs = _by('revenue'); final exps = _by('expense');
    final tr = revs.fold(0.0, (s, a) => s + _bal(a.id).abs());
    final te = exps.fold(0.0, (s, a) => s + _bal(a.id).abs());
    final net = tr - te;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: _appBar('قائمة الدخل', onPdf: () async {
        final period = '${DateFormat('yyyy/MM/dd').format(_from)} - ${DateFormat('yyyy/MM/dd').format(_to)}';
        final rows = [
          ...revs.map((a) => [a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name, 'إيرادات', _bal(a.id).abs().toStringAsFixed(2), '']),
          ['الإجمالي', '', tr.toStringAsFixed(2), ''],
          ...exps.map((a) => [a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name, 'مصروفات', '', _bal(a.id).abs().toStringAsFixed(2)]),
          ['الإجمالي', '', '', te.toStringAsFixed(2)],
          ['صافي الربح / الخسارة', '', '', net.toStringAsFixed(2)],
        ];
        final doc = await _buildPdf('قائمة الدخل', widget.company, 'الفترة: $period',
            rows, ['البيان', 'النوع', 'إيرادات', 'مصروفات'],
            headerColor: PdfColors.green700,
            summaryLabel: 'صافي الربح / الخسارة', summaryValue: net.toStringAsFixed(2),
            summaryColor: net >= 0 ? PdfColors.green700 : PdfColors.red700);
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      }),
      body: Column(children: [
        _CompanyHeader(company: widget.company),
        _DateBar(from: _from, to: _to, onChanged: (f, t) => setState(() { _from = f; _to = t; })),
        _SummaryBar(items: [
          _SI('إيرادات', tr, Colors.green),
          _SI('مصروفات', te, Colors.red),
          _SI('صافي الربح', net, net >= 0 ? Colors.green : Colors.red),
        ]),
        Expanded(child: ListView(padding: const EdgeInsets.all(12), children: [
          _SH('الإيرادات', Colors.green.shade700),
          ...revs.map((a) => _BalRow(account: a, balance: _bal(a.id).abs(), color: Colors.green)),
          _TotalRow('إجمالي الإيرادات', tr, Colors.green),
          const SizedBox(height: 12),
          _SH('المصروفات', Colors.red.shade700),
          ...exps.map((a) => _BalRow(account: a, balance: _bal(a.id).abs(), color: Colors.red)),
          _TotalRow('إجمالي المصروفات', te, Colors.red),
          const SizedBox(height: 16),
          _NetRow('صافي الربح / الخسارة', net),
        ])),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  الميزانية العمومية
// ══════════════════════════════════════════════════════════
class BalanceSheetScreen extends StatelessWidget {
  final List<ReportAccount> accounts;
  final ReportCompanyInfo company;
  const BalanceSheetScreen({super.key, required this.accounts, required this.company});

  List<ReportAccount> _by(String c) => accounts.where((a) => a.category == c).toList();

  @override
  Widget build(BuildContext context) {
    final assets = _by('asset'); final liab = _by('liability'); final eq = _by('equity');
    final ta = assets.fold(0.0, (s, a) => s + a.balance);
    final tl = liab.fold(0.0, (s, a) => s + a.balance);
    final te = eq.fold(0.0, (s, a) => s + a.balance);
    final diff = ta - (tl + te);
    final balanced = diff.abs() < 0.01;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: _appBar('الميزانية العمومية', onPdf: () async {
        final rows = [
          ...assets.map((a) => ['أصول', a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name, a.balance.toStringAsFixed(2)]),
          ['', 'إجمالي الأصول', ta.toStringAsFixed(2)],
          ...liab.map((a) => ['خصوم', a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name, a.balance.toStringAsFixed(2)]),
          ['', 'إجمالي الخصوم', tl.toStringAsFixed(2)],
          ...eq.map((a) => ['ملكية', a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name, a.balance.toStringAsFixed(2)]),
          ['', 'إجمالي حقوق الملكية', te.toStringAsFixed(2)],
        ];
        final doc = await _buildPdf('الميزانية العمومية', company,
            'بتاريخ ${DateFormat('yyyy/MM/dd').format(DateTime.now())}',
            rows, ['الفئة', 'الحساب', 'الرصيد'], headerColor: PdfColors.indigo,
            summaryLabel: balanced ? 'الميزانية متوازنة' : 'فرق: ${diff.abs().toStringAsFixed(2)}',
            summaryValue: '', summaryColor: balanced ? PdfColors.green700 : PdfColors.red700);
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      }),
      body: Column(children: [
        _CompanyHeader(company: company),
        _SummaryBar(items: [
          _SI('أصول', ta, Colors.blue),
          _SI('خصوم+ملكية', tl+te, Colors.orange),
          _SI('الفرق', diff.abs(), balanced ? Colors.green : Colors.red),
        ]),
        Expanded(child: ListView(padding: const EdgeInsets.all(12), children: [
          _SH('الأصول', Colors.blue.shade700),
          ...assets.map((a) => _BalRow(account: a, balance: a.balance, color: Colors.blue)),
          _TotalRow('إجمالي الأصول', ta, Colors.blue),
          const SizedBox(height: 12),
          _SH('الخصوم', Colors.orange.shade700),
          ...liab.map((a) => _BalRow(account: a, balance: a.balance, color: Colors.orange)),
          _TotalRow('إجمالي الخصوم', tl, Colors.orange),
          const SizedBox(height: 12),
          _SH('حقوق الملكية', Colors.indigo),
          ...eq.map((a) => _BalRow(account: a, balance: a.balance, color: Colors.indigo)),
          _TotalRow('إجمالي حقوق الملكية', te, Colors.indigo),
          const SizedBox(height: 16),
          _NetRow('الأصول = الخصوم + الملكية', diff, isCheck: true),
        ])),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  كشف حساب
// ══════════════════════════════════════════════════════════
class AccountStatementScreen extends StatefulWidget {
  final List<ReportAccount> accounts;
  final List<ReportOperation> operations;
  final ReportCompanyInfo company;
  final String? preSelectedAccountId;
  const AccountStatementScreen({super.key, required this.accounts, required this.operations,
      required this.company, this.preSelectedAccountId});
  @override State<AccountStatementScreen> createState() => _AccStmtState();
}
class _AccStmtState extends State<AccountStatementScreen> {
  String? _id;
  DateTime _from = DateTime(DateTime.now().year, 1, 1);
  DateTime _to   = DateTime.now();

  @override
  void initState() {
    super.initState();
    _id = widget.preSelectedAccountId ??
        (widget.accounts.isNotEmpty ? widget.accounts.first.id : null);
  }

  List<ReportOperation> get _ops => widget.operations
      .where((o) => o.accountId == _id &&
          !o.date.isBefore(_from) &&
          !o.date.isAfter(_to.add(const Duration(days: 1))))
      .toList()..sort((a, b) => a.date.compareTo(b.date));

  ReportAccount? get _selected => widget.accounts.where((a) => a.id == _id).firstOrNull;

  @override
  Widget build(BuildContext context) {
    final ops = _ops; double running = 0;
    final fmt = DateFormat('dd/MM/yyyy');

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: _appBar('كشف حساب', onPdf: () async {
        final sel = _selected; if (sel == null) return;
        double r = 0;
        final rows = ops.map((o) {
          r += o.amount;
          return [fmt.format(o.date), o.statement,
            o.amount > 0 ? o.amount.toStringAsFixed(2) : '-',
            o.amount < 0 ? o.amount.abs().toStringAsFixed(2) : '-',
            r.toStringAsFixed(2)];
        }).toList();
        final period = '${fmt.format(_from)} - ${fmt.format(_to)}';
        final doc = await _buildPdf('كشف حساب', widget.company,
            '${sel.code.isNotEmpty ? "${sel.code} - " : ""}${sel.name} | $period',
            rows, ['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'],
            headerColor: PdfColors.orange700,
            summaryLabel: 'الرصيد النهائي',
            summaryValue: r.toStringAsFixed(2),
            summaryColor: r >= 0 ? PdfColors.orange700 : PdfColors.green700);
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      }),
      body: Column(children: [
        _CompanyHeader(company: widget.company),
        Padding(padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          child: DropdownButtonFormField<String>(
            value: _id, isExpanded: true,
            decoration: InputDecoration(filled: true, fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)),
            hint: const Text('اختر الحساب', textAlign: TextAlign.right),
            onChanged: (v) => setState(() => _id = v),
            items: widget.accounts.map((a) => DropdownMenuItem(value: a.id,
              child: Text(a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name,
                  overflow: TextOverflow.ellipsis))).toList(),
          )),
        _DateBar(from: _from, to: _to, onChanged: (f, t) => setState(() { _from = f; _to = t; })),
        Expanded(child: ops.isEmpty
          ? const Center(child: Text('لا توجد حركات', style: TextStyle(color: Colors.grey)))
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: ops.length + 1,
              itemBuilder: (_, i) {
                if (i == 0) return _TH(['الرصيد', 'دائن', 'مدين', 'البيان', 'التاريخ']);
                final op = ops[i-1]; running += op.amount;
                return _TR(cells: [
                  _tc(running.toStringAsFixed(2),
                      color: running >= 0 ? Colors.orange.shade700 : Colors.green.shade700),
                  _tc(op.amount < 0 ? op.amount.abs().toStringAsFixed(2) : '-', color: Colors.green.shade700),
                  _tc(op.amount > 0 ? op.amount.toStringAsFixed(2) : '-', color: Colors.orange.shade700),
                  _tc(op.statement, align: TextAlign.right),
                  _tc(fmt.format(op.date)),
                ]);
              },
            )),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  دفتر الأستاذ
// ══════════════════════════════════════════════════════════
class GeneralLedgerScreen extends StatefulWidget {
  final List<ReportAccount> accounts;
  final List<ReportOperation> operations;
  final ReportCompanyInfo company;
  const GeneralLedgerScreen({super.key, required this.accounts, required this.operations, required this.company});
  @override State<GeneralLedgerScreen> createState() => _GLState();
}
class _GLState extends State<GeneralLedgerScreen> {
  DateTime _from = DateTime(DateTime.now().year, 1, 1);
  DateTime _to   = DateTime.now();
  String   _search = '';

  List<ReportOperation> _opsFor(String id) => widget.operations
      .where((o) => o.accountId == id &&
          !o.date.isBefore(_from) &&
          !o.date.isAfter(_to.add(const Duration(days: 1))))
      .toList()..sort((a, b) => a.date.compareTo(b.date));

  List<ReportAccount> get _accs => widget.accounts
      .where((a) => (_search.isEmpty || a.name.contains(_search) || a.code.contains(_search))
          && _opsFor(a.id).isNotEmpty)
      .toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: _appBar('دفتر الأستاذ', onPdf: () async {
        final fmt = DateFormat('dd/MM/yyyy');
        final rows = <List<String>>[];
        for (final a in _accs) {
          final ops = _opsFor(a.id); double r = 0;
          rows.add(['--- ${a.code.isNotEmpty ? "${a.code} - " : ""}${a.name} ---', '', '', '', '']);
          for (final o in ops) {
            r += o.amount;
            rows.add([fmt.format(o.date), o.statement,
              o.amount > 0 ? o.amount.toStringAsFixed(2) : '-',
              o.amount < 0 ? o.amount.abs().toStringAsFixed(2) : '-', r.toStringAsFixed(2)]);
          }
        }
        final doc = await _buildPdf('دفتر الأستاذ', widget.company,
            '${DateFormat('yyyy/MM/dd').format(_from)} - ${DateFormat('yyyy/MM/dd').format(_to)}',
            rows, ['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'],
            headerColor: PdfColors.purple700);
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      }),
      body: Column(children: [
        _CompanyHeader(company: widget.company),
        _DateBar(from: _from, to: _to, onChanged: (f, t) => setState(() { _from = f; _to = t; })),
        Padding(padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          child: TextField(onChanged: (v) => setState(() => _search = v),
            textAlign: TextAlign.right,
            decoration: InputDecoration(hintText: 'بحث...', prefixIcon: const Icon(Icons.search, color: Colors.grey),
              filled: true, fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)))),
        Expanded(child: _accs.isEmpty
          ? const Center(child: Text('لا توجد حركات', style: TextStyle(color: Colors.grey)))
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              itemCount: _accs.length,
              itemBuilder: (_, i) {
                final a = _accs[i]; final ops = _opsFor(a.id);
                double r = 0; final fmt = DateFormat('dd/MM/yy');
                return Card(margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 1,
                  child: Column(children: [
                    Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(color: Colors.purple.shade700,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(14))),
                      child: Row(children: [
                        Text('${ops.length} حركة', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                        const Spacer(),
                        Text(a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ])),
                    ...ops.map((op) {
                      r += op.amount;
                      return Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        child: Row(children: [
                          SizedBox(width: 60, child: Text(r.toStringAsFixed(2), textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold,
                                  color: r >= 0 ? Colors.orange.shade700 : Colors.green.shade700))),
                          SizedBox(width: 55, child: Text(op.amount < 0 ? op.amount.abs().toStringAsFixed(2) : '-',
                              textAlign: TextAlign.center, style: const TextStyle(color: Colors.green, fontSize: 10))),
                          SizedBox(width: 55, child: Text(op.amount > 0 ? op.amount.toStringAsFixed(2) : '-',
                              textAlign: TextAlign.center, style: const TextStyle(color: Colors.orange, fontSize: 10))),
                          const Spacer(),
                          Flexible(child: Text(op.statement, textAlign: TextAlign.right,
                              style: const TextStyle(fontSize: 10), overflow: TextOverflow.ellipsis)),
                          const SizedBox(width: 6),
                          Text(fmt.format(op.date), style: const TextStyle(fontSize: 9, color: Colors.grey)),
                        ]));
                    }),
                    Padding(padding: const EdgeInsets.all(10),
                      child: Row(children: [
                        Text(ops.fold(0.0, (s, o) => s + o.amount).toStringAsFixed(2),
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13,
                                color: ops.fold(0.0, (s, o) => s + o.amount) >= 0 ? Colors.orange : Colors.green)),
                        const Spacer(),
                        const Text('الرصيد:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                      ])),
                  ]));
              })),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  تقرير المدينون
// ══════════════════════════════════════════════════════════
class DebtorsScreen extends StatelessWidget {
  final List<ReportAccount> accounts;
  final List<ReportOperation> operations;
  final ReportCompanyInfo company;
  const DebtorsScreen({super.key, required this.accounts, required this.operations, required this.company});

  List<ReportAccount> get _debtors => accounts.where((a) => a.balance > 0.009).toList()
    ..sort((a, b) => b.balance.compareTo(a.balance));

  double get _total => _debtors.fold(0.0, (s, a) => s + a.balance);

  @override
  Widget build(BuildContext context) {
    final list = _debtors; final total = _total;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: _appBar('تقرير المدينون', color: Colors.red.shade700, onPdf: () async {
        final rows = list.map((a) => [
          a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name,
          a.categoryLabel, a.balance.toStringAsFixed(2),
        ]).toList();
        final doc = await _buildPdf('تقرير المدينون', company,
            'بتاريخ ${DateFormat('yyyy/MM/dd').format(DateTime.now())}',
            rows, ['الحساب', 'التصنيف', 'الرصيد المدين'],
            headerColor: PdfColors.red700,
            summaryLabel: 'إجمالي المديونية', summaryValue: total.toStringAsFixed(2),
            summaryColor: PdfColors.red700);
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      }),
      body: Column(children: [
        _CompanyHeader(company: company),
        _SummaryBar(items: [
          _SI('عدد المدينين', list.length.toDouble(), Colors.red),
          _SI('إجمالي المديونية', total, Colors.red.shade700),
        ]),
        Expanded(child: list.isEmpty
          ? _empty('لا يوجد مدينون', Icons.people_outline)
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: list.length + 1,
              itemBuilder: (_, i) {
                if (i == 0) return _TH(['الرصيد المدين', 'التصنيف', 'الحساب']);
                final a = list[i-1];
                return _TR(cells: [
                  _tc(a.balance.toStringAsFixed(2), color: Colors.red.shade700, bold: true),
                  _tc(a.categoryLabel, color: Colors.grey.shade600),
                  _tc(a.code.isNotEmpty ? '${a.code} - ${a.name}' : a.name, bold: true, align: TextAlign.right),
                ]);
              })),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  تقرير الدائنون
// ══════════════════════════════════════════════════════════
class CreditorsScreen extends StatelessWidget {
  final List<ReportAccount> accounts;
  final List<ReportOperation> operations;
  final ReportCompanyInfo company;
  const CreditorsScreen({super.key, required this.accounts, required this.operations, required this.company});

  List<({ReportAccount account, double amount})> get _creditors => accounts
      .where((a) => a.balance < -0.009)
      .map((a) => (account: a, amount: a.balance.abs()))
      .toList()..sort((a, b) => b.amount.compareTo(a.amount));

  double get _total => _creditors.fold(0.0, (s, c) => s + c.amount);

  @override
  Widget build(BuildContext context) {
    final list = _creditors; final total = _total;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: _appBar('تقرير الدائنون', color: Colors.teal.shade700, onPdf: () async {
        final rows = list.map((c) => [
          c.account.code.isNotEmpty ? '${c.account.code} - ${c.account.name}' : c.account.name,
          c.account.categoryLabel, c.amount.toStringAsFixed(2),
        ]).toList();
        final doc = await _buildPdf('تقرير الدائنون', company,
            'بتاريخ ${DateFormat('yyyy/MM/dd').format(DateTime.now())}',
            rows, ['الحساب', 'التصنيف', 'الرصيد الدائن'],
            headerColor: PdfColors.teal700,
            summaryLabel: 'إجمالي الدائنية', summaryValue: total.toStringAsFixed(2),
            summaryColor: PdfColors.teal700);
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      }),
      body: Column(children: [
        _CompanyHeader(company: company),
        _SummaryBar(items: [
          _SI('عدد الدائنين', list.length.toDouble(), Colors.teal),
          _SI('إجمالي الدائنية', total, Colors.teal.shade700),
        ]),
        Expanded(child: list.isEmpty
          ? _empty('لا يوجد دائنون', Icons.business_center_outlined)
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: list.length + 1,
              itemBuilder: (_, i) {
                if (i == 0) return _TH(['الرصيد الدائن', 'التصنيف', 'الحساب']);
                final c = list[i-1];
                return _TR(cells: [
                  _tc(c.amount.toStringAsFixed(2), color: Colors.teal.shade700, bold: true),
                  _tc(c.account.categoryLabel, color: Colors.grey.shade600),
                  _tc(c.account.code.isNotEmpty ? '${c.account.code} - ${c.account.name}' : c.account.name,
                      bold: true, align: TextAlign.right),
                ]);
              })),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  مكوّنات مشتركة
// ══════════════════════════════════════════════════════════

// AppBar مشترك مع زر PDF
PreferredSizeWidget _appBar(String title,
    {VoidCallback? onPdf, Color color = const Color(0xFF021B79)}) => AppBar(
  title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
  backgroundColor: color,
  iconTheme: const IconThemeData(color: Colors.white),
  actions: [
    if (onPdf != null)
      IconButton(icon: const Icon(Icons.picture_as_pdf, color: Colors.white),
          tooltip: 'تصدير PDF', onPressed: onPdf),
  ],
);

// رأس معلومات الشركة
class _CompanyHeader extends StatelessWidget {
  final ReportCompanyInfo company;
  const _CompanyHeader({required this.company});

  @override
  Widget build(BuildContext context) {
    if (company.name.isEmpty && company.phone.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: Colors.white,
      child: Row(children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (company.phone.isNotEmpty)
            Text(company.phone, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          if (company.address.isNotEmpty)
            Text(company.address, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        ]),
        const Spacer(),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(company.name.isNotEmpty ? company.name : 'منصتي المحاسبية',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF021B79))),
          if (company.email.isNotEmpty)
            Text(company.email, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        ]),
      ]),
    );
  }
}

// شريط الملخص
class _SummaryBar extends StatelessWidget {
  final List<_SI> items;
  const _SummaryBar({required this.items});

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.all(12),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6)]),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: items.map((it) => Column(children: [
        Text(it.value % 1 == 0 ? it.value.toInt().toString() : it.value.toStringAsFixed(2),
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: it.color)),
        Text(it.label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ])).toList()),
  );
}

class _SI {
  final String label; final double value; final Color color;
  const _SI(this.label, this.value, this.color);
}

// فلتر التاريخ
class _DateBar extends StatelessWidget {
  final DateTime from, to;
  final void Function(DateTime, DateTime) onChanged;
  const _DateBar({required this.from, required this.to, required this.onChanged});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
    child: Row(children: [
      Expanded(child: _dBtn(context, 'إلى', to, isTo: true)),
      const SizedBox(width: 8),
      Expanded(child: _dBtn(context, 'من', from, isTo: false)),
    ]),
  );

  Widget _dBtn(BuildContext ctx, String label, DateTime val, {required bool isTo}) =>
      InkWell(onTap: () async {
        final d = await showDatePicker(context: ctx, initialDate: val,
            firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 365)));
        if (d != null) onChanged(isTo ? from : d, isTo ? d : to);
      }, borderRadius: BorderRadius.circular(10),
        child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade200)),
          child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            Text(DateFormat('dd/MM/yyyy').format(val),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(width: 6),
            Text('$label:', style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ])));
}

// رأس الجدول
Widget _TH(List<String> cols) => Container(
  margin: const EdgeInsets.only(bottom: 4),
  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
  decoration: BoxDecoration(color: const Color(0xFF021B79).withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(8)),
  child: Row(children: cols.map((c) => Expanded(
    child: Text(c, textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF021B79))))).toList()),
);

// صف الجدول
class _TR extends StatelessWidget {
  final List<Widget> cells;
  const _TR({required this.cells});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 2),
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade100)),
    child: Row(children: cells.map((c) => Expanded(child: c)).toList()),
  );
}

Widget _tc(String text, {Color? color, bool bold = false, TextAlign align = TextAlign.center}) =>
    Text(text, textAlign: align,
        style: TextStyle(fontSize: 11, color: color,
            fontWeight: bold ? FontWeight.bold : FontWeight.normal),
        overflow: TextOverflow.ellipsis);

// عنوان القسم
class _SH extends StatelessWidget {
  final String title; final Color color;
  const _SH(this.title, this.color);
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 6),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8),
        border: Border(right: BorderSide(color: color, width: 4))),
    child: Text(title, textAlign: TextAlign.right,
        style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 13)),
  );
}

// صف رصيد حساب
class _BalRow extends StatelessWidget {
  final ReportAccount account; final double balance; final Color color;
  const _BalRow({required this.account, required this.balance, required this.color});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 4),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade100)),
    child: Row(children: [
      Text(balance.toStringAsFixed(2),
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
              color: balance >= 0 ? color : Colors.red)),
      const Spacer(),
      Text(account.code.isNotEmpty ? '${account.code} - ${account.name}' : account.name,
          style: const TextStyle(fontSize: 13), textAlign: TextAlign.right,
          overflow: TextOverflow.ellipsis),
    ]),
  );
}

// صف الإجمالي
Widget _TotalRow(String label, double total, Color color) => Container(
  margin: const EdgeInsets.symmetric(vertical: 6),
  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
  decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8),
      border: Border.all(color: color.withValues(alpha: 0.3))),
  child: Row(children: [
    Text(total.toStringAsFixed(2),
        style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 14)),
    const Spacer(),
    Text(label, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 13)),
  ]),
);

// صف الصافي
Widget _NetRow(String label, double value, {bool isCheck = false}) {
  final isGood = isCheck ? value.abs() < 0.01 : value >= 0;
  final color = isGood ? Colors.green.shade700 : Colors.red.shade700;
  return Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: (isGood ? Colors.green : Colors.red).withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: (isGood ? Colors.green : Colors.red).withValues(alpha: 0.3))),
    child: Row(children: [
      Row(children: [
        Icon(isGood ? Icons.check_circle : Icons.warning, color: color, size: 18),
        const SizedBox(width: 6),
        Text(value.toStringAsFixed(2),
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color)),
      ]),
      const Spacer(),
      Text(label, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: color)),
    ]),
  );
}

// شاشة فارغة
Widget _empty(String msg, IconData icon) => Center(child: Column(
    mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(icon, size: 64, color: Colors.grey.shade300),
      const SizedBox(height: 12),
      Text(msg, style: TextStyle(color: Colors.grey.shade400, fontSize: 15)),
    ]));
