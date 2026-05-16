// lib/services/sync_service.dart
// ─────────────────────────────────────────────────────────
// خدمة المزامنة — متوافقة مع النموذج الجديد (Account + Operation)
// ─────────────────────────────────────────────────────────

import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main.dart';
// يستورد: Account, Operation, DataService,
//          accountsNotifier, operationsNotifier, balanceNotifier

class SyncService {
  // ─────────────────────────────────────────
  // مراجع Firebase Realtime Database
  // ─────────────────────────────────────────
  static String get _uid =>
      FirebaseAuth.instance.currentUser?.uid ?? '';

  static DatabaseReference get _userRef =>
      FirebaseDatabase.instance.ref('users/$_uid');

  static DatabaseReference get _accountsRef =>
      _userRef.child('accounts');

  static DatabaseReference get _opsRef =>
      _userRef.child('operations');

  // ─────────────────────────────────────────
  // رفع البيانات المحلية إلى السحابة
  // ─────────────────────────────────────────
  Future<void> syncToCloud() async {
    if (_uid.isEmpty) return;
    try {
      final accounts = await DataService.getAccounts();
      final ops = await DataService.getOperations();

      for (final acc in accounts) {
        await _accountsRef.child(acc.id).set(acc.toJson());
      }
      for (final op in ops) {
        await _opsRef.child(op.id).set(op.toJson());
      }
      _log('syncToCloud: ${accounts.length} حسابات, ${ops.length} قيود');
    } catch (e) {
      _log('syncToCloud error: $e');
    }
  }

  // ─────────────────────────────────────────
  // جلب البيانات من السحابة ودمجها محلياً
  // ─────────────────────────────────────────
  Future<void> syncFromCloud() async {
    if (_uid.isEmpty) return;
    try {
      // ── حسابات ──
      final accSnap = await _accountsRef.get();
      final List<Account> cloudAccounts = [];
      if (accSnap.exists && accSnap.value != null) {
        final map = Map<String, dynamic>.from(accSnap.value as Map);
        for (final v in map.values) {
          try {
            cloudAccounts.add(
                Account.fromJson(Map<String, dynamic>.from(v as Map)));
          } catch (_) {}
        }
      }

      // ── قيود ──
      final opsSnap = await _opsRef.get();
      final List<Operation> cloudOps = [];
      if (opsSnap.exists && opsSnap.value != null) {
        final map = Map<String, dynamic>.from(opsSnap.value as Map);
        for (final v in map.values) {
          try {
            cloudOps.add(
                Operation.fromJson(Map<String, dynamic>.from(v as Map)));
          } catch (_) {}
        }
      }

      await _mergeAndSave(cloudAccounts, cloudOps);
      _log('syncFromCloud: ${cloudAccounts.length} حسابات, ${cloudOps.length} قيود');
    } catch (e) {
      _log('syncFromCloud error: $e');
    }
  }

  // ─────────────────────────────────────────
  // دمج السحابة مع المحلي (السحابة تكسب)
  // ─────────────────────────────────────────
  Future<void> _mergeAndSave(
    List<Account> cloudAccounts,
    List<Operation> cloudOps,
  ) async {
    final localAccounts = await DataService.getAccounts();
    final localOps = await DataService.getOperations();

    // الحسابات: السحابة تكسب عند التعارض
    final Map<String, Account> accMap = {
      for (final a in localAccounts) a.id: a,
      for (final a in cloudAccounts) a.id: a,
    };
    final mergedAccounts = accMap.values.toList()
      ..sort((a, b) => a.id.compareTo(b.id));

    // القيود: السحابة تكسب عند التعارض
    final Map<String, Operation> opsMap = {
      for (final o in localOps) o.id: o,
      for (final o in cloudOps) o.id: o,
    };
    final mergedOps = opsMap.values.toList()
      ..sort((a, b) => a.date.compareTo(b.date));

    // حفظ محلي مباشر (bypass pending queue لتجنب التكرار)
    final prefs = await SharedPreferences.getInstance();
    final prefix = '${_uid}_';

    await prefs.setString(
      '${prefix}local_accounts',
      jsonEncode(mergedAccounts.map((a) => a.toJson()).toList()),
    );
    await prefs.setString(
      '${prefix}local_operations',
      jsonEncode(mergedOps.map((o) => o.toJson()).toList()),
    );

    // تحديث الـ Notifiers
    accountsNotifier.value = List.from(mergedAccounts);
    operationsNotifier.value = List.from(mergedOps);

    double total = 0;
    for (final op in mergedOps) {
      total += op.amountUSD;
    }
    balanceNotifier.value = double.parse(total.toStringAsFixed(6));
  }

  // ─────────────────────────────────────────
  // مزامنة عنصر واحد فوراً
  // ─────────────────────────────────────────
  Future<void> pushAccount(Account account, {bool delete_ = false}) async {
    if (_uid.isEmpty) return;
    try {
      final ref = _accountsRef.child(account.id);
      if (delete_) {
        await ref.remove();
      } else {
        await ref.set(account.toJson());
      }
    } catch (e) {
      _log('pushAccount error: $e');
    }
  }

  Future<void> pushOperation(Operation op, {bool delete_ = false}) async {
    if (_uid.isEmpty) return;
    try {
      final ref = _opsRef.child(op.id);
      if (delete_) {
        await ref.remove();
      } else {
        await ref.set(op.toJson());
      }
    } catch (e) {
      _log('pushOperation error: $e');
    }
  }

  // ─────────────────────────────────────────
  // Streams للاستماع المباشر
  // ─────────────────────────────────────────
  Stream<List<Account>> listenToAccounts() {
    return _accountsRef.onValue.map((event) {
      if (!event.snapshot.exists || event.snapshot.value == null) return [];
      try {
        final map = Map<String, dynamic>.from(event.snapshot.value as Map);
        return map.values
            .map((v) =>
                Account.fromJson(Map<String, dynamic>.from(v as Map)))
            .toList();
      } catch (_) {
        return [];
      }
    });
  }

  Stream<List<Operation>> listenToOperations() {
    return _opsRef.onValue.map((event) {
      if (!event.snapshot.exists || event.snapshot.value == null) return [];
      try {
        final map = Map<String, dynamic>.from(event.snapshot.value as Map);
        return map.values
            .map((v) =>
                Operation.fromJson(Map<String, dynamic>.from(v as Map)))
            .toList();
      } catch (_) {
        return [];
      }
    });
  }

  // ─────────────────────────────────────────
  // حالة المزامنة
  // ─────────────────────────────────────────
  Future<int> getPendingCount() => DataService.pendingCount();

  static void _log(String msg) {
    // ignore: avoid_print
    print('🔄 SyncService: $msg');
  }
}

// ─────────────────────────────────────────
// نموذج حالة المزامنة
// ─────────────────────────────────────────
class SyncStatus {
  final int pendingCount;
  final DateTime lastSyncTime;
  final bool isOnline;

  const SyncStatus({
    required this.pendingCount,
    required this.lastSyncTime,
    this.isOnline = true,
  });

  bool get hasPending => pendingCount > 0;
}