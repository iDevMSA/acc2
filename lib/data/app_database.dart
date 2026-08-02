// ============================================================
// lib/data/app_database.dart — قاعدة بيانات محلية (SQLite عبر Drift)
// تحل محل تخزين accounts/operations كـJSON blob واحد ضخم في
// SharedPreferences (كان يُعاد تحليله بالكامل مع كل عملية قراءة/كتابة).
//
// قاعدة بيانات واحدة مشتركة لكل الحسابات على الجهاز (وليس ملفاً
// لكل مستخدم)، مع عمود ownerUid مفهرس على كل جدول — يطابق فلسفة
// Firebase الحالية (جذر واحد users/{uid} لكل بيانات المستخدم).
//
// ملاحظة نطاق: acc_sys (دليل الحسابات المزدوج القيد) وsales_sys
// يبقيان على Firebase مباشرة كما هما — نقلهما لـDrift أيضاً خارج
// نطاق هذه الدفعة (النموذج الأساسي Account/Operation هو المستخدم
// في كل مكان: اللوحة الرئيسية، الصناديق، بوابة العميل، الإشعارات).
// ============================================================

import 'dart:io';

export 'package:drift/drift.dart' show Value, InsertMode;

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3_flutter_libs/sqlite3_flutter_libs.dart';
import 'package:sqlite3/sqlite3.dart';

part 'app_database.g.dart';

// ── جدول الحسابات ────────────────────────────────────────────
class AccountsTable extends Table {
  @override
  String get tableName => 'accounts';

  TextColumn get id => text()();
  TextColumn get ownerUid => text()();
  TextColumn get name => text()();
  TextColumn get phone => text().withDefault(const Constant(''))();
  TextColumn get address => text().withDefault(const Constant(''))();
  TextColumn get type => text().withDefault(const Constant('cash'))();
  TextColumn get code => text().withDefault(const Constant(''))();
  TextColumn get category => text().withDefault(const Constant('other'))();
  BoolColumn get allowClientLogin =>
      boolean().withDefault(const Constant(false))();
  TextColumn get clientPhone => text().withDefault(const Constant(''))();
  TextColumn get clientEmail => text().withDefault(const Constant(''))();
  TextColumn get clientUid => text().withDefault(const Constant(''))();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {ownerUid, id};
}

// ── جدول القيود / العمليات ───────────────────────────────────
class OperationsTable extends Table {
  @override
  String get tableName => 'operations';

  TextColumn get id => text()();
  TextColumn get ownerUid => text()();
  TextColumn get accountId => text()();
  RealColumn get amount => real()();
  RealColumn get exchangeRate => real().withDefault(const Constant(1))();
  TextColumn get currency => text().withDefault(const Constant('USD'))();
  RealColumn get amountUSD => real()();
  TextColumn get statement => text().withDefault(const Constant(''))();
  DateTimeColumn get date => dateTime()();
  TextColumn get source => text().nullable()();

  @override
  Set<Column> get primaryKey => {ownerUid, id};
}

// ── قائمة انتظار المزامنة (بدل قائمة JSON) ───────────────────
class PendingSyncItems extends Table {
  TextColumn get ownerUid => text()();
  TextColumn get entity => text()(); // 'account' | 'operation' | 'clientOp'
  TextColumn get entityId => text()(); // معرّف السجل (قد يكون مركّباً مثل accountId/opId)
  TextColumn get action => text()(); // 'create' | 'delete'
  TextColumn get dataJson => text()();
  DateTimeColumn get ts => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {ownerUid, entity, entityId};
}

// ── مؤشرات آخر مزامنة لكل عقدة (تُستخدم في محرك المزامنة الجزئية) ──
class SyncCursors extends Table {
  TextColumn get ownerUid => text()();
  TextColumn get node => text()(); // 'accounts' | 'operations'
  DateTimeColumn get lastSyncedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {ownerUid, node};
}

@DriftDatabase(tables: [AccountsTable, OperationsTable, PendingSyncItems, SyncCursors])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());
  AppDatabase.forTesting(super.connection);

  @override
  int get schemaVersion => 1;

  // ══════════════════════════════════════════════════════════
  //  الحسابات
  // ══════════════════════════════════════════════════════════
  Future<List<AccountsTableData>> getAccounts(String ownerUid) =>
      (select(accountsTable)..where((a) => a.ownerUid.equals(ownerUid))).get();

  Stream<List<AccountsTableData>> watchAccounts(String ownerUid) =>
      (select(accountsTable)..where((a) => a.ownerUid.equals(ownerUid))).watch();

  Future<void> upsertAccount(AccountsTableCompanion account) =>
      into(accountsTable).insertOnConflictUpdate(account);

  Future<void> deleteAccountRow(String ownerUid, String id) =>
      (delete(accountsTable)
            ..where((a) => a.ownerUid.equals(ownerUid) & a.id.equals(id)))
          .go();

  Future<void> clearAccounts(String ownerUid) =>
      (delete(accountsTable)..where((a) => a.ownerUid.equals(ownerUid))).go();

  // ══════════════════════════════════════════════════════════
  //  العمليات
  // ══════════════════════════════════════════════════════════
  Future<List<OperationsTableData>> getOperations(String ownerUid) =>
      (select(operationsTable)..where((o) => o.ownerUid.equals(ownerUid))).get();

  Stream<List<OperationsTableData>> watchOperations(String ownerUid) =>
      (select(operationsTable)..where((o) => o.ownerUid.equals(ownerUid))).watch();

  Future<List<OperationsTableData>> getOperationsForAccount(
          String ownerUid, String accountId) =>
      (select(operationsTable)
            ..where((o) =>
                o.ownerUid.equals(ownerUid) & o.accountId.equals(accountId)))
          .get();

  Future<void> upsertOperation(OperationsTableCompanion op) =>
      into(operationsTable).insertOnConflictUpdate(op);

  Future<void> deleteOperationRow(String ownerUid, String id) =>
      (delete(operationsTable)
            ..where((o) => o.ownerUid.equals(ownerUid) & o.id.equals(id)))
          .go();

  Future<void> deleteOperationsForAccount(String ownerUid, String accountId) =>
      (delete(operationsTable)
            ..where((o) =>
                o.ownerUid.equals(ownerUid) & o.accountId.equals(accountId)))
          .go();

  Future<void> clearOperations(String ownerUid) =>
      (delete(operationsTable)..where((o) => o.ownerUid.equals(ownerUid))).go();

  Future<double> getTotalBalanceUSD(String ownerUid) async {
    final sumExp = operationsTable.amountUSD.sum();
    final query = selectOnly(operationsTable)
      ..addColumns([sumExp])
      ..where(operationsTable.ownerUid.equals(ownerUid));
    final row = await query.getSingleOrNull();
    return row?.read(sumExp) ?? 0.0;
  }

  // ══════════════════════════════════════════════════════════
  //  قائمة انتظار المزامنة
  // ══════════════════════════════════════════════════════════
  Future<List<PendingSyncItem>> getPending(String ownerUid) =>
      (select(pendingSyncItems)..where((p) => p.ownerUid.equals(ownerUid))).get();

  Future<int> pendingCount(String ownerUid) async {
    final rows = await getPending(ownerUid);
    return rows.length;
  }

  Future<void> addPending(PendingSyncItemsCompanion item) =>
      into(pendingSyncItems).insertOnConflictUpdate(item);

  Future<void> removePending(String ownerUid, String entity, String entityId) =>
      (delete(pendingSyncItems)
            ..where((p) =>
                p.ownerUid.equals(ownerUid) &
                p.entity.equals(entity) &
                p.entityId.equals(entityId)))
          .go();

  // ══════════════════════════════════════════════════════════
  //  مؤشرات المزامنة
  // ══════════════════════════════════════════════════════════
  Future<SyncCursor?> getSyncCursor(String ownerUid, String node) =>
      (select(syncCursors)
            ..where((c) => c.ownerUid.equals(ownerUid) & c.node.equals(node)))
          .getSingleOrNull();

  Future<void> setSyncCursor(String ownerUid, String node, DateTime at) =>
      into(syncCursors).insertOnConflictUpdate(
          SyncCursorsCompanion.insert(ownerUid: ownerUid, node: node, lastSyncedAt: at));
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'monsati.sqlite'));
    // مطلوب لتشغيل sqlite3 على أندرويد/iOS (يحمّل المكتبة الأصلية)
    if (Platform.isAndroid || Platform.isIOS) {
      await applyWorkaroundToOpenSqlite3OnOldAndroidVersions();
    }
    sqlite3.tempDirectory = (await getTemporaryDirectory()).path;
    return NativeDatabase.createInBackground(file);
  });
}
