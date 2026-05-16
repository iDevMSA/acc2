// lib/services/firebase_service.dart
// ─────────────────────────────────────────────────────────
// خدمة Firebase — متوافقة مع النموذج الجديد (Account + Operation)
// يستخدم Firebase Realtime Database (وليس Firestore)
// ─────────────────────────────────────────────────────────

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';

import '../main.dart'; // Account, Operation

class FirebaseService {
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

  // ═══════════════════════════════════════
  // 🏦 الحسابات
  // ═══════════════════════════════════════

  static Future<bool> saveAccount(Account account) async {
    try {
      await _accountsRef.child(account.id).set(account.toJson());
      return true;
    } catch (e) {
      _log('saveAccount error: $e');
      return false;
    }
  }

  static Future<bool> updateAccount(Account account) async {
    try {
      await _accountsRef.child(account.id).update(account.toJson());
      return true;
    } catch (e) {
      _log('updateAccount error: $e');
      return false;
    }
  }

  static Future<bool> deleteAccount(String accountId) async {
    try {
      await _accountsRef.child(accountId).remove();
      return true;
    } catch (e) {
      _log('deleteAccount error: $e');
      return false;
    }
  }

  static Future<Account?> getAccount(String accountId) async {
    try {
      final snap = await _accountsRef.child(accountId).get();
      if (!snap.exists || snap.value == null) return null;
      return Account.fromJson(
          Map<String, dynamic>.from(snap.value as Map));
    } catch (e) {
      _log('getAccount error: $e');
      return null;
    }
  }

  static Future<List<Account>> loadAllAccounts() async {
    try {
      final snap = await _accountsRef.get();
      if (!snap.exists || snap.value == null) return [];
      final map = Map<String, dynamic>.from(snap.value as Map);
      return map.values
          .map((v) =>
              Account.fromJson(Map<String, dynamic>.from(v as Map)))
          .toList()
        ..sort((a, b) => a.id.compareTo(b.id));
    } catch (e) {
      _log('loadAllAccounts error: $e');
      return [];
    }
  }

  static Future<bool> saveAllAccounts(List<Account> accounts) async {
    try {
      final Map<String, dynamic> data = {
        for (final a in accounts) a.id: a.toJson()
      };
      await _accountsRef.set(data);
      return true;
    } catch (e) {
      _log('saveAllAccounts error: $e');
      return false;
    }
  }

  static Stream<List<Account>> listenToAccounts() {
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

  // ═══════════════════════════════════════
  // 📝 القيود / العمليات (Operations)
  // ═══════════════════════════════════════

  static Future<bool> saveOperation(Operation op) async {
    try {
      await _opsRef.child(op.id).set(op.toJson());
      return true;
    } catch (e) {
      _log('saveOperation error: $e');
      return false;
    }
  }

  static Future<bool> updateOperation(Operation op) async {
    try {
      await _opsRef.child(op.id).update(op.toJson());
      return true;
    } catch (e) {
      _log('updateOperation error: $e');
      return false;
    }
  }

  static Future<bool> deleteOperation(String opId) async {
    try {
      await _opsRef.child(opId).remove();
      return true;
    } catch (e) {
      _log('deleteOperation error: $e');
      return false;
    }
  }

  static Future<Operation?> getOperation(String opId) async {
    try {
      final snap = await _opsRef.child(opId).get();
      if (!snap.exists || snap.value == null) return null;
      return Operation.fromJson(
          Map<String, dynamic>.from(snap.value as Map));
    } catch (e) {
      _log('getOperation error: $e');
      return null;
    }
  }

  static Future<List<Operation>> loadAllOperations() async {
    try {
      final snap = await _opsRef.get();
      if (!snap.exists || snap.value == null) return [];
      final map = Map<String, dynamic>.from(snap.value as Map);
      return map.values
          .map((v) =>
              Operation.fromJson(Map<String, dynamic>.from(v as Map)))
          .toList()
        ..sort((a, b) => a.date.compareTo(b.date));
    } catch (e) {
      _log('loadAllOperations error: $e');
      return [];
    }
  }

  static Future<List<Operation>> loadOperationsByAccount(
      String accountId) async {
    try {
      final snap = await _opsRef.get();
      if (!snap.exists || snap.value == null) return [];
      final map = Map<String, dynamic>.from(snap.value as Map);
      return map.values
          .map((v) =>
              Operation.fromJson(Map<String, dynamic>.from(v as Map)))
          .where((op) => op.accountId == accountId)
          .toList()
        ..sort((a, b) => b.date.compareTo(a.date));
    } catch (e) {
      _log('loadOperationsByAccount error: $e');
      return [];
    }
  }

  static Future<bool> saveAllOperations(List<Operation> ops) async {
    try {
      final Map<String, dynamic> data = {
        for (final op in ops) op.id: op.toJson()
      };
      await _opsRef.set(data);
      return true;
    } catch (e) {
      _log('saveAllOperations error: $e');
      return false;
    }
  }

  static Future<bool> fullSyncOperations(
      List<Operation> localOps) async {
    try {
      // جلب السحابة أولاً
      final cloudOps = await loadAllOperations();
      final localIds = {for (final op in localOps) op.id};

      // احذف من السحابة ما ليس محلياً
      for (final op in cloudOps) {
        if (!localIds.contains(op.id)) {
          await _opsRef.child(op.id).remove();
        }
      }

      // ارفع المحلية إلى السحابة
      for (final op in localOps) {
        await _opsRef.child(op.id).set(op.toJson());
      }

      return true;
    } catch (e) {
      _log('fullSyncOperations error: $e');
      return false;
    }
  }

  static Stream<List<Operation>> listenToOperations() {
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

  static Stream<List<Operation>> listenToOperationsByAccount(
      String accountId) {
    return _opsRef.onValue.map((event) {
      if (!event.snapshot.exists || event.snapshot.value == null) return [];
      try {
        final map = Map<String, dynamic>.from(event.snapshot.value as Map);
        return map.values
            .map((v) =>
                Operation.fromJson(Map<String, dynamic>.from(v as Map)))
            .where((op) => op.accountId == accountId)
            .toList();
      } catch (_) {
        return [];
      }
    });
  }

  // ═══════════════════════════════════════
  // 🔑 إدارة ملف المستخدم
  // ═══════════════════════════════════════

  /// تأكد من وجود ملف المستخدم في Firebase وإنشائه إن لم يكن موجوداً
  static Future<void> ensureUserExists() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      final snap = await _userRef.get();
      if (!snap.exists) {
        await _userRef.set({
          'uid': user.uid,
          'email': user.email ?? '',
          'createdAt': DateTime.now().toIso8601String(),
          'accounts': {},
          'operations': {},
        });
        _log('تم إنشاء ملف المستخدم: ${user.uid}');
      }
    } catch (e) {
      _log('ensureUserExists error: $e');
    }
  }

  static void _log(String msg) {
    // ignore: avoid_print
    print('🔥 FirebaseService: $msg');
  }
}