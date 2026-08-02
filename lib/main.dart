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
import 'sales_sys/smain.dart';
import 'sales_sys/currencies.dart' show kAllCurrencies, currencySymbol;
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:ui' as ui;

import 'firebase_options.dart';
import 'welcome.dart';
import 'services/sync_service.dart';
import 'ai_assistant_screen.dart';
import 'dashboard_screen.dart';
import 'cashboxes.dart';
import 'notification_service.dart';
import 'splash_screen.dart';
import 'acc_sys/client_portal.dart';
import 'acc_sys/acc_service.dart';
import 'acc_sys/chart_screen.dart';
import 'acc_sys/journal_screen.dart';
import 'acc_sys/acc_reports.dart';
import 'services/update_service.dart';
import 'services/user_profile_service.dart';
import 'config/app_config.dart';
import 'onboarding/onboarding_screen.dart';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

//
//  ValueNotifiers العالمية
//
final ValueNotifier<List<Account>> accountsNotifier =
    ValueNotifier<List<Account>>([]);
final ValueNotifier<List<Operation>> operationsNotifier =
    ValueNotifier<List<Operation>>([]);
final ValueNotifier<double> balanceNotifier = ValueNotifier<double>(0.0);
final ValueNotifier<CompanyInfo> companyNotifier =
    ValueNotifier<CompanyInfo>(const CompanyInfo(name: 'شركتي'));
final ValueNotifier<SubscriptionInfo> subscriptionNotifier =
    ValueNotifier<SubscriptionInfo>(const SubscriptionInfo());

//  حالة الاتصال
final ValueNotifier<bool> isOnlineNotifier = ValueNotifier<bool>(true);

//
//  نموذج الاشتراك
//
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
      case 'monthly':
        plan = PlanType.monthly;
        break;
      case 'yearly':
        plan = PlanType.yearly;
        break;
      case 'lifetime':
        plan = PlanType.lifetime;
        break;
      default:
        plan = PlanType.free;
    }
    return SubscriptionInfo(
      plan: plan,
      expiresAt:
          j['expiresAt'] != null ? DateTime.tryParse(j['expiresAt']) : null,
      lifetimeGranted: j['lifetimeGranted'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'plan': plan.name,
        if (expiresAt != null) 'expiresAt': expiresAt!.toIso8601String(),
        'lifetimeGranted': lifetimeGranted,
      };
}

//
//  نموذج معلومات الشركة
//
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

  CompanyInfo copyWith(
          {String? name, String? phone, String? address, String? email}) =>
      CompanyInfo(
        name: name ?? this.name,
        phone: phone ?? this.phone,
        address: address ?? this.address,
        email: email ?? this.email,
      );
}

//
//  نموذج الحساب
//
class Account {
  final String id;
  final String name;
  final String phone;
  final String address;
  final String type;
  final DateTime createdAt;
  // ── حقول محاسبية جديدة ──
  final String code;              // رمز الحساب (1001, 2001...)
  final String category;          // asset/liability/equity/revenue/expense/other
  final bool   allowClientLogin;  // السماح للعميل بالدخول
  final String clientPhone;
  final String clientEmail;       // phone@acc.com
  final String clientUid;

  const Account({
    required this.id,
    required this.name,
    this.phone = '',
    this.address = '',
    this.type = 'cash',
    required this.createdAt,
    this.code = '',
    this.category = 'other',
    this.allowClientLogin = false,
    this.clientPhone = '',
    this.clientEmail = '',
    this.clientUid = '',
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'address': address,
        'type': type,
        'createdAt': createdAt.toIso8601String(),
        'code': code,
        'category': category,
        'allowClientLogin': allowClientLogin,
        'clientPhone': clientPhone,
        'clientEmail': clientEmail,
        'clientUid': clientUid,
      };

  factory Account.fromJson(Map<String, dynamic> j) => Account(
        id: j['id'] ?? '',
        name: j['name'] ?? '',
        phone: j['phone'] ?? '',
        address: j['address'] ?? '',
        type: j['type'] ?? 'cash',
        createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
        code: j['code'] ?? '',
        category: j['category'] ?? 'other',
        allowClientLogin: j['allowClientLogin'] == true,
        clientPhone: j['clientPhone'] ?? '',
        clientEmail: j['clientEmail'] ?? '',
        clientUid: j['clientUid'] ?? '',
      );

  // تصنيف نصي للعرض
  String get categoryLabel => switch (category) {
    'asset'     => 'أصول',
    'liability' => 'خصوم',
    'equity'    => 'حقوق ملكية',
    'revenue'   => 'إيرادات',
    'expense'   => 'مصروفات',
    _           => 'أخرى',
  };
}

//
//  نموذج القيد / العملية
//
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

//
//  ملخص الحساب
//
class AccountSummary {
  final double totalUSD;
  final Map<String, double> balanceByCurrency;
  const AccountSummary(
      {required this.totalUSD, required this.balanceByCurrency});
}

//
//  خدمة البيانات المركزية
//
class DataService {
  static const String _accountsKey = 'local_accounts';
  static const String _opsKey = 'local_operations';
  static const String _mainCurrencyKey = 'main_currency';
  static const String _pendingKey = 'pending_sync';
  static const String _companyKey = 'company_info';
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

  static Future<SharedPreferences> get _prefs =>
      SharedPreferences.getInstance();

  //
  //  الاشتراك
  //
  static Future<SubscriptionInfo> getSubscription() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return const SubscriptionInfo();
    try {
      final snap = await _userRef(user.uid)
          .child('subscription')
          .get()
          .timeout(const Duration(seconds: 5));
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
    _subListener =
        _userRef(user.uid).child('subscription').onValue.listen((event) {
      if (event.snapshot.exists && event.snapshot.value != null) {
        final data = Map<String, dynamic>.from(event.snapshot.value as Map);
        final sub = SubscriptionInfo.fromJson(data);
        subscriptionNotifier.value = sub;
        // تحقق من انتهاء الاشتراك
        if (!sub.isActive && sub.plan != PlanType.free) {
          subscriptionNotifier.value =
              const SubscriptionInfo(plan: PlanType.free);
        }
      }
    });
  }

  static void disposeSubscriptionListener() => _subListener?.cancel();

  // مراقبة الحسابات والقيود في الوقت الفعلي (مزامنة فورية مع نسخة الويب)
  static StreamSubscription? _accountsLiveSub;
  static StreamSubscription? _operationsLiveSub;

  static void listenToCloudData() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    _accountsLiveSub?.cancel();
    _operationsLiveSub?.cancel();

    _accountsLiveSub = _accountsRef(user.uid).onValue.listen((event) async {
      try {
        final accounts = <Account>[];
        if (event.snapshot.exists && event.snapshot.value != null) {
          final map = Map<String, dynamic>.from(event.snapshot.value as Map);
          for (final e in map.entries) {
            try {
              final v = Map<String, dynamic>.from(e.value as Map);
              if ((v['id'] as String?)?.isEmpty ?? true) v['id'] = e.key;
              accounts.add(Account.fromJson(v));
            } catch (_) {}
          }
          accounts.sort((a, b) => a.id.compareTo(b.id));
        }
        await _saveAccountsLocally(accounts);
      } catch (e) {
        debugPrint('listenToCloudData accounts error: $e');
      }
    });

    _operationsLiveSub = _opsRef(user.uid).onValue.listen((event) async {
      try {
        final ops = <Operation>[];
        if (event.snapshot.exists && event.snapshot.value != null) {
          final map = Map<String, dynamic>.from(event.snapshot.value as Map);
          for (final e in map.entries) {
            try {
              final v = Map<String, dynamic>.from(e.value as Map);
              if ((v['id'] as String?)?.isEmpty ?? true) v['id'] = e.key;
              ops.add(Operation.fromJson(v));
            } catch (_) {}
          }
        }
        await _saveOperationsLocally(ops);
        await _updateBalanceNotifier();
      } catch (e) {
        debugPrint('listenToCloudData operations error: $e');
      }
    });
  }

  static void disposeCloudDataListeners() {
    _accountsLiveSub?.cancel();
    _accountsLiveSub = null;
    _operationsLiveSub?.cancel();
    _operationsLiveSub = null;
  }

  //
  //  تهيئة Firebase
  //
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
        'companyInfo':
            companyInfo?.toJson() ?? const CompanyInfo(name: 'شركتي').toJson(),
        'subscription': const SubscriptionInfo().toJson(),
      });
    }
    if (companyInfo != null) {
      final p = await SharedPreferences.getInstance();
      await p.setString(
          '${uid}_$_companyKey', jsonEncode(companyInfo.toJson()));
    }
    unawaited(_pushPendingToFirebase());
  }

  static Future<void> initUserInFirebase({CompanyInfo? companyInfo}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    try {
      final snapshot =
          await _userRef(user.uid).get().timeout(const Duration(seconds: 6));
      if (!snapshot.exists) {
        await _userRef(user.uid).set({
          'uid': user.uid,
          'email': user.email ?? '',
          'createdAt': DateTime.now().toIso8601String(),
          'accounts': {},
          'operations': {},
          'companyInfo': companyInfo?.toJson() ??
              const CompanyInfo(name: 'شركتي').toJson(),
          'subscription': const SubscriptionInfo().toJson(),
        });
      } else {
        await syncCompanyFromCloud()
            .timeout(const Duration(seconds: 5), onTimeout: () {});
      }
      unawaited(_pushPendingToFirebase());
    } catch (e) {
      debugPrint('initUserInFirebase offline: \$e');
    }
  }

  //
  //  معلومات الشركة
  //
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

  //
  //  العملة الرئيسية
  //
  static Future<String> getMainCurrency() async {
    final p = await _prefs;
    return p.getString('$_prefix$_mainCurrencyKey') ?? 'USD';
  }

  static Future<void> setMainCurrency(String currency) async {
    final p = await _prefs;
    await p.setString('$_prefix$_mainCurrencyKey', currency);
  }

  //
  //  الحسابات
  //
  static Future<List<Account>> getAccounts() async {
    final p = await _prefs;
    final raw = p.getString('$_prefix$_accountsKey');
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      final accounts = list.map((j) => Account.fromJson(j)).toList();
      accountsNotifier.value = List.from(accounts);
      return accounts;
    } catch (e) {
      return [];
    }
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
    String code = '',
    String category = 'other',
    bool allowClientLogin = false,
    String clientPhone = '',
    String clientEmail = '',
    String clientUid = '',
  }) async {
    final id = await _nextAccountId();
    final account = Account(
        id: id,
        name: name,
        phone: phone,
        address: address,
        type: type,
        createdAt: DateTime.now(),
        code: code,
        category: category,
        allowClientLogin: allowClientLogin,
        clientPhone: clientPhone,
        clientEmail: clientEmail,
        clientUid: clientUid);
    final accounts = await getAccounts();
    accounts.add(account);
    await _saveAccountsLocally(accounts);
    await _addPending('account', 'create', id, account.toJson());
    unawaited(_pushPendingToFirebase());
    unawaited(NotificationService.notifyNewAccount(name));
    return account;
  }

  static Future<void> updateAccount({
    required String accountId,
    required String name,
    String phone = '',
    String address = '',
    String type = 'cash',
    String code = '',
    String category = 'other',
    bool allowClientLogin = false,
    String clientPhone = '',
    String clientEmail = '',
    String clientUid = '',
  }) async {
    final accounts = await getAccounts();
    final idx = accounts.indexWhere((a) => a.id == accountId);
    if (idx == -1) return;
    final updated = Account(
        id: accountId,
        name: name,
        phone: phone,
        address: address,
        type: type,
        createdAt: accounts[idx].createdAt,
        code: code,
        category: category,
        allowClientLogin: allowClientLogin,
        clientPhone: clientPhone,
        clientEmail: clientEmail,
        clientUid: clientUid);
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
    await _saveOperationsLocally(
        ops.where((o) => o.accountId != accountId).toList());
    await _addPending('account', 'delete', accountId, {'id': accountId});
    unawaited(_pushPendingToFirebase());
  }

  //
  //  القيود / العمليات
  //
  static Future<List<Operation>> getOperations() async {
    final p = await _prefs;
    final raw = p.getString('$_prefix$_opsKey');
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      final ops = list.map((j) => Operation.fromJson(j)).toList();
      operationsNotifier.value = List.from(ops);
      return ops;
    } catch (e) {
      return [];
    }
  }

  static Future<void> _saveOperationsLocally(List<Operation> ops) async {
    final p = await _prefs;
    await p.setString(
        '$_prefix$_opsKey', jsonEncode(ops.map((o) => o.toJson()).toList()));
    operationsNotifier.value = List.from(ops);
  }

  static Future<Operation> addOperation({
    required String accountId,
    required double amount,
    required double exchangeRate,
    required String currency,
    String statement = '',
    DateTime? date,
  }) async {
    final amountUSD = exchangeRate != 0
        ? double.parse((amount / exchangeRate).toStringAsFixed(6))
        : 0.0;
    final id = '${DateTime.now().millisecondsSinceEpoch}_$accountId';
    final op = Operation(
        id: id,
        accountId: accountId,
        amount: amount,
        exchangeRate: exchangeRate,
        currency: currency,
        amountUSD: amountUSD,
        statement: statement,
        date: date ?? DateTime.now());
    final ops = await getOperations();
    ops.add(op);
    await _saveOperationsLocally(ops);
    await _updateBalanceNotifier();
    await _addPending('operation', 'create', id, op.toJson());
    unawaited(_pushPendingToFirebase());
    // إشعار حركة كبيرة (> 500 USD)
    if (amountUSD.abs() > 500) {
      unawaited(NotificationService.notifyLargeTransaction(
          amount: amount, currency: currency, threshold: 500));
    }
    return op;
  }

  static Future<void> updateOperation({
    required String opId,
    required double amount,
    required double exchangeRate,
    required String currency,
    required String statement,
    DateTime? date,
  }) async {
    final ops = await getOperations();
    final idx = ops.indexWhere((o) => o.id == opId);
    if (idx == -1) return;
    final amountUSD = exchangeRate != 0
        ? double.parse((amount / exchangeRate).toStringAsFixed(6))
        : 0.0;
    final updated = Operation(
        id: opId,
        accountId: ops[idx].accountId,
        amount: amount,
        exchangeRate: exchangeRate,
        currency: currency,
        amountUSD: amountUSD,
        statement: statement,
        date: date ?? ops[idx].date);
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
    return AccountSummary(
        totalUSD: double.parse(totalUSD.toStringAsFixed(6)),
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

  //
  //  Pending Sync
  //
  static Future<List<Map<String, dynamic>>> _getPending() async {
    final p = await _prefs;
    final raw = p.getString('$_prefix$_pendingKey');
    if (raw == null) return [];
    try {
      return List<Map<String, dynamic>>.from(jsonDecode(raw));
    } catch (_) {
      return [];
    }
  }

  static Future<void> _savePending(List<Map<String, dynamic>> pending) async {
    final p = await _prefs;
    await p.setString('$_prefix$_pendingKey', jsonEncode(pending));
  }

  static Future<void> _addPending(String entity, String action, String id,
      Map<String, dynamic> data) async {
    final pending = await _getPending();
    pending.removeWhere((p) => p['id'] == id && p['entity'] == entity);
    pending.add({
      'entity': entity,
      'action': action,
      'id': id,
      'data': data,
      'ts': DateTime.now().toIso8601String()
    });
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
            ? _accountsRef(user.uid).child(id)
            : _opsRef(user.uid).child(id);
        if (action == 'create') {
          await ref.set(data);
        } else if (action == 'delete') { await ref.remove(); }
        succeeded.add('${entity}_$id');
      } catch (e) {
        debugPrint(' فشل مزامنة: ${item['id']} — $e');
      }
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
    } catch (_) {
      return false;
    }
  }

  static Future<void> syncNow() => _pushPendingToFirebase();
  static Future<bool> checkOnline() => _isOnline();

  // مراقبة الاتصال
  static StreamSubscription? _connectivitySub;
  static void startConnectivityMonitor() {
    if (kIsWeb) {
      isOnlineNotifier.value = true;
      return;
    }
    _connectivitySub?.cancel();
    _connectivitySub =
        Connectivity().onConnectivityChanged.listen((result) async {
      final online = !(result.contains(ConnectivityResult.none) || result.isEmpty);
      isOnlineNotifier.value = online;
      if (online) {
        await Future.delayed(const Duration(milliseconds: 800));
        await _pushPendingToFirebase();
        // مزامنة من السحابة عند استعادة الاتصال
        try {
          final user = FirebaseAuth.instance.currentUser;
          if (user != null) {
            await SyncService()
                .syncFromCloud()
                .timeout(const Duration(seconds: 10), onTimeout: () {});
            await getAccounts();
            await getOperations();
            balanceNotifier.value = await getTotalBalanceUSD();
          }
        } catch (_) {}
      }
    });
    Connectivity().checkConnectivity().then((r) {
      isOnlineNotifier.value = !(r.contains(ConnectivityResult.none) || r.isEmpty);
    });
  }

  static void stopConnectivityMonitor() => _connectivitySub?.cancel();

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

//
//  نقطة الدخول
//
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

//  التطبيق الجذر
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
        visualDensity: VisualDensity.compact,
      ),
      home: const SplashScreen(),
    );
  }
}

//  شاشة البداية: تهيئة Firebase ثم التوجيه
class _SplashBoot extends StatefulWidget {
  const _SplashBoot();
  @override
  State<_SplashBoot> createState() => _SplashBootState();
}

class _SplashBootState extends State<_SplashBoot>
    with TickerProviderStateMixin {
  late AnimationController _logoCtrl, _textCtrl;
  late Animation<double> _logoScale, _logoFade, _textFade;
  late Animation<Offset> _textSlide;
  bool _done = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _logoCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 850));
    _logoScale = Tween<double>(begin: 0.3, end: 1.0)
        .animate(CurvedAnimation(parent: _logoCtrl, curve: Curves.elasticOut));
    _logoFade = Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(parent: _logoCtrl, curve: const Interval(0, 0.5)));
    _textCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _textFade = Tween<double>(begin: 0, end: 1)
        .animate(CurvedAnimation(parent: _textCtrl, curve: Curves.easeOut));
    _textSlide = Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero)
        .animate(
            CurvedAnimation(parent: _textCtrl, curve: Curves.easeOutCubic));
    _logoCtrl.forward().then((_) => _textCtrl.forward());
    _boot();
  }

  Future<void> _boot() async {
    // شغّل Firebase والأنيميشن بالتوازي
    await Future.wait([
      _initFirebaseAsync(),
      Future.delayed(const Duration(milliseconds: 800)),
    ]);
    _navigate();
  }

  Future<void> _initFirebaseAsync() async {
    try {
      await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform);
    } catch (_) {}
    try {
      await initializeDateFormatting('ar');
    } catch (_) {}
    if (mounted) setState(() => _done = true);
  }

  void _navigate() {
    if (_navigated || !mounted) return;
    _navigated = true;
    Navigator.of(context).pushReplacement(PageRouteBuilder(
      pageBuilder: (_, __, ___) => const AuthWrapper(),
      transitionsBuilder: (_, anim, __, child) =>
          FadeTransition(opacity: anim, child: child),
      transitionDuration: const Duration(milliseconds: 400),
    ));
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _textCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF021B79), Color(0xFF0575E6)]),
        ),
        child: SafeArea(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Spacer(flex: 2),
            ScaleTransition(
              scale: _logoScale,
              child: FadeTransition(
                opacity: _logoFade,
                child: Container(
                  width: 110,
                  height: 110,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(34),
                    border: Border.all(
                        color: Colors.white.withValues(alpha: 0.3), width: 2),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.25),
                          blurRadius: 36,
                          offset: const Offset(0, 12))
                    ],
                  ),
                  child: const Icon(Icons.account_balance,
                      size: 54, color: Colors.white),
                ),
              ),
            ),
            const SizedBox(height: 32),
            SlideTransition(
              position: _textSlide,
              child: FadeTransition(
                opacity: _textFade,
                child: Column(children: [
                  const Text('منصتي المحاسبية',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                          fontFamily: 'Cairo')),
                  const SizedBox(height: 8),
                  Text('إدارة حساباتك بكل سهولة وأمان',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 13,
                          fontFamily: 'Cairo')),
                ]),
              ),
            ),
            const Spacer(flex: 2),
            FadeTransition(
              opacity: _textFade,
              child: _done
                  ? Icon(Icons.check_circle_outline,
                      color: Colors.white.withValues(alpha: 0.8), size: 24)
                  : const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2.5)),
            ),
            const SizedBox(height: 48),
          ]),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
//  UserRoleService — مركز إدارة أدوار المستخدمين
//  يحفظ الدور محلياً في SharedPreferences للعمل الفوري بدون انترنت
// ═══════════════════════════════════════════════════════════════════
class UserRoleService {
  static const _kRole  = 'urole_';   // 'owner' | 'cashier'
  static const _kOwner = 'uowner_';  // uid صاحب العمل

  /// يقرأ الدور المحفوظ فوراً (بدون انتظار)
  static Future<String?> getCachedRole(String uid) async {
    final p = await SharedPreferences.getInstance();
    return p.getString('$_kRole$uid');
  }

  /// يقرأ ownerUid المحفوظ للكاشير
  static Future<String?> getCachedOwnerUid(String uid) async {
    final p = await SharedPreferences.getInstance();
    return p.getString('$_kOwner$uid');
  }

  /// يحفظ الدور محلياً
  static Future<void> saveRole(String uid, String role, {String? ownerUid}) async {
    final p = await SharedPreferences.getInstance();
    await p.setString('$_kRole$uid', role);
    if (ownerUid != null) await p.setString('$_kOwner$uid', ownerUid);
  }

  /// يمسح الدور عند تسجيل الخروج
  static Future<void> clearRole(String uid) async {
    final p = await SharedPreferences.getInstance();
    await p.remove('$_kRole$uid');
    await p.remove('$_kOwner$uid');
  }

  /// يسأل Firebase ويحفظ النتيجة — يُستدعى عند بدء التطبيق وعند تسجيل الدخول
  static Future<_RoleResult> fetchAndSave(String uid) async {
    try {
      final snap = await FirebaseDatabase.instance
          .ref('employeeOwnerMap/$uid')
          .get()
          .timeout(const Duration(seconds: 8));
      if (snap.exists && snap.value != null) {
        final ownerUid = snap.value as String;
        await saveRole(uid, 'cashier', ownerUid: ownerUid);
        return _RoleResult(isCashier: true, ownerUid: ownerUid);
      }
    } catch (_) {}
    await saveRole(uid, 'owner');
    return const _RoleResult(isCashier: false);
  }
}

class _RoleResult {
  final bool isCashier;
  final String? ownerUid;
  const _RoleResult({required this.isCashier, this.ownerUid});
}

// ═══════════════════════════════════════════════════════════════════
//  AuthWrapper — يوجّه المستخدم للشاشة الصحيحة بحسب دوره
// ═══════════════════════════════════════════════════════════════════
class AuthWrapper extends StatefulWidget {
  const AuthWrapper();
  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  Widget? _screen;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  Future<void> _resolve() async {
    // انتظر Firebase Auth إذا لم يكن جاهزاً
    User? user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      // انتظر ثانية واحدة كحد أقصى لتهيئة Firebase
      await Future.any([
        FirebaseAuth.instance.authStateChanges().firstWhere((u) => u != null),
        Future.delayed(const Duration(seconds: 1)),
      ]).catchError((_) => null);
      user = FirebaseAuth.instance.currentUser;
    }

    if (user == null) {
      if (mounted) setState(() => _screen = const WelcomeScreen());
      return;
    }

    // ── كشف حساب العميل (@acc.com) ──────────────────────────
    if (user.email?.endsWith('@acc.com') == true) {
      final mapping = await AccService.getClientMapping(user.uid);
      if (mapping != null) {
        if (mounted) setState(() => _screen = ClientPortalScreen(
          ownerUid: mapping.ownerUid, accountId: mapping.accountId));
      } else {
        // ربط غير موجود — تسجيل خروج
        await FirebaseAuth.instance.signOut();
        if (mounted) setState(() => _screen = const WelcomeScreen());
      }
      return;
    }

    // 1. حاول القراءة من الذاكرة المحلية أولاً (فوري)
    final cachedRole = await UserRoleService.getCachedRole(user.uid);

    if (cachedRole == 'cashier') {
      final ownerUid = await UserRoleService.getCachedOwnerUid(user.uid);
      if (ownerUid != null && ownerUid.isNotEmpty) {
        if (mounted) {
          setState(() => _screen = _CashierShell(ownerUid: ownerUid));
        }
        // تحديث من Firebase في الخلفية (لضمان صحة البيانات)
        _refreshRoleInBackground(user.uid);
        return;
      }
    }

    if (cachedRole == 'owner') {
      await _resolveOwnerScreen();
      _refreshRoleInBackground(user.uid);
      return;
    }

    // 2. لا يوجد كاش — اسأل Firebase (يحدث فقط في أول تشغيل أو بعد مسح البيانات)
    final result = await UserRoleService.fetchAndSave(user.uid);
    if (!mounted) return;

    if (result.isCashier && result.ownerUid != null) {
      setState(() => _screen = _CashierShell(ownerUid: result.ownerUid!));
    } else {
      await _resolveOwnerScreen();
    }
  }

  /// يتحقق من الـ Onboarding ويوجّه للشاشة المناسبة
  Future<void> _resolveOwnerScreen() async {
    // حمّل AppConfig إذا أكمل المستخدم الـ Onboarding مسبقاً
    final done = await UserProfileService.isOnboardingDone();
    if (done) {
      final profile = await UserProfileService.load();
      if (profile != null) appConfigNotifier.value = AppConfig.from(profile);
    }
    if (!mounted) return;
    if (done) {
      setState(() => _screen = const MainWithGuide());
    } else {
      setState(() => _screen = OnboardingScreen(
        onDone: () => setState(() => _screen = const MainWithGuide()),
      ));
    }
  }

  /// يتحقق من الدور في الخلفية ويحدّث الشاشة إذا تغيّر
  Future<void> _refreshRoleInBackground(String uid) async {
    try {
      final result = await UserRoleService.fetchAndSave(uid);
      if (!mounted) return;
      final currentIsCashier = _screen is _CashierShell;
      if (result.isCashier != currentIsCashier) {
        // الدور تغيّر — أعد التوجيه
        if (result.isCashier && result.ownerUid != null) {
          setState(() => _screen = _CashierShell(ownerUid: result.ownerUid!));
        } else {
          setState(() => _screen = const MainWithGuide());
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return _screen ?? const Scaffold(
      backgroundColor: Color(0xFF021B79),
      body: Center(
        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
      ),
    );
  }
}

/// غلاف شاشة الكاشير — يمنع الرجوع للخلف
class _CashierShell extends StatelessWidget {
  final String ownerUid;
  const _CashierShell({required this.ownerUid});
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (_, __) {},
    child: SalesRootScreen(ownerUid: ownerUid),
  );
}

//  يعرض الـ Guide عند أول دخول فقط
class MainWithGuide extends StatefulWidget {
  const MainWithGuide();
  @override
  State<MainWithGuide> createState() => _MainWithGuideState();
}

class _MainWithGuideState extends State<MainWithGuide> {
  bool _showGuide = false;
  @override
  void initState() {
    super.initState();
    _checkGuide();
  }

  Future<void> _checkGuide() async {
    final prefs = await SharedPreferences.getInstance();
    final shown = prefs.getBool('guide_shown_v1') ?? false;
    if (!shown && mounted) {
      Future.delayed(const Duration(milliseconds: 1200), () {
        if (mounted) setState(() => _showGuide = true);
      });
    }
  }

  void _dismissGuide() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('guide_shown_v1', true);
    if (mounted) setState(() => _showGuide = false);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      const MainScreen(),
      if (_showGuide) _OnboardingGuide(onDone: _dismissGuide),
    ]);
  }
}

//  دليل الاستخدام
class _OnboardingGuide extends StatefulWidget {
  final VoidCallback onDone;
  const _OnboardingGuide({required this.onDone});
  @override
  State<_OnboardingGuide> createState() => _OnboardingGuideState();
}

class _OnboardingGuideState extends State<_OnboardingGuide>
    with SingleTickerProviderStateMixin {
  int _page = 0;
  late AnimationController _ctrl;
  late Animation<double> _fade;
  late Animation<Offset> _slide;

  static const _pages = [
    _GuideData(
        emoji: '',
        title: 'مرحباً بك في منصتي المحاسبية',
        desc:
            'نظام محاسبي متكامل يعمل على الإنترنت وبدونه. بياناتك محفوظة دائماً ومزامنة تلقائياً.',
        color: Color(0xFF021B79),
        steps: []),
    _GuideData(
        emoji: '',
        title: 'إنشاء وإدارة الحسابات',
        desc: 'أنشئ حسابات للعملاء والموردين والموظفين بسهولة.',
        color: Color(0xFF0575E6),
        steps: [
          '① اضغط تبويب "الحسابات" في الشريط السفلي',
          '② اضغط + في الأعلى لإنشاء حساب جديد',
          '③ أدخل اسم الحساب ورقم الهاتف والنوع',
          '④ اضغط على الحساب للتعديل أو الحذف',
        ]),
    _GuideData(
        emoji: '',
        title: 'إضافة وتعديل القيود',
        desc: 'سجّل عملياتك المالية بأي عملة مع التحويل التلقائي.',
        color: Color(0xFF059669),
        steps: [
          '① افتح أي حساب واضغط "إضافة قيد جديد"',
          '② موجب (+) = مبلغ لك، سالب (−) = مبلغ عليك',
          '③ اختر العملة وأدخل سعر الصرف إن احتجت',
          '④ اضغط على القيد لتعديله أو حذفه',
        ]),
    _GuideData(
        emoji: '',
        title: 'كشف الحساب والمطابقة',
        desc: 'شارك أرصدة الحسابات بضغطة واحدة.',
        color: Color(0xFF7C3AED),
        steps: [
          '① افتح تفاصيل أي حساب',
          '② اضغط  لتوليد كشف حساب PDF احترافي',
          '③ اضغط  لإرسال مطابقة الأرصدة عبر واتساب',
          '④ الكشف يتضمن: الرصيد + جميع العمليات',
        ]),
    _GuideData(
        emoji: '',
        title: 'خطتك وترقية الاشتراك',
        desc: 'الخطة المجانية: 15 حساب و100 قيد. الترقية تُزيل جميع الحدود.',
        color: Color(0xFFD97706),
        steps: [
          '① اذهب إلى تبويب "الإعدادات"',
          '② ستجد بطاقة خطتك الحالية مع تفاصيل الحدود',
          '③ اضغط "ترقية" لعرض الخطط المتاحة',
          '④ التواصل عبر واتساب لتفعيل الاشتراك فوراً',
        ]),
    _GuideData(
        emoji: '',
        title: 'يعمل بدون إنترنت',
        desc:
            'بياناتك محفوظة محلياً دائماً. عند عودة الإنترنت تتم المزامنة تلقائياً.',
        color: Color(0xFF0F766E),
        steps: [
          '① جميع البيانات محفوظة على جهازك',
          '② أضف وعدّل حتى بدون إنترنت',
          '③ مزامنة تلقائية فور عودة الاتصال',
          '④ شريط برتقالي يُعلمك بحالة الاتصال',
        ]),
  ];

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 380));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _slide = Tween<Offset>(begin: const Offset(0, 0.05), end: Offset.zero)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _goTo(int page) async {
    await _ctrl.reverse();
    if (mounted) {
      setState(() => _page = page);
      _ctrl.forward();
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _pages[_page];
    final isLast = _page == _pages.length - 1;
    return Material(
      color: Colors.black.withValues(alpha: 0.72),
      child: SafeArea(
        child: Center(
          child: FadeTransition(
            opacity: _fade,
            child: SlideTransition(
              position: _slide,
              child: Container(
                margin:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(26),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.28),
                          blurRadius: 36,
                          offset: const Offset(0, 14))
                    ]),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  // Header
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 22),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                          colors: [p.color, p.color.withValues(alpha: 0.7)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight),
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(26)),
                    ),
                    child: Column(children: [
                      Text(p.emoji, style: const TextStyle(fontSize: 46)),
                      const SizedBox(height: 8),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(p.title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                height: 1.3)),
                      ),
                    ]),
                  ),
                  // Body
                  Flexible(
                      child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.desc,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  fontSize: 13.5,
                                  color: Color(0xFF4B5563),
                                  height: 1.6)),
                          if (p.steps.isNotEmpty) ...[
                            const SizedBox(height: 14),
                            ...p.steps.map((s) => Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                            width: 3,
                                            height: 3,
                                            margin: const EdgeInsets.only(
                                                top: 7, left: 8),
                                            decoration: BoxDecoration(
                                                color: p.color,
                                                shape: BoxShape.circle)),
                                        Expanded(
                                            child: Text(s,
                                                style: const TextStyle(
                                                    fontSize: 13,
                                                    color: Color(0xFF374151),
                                                    height: 1.5))),
                                      ]),
                                )),
                          ],
                        ]),
                  )),
                  // Dots
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                            _pages.length,
                            (i) => AnimatedContainer(
                                  duration: const Duration(milliseconds: 280),
                                  width: i == _page ? 20 : 6,
                                  height: 6,
                                  margin:
                                      const EdgeInsets.symmetric(horizontal: 3),
                                  decoration: BoxDecoration(
                                    color: i == _page
                                        ? p.color
                                        : Colors.grey.shade300,
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                ))),
                  ),
                  // Buttons
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                    child: Column(children: [
                      Row(children: [
                        if (_page > 0) ...[
                          Expanded(
                              child: OutlinedButton(
                            onPressed: () => _goTo(_page - 1),
                            style: OutlinedButton.styleFrom(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                side: BorderSide(color: p.color),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12))),
                            child: Text('← السابق',
                                style: TextStyle(
                                    color: p.color,
                                    fontWeight: FontWeight.bold)),
                          )),
                          const SizedBox(width: 10),
                        ],
                        Expanded(
                          flex: _page > 0 ? 1 : 2,
                          child: ElevatedButton(
                            onPressed:
                                isLast ? widget.onDone : () => _goTo(_page + 1),
                            style: ElevatedButton.styleFrom(
                                backgroundColor: p.color,
                                elevation: 0,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12))),
                            child: Text(isLast ? 'ابدأ الآن ' : 'التالي →',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14)),
                          ),
                        ),
                      ]),
                      if (!isLast) ...[
                        const SizedBox(height: 6),
                        GestureDetector(
                            onTap: widget.onDone,
                            child: const Padding(
                                padding: EdgeInsets.symmetric(vertical: 3),
                                child: Text('تخطي',
                                    style: TextStyle(
                                        color: Colors.grey, fontSize: 12)))),
                      ],
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GuideData {
  final String emoji, title, desc;
  final Color color;
  final List<String> steps;
  const _GuideData(
      {required this.emoji,
      required this.title,
      required this.desc,
      required this.color,
      required this.steps});
}

//
//  الشاشة الرئيسية
//
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
    _syncTimer = Timer.periodic(
        const Duration(minutes: 1), (_) => DataService.syncNow());
    DataService.startConnectivityMonitor();
    // فحص الاشتراك كل 30 دقيقة
    _subCheckTimer = Timer.periodic(const Duration(minutes: 30), (_) async {
      await DataService.getSubscription();
      _checkSubscriptionWarnings();
    });
  }

  Future<void> _init() async {
    //  1. تحميل البيانات المحلية فوراً (لا يحتاج إنترنت)
    _setStatus('جاري تحميل البيانات...');
    await DataService.getAccounts();
    await DataService.getOperations();
    await DataService.getCompanyInfo();
    await CashboxService.init();
    await NotificationService.init();
    balanceNotifier.value = await DataService.getTotalBalanceUSD();

    //  2. عرض التطبيق فوراً
    if (mounted) setState(() => _ready = true);

    //  3. تحقق من التحديث (بعد عرض التطبيق بثانيتين)
    Future.delayed(const Duration(seconds: 2), () async {
      if (!mounted) return;
      // هل تم التحديث للتو؟ اعرض رسالة النجاح
      await UpdateService.checkJustUpdated(context);
      // هل يوجد تحديث جديد؟
      if (mounted) await UpdateService.checkForUpdate(context);
    });

    //  4. مزامنة السحابة في الخلفية
    _syncBackground();
  }

  Future<void> _syncBackground() async {
    final online = await DataService.checkOnline();
    if (!online) return;
    try {
      await DataService.initUserInFirebase()
          .timeout(const Duration(seconds: 8), onTimeout: () {});
      await SyncService()
          .syncFromCloud()
          .timeout(const Duration(seconds: 10), onTimeout: () {});
      await DataService.getAccounts();
      await DataService.getOperations();
      await DataService.getCompanyInfo();
      balanceNotifier.value = await DataService.getTotalBalanceUSD();
      await DataService.getSubscription().timeout(const Duration(seconds: 5),
          onTimeout: () => const SubscriptionInfo());
      DataService.listenToSubscription();
      // مزامنة فورية Live مع نسخة الويب: أي تعديل هناك يظهر هنا مباشرة
      DataService.listenToCloudData();
      if (mounted) { Future.delayed(const Duration(seconds: 1), _checkSubscriptionWarnings); }
    } catch (e) {
      debugPrint('syncBackground: \$e');
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
      _snack(context, ' اشتراكك ينتهي خلال $days يوم! يرجى التجديد.');
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
    DataService.disposeCloudDataListeners();
    DataService.stopConnectivityMonitor();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) return _LoadingScreen(message: _loadingText);
    final screens = [
      const _HomeTab(),
      const _AccountsTab(),
      const _CashboxesTab(),
      const _AnalyticsTab(),
      const _SettingsTab(),
    ];
    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        transitionBuilder: (child, anim) => FadeTransition(
          opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
          child: child,
        ),
        child: KeyedSubtree(
          key: ValueKey(_selectedIndex),
          child: screens[_selectedIndex],
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ValueListenableBuilder<bool>(
            valueListenable: isOnlineNotifier,
            builder: (_, online, __) => AnimatedContainer(
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeInOut,
              height: online ? 0 : 32,
              color: Colors.orange.shade700,
              child: online
                  ? const SizedBox.shrink()
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.wifi_off,
                            color: Colors.white, size: 13),
                        const SizedBox(width: 6),
                        const Text(
                            'وضع عدم الاتصال — سيتم المزامنة فور الاتصال',
                            style:
                                TextStyle(color: Colors.white, fontSize: 11)),
                      ],
                    ),
            ),
          ),
          _BottomNav(
            selectedIndex: _selectedIndex,
            onTap: (i) => setState(() => _selectedIndex = i),
          ),
        ],
      ),
    );
  }
}

//
// ⏳ شاشة التحميل
//
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
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600))
      ..repeat(reverse: true);
    _fade = Tween(begin: 0.5, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
            gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: Center(
            child:
                Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Text('منصتي المحاسبية',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2)),
          const SizedBox(height: 48),
          const SizedBox(
              width: 52,
              height: 52,
              child: CircularProgressIndicator(
                  color: Colors.white, strokeWidth: 3)),
          const SizedBox(height: 32),
          FadeTransition(
              opacity: _fade,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                transitionBuilder: (child, anim) =>
                    FadeTransition(opacity: anim, child: child),
                child: Text(widget.message,
                    key: ValueKey(widget.message),
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 15),
                    textAlign: TextAlign.center),
              )),
        ])),
      ),
    );
  }
}

//
//  شريط التنقل السفلي
//
class _BottomNav extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;
  const _BottomNav({required this.selectedIndex, required this.onTap});
  Widget _navItem(int i, IconData off, IconData on, String label) {
    final sel = selectedIndex == i;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap(i);
      },
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: sel
              ? const Color(0xFF021B79).withValues(alpha: 0.09)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            transitionBuilder: (child, anim) =>
                ScaleTransition(scale: anim, child: child),
            child: Icon(sel ? on : off,
                key: ValueKey(sel),
                color: sel ? const Color(0xFF021B79) : Colors.grey.shade500,
                size: sel ? 24 : 22),
          ),
          const SizedBox(height: 2),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 220),
            style: TextStyle(
              fontSize: 10,
              fontWeight: sel ? FontWeight.bold : FontWeight.normal,
              color: sel ? const Color(0xFF021B79) : Colors.grey.shade500,
              fontFamily: 'Cairo',
            ),
            child: Text(label),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      height: 70,
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(35),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 15,
                offset: const Offset(0, 2))
          ]),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _navItem(0, Icons.dashboard_outlined, Icons.dashboard, 'الرئيسية'),
          _navItem(1, Icons.account_balance_wallet_outlined,
              Icons.account_balance_wallet, 'الحسابات'),
          _navItem(2, Icons.inventory_2_outlined, Icons.inventory_2, 'الصناديق'),
          _navItem(3, Icons.analytics_outlined, Icons.analytics, 'تحليلات'),
          _navItem(4, Icons.settings_outlined, Icons.settings, 'الإعدادات'),
        ],
      ),
    );
  }
}

//
//  شاشة الترقية / الاشتراك
//
class SubscriptionScreen extends StatelessWidget {
  final String? message;
  const SubscriptionScreen({super.key, this.message});

  static const _whatsappNumber = '+972569988062';

  Future<void> _contactWhatsApp(String plan) async {
    final msg = 'مرحباً، أريد الاشتراك في خطة $plan في منصتي المحاسبية';
    final url =
        'https://wa.me/${_whatsappNumber.replaceAll('+', '')}?text=${Uri.encodeComponent(msg)}';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
            gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: SafeArea(
          child: Column(children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(children: [
                IconButton(
                    icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                    onPressed: () => Navigator.pop(context)),
                const Expanded(
                    child: Text('ترقية الاشتراك',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center)),
                const SizedBox(width: 48),
              ]),
            ),

            if (message != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.orange.shade300)),
                child: Row(children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                  const SizedBox(width: 8),
                  Expanded(
                      child: Text(message!,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 13))),
                ]),
              ),

            const SizedBox(height: 16),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(children: [
                  _PlanCard(
                    title: ' مجاني',
                    price: '\$0.00',
                    period: 'دائماً',
                    color: Colors.grey.shade600,
                    features: const ['15 حساب', '100 قيد', 'ميزات أساسية'],
                    isCurrent: subscriptionNotifier.value.plan == PlanType.free,
                    onTap: null,
                  ),
                  const SizedBox(height: 12),
                  _PlanCard(
                    title: ' شهري',
                    price: '\$49.99',
                    period: 'شهرياً',
                    color: const Color(0xFF0575E6),
                    features: const [
                      'حسابات غير محدودة',
                      'قيود غير محدودة',
                      'كشف حساب PDF',
                      'إرسال واتساب',
                      'دعم أولوية'
                    ],
                    isCurrent:
                        subscriptionNotifier.value.plan == PlanType.monthly,
                    isPopular: false,
                    onTap: () => _contactWhatsApp('الشهري — \$49.99'),
                  ),
                  const SizedBox(height: 12),
                  _PlanCard(
                    title: ' سنوي',
                    price: '\$449.99',
                    period: 'سنوياً',
                    color: const Color(0xFF059669),
                    features: const [
                      'حسابات غير محدودة',
                      'قيود غير محدودة',
                      'جميع الميزات',
                      'توفير 25%',
                      'أولوية دعم فائقة'
                    ],
                    isCurrent:
                        subscriptionNotifier.value.plan == PlanType.yearly,
                    isPopular: true,
                    onTap: () => _contactWhatsApp('السنوي — \$449.99'),
                  ),
                  const SizedBox(height: 12),
                  _PlanCard(
                    title: ' مدى الحياة',
                    price: '\$999.99',
                    period: 'دفعة واحدة',
                    color: const Color(0xFFD97706),
                    features: const [
                      'كل شيء غير محدود',
                      'تحديثات مجانية للأبد',
                      'أفضل قيمة',
                      'دعم VIP',
                      'لا تجديد أبداً'
                    ],
                    isCurrent:
                        subscriptionNotifier.value.plan == PlanType.lifetime,
                    onTap: () => _contactWhatsApp('مدى الحياة — \$999.99'),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16)),
                    child: Column(children: [
                      const Text(' كيفية الاشتراك',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15)),
                      const SizedBox(height: 8),
                      const Text(
                        '١. اضغط على الخطة المناسبة\n'
                        '٢. ستنتقل إلى واتساب تلقائياً\n'
                        '٣. أكمل الدفع وسيتم تفعيل اشتراكك فوراً',
                        style: TextStyle(
                            color: Colors.white70, fontSize: 13, height: 1.7),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        icon: const FaIcon(FontAwesomeIcons.whatsapp,
                            color: Color(0xFF25D366)),
                        label: const Text('تواصل معنا عبر واتساب',
                            style: TextStyle(fontWeight: FontWeight.bold)),
                        onPressed: () => _contactWhatsApp('اشتراك'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFF021B79),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
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
  const _PlanCard(
      {required this.title,
      required this.price,
      required this.period,
      required this.color,
      required this.features,
      this.isCurrent = false,
      this.isPopular = false,
      this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: isCurrent ? Border.all(color: color, width: 3) : null,
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10)
        ],
      ),
      child: Column(children: [
        if (isPopular)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 6),
            decoration: BoxDecoration(
                color: color,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(17))),
            child: const Text(' الأكثر شعبية',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold)),
          ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Row(children: [
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(title,
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: color)),
                    const SizedBox(height: 4),
                    RichText(
                        text: TextSpan(children: [
                      TextSpan(
                          text: price,
                          style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: color)),
                      TextSpan(
                          text: ' / $period',
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade500)),
                    ])),
                  ])),
              if (isCurrent)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20)),
                  child: Text('خطتك الحالية',
                      style: TextStyle(
                          color: color,
                          fontSize: 11,
                          fontWeight: FontWeight.bold)),
                ),
            ]),
            const SizedBox(height: 12),
            ...features.map((f) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(children: [
                    Icon(Icons.check_circle, color: color, size: 16),
                    const SizedBox(width: 8),
                    Text(f,
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF374151))),
                  ]),
                )),
            if (onTap != null) ...[
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const FaIcon(FontAwesomeIcons.whatsapp, size: 16),
                  label: const Text('اشترك الآن عبر واتساب',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: onTap,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: color,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
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

//  Dialog انتهاء الاشتراك
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
              style:
                  TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          onPressed: () {
            Navigator.pop(context);
            Navigator.push(context,
                MaterialPageRoute(builder: (_) => const SubscriptionScreen()));
          },
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF021B79),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12))),
        ),
      ],
    );
  }
}

//  Banner الاشتراك للصفحات
class _SubscriptionBanner extends StatelessWidget {
  final int accountCount;
  final int opCount;
  const _SubscriptionBanner(
      {required this.accountCount, required this.opCount});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<SubscriptionInfo>(
      valueListenable: subscriptionNotifier,
      builder: (_, sub, __) {
        if (sub.plan != PlanType.free) {
          // تحذير انتهاء قريب
          if (sub.daysLeft >= 0 &&
              sub.daysLeft <= 7 &&
              sub.plan != PlanType.lifetime) {
            return _buildWarning(context,
                ' اشتراكك ينتهي خلال ${sub.daysLeft} يوم', Colors.orange);
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
        return _buildWarning(
            context, ' $msg — قرّب الحد المجاني', Colors.blue.shade700);
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
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(children: [
          Expanded(
              child: Text(msg,
                  style: TextStyle(
                      color: color,
                      fontSize: 12,
                      fontWeight: FontWeight.w600))),
          Text('ترقية ←',
              style: TextStyle(
                  color: color, fontSize: 12, fontWeight: FontWeight.bold)),
        ]),
      ),
    );
  }
}

//
//  تبويب الرئيسية
//
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
  const _HomeContent(
      {required this.balance, required this.ops, required this.company});
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
    final companyName = widget.company.name.isNotEmpty
        ? widget.company.name
        : 'منصتي المحاسبية';

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
            gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: RefreshIndicator(
          color: Colors.white,
          backgroundColor: const Color(0xFF021B79),
          onRefresh: () async {
            await DataService.syncCompanyFromCloud();
            HapticFeedback.mediumImpact();
          },
          child: CustomScrollView(slivers: [
            SliverAppBar(
              expandedHeight: h * 0.38,
              backgroundColor: Colors.transparent,
              elevation: 0,
              actions: [
                // زر الإشعارات
                ValueListenableBuilder<int>(
                  valueListenable: NotificationService.unreadCountNotifier,
                  builder: (ctx, count, _) => Stack(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications_outlined,
                            color: Colors.white, size: 26),
                        tooltip: 'الإشعارات',
                        onPressed: () => Navigator.push(context,
                            MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                      ),
                      if (count > 0)
                        Positioned(
                          top: 6, left: 6,
                          child: Container(
                            width: 18, height: 18,
                            decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                            child: Center(child: Text('$count',
                                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
                          ),
                        ),
                    ],
                  ),
                ),
                // زر الاشتراك في الـ AppBar
                ValueListenableBuilder<SubscriptionInfo>(
                  valueListenable: subscriptionNotifier,
                  builder: (ctx, sub, child) => sub.plan == PlanType.free
                      ? IconButton(
                          icon: const Icon(Icons.workspace_premium,
                              color: Colors.amber, size: 28),
                          tooltip: 'ترقية الاشتراك',
                          onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const SubscriptionScreen())),
                        )
                      : const SizedBox.shrink(),
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline,
                      color: Colors.white, size: 32),
                  onPressed: () => _showAddOperationSheet(context),
                ),
              ],
              flexibleSpace: FlexibleSpaceBar(
                centerTitle: true,
                title:
                    Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                  ValueListenableBuilder<AppConfig?>(
                    valueListenable: appConfigNotifier,
                    builder: (_, cfg, __) => Text(
                      cfg != null
                          ? '${cfg.homeLayout.welcomeHint}'
                          : 'مرحباً، $companyName',
                      style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w400),
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 6),
                  TweenAnimationBuilder<double>(
                    tween: Tween<double>(begin: 0, end: widget.balance),
                    duration: const Duration(milliseconds: 900),
                    curve: Curves.easeOutCubic,
                    builder: (_, val, __) => Text(
                        '${val.toStringAsFixed(2)} $symbol',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 36,
                            fontWeight: FontWeight.bold)),
                  ),
                  ValueListenableBuilder<AppConfig?>(
                    valueListenable: appConfigNotifier,
                    builder: (_, cfg, __) => Text(
                      cfg != null
                          ? '${cfg.homeLayout.balanceLabel} بـ $_mainCurrency'
                          : 'الرصيد الإجمالي بـ $_mainCurrency',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 11),
                    ),
                  ),
                  // شارة الاشتراك
                  ValueListenableBuilder<SubscriptionInfo>(
                    valueListenable: subscriptionNotifier,
                    builder: (ctx, sub, child) => sub.plan != PlanType.free
                        ? Container(
                            margin: const EdgeInsets.only(top: 4),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                                color: Colors.amber.withValues(alpha: 0.3),
                                borderRadius: BorderRadius.circular(20)),
                            child: Text(' ${sub.planName}',
                                style: const TextStyle(
                                    color: Colors.amber,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold)),
                          )
                        : const SizedBox.shrink(),
                  ),
                  const SizedBox(height: 16),
                ]),
              ),
              pinned: false,
              floating: true,
              snap: false,
            ),
            SliverFillRemaining(
              hasScrollBody: false,
              child: ClipRRect(
                borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(40),
                    topRight: Radius.circular(40)),
                child: Container(
                  color: Colors.grey.shade50,
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _SubscriptionBanner(
                            accountCount: accountsNotifier.value.length,
                            opCount: operationsNotifier.value.length),
                        Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 8),
                                // ── أزرار الإجراء السريع الذكية ──
                                ValueListenableBuilder<AppConfig?>(
                                  valueListenable: appConfigNotifier,
                                  builder: (_, cfg, __) {
                                    if (cfg == null) return const SizedBox.shrink();
                                    return _QuickActionsRow(
                                      actions: cfg.quickActions,
                                      onTap: (route) => _handleQuickAction(context, route),
                                    );
                                  },
                                ),
                                const SizedBox(height: 20),
                                const Text('آخر العمليات',
                                    style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF021B79))),
                                const SizedBox(height: 12),
                                if (recentOps.isEmpty)
                                  const Center(
                                      child: Padding(
                                          padding: EdgeInsets.all(32),
                                          child: Text('لا توجد عمليات بعد',
                                              style: TextStyle(
                                                  color: Colors.grey))))
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
      ),
    );
  }

  void _handleQuickAction(BuildContext context, String route) {
    switch (route) {
      case 'income':
      case 'sale':
      case 'donation':
        _showAddOperationSheet(context);
      case 'expense':
      case 'purchase':
        _showAddOperationSheet(context);
      case 'invoice':
      case 'collect':
        _showAddOperationSheet(context);
      case 'entry':
        final uid = FirebaseAuth.instance.currentUser?.uid ?? '';
        Navigator.push(context,
            MaterialPageRoute(builder: (_) => JournalScreen(
              ownerUid: uid,
              existingAccounts: accountsNotifier.value,
            )));
      case 'reports':
        final ruid = FirebaseAuth.instance.currentUser?.uid ?? '';
        Navigator.push(context,
            MaterialPageRoute(builder: (_) => AccReportsScreen(
              ownerUid: ruid,
              accounts: accountsNotifier.value,
              operations: operationsNotifier.value,
              company: companyNotifier.value,
            )));
      case 'close_day':
        _showAddOperationSheet(context);
      default:
        _showAddOperationSheet(context);
    }
  }

  void _showAddOperationSheet(BuildContext context) async {
    final err = await DataService.canAddOperation();
    if (err != null && context.mounted) {
      _showUpgradeDialog(context, err);
      return;
    }
    if (context.mounted) {
      showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => const Directionality(
              textDirection: ui.TextDirection.rtl,
              child: _AddOperationSheet()));
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  أزرار الإجراء السريع الذكية
// ─────────────────────────────────────────────────────────────
class _QuickActionsRow extends StatelessWidget {
  final List<QuickAction> actions;
  final ValueChanged<String> onTap;
  const _QuickActionsRow({required this.actions, required this.onTap});

  static const _blue = Color(0xFF0575E6);
  static const _dark = Color(0xFF021B79);

  IconData _iconData(String name) => switch (name) {
    'add_circle'        => Icons.add_circle_rounded,
    'remove_circle'     => Icons.remove_circle_rounded,
    'point_of_sale'     => Icons.point_of_sale,
    'shopping_cart'     => Icons.shopping_cart_rounded,
    'shopping_basket'   => Icons.shopping_basket_rounded,
    'receipt_long'      => Icons.receipt_long_rounded,
    'payments'          => Icons.payments_rounded,
    'construction'      => Icons.construction_rounded,
    'edit_note'         => Icons.edit_note_rounded,
    'bar_chart'         => Icons.bar_chart_rounded,
    'lock_clock'        => Icons.lock_clock_rounded,
    'restaurant'        => Icons.restaurant_rounded,
    'business'          => Icons.business_rounded,
    'picture_as_pdf'    => Icons.picture_as_pdf_rounded,
    'volunteer_activism'=> Icons.volunteer_activism_rounded,
    'summarize'         => Icons.summarize_rounded,
    _                   => Icons.bolt_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final primary = actions.where((a) => a.isPrimary).toList();
    final secondary = actions.where((a) => !a.isPrimary).toList();
    return Column(
      children: [
        // الزر الرئيسي
        if (primary.isNotEmpty)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => onTap(primary.first.route),
              icon: Icon(_iconData(primary.first.icon), size: 20),
              label: Text(primary.first.label,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: _blue,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        if (secondary.isNotEmpty) ...[
          const SizedBox(height: 8),
          Row(
            children: secondary.map((a) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                    left: a == secondary.last ? 0 : 6),
                child: OutlinedButton.icon(
                  onPressed: () => onTap(a.route),
                  icon: Icon(_iconData(a.icon), size: 16),
                  label: Text(a.label,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _dark,
                    side: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            )).toList(),
          ),
        ],
      ],
    );
  }
}

void _showUpgradeDialog(BuildContext context, String message) {
  showDialog(
    context: context,
    builder: (_) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Column(children: [
        Text('', style: TextStyle(fontSize: 36)),
        SizedBox(height: 8),
        Text('تم الوصول للحد الأقصى',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ]),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(message,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563))),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
              color: const Color(0xFF021B79).withValues(alpha: 0.06),
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
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('لاحقاً')),
        ElevatedButton.icon(
          icon: const Icon(Icons.upgrade, color: Colors.white, size: 18),
          label: const Text('ترقية الاشتراك',
              style:
                  TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          onPressed: () {
            Navigator.pop(context);
            Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => SubscriptionScreen(message: message)));
          },
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF021B79),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12))),
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
      Expanded(
          child: Text(plan,
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
      Text(desc,
          style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
      const SizedBox(width: 8),
      Text(price,
          style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Color(0xFF021B79))),
    ]);
  }
}

//
//  بطاقة القيد في الرئيسية (قابلة للضغط: تعديل / حذف)
//
class _OpTile extends StatelessWidget {
  final Operation op;
  const _OpTile({required this.op});

  @override
  Widget build(BuildContext context) {
    final isCredit = op.amount >= 0;
    final color = isCredit ? Colors.green.shade700 : Colors.red.shade700;
    final sign = isCredit ? '+' : '';
    final symbol = _currencySymbol(op.currency);
    return GestureDetector(
      onTap: () => _showOptions(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 2))
            ]),
        child: Row(children: [
          Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(op.statement.isNotEmpty ? op.statement : 'بدون بيان',
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w500)),
                Text(op.currency,
                    style:
                        TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('$sign${op.amount.toStringAsFixed(2)} $symbol',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: color)),
            Text('= ${op.amountUSD.toStringAsFixed(2)} \$',
                style:
                    TextStyle(fontSize: 11, color: Colors.grey.shade500)),
          ]),
          const SizedBox(width: 6),
          Icon(Icons.more_vert, size: 16, color: Colors.grey.shade400),
        ]),
      ),
    );
  }

  void _showOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Directionality(
        textDirection: ui.TextDirection.rtl,
        child: Container(
          decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius:
                  BorderRadius.vertical(top: Radius.circular(24))),
          child: SafeArea(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _sheetHandle(),
              // معلومات القيد
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                child: Row(children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                        color: op.amount >= 0
                            ? Colors.green.shade600
                            : Colors.red.shade600,
                        shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                        op.statement.isNotEmpty ? op.statement : 'بدون بيان',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                  Text(
                      '${op.amount >= 0 ? "+" : ""}${op.amount.toStringAsFixed(2)} ${_currencySymbol(op.currency)}',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: op.amount >= 0
                              ? Colors.green.shade700
                              : Colors.red.shade700)),
                ]),
              ),
              const Divider(height: 1),
              // تعديل
              ListTile(
                leading: const Icon(Icons.edit_outlined,
                    color: Color(0xFF021B79)),
                title: const Text('تعديل القيد'),
                onTap: () {
                  Navigator.pop(context);
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => Directionality(
                        textDirection: ui.TextDirection.rtl,
                        child: _EditOperationSheet(op: op)),
                  );
                },
              ),
              // حذف
              ListTile(
                leading:
                    const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('حذف القيد',
                    style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(context);
                  _confirmDelete(context);
                },
              ),
              const SizedBox(height: 8),
            ]),
          ),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => Directionality(
        textDirection: ui.TextDirection.rtl,
        child: AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange),
            SizedBox(width: 8),
            Text('حذف القيد'),
          ]),
          content: const Text('هل أنت متأكد من حذف هذا القيد؟'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('إلغاء')),
            ElevatedButton.icon(
                icon: const Icon(Icons.delete, color: Colors.white, size: 18),
                label: const Text('احذف',
                    style: TextStyle(color: Colors.white)),
                onPressed: () async {
                  Navigator.pop(context);
                  await DataService.deleteOperation(op.id);
                  if (context.mounted)
                    _snack(context, ' تم حذف القيد');
                },
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)))),
          ],
        ),
      ),
    );
  }
}

//
//  تبويب الحسابات
//
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

class _AccountsContent extends StatefulWidget {
  final List<Account> accounts;
  const _AccountsContent({required this.accounts});
  @override
  State<_AccountsContent> createState() => _AccountsContentState();
}

class _AccountsContentState extends State<_AccountsContent> {
  String _search = '';

  List<Account> get _filtered => widget.accounts
      .where((a) =>
          a.name.toLowerCase().contains(_search.toLowerCase()) ||
          a.id.contains(_search))
      .toList();

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
            gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: CustomScrollView(slivers: [
          SliverAppBar(
            expandedHeight: h * 0.28,
            backgroundColor: Colors.transparent,
            elevation: 0,
            actions: [
              // ── قيود اليومية ──
              IconButton(
                icon: const Icon(Icons.book_outlined, color: Colors.white),
                tooltip: 'قيود اليومية',
                onPressed: () {
                  final uid = FirebaseAuth.instance.currentUser?.uid ?? '';
                  Navigator.push(context,
                    MaterialPageRoute(builder: (_) => JournalScreen(
                      ownerUid: uid,
                      existingAccounts: accountsNotifier.value,
                      onEntrySaved: () async {
                        await DataService.getOperations();
                      },
                    )));
                },
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline,
                    color: Colors.white, size: 32),
                onPressed: () => _tryAddAccount(context),
              )
            ],
            flexibleSpace: FlexibleSpaceBar(
              centerTitle: true,
              title: Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        const Text('الحسابات',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 28)),
                        ValueListenableBuilder<SubscriptionInfo>(
                          valueListenable: subscriptionNotifier,
                          builder: (ctx, sub, child) => sub.plan ==
                                  PlanType.free
                              ? Text(
                                  '${widget.accounts.length}/${SubscriptionInfo.freeMaxAccounts}',
                                  style: TextStyle(
                                      color:
                                          Colors.white.withValues(alpha: 0.7),
                                      fontSize: 11))
                              : const SizedBox.shrink(),
                        ),
                      ])),
            ),
            pinned: false,
            floating: true,
          ),
          SliverFillRemaining(
            hasScrollBody: false,
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(40), topRight: Radius.circular(40)),
              child: Container(
                color: Colors.grey.shade50,
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    // Search bar
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: TextField(
                        onChanged: (v) => setState(() => _search = v),
                        textAlign: TextAlign.right,
                        decoration: InputDecoration(
                          hintText: 'بحث في الحسابات...',
                          hintStyle: TextStyle(color: Colors.grey.shade400),
                          prefixIcon:
                              Icon(Icons.search, color: Colors.grey.shade400),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                        ),
                      ),
                    ),
                    // Accounts list or empty state
                    if (widget.accounts.isEmpty)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.all(40),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.account_balance_wallet_outlined,
                                  size: 64, color: Colors.grey.shade300),
                              const SizedBox(height: 12),
                              Text('لا توجد حسابات بعد',
                                  style: TextStyle(
                                      color: Colors.grey.shade500,
                                      fontSize: 16)),
                              const SizedBox(height: 8),
                              Text('اضغط + لإضافة حسابك الأول',
                                  style: TextStyle(
                                      color: Colors.grey.shade400,
                                      fontSize: 13)),
                            ],
                          ),
                        ),
                      )
                    else if (_filtered.isEmpty)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.all(40),
                          child: Text('لا توجد نتائج للبحث',
                              style: TextStyle(color: Colors.grey.shade400)),
                        ),
                      )
                    else
                      Column(
                          children: _filtered
                              .map((a) => _AccountCard(account: a))
                              .toList()),
                  ],
                ),
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
      showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => const Directionality(
              textDirection: ui.TextDirection.rtl, child: _AddAccountSheet()));
    }
  }
}

//
//  بطاقة الحساب
//
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
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withValues(alpha: 0.07),
                  blurRadius: 12,
                  offset: const Offset(0, 4))
            ]),
        child: Row(children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
                color: const Color(0xFF021B79).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14)),
            child: Center(
                child: Text(account.id,
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF021B79)))),
          ),
          const SizedBox(width: 14),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(account.name,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 3),
                Text(_typeLabel(account.type),
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ])),
          const Icon(Icons.chevron_left, color: Colors.grey),
        ]),
      ),
    );
  }

  void _showAccountDetail(BuildContext context) {
    showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(
            textDirection: ui.TextDirection.rtl,
            child: _AccountDetailSheet(account: account)));
  }

  String _typeLabel(String type) {
    const map = {
      'bank': 'بنكي',
      'cash': 'نقدي',
      'usdt': 'USDT',
      'other': 'أخرى'
    };
    return map[type] ?? type;
  }
}

//
//  تفاصيل الحساب
//
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
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final summary = await DataService.getAccountSummary(widget.account.id);
    final allOps = await DataService.getOperations();
    final accountOps = allOps
        .where((o) => o.accountId == widget.account.id)
        .toList()
      ..sort((a, b) => b.date.compareTo(a.date));
    final currency = await DataService.getMainCurrency();
    if (mounted) {
      setState(() {
        _summary = summary;
        _ops = accountOps;
        _mainCurrency = currency;
        _loading = false;
      });
    }
  }

  Future<void> _confirmDeleteAccount() async {
    final ops = await DataService.getOperations();
    final opCount = ops.where((o) => o.accountId == widget.account.id).length;
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(children: [
          Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
          SizedBox(width: 8),
          Text('حذف الحساب'),
        ]),
        content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RichText(
                  text: TextSpan(
                      style: const TextStyle(
                          color: Colors.black87, fontSize: 14, height: 1.6),
                      children: [
                    const TextSpan(text: 'هل تريد حذف حساب '),
                    TextSpan(
                        text: widget.account.name,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: '؟')
                  ])),
              if (opCount > 0) ...[
                const SizedBox(height: 12),
                Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.red.shade200)),
                    child: Row(children: [
                      Icon(Icons.info_outline,
                          color: Colors.red.shade700, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Text('سيتم حذف $opCount قيد مرتبط أيضاً.',
                              style: TextStyle(
                                  color: Colors.red.shade700, fontSize: 13))),
                    ])),
              ],
            ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('إلغاء')),
          ElevatedButton.icon(
              icon: const Icon(Icons.delete, color: Colors.white, size: 18),
              label: const Text('احذف', style: TextStyle(color: Colors.white)),
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)))),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await DataService.deleteAccount(widget.account.id);
      if (mounted) {
        Navigator.pop(context);
        _snack(context, ' تم حذف الحساب وقيوده');
      }
    }
  }

  Future<void> _openEditAccount() async {
    final edited = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(
            textDirection: ui.TextDirection.rtl,
            child: _EditAccountSheet(account: widget.account)));
    if (edited == true && mounted) Navigator.pop(context);
  }

  void _openPDF() async {
    if (_summary == null) return;
    final company = companyNotifier.value;
    await generateAccountStatementPDF(
        account: widget.account,
        summary: _summary!,
        operations: _ops,
        mainCurrency: _mainCurrency,
        companyName: company.name.isNotEmpty ? company.name : 'منصتي المحاسبية',
        companyAddress: company.address,
        companyPhone: company.phone);
  }

  void _openWhatsApp() async {
    if (_summary == null) return;
    final company = companyNotifier.value;
    await sendBalanceViaWhatsApp(
        account: widget.account,
        summary: _summary!,
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
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF021B79)))
          : Column(children: [
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
                        child: Text(widget.account.name,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis)),
                    Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20)),
                        child: Text(widget.account.id,
                            style: const TextStyle(
                                color: Colors.white, fontSize: 12))),
                    const SizedBox(width: 4),
                    IconButton(
                        icon: const Icon(Icons.file_download_outlined,
                            color: Colors.white, size: 22),
                        tooltip: 'كشف حساب PDF',
                        onPressed: _openPDF,
                        padding: EdgeInsets.zero,
                        constraints:
                            const BoxConstraints(minWidth: 36, minHeight: 36)),
                    IconButton(
                      icon: const FaIcon(
                          FontAwesomeIcons
                              .whatsapp, //  تم التغيير من Icon إلى FaIcon
                          color: Colors.greenAccent,
                          size: 22),
                      tooltip: 'إرسال واتساب',
                      onPressed: _openWhatsApp,
                      padding: EdgeInsets.zero,
                      constraints:
                          const BoxConstraints(minWidth: 36, minHeight: 36),
                    ),
                    IconButton(
                        icon: const Icon(Icons.edit_outlined,
                            color: Colors.white, size: 22),
                        tooltip: 'تعديل',
                        onPressed: _openEditAccount,
                        padding: EdgeInsets.zero,
                        constraints:
                            const BoxConstraints(minWidth: 36, minHeight: 36)),
                    IconButton(
                        icon: const Icon(Icons.delete_outline,
                            color: Colors.redAccent, size: 22),
                        tooltip: 'حذف',
                        onPressed: _confirmDeleteAccount,
                        padding: EdgeInsets.zero,
                        constraints:
                            const BoxConstraints(minWidth: 36, minHeight: 36)),
                    CloseButton(color: Colors.white.withValues(alpha: 0.8)),
                  ]),
                  const SizedBox(height: 16),
                  Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(16)),
                      child: Column(children: [
                        Text('الرصيد الإجمالي بـ $_mainCurrency',
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.8),
                                fontSize: 12)),
                        const SizedBox(height: 6),
                        Text(
                            '${(_summary?.totalUSD ?? 0).toStringAsFixed(2)} $mainSymbol',
                            style: TextStyle(
                                color: (_summary?.totalUSD ?? 0) >= 0
                                    ? Colors.greenAccent.shade100
                                    : Colors.redAccent.shade100,
                                fontSize: 28,
                                fontWeight: FontWeight.bold)),
                      ])),
                  const SizedBox(height: 12),
                  if (_summary != null &&
                      _summary!.balanceByCurrency.isNotEmpty)
                    Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _summary!.balanceByCurrency.entries.map((e) {
                          final isPos = e.value >= 0;
                          final sym = _currencySymbol(e.key);
                          return Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                                color: isPos
                                    ? Colors.green.withValues(alpha: 0.25)
                                    : Colors.red.withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                    color: isPos
                                        ? Colors.greenAccent.shade200
                                        : Colors.redAccent.shade200,
                                    width: 1)),
                            child: Column(children: [
                              Text(e.key,
                                  style: const TextStyle(
                                      color: Colors.white70, fontSize: 10)),
                              Text(
                                  '${isPos ? "لنا" : "لهم"} ${e.value.abs().toStringAsFixed(2)} $sym',
                                  style: TextStyle(
                                      color: isPos
                                          ? Colors.greenAccent.shade100
                                          : Colors.redAccent.shade100,
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold)),
                            ]),
                          );
                        }).toList()),
                ]),
              ),
              // List
              Expanded(
                  child: _ops.isEmpty
                      ? const Center(
                          child: Text('لا توجد قيود لهذا الحساب',
                              style: TextStyle(color: Colors.grey)))
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _ops.length,
                          itemBuilder: (_, i) => _OpDetailTile(
                              op: _ops[i],
                              mainCurrency: _mainCurrency,
                              onChanged: _load))),
              // Add button
              Padding(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.add, color: Colors.white),
                        label: const Text('إضافة قيد جديد',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold)),
                        onPressed: () async {
                          final err = await DataService.canAddOperation();
                          if (err != null && context.mounted) {
                            _showUpgradeDialog(context, err);
                            return;
                          }
                          if (context.mounted) {
                            showModalBottomSheet(
                                context: context,
                                isScrollControlled: true,
                                backgroundColor: Colors.transparent,
                                builder: (_) => Directionality(
                                    textDirection: ui.TextDirection.rtl,
                                    child: _AddOperationSheet(
                                        preselectedAccountId: widget
                                            .account.id))).then((_) => _load());
                          }
                        },
                        style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF021B79),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14))),
                      ))),
            ]),
    );
  }
}

//  _OpDetailTile, _EditOperationSheet, _EditAccountSheet, _AddAccountSheet, _AddOperationSheet
// (نفس الكود السابق مع إضافة فحص الاشتراك في الإضافة)

class _OpDetailTile extends StatelessWidget {
  final Operation op;
  final String mainCurrency;
  final VoidCallback onChanged;
  const _OpDetailTile(
      {required this.op, required this.mainCurrency, required this.onChanged});

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
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 2))
            ]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10)),
                child: Text(label,
                    style: TextStyle(
                        color: color,
                        fontSize: 11,
                        fontWeight: FontWeight.bold))),
            const Spacer(),
            Text('${op.date.day}/${op.date.month}/${op.date.year}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            const SizedBox(width: 6),
            Icon(Icons.more_horiz, size: 18, color: Colors.grey.shade400),
          ]),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Expanded(
                child: Text(
                    op.statement.isNotEmpty ? op.statement : 'بدون بيان',
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w500))),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('$sign${op.amount.toStringAsFixed(2)} $sym',
                  style: TextStyle(
                      fontSize: 15, fontWeight: FontWeight.bold, color: color)),
              Text('صرف: ${op.exchangeRate.toStringAsFixed(2)}',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              Text('= ${op.amountUSD.toStringAsFixed(2)} $mainSym',
                  style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF021B79),
                      fontWeight: FontWeight.w600)),
            ]),
          ]),
        ]),
      ),
    );
  }

  void _showOptions(BuildContext context) {
    final isCredit = op.amount >= 0;
    final color = isCredit ? Colors.green.shade700 : Colors.red.shade700;
    showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(
            textDirection: ui.TextDirection.rtl,
            child: Container(
              decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(24))),
              child: SafeArea(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                _sheetHandle(),
                const SizedBox(height: 8),
                Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Row(children: [
                      Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20)),
                          child: Text(isCredit ? 'لنا' : 'لهم',
                              style: TextStyle(
                                  color: color,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12))),
                      const SizedBox(width: 10),
                      Expanded(
                          child: Text(
                              op.statement.isNotEmpty
                                  ? op.statement
                                  : 'بدون بيان',
                              style: const TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.bold),
                              overflow: TextOverflow.ellipsis)),
                      Text(
                          '${isCredit ? "+" : ""}${op.amount.toStringAsFixed(2)} ${_currencySymbol(op.currency)}',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: color)),
                    ])),
                const Divider(height: 1),
                const SizedBox(height: 4),
                ListTile(
                  leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                          color: const Color(0xFF021B79).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.edit_outlined,
                          color: Color(0xFF021B79))),
                  title: const Text('تعديل القيد',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: const Text('تغيير المبلغ أو العملة أو البيان'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.pop(context);
                    _openEdit(context);
                  },
                ),
                ListTile(
                  leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10)),
                      child:
                          const Icon(Icons.delete_outline, color: Colors.red)),
                  title: const Text('حذف القيد',
                      style: TextStyle(
                          color: Colors.red, fontWeight: FontWeight.w600)),
                  subtitle: const Text('لا يمكن التراجع عن هذه العملية'),
                  trailing: const Icon(Icons.chevron_right, color: Colors.red),
                  onTap: () {
                    Navigator.pop(context);
                    _confirmDelete(context);
                  },
                ),
                const SizedBox(height: 8),
              ])),
            )));
  }

  void _openEdit(BuildContext context) {
    showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(
            textDirection: ui.TextDirection.rtl,
            child: _EditOperationSheet(op: op))).then((edited) {
      if (edited == true) onChanged();
    });
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
        context: context,
        builder: (_) => AlertDialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20)),
              title: const Row(children: [
                Icon(Icons.warning_amber_rounded,
                    color: Colors.orange, size: 28),
                SizedBox(width: 8),
                Text('حذف القيد')
              ]),
              content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('هل أنت متأكد من حذف هذا القيد؟'),
                    const SizedBox(height: 8),
                    Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.grey.shade200)),
                        child: Row(children: [
                          Text(
                              '${op.amount >= 0 ? "+" : ""}${op.amount.toStringAsFixed(2)} ${_currencySymbol(op.currency)}',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: op.amount >= 0
                                      ? Colors.green.shade700
                                      : Colors.red.shade700)),
                          const SizedBox(width: 8),
                          Expanded(
                              child: Text(
                                  op.statement.isNotEmpty
                                      ? op.statement
                                      : 'بدون بيان',
                                  style: const TextStyle(fontSize: 13),
                                  overflow: TextOverflow.ellipsis)),
                        ])),
                  ]),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('إلغاء')),
                ElevatedButton.icon(
                    icon:
                        const Icon(Icons.delete, color: Colors.white, size: 18),
                    label: const Text('احذف',
                        style: TextStyle(color: Colors.white)),
                    onPressed: () async {
                      Navigator.pop(context);
                      await DataService.deleteOperation(op.id);
                      onChanged();
                      if (context.mounted) _snack(context, ' تم حذف القيد');
                    },
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)))),
              ],
            ));
  }
}

//  EditOperation
class _EditOperationSheet extends StatefulWidget {
  final Operation op;
  const _EditOperationSheet({required this.op});
  @override
  State<_EditOperationSheet> createState() => _EditOperationSheetState();
}

class _EditOperationSheetState extends State<_EditOperationSheet> {
  late TextEditingController _amountCtrl, _rateCtrl, _statementCtrl;
  late String _currency;
  String _mainCurrency = 'USD';
  double _convertedAmount = 0.0;
  bool _saving = false;
  late DateTime _selectedDate;

  @override
  void initState() {
    super.initState();
    _amountCtrl =
        TextEditingController(text: widget.op.amount.toString());
    _rateCtrl =
        TextEditingController(text: widget.op.exchangeRate.toString());
    _statementCtrl =
        TextEditingController(text: widget.op.statement);
    _currency = widget.op.currency;
    _convertedAmount = widget.op.amountUSD;
    _selectedDate = widget.op.date;
    DataService.getMainCurrency().then((c) {
      if (mounted) setState(() => _mainCurrency = c);
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _rateCtrl.dispose();
    _statementCtrl.dispose();
    super.dispose();
  }

  void _recalc() {
    final a = double.tryParse(_amountCtrl.text) ?? 0.0;
    final r = double.tryParse(_rateCtrl.text) ?? 1.0;
    setState(() {
      _convertedAmount =
          r != 0 ? double.parse((a / r).toStringAsFixed(6)) : 0.0;
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      locale: const Locale('ar'),
    );
    if (picked != null && mounted) {
      setState(() => _selectedDate = DateTime(
            picked.year,
            picked.month,
            picked.day,
            _selectedDate.hour,
            _selectedDate.minute,
          ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final mainSym = _currencySymbol(_mainCurrency);
    final entrySym = _currencySymbol(_currency);
    final dateStr =
        '${_selectedDate.year}/${_selectedDate.month.toString().padLeft(2, '0')}/${_selectedDate.day.toString().padLeft(2, '0')}';
    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.90),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(
          padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            _sheetHandle(),
            const Padding(
                padding:
                    EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(children: [
                  Text('تعديل القيد',
                      style: TextStyle(
                          fontSize: 20, fontWeight: FontWeight.bold)),
                  Spacer(),
                  CloseButton()
                ])),
            const Divider(height: 1),
            Expanded(
                child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(children: [
                      Row(children: [
                        Expanded(
                            flex: 5,
                            child: TextFormField(
                                controller: _amountCtrl,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true, signed: true),
                                decoration:
                                    _inputDeco('المبلغ *', suffix: entrySym),
                                onChanged: (_) => _recalc(),
                                style: const TextStyle(fontSize: 13))),
                        const SizedBox(width: 8),
                        Expanded(
                            flex: 4,
                            child: TextFormField(
                                controller: _rateCtrl,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true),
                                decoration: _inputDeco('الصرف'),
                                onChanged: (_) => _recalc(),
                                style: const TextStyle(fontSize: 13))),
                      ]),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                          initialValue: _currency,
                          decoration: _inputDeco('العملة'),
                          items: _supportedCurrencies()
                              .map((c) => DropdownMenuItem(
                                  value: c,
                                  child: Text('$c ${_currencySymbol(c)}',
                                      style:
                                          const TextStyle(fontSize: 13))))
                              .toList(),
                          onChanged: (v) {
                            setState(
                                () => _currency = v ?? _mainCurrency);
                            _recalc();
                          },
                          isDense: true,
                          isExpanded: true),
                      const SizedBox(height: 12),
                      Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                              color: const Color(0xFF021B79)
                                  .withValues(alpha: 0.07),
                              borderRadius: BorderRadius.circular(10)),
                          child: Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                Text('= بـ $_mainCurrency:',
                                    style: TextStyle(
                                        color: Colors.grey.shade600,
                                        fontSize: 13)),
                                Text(
                                    '${_convertedAmount.toStringAsFixed(2)} $mainSym',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF021B79),
                                        fontSize: 15)),
                              ])),
                      const SizedBox(height: 12),
                      TextFormField(
                          controller: _statementCtrl,
                          maxLines: 2,
                          decoration: _inputDeco('البيان (اختياري)'),
                          style: const TextStyle(fontSize: 13)),
                      const SizedBox(height: 12),
                      // ── حقل التاريخ ──
                      GestureDetector(
                        onTap: _pickDate,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 13),
                          decoration: BoxDecoration(
                              border: Border.all(
                                  color: Colors.grey.shade400),
                              borderRadius: BorderRadius.circular(12)),
                          child: Row(children: [
                            Icon(Icons.calendar_today_outlined,
                                size: 18,
                                color: const Color(0xFF021B79)),
                            const SizedBox(width: 10),
                            Text('التاريخ: $dateStr',
                                style: const TextStyle(fontSize: 13)),
                            const Spacer(),
                            Icon(Icons.edit_outlined,
                                size: 16,
                                color: Colors.grey.shade500),
                          ]),
                        ),
                      ),
                    ]))),
            _saveButton(
                label: 'حفظ التعديلات',
                saving: _saving,
                onPressed: _submit),
          ])),
    );
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountCtrl.text);
    if (amount == null) {
      _snack(context, ' يرجى إدخال مبلغ صحيح', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await DataService.updateOperation(
          opId: widget.op.id,
          amount: amount,
          exchangeRate: double.tryParse(_rateCtrl.text) ?? 1.0,
          currency: _currency,
          statement: _statementCtrl.text.trim(),
          date: _selectedDate);
      if (mounted) {
        Navigator.pop(context, true);
        _snack(context, ' تم تحديث القيد');
      }
    } catch (e) {
      if (mounted) _snack(context, ' خطأ: $e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

//  EditAccount
class _EditAccountSheet extends StatefulWidget {
  final Account account;
  const _EditAccountSheet({required this.account});
  @override
  State<_EditAccountSheet> createState() => _EditAccountSheetState();
}

class _EditAccountSheetState extends State<_EditAccountSheet> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl, _phoneCtrl, _addressCtrl, _codeCtrl, _clientPassCtrl;
  late String _type;
  late String _category;
  late bool   _allowClient;
  bool _saving = false;
  bool _showPass = false;

  // ── الصناديق ──
  List<Cashbox> _allBoxes = [];
  List<String>  _selectedBoxIds = [];

  @override
  void initState() {
    super.initState();
    _nameCtrl       = TextEditingController(text: widget.account.name);
    _phoneCtrl      = TextEditingController(text: widget.account.phone);
    _addressCtrl    = TextEditingController(text: widget.account.address);
    _codeCtrl       = TextEditingController(text: widget.account.code);
    _clientPassCtrl = TextEditingController();
    _type           = widget.account.type;
    _category       = widget.account.category;
    _allowClient    = widget.account.allowClientLogin;
    _loadBoxes();
  }

  Future<void> _loadBoxes() async {
    final boxes = await CashboxService.getBoxes();
    if (mounted) {
      setState(() {
        _allBoxes       = boxes;
        _selectedBoxIds = boxes
            .where((b) => b.linkedAccountIds.contains(widget.account.id))
            .map((b) => b.id)
            .toList();
      });
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _phoneCtrl.dispose(); _addressCtrl.dispose();
    _codeCtrl.dispose(); _clientPassCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Form(
              key: _formKey,
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _sheetHandle(),
                const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(children: [
                      Text('تعديل الحساب',
                          style: TextStyle(
                              fontSize: 20, fontWeight: FontWeight.bold)),
                      Spacer(),
                      CloseButton()
                    ])),
                const Divider(height: 1),
                Expanded(
                    child: SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: Column(children: [
                          // رقم الحساب (للقراءة فقط)
                          Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                  color: const Color(0xFF021B79)
                                      .withValues(alpha: 0.06),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: const Color(0xFF021B79)
                                          .withValues(alpha: 0.15))),
                              child: Row(children: [
                                const Icon(Icons.tag,
                                    size: 16, color: Color(0xFF021B79)),
                                const SizedBox(width: 8),
                                Text('رقم الحساب: ${widget.account.id}',
                                    style: const TextStyle(
                                        color: Color(0xFF021B79),
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13)),
                                const Spacer(),
                                Text('لا يمكن تعديله',
                                    style: TextStyle(
                                        color: Colors.grey.shade400,
                                        fontSize: 11)),
                              ])),
                          const SizedBox(height: 16),
                          _field('اسم الحساب *', _nameCtrl,
                              validator: (v) =>
                                  v!.trim().isEmpty ? 'الاسم مطلوب' : null),
                          const SizedBox(height: 12),
                          // ── الرمز والتصنيف المحاسبي (جديد) ──
                          Row(children: [
                            Expanded(child: _field('رمز الحساب', _codeCtrl)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: _category,
                                decoration: _inputDeco('التصنيف'),
                                items: const [
                                  DropdownMenuItem(value: 'asset',     child: Text('أصول')),
                                  DropdownMenuItem(value: 'liability', child: Text('خصوم')),
                                  DropdownMenuItem(value: 'equity',    child: Text('حقوق ملكية')),
                                  DropdownMenuItem(value: 'revenue',   child: Text('إيرادات')),
                                  DropdownMenuItem(value: 'expense',   child: Text('مصروفات')),
                                  DropdownMenuItem(value: 'other',     child: Text('أخرى')),
                                ],
                                onChanged: (v) => setState(() => _category = v!),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 12),
                          _field('رقم الهاتف (اختياري)', _phoneCtrl,
                              type: TextInputType.phone),
                          const SizedBox(height: 12),
                          _field('العنوان (اختياري)', _addressCtrl,
                              maxLines: 2),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                              initialValue: _type,
                              decoration: _inputDeco('نوع الحساب'),
                              items: const [
                                DropdownMenuItem(value: 'cash',  child: Text('نقدي')),
                                DropdownMenuItem(value: 'bank',  child: Text('بنكي')),
                                DropdownMenuItem(value: 'usdt',  child: Text('USDT')),
                                DropdownMenuItem(value: 'other', child: Text('أخرى'))
                              ],
                              onChanged: (v) => setState(() => _type = v!)),
                          // ── ربط الصناديق ──
                          if (_allBoxes.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            const Divider(),
                            const SizedBox(height: 8),
                            CashboxPickerWidget(
                              accountId:  widget.account.id,
                              allBoxes:   _allBoxes,
                              onChanged:  (ids) =>
                                  setState(() => _selectedBoxIds = ids),
                            ),
                          ],
                          // ── بوابة العميل (جديد) ──────────────────
                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE3F2FD),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFF90CAF9)),
                            ),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Row(children: [
                                Switch(
                                  value: _allowClient,
                                  onChanged: (v) => setState(() => _allowClient = v),
                                  activeColor: const Color(0xFF1565C0),
                                ),
                                const Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                    Text('السماح للعميل بتسجيل الدخول',
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    Text('يرى رصيده وحركاته فقط',
                                        style: TextStyle(color: Colors.grey, fontSize: 11)),
                                  ]),
                                ),
                                const Icon(Icons.person_outline, color: Color(0xFF1565C0)),
                                const SizedBox(width: 6),
                              ]),
                              if (_allowClient) ...[
                                const SizedBox(height: 10),
                                if (widget.account.clientEmail.isNotEmpty)
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: Colors.green.shade50,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Row(children: [
                                      const Icon(Icons.check_circle, color: Colors.green, size: 16),
                                      const SizedBox(width: 8),
                                      Expanded(child: Text(
                                        'بريد الدخول: ${widget.account.clientEmail}',
                                        style: const TextStyle(fontSize: 12, color: Colors.green),
                                      )),
                                    ]),
                                  )
                                else ...[
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: Text('كلمة مرور العميل *',
                                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                                  ),
                                  const SizedBox(height: 6),
                                  TextFormField(
                                    controller: _clientPassCtrl,
                                    obscureText: !_showPass,
                                    textAlign: TextAlign.right,
                                    decoration: _inputDeco('6 أحرف على الأقل').copyWith(
                                      suffixIcon: IconButton(
                                        icon: Icon(_showPass ? Icons.visibility_off : Icons.visibility),
                                        onPressed: () => setState(() => _showPass = !_showPass),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'سيتم إنشاء بريد: ${_phoneCtrl.text.replaceAll(RegExp(r'[^0-9]'), '')}@acc.com',
                                    style: const TextStyle(color: Color(0xFF1565C0), fontSize: 11),
                                    textAlign: TextAlign.right,
                                  ),
                                ],
                              ],
                            ]),
                          ),
                        ]))),
                _saveButton(
                    label: 'حفظ التعديلات',
                    saving: _saving,
                    onPressed: _submit),
              ]))),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    String clientEmail = widget.account.clientEmail;
    String clientUid   = widget.account.clientUid;
    if (_allowClient && _phoneCtrl.text.trim().isNotEmpty && clientEmail.isEmpty &&
        _clientPassCtrl.text.length >= 6) {
      final ownerUid = FirebaseAuth.instance.currentUser?.uid ?? '';
      final result = await AccService.createClientAuth(
        phone: _phoneCtrl.text.trim(), password: _clientPassCtrl.text);
      if (result['success'] == true) {
        clientEmail = result['email'];
        clientUid   = result['uid'];
        await AccService.saveClientMapping(
          clientUid: clientUid, ownerUid: ownerUid, accountId: widget.account.id);
      } else if (mounted) {
        _snack(context, result['error'] as String, error: true);
      }
    }

    try {
      await DataService.updateAccount(
          accountId:        widget.account.id,
          name:             _nameCtrl.text.trim(),
          phone:            _phoneCtrl.text.trim(),
          address:          _addressCtrl.text.trim(),
          type:             _type,
          code:             _codeCtrl.text.trim(),
          category:         _category,
          allowClientLogin: _allowClient,
          clientPhone:      _phoneCtrl.text.trim(),
          clientEmail:      clientEmail,
          clientUid:        clientUid);
      // تحديث ربط الصناديق
      final boxes = await CashboxService.getBoxes();
      for (final box in boxes) {
        final wasLinked = box.linkedAccountIds.contains(widget.account.id);
        final isLinked  = _selectedBoxIds.contains(box.id);
        if (wasLinked && !isLinked) {
          final newIds = box.linkedAccountIds
              .where((id) => id != widget.account.id)
              .toList();
          await CashboxService.setLinkedAccounts(box.id, newIds);
        } else if (!wasLinked && isLinked) {
          await CashboxService.setLinkedAccounts(
              box.id, [...box.linkedAccountIds, widget.account.id]);
        }
      }
      if (mounted) {
        Navigator.pop(context, true);
        _snack(context, ' تم تحديث الحساب');
      }
    } catch (e) {
      if (mounted) _snack(context, ' خطأ: $e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

//  AddAccount
class _AddAccountSheet extends StatefulWidget {
  const _AddAccountSheet();
  @override
  State<_AddAccountSheet> createState() => _AddAccountSheetState();
}

class _AddAccountSheetState extends State<_AddAccountSheet> {
  final _formKey     = GlobalKey<FormState>();
  final _nameCtrl    = TextEditingController();
  final _phoneCtrl   = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _codeCtrl    = TextEditingController();
  final _clientPassCtrl = TextEditingController();
  String _type     = 'cash';
  String _category = 'other';
  bool   _saving      = false;
  bool   _allowClient = false;
  bool   _showPass    = false;

  // ── الصناديق ──
  List<Cashbox> _allBoxes = [];
  List<String>  _selectedBoxIds = [];

  @override
  void initState() {
    super.initState();
    CashboxService.getBoxes().then((b) {
      if (mounted) setState(() => _allBoxes = b);
    });
    _autoCode();
  }

  /// يولّد رمز حساب تلقائياً متسلسلاً بناءً على الحسابات الموجودة
  void _autoCode() {
    final accounts = accountsNotifier.value;
    if (accounts.isEmpty) {
      _codeCtrl.text = '1001';
      return;
    }
    // جمع الأرقام الموجودة
    final nums = accounts
        .map((a) => int.tryParse(a.code ?? ''))
        .whereType<int>()
        .toList()
      ..sort();
    final next = nums.isEmpty ? 1001 : (nums.last + 1);
    _codeCtrl.text = next.toString();
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _phoneCtrl.dispose(); _addressCtrl.dispose();
    _codeCtrl.dispose(); _clientPassCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Form(
              key: _formKey,
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _sheetHandle(),
                const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(children: [
                      Text('حساب جديد',
                          style: TextStyle(
                              fontSize: 20, fontWeight: FontWeight.bold)),
                      Spacer(),
                      CloseButton()
                    ])),
                const Divider(height: 1),
                Expanded(
                    child: SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: Column(children: [
                          _field('اسم الحساب *', _nameCtrl,
                              validator: (v) =>
                                  v!.isEmpty ? 'الاسم مطلوب' : null),
                          const SizedBox(height: 12),
                          // ── الرمز والتصنيف (جديد) ──
                          Row(children: [
                            Expanded(child: _field('رمز الحساب', _codeCtrl)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: _category,
                                decoration: _inputDeco('التصنيف'),
                                items: const [
                                  DropdownMenuItem(value: 'asset',     child: Text('أصول')),
                                  DropdownMenuItem(value: 'liability', child: Text('خصوم')),
                                  DropdownMenuItem(value: 'equity',    child: Text('حقوق ملكية')),
                                  DropdownMenuItem(value: 'revenue',   child: Text('إيرادات')),
                                  DropdownMenuItem(value: 'expense',   child: Text('مصروفات')),
                                  DropdownMenuItem(value: 'other',     child: Text('أخرى')),
                                ],
                                onChanged: (v) => setState(() => _category = v!),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 12),
                          _field('رقم الهاتف (اختياري)', _phoneCtrl,
                              type: TextInputType.phone),
                          const SizedBox(height: 12),
                          _field('العنوان (اختياري)', _addressCtrl,
                              maxLines: 2),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                              initialValue: _type,
                              decoration: _inputDeco('نوع الحساب'),
                              items: const [
                                DropdownMenuItem(value: 'cash',  child: Text('نقدي')),
                                DropdownMenuItem(value: 'bank',  child: Text('بنكي')),
                                DropdownMenuItem(value: 'usdt',  child: Text('USDT')),
                                DropdownMenuItem(value: 'other', child: Text('أخرى'))
                              ],
                              onChanged: (v) => setState(() => _type = v!)),
                          // ── ربط الصناديق ──
                          if (_allBoxes.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            const Divider(),
                            const SizedBox(height: 8),
                            CashboxPickerWidget(
                              accountId: '',
                              allBoxes: _allBoxes,
                              onChanged: (ids) =>
                                  setState(() => _selectedBoxIds = ids),
                            ),
                          ],
                          // ── بوابة العميل (جديد) ──────────────────
                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE3F2FD),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFF90CAF9)),
                            ),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Row(children: [
                                Switch(
                                  value: _allowClient,
                                  onChanged: (v) => setState(() => _allowClient = v),
                                  activeColor: const Color(0xFF1565C0),
                                ),
                                const Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                    Text('السماح للعميل بتسجيل الدخول',
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    Text('يرى رصيده وحركاته فقط',
                                        style: TextStyle(color: Colors.grey, fontSize: 11)),
                                  ]),
                                ),
                                const Icon(Icons.person_outline, color: Color(0xFF1565C0)),
                                const SizedBox(width: 6),
                              ]),
                              if (_allowClient) ...[
                                const SizedBox(height: 10),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: Text('كلمة مرور العميل *',
                                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                                ),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _clientPassCtrl,
                                  obscureText: !_showPass,
                                  textAlign: TextAlign.right,
                                  decoration: _inputDeco('6 أحرف على الأقل').copyWith(
                                    suffixIcon: IconButton(
                                      icon: Icon(_showPass ? Icons.visibility_off : Icons.visibility),
                                      onPressed: () => setState(() => _showPass = !_showPass),
                                    ),
                                  ),
                                  validator: (v) {
                                    if (_allowClient && (v == null || v.length < 6)) {
                                      return 'كلمة المرور 6 أحرف على الأقل';
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'سيتم إنشاء بريد: ${_phoneCtrl.text.replaceAll(RegExp(r'[^0-9]'), '')}@acc.com',
                                  style: const TextStyle(color: Color(0xFF1565C0), fontSize: 11),
                                  textAlign: TextAlign.right,
                                ),
                              ],
                            ]),
                          ),
                        ]))),
                _saveButton(
                    label: 'إنشاء الحساب',
                    saving: _saving,
                    onPressed: () async {
                      if (!_formKey.currentState!.validate()) return;
                      setState(() => _saving = true);
                      String clientEmail = '';
                      String clientUid   = '';
                      try {
                        // إنشاء حساب العميل أولاً
                        if (_allowClient && _phoneCtrl.text.trim().isNotEmpty &&
                            _clientPassCtrl.text.length >= 6) {
                          final result = await AccService.createClientAuth(
                            phone: _phoneCtrl.text.trim(), password: _clientPassCtrl.text);
                          if (result['success'] == true) {
                            clientEmail = result['email'];
                            clientUid   = result['uid'];
                          }
                        }
                        final account = await DataService.addAccount(
                            name:             _nameCtrl.text.trim(),
                            phone:            _phoneCtrl.text.trim(),
                            address:          _addressCtrl.text.trim(),
                            type:             _type,
                            code:             _codeCtrl.text.trim(),
                            category:         _category,
                            allowClientLogin: _allowClient,
                            clientPhone:      _phoneCtrl.text.trim(),
                            clientEmail:      clientEmail,
                            clientUid:        clientUid);
                        // ربط الحساب بالصناديق المختارة
                        if (_selectedBoxIds.isNotEmpty) {
                          final boxes = await CashboxService.getBoxes();
                          for (final boxId in _selectedBoxIds) {
                            final idx = boxes.indexWhere((b) => b.id == boxId);
                            if (idx != -1) {
                              await CashboxService.setLinkedAccounts(
                                  boxId, [...boxes[idx].linkedAccountIds, account.id]);
                            }
                          }
                        }
                        // حفظ ربط العميل
                        if (clientUid.isNotEmpty) {
                          final ownerUid = FirebaseAuth.instance.currentUser?.uid ?? '';
                          await AccService.saveClientMapping(
                            clientUid: clientUid, ownerUid: ownerUid, accountId: account.id);
                        }
                        if (!mounted) return;
                        Navigator.pop(context);
                        _snack(context, ' تم إنشاء الحساب');
                      } catch (e) {
                        if (mounted) { _snack(context, ' خطأ: $e', error: true); }
                      } finally {
                        if (mounted) setState(() => _saving = false);
                      }
                    }),
              ]))),
    );
  }
}

//  AddOperation
class _AddOperationSheet extends StatefulWidget {
  final String? preselectedAccountId;
  const _AddOperationSheet({this.preselectedAccountId});
  @override
  State<_AddOperationSheet> createState() => _AddOperationSheetState();
}

class _AddOperationSheetState extends State<_AddOperationSheet> {
  List<Account> _accounts = [];
  List<Cashbox> _allBoxes = [];
  final List<_OpRow> _rows = [];
  bool _loading = true, _saving = false;
  String _mainCurrency = 'USD';

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    _accounts = await DataService.getAccounts();
    _allBoxes = await CashboxService.getBoxes();
    _mainCurrency = await DataService.getMainCurrency();
    if (mounted) {
      setState(() => _loading = false);
      _addRow();
    }
  }

  void _addRow() => setState(() => _rows.add(_OpRow(
      accountId: widget.preselectedAccountId ?? '', currency: _mainCurrency)));
  void _removeRow(int i) {
    if (_rows.length > 1) setState(() => _rows.removeAt(i));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Column(children: [
            _sheetHandle(),
            const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(children: [
                  Text('قيد جديد',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  Spacer(),
                  CloseButton()
                ])),
            const Divider(height: 1),
            Expanded(
                child: _loading
                    ? const Center(
                        child:
                            CircularProgressIndicator(color: Color(0xFF021B79)))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _rows.length,
                        itemBuilder: (_, i) => _buildRow(i))),
            Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(color: Colors.black12, blurRadius: 8)
                    ]),
                child: Row(children: [
                  Expanded(
                      child: OutlinedButton.icon(
                          icon: const Icon(Icons.add),
                          label: const Text('قيد آخر'),
                          onPressed: _addRow,
                          style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              side:
                                  const BorderSide(color: Color(0xFF021B79))))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: ElevatedButton(
                          onPressed: _saving ? null : _save,
                          style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF021B79),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 12)),
                          child: _saving
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                      color: Colors.white, strokeWidth: 2))
                              : const Text('حفظ وإنشاء',
                                  style: TextStyle(color: Colors.white)))),
                ])),
          ])),
    );
  }

  Widget _buildRow(int i) {
    final row      = _rows[i];
    final mainSym  = _currencySymbol(_mainCurrency);

    // قيود الصندوق للحساب المختار
    final constraints = row.accountId.isNotEmpty
        ? listConstraintsForAccount(row.accountId, _allBoxes)
        : <CashboxConstraint>[];

    // القيد النشط: صندوق واحد تلقائياً أو ما اختاره المستخدم
    final CashboxConstraint? activeConstraint = constraints.length == 1
        ? constraints.first
        : (row.selectedBoxId != null
            ? constraints.where((c) => c.boxId == row.selectedBoxId).firstOrNull
            : null);

    // القيم الفعلية (مع الأولوية للصندوق)
    final String effectiveCurrency =
        activeConstraint?.currency ?? row.currency;
    final bool currencyLocked = activeConstraint?.currencyLocked ?? false;
    final bool rateLocked     = activeConstraint?.rateLocked     ?? false;

    // إذا تغيّر الصندوق، نحدّث row فوراً
    if (activeConstraint != null) {
      if (currencyLocked && row.currency != effectiveCurrency) {
        row.currency = effectiveCurrency;
      }
      if (rateLocked) {
        final boxRate =
            activeConstraint.exchangeRate?.toString() ?? '1';
        if (row.rate != boxRate) row.rate = boxRate;
      }
    }

    final entrySym = _currencySymbol(effectiveCurrency);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // ── رأس القيد ──
        Row(children: [
          Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                  color: const Color(0xFF021B79).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20)),
              child: Text('قيد #${i + 1}',
                  style: const TextStyle(
                      color: Color(0xFF021B79),
                      fontWeight: FontWeight.bold,
                      fontSize: 12))),
          const Spacer(),
          if (_rows.length > 1)
            IconButton(
                icon: const Icon(Icons.delete_outline,
                    color: Colors.red, size: 20),
                onPressed: () => _removeRow(i),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints()),
        ]),
        const SizedBox(height: 10),

        // ── اختيار الحساب ──
        DropdownButtonFormField<String>(
            initialValue: row.accountId.isEmpty ? null : row.accountId,
            decoration: _inputDeco('اختر الحساب *'),
            items: _accounts
                .map((a) => DropdownMenuItem(
                    value: a.id, child: Text('${a.id} — ${a.name}')))
                .toList(),
            onChanged: (v) {
              setState(() {
                row.accountId     = v ?? '';
                row.selectedBoxId = null;
                row.constraint    = null;
                final newC = v != null
                    ? listConstraintsForAccount(v, _allBoxes)
                    : <CashboxConstraint>[];
                if (newC.length == 1) {
                  row.constraint    = newC.first;
                  row.selectedBoxId = newC.first.boxId;
                  row.currency      =
                      newC.first.currency ?? _mainCurrency;
                  row.rate          =
                      newC.first.exchangeRate?.toString() ?? '1';
                } else {
                  row.currency = _mainCurrency;
                  row.rate     = '1';
                }
              });
              _recalc(i);
            },
            isExpanded: true),
        const SizedBox(height: 10),

        // ── اختيار الصندوق (عند تعدد الصناديق) ──
        if (constraints.length > 1) ...[
          CashboxSelectorWidget(
            constraints:   constraints,
            selectedBoxId: row.selectedBoxId,
            onSelected: (c) {
              setState(() {
                row.constraint    = c;
                row.selectedBoxId = c?.boxId;
                if (c != null) {
                  row.currency = c.currency ?? _mainCurrency;
                  row.rate     = c.exchangeRate?.toString() ?? row.rate;
                } else {
                  row.currency = _mainCurrency;
                  row.rate     = '1';
                }
              });
              _recalc(i);
            },
          ),
          const SizedBox(height: 10),
        ],

        // ── شارة الصندوق النشط ──
        if (activeConstraint != null) ...[
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.blue.shade200)),
            child: Row(children: [
              const Icon(Icons.account_balance_wallet,
                  size: 14, color: Colors.blue),
              const SizedBox(width: 6),
              Expanded(
                  child: Text('صندوق: ${activeConstraint.boxName}',
                      style: const TextStyle(
                          fontSize: 12, color: Colors.blue))),
              if (currencyLocked)
                Icon(Icons.lock, size: 12, color: Colors.blue.shade300),
              if (currencyLocked)
                Text(' مثبّت',
                    style: TextStyle(
                        fontSize: 10, color: Colors.blue.shade300)),
            ]),
          ),
        ],

        // ── المبلغ + سعر الصرف ──
        Row(children: [
          Expanded(
              flex: 5,
              child: TextFormField(
                  initialValue: row.amount,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true, signed: true),
                  decoration: _inputDeco('المبلغ *', suffix: entrySym),
                  onChanged: (v) {
                    row.amount = v;
                    _recalc(i);
                  },
                  style: const TextStyle(fontSize: 13))),
          const SizedBox(width: 8),
          Expanded(
              flex: 4,
              child: TextFormField(
                  key: ValueKey('rate_$i${row.selectedBoxId}'),
                  initialValue: rateLocked
                      ? (activeConstraint!.exchangeRate
                              ?.toStringAsFixed(4) ??
                          '1')
                      : row.rate,
                  readOnly: rateLocked,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true),
                  decoration: _inputDeco('الصرف',
                      suffix: rateLocked ? '🔒' : null),
                  onChanged: rateLocked
                      ? null
                      : (v) {
                          row.rate = v;
                          _recalc(i);
                        },
                  style: TextStyle(
                      fontSize: 13,
                      color: rateLocked
                          ? Colors.grey.shade500
                          : null))),
        ]),
        const SizedBox(height: 8),

        // ── العملة (مثبّتة أو حرة) ──
        if (currencyLocked)
          Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade300)),
              child: Row(children: [
                const Icon(Icons.lock, size: 14, color: Colors.grey),
                const SizedBox(width: 6),
                Text(
                    'العملة: $effectiveCurrency ${_currencySymbol(effectiveCurrency)}',
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF374151))),
              ]))
        else
          DropdownButtonFormField<String>(
              initialValue: row.currency,
              decoration: _inputDeco('العملة'),
              items: _supportedCurrencies()
                  .map((c) => DropdownMenuItem(
                      value: c,
                      child: Text('$c ${_currencySymbol(c)}',
                          style: const TextStyle(fontSize: 13))))
                  .toList(),
              onChanged: (v) => setState(() {
                    row.currency = v ?? _mainCurrency;
                    _recalc(i);
                  }),
              isDense: true,
              isExpanded: true),
        const SizedBox(height: 8),

        // ── المبلغ المحوَّل ──
        Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
                color: const Color(0xFF021B79).withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(10)),
            child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('= بـ $_mainCurrency:',
                      style: TextStyle(
                          color: Colors.grey.shade600, fontSize: 13)),
                  Text(
                      '${row.convertedAmount.toStringAsFixed(2)} $mainSym',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF021B79),
                          fontSize: 15)),
                ])),
        const SizedBox(height: 8),
        TextFormField(
            initialValue: row.statement,
            maxLines: 2,
            decoration: _inputDeco('البيان (اختياري)'),
            onChanged: (v) => row.statement = v,
            style: const TextStyle(fontSize: 13)),
        const SizedBox(height: 8),
        // ── حقل التاريخ ──
        GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: row.date,
              firstDate: DateTime(2000),
              lastDate: DateTime(2100),
              locale: const Locale('ar'),
            );
            if (picked != null) {
              setState(() => row.date = DateTime(
                    picked.year, picked.month, picked.day,
                    row.date.hour, row.date.minute,
                  ));
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade400),
                borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              Icon(Icons.calendar_today_outlined,
                  size: 18, color: const Color(0xFF021B79)),
              const SizedBox(width: 10),
              Text(
                  'التاريخ: ${row.date.year}/${row.date.month.toString().padLeft(2, '0')}/${row.date.day.toString().padLeft(2, '0')}',
                  style: const TextStyle(fontSize: 13)),
              const Spacer(),
              Icon(Icons.edit_outlined,
                  size: 16, color: Colors.grey.shade500),
            ]),
          ),
        ),
      ]),
    );
  }

  void _recalc(int i) {
    final row = _rows[i];
    final a = double.tryParse(row.amount) ?? 0.0;
    final r = double.tryParse(row.rate) ?? 1.0;
    setState(() {
      row.convertedAmount =
          r != 0 ? double.parse((a / r).toStringAsFixed(6)) : 0.0;
    });
  }

  Future<void> _save() async {
    for (final row in _rows) {
      if (row.accountId.isEmpty) {
        _snack(context, ' يرجى اختيار الحساب لكل قيد', error: true);
        return;
      }
      if (double.tryParse(row.amount) == null) {
        _snack(context, ' يرجى إدخال مبلغ صحيح', error: true);
        return;
      }
    }
    setState(() => _saving = true);
    try {
      for (final row in _rows) {
        // تحديد سعر الصرف والعملة الفعليين (مع الأولوية للصندوق)
        final effectiveCurrency = row.constraint?.currency ?? row.currency;
        final effectiveRate = row.constraint?.rateLocked == true
            ? (row.constraint!.exchangeRate ?? double.tryParse(row.rate) ?? 1.0)
            : (double.tryParse(row.rate) ?? 1.0);

        await DataService.addOperation(
            accountId:    row.accountId,
            amount:       double.parse(row.amount),
            exchangeRate: effectiveRate,
            currency:     effectiveCurrency,
            statement:    row.statement,
            date:         row.date);
      }
      if (mounted) {
        Navigator.pop(context);
        _snack(context, ' تم حفظ ${_rows.length} قيد');
      }
    } catch (e) {
      if (mounted) _snack(context, ' خطأ: $e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _OpRow {
  String accountId, amount = '', rate = '1', currency, statement = '';
  double convertedAmount = 0.0;
  DateTime date = DateTime.now();
  // ── الصناديق ──
  String? selectedBoxId;
  CashboxConstraint? constraint;
  _OpRow({required this.accountId, required this.currency});
}

//
//  تبويب الصناديق
//
class _CashboxesTab extends StatelessWidget {
  const _CashboxesTab();
  @override
  Widget build(BuildContext context) => const CashboxesScreen();
}


// ════════════════════════════════════════════════════════════════════
//  محرّك تحليل المخاطر
// ════════════════════════════════════════════════════════════════════
enum RiskLevel { low, medium, high, critical }

class FinancialAlert {
  final String message;
  final RiskLevel level;
  final IconData icon;
  const FinancialAlert({required this.message, required this.level, required this.icon});
}

class FinancialInsight {
  final String title;
  final String body;
  final IconData icon;
  final Color color;
  const FinancialInsight({required this.title, required this.body, required this.icon, required this.color});
}

class FinancialHealthScore {
  final int score;
  final String label;
  final Color color;
  const FinancialHealthScore({required this.score, required this.label, required this.color});
}

class FinancialRiskEngine {
  final List<Operation> ops;
  final List<Account> accounts;
  final String mainCurrency;
  FinancialRiskEngine({required this.ops, required this.accounts, required this.mainCurrency});

  double get totalCredit => ops.where((o) => o.amountUSD >= 0).fold(0.0, (s, o) => s + o.amountUSD);
  double get totalDebit => ops.where((o) => o.amountUSD < 0).fold(0.0, (s, o) => s + o.amountUSD.abs());
  double get netBalance => totalCredit - totalDebit;

  Map<String, double> get accountBalances {
    final map = <String, double>{};
    for (final op in ops) map[op.accountId] = (map[op.accountId] ?? 0) + op.amountUSD;
    return map;
  }

  Map<String, DateTime> get lastMovement {
    final map = <String, DateTime>{};
    for (final op in ops) {
      if (!map.containsKey(op.accountId) || op.date.isAfter(map[op.accountId]!)) map[op.accountId] = op.date;
    }
    return map;
  }

  double _monthCredit(int back) {
    final now = DateTime.now();
    final t = DateTime(now.year, now.month - back);
    return ops.where((o) => o.date.year == t.year && o.date.month == t.month && o.amountUSD >= 0).fold(0.0, (s, o) => s + o.amountUSD);
  }

  double _monthDebit(int back) {
    final now = DateTime.now();
    final t = DateTime(now.year, now.month - back);
    return ops.where((o) => o.date.year == t.year && o.date.month == t.month && o.amountUSD < 0).fold(0.0, (s, o) => s + o.amountUSD.abs());
  }

  double get avgDailyDebit {
    if (ops.isEmpty) return 0;
    final dates = ops.map((o) => o.date).toList()..sort();
    final days = dates.last.difference(dates.first).inDays.clamp(1, 9999).toDouble();
    return totalDebit / days;
  }

  int get estimatedDaysUntilBroke {
    if (avgDailyDebit <= 0 || netBalance <= 0) return 9999;
    return (netBalance / avgDailyDebit).floor();
  }

  List<String> get duplicateStatements {
    final count = <String, int>{};
    for (final op in ops) if (op.statement.isNotEmpty) count[op.statement] = (count[op.statement] ?? 0) + 1;
    return count.entries.where((e) => e.value >= 3).map((e) => e.key).toList();
  }

  List<Account> get dormantAccounts {
    final last = lastMovement;
    final now = DateTime.now();
    return accounts.where((a) {
      final lm = last[a.id];
      return lm == null || now.difference(lm).inDays > 90;
    }).toList();
  }

  Account? get topRevenueAccount {
    if (accounts.isEmpty) return null;
    final bal = accountBalances;
    return accounts.reduce((a, b) => (bal[a.id] ?? 0) > (bal[b.id] ?? 0) ? a : b);
  }

  double get topAccountRevenueRatio {
    if (totalCredit <= 0) return 0;
    final top = topRevenueAccount;
    if (top == null) return 0;
    final topCredit = ops.where((o) => o.accountId == top.id && o.amountUSD >= 0).fold(0.0, (s, o) => s + o.amountUSD);
    return topCredit / totalCredit;
  }

  List<FinancialAlert> buildAlerts() {
    final alerts = <FinancialAlert>[];
    final sym = _sym();
    if (netBalance < 0) alerts.add(FinancialAlert(message: 'الرصيد الإجمالي سالب (${netBalance.toStringAsFixed(2)} $sym)', level: RiskLevel.critical, icon: Icons.error_outline));
    final days = estimatedDaysUntilBroke;
    if (days < 30 && days > 0 && days < 9999) alerts.add(FinancialAlert(message: 'السيولة الحالية تكفي لـ $days يوماً فقط', level: RiskLevel.critical, icon: Icons.hourglass_bottom));
    else if (days < 60 && days < 9999) alerts.add(FinancialAlert(message: 'السيولة قد تنفد خلال $days يوماً', level: RiskLevel.high, icon: Icons.hourglass_top));
    if (totalDebit > totalCredit && totalCredit > 0) {
      final r = ((totalDebit / totalCredit - 1) * 100).toStringAsFixed(0);
      alerts.add(FinancialAlert(message: 'المصروفات تتجاوز الإيرادات بنسبة $r%', level: RiskLevel.high, icon: Icons.trending_down));
    }
    final curC = _monthCredit(0); final prevC = _monthCredit(1);
    if (prevC > 0 && curC < prevC * 0.8) {
      final d = ((1 - curC / prevC) * 100).toStringAsFixed(0);
      alerts.add(FinancialAlert(message: 'إيرادات هذا الشهر انخفضت $d% عن الشهر الماضي', level: RiskLevel.medium, icon: Icons.arrow_downward));
    }
    final curD = _monthDebit(0); final prevD = _monthDebit(1);
    if (prevD > 0 && curD > prevD * 1.2) {
      final r = ((curD / prevD - 1) * 100).toStringAsFixed(0);
      alerts.add(FinancialAlert(message: 'مصروفات هذا الشهر ارتفعت $r% عن الشهر الماضي', level: RiskLevel.medium, icon: Icons.arrow_upward));
    }
    final ratio = topAccountRevenueRatio;
    if (ratio > 0.6 && topRevenueAccount != null) alerts.add(FinancialAlert(message: '${(ratio * 100).toStringAsFixed(0)}% من الإيرادات من "${topRevenueAccount!.name}" — خطر تركّز', level: RiskLevel.medium, icon: Icons.person_pin));
    final dormant = dormantAccounts;
    if (dormant.isNotEmpty) alerts.add(FinancialAlert(message: '${dormant.length} حساب خامل منذ أكثر من 90 يوماً', level: RiskLevel.low, icon: Icons.bedtime_outlined));
    final dups = duplicateStatements;
    if (dups.isNotEmpty) alerts.add(FinancialAlert(message: 'قيود مكررة مشبوهة: "${dups.first}"${dups.length > 1 ? " وغيرها" : ""}', level: RiskLevel.medium, icon: Icons.content_copy));
    final bal = accountBalances;
    for (final acc in accounts) {
      final b = bal[acc.id] ?? 0;
      if (b < -1000) { alerts.add(FinancialAlert(message: '🔴 حساب "${acc.name}" برصيد سالب: ${b.toStringAsFixed(2)} $sym', level: RiskLevel.high, icon: Icons.account_balance_wallet)); break; }
    }
    if (ops.isNotEmpty) {
      final lastOp = ops.map((o) => o.date).reduce((a, b) => a.isAfter(b) ? a : b);
      final d = DateTime.now().difference(lastOp).inDays;
      if (d > 14) alerts.add(FinancialAlert(message: '⏰ لم يتم إدخال أي قيد منذ $d يوماً', level: RiskLevel.low, icon: Icons.timer_off_outlined));
    }
    return alerts;
  }

  List<FinancialInsight> buildInsights() {
    final insights = <FinancialInsight>[];
    final sym = _sym();
    if (netBalance > 0 && totalDebit < totalCredit) insights.add(FinancialInsight(title: 'الوضع المالي إيجابي', body: 'الإيرادات (${totalCredit.toStringAsFixed(2)} $sym) تفوق المصروفات (${totalDebit.toStringAsFixed(2)} $sym).', icon: Icons.verified_outlined, color: const Color(0xFF059669)));
    if (totalCredit > 0) {
      final pct = (netBalance / totalCredit) * 100;
      insights.add(FinancialInsight(title: 'نسبة الربحية الإجمالية', body: '${pct.toStringAsFixed(1)}% — ${pct > 20 ? "ممتازة، حافظ عليها" : pct > 10 ? "جيدة، يمكن تحسينها" : "تحتاج مراجعة مصروفاتك"}', icon: Icons.percent, color: pct > 15 ? const Color(0xFF059669) : const Color(0xFFD97706)));
    }
    if (avgDailyDebit > 0) insights.add(FinancialInsight(title: 'متوسط الإنفاق اليومي', body: '${avgDailyDebit.toStringAsFixed(2)} $sym/يوم — السيولة تكفي ${estimatedDaysUntilBroke < 9999 ? "${estimatedDaysUntilBroke} يوماً" : "فترة طويلة"}', icon: Icons.calendar_today_outlined, color: const Color(0xFF0575E6)));
    final curC = _monthCredit(0); final prevC = _monthCredit(1);
    if (prevC > 0 && curC > 0) {
      final chg = (curC / prevC - 1) * 100;
      insights.add(FinancialInsight(title: 'إيرادات هذا الشهر', body: '${curC.toStringAsFixed(2)} $sym — ${chg >= 0 ? "↑ ارتفاع" : "↓ انخفاض"} ${chg.abs().toStringAsFixed(1)}% عن الشهر الماضي', icon: chg >= 0 ? Icons.trending_up : Icons.trending_down, color: chg >= 0 ? const Color(0xFF059669) : Colors.red));
    }
    if (accounts.isNotEmpty) {
      final opCount = <String, int>{};
      for (final op in ops) opCount[op.accountId] = (opCount[op.accountId] ?? 0) + 1;
      final topId = opCount.entries.isEmpty ? null : opCount.entries.reduce((a, b) => a.value > b.value ? a : b).key;
      if (topId != null) {
        final topAcc = accounts.where((a) => a.id == topId).firstOrNull;
        if (topAcc != null) insights.add(FinancialInsight(title: 'أكثر الحسابات نشاطاً', body: '"${topAcc.name}" بـ ${opCount[topId]} قيد — راجعه بانتظام', icon: Icons.local_fire_department_outlined, color: const Color(0xFFD97706)));
      }
    }
    return insights;
  }

  List<String> buildRecommendations() {
    final recs = <String>[];
    if (totalDebit > totalCredit * 0.8) recs.add('راجع بنود المصروفات وحدد أي منها يمكن خفضه');
    if (estimatedDaysUntilBroke < 60 && estimatedDaysUntilBroke > 0) recs.add('زِد التحصيلات وخفف الإنفاق لتحسين السيولة');
    if (dormantAccounts.isNotEmpty) recs.add('راجع الحسابات الخاملة وأغلق غير المستخدمة');
    if (topAccountRevenueRatio > 0.6) recs.add('وسّع قاعدة إيراداتك وقلل الاعتماد على مصدر واحد');
    if (duplicateStatements.isNotEmpty) recs.add('افحص القيود المكررة وتأكد من عدم التسجيل المزدوج');
    if (_monthCredit(0) < _monthCredit(1) * 0.9) recs.add('ركز على زيادة المبيعات والتحصيلات هذا الشهر');
    if (accounts.length > 20 && ops.length < 50) recs.add('عدد حساباتك كبير نسبة للقيود — فكر بدمج بعض الحسابات');
    if (recs.isEmpty) recs.add('واصل الأداء الجيد وراجع بياناتك أسبوعياً');
    return recs.take(5).toList();
  }

  FinancialHealthScore computeHealthScore() {
    int score = 100;
    if (netBalance < 0) score -= 30;
    if (totalDebit > totalCredit) score -= 20;
    else if (totalDebit > totalCredit * 0.85) score -= 10;
    final days = estimatedDaysUntilBroke;
    if (days < 30) score -= 20;
    else if (days < 60) score -= 10;
    if (topAccountRevenueRatio > 0.6) score -= 10;
    if (duplicateStatements.isNotEmpty) score -= 5;
    if (dormantAccounts.length > 3) score -= 5;
    if (_monthCredit(0) < _monthCredit(1) * 0.8) score -= 5;
    score = score.clamp(0, 100);
    String label; Color color;
    if (score >= 80) { label = 'ممتاز'; color = const Color(0xFF059669); }
    else if (score >= 60) { label = 'جيد'; color = const Color(0xFF0575E6); }
    else if (score >= 40) { label = 'متوسط'; color = const Color(0xFFD97706); }
    else { label = 'يحتاج تدخلاً'; color = Colors.red; }
    return FinancialHealthScore(score: score, label: label, color: color);
  }

  String _sym() {
    const map = {'USD': '\$', 'ILS': '₪', 'JOD': 'د.أ', 'EUR': '€', 'SAR': 'ر.س', 'AED': 'د.إ'};
    return map[mainCurrency] ?? mainCurrency;
  }
}


//
//  تبويب التحليلات — 3 تبويبات: التقارير / المخاطر / الذكاء الاصطناعي
//
class _SignOutRoute extends PageRouteBuilder {
  _SignOutRoute() : super(
    pageBuilder: (_, __, ___) => const WelcomeScreen(),
    transitionDuration: const Duration(milliseconds: 750),
    transitionsBuilder: (_, anim, __, child) {
      final cv = CurvedAnimation(parent: anim, curve: Curves.easeInOutCubic);
      return Stack(children: [
        SlideTransition(
          position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(cv),
          child: Container(decoration: const BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topRight, end: Alignment.bottomLeft,
            colors: [Color(0xFF011260), Color(0xFF021B79), Color(0xFF0575E6)],
            stops: [0.0, 0.5, 1.0])))),
        FadeTransition(
          opacity: Tween(begin: 0.0, end: 1.0).animate(
              CurvedAnimation(parent: anim,
                  curve: const Interval(0.45, 1.0, curve: Curves.easeOut))),
          child: SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 0.07), end: Offset.zero).animate(
                CurvedAnimation(parent: anim,
                    curve: const Interval(0.4, 1.0, curve: Curves.easeOutCubic))),
            child: child)),
      ]);
    });
}

class _AnalyticsTab extends StatefulWidget {
  const _AnalyticsTab();
  @override
  State<_AnalyticsTab> createState() => _AnalyticsTabState();
}

class _AnalyticsTabState extends State<_AnalyticsTab>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Operation> _ops = [];
  List<Account> _accounts = [];
  String _mainCurrency = 'USD';
  bool _loading = true;
  FinancialRiskEngine? _engine;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() { _tabCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    _ops = await DataService.getOperations();
    _accounts = await DataService.getAccounts();
    _mainCurrency = await DataService.getMainCurrency();
    _engine = FinancialRiskEngine(ops: _ops, accounts: _accounts, mainCurrency: _mainCurrency);
    if (mounted) setState(() => _loading = false);
    // فحص المخاطر وإرسال إشعارات
    unawaited(_checkRiskNotifications());
  }

  Future<void> _checkRiskNotifications() async {
    final engine = _engine;
    if (engine == null) return;
    await NotificationService.checkAndNotifyRisks(
      netBalance: engine.netBalance,
      totalCredit: engine.totalCredit,
      totalDebit: engine.totalDebit,
      estimatedDays: engine.estimatedDaysUntilBroke,
      dormantCount: engine.dormantAccounts.length,
      duplicates: engine.duplicateStatements,
      currency: _mainCurrency,
      forceCheck: false,
    );
  }

  DashboardData _buildDashboard() {
    double totalCredit = 0, totalDebit = 0;
    for (final op in _ops) { if (op.amountUSD >= 0) totalCredit += op.amountUSD; else totalDebit += op.amountUSD.abs(); }
    final now = DateTime.now();
    final monthlyMap = <String, MonthlyData>{};
    for (int i = 5; i >= 0; i--) {
      final d = DateTime(now.year, now.month - i, 1);
      final key = '${d.month}/${d.year.toString().substring(2)}';
      final names = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      monthlyMap[key] = MonthlyData(names[d.month - 1], 0, 0);
    }
    for (final op in _ops) {
      final key = '${op.date.month}/${op.date.year.toString().substring(2)}';
      if (monthlyMap.containsKey(key)) {
        final e = monthlyMap[key]!;
        monthlyMap[key] = op.amountUSD >= 0 ? MonthlyData(e.month, e.credit + op.amountUSD, e.debit) : MonthlyData(e.month, e.credit, e.debit + op.amountUSD.abs());
      }
    }
    final accMap = <String, List<Operation>>{};
    for (final op in _ops) accMap.putIfAbsent(op.accountId, () => []).add(op);
    final topAccounts = _accounts.map((a) { final aOps = accMap[a.id] ?? []; return AccountPerf(a.name, a.id, aOps.fold(0.0, (s, o) => s + o.amountUSD), aOps.length); }).toList()..sort((a, b) => b.balance.abs().compareTo(a.balance.abs()));
    return DashboardData(totalBalance: totalCredit - totalDebit, totalCredit: totalCredit, totalDebit: totalDebit, netProfit: totalCredit - totalDebit, accountCount: _accounts.length, opCount: _ops.length, mainCurrency: _mainCurrency, monthly: monthlyMap.values.toList(), topAccounts: topAccounts.take(10).toList(), alerts: [], allAccounts: _accounts, allOperations: _ops, company: companyNotifier.value);
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    final alerts = _engine?.buildAlerts() ?? [];
    final criticalCount = alerts.where((a) => a.level == RiskLevel.critical || a.level == RiskLevel.high).length;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: Column(children: [
          SizedBox(
            height: h * 0.20,
            child: SafeArea(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Text('تحليلات', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 26)),
                if (criticalCount > 0) ...[
                  const SizedBox(width: 8),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(20)), child: Text('$criticalCount', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold))),
                ]
              ]),
              const SizedBox(height: 12),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 12),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(28)),
                child: TabBar(
                  controller: _tabCtrl,
                  indicator: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
                  indicatorSize: TabBarIndicatorSize.tab,
                  dividerColor: Colors.transparent,
                  labelColor: const Color(0xFF021B79),
                  unselectedLabelColor: Colors.white,
                  labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Cairo'),
                  unselectedLabelStyle: const TextStyle(fontSize: 12, fontFamily: 'Cairo'),
                  tabs: [
                    const Tab(text: 'التقارير'),
                    Tab(child: Stack(clipBehavior: Clip.none, children: [
                      const Text('المخاطر'),
                      if (criticalCount > 0) Positioned(top: -6, left: -8, child: Container(width: 16, height: 16, decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle), child: Center(child: Text('$criticalCount', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold))))),
                    ])),
                    const Tab(text: 'الذكاء'),
                  ],
                ),
              ),
            ])),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.only(topLeft: Radius.circular(36), topRight: Radius.circular(36)),
              child: _loading
                ? Container(color: Colors.grey.shade50, child: const Center(child: CircularProgressIndicator(color: Color(0xFF021B79))))
                : TabBarView(controller: _tabCtrl, children: [_buildReportsView(), _buildRisksView(), _buildAIView()]),
            ),
          ),
        ]),
      ),
    );
  }

  // ── تبويب التقارير ──
  Widget _buildReportsView() {
    final engine = _engine!;
    final sym = _currencySymbol(_mainCurrency);
    final health = engine.computeHealthScore();
    final net = engine.netBalance;
    return Container(
      color: Colors.grey.shade50,
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          const SizedBox(height: 4),
          // درجة الصحة المالية
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(gradient: LinearGradient(colors: [health.color.withValues(alpha: 0.85), health.color]), borderRadius: BorderRadius.circular(20)),
            child: Row(children: [
              SizedBox(width: 70, height: 70, child: Stack(alignment: Alignment.center, children: [
                CircularProgressIndicator(value: health.score / 100, strokeWidth: 7, backgroundColor: Colors.white.withValues(alpha: 0.3), color: Colors.white),
                Text('${health.score}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
              ])),
              const SizedBox(width: 16),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('الصحة المالية', style: TextStyle(color: Colors.white70, fontSize: 12)),
                Text(health.label, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                Text('/100', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
              ])),
            ]),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _rCard('الإيرادات', '${engine.totalCredit.toStringAsFixed(2)} $sym', Icons.trending_up, Colors.green.shade700)),
            const SizedBox(width: 10),
            Expanded(child: _rCard('المصروفات', '${engine.totalDebit.toStringAsFixed(2)} $sym', Icons.trending_down, Colors.red.shade700)),
          ]),
          const SizedBox(height: 10),
          Container(
            width: double.infinity, padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(gradient: LinearGradient(colors: net >= 0 ? [Colors.green.shade600, Colors.green.shade400] : [Colors.red.shade600, Colors.red.shade400]), borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              Icon(net >= 0 ? Icons.thumb_up_outlined : Icons.thumb_down_outlined, color: Colors.white, size: 28),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('صافي الربح / الخسارة', style: TextStyle(color: Colors.white70, fontSize: 12)),
                Text('${net >= 0 ? "+" : ""}${net.toStringAsFixed(2)} $sym', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
              ])),
              Text(net >= 0 ? ' ممتاز' : ' تحتاج مراجعة', style: const TextStyle(color: Colors.white, fontSize: 12)),
            ]),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _rCard('القيود', '${_ops.length}', Icons.receipt_long, Colors.blue.shade700)),
            const SizedBox(width: 10),
            Expanded(child: _rCard('الحسابات', '${_accounts.length}', Icons.account_balance, const Color(0xFF021B79))),
          ]),
          const SizedBox(height: 16),
          const Text('رؤى مالية', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 8),
          ...engine.buildInsights().map((ins) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: ins.color.withValues(alpha: 0.2)), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6)]),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: ins.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)), child: Icon(ins.icon, color: ins.color, size: 18)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(ins.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 3),
                Text(ins.body, style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.4)),
              ])),
            ]),
          )),
          const SizedBox(height: 16),
          // ── روابط التقارير المالية ─────────────────
          const Row(children: [
            Icon(Icons.bar_chart_outlined, color: Color(0xFF021B79), size: 20),
            SizedBox(width: 8),
            Text('التقارير المالية', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          ]),
          const SizedBox(height: 8),
          ..._buildReportTiles(context),
          const SizedBox(height: 12),
          // ── زر لوحة التحكم الكاملة ────────────────
          SizedBox(width: double.infinity, child: OutlinedButton.icon(
            icon: const Icon(Icons.dashboard_outlined, color: Color(0xFF021B79), size: 18),
            label: const Text('لوحة التحكم الكاملة', style: TextStyle(color: Color(0xFF021B79), fontWeight: FontWeight.bold)),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => DashboardScreen(data: _buildDashboard()))),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFF021B79)), padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          )),
          const SizedBox(height: 24),
        ]),
      ),
    );
  }

  // ── بناء بلاطات التقارير ──
  List<Widget> _buildReportTiles(BuildContext ctx) {
    final ra = toReportAccounts(_accounts, _ops);
    final ro = toReportOps(_ops);
    final c = companyNotifier.value;
    final co = ReportCompanyInfo(
      name:    c.name,
      phone:   c.phone,
      address: c.address,
      email:   c.email,
    );
    void push(Widget w) => Navigator.push(ctx, MaterialPageRoute(builder: (_) => w));
    final tiles = [
      (Icons.balance,          const Color(0xFF021B79),    'ميزان المراجعة',    () => push(TrialBalanceScreen(accounts: ra, operations: ro, company: co))),
      (Icons.trending_up,      Colors.green,               'قائمة الدخل',       () => push(IncomeStatementScreen(accounts: ra, operations: ro, company: co))),
      (Icons.account_balance,  Colors.indigo,              'الميزانية العمومية',() => push(BalanceSheetScreen(accounts: ra, company: co))),
      (Icons.receipt_long,     Colors.orange,              'كشف حساب',          () => push(AccountStatementScreen(accounts: ra, operations: ro, company: co))),
      (Icons.menu_book,        Colors.purple,              'دفتر الأستاذ',      () => push(GeneralLedgerScreen(accounts: ra, operations: ro, company: co))),
      (Icons.people_outline,   Colors.red,                 'تقرير المدينون',    () => push(DebtorsScreen(accounts: ra, operations: ro, company: co))),
      (Icons.business_center,  Colors.teal,                'تقرير الدائنون',    () => push(CreditorsScreen(accounts: ra, operations: ro, company: co))),
    ];
    return tiles.map((t) => Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4)]),
      child: InkWell(onTap: t.$4, borderRadius: BorderRadius.circular(12),
        child: Padding(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(children: [
            const Icon(Icons.chevron_left, color: Colors.grey, size: 16),
            const Spacer(),
            Text(t.$3, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.$2)),
            const SizedBox(width: 10),
            Container(padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(color: t.$2.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
              child: Icon(t.$1, color: t.$2, size: 18)),
          ]),
        )),
    )).toList();
  }

  // ── تبويب المخاطر ──
  Widget _buildRisksView() {
    final engine = _engine!;
    final alerts = engine.buildAlerts();
    final recs = engine.buildRecommendations();
    final health = engine.computeHealthScore();
    Color lc(RiskLevel l) => l == RiskLevel.critical ? Colors.red : l == RiskLevel.high ? Colors.orange : l == RiskLevel.medium ? const Color(0xFFD97706) : Colors.blue;
    String ll(RiskLevel l) => l == RiskLevel.critical ? 'حرج' : l == RiskLevel.high ? 'مرتفع' : l == RiskLevel.medium ? 'متوسط' : 'منخفض';
    return Container(
      color: Colors.grey.shade50,
      child: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: health.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16), border: Border.all(color: health.color.withValues(alpha: 0.3))),
          child: Row(children: [
            Icon(Icons.shield_outlined, color: health.color, size: 32),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('مستوى المخاطر الإجمالي', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
              Text(health.label, style: TextStyle(color: health.color, fontSize: 20, fontWeight: FontWeight.bold)),
            ])),
            Text('${health.score}/100', style: TextStyle(color: health.color, fontWeight: FontWeight.bold, fontSize: 18)),
          ]),
        ),
        const SizedBox(height: 16),
        Row(children: [
          const Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 20),
          const SizedBox(width: 8),
          Text('التنبيهات (${alerts.length})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        ]),
        const SizedBox(height: 8),
        if (alerts.isEmpty)
          Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.green.shade200)),
            child: const Row(children: [Icon(Icons.check_circle_outline, color: Colors.green), SizedBox(width: 10), Expanded(child: Text('لا توجد مخاطر — وضعك المالي ممتاز!', style: TextStyle(color: Colors.green)))]))
        else
          ...alerts.map((a) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: lc(a.level).withValues(alpha: 0.3)), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6)]),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(a.icon, color: lc(a.level), size: 20),
              const SizedBox(width: 10),
              Expanded(child: Text(a.message, style: const TextStyle(fontSize: 13, height: 1.4))),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: lc(a.level).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                child: Text(ll(a.level), style: TextStyle(fontSize: 10, color: lc(a.level), fontWeight: FontWeight.bold))),
            ]),
          )),
        const SizedBox(height: 16),
        const Row(children: [Icon(Icons.lightbulb_outline, color: Color(0xFFD97706), size: 20), SizedBox(width: 8), Text('التوصيات اليومية', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15))]),
        const SizedBox(height: 8),
        ...recs.asMap().entries.map((e) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6)]),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 24, height: 24, decoration: BoxDecoration(color: const Color(0xFF021B79), borderRadius: BorderRadius.circular(12)), child: Center(child: Text('${e.key + 1}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)))),
            const SizedBox(width: 10),
            Expanded(child: Text(e.value, style: const TextStyle(fontSize: 13, height: 1.4))),
          ]),
        )),
        if (engine.dormantAccounts.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [const Icon(Icons.bedtime_outlined, color: Color(0xFF6B7280), size: 18), const SizedBox(width: 8), Text('الحسابات الخاملة (${engine.dormantAccounts.length})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13))]),
              const SizedBox(height: 8),
              ...engine.dormantAccounts.take(5).map((a) {
                final last = engine.lastMovement[a.id];
                final days = last != null ? DateTime.now().difference(last).inDays : null;
                return Padding(padding: const EdgeInsets.only(bottom: 4), child: Row(children: [
                  const Icon(Icons.circle, size: 6, color: Color(0xFF9CA3AF)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(a.name, style: const TextStyle(fontSize: 12))),
                  if (days != null) Text('$days يوم', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                ]));
              }),
            ]),
          ),
        ],
        const SizedBox(height: 24),
      ])),
    );
  }

  // ── تبويب الذكاء الاصطناعي ──
  Widget _buildAIView() {
    final alertsAll = _engine?.buildAlerts() ?? [];
    return Container(
      color: Colors.grey.shade50,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        const SizedBox(height: 4),
        _AIFeatureCard(icon: Icons.smart_toy_outlined, title: 'المساعد المحاسبي الذكي', desc: 'تحليل شامل لوضعك المالي، إجابة على أسئلتك، ونصائح مخصصة لبياناتك.', color: const Color(0xFF021B79), onTap: () => _openAI(context), buttonLabel: 'ابدأ المحادثة'),
        const SizedBox(height: 12),
        _AIFeatureCard(icon: Icons.bolt_outlined, title: 'تحليل سريع لوضعك المالي', desc: 'اضغط لتحليل فوري وتلقائي لبياناتك مع تقرير مختصر.', color: const Color(0xFF059669), onTap: () => _quickAnalysis(context), buttonLabel: 'حلّل الآن'),
        const SizedBox(height: 12),
        _AIFeatureCard(icon: Icons.dashboard_outlined, title: 'لوحة التحكم المالية', desc: 'رسوم بيانية احترافية، مؤشرات KPI، وتحليل أداء الحسابات.', color: const Color(0xFF7C3AED), onTap: () => _openDashboard(context), buttonLabel: 'عرض اللوحة'),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8)]),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Row(children: [Icon(Icons.notifications_active_outlined, color: Color(0xFFD97706), size: 24), SizedBox(width: 10), Text('أبرز التنبيهات', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15))]),
            const SizedBox(height: 8),
            if (alertsAll.isEmpty)
              const Text(' لا توجد تنبيهات — وضعك المالي جيد!', style: TextStyle(color: Colors.green, fontSize: 13))
            else ...[
              ...alertsAll.take(4).map((a) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(a.message, style: const TextStyle(fontSize: 12, color: Color(0xFF374151), height: 1.4)))),
              if (alertsAll.length > 4) ...[
                const SizedBox(height: 6),
                GestureDetector(onTap: () => _tabCtrl.animateTo(1), child: const Text('عرض جميع التنبيهات →', style: TextStyle(color: Color(0xFF0575E6), fontSize: 12, fontWeight: FontWeight.w600))),
              ],
            ],
          ]),
        ),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _rCard(String title, String value, IconData icon, Color color) {
    return Container(padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8)]),
      child: Row(children: [
        Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: color, size: 20)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
          const SizedBox(height: 3),
          Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
        ])),
      ]));
  }

  Future<void> _openAI(BuildContext ctx) async {
    final ops = await DataService.getOperations(); final accounts = await DataService.getAccounts(); final currency = await DataService.getMainCurrency();
    double credit = 0, debit = 0;
    for (final op in ops) { if (op.amountUSD >= 0) credit += op.amountUSD; else debit += op.amountUSD.abs(); }
    final accMap = <String, double>{};
    for (final op in ops) accMap[op.accountId] = (accMap[op.accountId] ?? 0) + op.amountUSD;
    final summaries = accounts.map((a) => {'name': a.name, 'balance': accMap[a.id] ?? 0.0}).toList();
    final recentOps = ops.reversed.take(20).map((o) => {'statement': o.statement, 'amount': o.amount, 'currency': o.currency}).toList();
    if (!ctx.mounted) return;
    Navigator.push(ctx, MaterialPageRoute(builder: (_) => AIAssistantScreen(context: FinancialContext(totalBalance: credit - debit, accountCount: accounts.length, operationCount: ops.length, totalCredit: credit, totalDebit: debit, mainCurrency: currency, recentOps: recentOps, accountSummaries: summaries))));
  }

  Future<void> _quickAnalysis(BuildContext ctx) async {
    final engine = _engine; if (engine == null) return;
    final sym = _currencySymbol(_mainCurrency); final net = engine.netBalance; final health = engine.computeHealthScore();
    if (!ctx.mounted) return;
    showDialog(context: ctx, builder: (_) => Directionality(textDirection: ui.TextDirection.rtl, child: AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: const Row(children: [Text('⚡', style: TextStyle(fontSize: 24)), SizedBox(width: 8), Text('التحليل السريع', style: TextStyle(fontWeight: FontWeight.bold))]),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        _AnalysisRow('الإيرادات', '${engine.totalCredit.toStringAsFixed(2)} $sym', Colors.green),
        _AnalysisRow('المصروفات', '${engine.totalDebit.toStringAsFixed(2)} $sym', Colors.red),
        _AnalysisRow('صافي الربح', '${net >= 0 ? "+" : ""}${net.toStringAsFixed(2)} $sym', net >= 0 ? Colors.green : Colors.red),
        _AnalysisRow('الصحة المالية', '${health.score}/100 (${health.label})', health.color),
        if (engine.estimatedDaysUntilBroke < 9999) _AnalysisRow('السيولة تكفي', '${engine.estimatedDaysUntilBroke} يوم', engine.estimatedDaysUntilBroke < 30 ? Colors.red : Colors.orange),
        const Divider(),
        Text(net >= 0 ? ' وضعك المالي إيجابي.' : ' المصروفات تتجاوز الإيرادات.', style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563), height: 1.5)),
        if (engine.totalCredit > 0) ...[const SizedBox(height: 8), Text('نسبة الربحية: ${((net / engine.totalCredit) * 100).toStringAsFixed(1)}%', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: net >= 0 ? Colors.green : Colors.red))],
      ])),
      actions: [
        ElevatedButton(onPressed: () { Navigator.pop(_); _openAI(ctx); }, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF021B79)), child: const Text('تحليل أعمق مع AI', style: TextStyle(color: Colors.white))),
        TextButton(onPressed: () => Navigator.pop(_), child: const Text('إغلاق')),
      ],
    )));
  }

  Future<void> _openDashboard(BuildContext ctx) async {
    final ops = await DataService.getOperations(); final accounts = await DataService.getAccounts(); final currency = await DataService.getMainCurrency();
    double credit = 0, debit = 0;
    for (final op in ops) { if (op.amountUSD >= 0) credit += op.amountUSD; else debit += op.amountUSD.abs(); }
    final accMap = <String, List<Operation>>{};
    for (final op in ops) accMap.putIfAbsent(op.accountId, () => []).add(op);
    final topAccounts = accounts.map((a) { final aOps = accMap[a.id] ?? []; return AccountPerf(a.name, a.id, aOps.fold(0.0, (s, o) => s + o.amountUSD), aOps.length); }).toList()..sort((a, b) => b.balance.abs().compareTo(a.balance.abs()));
    if (!ctx.mounted) return;
    Navigator.push(ctx, MaterialPageRoute(builder: (_) => DashboardScreen(data: DashboardData(totalBalance: credit - debit, totalCredit: credit, totalDebit: debit, netProfit: credit - debit, accountCount: accounts.length, opCount: ops.length, mainCurrency: currency, monthly: [], topAccounts: topAccounts.take(10).toList(), alerts: [], allAccounts: accounts, allOperations: ops, company: companyNotifier.value))));
  }
}

class _AIFeatureCard extends StatelessWidget {
  final String title, desc, buttonLabel;
  final Color color;
  final VoidCallback onTap;
  final IconData icon;
  const _AIFeatureCard(
      {required this.icon,
      required this.title,
      required this.desc,
      required this.color,
      required this.onTap,
      required this.buttonLabel});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8)
        ],
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14)),
            child: Icon(icon, color: color, size: 26)),
        const SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 4),
          Text(desc,
              style: const TextStyle(
                  fontSize: 12, color: Color(0xFF6B7280), height: 1.45)),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: color,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(buttonLabel,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13)),
            ),
          ),
        ])),
      ]),
    );
  }
}

class _AnalysisRow extends StatelessWidget {
  final String label, value;
  final Color color;
  const _AnalysisRow(this.label, this.value, this.color);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Expanded(
            child: Text(label,
                style:
                    const TextStyle(fontSize: 13, color: Color(0xFF6B7280)))),
        Text(value,
            style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.bold, color: color)),
      ]),
    );
  }
}

//
//  تبويب الإعدادات
//
class _SettingsTab extends StatefulWidget {
  const _SettingsTab();
  @override
  State<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<_SettingsTab> {
  String _mainCurrency = 'USD';
  bool _loading = true;
  int _pendingCount = 0;
  CompanyInfo _company = const CompanyInfo(name: 'شركتي');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final currency = await DataService.getMainCurrency();
    final count = await DataService.pendingCount();
    final company = await DataService.getCompanyInfo();
    if (mounted) {
      setState(() {
        _mainCurrency = currency;
        _pendingCount = count;
        _company = company;
        _loading = false;
      });
    }
  }

  void _showCompanySheet() {
    showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => Directionality(
            textDirection: ui.TextDirection.rtl,
            child: _CompanySettingsSheet(company: _company, onSave: _load)));
  }

  void _showChangePassword() {
    showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const Directionality(
            textDirection: ui.TextDirection.rtl,
            child: _ChangePasswordSheet()));
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
            gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: CustomScrollView(slivers: [
          SliverAppBar(
              expandedHeight: h * 0.22,
              backgroundColor: Colors.transparent,
              elevation: 0,
              flexibleSpace: const FlexibleSpaceBar(
                  centerTitle: true,
                  title: Padding(
                      padding: EdgeInsets.only(bottom: 16),
                      child: Text('الإعدادات',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 28)))),
              pinned: false,
              floating: true),
          SliverFillRemaining(
              hasScrollBody: false,
              child: ClipRRect(
                borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(40),
                    topRight: Radius.circular(40)),
                child: Container(
                    color: Colors.grey.shade50,
                    padding: const EdgeInsets.all(16),
                    child: _loading
                        ? const Center(child: CircularProgressIndicator())
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                                const SizedBox(height: 10),

                                //  بطاقة الاشتراك
                                ValueListenableBuilder<SubscriptionInfo>(
                                  valueListenable: subscriptionNotifier,
                                  builder: (_, sub, __) => Container(
                                    padding: const EdgeInsets.all(16),
                                    margin: const EdgeInsets.only(bottom: 12),
                                    decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                            colors: sub.plan == PlanType.free
                                                ? [
                                                    Colors.grey.shade100,
                                                    Colors.grey.shade200
                                                  ]
                                                : [
                                                    const Color(0xFF021B79)
                                                        .withValues(
                                                            alpha: 0.05),
                                                    const Color(0xFF0575E6)
                                                        .withValues(alpha: 0.1)
                                                  ]),
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                            color: sub.plan == PlanType.free
                                                ? Colors.grey.shade300
                                                : const Color(0xFF021B79)
                                                    .withValues(alpha: 0.3))),
                                    child: Column(children: [
                                      Row(children: [
                                        Text(
                                            sub.plan == PlanType.free
                                                ? ''
                                                : sub.plan == PlanType.monthly
                                                    ? ''
                                                    : sub.plan ==
                                                            PlanType.yearly
                                                        ? ''
                                                        : '',
                                            style:
                                                const TextStyle(fontSize: 24)),
                                        const SizedBox(width: 12),
                                        Expanded(
                                            child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                              Text('خطة ${sub.planName}',
                                                  style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      fontSize: 15)),
                                              if (sub.expiresAt != null)
                                                Text(
                                                    'تنتهي: ${sub.expiresAt!.day}/${sub.expiresAt!.month}/${sub.expiresAt!.year}',
                                                    style: TextStyle(
                                                        fontSize: 12,
                                                        color: sub.daysLeft < 7
                                                            ? Colors.red
                                                            : Colors.grey
                                                                .shade600)),
                                              if (sub.plan == PlanType.lifetime)
                                                const Text('دائم ',
                                                    style: TextStyle(
                                                        fontSize: 12,
                                                        color:
                                                            Color(0xFF059669))),
                                              if (sub.plan == PlanType.free)
                                                Text('15 حساب / 100 قيد',
                                                    style: TextStyle(
                                                        fontSize: 12,
                                                        color: Colors
                                                            .grey.shade600)),
                                            ])),
                                        if (sub.plan == PlanType.free)
                                          ElevatedButton(
                                              onPressed: () => Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                      builder: (_) =>
                                                          const SubscriptionScreen())),
                                              style: ElevatedButton.styleFrom(
                                                  backgroundColor:
                                                      const Color(0xFF021B79),
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                          horizontal: 12,
                                                          vertical: 8),
                                                  shape: RoundedRectangleBorder(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              10))),
                                              child: const Text('ترقية',
                                                  style: TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.bold))),
                                        if (sub.plan != PlanType.free &&
                                            sub.plan != PlanType.lifetime)
                                          ElevatedButton(
                                              onPressed: () => Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                      builder: (_) =>
                                                          const SubscriptionScreen())),
                                              style: ElevatedButton.styleFrom(
                                                  backgroundColor:
                                                      Colors.green.shade600,
                                                  padding: const EdgeInsets.symmetric(
                                                      horizontal: 12,
                                                      vertical: 8),
                                                  shape: RoundedRectangleBorder(
                                                      borderRadius: BorderRadius.circular(
                                                          10))),
                                              child: const Text('تجديد',
                                                  style: TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.bold))),
                                      ]),
                                    ]),
                                  ),
                                ),

                                // نظام المبيعات
                                _sectionHeader('نظام المبيعات'),
                                Container(
                                  margin: const EdgeInsets.only(bottom: 16),
                                  width: double.infinity,
                                  child: ElevatedButton.icon(
                                    icon: const Icon(Icons.point_of_sale,
                                        color: Colors.white),
                                    label: const Text(
                                        'الانتقال إلى نظام المبيعات',
                                        style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF021B79),
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 16),
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(14)),
                                      elevation: 4,
                                    ),
                                    onPressed: () {
                                      final uid = FirebaseAuth
                                              .instance.currentUser?.uid ??
                                          '';
                                      Navigator.of(context).push(
                                          MaterialPageRoute(
                                              builder: (_) =>
                                                  SalesApp(ownerUid: uid)));
                                    },
                                  ),
                                ),

                                //  معلومات الشركة
                                _sectionHeader(' معلومات الشركة'),
                                Container(
                                    padding: const EdgeInsets.all(16),
                                    margin: const EdgeInsets.only(bottom: 12),
                                    decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(16),
                                        boxShadow: [
                                          BoxShadow(
                                              color: Colors.black
                                                  .withValues(alpha: 0.05),
                                              blurRadius: 8)
                                        ]),
                                    child: Column(children: [
                                      _infoRow('اسم الشركة', _company.name),
                                      _infoRow(
                                          'الهاتف',
                                          _company.phone.isEmpty
                                              ? 'غير محدد'
                                              : _company.phone),
                                      _infoRow(
                                          'البريد',
                                          _company.email.isEmpty
                                              ? 'غير محدد'
                                              : _company.email),
                                      _infoRow(
                                          'العنوان',
                                          _company.address.isEmpty
                                              ? 'غير محدد'
                                              : _company.address),
                                      const SizedBox(height: 8),
                                      SizedBox(
                                          width: double.infinity,
                                          child: OutlinedButton.icon(
                                              icon: const Icon(Icons.edit,
                                                  size: 16),
                                              label: const Text(
                                                  'تعديل معلومات الشركة'),
                                              onPressed: _showCompanySheet,
                                              style: OutlinedButton.styleFrom(
                                                  side: const BorderSide(
                                                      color: Color(0xFF021B79)),
                                                  foregroundColor: const Color(
                                                      0xFF021B79)))),
                                    ])),

                                //  العملة
                                _sectionHeader(' العملة الرئيسية'),
                                Container(
                                    padding: const EdgeInsets.all(16),
                                    margin: const EdgeInsets.only(bottom: 12),
                                    decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(16),
                                        boxShadow: [
                                          BoxShadow(
                                              color: Colors.black
                                                  .withValues(alpha: 0.05),
                                              blurRadius: 8)
                                        ]),
                                    child: DropdownButtonFormField<String>(
                                        initialValue: _mainCurrency,
                                        decoration: _inputDeco(''),
                                        items: _supportedCurrencies()
                                            .map((c) => DropdownMenuItem(
                                                value: c,
                                                child: Text(
                                                    '$c ${_currencySymbol(c)}')))
                                            .toList(),
                                        onChanged: (v) async {
                                          if (v == null) return;
                                          await DataService.setMainCurrency(v);
                                          setState(() => _mainCurrency = v);
                                          if (mounted)
                                            _snack(context,
                                                ' تم تغيير العملة إلى $v');
                                        },
                                        isExpanded: true)),

                                //  التحديثات
                                _sectionHeader(' التحديثات'),
                                const UpdateSettingsCard(),

                                //  الحساب
                                _sectionHeader(' الحساب'),
                                _settingsTile(
                                    title: 'تغيير كلمة المرور',
                                    icon: Icons.lock_outline,
                                    onTap: _showChangePassword),
                                _settingsTile(
                                    title: 'مزامنة يدوية',
                                    subtitle: '$_pendingCount عملية معلقة',
                                    icon: Icons.sync,
                                    onTap: () async {
                                      await DataService.syncNow();
                                      await _load();
                                      if (mounted)
                                        _snack(context, ' تمت المزامنة');
                                    }),
                                _settingsTile(
                                    title: 'حذف جميع البيانات',
                                    icon: Icons.delete_forever,
                                    isDestructive: true,
                                    onTap: () async {
                                      final confirmed = await showDialog<bool>(
                                          context: context,
                                          builder: (_) => AlertDialog(
                                                  title: const Text('تحذير '),
                                                  content: const Text(
                                                      'هل أنت متأكد من حذف جميع البيانات؟'),
                                                  actions: [
                                                    TextButton(
                                                        onPressed: () =>
                                                            Navigator.pop(
                                                                context, false),
                                                        child: const Text(
                                                            'إلغاء')),
                                                    ElevatedButton(
                                                        onPressed: () =>
                                                            Navigator.pop(
                                                                context, true),
                                                        style: ElevatedButton
                                                            .styleFrom(
                                                                backgroundColor:
                                                                    Colors.red),
                                                        child: const Text(
                                                            'احذف',
                                                            style: TextStyle(
                                                                color: Colors
                                                                    .white))),
                                                  ]));
                                      if (confirmed == true) {
                                        await DataService.clearAll();
                                        if (mounted)
                                          _snack(context, ' تم حذف البيانات');
                                      }
                                    }),
                                _settingsTile(
                                    title: 'تسجيل الخروج',
                                    icon: Icons.logout,
                                    isDestructive: true,
                                    onTap: () => _confirmSignOut(context)),
                                const SizedBox(height: 30),
                              ])),
              )),
        ]),
      ),
    );
  }

  void _confirmSignOut(BuildContext ctx) {
    showDialog(context: ctx, builder: (_) => Directionality(
      textDirection: ui.TextDirection.rtl,
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: const Row(children: [
          Icon(Icons.logout_rounded, color: Color(0xFF021B79)),
          SizedBox(width: 10),
          Text('تسجيل الخروج',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        ]),
        content: const Text('هل تريد تسجيل الخروج من حسابك؟'),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          OutlinedButton(
            onPressed: () => Navigator.pop(_),
            style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12))),
            child: const Text('إلغاء')),
          const SizedBox(width: 8),
          ElevatedButton.icon(
            icon: const Icon(Icons.logout_rounded, color: Colors.white, size: 16),
            label: const Text('خروج', style: TextStyle(color: Colors.white)),
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12))),
            onPressed: () async {
              Navigator.pop(_);
              await _doSignOut(ctx);
            }),
        ])));
  }

  Future<void> _doSignOut(BuildContext ctx) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    DataService.disposeSubscriptionListener();
    DataService.stopConnectivityMonitor();
    await FirebaseAuth.instance.signOut();
    // مسح الدور المحفوظ عند تسجيل الخروج
    if (uid != null) await UserRoleService.clearRole(uid);
    if (!ctx.mounted) return;
    Navigator.of(ctx).pushAndRemoveUntil(
        _SignOutRoute(), (route) => false);
  }

  Widget _sectionHeader(String title) => Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4, right: 4),
      child: Text(title,
          style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: Color(0xFF021B79))));

  Widget _infoRow(String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        SizedBox(
            width: 90,
            child: Text('$label:',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500))),
        Expanded(
            child: Text(value,
                style:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis)),
      ]));

  Widget _settingsTile(
      {required String title,
      String? subtitle,
      required IconData icon,
      required VoidCallback onTap,
      bool isDestructive = false}) {
    final color = isDestructive ? Colors.red : const Color(0xFF021B79);
    return Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03), blurRadius: 4)
            ]),
        child: ListTile(
            leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, color: color)),
            title: Text(title,
                style: TextStyle(color: color.withValues(alpha: 0.9))),
            subtitle: subtitle != null ? Text(subtitle) : null,
            trailing: Icon(Icons.chevron_right, color: Colors.grey.shade400),
            onTap: onTap));
  }
}

//
//  CompanySettingsSheet
//
class _CompanySettingsSheet extends StatefulWidget {
  final CompanyInfo company;
  final VoidCallback onSave;
  const _CompanySettingsSheet({required this.company, required this.onSave});
  @override
  State<_CompanySettingsSheet> createState() => _CompanySettingsSheetState();
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
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Form(
              key: _formKey,
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _sheetHandle(),
                const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(children: [
                      Text('معلومات الشركة',
                          style: TextStyle(
                              fontSize: 20, fontWeight: FontWeight.bold)),
                      Spacer(),
                      CloseButton()
                    ])),
                const Divider(height: 1),
                Expanded(
                    child: SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: Column(children: [
                          _field('اسم الشركة *', _nameCtrl,
                              validator: (v) =>
                                  v!.trim().isEmpty ? 'الاسم مطلوب' : null),
                          const SizedBox(height: 12),
                          _field('رقم الهاتف', _phoneCtrl,
                              type: TextInputType.phone),
                          const SizedBox(height: 12),
                          _field('البريد الإلكتروني', _emailCtrl,
                              type: TextInputType.emailAddress),
                          const SizedBox(height: 12),
                          _field('العنوان', _addressCtrl, maxLines: 2),
                        ]))),
                _saveButton(
                    label: 'حفظ معلومات الشركة',
                    saving: _saving,
                    onPressed: () async {
                      if (!_formKey.currentState!.validate()) return;
                      setState(() => _saving = true);
                      try {
                        await DataService.saveCompanyInfo(CompanyInfo(
                            name: _nameCtrl.text.trim(),
                            phone: _phoneCtrl.text.trim(),
                            email: _emailCtrl.text.trim(),
                            address: _addressCtrl.text.trim()));
                        if (mounted) {
                          Navigator.pop(context);
                          widget.onSave();
                          _snack(context, ' تم حفظ معلومات الشركة');
                        }
                      } catch (e) {
                        if (mounted) _snack(context, ' خطأ: $e', error: true);
                      } finally {
                        if (mounted) setState(() => _saving = false);
                      }
                    }),
              ]))),
    );
  }
}

//
//  ChangePasswordSheet
//
class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet();
  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _saving = false, _showC = false, _showN = false, _showCf = false;
  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.7),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Form(
              key: _formKey,
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _sheetHandle(),
                const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(children: [
                      Text('تغيير كلمة المرور',
                          style: TextStyle(
                              fontSize: 20, fontWeight: FontWeight.bold)),
                      Spacer(),
                      CloseButton()
                    ])),
                const Divider(height: 1),
                Expanded(
                    child: SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: Column(children: [
                          TextFormField(
                              controller: _currentCtrl,
                              obscureText: !_showC,
                              decoration: _inputDeco('كلمة المرور الحالية *')
                                  .copyWith(
                                      suffixIcon: IconButton(
                                          icon: Icon(_showC
                                              ? Icons.visibility_off
                                              : Icons.visibility),
                                          onPressed: () => setState(
                                              () => _showC = !_showC))),
                              validator: (v) => v!.isEmpty ? 'مطلوب' : null),
                          const SizedBox(height: 12),
                          TextFormField(
                              controller: _newCtrl,
                              obscureText: !_showN,
                              decoration: _inputDeco('كلمة المرور الجديدة *')
                                  .copyWith(
                                      suffixIcon: IconButton(
                                          icon: Icon(_showN
                                              ? Icons.visibility_off
                                              : Icons.visibility),
                                          onPressed: () => setState(
                                              () => _showN = !_showN))),
                              validator: (v) =>
                                  v!.length < 6 ? '6 أحرف على الأقل' : null),
                          const SizedBox(height: 12),
                          TextFormField(
                              controller: _confirmCtrl,
                              obscureText: !_showCf,
                              decoration:
                                  _inputDeco('تأكيد كلمة المرور الجديدة *')
                                      .copyWith(
                                          suffixIcon: IconButton(
                                              icon: Icon(_showCf
                                                  ? Icons.visibility_off
                                                  : Icons.visibility),
                                              onPressed: () => setState(
                                                  () => _showCf = !_showCf))),
                              validator: (v) =>
                                  v != _newCtrl.text ? 'غير متطابقة' : null),
                        ]))),
                _saveButton(
                    label: 'تحديث كلمة المرور',
                    saving: _saving,
                    onPressed: () async {
                      if (!_formKey.currentState!.validate()) return;
                      final user = FirebaseAuth.instance.currentUser;
                      if (user?.email == null) {
                        _snack(context, ' غير مدعوم', error: true);
                        return;
                      }
                      setState(() => _saving = true);
                      try {
                        final cred = EmailAuthProvider.credential(
                            email: user!.email!, password: _currentCtrl.text);
                        await user.reauthenticateWithCredential(cred);
                        await user.updatePassword(_newCtrl.text);
                        if (mounted) {
                          Navigator.pop(context);
                          _snack(context, ' تم تغيير كلمة المرور');
                        }
                      } on FirebaseAuthException catch (e) {
                        if (mounted) {
                          _snack(
                              context,
                              e.code == 'wrong-password'
                                  ? ' كلمة المرور الحالية خاطئة'
                                  : ' خطأ: ${e.code}',
                              error: true);
                        }
                      } finally {
                        if (mounted) setState(() => _saving = false);
                      }
                    }),
              ]))),
    );
  }
}

//
//  دوال مساعدة مشتركة
//
// موحّدة مع قائمة العملات الكاملة في sales_sys/currencies.dart (60+ عملة بما فيها USDT)
// حتى تكون نفس العملات متاحة في كل مكان يُدخل فيه مبلغ بعملة أجنبية
String _currencySymbol(String c) => currencySymbol(c);

List<String> _supportedCurrencies() =>
    kAllCurrencies.map((c) => c.code).toList();

InputDecoration _inputDeco(String label, {String? suffix, String? prefix}) {
  return InputDecoration(
      labelText: label.isEmpty ? null : label,
      hintText: label.isEmpty ? null : label,
      suffixText: suffix,
      prefixText: prefix,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade300)),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF021B79), width: 2)),
      filled: true,
      fillColor: Colors.white,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12));
}

Widget _field(String hint, TextEditingController ctrl,
    {TextInputType type = TextInputType.text,
    int maxLines = 1,
    String? Function(String?)? validator}) {
  return TextFormField(
      controller: ctrl,
      keyboardType: type,
      maxLines: maxLines,
      decoration: _inputDeco(hint),
      validator: validator,
      style: const TextStyle(fontSize: 14));
}

Widget _saveButton(
    {required String label,
    required bool saving,
    required VoidCallback onPressed}) {
  return Padding(
      padding: const EdgeInsets.all(16),
      child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
              onPressed: saving ? null : onPressed,
              style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF021B79),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14))),
              child: saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text(label,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold)))));
}

Widget _sheetHandle() => Center(
    child: Container(
        margin: const EdgeInsets.only(top: 12),
        width: 40,
        height: 4,
        decoration: BoxDecoration(
            color: Colors.grey.shade300,
            borderRadius: BorderRadius.circular(2))));

void _snack(BuildContext context, String msg, {bool error = false}) {
  if (!context.mounted) return;
  final overlay = Navigator.of(context, rootNavigator: true).overlay;
  if (overlay == null) return;
  late OverlayEntry entry;
  entry = OverlayEntry(builder: (_) => _SnackOverlay(msg: msg, error: error));
  overlay.insert(entry);
  Future.delayed(const Duration(milliseconds: 3200), () {
    if (entry.mounted) entry.remove();
  });
}

// ── Global success snack helper ──────────────
// ignore: unused_element
void _showSuccess(BuildContext context, String msg) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Row(children: [
      const Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
      const SizedBox(width: 10),
      Text(msg, style: const TextStyle(fontWeight: FontWeight.w600)),
    ]),
    backgroundColor: const Color(0xFF059669),
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
    duration: const Duration(seconds: 2),
  ));
}

// ignore: unused_element
void _showError(BuildContext context, String msg) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Row(children: [
      const Icon(Icons.error_outline, color: Colors.white, size: 20),
      const SizedBox(width: 10),
      Expanded(
          child:
              Text(msg, style: const TextStyle(fontWeight: FontWeight.w600))),
    ]),
    backgroundColor: Colors.red.shade700,
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
    duration: const Duration(seconds: 3),
  ));
}

class _SnackOverlay extends StatefulWidget {
  final String msg;
  final bool error;
  const _SnackOverlay({required this.msg, required this.error});
  @override
  State<_SnackOverlay> createState() => _SnackOverlayState();
}

class _SnackOverlayState extends State<_SnackOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<Offset> _slide;
  late Animation<double> _fade;
  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 320));
    _slide = Tween<Offset>(begin: const Offset(0, 1.2), end: Offset.zero)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _ctrl.forward();
    Future.delayed(const Duration(milliseconds: 2600), () {
      if (mounted) _ctrl.reverse();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.error ? Colors.red.shade700 : const Color(0xFF059669);
    return Positioned(
      bottom: MediaQuery.of(context).viewInsets.bottom + 14,
      left: 14,
      right: 14,
      child: SlideTransition(
        position: _slide,
        child: FadeTransition(
          opacity: _fade,
          child: Material(
            color: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                      color: color.withValues(alpha: 0.35),
                      blurRadius: 14,
                      offset: const Offset(0, 4))
                ],
              ),
              child: Row(children: [
                Icon(
                    widget.error
                        ? Icons.error_outline
                        : Icons.check_circle_outline,
                    color: Colors.white,
                    size: 20),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(widget.msg,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w500))),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

//
//  PDF كشف الحساب
//
Future<void> generateAccountStatementPDF({
  required Account account,
  required AccountSummary summary,
  required List<Operation> operations,
  required String mainCurrency,
  required String companyName,
  required String companyAddress,
  required String companyPhone,
}) async {
  final pdf = pw.Document();
  final dateFormat = DateFormat('yyyy/MM/dd - HH:mm');
  final numberFormat = NumberFormat('#,##0.00');

  pw.Font? ttf, boldTtf;
  try {
    final fontData = await rootBundle.load('assets/fonts/Cairo-Regular.ttf');
    final boldFontData = await rootBundle.load('assets/fonts/Cairo-Bold.ttf');
    ttf = pw.Font.ttf(fontData);
    boldTtf = pw.Font.ttf(boldFontData);
  } catch (_) {}

  pw.TextStyle ts(double size, {bool bold = false, PdfColor? color}) =>
      pw.TextStyle(
          fontSize: size,
          fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
          font: bold ? boldTtf : ttf,
          color: color);

  pdf.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      build: (ctx) => pw.Directionality(
            textDirection: pw.TextDirection.rtl,
            child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Container(
                      padding: const pw.EdgeInsets.all(20),
                      decoration: const pw.BoxDecoration(
                          border: pw.Border(bottom: pw.BorderSide(width: 2))),
                      child: pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Column(
                                crossAxisAlignment: pw.CrossAxisAlignment.start,
                                children: [
                                  pw.Text(companyName,
                                      style: ts(18, bold: true)),
                                  if (companyAddress.isNotEmpty)
                                    pw.Text(companyAddress, style: ts(10)),
                                  if (companyPhone.isNotEmpty)
                                    pw.Text(companyPhone, style: ts(10)),
                                ]),
                            pw.Column(
                                crossAxisAlignment: pw.CrossAxisAlignment.end,
                                children: [
                                  pw.Text('كشف حساب',
                                      style: ts(20, bold: true)),
                                  pw.Text(
                                      'تاريخ الإصدار: ${dateFormat.format(DateTime.now())}',
                                      style: ts(9)),
                                  pw.Text('رقم الحساب: ${account.id}',
                                      style: ts(9)),
                                ]),
                          ])),
                  pw.SizedBox(height: 16),
                  pw.Container(
                      padding: const pw.EdgeInsets.all(12),
                      decoration: pw.BoxDecoration(
                          color: PdfColors.grey200,
                          borderRadius: pw.BorderRadius.circular(8)),
                      child: pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Column(
                                crossAxisAlignment: pw.CrossAxisAlignment.start,
                                children: [
                                  pw.Text('اسم العميل: ${account.name}',
                                      style: ts(13, bold: true)),
                                  if (account.phone.isNotEmpty)
                                    pw.Text('هاتف: ${account.phone}',
                                        style: ts(10)),
                                ]),
                            pw.Column(
                                crossAxisAlignment: pw.CrossAxisAlignment.end,
                                children: [
                                  pw.Text('الرصيد الإجمالي ($mainCurrency):',
                                      style: ts(11)),
                                  pw.Text(
                                      '${numberFormat.format(summary.totalUSD)} ${_currencySymbol(mainCurrency)}',
                                      style: ts(16,
                                          bold: true,
                                          color: summary.totalUSD >= 0
                                              ? PdfColors.green800
                                              : PdfColors.red800)),
                                ]),
                          ])),
                  pw.SizedBox(height: 16),
                  if (summary.balanceByCurrency.isNotEmpty) ...[
                    pw.Text('الأرصدة حسب العملة:', style: ts(13, bold: true)),
                    pw.SizedBox(height: 8),
                    pw.Table(
                        border: pw.TableBorder.all(width: 0.5),
                        columnWidths: {
                          0: const pw.FlexColumnWidth(2),
                          1: const pw.FlexColumnWidth(1.5),
                          2: const pw.FlexColumnWidth(1)
                        },
                        children: [
                          pw.TableRow(
                              decoration: const pw.BoxDecoration(
                                  color: PdfColors.grey300),
                              children: [
                                pw.Padding(
                                    padding: const pw.EdgeInsets.all(6),
                                    child: pw.Text('العملة',
                                        textAlign: pw.TextAlign.center,
                                        style: ts(10, bold: true))),
                                pw.Padding(
                                    padding: const pw.EdgeInsets.all(6),
                                    child: pw.Text('الرصيد',
                                        textAlign: pw.TextAlign.center,
                                        style: ts(10, bold: true))),
                                pw.Padding(
                                    padding: const pw.EdgeInsets.all(6),
                                    child: pw.Text('النوع',
                                        textAlign: pw.TextAlign.center,
                                        style: ts(10, bold: true))),
                              ]),
                          ...summary.balanceByCurrency.entries
                              .map((e) => pw.TableRow(children: [
                                    pw.Padding(
                                        padding: const pw.EdgeInsets.all(6),
                                        child: pw.Text(e.key,
                                            textAlign: pw.TextAlign.center,
                                            style: ts(9))),
                                    pw.Padding(
                                        padding: const pw.EdgeInsets.all(6),
                                        child: pw.Text(
                                            '${numberFormat.format(e.value.abs())} ${_currencySymbol(e.key)}',
                                            textAlign: pw.TextAlign.center,
                                            style: ts(9,
                                                color: e.value >= 0
                                                    ? PdfColors.green800
                                                    : PdfColors.red800))),
                                    pw.Padding(
                                        padding: const pw.EdgeInsets.all(6),
                                        child: pw.Text(
                                            e.value >= 0 ? 'لنا' : 'لهم',
                                            textAlign: pw.TextAlign.center,
                                            style: ts(9))),
                                  ])),
                        ]),
                    pw.SizedBox(height: 16),
                  ],
                  pw.Text('تفاصيل الحركات:', style: ts(13, bold: true)),
                  pw.SizedBox(height: 8),
                  pw.Expanded(
                      child: pw.Table(
                          border: pw.TableBorder.all(width: 0.5),
                          columnWidths: {
                        0: const pw.FlexColumnWidth(2),
                        1: const pw.FlexColumnWidth(3),
                        2: const pw.FlexColumnWidth(1.5),
                        3: const pw.FlexColumnWidth(1.5)
                      },
                          children: [
                        pw.TableRow(
                            decoration: const pw.BoxDecoration(
                                color: PdfColors.grey300),
                            children: [
                              pw.Padding(
                                  padding: const pw.EdgeInsets.all(6),
                                  child: pw.Text('التاريخ',
                                      textAlign: pw.TextAlign.center,
                                      style: ts(9, bold: true))),
                              pw.Padding(
                                  padding: const pw.EdgeInsets.all(6),
                                  child: pw.Text('البيان',
                                      textAlign: pw.TextAlign.center,
                                      style: ts(9, bold: true))),
                              pw.Padding(
                                  padding: const pw.EdgeInsets.all(6),
                                  child: pw.Text('المبلغ',
                                      textAlign: pw.TextAlign.center,
                                      style: ts(9, bold: true))),
                              pw.Padding(
                                  padding: const pw.EdgeInsets.all(6),
                                  child: pw.Text('بـ $mainCurrency',
                                      textAlign: pw.TextAlign.center,
                                      style: ts(9, bold: true))),
                            ]),
                        ...operations.map((op) {
                          final isCredit = op.amount >= 0;
                          return pw.TableRow(children: [
                            pw.Padding(
                                padding: const pw.EdgeInsets.all(6),
                                child: pw.Text(dateFormat.format(op.date),
                                    textAlign: pw.TextAlign.center,
                                    style: ts(8))),
                            pw.Padding(
                                padding: const pw.EdgeInsets.all(6),
                                child: pw.Text(
                                    op.statement.isNotEmpty
                                        ? op.statement
                                        : 'بدون بيان',
                                    textAlign: pw.TextAlign.center,
                                    style: ts(8))),
                            pw.Padding(
                                padding: const pw.EdgeInsets.all(6),
                                child: pw.Text(
                                    '${isCredit ? "+" : ""}${numberFormat.format(op.amount.abs())} ${_currencySymbol(op.currency)}',
                                    textAlign: pw.TextAlign.center,
                                    style: ts(8,
                                        color: isCredit
                                            ? PdfColors.green800
                                            : PdfColors.red800))),
                            pw.Padding(
                                padding: const pw.EdgeInsets.all(6),
                                child: pw.Text(
                                    '${numberFormat.format(op.amountUSD)} ${_currencySymbol(mainCurrency)}',
                                    textAlign: pw.TextAlign.center,
                                    style: ts(8))),
                          ]);
                        }),
                      ])),
                  pw.SizedBox(height: 20),
                  pw.Divider(),
                  pw.Center(
                      child: pw.Text(
                          'تم إنشاء هذا الكشف تلقائيًا عبر منصتي المحاسبية',
                          style: ts(9, color: PdfColors.grey600))),
                ]),
          )));

  await Printing.layoutPdf(
      onLayout: (format) async => pdf.save(),
      name:
          'كشف_حساب_${account.name}_${DateTime.now().millisecondsSinceEpoch}.pdf');
}

//
//  إرسال واتساب
//
Future<void> sendBalanceViaWhatsApp({
  required Account account,
  required AccountSummary summary,
  required String mainCurrency,
  required String companyName,
  BuildContext? context,
}) async {
  final now = DateTime.now();
  final dateStr =
      '${now.year}/${now.month.toString().padLeft(2, '0')}/${now.day.toString().padLeft(2, '0')}';
  final timeStr =
      '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  final mainSym = _currencySymbol(mainCurrency);
  final mainBalance = '${summary.totalUSD.toStringAsFixed(2)} $mainSym';

  final currenciesSection = summary.balanceByCurrency.isEmpty
      ? '   لا توجد أرصدة'
      : summary.balanceByCurrency.entries.map((e) {
          final sym = _currencySymbol(e.key);
          return '   • ${e.key.padRight(6)}: ${e.value.toStringAsFixed(2)} $sym';
        }).join('\n');

  final message = 'السلام عليكم ورحمة الله وبركاته\n'
      '\n'
      ' مطابقة الأرصدة\n'
      '\n'
      ' اسم الحساب    : ${account.name}\n'
      ' رقم الحساب     : ${account.id}\n'
      ' التاريخ والوقت : $dateStr  $timeStr\n'
      '\n'
      ' الرصيد الأساسي : $mainBalance\n'
      ' تفاصيل عملات أخرى:\n'
      '$currenciesSection\n'
      '\n'
      ' نرجو منكم مطابقة الأرصدة لسير العمل بسلاسة.\n'
      ' شكراً لكم.\n'
      '\n'
      ' مع تحيات $companyName\n'
      '';

  final url = 'https://wa.me/?text=${Uri.encodeComponent(message)}';
  final uri = Uri.parse(url);
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } else if (context != null && context.mounted) {
    _snack(context, ' تعذر فتح تطبيق واتساب', error: true);
  }
}
