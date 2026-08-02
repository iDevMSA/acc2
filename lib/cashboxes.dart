// lib/cashboxes.dart
// 
//  نظام الصناديق — Cashbox Management System
//  يدعم:
//   • إنشاء صناديق بشجرة هرمية (أب / أبناء / أحفاد)
//   • ربط حسابات بصندوق أو أكثر
//   • سعر صرف وعملة ثابتة لكل صندوق
//   • إغلاق حقلي سعر الصرف والعملة في القيد تبعًا لإعداد الصندوق
//   • حساب رصيد الصندوق شاملًا أرصدة الأبناء
// 

// ignore_for_file: use_build_context_synchronously

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:ui' as ui;
import 'main.dart' show DataService;

//  نماذج البيانات 

/// صندوق نقدي
class Cashbox {
  final String id;
  final String name;
  final String? parentId; // null = جذر
  final String? currency; // null = حر
  final double? exchangeRate; // null = حر
  final List<String> linkedAccountIds;
  final DateTime createdAt;

  const Cashbox({
    required this.id,
    required this.name,
    this.parentId,
    this.currency,
    this.exchangeRate,
    this.linkedAccountIds = const [],
    required this.createdAt,
  });

  /// هل العملة مثبّتة؟
  bool get hasCurrency => currency != null && currency!.isNotEmpty;

  /// هل سعر الصرف مثبّت؟
  bool get hasRate => exchangeRate != null && exchangeRate! > 0;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (parentId != null) 'parentId': parentId,
        if (currency != null) 'currency': currency,
        if (exchangeRate != null) 'exchangeRate': exchangeRate,
        'linkedAccountIds': linkedAccountIds,
        'createdAt': createdAt.toIso8601String(),
      };

  factory Cashbox.fromJson(Map<String, dynamic> j) => Cashbox(
        id: j['id'] ?? '',
        name: j['name'] ?? '',
        parentId: j['parentId'],
        currency: j['currency'],
        exchangeRate: j['exchangeRate'] != null
            ? (j['exchangeRate'] as num).toDouble()
            : null,
        linkedAccountIds: j['linkedAccountIds'] != null
            ? List<String>.from(j['linkedAccountIds'])
            : [],
        createdAt:
            DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
      );

  Cashbox copyWith({
    String? name,
    Object? parentId = _sentinel,
    Object? currency = _sentinel,
    Object? exchangeRate = _sentinel,
    List<String>? linkedAccountIds,
  }) =>
      Cashbox(
        id: id,
        name: name ?? this.name,
        parentId: parentId == _sentinel
            ? this.parentId
            : parentId as String?,
        currency:
            currency == _sentinel ? this.currency : currency as String?,
        exchangeRate: exchangeRate == _sentinel
            ? this.exchangeRate
            : exchangeRate as double?,
        linkedAccountIds: linkedAccountIds ?? this.linkedAccountIds,
        createdAt: createdAt,
      );
}

// sentinel للتمييز بين null المقصود وعدم التمرير
class _SentinelClass {
  const _SentinelClass();
}

const _sentinel = _SentinelClass();

//  خدمة الصناديق 

class CashboxService {
  static const _kBoxes = 'local_cashboxes';

  static String get _prefix {
    final uid = FirebaseAuth.instance.currentUser?.uid ?? 'guest';
    return '${uid}_';
  }

  static Future<SharedPreferences> get _prefs =>
      SharedPreferences.getInstance();

  //  قراءة / حفظ 

  static Future<List<Cashbox>> getBoxes() async {
    final p = await _prefs;
    final raw = p.getString('$_prefix$_kBoxes');
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((j) => Cashbox.fromJson(Map<String, dynamic>.from(j))).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> _saveBoxes(List<Cashbox> boxes) async {
    final p = await _prefs;
    await p.setString(
        '$_prefix$_kBoxes', jsonEncode(boxes.map((b) => b.toJson()).toList()));
    cashboxesNotifier.value = List.from(boxes);
    _syncToFirebase(boxes);
  }

  static Future<String> _nextId() async {
    final boxes = await getBoxes();
    if (boxes.isEmpty) return 'BOX001';
    int max = 0;
    for (final b in boxes) {
      final n = int.tryParse(b.id.replaceAll('BOX', '')) ?? 0;
      if (n > max) max = n;
    }
    return 'BOX${(max + 1).toString().padLeft(3, '0')}';
  }

  //  CRUD 

  static Future<Cashbox> addBox({
    required String name,
    String? parentId,
    String? currency,
    double? exchangeRate,
  }) async {
    final id = await _nextId();
    final box = Cashbox(
      id: id,
      name: name,
      parentId: parentId,
      currency: currency?.isNotEmpty == true ? currency : null,
      exchangeRate:
          exchangeRate != null && exchangeRate > 0 ? exchangeRate : null,
      linkedAccountIds: [],
      createdAt: DateTime.now(),
    );
    final boxes = await getBoxes();
    boxes.add(box);
    await _saveBoxes(boxes);
    return box;
  }

  static Future<void> updateBox({
    required String boxId,
    required String name,
    String? parentId,
    String? currency,
    double? exchangeRate,
  }) async {
    final boxes = await getBoxes();
    final idx = boxes.indexWhere((b) => b.id == boxId);
    if (idx == -1) return;
    boxes[idx] = boxes[idx].copyWith(
      name: name,
      parentId: parentId,
      currency: currency?.isNotEmpty == true ? currency : null,
      exchangeRate:
          exchangeRate != null && exchangeRate > 0 ? exchangeRate : null,
    );
    await _saveBoxes(boxes);
  }

  static Future<void> deleteBox(String boxId) async {
    final boxes = await getBoxes();
    // فكّ ربط الأبناء (لا تحذفهم، بل اجعلهم جذرًا)
    for (int i = 0; i < boxes.length; i++) {
      if (boxes[i].parentId == boxId) {
        boxes[i] = boxes[i].copyWith(parentId: null);
      }
    }
    boxes.removeWhere((b) => b.id == boxId);
    await _saveBoxes(boxes);
  }

  /// ربط/فكّ ربط حسابات بصندوق
  static Future<void> setLinkedAccounts(
      String boxId, List<String> accountIds) async {
    final boxes = await getBoxes();
    final idx = boxes.indexWhere((b) => b.id == boxId);
    if (idx == -1) return;
    boxes[idx] = boxes[idx].copyWith(linkedAccountIds: accountIds);
    await _saveBoxes(boxes);
  }

  /// كل الصناديق المرتبطة بحساب معيّن
  static List<Cashbox> boxesForAccount(
      List<Cashbox> allBoxes, String accountId) {
    return allBoxes
        .where((b) => b.linkedAccountIds.contains(accountId))
        .toList();
  }

  //  الرصيد 

  /// رصيد الصندوق مع الأبناء والأحفاد
  static CashboxBalance computeBalance({
    required Cashbox box,
    required List<Cashbox> allBoxes,
    required List<dynamic> allOps, // List<Operation>
    required String mainCurrency,
  }) {
    // فهرسة العمليات حسب accountId مرة واحدة بدل مسح القائمة الكاملة
    // لكل حساب مرتبط في كل صندوق (كانت O(صناديق × حسابات × عمليات)).
    final opsByAccount = <String, List<dynamic>>{};
    for (final op in allOps) {
      (opsByAccount[op.accountId as String] ??= []).add(op);
    }
    return _computeRecursive(
        box: box,
        allBoxes: allBoxes,
        opsByAccount: opsByAccount,
        mainCurrency: mainCurrency,
        visited: {});
  }

  static CashboxBalance _computeRecursive({
    required Cashbox box,
    required List<Cashbox> allBoxes,
    required Map<String, List<dynamic>> opsByAccount,
    required String mainCurrency,
    required Set<String> visited,
  }) {
    if (visited.contains(box.id)) {
      return CashboxBalance(
          totalInMain: 0, byCurrency: {}, boxId: box.id);
    }
    visited.add(box.id);

    double totalMain = 0;
    final Map<String, double> byCurrency = {};

    // قيود الحسابات المرتبطة مباشرة
    for (final accountId in box.linkedAccountIds) {
      final ops = opsByAccount[accountId] ?? const [];
      for (final op in ops) {
        totalMain += op.amountUSD as double;
        final cur = op.currency as String;
        byCurrency[cur] = (byCurrency[cur] ?? 0) + (op.amount as double);
      }
    }

    // رصيد الأبناء (تحويل إلى العملة الرئيسية)
    final children =
        allBoxes.where((b) => b.parentId == box.id).toList();
    for (final child in children) {
      final childBal = _computeRecursive(
          box: child,
          allBoxes: allBoxes,
          opsByAccount: opsByAccount,
          mainCurrency: mainCurrency,
          visited: visited);
      totalMain += childBal.totalInMain;
      for (final e in childBal.byCurrency.entries) {
        byCurrency[e.key] = (byCurrency[e.key] ?? 0) + e.value;
      }
    }

    return CashboxBalance(
        totalInMain: totalMain, byCurrency: byCurrency, boxId: box.id);
  }

  //  Firebase 
  static Future<void> _syncToFirebase(List<Cashbox> boxes) async {
    try {
      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid == null) return;
      await FirebaseDatabase.instance
          .ref('users/$uid/cashboxes')
          .set(boxes.map((b) => b.toJson()).toList());
    } catch (_) {}
  }

  static Future<void> restoreFromFirebase() async {
    try {
      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid == null) return;
      final snap = await FirebaseDatabase.instance
          .ref('users/$uid/cashboxes')
          .get();
      if (!snap.exists || snap.value == null) return;
      final list = List<Map>.from(snap.value as List? ?? []);
      final boxes = list
          .map((j) => Cashbox.fromJson(Map<String, dynamic>.from(j)))
          .toList();
      final p = await _prefs;
      await p.setString('$_prefix$_kBoxes',
          jsonEncode(boxes.map((b) => b.toJson()).toList()));
      cashboxesNotifier.value = List.from(boxes);
    } catch (_) {}
  }

  static Future<void> init() async {
    final boxes = await getBoxes();
    cashboxesNotifier.value = List.from(boxes);
  }
}

class CashboxBalance {
  final String boxId;
  final double totalInMain;
  final Map<String, double> byCurrency;
  const CashboxBalance(
      {required this.boxId,
      required this.totalInMain,
      required this.byCurrency});
}

// GlobalNotifier
final ValueNotifier<List<Cashbox>> cashboxesNotifier =
    ValueNotifier<List<Cashbox>>([]);

//  شاشة الصناديق 

class CashboxesScreen extends StatefulWidget {
  const CashboxesScreen({super.key});
  @override
  State<CashboxesScreen> createState() => _CashboxesScreenState();
}

class _CashboxesScreenState extends State<CashboxesScreen> {
  List<Cashbox> _boxes = [];
  bool _loading = true;
  String _mainCurrency = 'USD';
  List<dynamic> _allOps = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    _boxes = await CashboxService.getBoxes();
    // نجلب العمليات عبر DataService (Drift) — وليس بقراءة SharedPreferences
    // مباشرة، حتى لا تعود بيانات فارغة/قديمة بعد ترحيل التخزين المحلي.
    _allOps = await DataService.getOperations();
    _mainCurrency = await DataService.getMainCurrency();
    if (mounted) setState(() => _loading = false);
  }

  /// الصناديق الجذرية (بدون أب)
  List<Cashbox> get _roots =>
      _boxes.where((b) => b.parentId == null).toList();

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: ui.TextDirection.rtl,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(
              gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
          child: SafeArea(
            child: Column(children: [
              // AppBar
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                child: Row(children: [

                  const Expanded(
                    child: Text('الصناديق',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold)),
                  ),
                  IconButton(
                      icon: const Icon(Icons.add_circle_outline,
                          color: Colors.white, size: 28),
                      tooltip: 'صندوق جديد',
                      onPressed: () => _openAddBox(context)),
                ]),
              ),
              // Body
              Expanded(
                child: ClipRRect(
                  borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(36),
                      topRight: Radius.circular(36)),
                  child: Container(
                    color: Colors.grey.shade50,
                    child: _loading
                        ? const Center(
                            child: CircularProgressIndicator(
                                color: Color(0xFF021B79)))
                        : _boxes.isEmpty
                            ? _emptyState()
                            : RefreshIndicator(
                                onRefresh: _load,
                                child: ListView(
                                  padding: const EdgeInsets.all(16),
                                  children: _roots
                                      .map((b) =>
                                          _BoxTreeNode(
                                            box: b,
                                            allBoxes: _boxes,
                                            allOps: _allOps,
                                            mainCurrency: _mainCurrency,
                                            depth: 0,
                                            onChanged: _load,
                                          ))
                                      .toList(),
                                ),
                              ),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _emptyState() => Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.account_balance_wallet_outlined,
              size: 72, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text('لا توجد صناديق بعد',
              style:
                  TextStyle(color: Colors.grey.shade500, fontSize: 16)),
          const SizedBox(height: 8),
          Text('اضغط + لإضافة صندوق جديد',
              style:
                  TextStyle(color: Colors.grey.shade400, fontSize: 13)),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            icon: const Icon(Icons.add, color: Colors.white),
            label: const Text('إضافة صندوق',
                style: TextStyle(color: Colors.white)),
            onPressed: () => _openAddBox(context),
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF021B79),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12))),
          ),
        ]),
      );

  void _openAddBox(BuildContext ctx) async {
    await showModalBottomSheet(
        context: ctx,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(
            textDirection: ui.TextDirection.rtl,
            child: _AddEditBoxSheet(
                allBoxes: _boxes, onSaved: _load)));
  }
}

//  عقدة الشجرة 

class _BoxTreeNode extends StatefulWidget {
  final Cashbox box;
  final List<Cashbox> allBoxes;
  final List<dynamic> allOps;
  final String mainCurrency;
  final int depth;
  final VoidCallback onChanged;

  const _BoxTreeNode({
    required this.box,
    required this.allBoxes,
    required this.allOps,
    required this.mainCurrency,
    required this.depth,
    required this.onChanged,
  });

  @override
  State<_BoxTreeNode> createState() => _BoxTreeNodeState();
}

class _BoxTreeNodeState extends State<_BoxTreeNode> {
  bool _expanded = true;

  List<Cashbox> get _children =>
      widget.allBoxes.where((b) => b.parentId == widget.box.id).toList();

  @override
  Widget build(BuildContext context) {
    final bal = CashboxService.computeBalance(
        box: widget.box,
        allBoxes: widget.allBoxes,
        allOps: widget.allOps,
        mainCurrency: widget.mainCurrency);

    final sym = _currSym(widget.mainCurrency);
    final isPositive = bal.totalInMain >= 0;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // البطاقة
      GestureDetector(
        onTap: () => _openDetail(context),
        child: Container(
          margin: EdgeInsets.only(
              right: widget.depth * 16.0, bottom: 10),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                  color: const Color(0xFF021B79).withOpacity(0.12)),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 3))
              ]),
          child: Row(children: [
            // أيقونة التوسيع
            if (_children.isNotEmpty)
              GestureDetector(
                onTap: () =>
                    setState(() => _expanded = !_expanded),
                child: Icon(
                    _expanded
                        ? Icons.keyboard_arrow_down
                        : Icons.keyboard_arrow_left,
                    color: Colors.grey.shade500,
                    size: 22),
              )
            else
              const SizedBox(width: 22),
            const SizedBox(width: 8),
            // أيقونة الصندوق
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                  color:
                      const Color(0xFF021B79).withOpacity(0.09),
                  borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.account_balance_wallet,
                  color: Color(0xFF021B79), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Row(children: [
                    Expanded(
                      child: Text(widget.box.name,
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis),
                    ),
                    Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(20)),
                        child: Text(widget.box.id,
                            style: const TextStyle(
                                fontSize: 10,
                                color: Color(0xFF6B7280)))),
                  ]),
                  const SizedBox(height: 4),
                  Row(children: [
                    if (widget.box.hasCurrency)
                      _chip(widget.box.currency!, Colors.blue),
                    if (widget.box.hasRate)
                      _chip(
                          'صرف: ${widget.box.exchangeRate!.toStringAsFixed(2)}',
                          Colors.orange),
                    _chip(
                        '${widget.box.linkedAccountIds.length} حساب',
                        Colors.green),
                  ]),
                ])),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(
                  '${bal.totalInMain >= 0 ? "+" : ""}${bal.totalInMain.toStringAsFixed(2)} $sym',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: isPositive
                          ? Colors.green.shade700
                          : Colors.red.shade700)),
              if (_children.isNotEmpty)
                Text('شامل الأبناء',
                    style: TextStyle(
                        fontSize: 10, color: Colors.grey.shade400)),
            ]),
          ]),
        ),
      ),
      // الأبناء
      if (_expanded && _children.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Column(
              children: _children
                  .map((child) => _BoxTreeNode(
                        box: child,
                        allBoxes: widget.allBoxes,
                        allOps: widget.allOps,
                        mainCurrency: widget.mainCurrency,
                        depth: widget.depth + 1,
                        onChanged: widget.onChanged,
                      ))
                  .toList()),
        ),
    ]);
  }

  Widget _chip(String label, Color color) => Container(
        margin: const EdgeInsets.only(left: 4),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12)),
        child: Text(label,
            style: TextStyle(fontSize: 10, color: color.shade700)));

  void _openDetail(BuildContext ctx) {
    showModalBottomSheet(
        context: ctx,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(
            textDirection: ui.TextDirection.rtl,
            child: _BoxDetailSheet(
                box: widget.box,
                allBoxes: widget.allBoxes,
                allOps: widget.allOps,
                mainCurrency: widget.mainCurrency,
                onChanged: widget.onChanged)));
  }
}

extension on Color {
  Color get shade700 {
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness - 0.2).clamp(0, 1)).toColor();
  }
}

//  تفاصيل الصندوق 

class _BoxDetailSheet extends StatefulWidget {
  final Cashbox box;
  final List<Cashbox> allBoxes;
  final List<dynamic> allOps;
  final String mainCurrency;
  final VoidCallback onChanged;

  const _BoxDetailSheet({
    required this.box,
    required this.allBoxes,
    required this.allOps,
    required this.mainCurrency,
    required this.onChanged,
  });

  @override
  State<_BoxDetailSheet> createState() => _BoxDetailSheetState();
}

class _BoxDetailSheetState extends State<_BoxDetailSheet> {
  late CashboxBalance _balance;

  @override
  void initState() {
    super.initState();
    _balance = CashboxService.computeBalance(
        box: widget.box,
        allBoxes: widget.allBoxes,
        allOps: widget.allOps,
        mainCurrency: widget.mainCurrency);
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    final sym = _currSym(widget.mainCurrency);
    final isPositive = _balance.totalInMain >= 0;
    final parentBox = widget.box.parentId != null
        ? widget.allBoxes
            .where((b) => b.id == widget.box.parentId)
            .firstOrNull
        : null;

    return Container(
      constraints: BoxConstraints(maxHeight: h * 0.9),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Column(children: [
        // Handle
        Center(
            child: Container(
                margin: const EdgeInsets.only(top: 10),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2)))),
        // Header
        Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
              color: Color(0xFF021B79),
              borderRadius:
                  BorderRadius.vertical(top: Radius.circular(28))),
          child: Column(children: [
            Row(children: [
              Expanded(
                  child: Text(widget.box.name,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold))),
              Text(widget.box.id,
                  style: TextStyle(
                      color: Colors.white.withOpacity(0.6),
                      fontSize: 12)),
            ]),
            const SizedBox(height: 4),
            if (parentBox != null)
              Align(
                alignment: Alignment.centerRight,
                child: Text('ضمن: ${parentBox.name}',
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.5),
                        fontSize: 12)),
              ),
            const SizedBox(height: 16),
            Text(
                '${isPositive ? "+" : ""}${_balance.totalInMain.toStringAsFixed(2)} $sym',
                style: TextStyle(
                    color: isPositive
                        ? Colors.greenAccent
                        : Colors.redAccent,
                    fontSize: 32,
                    fontWeight: FontWeight.bold)),
            Text('الرصيد الإجمالي بـ ${widget.mainCurrency}',
                style: TextStyle(
                    color: Colors.white.withOpacity(0.6),
                    fontSize: 11)),
          ]),
        ),
        // Body
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // الأرصدة حسب العملة
                  if (_balance.byCurrency.isNotEmpty) ...[
                    const Text('الأرصدة حسب العملة',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14)),
                    const SizedBox(height: 8),
                    ..._balance.byCurrency.entries.map((e) =>
                        _BalanceRow(
                            currency: e.key,
                            amount: e.value)),
                    const SizedBox(height: 16),
                  ],
                  // معلومات الصندوق
                  _infoCard(),
                  const SizedBox(height: 16),
                  // الأبناء
                  _childrenCard(),
                  const SizedBox(height: 16),
                  // الحسابات المرتبطة
                  _linkedAccountsCard(),
                  const SizedBox(height: 24),
                  // أزرار التحرير / الحذف
                  Row(children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.edit_outlined,
                            size: 18),
                        label: const Text('تعديل'),
                        onPressed: _openEdit,
                        style: OutlinedButton.styleFrom(
                            foregroundColor:
                                const Color(0xFF021B79),
                            side: const BorderSide(
                                color: Color(0xFF021B79)),
                            padding: const EdgeInsets.symmetric(
                                vertical: 12),
                            shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(12))),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.delete_outline,
                            color: Colors.white, size: 18),
                        label: const Text('حذف',
                            style: TextStyle(color: Colors.white)),
                        onPressed: _confirmDelete,
                        style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red,
                            padding: const EdgeInsets.symmetric(
                                vertical: 12),
                            shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(12))),
                      ),
                    ),
                  ]),
                ]),
          ),
        ),
      ]),
    );
  }

  Widget _infoCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(children: [
        _InfoRow('العملة',
            widget.box.hasCurrency ? widget.box.currency! : 'حرة'),
        const Divider(height: 16),
        _InfoRow(
            'سعر الصرف',
            widget.box.hasRate
                ? widget.box.exchangeRate!.toStringAsFixed(4)
                : 'حر'),
        const Divider(height: 16),
        _InfoRow('الحسابات المرتبطة',
            '${widget.box.linkedAccountIds.length} حساب'),
      ]),
    );
  }

  Widget _childrenCard() {
    final children = widget.allBoxes
        .where((b) => b.parentId == widget.box.id)
        .toList();
    if (children.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('الصناديق الفرعية (${children.length})',
          style: const TextStyle(
              fontWeight: FontWeight.bold, fontSize: 14)),
      const SizedBox(height: 8),
      ...children.map((c) => Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(10)),
            child: Row(children: [
              const Icon(Icons.account_balance_wallet_outlined,
                  size: 16, color: Color(0xFF021B79)),
              const SizedBox(width: 8),
              Expanded(
                  child: Text(c.name,
                      style: const TextStyle(fontSize: 13))),
              Text(c.id,
                  style: TextStyle(
                      fontSize: 11, color: Colors.grey.shade500)),
            ]),
          )),
    ]);
  }

  Widget _linkedAccountsCard() {
    if (widget.box.linkedAccountIds.isEmpty)
      return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('الحسابات المرتبطة (${widget.box.linkedAccountIds.length})',
          style: const TextStyle(
              fontWeight: FontWeight.bold, fontSize: 14)),
      const SizedBox(height: 8),
      ...widget.box.linkedAccountIds.map((id) => Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(10)),
            child: Row(children: [
              const Icon(Icons.person_outline,
                  size: 16, color: Colors.green),
              const SizedBox(width: 8),
              Text(id,
                  style: const TextStyle(fontSize: 13)),
            ]),
          )),
    ]);
  }

  void _openEdit() async {
    Navigator.pop(context);
    final boxes = await CashboxService.getBoxes();
    if (!mounted) return;
    await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(
            textDirection: ui.TextDirection.rtl,
            child: _AddEditBoxSheet(
                box: widget.box,
                allBoxes: boxes,
                onSaved: widget.onChanged)));
    widget.onChanged();
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => Directionality(
        textDirection: ui.TextDirection.rtl,
        child: AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(children: [
            Icon(Icons.warning_amber, color: Colors.orange),
            SizedBox(width: 8),
            Text('حذف الصندوق'),
          ]),
          content: Text(
              'هل تريد حذف "${widget.box.name}"؟\nسيتم فكّ ربط الصناديق الفرعية.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(_, false),
                child: const Text('إلغاء')),
            ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red),
                onPressed: () => Navigator.pop(_, true),
                child: const Text('احذف',
                    style: TextStyle(color: Colors.white))),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      await CashboxService.deleteBox(widget.box.id);
      if (mounted) Navigator.pop(context);
      widget.onChanged();
    }
  }
}

class _BalanceRow extends StatelessWidget {
  final String currency;
  final double amount;
  const _BalanceRow({required this.currency, required this.amount});
  @override
  Widget build(BuildContext context) {
    final isPos = amount >= 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
          color: isPos ? Colors.green.shade50 : Colors.red.shade50,
          borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        Text(currency,
            style: const TextStyle(
                fontWeight: FontWeight.bold, fontSize: 13)),
        const Spacer(),
        Text(
            '${isPos ? "+" : ""}${amount.toStringAsFixed(2)} ${_currSym(currency)}',
            style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: isPos
                    ? Colors.green.shade700
                    : Colors.red.shade700)),
      ]),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label, value;
  const _InfoRow(this.label, this.value);
  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Text(label,
          style: const TextStyle(
              color: Color(0xFF6B7280), fontSize: 13)),
      const Spacer(),
      Text(value,
          style: const TextStyle(
              fontWeight: FontWeight.w600, fontSize: 13)),
    ]);
  }
}

//  إضافة / تعديل صندوق 

class _AddEditBoxSheet extends StatefulWidget {
  final Cashbox? box; // null = جديد
  final List<Cashbox> allBoxes;
  final VoidCallback onSaved;

  const _AddEditBoxSheet({
    this.box,
    required this.allBoxes,
    required this.onSaved,
  });

  @override
  State<_AddEditBoxSheet> createState() => _AddEditBoxSheetState();
}

class _AddEditBoxSheetState extends State<_AddEditBoxSheet> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl, _rateCtrl;
  String? _parentId;
  String _currency = '';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final b = widget.box;
    _nameCtrl = TextEditingController(text: b?.name ?? '');
    _rateCtrl = TextEditingController(
        text: b?.exchangeRate?.toString() ?? '');
    _parentId = b?.parentId;
    _currency = b?.currency ?? '';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _rateCtrl.dispose();
    super.dispose();
  }

  /// الصناديق المتاحة كآباء (باستثناء الصندوق نفسه وأبنائه)
  List<Cashbox> get _availableParents {
    if (widget.box == null) return widget.allBoxes;
    final excluded = _descendants(widget.box!.id)..add(widget.box!.id);
    return widget.allBoxes
        .where((b) => !excluded.contains(b.id))
        .toList();
  }

  Set<String> _descendants(String boxId) {
    final result = <String>{};
    for (final b in widget.allBoxes) {
      if (b.parentId == boxId) {
        result.add(b.id);
        result.addAll(_descendants(b.id));
      }
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.box != null;
    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(
        padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Form(
          key: _formKey,
          child:
              Column(mainAxisSize: MainAxisSize.min, children: [
            // Handle
            Center(
                child: Container(
                    margin: const EdgeInsets.only(top: 10, bottom: 4),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2)))),
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 20, vertical: 10),
              child: Row(children: [
                Text(isEdit ? 'تعديل الصندوق' : 'صندوق جديد',
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold)),
                const Spacer(),
                const CloseButton(),
              ]),
            ),
            const Divider(height: 1),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(children: [
                  // اسم الصندوق
                  TextFormField(
                    controller: _nameCtrl,
                    textAlign: TextAlign.right,
                    decoration: _deco('اسم الصندوق *'),
                    validator: (v) =>
                        v!.trim().isEmpty ? 'الاسم مطلوب' : null,
                  ),
                  const SizedBox(height: 14),
                  // الصندوق الأب
                  DropdownButtonFormField<String?>(
                    value: _parentId,
                    decoration: _deco('الصندوق الأب (اختياري)'),
                    items: [
                      const DropdownMenuItem(
                          value: null, child: Text('— بدون أب (جذر) —')),
                      ..._availableParents.map((b) => DropdownMenuItem(
                            value: b.id,
                            child: Text('${b.id} — ${b.name}'),
                          )),
                    ],
                    onChanged: (v) => setState(() => _parentId = v),
                    isExpanded: true,
                  ),
                  const SizedBox(height: 14),
                  // العملة
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('العملة الرئيسية (اختياري)', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                    const SizedBox(height: 6),
                    Row(children: [
                      Expanded(
                        child: _currency.isEmpty
                          ? GestureDetector(
                              onTap: () => _pickCurrency(context),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                                decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(12), color: Colors.white),
                                child: Row(children: [
                                  Expanded(child: Text('حرة (غير محددة)', style: TextStyle(fontSize: 13, color: Colors.grey.shade500))),
                                  Icon(Icons.arrow_drop_down, color: Colors.grey.shade400),
                                ]),
                              ),
                            )
                          : GestureDetector(
                              onTap: () => _pickCurrency(context),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                                decoration: BoxDecoration(border: Border.all(color: const Color(0xFF021B79), width: 1.5), borderRadius: BorderRadius.circular(12), color: Colors.white),
                                child: Row(children: [
                                  Expanded(child: Text('$_currency  ${_currSym(_currency)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
                                  Icon(Icons.arrow_drop_down, color: Colors.grey.shade500),
                                ]),
                              ),
                            ),
                      ),
                      if (_currency.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => setState(() => _currency = ''),
                          child: Icon(Icons.close, color: Colors.grey.shade400, size: 20),
                        ),
                      ],
                    ]),
                  ]),
                  const SizedBox(height: 14),
                  // سعر الصرف
                  TextFormField(
                    controller: _rateCtrl,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    textAlign: TextAlign.right,
                    decoration: _deco('سعر الصرف (اختياري، فارغ = حر)'),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return null;
                      if (double.tryParse(v) == null) {
                        return 'أدخل رقمًا صحيحًا';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  // تلميح
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(12)),
                    child: const Text(
                      'إذا حددت عملة وسعر صرف — سيتم تثبيتهما في كل قيود الحسابات المرتبطة.\n'
                      'إذا حددت عملة فقط — يمكن تغيير سعر الصرف في القيد.\n'
                      'إذا تركتهما فارغَين — كل شيء حر.',
                      style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF1D4ED8),
                          height: 1.5),
                      textAlign: TextAlign.right,
                    ),
                  ),
                ]),
              ),
            ),
            // زر الحفظ
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _saving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF021B79),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14))),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : Text(isEdit ? 'حفظ التعديلات' : 'إنشاء الصندوق',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Future<void> _pickCurrency(BuildContext ctx) async {
    final result = await showModalBottomSheet<String>(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Directionality(
        textDirection: TextDirection.rtl,
        child: _CurrencySearchSheet(selected: _currency),
      ),
    );
    if (result != null && mounted) setState(() => _currency = result);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final rate = double.tryParse(_rateCtrl.text.trim());
      if (widget.box == null) {
        await CashboxService.addBox(
          name: _nameCtrl.text.trim(),
          parentId: _parentId,
          currency: _currency.isEmpty ? null : _currency,
          exchangeRate: rate,
        );
      } else {
        await CashboxService.updateBox(
          boxId: widget.box!.id,
          name: _nameCtrl.text.trim(),
          parentId: _parentId,
          currency: _currency.isEmpty ? null : _currency,
          exchangeRate: rate,
        );
      }
      if (mounted) {
        Navigator.pop(context);
        widget.onSaved();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('خطأ: $e'),
            backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

//  Widget: ربط حسابات بصندوق 
// يُستخدم داخل صفحة تفاصيل الصندوق ومن نموذج الحساب

/// يعرض قائمة الصناديق ويتيح ربط الحساب بها
/// يُستدعى من شاشة تعديل/إنشاء الحساب
class CashboxPickerWidget extends StatefulWidget {
  final String accountId;
  final List<Cashbox> allBoxes;
  final ValueChanged<List<String>> onChanged; // قائمة boxIds المختارة

  const CashboxPickerWidget({
    super.key,
    required this.accountId,
    required this.allBoxes,
    required this.onChanged,
  });

  @override
  State<CashboxPickerWidget> createState() => _CashboxPickerWidgetState();
}

class _CashboxPickerWidgetState extends State<CashboxPickerWidget> {
  late Set<String> _selected;

  @override
  void initState() {
    super.initState();
    _selected = widget.allBoxes
        .where((b) => b.linkedAccountIds.contains(widget.accountId))
        .map((b) => b.id)
        .toSet();
  }

  /// بناء قائمة الصناديق مرتّبة شجريًا (الجذور أولاً ثم الأبناء)
  List<_BoxPickerItem> _buildTree() {
    final items = <_BoxPickerItem>[];
    void addNode(String? parentId, int depth) {
      final nodes = widget.allBoxes
          .where((b) => b.parentId == parentId)
          .toList();
      for (final box in nodes) {
        items.add(_BoxPickerItem(box: box, depth: depth));
        addNode(box.id, depth + 1);
      }
    }
    addNode(null, 0);
    return items;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.allBoxes.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(12)),
        child: const Text('لا توجد صناديق — يمكنك إنشاء صناديق من قسم الصناديق',
            style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
            textAlign: TextAlign.center),
      );
    }
    final tree = _buildTree();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('ربط بصندوق (اختياري)',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      const SizedBox(height: 8),
      ...tree.map((item) {
        final box = item.box;
        final isChecked = _selected.contains(box.id);
        final hasChildren = widget.allBoxes.any((b) => b.parentId == box.id);
        return Padding(
          padding: EdgeInsets.only(right: item.depth * 16.0),
          child: CheckboxListTile(
            value: isChecked,
            title: Row(children: [
              if (hasChildren)
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Icon(Icons.account_tree_outlined,
                      size: 14, color: Colors.grey.shade500),
                ),
              Expanded(
                child: Text('${box.id} — ${box.name}',
                    style: const TextStyle(fontSize: 13)),
              ),
            ]),
            subtitle: Text(
                [
                  if (box.hasCurrency) 'عملة: ${box.currency}',
                  if (box.hasRate)
                    'صرف: ${box.exchangeRate!.toStringAsFixed(2)}',
                  if (hasChildren) 'صندوق أب',
                ].join(' | '),
                style: TextStyle(
                    fontSize: 11, color: Colors.grey.shade500)),
            activeColor: const Color(0xFF021B79),
            contentPadding: EdgeInsets.zero,
            dense: true,
            onChanged: (v) {
              setState(() {
                if (v == true)
                  _selected.add(box.id);
                else
                  _selected.remove(box.id);
              });
              widget.onChanged(_selected.toList());
            },
          ),
        );
      }),
    ]);
  }
}

class _BoxPickerItem {
  final Cashbox box;
  final int depth;
  const _BoxPickerItem({required this.box, required this.depth});
}

//  دالة مساعدة: Cashbox للحساب عند إنشاء قيد 

/// تُعيد معلومات الصندوق المقيّد لحساب معيّن أو null إذا لم يكن مقيّدًا
/// إذا كان الحساب مرتبطًا بأكثر من صندوق مقيّد → يجب السؤال
CashboxConstraint? resolveCashboxConstraint(
    String accountId, List<Cashbox> allBoxes) {
  final boxes = CashboxService.boxesForAccount(allBoxes, accountId);
  if (boxes.isEmpty) return null;

  // إذا كان ربط واحد فقط
  if (boxes.length == 1) {
    return _constraintFromBox(boxes.first);
  }

  // أكثر من صندوق — نعيد null ويتولى الـ UI السؤال
  return null;
}

CashboxConstraint _constraintFromBox(Cashbox box) => CashboxConstraint(
      boxId: box.id,
      boxName: box.name,
      currency: box.hasCurrency ? box.currency : null,
      exchangeRate: box.hasRate ? box.exchangeRate : null,
      currencyLocked: box.hasCurrency,
      rateLocked: box.hasCurrency && box.hasRate,
    );

/// تُعيد قائمة بالقيود لكل صندوق مرتبط بحساب (للاختيار منها)
List<CashboxConstraint> listConstraintsForAccount(
    String accountId, List<Cashbox> allBoxes) {
  return CashboxService.boxesForAccount(allBoxes, accountId)
      .map((b) => _constraintFromBox(b))
      .toList();
}

class CashboxConstraint {
  final String boxId;
  final String boxName;
  final String? currency;
  final double? exchangeRate;
  final bool currencyLocked;
  final bool rateLocked;

  const CashboxConstraint({
    required this.boxId,
    required this.boxName,
    this.currency,
    this.exchangeRate,
    required this.currencyLocked,
    required this.rateLocked,
  });
}

//  Widget: Cashbox Selector في نموذج القيد 

/// يُعرض داخل _buildRow لاختيار الصندوق عندما يرتبط الحساب بأكثر من صندوق
class CashboxSelectorWidget extends StatelessWidget {
  final List<CashboxConstraint> constraints;
  final String? selectedBoxId;
  final ValueChanged<CashboxConstraint?> onSelected;

  const CashboxSelectorWidget({
    super.key,
    required this.constraints,
    this.selectedBoxId,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (constraints.isEmpty) return const SizedBox.shrink();
    return DropdownButtonFormField<String>(
      value: selectedBoxId,
      decoration: InputDecoration(
        labelText: 'الصندوق',
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        isDense: true,
      ),
      items: [
        const DropdownMenuItem(value: null, child: Text('— بدون صندوق —')),
        ...constraints.map((c) => DropdownMenuItem(
              value: c.boxId,
              child: Text('${c.boxName}'
                  '${c.currency != null ? " (${c.currency})" : ""}'
                  '${c.exchangeRate != null ? " @${c.exchangeRate!.toStringAsFixed(2)}" : ""}'),
            )),
      ],
      onChanged: (v) {
        if (v == null) {
          onSelected(null);
        } else {
          onSelected(constraints.firstWhere((c) => c.boxId == v));
        }
      },
      isExpanded: true,
    );
  }
}

//  ربط أرصدة الصناديق بالرصيد الإجمالي 

/// تُحسب ضمن DataService.getTotalBalanceUSD()
/// لا تعدّل على أرصدة العمليات — الأرصدة تُحسب من العمليات المرتبطة
/// فقط نضمن أن رصيد كل صندوق يُحسب بسعر صرفه عند الحاجة
double computeTotalWithBoxes({
  required List<dynamic> allOps,
  required List<Cashbox> allBoxes,
}) {
  // الطريقة الأبسط: الرصيد الكلي = مجموع amountUSD لكل العمليات
  // (لا تغيير — سعر الصرف موجود في كل قيد مباشرة)
  double total = 0;
  for (final op in allOps) {
    total += op.amountUSD as double;
  }
  return total;
}

//  مساعدات داخلية 

InputDecoration _deco(String label) => InputDecoration(
      labelText: label,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      isDense: true,
    );

String _currSym(String currency) {
  const map = {
    'USD': '\$',
    'EUR': '€',
    'ILS': '₪',
    'JOD': 'د.أ',
    'SAR': 'ر.س',
    'AED': 'د.إ',
    'EGP': 'ج.م',
    'GBP': '£',
    'TRY': '₺',
    'USDT': '₮',
    'BTC': '₿',
    'LBP': 'ل.ل',
    'SYP': 'ل.س',
    'YER': 'ر.ي',
    'KWD': 'د.ك',
    'QAR': 'ر.ق',
    'OMR': 'ر.ع',
    'BHD': 'د.ب',
    'DZD': 'د.ج',
    'MAD': 'د.م',
    'TND': 'د.ت',
    'SDG': 'ج.س',
    'LYD': 'د.ل',
    'IQD': 'د.ع',
    'MRU': 'أ.م',
    'SOS': 'ش.ص',
    'DJF': 'ف.ج',
    'KMF': 'ف.ق',
  };
  return map[currency] ?? currency;
}

List<String> _currencies() => [
      'USD', 'EUR', 'ILS', 'JOD', 'SAR', 'AED', 'EGP',
      'GBP', 'TRY', 'USDT', 'BTC', 'LBP', 'SYP', 'YER',
      'KWD', 'QAR', 'OMR', 'BHD', 'DZD', 'MAD', 'TND',
      'SDG', 'LYD', 'IQD', 'MRU', 'SOS', 'DJF', 'KMF',
    ];

// ── منتقي العملة مع بحث (Cashboxes) ───────────────────────────────
class _CurrencySearchSheet extends StatefulWidget {
  final String selected;
  const _CurrencySearchSheet({required this.selected});
  @override
  State<_CurrencySearchSheet> createState() => _CurrencySearchSheetState();
}

class _CurrencySearchSheetState extends State<_CurrencySearchSheet> {
  final _ctrl = TextEditingController();
  List<String> _filtered = [];

  static const Map<String, String> _names = {
    'USD': 'دولار أمريكي', 'EUR': 'يورو', 'GBP': 'جنيه إسترليني',
    'ILS': 'شيكل إسرائيلي', 'JOD': 'دينار أردني', 'SAR': 'ريال سعودي',
    'AED': 'درهم إماراتي', 'KWD': 'دينار كويتي', 'BHD': 'دينار بحريني',
    'OMR': 'ريال عُماني', 'QAR': 'ريال قطري', 'EGP': 'جنيه مصري',
    'LBP': 'ليرة لبنانية', 'SYP': 'ليرة سورية', 'IQD': 'دينار عراقي',
    'YER': 'ريال يمني', 'LYD': 'دينار ليبي', 'TND': 'دينار تونسي',
    'DZD': 'دينار جزائري', 'MAD': 'درهم مغربي', 'TRY': 'ليرة تركية',
    'JPY': 'ين ياباني', 'CNY': 'يوان صيني', 'CHF': 'فرنك سويسري',
    'CAD': 'دولار كندي', 'AUD': 'دولار أسترالي', 'INR': 'روبية هندية',
    'RUB': 'روبل روسي', 'BRL': 'ريال برازيلي', 'ZAR': 'راند جنوب أفريقي',
    'USDT': 'تيثر', 'BTC': 'بيتكوين', 'ETH': 'إيثريوم',
  };

  @override
  void initState() {
    super.initState();
    _filtered = _names.keys.toList();
    _ctrl.addListener(() {
      final q = _ctrl.text.toLowerCase();
      setState(() {
        _filtered = _names.keys.where((c) {
          return c.toLowerCase().contains(q) ||
              (_names[c] ?? '').toLowerCase().contains(q);
        }).toList();
      });
    });
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Column(children: [
        Center(child: Container(margin: const EdgeInsets.only(top: 10, bottom: 8), width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(children: [Expanded(child: Text('اختر العملة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold))), CloseButton()]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            controller: _ctrl,
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              hintText: 'بحث',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              filled: true, fillColor: Colors.grey.shade50,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            itemCount: _filtered.length,
            itemBuilder: (_, i) {
              final c = _filtered[i];
              final name = _names[c] ?? c;
              final sym = _currSym(c);
              final isSelected = c == widget.selected;
              return ListTile(
                dense: true,
                selected: isSelected,
                selectedTileColor: const Color(0xFF021B79).withOpacity(0.07),
                leading: Container(width: 44, height: 36, decoration: BoxDecoration(color: const Color(0xFF021B79).withOpacity(0.08), borderRadius: BorderRadius.circular(8)), child: Center(child: Text(c, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF021B79))))),
                title: Text(name, style: TextStyle(fontSize: 13, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
                trailing: Text(sym, style: TextStyle(fontSize: 14, color: isSelected ? const Color(0xFF021B79) : Colors.grey.shade600, fontWeight: FontWeight.bold)),
                onTap: () => Navigator.pop(context, c),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
      ]),
    );
  }
}
