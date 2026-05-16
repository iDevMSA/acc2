// ============================================================
// lib/main.dart — نظام المحاسبة المتكامل
// Firebase Realtime Database + Local Storage + Offline Sync
// + نظام الاشتراكات الشهرية والسنوية
// ============================================================

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:ui' as ui;

import 'firebase_options.dart';
import 'welcome.dart';
import 'services/sync_service.dart';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

// ─────────────────────────────────────────────
// 🔔 ValueNotifiers العالمية
// ─────────────────────────────────────────────
final ValueNotifier<List<Account>> accountsNotifier =
    ValueNotifier<List<Account>>([]);
final ValueNotifier<List<Operation>> operationsNotifier =
    ValueNotifier<List<Operation>>([]);
final ValueNotifier<double> balanceNotifier = ValueNotifier<double>(0.0);
final ValueNotifier<CompanyInfo> companyNotifier =
    ValueNotifier<CompanyInfo>(const CompanyInfo(name: 'شركتي'));
final ValueNotifier<SubscriptionInfo> subscriptionNotifier =
    ValueNotifier<SubscriptionInfo>(const SubscriptionInfo());

// ─────────────────────────────────────────────
// 💎 نموذج الاشتراك
// ─────────────────────────────────────────────
enum PlanType { free, monthly, yearly, lifetime }

class SubscriptionInfo {
  final PlanType plan;
  final DateTime? expiresAt;
  final bool lifetimeGranted;

  const SubscriptionInfo({
    this.plan = PlanType.free,
    this.expiresAt,
    this.lifetimeGranted = false,
  });

  bool get isActive {
    if (plan == PlanType.free || plan == PlanType.lifetime) return true;
    if (expiresAt == null) return true;
    return expiresAt!.isAfter(DateTime.now());
  }

  bool get isPaid => plan != PlanType.free;

  int get daysLeft {
    if (expiresAt == null) return -1;
    return expiresAt!.difference(DateTime.now()).inDays;
  }

  // حدود الخطة المجانية
  static const int freeMaxAccounts = 15;
  static const int freeMaxOperations = 100;

  bool canAddAccount(int currentCount) {
    if (plan != PlanType.free || !isActive) return isActive ? true : false;
    return currentCount < freeMaxAccounts;
  }

  bool canAddOperation(int currentCount) {
    if (plan != PlanType.free) return isActive;
    if (!isActive) return false;
    return currentCount < freeMaxOperations;
  }

  String get planName => switch (plan) {
        PlanType.free => 'مجاني',
        PlanType.monthly => 'شهري',
        PlanType.yearly => 'سنوي',
        PlanType.lifetime => 'مدى الحياة',
      };

  factory SubscriptionInfo.fromJson(Map<String, dynamic> j) {
    PlanType plan = PlanType.free;
    switch (j['plan'] ?? 'free') {
      case 'monthly': plan = PlanType.monthly; break;
      case 'yearly': plan = PlanType.yearly; break;
      case 'lifetime': plan = PlanType.lifetime; break;
      default: plan = PlanType.free;
    }
    return SubscriptionInfo(
      plan: plan,
      expiresAt: j['expiresAt'] != null
          ? DateTime.tryParse(j['expiresAt'])
          : null,
      lifetimeGranted: j['lifetimeGranted'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'plan': plan.name,
        if (expiresAt != null) 'expiresAt': expiresAt!.toIso8601String(),
        'lifetimeGranted': lifetimeGranted,
      };
}

// ─────────────────────────────────────────────
// 🏢 نموذج معلومات الشركة
// ─────────────────────────────────────────────
class CompanyInfo {
  final String name;
  final String phone;
  final String address;
  final String email;

  const CompanyInfo({
    required this.name,
    this.phone = '',
    this.address = '',
    this.email = '',
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'phone': phone,
        'address': address,
        'email': email,
      };

  factory CompanyInfo.fromJson(Map<String, dynamic> j) => CompanyInfo(
        name: j['name'] ?? 'شركتي',
        phone: j['phone'] ?? '',
        address: j['address'] ?? '',
        email: j['email'] ?? '',
      );

  CompanyInfo copyWith({String? name, String? phone, String? address, String? email}) =>
      CompanyInfo(
        name: name ?? this.name,
        phone: phone ?? this.phone,
        address: address ?? this.address,
        email: email ?? this.email,
      );
}

// ─────────────────────────────────────────────
// 🏦 نموذج الحساب
// ─────────────────────────────────────────────
class Account {
  final String id;
  final String name;
  final String phone;
  final String address;
  final String type;
  final DateTime createdAt;

  const Account({
    required this.id,
    required this.name,
    this.phone = '',
    this.address = '',
    this.type = 'cash',
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'address': address,
        'type': type,
        'createdAt': createdAt.toIso8601String(),
      };

  factory Account.fromJson(Map<String, dynamic> j) => Account(
        id: j['id'] ?? '',
        name: j['name'] ?? '',
        phone: j['phone'] ?? '',
        address: j['address'] ?? '',
        type: j['type'] ?? 'cash',
        createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
      );
}

// ─────────────────────────────────────────────
// 📝 نموذج القيد / العملية
// ─────────────────────────────────────────────
class Operation {
  final String id;
  final String accountId;
  final double amount;
  final double exchangeRate;
  final String currency;
  final double amountUSD;
  final String statement;
  final DateTime date;

  const Operation({
    required this.id,
    required this.accountId,
    required this.amount,
    required this.exchangeRate,
    required this.currency,
    required this.amountUSD,
    this.statement = '',
    required this.date,
  });

  bool get isCredit => amount >= 0;
  bool get isDebit => amount < 0;

  Map<String, dynamic> toJson() => {
        'id': id,
        'accountId': accountId,
        'amount': amount,
        'exchangeRate': exchangeRate,
        'currency': currency,
        'amountUSD': amountUSD,
        'statement': statement,
        'date': date.toIso8601String(),
      };

  factory Operation.fromJson(Map<String, dynamic> j) => Operation(
        id: j['id'] ?? '',
        accountId: j['accountId'] ?? '',
        amount: (j['amount'] ?? 0.0).toDouble(),
        exchangeRate: (j['exchangeRate'] ?? 1.0).toDouble(),
        currency: j['currency'] ?? 'USD',
        amountUSD: (j['amountUSD'] ?? 0.0).toDouble(),
        statement: j['statement'] ?? '',
        date: DateTime.tryParse(j['date'] ?? '') ?? DateTime.now(),
      );
}

// ─────────────────────────────────────────────
// 🧮 ملخص الحساب
// ─────────────────────────────────────────────
class AccountSummary {
  final double totalUSD;
  final Map<String, double> balanceByCurrency;
  const AccountSummary({required this.totalUSD, required this.balanceByCurrency});
}

// ─────────────────────────────────────────────
// 💾 خدمة البيانات المركزية
// ─────────────────────────────────────────────
class DataService {
  static const String _accountsKey = 'local_accounts';
  static const String _opsKey = 'local_operations';
  static const String _mainCurrencyKey = 'main_currency';
  static const String _pendingKey = 'pending_sync';
  static const String _companyKey = 'company_info';
  static const String _subscriptionKey = 'subscription';

  static DatabaseReference _userRef(String uid) =>
      FirebaseDatabase.instance.ref('users/$uid');
  static DatabaseReference _accountsRef(String uid) =>
      _userRef(uid).child('accounts');
  static DatabaseReference _opsRef(String uid) =>
      _userRef(uid).child('operations');

  static String get _prefix {
    final uid = FirebaseAuth.instance.currentUser?.uid ?? 'guest';
    return '${uid}_';
  }

  static Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  // ══════════════════════════════════════════
  // 💎 الاشتراك
  // ══════════════════════════════════════════
  static Future<SubscriptionInfo> getSubscription() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return const SubscriptionInfo();
    try {
      final snap = await _userRef(user.uid).child('subscription').get();
      if (snap.exists && snap.value != null) {
        final data = Map<String, dynamic>.from(snap.value as Map);
        final sub = SubscriptionInfo.fromJson(data);
        subscriptionNotifier.value = sub;
        return sub;
      }
    } catch (e) {
      debugPrint('خطأ جلب الاشتراك: $e');
    }
    return const SubscriptionInfo();
  }

  static SubscriptionInfo get currentSubscription => subscriptionNotifier.value;

  // مراقبة الاشتراك في الوقت الفعلي
  static StreamSubscription? _subListener;
  static void listenToSubscription() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    _subListener?.cancel();
    _subListener = _userRef(user.uid).child('subscription').onValue.listen((event) {
      if (event.snapshot.exists && event.snapshot.value != null) {
        final data = Map<String, dynamic>.from(event.snapshot.value as Map);
        final sub = SubscriptionInfo.fromJson(data);
        subscriptionNotifier.value = sub;
        // تحقق من انتهاء الاشتراك
        if (!sub.isActive && sub.plan != PlanType.free) {
          subscriptionNotifier.value = const SubscriptionInfo(plan: PlanType.free);
        }
      }
    });
  }

  static void disposeSubscriptionListener() => _subListener?.cancel();

  // ══════════════════════════════════════════
  // 🔑 تهيئة Firebase
  // ══════════════════════════════════════════
  static Future<void> initUserInFirebaseWithCompany({
    required String uid,
    required String email,
    CompanyInfo? companyInfo,
  }) async {
    final ref = FirebaseDatabase.instance.ref('users/$uid');
    final snapshot = await ref.get();
    if (!snapshot.exists) {
      await ref.set({
        'uid': uid,
        'email': email,
        'createdAt': DateTime.now().toIso8601String(),
        'accounts': {},
        'operations': {},
        'companyInfo': companyInfo?.toJson() ?? const CompanyInfo(name: 'شركتي').toJson(),
        'subscription': const SubscriptionInfo().toJson(),
      });
    }
    if (companyInfo != null) {
      final p = await SharedPreferences.getInstance();
      await p.setString('${uid}_$_companyKey', jsonEncode(companyInfo.toJson()));
    }
    unawaited(_pushPendingToFirebase());
  }

  static Future<void> initUserInFirebase({CompanyInfo? companyInfo}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final snapshot = await _userRef(user.uid).get();
    if (!snapshot.exists) {
      await _userRef(user.uid).set({
        'uid': user.uid,
        'email': user.email ?? '',
        'createdAt': DateTime.now().toIso8601String(),
        'accounts': {},
        'operations': {},
        'companyInfo': companyInfo?.toJson() ?? const CompanyInfo(name: 'شركتي').toJson(),
        'subscription': const SubscriptionInfo().toJson(),
      });
    } else {
      await syncCompanyFromCloud();
    }
    unawaited(_pushPendingToFirebase());
  }

  // ══════════════════════════════════════════
  // 🏢 معلومات الشركة
  // ══════════════════════════════════════════
  static Future<CompanyInfo> getCompanyInfo() async {
    final p = await _prefs;
    final raw = p.getString('$_prefix$_companyKey');
    if (raw == null) return const CompanyInfo(name: 'شركتي');
    try {
      final info = CompanyInfo.fromJson(jsonDecode(raw));
      companyNotifier.value = info;
      return info;
    } catch (_) {
      return const CompanyInfo(name: 'شركتي');
    }
  }

  static Future<void> saveCompanyInfo(CompanyInfo info) async {
    final p = await _prefs;
    await p.setString('$_prefix$_companyKey', jsonEncode(info.toJson()));
    companyNotifier.value = info;
    final user = FirebaseAuth.instance.currentUser;
    if (user != null && await _isOnline()) {
      await _userRef(user.uid).update({'companyInfo': info.toJson()});
    }
  }

  static Future<void> syncCompanyFromCloud() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    try {
      final snapshot = await _userRef(user.uid).get();
      if (snapshot.exists) {
        final data = snapshot.child('companyInfo').value;
        if (data is Map) {
          final info = CompanyInfo.fromJson(Map<String, dynamic>.from(data));
          final p = await _prefs;
          await p.setString('$_prefix$_companyKey', jsonEncode(info.toJson()));
          companyNotifier.value = info;
        }
      }
    } catch (e) {
      debugPrint('خطأ مزامنة الشركة: $e');
    }
  }

  // ══════════════════════════════════════════
  // 🌐 العملة الرئيسية
  // ══════════════════════════════════════════
  static Future<String> getMainCurrency() async {
    final p = await _prefs;
    return p.getString('$_prefix$_mainCurrencyKey') ?? 'USD';
  }

  static Future<void> setMainCurrency(String currency) async {
    final p = await _prefs;
    await p.setString('$_prefix$_mainCurrencyKey', currency);
  }

  // ══════════════════════════════════════════
  // 🏦 الحسابات
  // ══════════════════════════════════════════
  static Future<List<Account>> getAccounts() async {
    final p = await _prefs;
    final raw = p.getString('$_prefix$_accountsKey');
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      final accounts = list.map((j) => Account.fromJson(j)).toList();
      accountsNotifier.value = List.from(accounts);
      return accounts;
    } catch (e) { return []; }
  }

  static Future<void> _saveAccountsLocally(List<Account> accounts) async {
    final p = await _prefs;
    await p.setString('$_prefix$_accountsKey',
        jsonEncode(accounts.map((a) => a.toJson()).toList()));
    accountsNotifier.value = List.from(accounts);
  }

  static Future<String> _nextAccountId() async {
    final accounts = await getAccounts();
    if (accounts.isEmpty) return '0001';
    int max = 0;
    for (final a in accounts) {
      final n = int.tryParse(a.id) ?? 0;
      if (n > max) max = n;
    }
    return (max + 1).toString().padLeft(4, '0');
  }

  /// يرجع null إذا نجح، أو رسالة خطأ إذا وصل الحد
  static Future<String?> canAddAccount() async {
    final sub = subscriptionNotifier.value;
    if (!sub.isActive) return 'انتهى اشتراكك، يرجى التجديد';
    if (sub.plan == PlanType.free) {
      final accounts = await getAccounts();
      if (accounts.length >= SubscriptionInfo.freeMaxAccounts) {
        return 'وصلت للحد الأقصى في الخطة المجانية (${SubscriptionInfo.freeMaxAccounts} حساب)';
      }
    }
    return null;
  }

  static Future<String?> canAddOperation() async {
    final sub = subscriptionNotifier.value;
    if (!sub.isActive) return 'انتهى اشتراكك، يرجى التجديد';
    if (sub.plan == PlanType.free) {
      final ops = await getOperations();
      if (ops.length >= SubscriptionInfo.freeMaxOperations) {
        return 'وصلت للحد الأقصى في الخطة المجانية (${SubscriptionInfo.freeMaxOperations} قيد)';
      }
    }
    return null;
  }

  static Future<Account> addAccount({
    required String name,
    String phone = '',
    String address = '',
    String type = 'cash',
  }) async {
    final id = await _nextAccountId();
    final account = Account(id: id, name: name, phone: phone,
        address: address, type: type, createdAt: DateTime.now());
    final accounts = await getAccounts();
    accounts.add(account);
    await _saveAccountsLocally(accounts);
    await _addPending('account', 'create', id, account.toJson());
    unawaited(_pushPendingToFirebase());
    return account;
  }

  static Future<void> updateAccount({
    required String accountId, required String name,
    String phone = '', String address = '', String type = 'cash',
  }) async {
    final accounts = await getAccounts();
    final idx = accounts.indexWhere((a) => a.id == accountId);
    if (idx == -1) return;
    final updated = Account(id: accountId, name: name, phone: phone,
        address: address, type: type, createdAt: accounts[idx].createdAt);
    accounts[idx] = updated;
    await _saveAccountsLocally(accounts);
    await _addPending('account', 'create', accountId, updated.toJson());
    unawaited(_pushPendingToFirebase());
  }

  static Future<void> deleteAccount(String accountId) async {
    final accounts = await getAccounts();
    accounts.removeWhere((a) => a.id == accountId);
    await _saveAccountsLocally(accounts);
    final ops = await getOperations();
    await _saveOperationsLocally(ops.where((o) => o.accountId != accountId).toList());
    await _addPending('account', 'delete', accountId, {'id': accountId});
    unawaited(_pushPendingToFirebase());
  }

  // ══════════════════════════════════════════
  // 📝 القيود / العمليات
  // ══════════════════════════════════════════
  static Future<List<Operation>> getOperations() async {
    final p = await _prefs;
    final raw = p.getString('$_prefix$_opsKey');
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      final ops = list.map((j) => Operation.fromJson(j)).toList();
      operationsNotifier.value = List.from(ops);
      return ops;
    } catch (e) { return []; }
  }

  static Future<void> _saveOperationsLocally(List<Operation> ops) async {
    final p = await _prefs;
    await p.setString('$_prefix$_opsKey',
        jsonEncode(ops.map((o) => o.toJson()).toList()));
    operationsNotifier.value = List.from(ops);
  }

  static Future<Operation> addOperation({
    required String accountId, required double amount,
    required double exchangeRate, required String currency, String statement = '',
  }) async {
    final amountUSD = exchangeRate != 0
        ? double.parse((amount / exchangeRate).toStringAsFixed(6)) : 0.0;
    final id = '${DateTime.now().millisecondsSinceEpoch}_$accountId';
    final op = Operation(id: id, accountId: accountId, amount: amount,
        exchangeRate: exchangeRate, currency: currency,
        amountUSD: amountUSD, statement: statement, date: DateTime.now());
    final ops = await getOperations();
    ops.add(op);
    await _saveOperationsLocally(ops);
    await _updateBalanceNotifier();
    await _addPending('operation', 'create', id, op.toJson());
    unawaited(_pushPendingToFirebase());
    return op;
  }

  static Future<void> updateOperation({
    required String opId, required double amount,
    required double exchangeRate, required String currency, required String statement,
  }) async {
    final ops = await getOperations();
    final idx = ops.indexWhere((o) => o.id == opId);
    if (idx == -1) return;
    final amountUSD = exchangeRate != 0
        ? double.parse((amount / exchangeRate).toStringAsFixed(6)) : 0.0;
    final updated = Operation(id: opId, accountId: ops[idx].accountId,
        amount: amount, exchangeRate: exchangeRate, currency: currency,
        amountUSD: amountUSD, statement: statement, date: ops[idx].date);
    ops[idx] = updated;
    await _saveOperationsLocally(ops);
    await _updateBalanceNotifier();
    await _addPending('operation', 'create', opId, updated.toJson());
    unawaited(_pushPendingToFirebase());
  }

  static Future<void> deleteOperation(String opId) async {
    final ops = await getOperations();
    ops.removeWhere((o) => o.id == opId);
    await _saveOperationsLocally(ops);
    await _updateBalanceNotifier();
    await _addPending('operation', 'delete', opId, {'id': opId});
    unawaited(_pushPendingToFirebase());
  }

  static Future<AccountSummary> getAccountSummary(String accountId) async {
    final ops = (await getOperations()).where((o) => o.accountId == accountId);
    double totalUSD = 0.0;
    final Map<String, double> byCurrency = {};
    for (final op in ops) {
      totalUSD += op.amountUSD;
      byCurrency[op.currency] = (byCurrency[op.currency] ?? 0.0) + op.amount;
    }
    return AccountSummary(totalUSD: double.parse(totalUSD.toStringAsFixed(6)),
        balanceByCurrency: byCurrency);
  }

  static Future<double> getTotalBalanceUSD() async {
    final ops = await getOperations();
    double total = 0;
    for (final op in ops) {
      total += op.amountUSD;
    }
    return double.parse(total.toStringAsFixed(6));
  }

  static Future<void> _updateBalanceNotifier() async {
    balanceNotifier.value = await getTotalBalanceUSD();
  }

  // ══════════════════════════════════════════
  // 🔄 Pending Sync
  // ══════════════════════════════════════════
  static Future<List<Map<String, dynamic>>> _getPending() async {
    final p = await _prefs;
    final raw = p.getString('$_prefix$_pendingKey');
    if (raw == null) return [];
    try { return List<Map<String, dynamic>>.from(jsonDecode(raw)); }
    catch (_) { return []; }
  }

  static Future<void> _savePending(List<Map<String, dynamic>> pending) async {
    final p = await _prefs;
    await p.setString('$_prefix$_pendingKey', jsonEncode(pending));
  }

  static Future<void> _addPending(String entity, String action, String id,
      Map<String, dynamic> data) async {
    final pending = await _getPending();
    pending.removeWhere((p) => p['id'] == id && p['entity'] == entity);
    pending.add({'entity': entity, 'action': action, 'id': id,
        'data': data, 'ts': DateTime.now().toIso8601String()});
    await _savePending(pending);
  }

  static Future<void> _pushPendingToFirebase() async {
    if (!await _isOnline()) return;
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final pending = await _getPending();
    if (pending.isEmpty) return;
    final succeeded = <String>[];
    for (final item in pending) {
      try {
        final entity = item['entity'] as String;
        final action = item['action'] as String;
        final id = item['id'] as String;
        final data = item['data'] as Map<String, dynamic>;
        final ref = entity == 'account'
            ? _accountsRef(user.uid).child(id) : _opsRef(user.uid).child(id);
        if (action == 'create') {
          await ref.set(data);
        } else if (action == 'delete') await ref.remove();
        succeeded.add('${entity}_$id');
      } catch (e) { debugPrint('❌ فشل مزامنة: ${item['id']} — $e'); }
    }
    if (succeeded.isNotEmpty) {
      final remaining = pending
          .where((p) => !succeeded.contains('${p['entity']}_${p['id']}'))
          .toList();
      await _savePending(remaining);
    }
  }

  static Future<bool> _isOnline() async {
    try {
      if (kIsWeb) return true;
      final result = await InternetAddress.lookup('google.com')
          .timeout(const Duration(seconds: 3));
      return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
    } catch (_) { return false; }
  }

  static Future<void> syncNow() => _pushPendingToFirebase();
  static Future<int> pendingCount() async => (await _getPending()).length;

  static Future<void> clearAll() async {
    final p = await _prefs;
    await p.remove('$_prefix$_accountsKey');
    await p.remove('$_prefix$_opsKey');
    await p.remove('$_prefix$_pendingKey');
    accountsNotifier.value = [];
    operationsNotifier.value = [];
    balanceNotifier.value = 0.0;
  }
}

// ─────────────────────────────────────────────
// 🚀 نقطة الدخول
// ─────────────────────────────────────────────
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await initializeDateFormatting('ar');
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'منصتي المحاسبية',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFF021B79),
        colorScheme: const ColorScheme.light(
            primary: Color(0xFF021B79), secondary: Color(0xFF0575E6)),
        useMaterial3: true,
        fontFamily: 'Cairo',
      ),
      home: const _AuthWrapper(),
    );
  }
}

class _AuthWrapper extends StatelessWidget {
  const _AuthWrapper();
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(
              child: CircularProgressIndicator(color: Color(0xFF021B79))));
        }
        if (snapshot.data != null) return const MainScreen();
        return const WelcomeScreen();
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 🏠 الشاشة الرئيسية
// ═══════════════════════════════════════════════════════════
class MainScreen extends StatefulWidget {
  const MainScreen({super.key});
  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _selectedIndex = 0;
  Timer? _syncTimer;
  Timer? _subCheckTimer;
  bool _ready = false;
  String _loadingText = 'جاري الاتصال...';

  @override
  void initState() {
    super.initState();
    _init();
    _syncTimer = Timer.periodic(const Duration(minutes: 1), (_) => DataService.syncNow());
    // فحص الاشتراك كل 30 دقيقة
    _subCheckTimer = Timer.periodic(const Duration(minutes: 30), (_) async {
      await DataService.getSubscription();
      _checkSubscriptionWarnings();
    });
  }

  Future<void> _init() async {
    _setStatus('جاري تهيئة حسابك...');
    await DataService.initUserInFirebase();
    _setStatus('جاري جلب البيانات من السحابة...');
    await SyncService().syncFromCloud();
    _setStatus('جاري تحميل الحسابات...');
    await DataService.getAccounts();
    _setStatus('جاري تحميل القيود...');
    await DataService.getOperations();
    _setStatus('جاري تحميل معلومات الشركة...');
    await DataService.getCompanyInfo();
    _setStatus('جاري التحقق من الاشتراك...');
    await DataService.getSubscription();
    DataService.listenToSubscription();
    _setStatus('جاري حساب الأرصدة...');
    balanceNotifier.value = await DataService.getTotalBalanceUSD();
    if (mounted) {
      setState(() => _ready = true);
      // تحقق من تحذيرات الاشتراك بعد التحميل
      Future.delayed(const Duration(seconds: 2), _checkSubscriptionWarnings);
    }
  }

  void _checkSubscriptionWarnings() {
    final sub = subscriptionNotifier.value;
    if (!mounted) return;
    if (sub.plan == PlanType.free) return;
    if (sub.plan == PlanType.lifetime) return;
    if (sub.expiresAt == null) return;
    final days = sub.daysLeft;
    if (days < 0 && mounted) {
      // انتهى الاشتراك
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => _SubscriptionExpiredDialog(),
      );
    } else if ((days == 7 || days == 3 || days == 1) && mounted) {
      // تحذير قرب الانتهاء
      _snack(context, '⚠️ اشتراكك ينتهي خلال $days يوم! يرجى التجديد.');
    }
  }

  void _setStatus(String text) {
    if (mounted) setState(() => _loadingText = text);
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    _subCheckTimer?.cancel();
    DataService.disposeSubscriptionListener();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) return _LoadingScreen(message: _loadingText);
    final screens = [
      const _HomeTab(),
      const _AccountsTab(),
      const _ReportsTab(),
      const _SettingsTab(),
    ];
    return Scaffold(
      body: screens[_selectedIndex],
      bottomNavigationBar: _BottomNav(
        selectedIndex: _selectedIndex,
        onTap: (i) => setState(() => _selectedIndex = i),
      ),
    );
  }
}

// ─────────────────────────────────────────────
// ⏳ شاشة التحميل
// ─────────────────────────────────────────────
class _LoadingScreen extends StatefulWidget {
  final String message;
  const _LoadingScreen({required this.message});
  @override
  State<_LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<_LoadingScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fade;
  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600))
      ..repeat(reverse: true);
    _fade = Tween(begin: 0.5, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }
  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Text('منصتي المحاسبية', style: TextStyle(color: Colors.white,
              fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 48),
          const SizedBox(width: 52, height: 52,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3)),
          const SizedBox(height: 32),
          FadeTransition(opacity: _fade, child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 400),
            transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
            child: Text(widget.message, key: ValueKey(widget.message),
                style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 15),
                textAlign: TextAlign.center),
          )),
        ])),
      ),
    );
  }
}

// ─────────────────────────────────────────────
// 🧭 شريط التنقل السفلي
// ─────────────────────────────────────────────
class _BottomNav extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;
  const _BottomNav({required this.selectedIndex, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      height: 70,
      decoration: BoxDecoration(color: Colors.white,
          borderRadius: BorderRadius.circular(35),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08),
              blurRadius: 15, offset: const Offset(0, 2))]),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(35),
        child: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: const Color(0xFF021B79),
          unselectedItemColor: Colors.grey.shade500,
          selectedFontSize: 12, unselectedFontSize: 12,
          currentIndex: selectedIndex, onTap: onTap, elevation: 0,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined),
                activeIcon: Icon(Icons.dashboard), label: 'الرئيسية'),
            BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_outlined),
                activeIcon: Icon(Icons.account_balance_wallet), label: 'الحسابات'),
            BottomNavigationBarItem(icon: Icon(Icons.pie_chart_outline),
                activeIcon: Icon(Icons.pie_chart), label: 'التقارير'),
            BottomNavigationBarItem(icon: Icon(Icons.settings_outlined),
                activeIcon: Icon(Icons.settings), label: 'الإعدادات'),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 💎 شاشة الترقية / الاشتراك
// ═══════════════════════════════════════════════════════════
class SubscriptionScreen extends StatelessWidget {
  final String? message;
  const SubscriptionScreen({super.key, this.message});

  static const _whatsappNumber = '+972569988062';

  Future<void> _contactWhatsApp(String plan) async {
    final msg = 'مرحباً، أريد الاشتراك في خطة $plan في منصتي المحاسبية';
    final url = 'https://wa.me/${_whatsappNumber.replaceAll('+', '')}?text=${Uri.encodeComponent(msg)}';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: SafeArea(
          child: Column(children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(children: [
                IconButton(icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                    onPressed: () => Navigator.pop(context)),
                const Expanded(child: Text('ترقية الاشتراك',
                    style: TextStyle(color: Colors.white, fontSize: 20,
                        fontWeight: FontWeight.bold), textAlign: TextAlign.center)),
                const SizedBox(width: 48),
              ]),
            ),

            if (message != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.orange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.orange.shade300)),
                child: Row(children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                  const SizedBox(width: 8),
                  Expanded(child: Text(message!, style: const TextStyle(
                      color: Colors.white, fontSize: 13))),
                ]),
              ),

            const SizedBox(height: 16),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(children: [
                  _PlanCard(
                    title: '🆓 مجاني', price: '\$0.00', period: 'دائماً',
                    color: Colors.grey.shade600,
                    features: const ['15 حساب', '100 قيد', 'ميزات أساسية'],
                    isCurrent: subscriptionNotifier.value.plan == PlanType.free,
                    onTap: null,
                  ),
                  const SizedBox(height: 12),
                  _PlanCard(
                    title: '📅 شهري', price: '\$49.99', period: 'شهرياً',
                    color: const Color(0xFF0575E6),
                    features: const ['حسابات غير محدودة', 'قيود غير محدودة',
                        'كشف حساب PDF', 'إرسال واتساب', 'دعم أولوية'],
                    isCurrent: subscriptionNotifier.value.plan == PlanType.monthly,
                    isPopular: false,
                    onTap: () => _contactWhatsApp('الشهري — \$49.99'),
                  ),
                  const SizedBox(height: 12),
                  _PlanCard(
                    title: '📆 سنوي', price: '\$449.99', period: 'سنوياً',
                    color: const Color(0xFF059669),
                    features: const ['حسابات غير محدودة', 'قيود غير محدودة',
                        'جميع الميزات', 'توفير 25%', 'أولوية دعم فائقة'],
                    isCurrent: subscriptionNotifier.value.plan == PlanType.yearly,
                    isPopular: true,
                    onTap: () => _contactWhatsApp('السنوي — \$449.99'),
                  ),
                  const SizedBox(height: 12),
                  _PlanCard(
                    title: '♾️ مدى الحياة', price: '\$999.99', period: 'دفعة واحدة',
                    color: const Color(0xFFD97706),
                    features: const ['كل شيء غير محدود', 'تحديثات مجانية للأبد',
                        'أفضل قيمة', 'دعم VIP', 'لا تجديد أبداً'],
                    isCurrent: subscriptionNotifier.value.plan == PlanType.lifetime,
                    onTap: () => _contactWhatsApp('مدى الحياة — \$999.99'),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16)),
                    child: Column(children: [
                      const Text('💬 كيفية الاشتراك', style: TextStyle(
                          color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                      const SizedBox(height: 8),
                      const Text(
                        '١. اضغط على الخطة المناسبة\n'
                        '٢. ستنتقل إلى واتساب تلقائياً\n'
                        '٣. أكمل الدفع وسيتم تفعيل اشتراكك فوراً',
                        style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.7),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        icon: const Icon(FontAwesomeIcons.whatsapp,
                            color: Color(0xFF25D366)),
                        label: const Text('تواصل معنا عبر واتساب',
                            style: TextStyle(fontWeight: FontWeight.bold)),
                        onPressed: () => _contactWhatsApp('اشتراك'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFF021B79),
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 30),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final String title, price, period;
  final Color color;
  final List<String> features;
  final bool isCurrent, isPopular;
  final VoidCallback? onTap;
  const _PlanCard({required this.title, required this.price, required this.period,
      required this.color, required this.features, this.isCurrent = false,
      this.isPopular = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: isCurrent ? Border.all(color: color, width: 3) : null,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10)],
      ),
      child: Column(children: [
        if (isPopular)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 6),
            decoration: BoxDecoration(color: color,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(17))),
            child: const Text('⭐ الأكثر شعبية', textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
          ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: color)),
                const SizedBox(height: 4),
                RichText(text: TextSpan(children: [
                  TextSpan(text: price, style: TextStyle(fontSize: 22,
                      fontWeight: FontWeight.w900, color: color)),
                  TextSpan(text: ' / $period', style: TextStyle(
                      fontSize: 12, color: Colors.grey.shade500)),
                ])),
              ])),
              if (isCurrent)
                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20)),
                  child: Text('خطتك الحالية',
                      style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
            ]),
            const SizedBox(height: 12),
            ...features.map((f) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(children: [
                Icon(Icons.check_circle, color: color, size: 16),
                const SizedBox(width: 8),
                Text(f, style: const TextStyle(fontSize: 13, color: Color(0xFF374151))),
              ]),
            )),
            if (onTap != null) ...[
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(FontAwesomeIcons.whatsapp, size: 16),
                  label: const Text('اشترك الآن عبر واتساب',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: onTap,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: color,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

// ══ Dialog انتهاء الاشتراك ══
class _SubscriptionExpiredDialog extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: const Column(children: [
        Text('⏰', style: TextStyle(fontSize: 40)),
        SizedBox(height: 8),
        Text('انتهى اشتراكك', style: TextStyle(fontWeight: FontWeight.bold)),
      ]),
      content: const Text(
        'انتهت صلاحية اشتراكك المدفوع. ستعود إلى الخطة المجانية (15 حساب / 100 قيد).\n\nيمكنك تجديد اشتراكك في أي وقت.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, height: 1.6),
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('لاحقاً')),
        ElevatedButton.icon(
          icon: const Icon(Icons.upgrade, color: Colors.white),
          label: const Text('تجديد الاشتراك',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          onPressed: () {
            Navigator.pop(context);
            Navigator.push(context, MaterialPageRoute(
                builder: (_) => const SubscriptionScreen()));
          },
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF021B79),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
        ),
      ],
    );
  }
}

// ══ Banner الاشتراك للصفحات ══
class _SubscriptionBanner extends StatelessWidget {
  final int accountCount;
  final int opCount;
  const _SubscriptionBanner({required this.accountCount, required this.opCount});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<SubscriptionInfo>(
      valueListenable: subscriptionNotifier,
      builder: (_, sub, __) {
        if (sub.plan != PlanType.free) {
          // تحذير انتهاء قريب
          if (sub.daysLeft >= 0 && sub.daysLeft <= 7 && sub.plan != PlanType.lifetime) {
            return _buildWarning(context,
                '⚠️ اشتراكك ينتهي خلال ${sub.daysLeft} يوم',
                Colors.orange);
          }
          return const SizedBox.shrink();
        }
        // الخطة المجانية
        final accPct = accountCount / SubscriptionInfo.freeMaxAccounts;
        final opPct = opCount / SubscriptionInfo.freeMaxOperations;
        if (accPct < 0.7 && opPct < 0.7) return const SizedBox.shrink();
        final msg = accPct >= opPct
            ? 'استخدمت $accountCount/${SubscriptionInfo.freeMaxAccounts} حساب'
            : 'استخدمت $opCount/${SubscriptionInfo.freeMaxOperations} قيد';
        return _buildWarning(context, '🆓 $msg — قرّب الحد المجاني', Colors.blue.shade700);
      },
    );
  }

  Widget _buildWarning(BuildContext context, String msg, Color color) {
    return GestureDetector(
      onTap: () => Navigator.push(context,
          MaterialPageRoute(builder: (_) => const SubscriptionScreen())),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.4)),
        ),
        child: Row(children: [
          Expanded(child: Text(msg, style: TextStyle(color: color,
              fontSize: 12, fontWeight: FontWeight.w600))),
          Text('ترقية ←', style: TextStyle(color: color,
              fontSize: 12, fontWeight: FontWeight.bold)),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 🏠 تبويب الرئيسية
// ═══════════════════════════════════════════════════════════
class _HomeTab extends StatelessWidget {
  const _HomeTab();
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: balanceNotifier,
      builder: (_, balance, __) => ValueListenableBuilder<List<Operation>>(
        valueListenable: operationsNotifier,
        builder: (_, ops, __) => ValueListenableBuilder<CompanyInfo>(
          valueListenable: companyNotifier,
          builder: (_, company, __) =>
              _HomeContent(balance: balance, ops: ops, company: company),
        ),
      ),
    );
  }
}

class _HomeContent extends StatefulWidget {
  final double balance;
  final List<Operation> ops;
  final CompanyInfo company;
  const _HomeContent({required this.balance, required this.ops, required this.company});
  @override
  State<_HomeContent> createState() => _HomeContentState();
}

class _HomeContentState extends State<_HomeContent> {
  String _mainCurrency = 'USD';

  @override
  void initState() {
    super.initState();
    DataService.getMainCurrency()
        .then((c) => mounted ? setState(() => _mainCurrency = c) : null);
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    final symbol = _currencySymbol(_mainCurrency);
    final recentOps = widget.ops.reversed.take(10).toList();
    final companyName =
        widget.company.name.isNotEmpty ? widget.company.name : 'منصتي المحاسبية';

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: CustomScrollView(slivers: [
          SliverAppBar(
            expandedHeight: h * 0.38,
            backgroundColor: Colors.transparent, elevation: 0,
            actions: [
              // زر الاشتراك في الـ AppBar
              ValueListenableBuilder<SubscriptionInfo>(
                valueListenable: subscriptionNotifier,
                builder: (_, sub, __) => sub.plan == PlanType.free
                    ? IconButton(
                        icon: const Icon(Icons.workspace_premium,
                            color: Colors.amber, size: 28),
                        tooltip: 'ترقية الاشتراك',
                        onPressed: () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => const SubscriptionScreen())),
                      )
                    : const SizedBox.shrink(),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, color: Colors.white, size: 32),
                onPressed: () => _showAddOperationSheet(context),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              centerTitle: true,
              title: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                Text('مرحباً، $companyName',
                    style: const TextStyle(color: Colors.white70, fontSize: 13,
                        fontWeight: FontWeight.w400), overflow: TextOverflow.ellipsis),
                const SizedBox(height: 6),
                Text('${widget.balance.toStringAsFixed(2)} $symbol',
                    style: const TextStyle(color: Colors.white, fontSize: 36,
                        fontWeight: FontWeight.bold)),
                Text('الرصيد الإجمالي بـ $_mainCurrency',
                    style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11)),
                // شارة الاشتراك
                ValueListenableBuilder<SubscriptionInfo>(
                  valueListenable: subscriptionNotifier,
                  builder: (_, sub, __) => sub.plan != PlanType.free
                      ? Container(
                          margin: const EdgeInsets.only(top: 4),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                              color: Colors.amber.withOpacity(0.3),
                              borderRadius: BorderRadius.circular(20)),
                          child: Text('⭐ ${sub.planName}',
                              style: const TextStyle(color: Colors.amber,
                                  fontSize: 10, fontWeight: FontWeight.bold)),
                        )
                      : const SizedBox.shrink(),
                ),
                const SizedBox(height: 16),
              ]),
            ),
            pinned: false, floating: true, snap: false,
          ),
          SliverToBoxAdapter(
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(40), topRight: Radius.circular(40)),
              child: Container(
                color: Colors.grey.shade50,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _SubscriptionBanner(
                      accountCount: accountsNotifier.value.length,
                      opCount: operationsNotifier.value.length),
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const SizedBox(height: 8),
                      const Text('آخر العمليات', style: TextStyle(fontSize: 18,
                          fontWeight: FontWeight.bold, color: Color(0xFF021B79))),
                      const SizedBox(height: 12),
                      if (recentOps.isEmpty)
                        const Center(child: Padding(padding: EdgeInsets.all(32),
                            child: Text('لا توجد عمليات بعد',
                                style: TextStyle(color: Colors.grey))))
                      else
                        ...recentOps.map((op) => _OpTile(op: op)),
                      const SizedBox(height: 24),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  void _showAddOperationSheet(BuildContext context) async {
    final err = await DataService.canAddOperation();
    if (err != null && context.mounted) {
      _showUpgradeDialog(context, err);
      return;
    }
    if (context.mounted) {
      showModalBottomSheet(context: context, isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => const Directionality(
              textDirection: ui.TextDirection.rtl, child: _AddOperationSheet()));
    }
  }
}

void _showUpgradeDialog(BuildContext context, String message) {
  showDialog(
    context: context,
    builder: (_) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Column(children: [
        Text('🔒', style: TextStyle(fontSize: 36)),
        SizedBox(height: 8),
        Text('تم الوصول للحد الأقصى', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ]),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(message, textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563))),
        const SizedBox(height: 12),
        Container(padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFF021B79).withOpacity(0.06),
              borderRadius: BorderRadius.circular(12)),
          child: const Column(children: [
            _PlanSummaryRow('مجاني', '15 حساب / 100 قيد', '\$0'),
            Divider(height: 12),
            _PlanSummaryRow('شهري', 'غير محدود', '\$49.99/شهر'),
            Divider(height: 12),
            _PlanSummaryRow('سنوي', 'غير محدود', '\$449.99/سنة'),
            Divider(height: 12),
            _PlanSummaryRow('مدى الحياة', 'غير محدود', '\$999.99'),
          ]),
        ),
      ]),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('لاحقاً')),
        ElevatedButton.icon(
          icon: const Icon(Icons.upgrade, color: Colors.white, size: 18),
          label: const Text('ترقية الاشتراك',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          onPressed: () {
            Navigator.pop(context);
            Navigator.push(context, MaterialPageRoute(
                builder: (_) => SubscriptionScreen(message: message)));
          },
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF021B79),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
        ),
      ],
    ),
  );
}

class _PlanSummaryRow extends StatelessWidget {
  final String plan, desc, price;
  const _PlanSummaryRow(this.plan, this.desc, this.price);
  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: Text(plan, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
      Text(desc, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
      const SizedBox(width: 8),
      Text(price, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold,
          color: Color(0xFF021B79))),
    ]);
  }
}

// ─────────────────────────────────────────────
// 🧾 بطاقة القيد في الرئيسية
// ─────────────────────────────────────────────
class _OpTile extends StatelessWidget {
  final Operation op;
  const _OpTile({required this.op});
  @override
  Widget build(BuildContext context) {
    final isCredit = op.amount >= 0;
    final color = isCredit ? Colors.green.shade700 : Colors.red.shade700;
    final sign = isCredit ? '+' : '';
    final symbol = _currencySymbol(op.currency);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04),
              blurRadius: 6, offset: const Offset(0, 2))]),
      child: Row(children: [
        Container(width: 8, height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(op.statement.isNotEmpty ? op.statement : 'بدون بيان',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          Text(op.currency, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('$sign${op.amount.toStringAsFixed(2)} $symbol',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
          Text('= ${op.amountUSD.toStringAsFixed(2)} \$',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
        ]),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 🏦 تبويب الحسابات
// ═══════════════════════════════════════════════════════════
class _AccountsTab extends StatelessWidget {
  const _AccountsTab();
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<Account>>(
      valueListenable: accountsNotifier,
      builder: (_, accounts, __) => _AccountsContent(accounts: accounts),
    );
  }
}

class _AccountsContent extends StatelessWidget {
  final List<Account> accounts;
  const _AccountsContent({required this.accounts});

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: CustomScrollView(slivers: [
          SliverAppBar(
            expandedHeight: h * 0.28, backgroundColor: Colors.transparent, elevation: 0,
            actions: [IconButton(
              icon: const Icon(Icons.add_circle_outline, color: Colors.white, size: 32),
              onPressed: () => _tryAddAccount(context),
            )],
            flexibleSpace: FlexibleSpaceBar(centerTitle: true,
              title: Padding(padding: const EdgeInsets.only(bottom: 16),
                child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                  const Text('الحسابات', style: TextStyle(color: Colors.white,
                      fontWeight: FontWeight.bold, fontSize: 28)),
                  ValueListenableBuilder<SubscriptionInfo>(
                    valueListenable: subscriptionNotifier,
                    builder: (_, sub, __) => sub.plan == PlanType.free
                        ? Text('${accounts.length}/${SubscriptionInfo.freeMaxAccounts}',
                            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11))
                        : const SizedBox.shrink(),
                  ),
                ])),
            ),
            pinned: false, floating: true,
          ),
          SliverToBoxAdapter(
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(40), topRight: Radius.circular(40)),
              child: Container(
                color: Colors.grey.shade50,
                padding: const EdgeInsets.all(20),
                child: accounts.isEmpty
                    ? const Center(child: Padding(padding: EdgeInsets.all(40),
                        child: Text('لا توجد حسابات، اضغط + لإضافة حساب',
                            textAlign: TextAlign.center, style: TextStyle(color: Colors.grey))))
                    : Column(children: accounts.map((a) => _AccountCard(account: a)).toList()),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  void _tryAddAccount(BuildContext context) async {
    final err = await DataService.canAddAccount();
    if (err != null && context.mounted) {
      _showUpgradeDialog(context, err);
      return;
    }
    if (context.mounted) {
      showModalBottomSheet(context: context, isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => const Directionality(
              textDirection: ui.TextDirection.rtl, child: _AddAccountSheet()));
    }
  }
}

// ─────────────────────────────────────────────
// 💳 بطاقة الحساب
// ─────────────────────────────────────────────
class _AccountCard extends StatelessWidget {
  final Account account;
  const _AccountCard({required this.account});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showAccountDetail(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.07),
                blurRadius: 12, offset: const Offset(0, 4))]),
        child: Row(children: [
          Container(width: 48, height: 48,
            decoration: BoxDecoration(color: const Color(0xFF021B79).withOpacity(0.1),
                borderRadius: BorderRadius.circular(14)),
            child: Center(child: Text(account.id, style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF021B79)))),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(account.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 3),
            Text(_typeLabel(account.type),
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          ])),
          const Icon(Icons.chevron_left, color: Colors.grey),
        ]),
      ),
    );
  }

  void _showAccountDetail(BuildContext context) {
    showModalBottomSheet(context: context, isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(textDirection: ui.TextDirection.rtl,
            child: _AccountDetailSheet(account: account)));
  }

  String _typeLabel(String type) {
    const map = {'bank': 'بنكي', 'cash': 'نقدي', 'usdt': 'USDT', 'other': 'أخرى'};
    return map[type] ?? type;
  }
}

// ─────────────────────────────────────────────
// 📊 تفاصيل الحساب
// ─────────────────────────────────────────────
class _AccountDetailSheet extends StatefulWidget {
  final Account account;
  const _AccountDetailSheet({required this.account});
  @override
  State<_AccountDetailSheet> createState() => _AccountDetailSheetState();
}

class _AccountDetailSheetState extends State<_AccountDetailSheet> {
  AccountSummary? _summary;
  List<Operation> _ops = [];
  String _mainCurrency = 'USD';
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final summary = await DataService.getAccountSummary(widget.account.id);
    final allOps = await DataService.getOperations();
    final accountOps = allOps.where((o) => o.accountId == widget.account.id).toList()
      ..sort((a, b) => b.date.compareTo(a.date));
    final currency = await DataService.getMainCurrency();
    if (mounted) {
      setState(() {
      _summary = summary; _ops = accountOps;
      _mainCurrency = currency; _loading = false;
    });
    }
  }

  Future<void> _confirmDeleteAccount() async {
    final ops = await DataService.getOperations();
    final opCount = ops.where((o) => o.accountId == widget.account.id).length;
    if (!mounted) return;
    final confirmed = await showDialog<bool>(context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(children: [
          Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
          SizedBox(width: 8), Text('حذف الحساب'),
        ]),
        content: Column(mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start, children: [
          RichText(text: TextSpan(style: const TextStyle(color: Colors.black87, fontSize: 14, height: 1.6),
            children: [const TextSpan(text: 'هل تريد حذف حساب '),
              TextSpan(text: widget.account.name,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              const TextSpan(text: '؟')])),
          if (opCount > 0) ...[
            const SizedBox(height: 12),
            Container(padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.red.shade200)),
              child: Row(children: [
                Icon(Icons.info_outline, color: Colors.red.shade700, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text('سيتم حذف $opCount قيد مرتبط أيضاً.',
                    style: TextStyle(color: Colors.red.shade700, fontSize: 13))),
              ])),
          ],
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          ElevatedButton.icon(icon: const Icon(Icons.delete, color: Colors.white, size: 18),
            label: const Text('احذف', style: TextStyle(color: Colors.white)),
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)))),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await DataService.deleteAccount(widget.account.id);
      if (mounted) { Navigator.pop(context); _snack(context, '✅ تم حذف الحساب وقيوده'); }
    }
  }

  Future<void> _openEditAccount() async {
    final edited = await showModalBottomSheet<bool>(context: context,
        isScrollControlled: true, backgroundColor: Colors.transparent,
        builder: (_) => Directionality(textDirection: ui.TextDirection.rtl,
            child: _EditAccountSheet(account: widget.account)));
    if (edited == true && mounted) Navigator.pop(context);
  }

  void _openPDF() async {
    if (_summary == null) return;
    final company = companyNotifier.value;
    await generateAccountStatementPDF(account: widget.account, summary: _summary!,
        operations: _ops, mainCurrency: _mainCurrency,
        companyName: company.name.isNotEmpty ? company.name : 'منصتي المحاسبية',
        companyAddress: company.address, companyPhone: company.phone);
  }

  void _openWhatsApp() async {
    if (_summary == null) return;
    final company = companyNotifier.value;
    await sendBalanceViaWhatsApp(account: widget.account, summary: _summary!,
        mainCurrency: _mainCurrency,
        companyName: company.name.isNotEmpty ? company.name : 'منصتي المحاسبية',
        context: context);
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    final mainSymbol = _currencySymbol(_mainCurrency);
    return Container(
      constraints: BoxConstraints(maxHeight: h * 0.92),
      decoration: const BoxDecoration(color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF021B79)))
          : Column(children: [
              // Header
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(color: Color(0xFF021B79),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
                child: Column(children: [
                  Row(children: [
                    Expanded(child: Text(widget.account.name,
                        style: const TextStyle(color: Colors.white, fontSize: 20,
                            fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis)),
                    Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20)),
                      child: Text(widget.account.id,
                          style: const TextStyle(color: Colors.white, fontSize: 12))),
                    const SizedBox(width: 4),
                    IconButton(icon: const Icon(Icons.file_download_outlined,
                        color: Colors.white, size: 22), tooltip: 'كشف حساب PDF',
                        onPressed: _openPDF, padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36)),
                    IconButton(icon: const Icon(FontAwesomeIcons.whatsapp,
                        color: Colors.greenAccent, size: 22), tooltip: 'إرسال واتساب',
                        onPressed: _openWhatsApp, padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36)),
                    IconButton(icon: const Icon(Icons.edit_outlined, color: Colors.white, size: 22),
                        tooltip: 'تعديل', onPressed: _openEditAccount,
                        padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 36, minHeight: 36)),
                    IconButton(icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 22),
                        tooltip: 'حذف', onPressed: _confirmDeleteAccount,
                        padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 36, minHeight: 36)),
                    CloseButton(color: Colors.white.withOpacity(0.8)),
                  ]),
                  const SizedBox(height: 16),
                  Container(width: double.infinity, padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(16)),
                    child: Column(children: [
                      Text('الرصيد الإجمالي بـ $_mainCurrency',
                          style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12)),
                      const SizedBox(height: 6),
                      Text('${(_summary?.totalUSD ?? 0).toStringAsFixed(2)} $mainSymbol',
                          style: TextStyle(
                              color: (_summary?.totalUSD ?? 0) >= 0
                                  ? Colors.greenAccent.shade100
                                  : Colors.redAccent.shade100,
                              fontSize: 28, fontWeight: FontWeight.bold)),
                    ])),
                  const SizedBox(height: 12),
                  if (_summary != null && _summary!.balanceByCurrency.isNotEmpty)
                    Wrap(spacing: 8, runSpacing: 8,
                      children: _summary!.balanceByCurrency.entries.map((e) {
                        final isPos = e.value >= 0;
                        final sym = _currencySymbol(e.key);
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                              color: isPos ? Colors.green.withOpacity(0.25) : Colors.red.withOpacity(0.25),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: isPos ? Colors.greenAccent.shade200 : Colors.redAccent.shade200, width: 1)),
                          child: Column(children: [
                            Text(e.key, style: const TextStyle(color: Colors.white70, fontSize: 10)),
                            Text('${isPos ? "لنا" : "لهم"} ${e.value.abs().toStringAsFixed(2)} $sym',
                                style: TextStyle(
                                    color: isPos ? Colors.greenAccent.shade100 : Colors.redAccent.shade100,
                                    fontSize: 13, fontWeight: FontWeight.bold)),
                          ]),
                        );
                      }).toList()),
                ]),
              ),
              // List
              Expanded(child: _ops.isEmpty
                  ? const Center(child: Text('لا توجد قيود لهذا الحساب',
                      style: TextStyle(color: Colors.grey)))
                  : ListView.builder(padding: const EdgeInsets.all(16),
                      itemCount: _ops.length,
                      itemBuilder: (_, i) => _OpDetailTile(op: _ops[i],
                          mainCurrency: _mainCurrency, onChanged: _load))),
              // Add button
              Padding(padding: const EdgeInsets.all(16),
                child: SizedBox(width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.add, color: Colors.white),
                    label: const Text('إضافة قيد جديد', style: TextStyle(
                        color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    onPressed: () async {
                      final err = await DataService.canAddOperation();
                      if (err != null && context.mounted) {
                        _showUpgradeDialog(context, err); return;
                      }
                      if (context.mounted) {
                        showModalBottomSheet(context: context, isScrollControlled: true,
                            backgroundColor: Colors.transparent,
                            builder: (_) => Directionality(textDirection: ui.TextDirection.rtl,
                                child: _AddOperationSheet(preselectedAccountId: widget.account.id))
                        ).then((_) => _load());
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF021B79),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                  ))),
            ]),
    );
  }
}

// ══ _OpDetailTile, _EditOperationSheet, _EditAccountSheet, _AddAccountSheet, _AddOperationSheet ══
// (نفس الكود السابق مع إضافة فحص الاشتراك في الإضافة)

class _OpDetailTile extends StatelessWidget {
  final Operation op;
  final String mainCurrency;
  final VoidCallback onChanged;
  const _OpDetailTile({required this.op, required this.mainCurrency, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final isCredit = op.amount >= 0;
    final color = isCredit ? Colors.green.shade700 : Colors.red.shade700;
    final sign = isCredit ? '+' : '';
    final sym = _currencySymbol(op.currency);
    final mainSym = _currencySymbol(mainCurrency);
    final label = isCredit ? 'لنا' : 'لهم';
    return GestureDetector(
      onTap: () => _showOptions(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04),
                blurRadius: 6, offset: const Offset(0, 2))]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10)),
              child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold))),
            const Spacer(),
            Text('${op.date.day}/${op.date.month}/${op.date.year}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            const SizedBox(width: 6),
            Icon(Icons.more_horiz, size: 18, color: Colors.grey.shade400),
          ]),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Expanded(child: Text(op.statement.isNotEmpty ? op.statement : 'بدون بيان',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('$sign${op.amount.toStringAsFixed(2)} $sym',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
              Text('صرف: ${op.exchangeRate.toStringAsFixed(2)}',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              Text('= ${op.amountUSD.toStringAsFixed(2)} $mainSym',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF021B79), fontWeight: FontWeight.w600)),
            ]),
          ]),
        ]),
      ),
    );
  }

  void _showOptions(BuildContext context) {
    final isCredit = op.amount >= 0;
    final color = isCredit ? Colors.green.shade700 : Colors.red.shade700;
    showModalBottomSheet(context: context, backgroundColor: Colors.transparent,
      builder: (_) => Directionality(textDirection: ui.TextDirection.rtl,
        child: Container(
          decoration: const BoxDecoration(color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
          child: SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
            _sheetHandle(), const SizedBox(height: 8),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                  child: Text(isCredit ? 'لنا' : 'لهم', style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12))),
                const SizedBox(width: 10),
                Expanded(child: Text(op.statement.isNotEmpty ? op.statement : 'بدون بيان',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis)),
                Text('${isCredit ? "+" : ""}${op.amount.toStringAsFixed(2)} ${_currencySymbol(op.currency)}',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
              ])),
            const Divider(height: 1), const SizedBox(height: 4),
            ListTile(
              leading: Container(padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: const Color(0xFF021B79).withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.edit_outlined, color: Color(0xFF021B79))),
              title: const Text('تعديل القيد', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('تغيير المبلغ أو العملة أو البيان'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () { Navigator.pop(context); _openEdit(context); },
            ),
            ListTile(
              leading: Container(padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.delete_outline, color: Colors.red)),
              title: const Text('حذف القيد', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
              subtitle: const Text('لا يمكن التراجع عن هذه العملية'),
              trailing: const Icon(Icons.chevron_right, color: Colors.red),
              onTap: () { Navigator.pop(context); _confirmDelete(context); },
            ),
            const SizedBox(height: 8),
          ])),
        )));
  }

  void _openEdit(BuildContext context) {
    showModalBottomSheet(context: context, isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(textDirection: ui.TextDirection.rtl,
            child: _EditOperationSheet(op: op)))
        .then((edited) { if (edited == true) onChanged(); });
  }

  void _confirmDelete(BuildContext context) {
    showDialog(context: context, builder: (_) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Row(children: [
        Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
        SizedBox(width: 8), Text('حذف القيد')]),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('هل أنت متأكد من حذف هذا القيد؟'),
        const SizedBox(height: 8),
        Container(padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade200)),
          child: Row(children: [
            Text('${op.amount >= 0 ? "+" : ""}${op.amount.toStringAsFixed(2)} ${_currencySymbol(op.currency)}',
                style: TextStyle(fontWeight: FontWeight.bold,
                    color: op.amount >= 0 ? Colors.green.shade700 : Colors.red.shade700)),
            const SizedBox(width: 8),
            Expanded(child: Text(op.statement.isNotEmpty ? op.statement : 'بدون بيان',
                style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
          ])),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
        ElevatedButton.icon(
          icon: const Icon(Icons.delete, color: Colors.white, size: 18),
          label: const Text('احذف', style: TextStyle(color: Colors.white)),
          onPressed: () async {
            Navigator.pop(context);
            await DataService.deleteOperation(op.id);
            onChanged();
            if (context.mounted) _snack(context, '✅ تم حذف القيد');
          },
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)))),
      ],
    ));
  }
}

// ══ EditOperation ══
class _EditOperationSheet extends StatefulWidget {
  final Operation op;
  const _EditOperationSheet({required this.op});
  @override State<_EditOperationSheet> createState() => _EditOperationSheetState();
}
class _EditOperationSheetState extends State<_EditOperationSheet> {
  late TextEditingController _amountCtrl, _rateCtrl, _statementCtrl;
  late String _currency;
  String _mainCurrency = 'USD';
  double _convertedAmount = 0.0;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _amountCtrl = TextEditingController(text: widget.op.amount.toString());
    _rateCtrl = TextEditingController(text: widget.op.exchangeRate.toString());
    _statementCtrl = TextEditingController(text: widget.op.statement);
    _currency = widget.op.currency;
    _convertedAmount = widget.op.amountUSD;
    DataService.getMainCurrency().then((c) { if (mounted) setState(() => _mainCurrency = c); });
  }
  @override
  void dispose() { _amountCtrl.dispose(); _rateCtrl.dispose(); _statementCtrl.dispose(); super.dispose(); }

  void _recalc() {
    final a = double.tryParse(_amountCtrl.text) ?? 0.0;
    final r = double.tryParse(_rateCtrl.text) ?? 1.0;
    setState(() { _convertedAmount = r != 0 ? double.parse((a / r).toStringAsFixed(6)) : 0.0; });
  }

  @override
  Widget build(BuildContext context) {
    final mainSym = _currencySymbol(_mainCurrency);
    final entrySym = _currencySymbol(_currency);
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
      decoration: const BoxDecoration(color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _sheetHandle(),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              Text('تعديل القيد', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Spacer(), CloseButton()])),
          const Divider(height: 1),
          Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(20),
            child: Column(children: [
              Row(children: [
                Expanded(flex: 5, child: TextFormField(controller: _amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                  decoration: _inputDeco('المبلغ *', suffix: entrySym),
                  onChanged: (_) => _recalc(), style: const TextStyle(fontSize: 13))),
                const SizedBox(width: 8),
                Expanded(flex: 4, child: TextFormField(controller: _rateCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: _inputDeco('الصرف'),
                  onChanged: (_) => _recalc(), style: const TextStyle(fontSize: 13))),
              ]),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(initialValue: _currency, decoration: _inputDeco('العملة'),
                items: _supportedCurrencies().map((c) => DropdownMenuItem(value: c,
                    child: Text('$c ${_currencySymbol(c)}', style: const TextStyle(fontSize: 13)))).toList(),
                onChanged: (v) { setState(() => _currency = v ?? _mainCurrency); _recalc(); },
                isDense: true, isExpanded: true),
              const SizedBox(height: 12),
              Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: const Color(0xFF021B79).withOpacity(0.07),
                    borderRadius: BorderRadius.circular(10)),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text('= بـ $_mainCurrency:', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  Text('${_convertedAmount.toStringAsFixed(2)} $mainSym',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF021B79), fontSize: 15)),
                ])),
              const SizedBox(height: 12),
              TextFormField(controller: _statementCtrl, maxLines: 2,
                decoration: _inputDeco('البيان (اختياري)'), style: const TextStyle(fontSize: 13)),
            ]))),
          _saveButton(label: 'حفظ التعديلات', saving: _saving, onPressed: _submit),
        ])),
    );
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountCtrl.text);
    if (amount == null) { _snack(context, '❌ يرجى إدخال مبلغ صحيح', error: true); return; }
    setState(() => _saving = true);
    try {
      await DataService.updateOperation(opId: widget.op.id, amount: amount,
          exchangeRate: double.tryParse(_rateCtrl.text) ?? 1.0,
          currency: _currency, statement: _statementCtrl.text.trim());
      if (mounted) { Navigator.pop(context, true); _snack(context, '✅ تم تحديث القيد'); }
    } catch (e) { if (mounted) _snack(context, '❌ خطأ: $e', error: true); }
    finally { if (mounted) setState(() => _saving = false); }
  }
}

// ══ EditAccount ══
class _EditAccountSheet extends StatefulWidget {
  final Account account;
  const _EditAccountSheet({required this.account});
  @override State<_EditAccountSheet> createState() => _EditAccountSheetState();
}
class _EditAccountSheetState extends State<_EditAccountSheet> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl, _phoneCtrl, _addressCtrl;
  late String _type;
  bool _saving = false;
  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.account.name);
    _phoneCtrl = TextEditingController(text: widget.account.phone);
    _addressCtrl = TextEditingController(text: widget.account.address);
    _type = widget.account.type;
  }
  @override
  void dispose() { _nameCtrl.dispose(); _phoneCtrl.dispose(); _addressCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
      decoration: const BoxDecoration(color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Form(key: _formKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
          _sheetHandle(),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              Text('تعديل الحساب', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Spacer(), CloseButton()])),
          const Divider(height: 1),
          Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(20),
            child: Column(children: [
              Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: const Color(0xFF021B79).withOpacity(0.06),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF021B79).withOpacity(0.15))),
                child: Row(children: [
                  const Icon(Icons.tag, size: 16, color: Color(0xFF021B79)), const SizedBox(width: 8),
                  Text('رقم الحساب: ${widget.account.id}', style: const TextStyle(
                      color: Color(0xFF021B79), fontWeight: FontWeight.w600, fontSize: 13)),
                  const Spacer(),
                  Text('لا يمكن تعديله', style: TextStyle(color: Colors.grey.shade400, fontSize: 11)),
                ])),
              const SizedBox(height: 16),
              _field('اسم الحساب *', _nameCtrl, validator: (v) => v!.trim().isEmpty ? 'الاسم مطلوب' : null),
              const SizedBox(height: 12),
              _field('رقم الهاتف (اختياري)', _phoneCtrl, type: TextInputType.phone),
              const SizedBox(height: 12),
              _field('العنوان (اختياري)', _addressCtrl, maxLines: 2),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(initialValue: _type, decoration: _inputDeco('نوع الحساب'),
                items: const [DropdownMenuItem(value: 'cash', child: Text('نقدي')),
                  DropdownMenuItem(value: 'bank', child: Text('بنكي')),
                  DropdownMenuItem(value: 'usdt', child: Text('USDT')),
                  DropdownMenuItem(value: 'other', child: Text('أخرى'))],
                onChanged: (v) => setState(() => _type = v!)),
            ]))),
          _saveButton(label: 'حفظ التعديلات', saving: _saving, onPressed: _submit),
        ]))),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await DataService.updateAccount(accountId: widget.account.id,
          name: _nameCtrl.text.trim(), phone: _phoneCtrl.text.trim(),
          address: _addressCtrl.text.trim(), type: _type);
      if (mounted) { Navigator.pop(context, true); _snack(context, '✅ تم تحديث الحساب'); }
    } catch (e) { if (mounted) _snack(context, '❌ خطأ: $e', error: true); }
    finally { if (mounted) setState(() => _saving = false); }
  }
}

// ══ AddAccount ══
class _AddAccountSheet extends StatefulWidget {
  const _AddAccountSheet();
  @override State<_AddAccountSheet> createState() => _AddAccountSheetState();
}
class _AddAccountSheetState extends State<_AddAccountSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  String _type = 'cash';
  bool _saving = false;
  @override
  void dispose() { _nameCtrl.dispose(); _phoneCtrl.dispose(); _addressCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
      decoration: const BoxDecoration(color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Form(key: _formKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
          _sheetHandle(),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              Text('حساب جديد', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Spacer(), CloseButton()])),
          const Divider(height: 1),
          Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(20),
            child: Column(children: [
              _field('اسم الحساب *', _nameCtrl, validator: (v) => v!.isEmpty ? 'الاسم مطلوب' : null),
              const SizedBox(height: 12),
              _field('رقم الهاتف (اختياري)', _phoneCtrl, type: TextInputType.phone),
              const SizedBox(height: 12),
              _field('العنوان (اختياري)', _addressCtrl, maxLines: 2),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(initialValue: _type, decoration: _inputDeco('نوع الحساب'),
                items: const [DropdownMenuItem(value: 'cash', child: Text('نقدي')),
                  DropdownMenuItem(value: 'bank', child: Text('بنكي')),
                  DropdownMenuItem(value: 'usdt', child: Text('USDT')),
                  DropdownMenuItem(value: 'other', child: Text('أخرى'))],
                onChanged: (v) => setState(() => _type = v!)),
            ]))),
          _saveButton(label: 'إنشاء الحساب', saving: _saving, onPressed: () async {
            if (!_formKey.currentState!.validate()) return;
            setState(() => _saving = true);
            try {
              await DataService.addAccount(name: _nameCtrl.text.trim(),
                  phone: _phoneCtrl.text.trim(), address: _addressCtrl.text.trim(), type: _type);
              if (mounted) { Navigator.pop(context); _snack(context, '✅ تم إنشاء الحساب'); }
            } catch (e) { if (mounted) _snack(context, '❌ خطأ: $e', error: true); }
            finally { if (mounted) setState(() => _saving = false); }
          }),
        ]))),
    );
  }
}

// ══ AddOperation ══
class _AddOperationSheet extends StatefulWidget {
  final String? preselectedAccountId;
  const _AddOperationSheet({this.preselectedAccountId});
  @override State<_AddOperationSheet> createState() => _AddOperationSheetState();
}
class _AddOperationSheetState extends State<_AddOperationSheet> {
  List<Account> _accounts = [];
  final List<_OpRow> _rows = [];
  bool _loading = true, _saving = false;
  String _mainCurrency = 'USD';

  @override
  void initState() { super.initState(); _init(); }

  Future<void> _init() async {
    _accounts = await DataService.getAccounts();
    _mainCurrency = await DataService.getMainCurrency();
    if (mounted) { setState(() => _loading = false); _addRow(); }
  }

  void _addRow() => setState(() => _rows.add(
      _OpRow(accountId: widget.preselectedAccountId ?? '', currency: _mainCurrency)));
  void _removeRow(int i) { if (_rows.length > 1) setState(() => _rows.removeAt(i)); }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
      decoration: const BoxDecoration(color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(children: [
          _sheetHandle(),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              Text('قيد جديد', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Spacer(), CloseButton()])),
          const Divider(height: 1),
          Expanded(child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF021B79)))
              : ListView.builder(padding: const EdgeInsets.all(16),
                  itemCount: _rows.length, itemBuilder: (_, i) => _buildRow(i))),
          Container(padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: Colors.white,
                boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8)]),
            child: Row(children: [
              Expanded(child: OutlinedButton.icon(icon: const Icon(Icons.add),
                label: const Text('قيد آخر'), onPressed: _addRow,
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12),
                    side: const BorderSide(color: Color(0xFF021B79))))),
              const SizedBox(width: 12),
              Expanded(child: ElevatedButton(onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF021B79),
                    padding: const EdgeInsets.symmetric(vertical: 12)),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('حفظ وإنشاء', style: TextStyle(color: Colors.white)))),
            ])),
        ])),
    );
  }

  Widget _buildRow(int i) {
    final row = _rows[i];
    final mainSym = _currencySymbol(_mainCurrency);
    final entrySym = _currencySymbol(row.currency);
    return Container(
      margin: const EdgeInsets.only(bottom: 16), padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: const Color(0xFF021B79).withOpacity(0.1),
                borderRadius: BorderRadius.circular(20)),
            child: Text('قيد #${i+1}', style: const TextStyle(color: Color(0xFF021B79),
                fontWeight: FontWeight.bold, fontSize: 12))),
          const Spacer(),
          if (_rows.length > 1) IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
              onPressed: () => _removeRow(i), padding: EdgeInsets.zero, constraints: const BoxConstraints()),
        ]),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(initialValue: row.accountId.isEmpty ? null : row.accountId,
          decoration: _inputDeco('اختر الحساب *'),
          items: _accounts.map((a) => DropdownMenuItem(value: a.id,
              child: Text('${a.id} — ${a.name}'))).toList(),
          onChanged: (v) => setState(() => row.accountId = v ?? ''), isExpanded: true),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(flex: 5, child: TextFormField(initialValue: row.amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            decoration: _inputDeco('المبلغ *', suffix: entrySym),
            onChanged: (v) { row.amount = v; _recalc(i); }, style: const TextStyle(fontSize: 13))),
          const SizedBox(width: 8),
          Expanded(flex: 4, child: TextFormField(initialValue: row.rate,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: _inputDeco('الصرف'),
            onChanged: (v) { row.rate = v; _recalc(i); }, style: const TextStyle(fontSize: 13))),
        ]),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(initialValue: row.currency, decoration: _inputDeco('العملة'),
          items: _supportedCurrencies().map((c) => DropdownMenuItem(value: c,
              child: Text('$c ${_currencySymbol(c)}', style: const TextStyle(fontSize: 13)))).toList(),
          onChanged: (v) => setState(() { row.currency = v ?? _mainCurrency; _recalc(i); }),
          isDense: true, isExpanded: true),
        const SizedBox(height: 8),
        Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: const Color(0xFF021B79).withOpacity(0.07),
              borderRadius: BorderRadius.circular(10)),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('= بـ $_mainCurrency:', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            Text('${row.convertedAmount.toStringAsFixed(2)} $mainSym',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF021B79), fontSize: 15)),
          ])),
        const SizedBox(height: 8),
        TextFormField(initialValue: row.statement, maxLines: 2,
          decoration: _inputDeco('البيان (اختياري)'),
          onChanged: (v) => row.statement = v, style: const TextStyle(fontSize: 13)),
      ]),
    );
  }

  void _recalc(int i) {
    final row = _rows[i];
    final a = double.tryParse(row.amount) ?? 0.0;
    final r = double.tryParse(row.rate) ?? 1.0;
    setState(() { row.convertedAmount = r != 0 ? double.parse((a / r).toStringAsFixed(6)) : 0.0; });
  }

  Future<void> _save() async {
    for (final row in _rows) {
      if (row.accountId.isEmpty) { _snack(context, '❌ يرجى اختيار الحساب لكل قيد', error: true); return; }
      if (double.tryParse(row.amount) == null) { _snack(context, '❌ يرجى إدخال مبلغ صحيح', error: true); return; }
    }
    setState(() => _saving = true);
    try {
      for (final row in _rows) {
        await DataService.addOperation(accountId: row.accountId,
            amount: double.parse(row.amount), exchangeRate: double.tryParse(row.rate) ?? 1.0,
            currency: row.currency, statement: row.statement);
      }
      if (mounted) { Navigator.pop(context); _snack(context, '✅ تم حفظ ${_rows.length} قيد'); }
    } catch (e) { if (mounted) _snack(context, '❌ خطأ: $e', error: true); }
    finally { if (mounted) setState(() => _saving = false); }
  }
}

class _OpRow {
  String accountId, amount = '', rate = '1', currency, statement = '';
  double convertedAmount = 0.0;
  _OpRow({required this.accountId, required this.currency});
}

// ═══════════════════════════════════════════════════════════
// 📊 تبويب التقارير
// ═══════════════════════════════════════════════════════════
class _ReportsTab extends StatefulWidget {
  const _ReportsTab();
  @override State<_ReportsTab> createState() => _ReportsTabState();
}
class _ReportsTabState extends State<_ReportsTab> {
  List<Operation> _ops = []; List<Account> _accounts = [];
  String _mainCurrency = 'USD'; bool _loading = true;

  @override void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    _ops = await DataService.getOperations();
    _accounts = await DataService.getAccounts();
    _mainCurrency = await DataService.getMainCurrency();
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    final mainSym = _currencySymbol(_mainCurrency);
    double totalCredit = 0, totalDebit = 0;
    for (final op in _ops) {
      if (op.amount >= 0) {
        totalCredit += op.amountUSD;
      } else {
        totalDebit += op.amountUSD.abs();
      }
    }
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: CustomScrollView(slivers: [
          SliverAppBar(expandedHeight: h * 0.28, backgroundColor: Colors.transparent, elevation: 0,
            flexibleSpace: const FlexibleSpaceBar(centerTitle: true,
              title: Padding(padding: EdgeInsets.only(bottom: 16),
                child: Text('التقارير', style: TextStyle(color: Colors.white,
                    fontWeight: FontWeight.bold, fontSize: 28)))),
            pinned: false, floating: true),
          SliverToBoxAdapter(
            child: ClipRRect(borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(40), topRight: Radius.circular(40)),
              child: Container(color: Colors.grey.shade50, padding: const EdgeInsets.all(20),
                child: _loading ? const Center(child: CircularProgressIndicator())
                    : Column(children: [
                        const SizedBox(height: 8),
                        Row(children: [
                          Expanded(child: _rCard('إجمالي الإيرادات',
                              '${totalCredit.toStringAsFixed(2)} $mainSym',
                              Icons.trending_up, Colors.green.shade700)),
                          const SizedBox(width: 12),
                          Expanded(child: _rCard('إجمالي المصروفات',
                              '${totalDebit.toStringAsFixed(2)} $mainSym',
                              Icons.trending_down, Colors.red.shade700)),
                        ]),
                        const SizedBox(height: 12),
                        _rCard('عدد القيود', '${_ops.length} قيد', Icons.receipt_long, Colors.blue.shade700),
                        const SizedBox(height: 12),
                        _rCard('عدد الحسابات', '${_accounts.length} حساب',
                            Icons.account_balance, const Color(0xFF021B79)),
                        const SizedBox(height: 30),
                      ])),
            )),
        ]),
      ),
    );
  }

  Widget _rCard(String title, String value, IconData icon, Color color) {
    return Container(margin: const EdgeInsets.only(bottom: 4), padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8)]),
      child: Row(children: [
        Container(padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: color, size: 24)),
        const SizedBox(width: 16),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        ])),
      ]));
  }
}

// ═══════════════════════════════════════════════════════════
// ⚙️ تبويب الإعدادات
// ═══════════════════════════════════════════════════════════
class _SettingsTab extends StatefulWidget {
  const _SettingsTab();
  @override State<_SettingsTab> createState() => _SettingsTabState();
}
class _SettingsTabState extends State<_SettingsTab> {
  String _mainCurrency = 'USD';
  bool _loading = true;
  int _pendingCount = 0;
  CompanyInfo _company = const CompanyInfo(name: 'شركتي');

  @override void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final currency = await DataService.getMainCurrency();
    final count = await DataService.pendingCount();
    final company = await DataService.getCompanyInfo();
    if (mounted) {
      setState(() {
      _mainCurrency = currency; _pendingCount = count; _company = company; _loading = false;
    });
    }
  }

  void _showCompanySheet() {
    showModalBottomSheet(context: context, isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(textDirection: ui.TextDirection.rtl,
            child: _CompanySettingsSheet(company: _company, onSave: _load)));
  }

  void _showChangePassword() {
    showModalBottomSheet(context: context, isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const Directionality(textDirection: ui.TextDirection.rtl,
            child: _ChangePasswordSheet()));
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: CustomScrollView(slivers: [
          SliverAppBar(expandedHeight: h * 0.22, backgroundColor: Colors.transparent, elevation: 0,
            flexibleSpace: const FlexibleSpaceBar(centerTitle: true,
              title: Padding(padding: EdgeInsets.only(bottom: 16),
                child: Text('الإعدادات', style: TextStyle(color: Colors.white,
                    fontWeight: FontWeight.bold, fontSize: 28)))),
            pinned: false, floating: true),
          SliverToBoxAdapter(
            child: ClipRRect(borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(40), topRight: Radius.circular(40)),
              child: Container(color: Colors.grey.shade50, padding: const EdgeInsets.all(16),
                child: _loading ? const Center(child: CircularProgressIndicator())
                    : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const SizedBox(height: 10),

                        // 💎 بطاقة الاشتراك
                        ValueListenableBuilder<SubscriptionInfo>(
                          valueListenable: subscriptionNotifier,
                          builder: (_, sub, __) => Container(
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                                gradient: LinearGradient(colors: sub.plan == PlanType.free
                                    ? [Colors.grey.shade100, Colors.grey.shade200]
                                    : [const Color(0xFF021B79).withOpacity(0.05),
                                        const Color(0xFF0575E6).withOpacity(0.1)]),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: sub.plan == PlanType.free
                                    ? Colors.grey.shade300 : const Color(0xFF021B79).withOpacity(0.3))),
                            child: Column(children: [
                              Row(children: [
                                Text(sub.plan == PlanType.free ? '🆓' :
                                    sub.plan == PlanType.monthly ? '📅' :
                                    sub.plan == PlanType.yearly ? '📆' : '♾️',
                                    style: const TextStyle(fontSize: 24)),
                                const SizedBox(width: 12),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text('خطة ${sub.planName}', style: const TextStyle(
                                      fontWeight: FontWeight.bold, fontSize: 15)),
                                  if (sub.expiresAt != null)
                                    Text('تنتهي: ${sub.expiresAt!.day}/${sub.expiresAt!.month}/${sub.expiresAt!.year}',
                                        style: TextStyle(fontSize: 12,
                                            color: sub.daysLeft < 7 ? Colors.red : Colors.grey.shade600)),
                                  if (sub.plan == PlanType.lifetime)
                                    const Text('دائم ♾️', style: TextStyle(fontSize: 12, color: Color(0xFF059669))),
                                  if (sub.plan == PlanType.free)
                                    Text('15 حساب / 100 قيد',
                                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                                ])),
                                if (sub.plan == PlanType.free)
                                  ElevatedButton(
                                    onPressed: () => Navigator.push(context,
                                        MaterialPageRoute(builder: (_) => const SubscriptionScreen())),
                                    style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF021B79),
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                                    child: const Text('ترقية', style: TextStyle(
                                        color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold))),
                                if (sub.plan != PlanType.free && sub.plan != PlanType.lifetime)
                                  ElevatedButton(
                                    onPressed: () => Navigator.push(context,
                                        MaterialPageRoute(builder: (_) => const SubscriptionScreen())),
                                    style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.green.shade600,
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                                    child: const Text('تجديد', style: TextStyle(
                                        color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold))),
                              ]),
                            ]),
                          ),
                        ),

                        // 🏢 معلومات الشركة
                        _sectionHeader('🏢 معلومات الشركة'),
                        Container(padding: const EdgeInsets.all(16), margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
                              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8)]),
                          child: Column(children: [
                            _infoRow('اسم الشركة', _company.name),
                            _infoRow('الهاتف', _company.phone.isEmpty ? 'غير محدد' : _company.phone),
                            _infoRow('البريد', _company.email.isEmpty ? 'غير محدد' : _company.email),
                            _infoRow('العنوان', _company.address.isEmpty ? 'غير محدد' : _company.address),
                            const SizedBox(height: 8),
                            SizedBox(width: double.infinity,
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.edit, size: 16),
                                label: const Text('تعديل معلومات الشركة'),
                                onPressed: _showCompanySheet,
                                style: OutlinedButton.styleFrom(
                                    side: const BorderSide(color: Color(0xFF021B79)),
                                    foregroundColor: const Color(0xFF021B79)))),
                          ])),

                        // 💱 العملة
                        _sectionHeader('💱 العملة الرئيسية'),
                        Container(padding: const EdgeInsets.all(16), margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
                              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8)]),
                          child: DropdownButtonFormField<String>(initialValue: _mainCurrency, decoration: _inputDeco(''),
                            items: _supportedCurrencies().map((c) => DropdownMenuItem(value: c,
                                child: Text('$c ${_currencySymbol(c)}'))).toList(),
                            onChanged: (v) async {
                              if (v == null) return;
                              await DataService.setMainCurrency(v);
                              setState(() => _mainCurrency = v);
                              if (mounted) _snack(context, '✅ تم تغيير العملة إلى $v');
                            }, isExpanded: true)),

                        // 👤 الحساب
                        _sectionHeader('👤 الحساب'),
                        _settingsTile(title: 'تغيير كلمة المرور', icon: Icons.lock_outline, onTap: _showChangePassword),
                        _settingsTile(title: 'مزامنة يدوية', subtitle: '$_pendingCount عملية معلقة',
                            icon: Icons.sync, onTap: () async {
                              await DataService.syncNow(); await _load();
                              if (mounted) _snack(context, '✅ تمت المزامنة');
                            }),
                        _settingsTile(title: 'حذف جميع البيانات', icon: Icons.delete_forever,
                            isDestructive: true, onTap: () async {
                              final confirmed = await showDialog<bool>(context: context,
                                builder: (_) => AlertDialog(title: const Text('تحذير ⚠️'),
                                  content: const Text('هل أنت متأكد من حذف جميع البيانات؟'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
                                    ElevatedButton(onPressed: () => Navigator.pop(context, true),
                                        style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                                        child: const Text('احذف', style: TextStyle(color: Colors.white))),
                                  ]));
                              if (confirmed == true) {
                                await DataService.clearAll();
                                if (mounted) _snack(context, '✅ تم حذف البيانات');
                              }
                            }),
                        _settingsTile(title: 'تسجيل الخروج', icon: Icons.logout, isDestructive: true,
                            onTap: () async { await FirebaseAuth.instance.signOut(); }),
                        const SizedBox(height: 30),
                      ])),
            )),
        ]),
      ),
    );
  }

  Widget _sectionHeader(String title) => Padding(
    padding: const EdgeInsets.only(bottom: 8, top: 4, right: 4),
    child: Text(title, style: const TextStyle(fontSize: 13,
        fontWeight: FontWeight.bold, color: Color(0xFF021B79))));

  Widget _infoRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      SizedBox(width: 90, child: Text('$label:', style: TextStyle(fontSize: 12, color: Colors.grey.shade500))),
      Expanded(child: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          overflow: TextOverflow.ellipsis)),
    ]));

  Widget _settingsTile({required String title, String? subtitle, required IconData icon,
      required VoidCallback onTap, bool isDestructive = false}) {
    final color = isDestructive ? Colors.red : const Color(0xFF021B79);
    return Container(margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4)]),
      child: ListTile(
        leading: Container(padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color)),
        title: Text(title, style: TextStyle(color: color.withOpacity(0.9))),
        subtitle: subtitle != null ? Text(subtitle) : null,
        trailing: Icon(Icons.chevron_right, color: Colors.grey.shade400),
        onTap: onTap));
  }
}

// ═══════════════════════════════════════════════════════════
// 🏢 CompanySettingsSheet
// ═══════════════════════════════════════════════════════════
class _CompanySettingsSheet extends StatefulWidget {
  final CompanyInfo company;
  final VoidCallback onSave;
  const _CompanySettingsSheet({required this.company, required this.onSave});
  @override State<_CompanySettingsSheet> createState() => _CompanySettingsSheetState();
}
class _CompanySettingsSheetState extends State<_CompanySettingsSheet> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl, _phoneCtrl, _addressCtrl, _emailCtrl;
  bool _saving = false;
  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.company.name);
    _phoneCtrl = TextEditingController(text: widget.company.phone);
    _addressCtrl = TextEditingController(text: widget.company.address);
    _emailCtrl = TextEditingController(text: widget.company.email);
  }
  @override
  void dispose() { _nameCtrl.dispose(); _phoneCtrl.dispose(); _addressCtrl.dispose(); _emailCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Form(key: _formKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
          _sheetHandle(),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              Text('معلومات الشركة', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Spacer(), CloseButton()])),
          const Divider(height: 1),
          Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(20),
            child: Column(children: [
              _field('اسم الشركة *', _nameCtrl, validator: (v) => v!.trim().isEmpty ? 'الاسم مطلوب' : null),
              const SizedBox(height: 12),
              _field('رقم الهاتف', _phoneCtrl, type: TextInputType.phone),
              const SizedBox(height: 12),
              _field('البريد الإلكتروني', _emailCtrl, type: TextInputType.emailAddress),
              const SizedBox(height: 12),
              _field('العنوان', _addressCtrl, maxLines: 2),
            ]))),
          _saveButton(label: 'حفظ معلومات الشركة', saving: _saving, onPressed: () async {
            if (!_formKey.currentState!.validate()) return;
            setState(() => _saving = true);
            try {
              await DataService.saveCompanyInfo(CompanyInfo(name: _nameCtrl.text.trim(),
                  phone: _phoneCtrl.text.trim(), email: _emailCtrl.text.trim(), address: _addressCtrl.text.trim()));
              if (mounted) { Navigator.pop(context); widget.onSave(); _snack(context, '✅ تم حفظ معلومات الشركة'); }
            } catch (e) { if (mounted) _snack(context, '❌ خطأ: $e', error: true); }
            finally { if (mounted) setState(() => _saving = false); }
          }),
        ]))),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 🔐 ChangePasswordSheet
// ═══════════════════════════════════════════════════════════
class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet();
  @override State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}
class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _saving = false, _showC = false, _showN = false, _showCf = false;
  @override
  void dispose() { _currentCtrl.dispose(); _newCtrl.dispose(); _confirmCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.7),
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Form(key: _formKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
          _sheetHandle(),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              Text('تغيير كلمة المرور', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Spacer(), CloseButton()])),
          const Divider(height: 1),
          Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(20),
            child: Column(children: [
              TextFormField(controller: _currentCtrl, obscureText: !_showC,
                decoration: _inputDeco('كلمة المرور الحالية *').copyWith(
                  suffixIcon: IconButton(icon: Icon(_showC ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showC = !_showC))),
                validator: (v) => v!.isEmpty ? 'مطلوب' : null),
              const SizedBox(height: 12),
              TextFormField(controller: _newCtrl, obscureText: !_showN,
                decoration: _inputDeco('كلمة المرور الجديدة *').copyWith(
                  suffixIcon: IconButton(icon: Icon(_showN ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showN = !_showN))),
                validator: (v) => v!.length < 6 ? '6 أحرف على الأقل' : null),
              const SizedBox(height: 12),
              TextFormField(controller: _confirmCtrl, obscureText: !_showCf,
                decoration: _inputDeco('تأكيد كلمة المرور الجديدة *').copyWith(
                  suffixIcon: IconButton(icon: Icon(_showCf ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showCf = !_showCf))),
                validator: (v) => v != _newCtrl.text ? 'غير متطابقة' : null),
            ]))),
          _saveButton(label: 'تحديث كلمة المرور', saving: _saving, onPressed: () async {
            if (!_formKey.currentState!.validate()) return;
            final user = FirebaseAuth.instance.currentUser;
            if (user?.email == null) { _snack(context, '❌ غير مدعوم', error: true); return; }
            setState(() => _saving = true);
            try {
              final cred = EmailAuthProvider.credential(email: user!.email!, password: _currentCtrl.text);
              await user.reauthenticateWithCredential(cred);
              await user.updatePassword(_newCtrl.text);
              if (mounted) { Navigator.pop(context); _snack(context, '✅ تم تغيير كلمة المرور'); }
            } on FirebaseAuthException catch (e) {
              if (mounted) {
                _snack(context, e.code == 'wrong-password'
                  ? '❌ كلمة المرور الحالية خاطئة' : '❌ خطأ: ${e.code}', error: true);
              }
            } finally { if (mounted) setState(() => _saving = false); }
          }),
        ]))),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 🛠️ دوال مساعدة مشتركة
// ═══════════════════════════════════════════════════════════
String _currencySymbol(String c) {
  const map = {'USD': '\$', 'ILS': '₪', 'EGP': 'ج.م', 'SAR': 'ر.س',
      'JOD': 'د.أ', 'EUR': '€', 'GBP': '£', 'AED': 'د.إ', 'USDT': 'USDT'};
  return map[c] ?? c;
}

List<String> _supportedCurrencies() =>
    ['USD', 'ILS', 'EGP', 'SAR', 'JOD', 'EUR', 'GBP', 'AED', 'USDT'];

InputDecoration _inputDeco(String label, {String? suffix, String? prefix}) {
  return InputDecoration(
    labelText: label.isEmpty ? null : label, hintText: label.isEmpty ? null : label,
    suffixText: suffix, prefixText: prefix,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade300)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF021B79), width: 2)),
    filled: true, fillColor: Colors.white, isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12));
}

Widget _field(String hint, TextEditingController ctrl,
    {TextInputType type = TextInputType.text, int maxLines = 1, String? Function(String?)? validator}) {
  return TextFormField(controller: ctrl, keyboardType: type, maxLines: maxLines,
      decoration: _inputDeco(hint), validator: validator, style: const TextStyle(fontSize: 14));
}

Widget _saveButton({required String label, required bool saving, required VoidCallback onPressed}) {
  return Padding(padding: const EdgeInsets.all(16),
    child: SizedBox(width: double.infinity,
      child: ElevatedButton(onPressed: saving ? null : onPressed,
        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF021B79),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        child: saving
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : Text(label, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)))));
}

Widget _sheetHandle() => Center(child: Container(
    margin: const EdgeInsets.only(top: 12), width: 40, height: 4,
    decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))));

void _snack(BuildContext context, String msg, {bool error = false}) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg),
      backgroundColor: error ? Colors.red.shade600 : Colors.green.shade600,
      behavior: SnackBarBehavior.floating, margin: const EdgeInsets.all(16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))));
}

// ═══════════════════════════════════════════════════════════
// 📄 PDF كشف الحساب
// ═══════════════════════════════════════════════════════════
Future<void> generateAccountStatementPDF({
  required Account account, required AccountSummary summary,
  required List<Operation> operations, required String mainCurrency,
  required String companyName, required String companyAddress, required String companyPhone,
}) async {
  final pdf = pw.Document();
  final dateFormat = DateFormat('yyyy/MM/dd - HH:mm');
  final numberFormat = NumberFormat('#,##0.00');

  pw.Font? ttf, boldTtf;
  try {
    final fontData = await rootBundle.load('assets/fonts/Cairo-Regular.ttf');
    final boldFontData = await rootBundle.load('assets/fonts/Cairo-Bold.ttf');
    ttf = pw.Font.ttf(fontData); boldTtf = pw.Font.ttf(boldFontData);
  } catch (_) {}

  pw.TextStyle ts(double size, {bool bold = false, PdfColor? color}) => pw.TextStyle(
      fontSize: size, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
      font: bold ? boldTtf : ttf, color: color);

  pdf.addPage(pw.Page(pageFormat: PdfPageFormat.a4, build: (ctx) => pw.Directionality(
    textDirection: pw.TextDirection.rtl,
    child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
      pw.Container(padding: const pw.EdgeInsets.all(20),
        decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 2))),
        child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text(companyName, style: ts(18, bold: true)),
            if (companyAddress.isNotEmpty) pw.Text(companyAddress, style: ts(10)),
            if (companyPhone.isNotEmpty) pw.Text(companyPhone, style: ts(10)),
          ]),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text('كشف حساب', style: ts(20, bold: true)),
            pw.Text('تاريخ الإصدار: ${dateFormat.format(DateTime.now())}', style: ts(9)),
            pw.Text('رقم الحساب: ${account.id}', style: ts(9)),
          ]),
        ])),
      pw.SizedBox(height: 16),
      pw.Container(padding: const pw.EdgeInsets.all(12),
        decoration: pw.BoxDecoration(color: PdfColors.grey200, borderRadius: pw.BorderRadius.circular(8)),
        child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('اسم العميل: ${account.name}', style: ts(13, bold: true)),
            if (account.phone.isNotEmpty) pw.Text('هاتف: ${account.phone}', style: ts(10)),
          ]),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text('الرصيد الإجمالي ($mainCurrency):', style: ts(11)),
            pw.Text('${numberFormat.format(summary.totalUSD)} ${_currencySymbol(mainCurrency)}',
                style: ts(16, bold: true, color: summary.totalUSD >= 0 ? PdfColors.green800 : PdfColors.red800)),
          ]),
        ])),
      pw.SizedBox(height: 16),
      if (summary.balanceByCurrency.isNotEmpty) ...[
        pw.Text('الأرصدة حسب العملة:', style: ts(13, bold: true)),
        pw.SizedBox(height: 8),
        pw.Table(border: pw.TableBorder.all(width: 0.5),
          columnWidths: {0: const pw.FlexColumnWidth(2), 1: const pw.FlexColumnWidth(1.5), 2: const pw.FlexColumnWidth(1)},
          children: [
            pw.TableRow(decoration: const pw.BoxDecoration(color: PdfColors.grey300), children: [
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('العملة', textAlign: pw.TextAlign.center, style: ts(10, bold: true))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('الرصيد', textAlign: pw.TextAlign.center, style: ts(10, bold: true))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('النوع', textAlign: pw.TextAlign.center, style: ts(10, bold: true))),
            ]),
            ...summary.balanceByCurrency.entries.map((e) => pw.TableRow(children: [
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(e.key, textAlign: pw.TextAlign.center, style: ts(9))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('${numberFormat.format(e.value.abs())} ${_currencySymbol(e.key)}',
                  textAlign: pw.TextAlign.center, style: ts(9, color: e.value >= 0 ? PdfColors.green800 : PdfColors.red800))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(e.value >= 0 ? 'لنا' : 'لهم', textAlign: pw.TextAlign.center, style: ts(9))),
            ])),
          ]),
        pw.SizedBox(height: 16),
      ],
      pw.Text('تفاصيل الحركات:', style: ts(13, bold: true)),
      pw.SizedBox(height: 8),
      pw.Expanded(child: pw.Table(border: pw.TableBorder.all(width: 0.5),
        columnWidths: {0: const pw.FlexColumnWidth(2), 1: const pw.FlexColumnWidth(3),
            2: const pw.FlexColumnWidth(1.5), 3: const pw.FlexColumnWidth(1.5)},
        children: [
          pw.TableRow(decoration: const pw.BoxDecoration(color: PdfColors.grey300), children: [
            pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('التاريخ', textAlign: pw.TextAlign.center, style: ts(9, bold: true))),
            pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('البيان', textAlign: pw.TextAlign.center, style: ts(9, bold: true))),
            pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('المبلغ', textAlign: pw.TextAlign.center, style: ts(9, bold: true))),
            pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('بـ $mainCurrency', textAlign: pw.TextAlign.center, style: ts(9, bold: true))),
          ]),
          ...operations.map((op) {
            final isCredit = op.amount >= 0;
            return pw.TableRow(children: [
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(dateFormat.format(op.date), textAlign: pw.TextAlign.center, style: ts(8))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(op.statement.isNotEmpty ? op.statement : 'بدون بيان', textAlign: pw.TextAlign.center, style: ts(8))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('${isCredit ? "+" : ""}${numberFormat.format(op.amount.abs())} ${_currencySymbol(op.currency)}',
                  textAlign: pw.TextAlign.center, style: ts(8, color: isCredit ? PdfColors.green800 : PdfColors.red800))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text('${numberFormat.format(op.amountUSD)} ${_currencySymbol(mainCurrency)}',
                  textAlign: pw.TextAlign.center, style: ts(8))),
            ]);
          }),
        ])),
      pw.SizedBox(height: 20),
      pw.Divider(),
      pw.Center(child: pw.Text('تم إنشاء هذا الكشف تلقائيًا عبر منصتي المحاسبية',
          style: ts(9, color: PdfColors.grey600))),
    ]),
  )));

  await Printing.layoutPdf(onLayout: (format) async => pdf.save(),
      name: 'كشف_حساب_${account.name}_${DateTime.now().millisecondsSinceEpoch}.pdf');
}

// ═══════════════════════════════════════════════════════════
// 📱 إرسال واتساب
// ═══════════════════════════════════════════════════════════
Future<void> sendBalanceViaWhatsApp({
  required Account account, required AccountSummary summary,
  required String mainCurrency, required String companyName, BuildContext? context,
}) async {
  final now = DateTime.now();
  final dateStr = '${now.year}/${now.month.toString().padLeft(2, '0')}/${now.day.toString().padLeft(2, '0')}';
  final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  final mainSym = _currencySymbol(mainCurrency);
  final mainBalance = '${summary.totalUSD.toStringAsFixed(2)} $mainSym';

  final currenciesSection = summary.balanceByCurrency.isEmpty
      ? '│   لا توجد أرصدة'
      : summary.balanceByCurrency.entries.map((e) {
          final sym = _currencySymbol(e.key);
          return '│   • ${e.key.padRight(6)}: ${e.value.toStringAsFixed(2)} $sym';
        }).join('\n');

  final message = 'السلام عليكم ورحمة الله وبركاته\n'
      '┌─────────────────\n'
      '│ مطابقة الأرصدة\n'
      '├─────────────────\n'
      '│ اسم الحساب    : ${account.name}\n'
      '│ رقم الحساب     : ${account.id}\n'
      '│ التاريخ والوقت : $dateStr  $timeStr\n'
      '├─────────────────\n'
      '│ الرصيد الأساسي : $mainBalance\n'
      '│ تفاصيل عملات أخرى:\n'
      '$currenciesSection\n'
      '├─────────────────\n'
      '│ نرجو منكم مطابقة الأرصدة لسير العمل بسلاسة.\n'
      '│ شكراً لكم.\n'
      '│\n'
      '│ مع تحيات $companyName\n'
      '└─────────────────';

  final url = 'https://wa.me/?text=${Uri.encodeComponent(message)}';
  final uri = Uri.parse(url);
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } else if (context != null && context.mounted) {
    _snack(context, '❌ تعذر فتح تطبيق واتساب', error: true);
  }
}