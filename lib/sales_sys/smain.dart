// ============================================================
// lib/sales_sys/smain.dart — نظام المبيعات v3 (محدَّث)
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:mobile_scanner/mobile_scanner.dart';

import 'dart:async';
import 'package:monsati_accounting/loyalty_service.dart';
import 'invoice_pdf.dart';
import 'currencies.dart';
import 'reports_screen.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// ─── Constants ───────────────────────────────
const _kBlue = Color(0xFF021B79);
const _kBlue2 = Color(0xFF0575E6);

// ─── Enums ───────────────────────────────────
enum BusinessType { store, restaurant, cafe }
enum UserRole { owner, manager, cashier }
enum PaymentMethod { cash, card, transfer }
enum InvoiceStatus { open, suspended, closed, cancelled }

// ─── Models ──────────────────────────────────
class SalesUser {
  final String uid, name, email;
  final UserRole role;
  final String? branchId, cashRegisterId, ownerUid, phone;
  const SalesUser({required this.uid, required this.name,
    required this.email, required this.role,
    this.branchId, this.cashRegisterId, this.ownerUid, this.phone});
  bool get isOwner => role == UserRole.owner;
  bool get isCashier => role == UserRole.cashier;
  factory SalesUser.fromJson(Map j) => SalesUser(
    uid: j['uid'] ?? '', name: j['name'] ?? '',
    email: j['email'] ?? '',
    role: UserRole.values.firstWhere(
      (r) => r.name == (j['role'] ?? 'cashier'), orElse: () => UserRole.cashier),
    branchId: j['branchId'], cashRegisterId: j['cashRegisterId'],
    ownerUid: j['ownerUid'], phone: j['phone']);
  Map<String, dynamic> toJson() => {'uid': uid, 'name': name,
    'email': email, 'role': role.name, 'branchId': branchId,
    'cashRegisterId': cashRegisterId, 'ownerUid': ownerUid, 'phone': phone};
}

class Branch {
  final String id, name, ownerUid;
  final String? address, phone;
  final BusinessType type;
  final DateTime createdAt;
  const Branch({required this.id, required this.name, required this.ownerUid,
    this.address, this.phone, this.type = BusinessType.store,
    required this.createdAt});
  factory Branch.fromJson(String id, Map j) => Branch(
    id: id, name: j['name'] ?? '', ownerUid: j['ownerUid'] ?? '',
    address: j['address'], phone: j['phone'],
    type: BusinessType.values.firstWhere(
      (t) => t.name == (j['type'] ?? 'store'), orElse: () => BusinessType.store),
    createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now());
  Map<String, dynamic> toJson() => {'name': name, 'ownerUid': ownerUid,
    'address': address, 'phone': phone, 'type': type.name,
    'createdAt': createdAt.toIso8601String()};
  String get typeLabel {
    switch (type) {
      case BusinessType.restaurant: return 'مطعم';
      case BusinessType.cafe: return 'كافيه';
      default: return 'متجر';
    }
  }
}

class Warehouse {
  final String id, name, branchId, ownerUid;
  const Warehouse({required this.id, required this.name,
    required this.branchId, required this.ownerUid});
  factory Warehouse.fromJson(String id, Map j) => Warehouse(
    id: id, name: j['name'] ?? '',
    branchId: j['branchId'] ?? '', ownerUid: j['ownerUid'] ?? '');
  Map<String, dynamic> toJson() =>
      {'name': name, 'branchId': branchId, 'ownerUid': ownerUid};
}

class Product {
  final String id, name, warehouseId, ownerUid;
  final String? barcode, category, description;
  final double costPrice, sellPrice, quantity, vatRate;
  final Map<String, double> branchPrices;
  final DateTime? expiryDate, productionDate;
  final bool trackExpiry;
  const Product({required this.id, required this.name,
    required this.warehouseId, required this.ownerUid,
    this.barcode, this.category, this.description,
    this.costPrice = 0, this.sellPrice = 0,
    this.quantity = 0, this.vatRate = 0,
    this.branchPrices = const {},
    this.expiryDate, this.productionDate, this.trackExpiry = false});
  factory Product.fromJson(String id, Map j) => Product(
    id: id, name: j['name'] ?? '',
    warehouseId: j['warehouseId'] ?? '', ownerUid: j['ownerUid'] ?? '',
    barcode: j['barcode'], category: j['category'], description: j['description'],
    costPrice: (j['costPrice'] ?? 0).toDouble(),
    sellPrice: (j['sellPrice'] ?? 0).toDouble(),
    quantity: (j['quantity'] ?? 0).toDouble(),
    vatRate: (j['vatRate'] ?? 0).toDouble(),
    branchPrices: j['branchPrices'] != null
        ? Map<String, double>.from(
            (j['branchPrices'] as Map).map((k, v) => MapEntry(k, (v as num).toDouble())))
        : {},
    expiryDate: j['expiryDate'] != null ? DateTime.tryParse(j['expiryDate']) : null,
    productionDate: j['productionDate'] != null ? DateTime.tryParse(j['productionDate']) : null,
    trackExpiry: j['trackExpiry'] ?? false);
  Map<String, dynamic> toJson() => {'name': name, 'warehouseId': warehouseId,
    'ownerUid': ownerUid, 'barcode': barcode, 'category': category,
    'description': description, 'costPrice': costPrice, 'sellPrice': sellPrice,
    'quantity': quantity, 'vatRate': vatRate, 'branchPrices': branchPrices,
    'expiryDate': expiryDate?.toIso8601String(),
    'productionDate': productionDate?.toIso8601String(),
    'trackExpiry': trackExpiry};
  double priceForBranch(String branchId) => branchPrices[branchId] ?? sellPrice;
}

class InvoiceItem {
  final String productId, productName;
  double quantity, unitPrice;
  final double vatRate;
  final String? barcode;
  InvoiceItem({required this.productId, required this.productName,
    required this.quantity, required this.unitPrice,
    this.vatRate = 0, this.barcode});
  double get subtotal => quantity * unitPrice;
  double get vatAmount => subtotal * vatRate / 100;
  double get total => subtotal + vatAmount;
  factory InvoiceItem.fromJson(Map j) => InvoiceItem(
    productId: j['productId'] ?? '', productName: j['productName'] ?? '',
    quantity: (j['quantity'] ?? 1).toDouble(),
    unitPrice: (j['unitPrice'] ?? 0).toDouble(),
    vatRate: (j['vatRate'] ?? 0).toDouble(), barcode: j['barcode']);
  Map<String, dynamic> toJson() => {'productId': productId,
    'productName': productName, 'quantity': quantity,
    'unitPrice': unitPrice, 'vatRate': vatRate, 'barcode': barcode};
}

class Invoice {
  final String id, number, cashRegisterId, branchId, ownerUid, createdByUid;
  final List<InvoiceItem> items;
  final PaymentMethod paymentMethod;
  final InvoiceStatus status;
  final double amountPaid, discount;
  final String? customerPhone, customerName, bankName, transferAccountName;
  final DateTime createdAt;
  final String? createdByName;
  const Invoice({required this.id, required this.number,
    required this.cashRegisterId, required this.branchId,
    required this.ownerUid, required this.createdByUid,
    required this.items, required this.paymentMethod,
    required this.status, required this.amountPaid,
    this.discount = 0, this.customerPhone, this.customerName,
    this.bankName, this.transferAccountName,
    required this.createdAt, this.createdByName});
  double get subtotal => items.fold(0, (s, i) => s + i.subtotal);
  double get vatTotal => items.fold(0, (s, i) => s + i.vatAmount);
  double get total => subtotal + vatTotal - discount;
  double get totalRounded {
    double frac = total - total.floor();
    return frac >= 0.5 ? total.ceil().toDouble() : total.floor().toDouble();
  }
  double get change => amountPaid - totalRounded;
  factory Invoice.fromJson(String id, Map j) => Invoice(
    id: id, number: j['number'] ?? '',
    cashRegisterId: j['cashRegisterId'] ?? '',
    branchId: j['branchId'] ?? '', ownerUid: j['ownerUid'] ?? '',
    createdByUid: j['createdByUid'] ?? '',
    items: (j['items'] as List? ?? [])
        .map((i) => InvoiceItem.fromJson(Map.from(i))).toList(),
    paymentMethod: PaymentMethod.values.firstWhere(
      (p) => p.name == (j['paymentMethod'] ?? 'cash'), orElse: () => PaymentMethod.cash),
    status: InvoiceStatus.values.firstWhere(
      (s) => s.name == (j['status'] ?? 'closed'), orElse: () => InvoiceStatus.closed),
    amountPaid: (j['amountPaid'] ?? 0).toDouble(),
    discount: (j['discount'] ?? 0).toDouble(),
    customerPhone: j['customerPhone'], customerName: j['customerName'],
    bankName: j['bankName'], transferAccountName: j['transferAccountName'],
    createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
    createdByName: j['createdByName']);
  Map<String, dynamic> toJson() => {'number': number,
    'cashRegisterId': cashRegisterId, 'branchId': branchId,
    'ownerUid': ownerUid, 'createdByUid': createdByUid,
    'items': items.map((i) => i.toJson()).toList(),
    'paymentMethod': paymentMethod.name, 'status': status.name,
    'amountPaid': amountPaid, 'discount': discount,
    'customerPhone': customerPhone, 'customerName': customerName,
    'bankName': bankName, 'transferAccountName': transferAccountName,
    'createdAt': createdAt.toIso8601String(), 'createdByName': createdByName};
}

class CashRegister {
  final String id, name, branchId, ownerUid;
  final bool sessionOpen;
  const CashRegister({required this.id, required this.name,
    required this.branchId, required this.ownerUid, this.sessionOpen = false});
  factory CashRegister.fromJson(String id, Map j) => CashRegister(
    id: id, name: j['name'] ?? '', branchId: j['branchId'] ?? '',
    ownerUid: j['ownerUid'] ?? '', sessionOpen: j['sessionOpen'] ?? false);
  Map<String, dynamic> toJson() => {'name': name, 'branchId': branchId,
    'ownerUid': ownerUid, 'sessionOpen': sessionOpen};
}

// ─── Product Category ──────────────────────────
class ProductCategory {
  final String id, name, warehouseId, ownerUid;
  const ProductCategory({required this.id, required this.name,
      required this.warehouseId, required this.ownerUid});
  factory ProductCategory.fromJson(String id, Map j) => ProductCategory(
      id: id, name: j['name'] ?? '',
      warehouseId: j['warehouseId'] ?? '', ownerUid: j['ownerUid'] ?? '');
  Map<String, dynamic> toJson() =>
      {'name': name, 'warehouseId': warehouseId, 'ownerUid': ownerUid};
}

// ─── Sales Settings ────────────────────────────
class SalesSettings {
  final String currency;
  final String companyName;
  final String companyPhone;
  final String companyAddress;
  final String companyEmail;
  const SalesSettings({
    this.currency = 'SAR',
    this.companyName = '',
    this.companyPhone = '',
    this.companyAddress = '',
    this.companyEmail = '',
  });
  factory SalesSettings.fromJson(Map j) => SalesSettings(
      currency: j['currency'] ?? 'SAR',
      companyName: j['companyName'] ?? '',
      companyPhone: j['companyPhone'] ?? '',
      companyAddress: j['companyAddress'] ?? '',
      companyEmail: j['companyEmail'] ?? '');
  Map<String, dynamic> toJson() => {
    'currency': currency,
    'companyName': companyName,
    'companyPhone': companyPhone,
    'companyAddress': companyAddress,
    'companyEmail': companyEmail,
  };
}

// ─── Data Service ─────────────────────────────
class SalesDataService {
  static String? _ownerUid;
  static void init(String ownerUid) => _ownerUid = ownerUid;
  static DatabaseReference get _root =>
      FirebaseDatabase.instance.ref('sales/${_ownerUid!}');

  static Future<SalesUser?> getCurrentUserRole() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return null;

    // 1. فحص: هل هو مالك؟
    final ownerSnap = await FirebaseDatabase.instance
        .ref('sales/$uid/ownerProfile').get();
    if (ownerSnap.exists) {
      final d = Map<String, dynamic>.from(ownerSnap.value as Map);
      return SalesUser(uid: uid, name: d['name'] ?? '',
          email: d['email'] ?? '', role: UserRole.owner, ownerUid: uid);
    }

    // 2. فحص: هل هو موظف تحت ownerUid المُهيَّأ؟
    if (_ownerUid != null) {
      final empSnap = await _root.child('employees/$uid').get();
      if (empSnap.exists) {
        final d = Map<String, dynamic>.from(empSnap.value as Map);
        return SalesUser.fromJson({...d, 'uid': uid});
      }
    }

    // 3. fallback: ابحث في employeeOwnerMap عن ownerUid هذا الموظف
    try {
      final mapSnap = await FirebaseDatabase.instance
          .ref('employeeOwnerMap/$uid').get();
      if (mapSnap.exists) {
        final ownerUid = mapSnap.value as String;
        // هيّئ بـ ownerUid الصحيح وافحص مجدداً
        final empSnap2 = await FirebaseDatabase.instance
            .ref('sales/$ownerUid/employees/$uid').get();
        if (empSnap2.exists) {
          final d = Map<String, dynamic>.from(empSnap2.value as Map);
          return SalesUser.fromJson({...d, 'uid': uid, 'ownerUid': ownerUid});
        }
        // على الأقل أعد كاشير بالمعلومات المتاحة
        final user = FirebaseAuth.instance.currentUser;
        return SalesUser(
          uid: uid,
          name: user?.displayName ?? '',
          email: user?.email ?? '',
          role: UserRole.cashier,
          ownerUid: ownerUid,
        );
      }
    } catch (_) {}

    return null;
  }

  static Future<void> saveOwnerProfile(String name, String email) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    await FirebaseDatabase.instance
        .ref('sales/$uid/ownerProfile')
        .set({'name': name, 'email': email, 'role': 'owner', 'uid': uid});
  }

  static Future<String?> findEmployeeOwner(String uid) async {
    final snap = await FirebaseDatabase.instance.ref('sales').get();
    if (!snap.exists) return null;
    final all = Map<String, dynamic>.from(snap.value as Map);
    for (final ownerUid in all.keys) {
      final empSnap = await FirebaseDatabase.instance
          .ref('sales/$ownerUid/employees/$uid').get();
      if (empSnap.exists) return ownerUid;
    }
    return null;
  }

  static Future<List<Branch>> getBranches() async {
    final snap = await _root.child('branches').get();
    if (!snap.exists) return [];
    final map = Map<String, dynamic>.from(snap.value as Map);
    return map.entries
        .map((e) => Branch.fromJson(e.key, Map<String, dynamic>.from(e.value)))
        .toList();
  }
  static Future<String> addBranch(Branch b) async {
    final ref = _root.child('branches').push();
    await ref.set(b.toJson());
    await _log('أضاف فرعاً: ${b.name}');
    return ref.key!;
  }
  static Future<void> updateBranch(String id, Map<String, dynamic> data) async {
    await _root.child('branches/$id').update(data);
    await _log('عدّل فرعاً');
  }
  static Future<void> deleteBranch(String id) async {
    await _root.child('branches/$id').remove();
    await _log('حذف فرعاً');
  }

  static Future<List<Warehouse>> getWarehouses({String? branchId}) async {
    final snap = await _root.child('warehouses').get();
    if (!snap.exists) return [];
    final map = Map<String, dynamic>.from(snap.value as Map);
    return map.entries
        .map((e) => Warehouse.fromJson(e.key, Map<String, dynamic>.from(e.value)))
        .where((w) => branchId == null || w.branchId == branchId)
        .toList();
  }
  static Future<String> addWarehouse(Warehouse w) async {
    final ref = _root.child('warehouses').push();
    await ref.set(w.toJson());
    await _log('أضاف مخزناً: ${w.name}');
    return ref.key!;
  }
  static Future<void> updateWarehouse(String id, Map<String, dynamic> data) async {
    await _root.child('warehouses/$id').update(data);
    await _log('عدّل مخزناً');
  }
  static Future<void> deleteWarehouse(String id) async {
    await _root.child('warehouses/$id').remove();
    await _log('حذف مخزناً');
  }

  static Future<List<Product>> getProducts({String? warehouseId}) async {
    final snap = await _root.child('products').get();
    if (!snap.exists) return [];
    final map = Map<String, dynamic>.from(snap.value as Map);
    return map.entries
        .map((e) => Product.fromJson(e.key, Map<String, dynamic>.from(e.value)))
        .where((p) => warehouseId == null || p.warehouseId == warehouseId)
        .toList();
  }
  static Future<bool> barcodeExists(String barcode, String warehouseId,
      {String? excludeId}) async {
    final products = await getProducts(warehouseId: warehouseId);
    return products.any((p) => p.barcode == barcode && p.id != (excludeId ?? ''));
  }
  static Future<String> addProduct(Product p) async {
    final ref = _root.child('products').push();
    await ref.set(p.toJson());
    await _log('أضاف منتجاً: ${p.name}');
    return ref.key!;
  }
  static Future<void> updateProduct(String id, Map<String, dynamic> data) async {
    await _root.child('products/$id').update(data);
    await _log('عدّل منتجاً');
  }
  static Future<void> deleteProduct(String id) async {
    await _root.child('products/$id').remove();
    await _log('حذف منتجاً');
  }
  static Future<void> updateProductQuantity(String id, double delta) async {
    final ref = _root.child('products/$id/quantity');
    final snap = await ref.get();
    final cur = (snap.value as num?)?.toDouble() ?? 0;
    await ref.set(cur + delta);
  }

  static Future<List<CashRegister>> getCashRegisters({String? branchId}) async {
    final snap = await _root.child('cashRegisters').get();
    if (!snap.exists) return [];
    final map = Map<String, dynamic>.from(snap.value as Map);
    return map.entries
        .map((e) => CashRegister.fromJson(e.key, Map<String, dynamic>.from(e.value)))
        .where((c) => branchId == null || c.branchId == branchId)
        .toList();
  }
  static Future<String> addCashRegister(CashRegister cr) async {
    final ref = _root.child('cashRegisters').push();
    await ref.set(cr.toJson());
    await _log('أضاف صندوقاً: ${cr.name}');
    return ref.key!;
  }
  static Future<void> setSessionOpen(String id, bool open) async {
    await _root.child('cashRegisters/$id/sessionOpen').set(open);
  }

  static Future<List<SalesUser>> getEmployees() async {
    final snap = await _root.child('employees').get();
    if (!snap.exists) return [];
    final map = Map<String, dynamic>.from(snap.value as Map);
    return map.entries.map((e) {
      final d = Map<String, dynamic>.from(e.value);
      return SalesUser.fromJson({...d, 'uid': e.key});
    }).toList();
  }
  static Future<void> addEmployee(SalesUser emp) async {
    await _root.child('employees/${emp.uid}').set(emp.toJson());
    await _log('أضاف موظفاً: ${emp.name}');
  }
  static Future<void> updateEmployee(String uid, Map<String, dynamic> data) async {
    await _root.child('employees/$uid').update(data);
    await _log('عدّل موظفاً');
  }
  static Future<void> removeEmployee(String uid) async {
    await _root.child('employees/$uid').remove();
    await _log('حذف موظفاً');
  }

  static Future<List<Invoice>> getInvoices({
    String? branchId, String? cashRegisterId,
    String? createdByUid, InvoiceStatus? status,
    DateTime? from, DateTime? to}) async {
    final snap = await _root.child('invoices').get();
    if (!snap.exists) return [];
    final map = Map<String, dynamic>.from(snap.value as Map);
    return map.entries
        .map((e) => Invoice.fromJson(e.key, Map<String, dynamic>.from(e.value)))
        .where((inv) {
          if (branchId != null && inv.branchId != branchId) return false;
          if (cashRegisterId != null && inv.cashRegisterId != cashRegisterId) return false;
          if (createdByUid != null && inv.createdByUid != createdByUid) return false;
          if (status != null && inv.status != status) return false;
          if (from != null && inv.createdAt.isBefore(from)) return false;
          if (to != null && inv.createdAt.isAfter(to)) return false;
          return true;
        }).toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }
  static Future<int> getNextSeq() async {
    final ref = _root.child('invoiceSequence');
    final snap = await ref.get();
    final next = ((snap.value as int?) ?? 0) + 1;
    await ref.set(next);
    return next;
  }
  static String makeNumber(int seq, String regId, String brId) {
    final n = DateTime.now();
    final d = n.day.toString().padLeft(2, '0');
    final m = n.month.toString().padLeft(2, '0');
    final s = seq.toString().padLeft(4, '0');
    final cr = (regId.length > 4 ? regId.substring(0, 4) : regId).toUpperCase();
    final br = (brId.length > 4 ? brId.substring(0, 4) : brId).toUpperCase();
    return '$d/$m-$s-$cr-$br';
  }
  static Future<String> saveInvoice(Invoice inv) async {
    final ref = _root.child('invoices').push();
    await ref.set(inv.toJson());
    await _log('أنشأ فاتورة: ${inv.number}');
    return ref.key!;
  }
  static Future<void> deleteInvoice(String id) async {
    await _root.child('invoices/$id').remove();
    await _log('حذف فاتورة');
  }

  // ── إعدادات الشركة والعملة ─────────────────
  static Future<SalesSettings> getSettings() async {
    try {
      // أولاً: قراءة إعدادات العملة المخصصة
      final settingsSnap = await _root.child('settings').get()
          .timeout(const Duration(seconds: 5));
      String currency = 'SAR';
      if (settingsSnap.exists && settingsSnap.value != null) {
        final m = Map<String, dynamic>.from(settingsSnap.value as Map);
        currency = m['currency'] ?? 'SAR';
      }

      // ثانياً: قراءة معلومات الشركة — نفس مصدر النظام المحاسبي الرئيسي (users/{uid}/companyInfo)
      // ملاحظة: نستخدم _ownerUid (وليس currentUser.uid مباشرة) لأن المستخدم
      // الحالي قد يكون موظفاً، و_ownerUid هو معرّف صاحب الحساب المُحلَّل مسبقاً
      // عبر employeeOwnerMap — استخدام currentUser.uid مباشرة كان يقرأ/يكتب
      // في عقدة المستخدم الخطأ (الموظف) بدل صاحب الشركة الفعلي.
      final uid = _ownerUid;
      String name = '', phone = '', address = '', email = '';
      if (uid != null) {
        final profileSnap = await FirebaseDatabase.instance
            .ref('users/$uid/companyInfo')
            .get().timeout(const Duration(seconds: 5));
        if (profileSnap.exists && profileSnap.value != null) {
          final info = Map<String, dynamic>.from(profileSnap.value as Map);
          name    = info['name']    ?? '';
          phone   = info['phone']   ?? '';
          address = info['address'] ?? '';
          email   = info['email']   ?? '';
        }
      }

      return SalesSettings(
        currency: currency,
        companyName: name,
        companyPhone: phone,
        companyAddress: address,
        companyEmail: email,
      );
    } catch (_) {}
    return const SalesSettings();
  }

  static Future<void> saveSettings(SalesSettings s) async {
    // حفظ العملة في settings
    await _root.child('settings/currency').set(s.currency);

    // حفظ معلومات الشركة — نفس مصدر النظام المحاسبي الرئيسي (users/{uid}/companyInfo)
    // (راجع نفس الملاحظة في getSettings حول استخدام _ownerUid بدل currentUser.uid)
    final uid = _ownerUid;
    if (uid != null) {
      await FirebaseDatabase.instance
          .ref('users/$uid/companyInfo')
          .set({
        'name': s.companyName,
        'phone': s.companyPhone,
        'address': s.companyAddress,
        'email': s.companyEmail,
      });
    }
  }

  // ── تصنيفات المنتجات ────────────────────────
  static Future<List<ProductCategory>> getCategories({String? warehouseId}) async {
    final snap = await _root.child('productCategories').get();
    if (!snap.exists) return [];
    final map = Map<String, dynamic>.from(snap.value as Map);
    return map.entries
        .map((e) => ProductCategory.fromJson(e.key, Map<String, dynamic>.from(e.value)))
        .where((c) => warehouseId == null || c.warehouseId == warehouseId)
        .toList();
  }

  static Future<String> addCategory(ProductCategory cat) async {
    final ref = _root.child('productCategories').push();
    await ref.set(cat.toJson());
    return ref.key!;
  }

  static Future<void> updateCategory(String id, String name) async {
    await _root.child('productCategories/$id/name').set(name);
  }

  static Future<void> deleteCategory(String id) async {
    await _root.child('productCategories/$id').remove();
  }

  // ── Stream للفواتير الجديدة (للإشعارات) ────
  static Stream<DatabaseEvent> watchNewInvoices() =>
      _root.child('invoices').limitToLast(1).onChildAdded;

  // ════════════════════════════════════════════════════
  //  Streams للتحديث الفوري (Live Sync)
  //  كل stream يستمع لـ onValue ويُطلق عند أي تغيير
  // ════════════════════════════════════════════════════

  static Stream<List<Branch>> watchBranches() =>
      _root.child('branches').onValue.map((e) {
        if (!e.snapshot.exists || e.snapshot.value == null) return <Branch>[];
        final m = Map<String, dynamic>.from(e.snapshot.value as Map);
        return m.entries
            .map((en) => Branch.fromJson(en.key, Map<String, dynamic>.from(en.value as Map)))
            .toList();
      });

  static Stream<List<Warehouse>> watchWarehouses() =>
      _root.child('warehouses').onValue.map((e) {
        if (!e.snapshot.exists || e.snapshot.value == null) return <Warehouse>[];
        final m = Map<String, dynamic>.from(e.snapshot.value as Map);
        return m.entries
            .map((en) => Warehouse.fromJson(en.key, Map<String, dynamic>.from(en.value as Map)))
            .toList();
      });

  static Stream<List<Product>> watchProducts() =>
      _root.child('products').onValue.map((e) {
        if (!e.snapshot.exists || e.snapshot.value == null) return <Product>[];
        final m = Map<String, dynamic>.from(e.snapshot.value as Map);
        return m.entries
            .map((en) => Product.fromJson(en.key, Map<String, dynamic>.from(en.value as Map)))
            .toList();
      });

  static Stream<List<Invoice>> watchInvoices() =>
      _root.child('invoices').onValue.map((e) {
        if (!e.snapshot.exists || e.snapshot.value == null) return <Invoice>[];
        final m = Map<String, dynamic>.from(e.snapshot.value as Map);
        return m.entries
            .map((en) => Invoice.fromJson(en.key, Map<String, dynamic>.from(en.value as Map)))
            .toList();
      });

  static Stream<List<CashRegister>> watchCashRegisters() =>
      _root.child('cashRegisters').onValue.map((e) {
        if (!e.snapshot.exists || e.snapshot.value == null) return <CashRegister>[];
        final m = Map<String, dynamic>.from(e.snapshot.value as Map);
        return m.entries
            .map((en) => CashRegister.fromJson(en.key, Map<String, dynamic>.from(en.value as Map)))
            .toList();
      });

  static Stream<SalesSettings> watchSettings() =>
      _root.child('settings').onValue.asyncMap((e) async {
        final data = e.snapshot.value as Map?;
        final currency = (data?['currency'] as String?) ?? 'SAR';
        // اقرأ companyInfo أيضاً (عبر _ownerUid وليس currentUser.uid — راجع
        // نفس الملاحظة في getSettings)
        final uid = _ownerUid;
        if (uid == null) return SalesSettings(currency: currency);
        try {
          final ci = await FirebaseDatabase.instance
              .ref('users/$uid/companyInfo').get();
          final c = ci.exists && ci.value != null
              ? Map<String, dynamic>.from(ci.value as Map) : <String, dynamic>{};
          return SalesSettings(
            currency: currency,
            companyName:    (c['name']    as String?) ?? '',
            companyPhone:   (c['phone']   as String?) ?? '',
            companyAddress: (c['address'] as String?) ?? '',
            companyEmail:   (c['email']   as String?) ?? '',
          );
        } catch (_) {
          return SalesSettings(currency: currency);
        }
      });

  static Future<void> _log(String action) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final ref = _root.child('activityLog').push();
    await ref.set({'action': action, 'byUid': user.uid,
      'byName': user.displayName ?? user.email ?? '',
      'at': DateTime.now().toIso8601String()});
  }
  static Future<List<Map>> getActivityLog() async {
    final snap = await _root.child('activityLog').get();
    if (!snap.exists) return [];
    final map = Map<String, dynamic>.from(snap.value as Map);
    final list = map.entries.map((e) {
      final d = Map<String, dynamic>.from(e.value);
      return {...d, 'id': e.key};
    }).toList();
    list.sort((a, b) => (b['at'] ?? '').compareTo(a['at'] ?? ''));
    return list.take(100).toList();
  }
}

// ─── Helper: show dialog safely ──────────────
Future<T?> _safeDialog<T>(BuildContext context, Widget Function(BuildContext) builder) {
  return showDialog<T>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => builder(ctx),
  );
}

// ─── Helper: show bottom sheet safely ────────
Future<void> _safeSheet(BuildContext context, Widget Function(BuildContext, StateSetter) builder) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (ctx) => StatefulBuilder(builder: builder),
  );
}

// ─── تطبيق POS للكاشير فقط ─────────────────
class CashierPOSApp extends StatelessWidget {
  final SalesUser user;
  const CashierPOSApp({super.key, required this.user});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: salesNavigatorKey,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily: 'Cairo', useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: _kBlue)),
      home: SalesCashierScreen(user: user),
      routes: const {},
    );
  }
}

// ─── Sales Root Screen ───────────────────────
class SalesRootScreen extends StatefulWidget {
  final String ownerUid;
  const SalesRootScreen({super.key, required this.ownerUid});
  @override State<SalesRootScreen> createState() => _SalesRootState();
}

class _SalesRootState extends State<SalesRootScreen> {
  bool _loading = true;
  SalesUser? _user;

  @override
  void initState() {
    super.initState();
    SalesDataService.init(widget.ownerUid);
    _load();
  }

  Future<void> _load() async {
    final u = await SalesDataService.getCurrentUserRole();
    if (mounted) setState(() { _user = u; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const MaterialApp(
      home: Scaffold(backgroundColor: Color(0xFF021B79),
          body: Center(child: CircularProgressIndicator(color: Colors.white))));

    // كاشير → POS فقط
    if (_user != null && _user!.isCashier) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (_, __) {},
        child: CashierPOSApp(user: _user!),
      );
    }

    // null مع ownerUid مختلف عن uid الحالي → الحالي كاشير لم تُحمَّل بياناته
    final currentUid = FirebaseAuth.instance.currentUser?.uid ?? '';
    if (_user == null && widget.ownerUid != currentUid) {
      // كاشير لم تُحمَّل بياناته الكاملة — أنشئ مستخدماً افتراضياً
      final fbUser = FirebaseAuth.instance.currentUser;
      final fallbackUser = SalesUser(
        uid: currentUid,
        name: fbUser?.displayName ?? '',
        email: fbUser?.email ?? '',
        role: UserRole.cashier,
        ownerUid: widget.ownerUid,
      );
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (_, __) {},
        child: CashierPOSApp(user: fallbackUser),
      );
    }

    return PopScope(
      canPop: false,
      child: SalesApp(ownerUid: widget.ownerUid),
    );
  }
}

// ─── Sales App ────────────────────────────────
class SalesApp extends StatefulWidget {
  final String ownerUid;
  const SalesApp({super.key, required this.ownerUid});
  @override
  State<SalesApp> createState() => _SalesAppState();
}

// ─── Notification Service ─────────────────────
final _fln = FlutterLocalNotificationsPlugin();
bool _flnReady = false;

Future<void> initSalesNotifications() async {
  if (_flnReady) return;
  const android = AndroidInitializationSettings('@mipmap/ic_launcher');
  const ios = DarwinInitializationSettings();
  await _fln.initialize(const InitializationSettings(android: android, iOS: ios));
  _flnReady = true;
}

Future<void> _showInvoiceNotification(String number, double total, String currency) async {
  try {
    await initSalesNotifications();
    const android = AndroidNotificationDetails(
      'invoices', 'فواتير جديدة',
      channelDescription: 'إشعارات عند إنشاء فاتورة جديدة',
      importance: Importance.high, priority: Priority.high,
      icon: '@mipmap/ic_launcher');
    await _fln.show(
      DateTime.now().millisecondsSinceEpoch & 0x7FFFFFFF,
      'فاتورة جديدة 🧾',
      'رقم: $number — الإجمالي: ${total.toStringAsFixed(2)} $currency',
      const NotificationDetails(android: android, iOS: DarwinNotificationDetails()),
    );
  } catch (_) {}
}

class _SalesAppState extends State<SalesApp> {
  SalesUser? _user;
  SalesSettings _settings = const SalesSettings();
  bool _loading = true;
  StreamSubscription? _invoiceSub;

  @override
  void initState() {
    super.initState();
    SalesDataService.init(widget.ownerUid);
    _load();
  }

  @override
  void dispose() {
    _invoiceSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      var user = await SalesDataService.getCurrentUserRole();
      if (user == null) {
        await SalesDataService.saveOwnerProfile(
          FirebaseAuth.instance.currentUser?.displayName ?? '',
          FirebaseAuth.instance.currentUser?.email ?? '');
        user = await SalesDataService.getCurrentUserRole();
      }
      final settings = await SalesDataService.getSettings();
      if (mounted) setState(() { _user = user; _settings = settings; _loading = false; });
      // ── استمع لفواتير جديدة (للمالك فقط) ──
      if (user?.isOwner == true) _listenInvoices(settings);
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _listenInvoices(SalesSettings s) {
    _invoiceSub?.cancel();
    bool first = true; // تجاهل الحدث الأول (الفاتورة الموجودة مسبقاً)
    _invoiceSub = SalesDataService.watchNewInvoices().listen((event) {
      if (first) { first = false; return; }
      try {
        final data = Map<String, dynamic>.from(event.snapshot.value as Map);
        final inv = Invoice.fromJson(event.snapshot.key ?? '', data);
        _showInvoiceNotification(inv.number, inv.totalRounded, s.currency);
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(backgroundColor: _kBlue,
          body: const Center(child: CircularProgressIndicator(color: Colors.white))));
    return MaterialApp(
      navigatorKey: salesNavigatorKey,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(fontFamily: 'Cairo', useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: _kBlue)),
      home: (_user == null || _user!.isOwner)
          ? SalesOwnerScreen(ownerUid: widget.ownerUid, user: _user, settings: _settings)
          : SalesCashierScreen(user: _user!),
    );
  }
}

// ─── Back to Accounting ──────────────────────
void Function(BuildContext)? _launchAccountingCallback;

void registerAccountingLauncher(void Function(BuildContext) fn) {
  _launchAccountingCallback = fn;
}

Future<void> switchBackToAccounting(BuildContext context) async {
  if (!context.mounted) return;
  Navigator.of(context, rootNavigator: true).pop();
}

final GlobalKey<NavigatorState> salesNavigatorKey = GlobalKey<NavigatorState>();

// ══════════════════════════════════════════════════════════════════
//  signOutAndGoToLogin — محدَّثة: تعود لـ WelcomeScreen الرئيسية
// ══════════════════════════════════════════════════════════════════
Future<void> signOutAndGoToLogin() async {
  final uid = FirebaseAuth.instance.currentUser?.uid;
  await FirebaseAuth.instance.signOut();
  // مسح الدور المحفوظ حتى يعاد التحقق في تسجيل الدخول القادم
  if (uid != null) {
    final prefs = await SharedPreferences.getInstance();
    prefs.remove('urole_$uid');
    prefs.remove('uowner_$uid');
  }

  // الخيار 1: عبر callback من main.dart (موشن _SignOutRoute → WelcomeScreen)
  if (_launchAccountingCallback != null) {
    final ctx = salesNavigatorKey.currentContext;
    if (ctx != null) {
      _launchAccountingCallback!(ctx);
      return;
    }
  }

  // الخيار 2: fallback — صفحة الدخول الداخلية
  salesNavigatorKey.currentState?.pushAndRemoveUntil(
    PageRouteBuilder(
      pageBuilder: (_, __, ___) => const _SalesLoginScreen(),
      transitionsBuilder: (_, anim, __, child) =>
          FadeTransition(opacity: anim, child: child),
      transitionDuration: const Duration(milliseconds: 400),
    ),
    (route) => false,
  );
}

// ─── Simple login screen ──────────────────────
class _SalesLoginScreen extends StatefulWidget {
  const _SalesLoginScreen();
  @override State<_SalesLoginScreen> createState() => _SalesLoginState();
}
class _SalesLoginState extends State<_SalesLoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF021B79), Color(0xFF0575E6)])),
        child: SafeArea(child: Center(child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            const SizedBox(height: 40),
            const Icon(Icons.lock_open, size: 64, color: Colors.white),
            const SizedBox(height: 16),
            const Text('تسجيل الدخول', style: TextStyle(
              color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white,
                  borderRadius: BorderRadius.circular(20)),
              child: Column(children: [
                if (_error != null) Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(_error!, style: const TextStyle(color: Colors.red))),
                TextField(controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'البريد الإلكتروني',
                    prefixIcon: Icon(Icons.email), border: OutlineInputBorder())),
                const SizedBox(height: 12),
                TextField(controller: _passCtrl, obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'كلمة المرور',
                    prefixIcon: Icon(Icons.lock), border: OutlineInputBorder())),
                const SizedBox(height: 16),
                SizedBox(width: double.infinity, child: ElevatedButton(
                  onPressed: _loading ? null : _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue, foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: _loading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('دخول', style: TextStyle(fontSize: 16)))),
              ])),
          ],
        ),
      )))));
  }

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      final cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailCtrl.text.trim(), password: _passCtrl.text);
      if (cred.user == null) return;

      final uid = cred.user!.uid;

      final empSnap = await FirebaseDatabase.instance
          .ref('employeeOwnerMap/$uid').get();
      if (empSnap.exists) {
        final ownerUid = empSnap.value as String;
        SalesDataService.init(ownerUid);
        if (mounted) {
          salesNavigatorKey.currentState?.pushAndRemoveUntil(
            PageRouteBuilder(
              pageBuilder: (_, __, ___) => SalesRootScreen(ownerUid: ownerUid),
              transitionsBuilder: (_, anim, __, child) =>
                  FadeTransition(opacity: anim, child: child),
              transitionDuration: const Duration(milliseconds: 400),
            ),
            (route) => false);
        }
        return;
      }

      if (_launchAccountingCallback != null && mounted) {
        _launchAccountingCallback!(context);
      }

    } on FirebaseAuthException catch (e) {
      setState(() => _error = _errMsg(e.code));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _errMsg(String code) {
    switch (code) {
      case 'user-not-found': return 'المستخدم غير موجود';
      case 'wrong-password': return 'كلمة المرور خاطئة';
      case 'invalid-email': return 'البريد الإلكتروني غير صحيح';
      default: return 'خطأ في تسجيل الدخول';
    }
  }
}

// ─── Owner Screen ─────────────────────────────
class SalesOwnerScreen extends StatefulWidget {
  final String ownerUid;
  final SalesUser? user;
  final SalesSettings settings;
  const SalesOwnerScreen({super.key, required this.ownerUid, this.user,
      this.settings = const SalesSettings()});
  @override
  State<SalesOwnerScreen> createState() => _SalesOwnerScreenState();
}

class _SalesOwnerScreenState extends State<SalesOwnerScreen> {
  int _tab = 0;
  late SalesSettings _settings;

  @override
  void initState() { super.initState(); _settings = widget.settings; }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      const _DashboardTab(),
      const _BranchesTab(),
      const _WarehousesTab(),
      const _ProductsTab(),
      const _EmployeesTab(),
      _ReportsTab(settings: _settings),
      _LoyaltyTab(ownerUid: widget.ownerUid),
      _SettingsTab(settings: _settings, ownerUid: widget.ownerUid,
          onSaved: (s) => setState(() => _settings = s)),
    ];
    return PopScope(
      canPop: false,
      // تعطيل زر الرجوع كلياً — يمكن الخروج فقط عبر زر التبديل في AppBar
      onPopInvokedWithResult: (_, __) {},
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: _kBlue,
          foregroundColor: Colors.white,
          centerTitle: true,
          title: Text(_settings.companyName.isNotEmpty ? _settings.companyName : 'نظام المبيعات',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
          leading: IconButton(
            icon: const Icon(Icons.swap_horiz, color: Colors.white),
            tooltip: 'العودة للمحاسبة',
            onPressed: () => _confirmBack(context),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.history, color: Colors.white),
              onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const ActivityLogScreen())),
            ),
          ],
        ),
        body: IndexedStack(index: _tab, children: tabs),
        bottomNavigationBar: _buildNavBar(),
      ),
    );
  }

  Widget _buildNavBar() {
    final items = <Map<String, dynamic>>[
      {'off': Icons.dashboard_outlined, 'on': Icons.dashboard, 'label': 'الرئيسية'},
      {'off': Icons.store_outlined, 'on': Icons.store, 'label': 'الفروع'},
      {'off': Icons.warehouse_outlined, 'on': Icons.warehouse, 'label': 'المخازن'},
      {'off': Icons.inventory_2_outlined, 'on': Icons.inventory_2, 'label': 'المنتجات'},
      {'off': Icons.people_outline, 'on': Icons.people, 'label': 'الموظفون'},
      {'off': Icons.bar_chart_outlined, 'on': Icons.bar_chart, 'label': 'التقارير'},
      {'off': Icons.card_giftcard_outlined, 'on': Icons.card_giftcard, 'label': 'الولاء'},
      {'off': Icons.settings_outlined, 'on': Icons.settings, 'label': 'الإعدادات'},
    ];
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12, offset: const Offset(0, -2))],
      ),
      child: SafeArea(
        child: SizedBox(
          height: 60,
          child: Row(
            children: List.generate(items.length, (i) {
              final sel = _tab == i;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _tab = i),
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(sel ? items[i]['on'] as IconData : items[i]['off'] as IconData,
                          color: sel ? _kBlue : Colors.grey.shade500, size: 22),
                      const SizedBox(height: 2),
                      Text(items[i]['label'] as String,
                          style: TextStyle(
                              fontSize: 9,
                              color: sel ? _kBlue : Colors.grey.shade500,
                              fontWeight: sel ? FontWeight.bold : FontWeight.normal)),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmBack(BuildContext context) async {
    final confirm = await _safeDialog<bool>(
      context,
      (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('تبديل النظام'),
        content: const Text('هل تريد العودة للنظام المحاسبي؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء')),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: _kBlue),
            child: const Text('تبديل', style: TextStyle(color: Colors.white))),
        ],
      ),
    );
    if (confirm == true && context.mounted) {
      await switchBackToAccounting(context);
    }
  }
}

// ─── Dashboard Tab ────────────────────────────
class _DashboardTab extends StatefulWidget {
  const _DashboardTab();
  @override State<_DashboardTab> createState() => _DashboardTabState();
}
class _DashboardTabState extends State<_DashboardTab> {
  List<Invoice> _inv = []; List<Branch> _br = [];
  List<CashRegister> _cr = []; bool _loading = true;
  String _currency = 'SAR';
  StreamSubscription? _invSub, _brSub, _crSub, _setSub;

  @override
  void initState() {
    super.initState();
    // ── إعدادات (عملة) ──────────────────────────
    _setSub = SalesDataService.watchSettings().listen((s) {
      if (mounted) setState(() => _currency = s.currency);
    });
    // ── فواتير اليوم ─────────────────────────────
    _invSub = SalesDataService.watchInvoices().listen((list) {
      final today = DateTime.now();
      final start = DateTime(today.year, today.month, today.day);
      if (mounted) setState(() {
        _inv = list
            .where((i) => i.status == InvoiceStatus.closed &&
                !i.createdAt.isBefore(start))
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        _loading = false;
      });
    });
    // ── فروع ─────────────────────────────────────
    _brSub = SalesDataService.watchBranches().listen((list) {
      if (mounted) setState(() => _br = list);
    });
    // ── صناديق ───────────────────────────────────
    _crSub = SalesDataService.watchCashRegisters().listen((list) {
      if (mounted) setState(() => _cr = list);
    });
  }

  @override
  void dispose() {
    _invSub?.cancel(); _brSub?.cancel();
    _crSub?.cancel();  _setSub?.cancel();
    super.dispose();
  }

  // باقي الـ tabs لا تزال تستدعي _load بعد العمليات — نحتفظ بها كـ no-op
  Future<void> _load() async {}
  double get _rev => _inv.fold(0, (s, i) => s + i.totalRounded);
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        GridView.count(crossAxisCount: 2, shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.5,
          children: [
            _kpi('إيرادات اليوم', '${_rev.toStringAsFixed(2)} ${currencySymbol(_currency)}',
                Icons.attach_money, const Color(0xFF27AE60)),
            _kpi('فواتير اليوم', '${_inv.length}',
                Icons.receipt_long, const Color(0xFF2980B9)),
            _kpi('الفروع', '${_br.length}',
                Icons.store, const Color(0xFF8E44AD)),
            _kpi('صناديق مفتوحة',
                '${_cr.where((r) => r.sessionOpen).length}',
                Icons.point_of_sale, const Color(0xFFE67E22)),
          ]),
        const SizedBox(height: 20),
        const Text('حالة الصناديق',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        ..._cr.map((r) {
          final brName = _br.firstWhere((b) => b.id == r.branchId,
            orElse: () => Branch(id:'', name:'', ownerUid:'',
                createdAt: DateTime.now())).name;
          return Card(child: ListTile(
            leading: Icon(r.sessionOpen ? Icons.lock_open : Icons.lock,
                color: r.sessionOpen ? Colors.green : Colors.red),
            title: Text(r.name),
            subtitle: Text(brName),
            trailing: Chip(
              label: Text(r.sessionOpen ? 'مفتوح' : 'مغلق',
                  style: TextStyle(fontSize: 11,
                    color: r.sessionOpen ? Colors.green.shade800 : Colors.red.shade800)),
              backgroundColor: r.sessionOpen
                  ? Colors.green.shade100 : Colors.red.shade100,
              padding: EdgeInsets.zero),
          ));
        }),
        if (_inv.isNotEmpty) ...[
          const SizedBox(height: 20),
          const Text('آخر الفواتير',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          ..._inv.take(5).map((inv) => Card(child: ListTile(
            leading: const Icon(Icons.receipt, color: _kBlue),
            title: Text(inv.number),
            subtitle: Text(DateFormat('hh:mm a').format(inv.createdAt)),
            trailing: Text(inv.totalRounded.toStringAsFixed(2),
                style: const TextStyle(fontWeight: FontWeight.bold)),
            onTap: () => Navigator.push(context, MaterialPageRoute(
                builder: (_) => InvoiceDetailScreen(
                    invoice: inv, companyName: '', currency: _currency))),
          ))),
        ],
      ]),
    );
  }
  Widget _kpi(String t, String v, IconData icon, Color c) => Container(
    decoration: BoxDecoration(color: c.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.withValues(alpha: 0.25))),
    padding: const EdgeInsets.all(12),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(icon, color: c, size: 24),
      const SizedBox(height: 4),
      Text(v, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: c)),
      Text(t, style: const TextStyle(fontSize: 10, color: Colors.grey),
          textAlign: TextAlign.center, maxLines: 2),
    ]),
  );
}

// ─── Branches Tab ─────────────────────────────
class _BranchesTab extends StatefulWidget {
  const _BranchesTab();
  @override State<_BranchesTab> createState() => _BranchesTabState();
}
class _BranchesTabState extends State<_BranchesTab> {
  List<Branch> _list = []; bool _loading = true;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _sub = SalesDataService.watchBranches().listen((list) {
      if (mounted) setState(() { _list = list; _loading = false; });
    });
  }

  @override
  void dispose() { _sub?.cancel(); super.dispose(); }

  Future<void> _load() async {} // no-op — stream يحدّث تلقائياً
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Scaffold(
      body: _list.isEmpty
          ? const Center(child: Text('لا توجد فروع'))
          : ListView.builder(padding: const EdgeInsets.all(12),
              itemCount: _list.length,
              itemBuilder: (_, i) => _tile(_list[i])),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add, icon: const Icon(Icons.add),
        label: const Text('فرع جديد'),
        backgroundColor: _kBlue, foregroundColor: Colors.white),
    );
  }
  Widget _tile(Branch b) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      leading: CircleAvatar(
        backgroundColor: _kBlue.withValues(alpha: 0.1),
        child: Icon(_icon(b.type), color: _kBlue)),
      title: Text(b.name, style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text('${b.typeLabel} • ${b.address ?? ""}'),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(icon: const Icon(Icons.edit, size: 18), onPressed: () => _edit(b)),
        IconButton(icon: const Icon(Icons.delete, size: 18, color: Colors.red),
            onPressed: () => _delete(b)),
        const Icon(Icons.chevron_right, size: 18),
      ]),
      onTap: () => Navigator.push(context,
        MaterialPageRoute(builder: (_) => BranchDetailScreen(branch: b)))
          .then((_) => _load()),
    ),
  );
  IconData _icon(BusinessType t) {
    switch (t) {
      case BusinessType.restaurant: return Icons.restaurant;
      case BusinessType.cafe: return Icons.coffee;
      default: return Icons.store;
    }
  }
  Future<void> _add() async {
    final nameC = TextEditingController();
    final addrC = TextEditingController();
    var type = BusinessType.store;
    await _safeSheet(context, (ctx, setSt) => Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('فرع جديد', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextField(controller: nameC,
            decoration: const InputDecoration(labelText: 'الاسم *', border: OutlineInputBorder())),
        const SizedBox(height: 10),
        DropdownButtonFormField<BusinessType>(value: type,
          decoration: const InputDecoration(labelText: 'النوع', border: OutlineInputBorder()),
          items: const [
            DropdownMenuItem(value: BusinessType.store, child: Text('متجر')),
            DropdownMenuItem(value: BusinessType.restaurant, child: Text('مطعم')),
            DropdownMenuItem(value: BusinessType.cafe, child: Text('كافيه')),
          ],
          onChanged: (v) => setSt(() => type = v!)),
        const SizedBox(height: 10),
        TextField(controller: addrC,
            decoration: const InputDecoration(labelText: 'العنوان', border: OutlineInputBorder())),
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: _kBlue, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14)),
          onPressed: () async {
            if (nameC.text.trim().isEmpty) return;
            final uid = FirebaseAuth.instance.currentUser!.uid;
            await SalesDataService.addBranch(Branch(
              id: '', name: nameC.text.trim(), ownerUid: uid,
              address: addrC.text.trim(), type: type, createdAt: DateTime.now()));
            if (ctx.mounted) Navigator.of(ctx).pop();
            if (mounted) await _load();
          },
          child: const Text('إضافة'))),
      ]),
    ));
  }
  Future<void> _edit(Branch b) async {
    final nameC = TextEditingController(text: b.name);
    final addrC = TextEditingController(text: b.address ?? '');
    await _safeDialog(context, (ctx) => AlertDialog(
      title: const Text('تعديل الفرع'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nameC, decoration: const InputDecoration(labelText: 'الاسم')),
        const SizedBox(height: 8),
        TextField(controller: addrC, decoration: const InputDecoration(labelText: 'العنوان')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('إلغاء')),
        ElevatedButton(onPressed: () async {
          await SalesDataService.updateBranch(b.id,
              {'name': nameC.text.trim(), 'address': addrC.text.trim()});
          Navigator.of(ctx).pop();
          if (mounted) await _load();
        }, child: const Text('حفظ')),
      ],
    ));
  }
  Future<void> _delete(Branch b) async {
    final ok = await _safeDialog<bool>(context, (ctx) => AlertDialog(
      title: const Text('حذف الفرع'),
      content: Text('حذف "${b.name}"؟'),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('إلغاء')),
        ElevatedButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('حذف', style: TextStyle(color: Colors.white))),
      ],
    ));
    if (ok == true) { await SalesDataService.deleteBranch(b.id); await _load(); }
  }
}

// ─── Branch Detail ────────────────────────────
class BranchDetailScreen extends StatefulWidget {
  final Branch branch;
  const BranchDetailScreen({super.key, required this.branch});
  @override State<BranchDetailScreen> createState() => _BranchDetailScreenState();
}
class _BranchDetailScreenState extends State<BranchDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tc;
  List<CashRegister> _regs = []; bool _loading = true;
  @override void initState() { super.initState();
    _tc = TabController(length: 2, vsync: this); _load(); }
  @override void dispose() { _tc.dispose(); super.dispose(); }
  Future<void> _load() async {
    final cr = await SalesDataService.getCashRegisters(branchId: widget.branch.id);
    if (mounted) setState(() { _regs = cr; _loading = false; });
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.branch.name),
        backgroundColor: _kBlue, foregroundColor: Colors.white,
        bottom: TabBar(controller: _tc,
          labelColor: Colors.white, unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          tabs: const [Tab(text: 'الصناديق'), Tab(text: 'احصائيات')])),
      body: _loading ? const Center(child: CircularProgressIndicator())
          : TabBarView(controller: _tc, children: [
              _RegistersView(regs: _regs, branch: widget.branch, onRefresh: _load),
              _BranchStats(branch: widget.branch),
            ]));
  }
}
class _RegistersView extends StatelessWidget {
  final List<CashRegister> regs; final Branch branch; final VoidCallback onRefresh;
  const _RegistersView({required this.regs, required this.branch, required this.onRefresh});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: regs.isEmpty ? const Center(child: Text('لا توجد صناديق'))
        : ListView.builder(padding: const EdgeInsets.all(12),
            itemCount: regs.length,
            itemBuilder: (_, i) => Card(child: ListTile(
              leading: Icon(regs[i].sessionOpen ? Icons.point_of_sale : Icons.lock,
                  color: regs[i].sessionOpen ? Colors.green : Colors.grey),
              title: Text(regs[i].name),
              subtitle: Text(regs[i].sessionOpen ? 'مفتوح' : 'مغلق')))),
    floatingActionButton: FloatingActionButton(onPressed: () => _add(context),
        backgroundColor: _kBlue, foregroundColor: Colors.white,
        child: const Icon(Icons.add)),
  );
  Future<void> _add(BuildContext context) async {
    final ctrl = TextEditingController();
    await _safeDialog(context, (ctx) => AlertDialog(
      title: const Text('صندوق جديد'),
      content: TextField(controller: ctrl,
          decoration: const InputDecoration(labelText: 'الاسم')),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('إلغاء')),
        ElevatedButton(onPressed: () async {
          if (ctrl.text.trim().isEmpty) return;
          final uid = FirebaseAuth.instance.currentUser!.uid;
          await SalesDataService.addCashRegister(CashRegister(
            id: '', name: ctrl.text.trim(), branchId: branch.id, ownerUid: uid));
          Navigator.of(ctx).pop();
          onRefresh();
        }, child: const Text('إضافة')),
      ],
    ));
  }
}
class _BranchStats extends StatefulWidget {
  final Branch branch;
  const _BranchStats({required this.branch});
  @override State<_BranchStats> createState() => _BranchStatsState();
}
class _BranchStatsState extends State<_BranchStats> {
  List<Invoice> _inv = []; bool _loading = true;
  @override void initState() { super.initState();
    SalesDataService.getInvoices(branchId: widget.branch.id,
        status: InvoiceStatus.closed).then((v) {
      if (mounted) setState(() { _inv = v; _loading = false; }); }); }
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final total = _inv.fold(0.0, (s, i) => s + i.totalRounded);
    return ListView(padding: const EdgeInsets.all(16), children: [
      _stat('إجمالي الفواتير', '${_inv.length}', Icons.receipt),
      _stat('إجمالي الإيرادات', total.toStringAsFixed(2), Icons.attach_money),
    ]);
  }
  Widget _stat(String t, String v, IconData icon) => Card(child: ListTile(
    leading: Icon(icon, color: _kBlue), title: Text(t),
    trailing: Text(v, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16))));
}

// ─── Warehouses Tab ───────────────────────────
class _WarehousesTab extends StatefulWidget {
  const _WarehousesTab();
  @override State<_WarehousesTab> createState() => _WarehousesTabState();
}
class _WarehousesTabState extends State<_WarehousesTab> {
  List<Warehouse> _list = []; List<Branch> _branches = []; bool _loading = true;
  StreamSubscription? _whSub, _brSub;

  @override
  void initState() {
    super.initState();
    _whSub = SalesDataService.watchWarehouses().listen((list) {
      if (mounted) setState(() { _list = list; _loading = false; });
    });
    _brSub = SalesDataService.watchBranches().listen((list) {
      if (mounted) setState(() => _branches = list);
    });
  }

  @override
  void dispose() { _whSub?.cancel(); _brSub?.cancel(); super.dispose(); }

  Future<void> _load() async {} // no-op — stream يحدّث تلقائياً
  String _brName(String id) => _branches.firstWhere(
    (b) => b.id == id, orElse: () =>
        Branch(id: '', name: 'غير محدد', ownerUid: '', createdAt: DateTime.now())).name;
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Scaffold(
      body: _list.isEmpty ? const Center(child: Text('لا توجد مخازن'))
          : ListView.builder(padding: const EdgeInsets.all(12),
              itemCount: _list.length,
              itemBuilder: (_, i) => _tile(_list[i])),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add, icon: const Icon(Icons.add),
        label: const Text('مخزن جديد'),
        backgroundColor: _kBlue, foregroundColor: Colors.white),
    );
  }
  Widget _tile(Warehouse w) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      leading: const CircleAvatar(backgroundColor: _kBlue,
          child: Icon(Icons.warehouse, color: Colors.white, size: 18)),
      title: Text(w.name, style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text('الفرع: ${_brName(w.branchId)}'),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(icon: const Icon(Icons.edit, size: 18), onPressed: () => _edit(w)),
        IconButton(icon: const Icon(Icons.delete, size: 18, color: Colors.red),
            onPressed: () => _delete(w)),
        const Icon(Icons.chevron_right, size: 18),
      ]),
      onTap: () => Navigator.push(context,
        MaterialPageRoute(builder: (_) => WarehouseProductsScreen(warehouse: w)))
          .then((_) => _load()),
    ),
  );
  Future<void> _add() async {
    final nameC = TextEditingController();
    String? selBranch;
    await _safeSheet(context, (ctx, setSt) => Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('مخزن جديد', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextField(controller: nameC,
            decoration: const InputDecoration(labelText: 'اسم المخزن *', border: OutlineInputBorder())),
        const SizedBox(height: 10),
        if (_branches.isNotEmpty) DropdownButtonFormField<String>(
          value: selBranch,
          decoration: const InputDecoration(labelText: 'الفرع', border: OutlineInputBorder()),
          items: _branches.map((b) => DropdownMenuItem(value: b.id, child: Text(b.name))).toList(),
          onChanged: (v) => setSt(() => selBranch = v)),
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: _kBlue, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14)),
          onPressed: () async {
            if (nameC.text.trim().isEmpty) return;
            final uid = FirebaseAuth.instance.currentUser!.uid;
            await SalesDataService.addWarehouse(Warehouse(
              id: '', name: nameC.text.trim(),
              branchId: selBranch ?? '', ownerUid: uid));
            if (ctx.mounted) Navigator.of(ctx).pop();
            if (mounted) await _load();
          }, child: const Text('إضافة'))),
      ]),
    ));
  }
  Future<void> _edit(Warehouse w) async {
    final nameC = TextEditingController(text: w.name);
    String? selBranch = w.branchId.isEmpty ? null : w.branchId;
    await _safeDialog(context, (ctx) => StatefulBuilder(
      builder: (ctx2, setSt) => AlertDialog(
        title: const Text('تعديل المخزن'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameC,
              decoration: const InputDecoration(labelText: 'الاسم')),
          if (_branches.isNotEmpty) ...[
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: selBranch,
              decoration: const InputDecoration(labelText: 'الفرع'),
              items: _branches.map((b) => DropdownMenuItem(value: b.id, child: Text(b.name))).toList(),
              onChanged: (v) => setSt(() => selBranch = v)),
          ],
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('إلغاء')),
          ElevatedButton(onPressed: () async {
            await SalesDataService.updateWarehouse(w.id,
                {'name': nameC.text.trim(), 'branchId': selBranch ?? ''});
            Navigator.of(ctx).pop();
            if (mounted) await _load();
          }, child: const Text('حفظ')),
        ],
      ),
    ));
  }
  Future<void> _delete(Warehouse w) async {
    final ok = await _safeDialog<bool>(context, (ctx) => AlertDialog(
      title: const Text('حذف المخزن'),
      content: Text('حذف "${w.name}"؟'),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('إلغاء')),
        ElevatedButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('حذف', style: TextStyle(color: Colors.white))),
      ],
    ));
    if (ok == true) { await SalesDataService.deleteWarehouse(w.id); await _load(); }
  }
}

// ─── Warehouse Products ───────────────────────
class WarehouseProductsScreen extends StatefulWidget {
  final Warehouse warehouse;
  const WarehouseProductsScreen({super.key, required this.warehouse});
  @override State<WarehouseProductsScreen> createState() => _WPState();
}
class _WPState extends State<WarehouseProductsScreen> {
  List<Product> _list = [];
  List<ProductCategory> _cats = [];
  bool _loading = true;
  String _q = '';
  String? _selCat;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    // منتجات live — فلترة بالمخزن من جهة العميل
    _sub = SalesDataService.watchProducts().listen((all) {
      if (mounted) setState(() {
        _list = all.where((p) => p.warehouseId == widget.warehouse.id).toList();
        _loading = false;
      });
    });
    // تصنيفات — يكفي تحميل مرة واحدة
    SalesDataService.getCategories(warehouseId: widget.warehouse.id)
        .then((c) { if (mounted) setState(() => _cats = c); });
  }

  @override
  void dispose() { _sub?.cancel(); super.dispose(); }

  Future<void> _load() async {} // no-op — stream يحدّث تلقائياً

  List<Product> get _filtered => _list.where((p) {
    final matchQ = p.name.contains(_q) || (p.barcode ?? '').contains(_q);
    final matchC = _selCat == null || p.category == _selCat;
    return matchQ && matchC;
  }).toList();

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.warehouse.name),
      backgroundColor: _kBlue, foregroundColor: Colors.white,
      actions: [
        IconButton(
          icon: const Icon(Icons.category_outlined),
          tooltip: 'إدارة التصنيفات',
          onPressed: _manageCategories),
      ],
    ),
    body: Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(10, 10, 10, 4),
        child: TextField(
          decoration: const InputDecoration(hintText: 'بحث...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(), isDense: true),
          onChanged: (v) => setState(() => _q = v))),
      // ── شريط التصنيفات ──
      if (_cats.isNotEmpty) SizedBox(
        height: 38,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          children: [
            _catChip(null, 'الكل'),
            ..._cats.map((c) => _catChip(c.name, c.name)),
          ],
        ),
      ),
      Expanded(child: _loading ? const Center(child: CircularProgressIndicator())
          : _filtered.isEmpty ? const Center(child: Text('لا توجد منتجات'))
          : ListView.builder(itemCount: _filtered.length,
              itemBuilder: (_, i) => _tile(_filtered[i]))),
    ]),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => Navigator.push(context,
        MaterialPageRoute(builder: (_) => AddProductScreen(
            warehouse: widget.warehouse, categories: _cats)))
          .then((_) => _load()),
      icon: const Icon(Icons.add), label: const Text('منتج جديد'),
      backgroundColor: _kBlue, foregroundColor: Colors.white),
  );

  Widget _catChip(String? val, String label) {
    final sel = _selCat == val;
    return Padding(
      padding: const EdgeInsets.only(left: 6),
      child: FilterChip(
        label: Text(label, style: TextStyle(fontSize: 11,
            color: sel ? Colors.white : null, fontWeight: FontWeight.bold)),
        selected: sel,
        selectedColor: _kBlue,
        checkmarkColor: Colors.white,
        onSelected: (_) => setState(() => _selCat = val),
      ),
    );
  }

  Future<void> _manageCategories() async {
    await _safeSheet(context, (ctx, setSt) {
      return Directionality(
        textDirection: TextDirection.rtl,
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              const Text('التصنيفات', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, color: _kBlue),
                onPressed: () async {
                  await _addCategory(ctx);
                  if (ctx.mounted) setSt(() {});
                }),
            ]),
            if (_cats.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 20),
                  child: Text('لا توجد تصنيفات بعد', style: TextStyle(color: Colors.grey)))
            else
              ..._cats.map((c) => ListTile(
                dense: true,
                leading: const Icon(Icons.label_outline, color: _kBlue, size: 18),
                title: Text(c.name),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.red, size: 18),
                  onPressed: () async {
                    await SalesDataService.deleteCategory(c.id);
                    await _load();
                    if (ctx.mounted) setSt(() {});
                  }),
              )),
          ]),
        ),
      );
    });
  }

  Future<void> _addCategory(BuildContext parentCtx) async {
    final ctrl = TextEditingController();
    await _safeDialog(parentCtx, (ctx) => AlertDialog(
      title: const Text('تصنيف جديد'),
      content: TextField(controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'اسم التصنيف', border: OutlineInputBorder())),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: _kBlue, foregroundColor: Colors.white),
          onPressed: () async {
            if (ctrl.text.trim().isEmpty) return;
            final uid = FirebaseAuth.instance.currentUser!.uid;
            await SalesDataService.addCategory(ProductCategory(
                id: '', name: ctrl.text.trim(),
                warehouseId: widget.warehouse.id, ownerUid: uid));
            await _load();
            if (ctx.mounted) Navigator.pop(ctx);
          }, child: const Text('إضافة')),
      ],
    ));
  }
  Widget _tile(Product p) => Card(
    margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    child: ListTile(
      leading: const Icon(Icons.inventory_2, color: _kBlue),
      title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text('${p.barcode ?? "بلا باركود"} • كمية: ${p.quantity}'),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(p.sellPrice.toStringAsFixed(2),
            style: const TextStyle(fontWeight: FontWeight.bold, color: _kBlue)),
        IconButton(icon: const Icon(Icons.edit, size: 18), onPressed: () => _edit(p)),
        IconButton(icon: const Icon(Icons.delete, size: 18, color: Colors.red),
            onPressed: () => _delete(p)),
      ]),
    ),
  );
  Future<void> _edit(Product p) async {
    final nameC = TextEditingController(text: p.name);
    final sellC = TextEditingController(text: p.sellPrice.toString());
    final qtyC = TextEditingController(text: p.quantity.toString());
    await _safeDialog(context, (ctx) => AlertDialog(
      title: const Text('تعديل المنتج'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nameC, decoration: const InputDecoration(labelText: 'الاسم')),
        const SizedBox(height: 8),
        TextField(controller: sellC, keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'سعر البيع')),
        const SizedBox(height: 8),
        TextField(controller: qtyC, keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'الكمية')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('إلغاء')),
        ElevatedButton(onPressed: () async {
          await SalesDataService.updateProduct(p.id, {
            'name': nameC.text.trim(),
            'sellPrice': double.tryParse(sellC.text) ?? p.sellPrice,
            'quantity': double.tryParse(qtyC.text) ?? p.quantity});
          Navigator.of(ctx).pop();
          if (mounted) await _load();
        }, child: const Text('حفظ')),
      ],
    ));
  }
  Future<void> _delete(Product p) async {
    final ok = await _safeDialog<bool>(context, (ctx) => AlertDialog(
      title: const Text('حذف المنتج'),
      content: Text('حذف "${p.name}"؟'),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('إلغاء')),
        ElevatedButton(onPressed: () => Navigator.of(ctx).pop(true),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('حذف', style: TextStyle(color: Colors.white))),
      ],
    ));
    if (ok == true) { await SalesDataService.deleteProduct(p.id); await _load(); }
  }
}

// ─── Barcode Scanner ──────────────────────────
class BarcodeScannerScreen extends StatefulWidget {
  final String title;
  const BarcodeScannerScreen({super.key, this.title = 'مسح الباركود'});
  @override State<BarcodeScannerScreen> createState() => _BarcodeScannerScreenState();
}
class _BarcodeScannerScreenState extends State<BarcodeScannerScreen> {
  final MobileScannerController _ctrl = MobileScannerController();
  bool _scanned = false, _torchOn = false;
  @override void dispose() { _ctrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title),
        backgroundColor: _kBlue, foregroundColor: Colors.white,
        actions: [
          IconButton(icon: Icon(_torchOn ? Icons.flash_off : Icons.flash_on),
              onPressed: () { _ctrl.toggleTorch(); setState(() => _torchOn = !_torchOn); }),
          IconButton(icon: const Icon(Icons.cameraswitch), onPressed: () => _ctrl.switchCamera()),
        ]),
    body: Stack(children: [
      MobileScanner(controller: _ctrl, onDetect: (cap) {
        if (_scanned) return;
        final barcodes = cap.barcodes;
        if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
          _scanned = true;
          Navigator.of(context).pop(barcodes.first.rawValue!);
        }
      }),
      Center(child: Container(width: 260, height: 260,
        decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 2),
            borderRadius: BorderRadius.circular(16)))),
      Positioned(bottom: 40, left: 0, right: 0,
        child: Center(child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
          child: const Text('وجّه الكاميرا نحو الباركود',
              style: TextStyle(color: Colors.white, fontSize: 14))))),
    ]),
  );
}

Future<String?> scanBarcode(BuildContext context, {String title = 'مسح الباركود'}) async {
  return await Navigator.push<String>(context,
    MaterialPageRoute(builder: (_) => BarcodeScannerScreen(title: title)));
}

// ─── Add Product ──────────────────────────────
class AddProductScreen extends StatefulWidget {
  final Warehouse warehouse;
  final List<ProductCategory> categories;
  const AddProductScreen({super.key, required this.warehouse, this.categories = const []});
  @override State<AddProductScreen> createState() => _AddProductState();
}
class _AddProductState extends State<AddProductScreen> {
  final _name = TextEditingController(); final _barcode = TextEditingController();
  final _cost = TextEditingController();
  final _sell = TextEditingController(); final _qty = TextEditingController();
  final _vat = TextEditingController();
  bool _trackExpiry = false; DateTime? _expiry; bool _saving = false; String? _err;
  String? _selCat;
  late List<ProductCategory> _cats;

  @override
  void initState() { super.initState(); _cats = List.from(widget.categories); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('منتج جديد'),
        backgroundColor: _kBlue, foregroundColor: Colors.white),
    body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
      if (_err != null) Container(margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
        child: Text(_err!, style: const TextStyle(color: Colors.red))),
      _f('الاسم *', _name),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: _f('الباركود', _barcode, type: TextInputType.number)),
        const SizedBox(width: 8),
        Container(
          decoration: BoxDecoration(color: _kBlue, borderRadius: BorderRadius.circular(8)),
          child: IconButton(
            icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
            onPressed: () async {
              final result = await scanBarcode(context, title: 'مسح باركود المنتج');
              if (result != null && mounted) setState(() => _barcode.text = result);
            })),
      ]),
      const SizedBox(height: 10),
      // ── التصنيف بـ Dropdown + زر إنشاء ──
      Row(children: [
        Expanded(
          child: DropdownButtonFormField<String>(
            value: _selCat,
            decoration: InputDecoration(
              labelText: 'التصنيف',
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              prefixIcon: const Icon(Icons.label_outline, size: 18),
            ),
            items: [
              const DropdownMenuItem(value: null, child: Text('بدون تصنيف')),
              ..._cats.map((c) => DropdownMenuItem(value: c.name, child: Text(c.name))),
            ],
            onChanged: (v) => setState(() => _selCat = v),
          ),
        ),
        const SizedBox(width: 8),
        Tooltip(
          message: 'إنشاء تصنيف جديد',
          child: Container(
            decoration: BoxDecoration(color: _kBlue, borderRadius: BorderRadius.circular(8)),
            child: IconButton(
              icon: const Icon(Icons.add, color: Colors.white),
              onPressed: _createCategory,
            )),
        ),
      ]),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: _f('سعر التكلفة', _cost, type: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: _f('سعر البيع', _sell, type: TextInputType.number)),
      ]),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: _f('الكمية', _qty, type: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: _f('الضريبة %', _vat, type: TextInputType.number)),
      ]),
      const SizedBox(height: 10),
      CheckboxListTile(value: _trackExpiry, onChanged: (v) => setState(() => _trackExpiry = v!),
        title: const Text('تتبع تاريخ الانتهاء'),
        controlAffinity: ListTileControlAffinity.leading),
      if (_trackExpiry) ListTile(
        title: Text(_expiry == null ? 'اختر تاريخ الانتهاء'
            : DateFormat('dd/MM/yyyy').format(_expiry!)),
        leading: const Icon(Icons.calendar_today),
        tileColor: Colors.grey.shade100,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        onTap: () async {
          final d = await showDatePicker(context: context,
            initialDate: DateTime.now().add(const Duration(days: 30)),
            firstDate: DateTime.now(), lastDate: DateTime(2100));
          if (d != null) setState(() => _expiry = d);
        }),
      const SizedBox(height: 20),
      SizedBox(width: double.infinity, child: ElevatedButton(
        onPressed: _saving ? null : _save,
        style: ElevatedButton.styleFrom(backgroundColor: _kBlue, foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14)),
        child: _saving ? const CircularProgressIndicator(color: Colors.white)
            : const Text('حفظ المنتج', style: TextStyle(fontSize: 16)))),
    ])),
  );

  Widget _f(String label, TextEditingController c, {TextInputType? type}) =>
    TextField(controller: c, keyboardType: type,
        decoration: InputDecoration(labelText: label,
            border: const OutlineInputBorder(), isDense: true));

  Future<void> _createCategory() async {
    final ctrl = TextEditingController();
    await _safeDialog(context, (ctx) => AlertDialog(
      title: const Text('تصنيف جديد'),
      content: TextField(controller: ctrl, autofocus: true,
          decoration: const InputDecoration(labelText: 'اسم التصنيف', border: OutlineInputBorder())),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: _kBlue, foregroundColor: Colors.white),
          onPressed: () async {
            if (ctrl.text.trim().isEmpty) return;
            final uid = FirebaseAuth.instance.currentUser!.uid;
            final id = await SalesDataService.addCategory(ProductCategory(
                id: '', name: ctrl.text.trim(),
                warehouseId: widget.warehouse.id, ownerUid: uid));
            final newCat = ProductCategory(id: id, name: ctrl.text.trim(),
                warehouseId: widget.warehouse.id, ownerUid: uid);
            setState(() { _cats.add(newCat); _selCat = newCat.name; });
            if (ctx.mounted) Navigator.pop(ctx);
          }, child: const Text('إنشاء')),
      ],
    ));
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) { setState(() => _err = 'الاسم مطلوب'); return; }
    final bc = _barcode.text.trim();
    if (bc.isNotEmpty) {
      final exists = await SalesDataService.barcodeExists(bc, widget.warehouse.id);
      if (exists) { setState(() => _err = 'الباركود موجود مسبقاً'); return; }
    }
    setState(() { _saving = true; _err = null; });
    try {
      final uid = FirebaseAuth.instance.currentUser!.uid;
      await SalesDataService.addProduct(Product(
        id: '', name: _name.text.trim(), warehouseId: widget.warehouse.id,
        ownerUid: uid, barcode: bc.isEmpty ? null : bc,
        category: _selCat,
        costPrice: double.tryParse(_cost.text) ?? 0,
        sellPrice: double.tryParse(_sell.text) ?? 0,
        quantity: double.tryParse(_qty.text) ?? 0,
        vatRate: double.tryParse(_vat.text) ?? 0,
        trackExpiry: _trackExpiry, expiryDate: _expiry));
      if (mounted) Navigator.pop(context);
    } catch (e) { setState(() => _err = e.toString()); }
    finally { if (mounted) setState(() => _saving = false); }
  }
}

// ─── Products Tab ─────────────────────────────
class _ProductsTab extends StatefulWidget {
  const _ProductsTab();
  @override State<_ProductsTab> createState() => _ProductsTabState();
}
class _ProductsTabState extends State<_ProductsTab> {
  List<Product> _list = []; bool _loading = true; String _q = '';
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _sub = SalesDataService.watchProducts().listen((list) {
      if (mounted) setState(() { _list = list; _loading = false; });
    });
  }

  @override
  void dispose() { _sub?.cancel(); super.dispose(); }

  Future<void> _load() async {} // no-op
  List<Product> get _filtered => _list.where((p) =>
    p.name.contains(_q) || (p.barcode ?? '').contains(_q)).toList();
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Column(children: [
      Padding(padding: const EdgeInsets.all(10),
        child: TextField(
          decoration: const InputDecoration(hintText: 'بحث...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(), isDense: true),
          onChanged: (v) => setState(() => _q = v))),
      Expanded(child: _filtered.isEmpty
          ? const Center(child: Text('لا توجد منتجات'))
          : ListView.builder(itemCount: _filtered.length,
              itemBuilder: (_, i) {
                final p = _filtered[i];
                return Card(margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  child: ListTile(
                    leading: const Icon(Icons.inventory_2, color: _kBlue),
                    title: Text(p.name),
                    subtitle: Text('${p.category ?? ""} • كمية: ${p.quantity}'),
                    trailing: Text(p.sellPrice.toStringAsFixed(2),
                        style: const TextStyle(fontWeight: FontWeight.bold))));
              })),
    ]);
  }
}

// ─── Employees Tab ────────────────────────────
class _EmployeesTab extends StatefulWidget {
  const _EmployeesTab();
  @override State<_EmployeesTab> createState() => _EmployeesTabState();
}
class _EmployeesTabState extends State<_EmployeesTab> {
  List<SalesUser> _list = []; bool _loading = true;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    final e = await SalesDataService.getEmployees();
    if (mounted) setState(() { _list = e; _loading = false; });
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Scaffold(
      body: _list.isEmpty ? const Center(child: Text('لا يوجد موظفون'))
          : ListView.builder(padding: const EdgeInsets.all(12),
              itemCount: _list.length,
              itemBuilder: (_, i) => _tile(_list[i])),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add, icon: const Icon(Icons.person_add),
        label: const Text('موظف جديد'),
        backgroundColor: _kBlue, foregroundColor: Colors.white),
    );
  }
  Widget _tile(SalesUser e) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      leading: CircleAvatar(backgroundColor: _kBlue,
          child: Text(e.name.isNotEmpty ? e.name[0] : '؟',
              style: const TextStyle(color: Colors.white))),
      title: Text(e.name, style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text(e.email),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(e.role == UserRole.manager ? 'مدير' : 'كاشير',
            style: const TextStyle(color: _kBlue, fontSize: 12)),
        IconButton(icon: const Icon(Icons.edit, size: 18), onPressed: () => _edit(e)),
        IconButton(icon: const Icon(Icons.delete, size: 18, color: Colors.red),
            onPressed: () => _delete(e)),
      ]),
    ),
  );
  Future<void> _add() async {
    final nameC = TextEditingController();
    final emailC = TextEditingController();
    final passC = TextEditingController();
    final phoneC = TextEditingController();
    var role = UserRole.cashier;
    final branches = await SalesDataService.getBranches();
    List<CashRegister> regs = [];
    String? selBranch, selReg;
    String? errMsg;

    await _safeSheet(context, (ctx, setSt) => SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('موظف جديد', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        if (errMsg != null) Container(
          padding: const EdgeInsets.all(8),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
          child: Text(errMsg!, style: const TextStyle(color: Colors.red))),
        TextField(controller: nameC,
            decoration: const InputDecoration(labelText: 'الاسم *', border: OutlineInputBorder())),
        const SizedBox(height: 10),
        TextField(controller: emailC, keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'الإيميل *', border: OutlineInputBorder())),
        const SizedBox(height: 10),
        TextField(controller: passC, obscureText: true,
            decoration: const InputDecoration(labelText: 'كلمة المرور *', border: OutlineInputBorder())),
        const SizedBox(height: 10),
        TextField(controller: phoneC, keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'رقم الهاتف', border: OutlineInputBorder())),
        const SizedBox(height: 10),
        DropdownButtonFormField<UserRole>(value: role,
          decoration: const InputDecoration(labelText: 'الدور', border: OutlineInputBorder()),
          items: const [
            DropdownMenuItem(value: UserRole.cashier, child: Text('كاشير')),
            DropdownMenuItem(value: UserRole.manager, child: Text('مدير')),
          ],
          onChanged: (v) => setSt(() => role = v!)),
        const SizedBox(height: 10),
        if (branches.isNotEmpty) DropdownButtonFormField<String>(value: selBranch,
          decoration: const InputDecoration(labelText: 'الفرع', border: OutlineInputBorder()),
          items: branches.map((b) => DropdownMenuItem(value: b.id, child: Text(b.name))).toList(),
          onChanged: (v) async {
            selBranch = v; selReg = null;
            regs = await SalesDataService.getCashRegisters(branchId: v);
            setSt(() {});
          }),
        if (regs.isNotEmpty) ...[
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(value: selReg,
            decoration: const InputDecoration(labelText: 'الصندوق', border: OutlineInputBorder()),
            items: regs.map((r) => DropdownMenuItem(value: r.id, child: Text(r.name))).toList(),
            onChanged: (v) => setSt(() => selReg = v)),
        ],
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: _kBlue, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14)),
          onPressed: () async {
            if (nameC.text.trim().isEmpty || emailC.text.trim().isEmpty || passC.text.isEmpty) {
              setSt(() => errMsg = 'يرجى ملء الحقول المطلوبة');
              return;
            }
            try {
              final ownerAuth = FirebaseAuth.instance.currentUser!;
              final cred = await FirebaseAuth.instance
                  .createUserWithEmailAndPassword(
                  email: emailC.text.trim(), password: passC.text);
              await cred.user?.updateDisplayName(nameC.text.trim());
              final ownerUid = ownerAuth.uid;
              final empUid = cred.user!.uid;
              await SalesDataService.addEmployee(SalesUser(
                uid: empUid, name: nameC.text.trim(),
                email: emailC.text.trim(), role: role,
                branchId: selBranch, cashRegisterId: selReg,
                ownerUid: ownerUid, phone: phoneC.text.trim()));
              await FirebaseDatabase.instance
                  .ref('employeeOwnerMap/$empUid').set(ownerUid);
              if (ctx.mounted) Navigator.of(ctx).pop();
              if (mounted) await _load();
            } on FirebaseAuthException catch (e) {
              setSt(() => errMsg = _authErr(e.code));
            } catch (e) {
              setSt(() => errMsg = e.toString());
            }
          },
          child: const Text('إنشاء الحساب'))),
      ]),
    ));
  }
  String _authErr(String code) {
    switch (code) {
      case 'email-already-in-use': return 'الإيميل مستخدم مسبقاً';
      case 'weak-password': return 'كلمة المرور ضعيفة';
      case 'invalid-email': return 'إيميل غير صحيح';
      default: return 'خطأ: $code';
    }
  }
  Future<void> _edit(SalesUser e) async {
    final nameC = TextEditingController(text: e.name);
    await _safeDialog(context, (ctx) => AlertDialog(
      title: const Text('تعديل الموظف'),
      content: TextField(controller: nameC, decoration: const InputDecoration(labelText: 'الاسم')),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('إلغاء')),
        ElevatedButton(onPressed: () async {
          await SalesDataService.updateEmployee(e.uid, {'name': nameC.text.trim()});
          Navigator.of(ctx).pop();
          if (mounted) await _load();
        }, child: const Text('حفظ')),
      ],
    ));
  }
  Future<void> _delete(SalesUser e) async {
    final ok = await _safeDialog<bool>(context, (ctx) => AlertDialog(
      title: const Text('حذف الموظف'),
      content: Text('حذف "${e.name}"؟'),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('إلغاء')),
        ElevatedButton(onPressed: () => Navigator.of(ctx).pop(true),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('حذف', style: TextStyle(color: Colors.white))),
      ],
    ));
    if (ok == true) { await SalesDataService.removeEmployee(e.uid); await _load(); }
  }
}

// ─── Reports Tab ──────────────────────────────
class _ReportsTab extends StatefulWidget {
  final SalesSettings settings;
  const _ReportsTab({this.settings = const SalesSettings()});
  @override State<_ReportsTab> createState() => _ReportsTabState();
}
class _ReportsTabState extends State<_ReportsTab> {
  List<Invoice> _allInv = []; // كل الفواتير المغلقة من الـ stream
  bool _loading = true;
  DateTime _from = DateTime.now().subtract(const Duration(days: 30));
  DateTime _to = DateTime.now();
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _sub = SalesDataService.watchInvoices().listen((list) {
      if (mounted) setState(() {
        _allInv = list.where((i) => i.status == InvoiceStatus.closed).toList();
        _loading = false;
      });
    });
  }

  @override
  void dispose() { _sub?.cancel(); super.dispose(); }

  // فلترة بالتاريخ المحلية (لا تحتاج network call)
  List<Invoice> get _inv => _allInv.where((i) =>
    !i.createdAt.isBefore(_from) &&
    !i.createdAt.isAfter(_to.add(const Duration(days: 1)))).toList();

  Future<void> _load() async {} // no-op
  double get _total => _inv.fold(0, (s, i) => s + i.totalRounded);
  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [
        Expanded(child: _dateBtn('من', _from, (d) { setState(() => _from = d); })),
        const SizedBox(width: 8),
        Expanded(child: _dateBtn('إلى', _to, (d) { setState(() => _to = d); })),
      ]),
      const SizedBox(height: 16),
      if (_loading) const Center(child: CircularProgressIndicator())
      else ...[
        Card(color: _kBlue, child: Padding(padding: const EdgeInsets.all(16),
          child: Column(children: [
            Text('إجمالي الإيرادات', style: const TextStyle(color: Colors.white70)),
            Text('${_total.toStringAsFixed(2)} ${currencySymbol(widget.settings.currency)}',
                style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
          ]))),
        const SizedBox(height: 10),
        Card(child: ListTile(
          leading: const Icon(Icons.receipt_long, color: _kBlue),
          title: const Text('عدد الفواتير'),
          trailing: Text('${_inv.length}',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)))),
        const SizedBox(height: 16),
        // زر التقارير المتقدمة
        InkWell(
          onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => AdvancedReportsScreen(
                  currency: widget.settings.currency,
                  companyName: widget.settings.companyName))),
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF021B79), Color(0xFF0575E6)]),
              borderRadius: BorderRadius.circular(14)),
            child: const Row(children: [
              Icon(Icons.bar_chart_outlined, color: Colors.white),
              SizedBox(width: 10),
              Expanded(child: Text('التقارير والإحصائيات المتقدمة',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
              Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 14),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        ..._inv.map((inv) => Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: Container(
              width: 42, height: 42,
              decoration: BoxDecoration(color: _kBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.receipt, color: _kBlue, size: 20)),
            title: Text(inv.number, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(DateFormat('dd/MM/yyyy hh:mm a').format(inv.createdAt)),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('${inv.totalRounded.toStringAsFixed(2)} ${currencySymbol(widget.settings.currency)}',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: _kBlue)),
              const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
            ]),
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => InvoiceDetailScreen(
                invoice: inv,
                companyName: widget.settings.companyName,
                currency: widget.settings.currency,
                cashierName: inv.createdByName,
                companyPhone: widget.settings.companyPhone,
                companyAddress: widget.settings.companyAddress,
                companyEmail: widget.settings.companyEmail,
              ))),
          ))),
      ],
    ]);
  }
  Widget _dateBtn(String label, DateTime date, Function(DateTime) onPick) =>
    OutlinedButton.icon(
      icon: const Icon(Icons.calendar_today, size: 14),
      label: Text('$label: ${DateFormat("dd/MM").format(date)}'),
      onPressed: () async {
        final d = await showDatePicker(context: context,
          initialDate: date, firstDate: DateTime(2020), lastDate: DateTime.now());
        if (d != null) onPick(d);
      });
}

// ─── Settings Tab ─────────────────────────────
class _SettingsTab extends StatefulWidget {
  final SalesSettings settings;
  final String ownerUid;
  final void Function(SalesSettings) onSaved;
  const _SettingsTab({required this.settings, required this.ownerUid, required this.onSaved});
  @override State<_SettingsTab> createState() => _SettingsTabState();
}
class _SettingsTabState extends State<_SettingsTab> {
  late TextEditingController _nameCtrl, _phoneCtrl, _addressCtrl, _emailCtrl;
  late String _selectedCurrency;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl    = TextEditingController(text: widget.settings.companyName);
    _phoneCtrl   = TextEditingController(text: widget.settings.companyPhone);
    _addressCtrl = TextEditingController(text: widget.settings.companyAddress);
    _emailCtrl   = TextEditingController(text: widget.settings.companyEmail);
    _selectedCurrency = widget.settings.currency.isEmpty ? 'SAR' : widget.settings.currency;
  }
  @override void dispose() {
    _nameCtrl.dispose(); _phoneCtrl.dispose();
    _addressCtrl.dispose(); _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.rtl,
    child: ListView(padding: const EdgeInsets.all(20), children: [
      const SizedBox(height: 6),
      _sectionTitle('معلومات الشركة'),
      const SizedBox(height: 12),
      _field(_nameCtrl,    'اسم الشركة',        Icons.business_outlined),
      const SizedBox(height: 10),
      _field(_phoneCtrl,   'رقم الهاتف',         Icons.phone_outlined,
          type: TextInputType.phone),
      const SizedBox(height: 10),
      _field(_addressCtrl, 'العنوان',             Icons.location_on_outlined),
      const SizedBox(height: 10),
      _field(_emailCtrl,   'البريد الإلكتروني',  Icons.email_outlined,
          type: TextInputType.emailAddress),
      const SizedBox(height: 24),
      _sectionTitle('العملة الرئيسية'),
      const SizedBox(height: 12),
      // زر اختيار العملة
      InkWell(
        onTap: _pickCurrency,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            border: Border.all(color: _kBlue.withValues(alpha: 0.4)),
            borderRadius: BorderRadius.circular(12),
            color: _kBlue.withValues(alpha: 0.04),
          ),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: _kBlue,
                  borderRadius: BorderRadius.circular(10)),
              child: Center(child: Text(
                currencySymbol(_selectedCurrency),
                style: const TextStyle(color: Colors.white,
                    fontWeight: FontWeight.bold, fontSize: 14)))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(findCurrency(_selectedCurrency)?.name ?? _selectedCurrency,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              Text('${_selectedCurrency} • ${findCurrency(_selectedCurrency)?.country ?? ""}',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
            ])),
            const Icon(Icons.arrow_drop_down, color: _kBlue),
          ]),
        ),
      ),
      const SizedBox(height: 30),
      SizedBox(width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _saving ? null : _save,
          icon: _saving
              ? const SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Icon(Icons.save_outlined),
          label: const Text('حفظ الإعدادات',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          style: ElevatedButton.styleFrom(
            backgroundColor: _kBlue, foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        )),
    ]),
  );

  Widget _field(TextEditingController ctrl, String label, IconData icon,
      {TextInputType type = TextInputType.text}) =>
    TextField(
      controller: ctrl,
      keyboardType: type,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );

  Widget _sectionTitle(String t) => Text(t,
      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: _kBlue));

  Future<void> _pickCurrency() async {
    final result = await showCurrencyPicker(context, selected: _selectedCurrency);
    if (result != null && mounted) {
      setState(() => _selectedCurrency = result.code);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final s = SalesSettings(
      currency:       _selectedCurrency,
      companyName:    _nameCtrl.text.trim(),
      companyPhone:   _phoneCtrl.text.trim(),
      companyAddress: _addressCtrl.text.trim(),
      companyEmail:   _emailCtrl.text.trim(),
    );
    await SalesDataService.saveSettings(s);
    widget.onSaved(s);
    if (mounted) {
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم حفظ الإعدادات بنجاح'),
            backgroundColor: Colors.green, behavior: SnackBarBehavior.floating));
    }
  }
}

// ─── Activity Log Screen ──────────────────────
class ActivityLogScreen extends StatefulWidget {
  const ActivityLogScreen({super.key});
  @override State<ActivityLogScreen> createState() => _ALSState();
}
class _ALSState extends State<ActivityLogScreen> {
  List<Map> _logs = []; bool _loading = true;
  @override void initState() { super.initState();
    SalesDataService.getActivityLog().then((l) {
      if (mounted) setState(() { _logs = l; _loading = false; }); }); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('سجل النشاط'),
        backgroundColor: _kBlue, foregroundColor: Colors.white),
    body: _loading ? const Center(child: CircularProgressIndicator())
        : ListView.builder(itemCount: _logs.length,
            itemBuilder: (_, i) {
              final log = _logs[i];
              final at = DateTime.tryParse(log['at'] ?? '') ?? DateTime.now();
              return ListTile(
                leading: const CircleAvatar(backgroundColor: _kBlue,
                    child: Icon(Icons.history, color: Colors.white, size: 16)),
                title: Text(log['action'] ?? ''),
                subtitle: Text('${log["byName"]} • ${DateFormat("dd/MM/yyyy hh:mm a").format(at)}'));
            }),
  );
}

// ════════════════════════════════════════════════════════════════════
//  SalesCashierScreen — محدَّث: زر الخروج في كل الحالات
// ════════════════════════════════════════════════════════════════════
class SalesCashierScreen extends StatefulWidget {
  final SalesUser user;
  const SalesCashierScreen({super.key, required this.user});
  @override State<SalesCashierScreen> createState() => _CashierState();
}

class _CashierState extends State<SalesCashierScreen> {
  CashRegister? _reg;
  bool _loading = true, _sessionOpen = false;
  List<Product> _products = [];
  List<Warehouse> _warehouses = [];
  final List<List<InvoiceItem>> _invs = [[]];
  int _active = 0;
  String _currency = 'SAR';
  StreamSubscription? _setSub, _prodSub, _whSub, _crSub;

  @override
  void initState() {
    super.initState();
    // ── عملة ─────────────────────────────────────
    _setSub = SalesDataService.watchSettings().listen((s) {
      if (mounted) setState(() => _currency = s.currency);
    });
    // ── مخازن الفرع (live) ────────────────────────
    _whSub = SalesDataService.watchWarehouses().listen((list) {
      final branchId = widget.user.branchId;
      final filtered = branchId != null
          ? list.where((w) => w.branchId == branchId).toList()
          : list;
      if (mounted) setState(() => _warehouses = filtered);
      // أعد فلترة المنتجات عند تغيّر المخازن
      _applyProductFilter();
    });
    // ── منتجات (live) ─────────────────────────────
    _prodSub = SalesDataService.watchProducts().listen((list) {
      if (mounted) setState(() {
        _loading = false;
      });
      _applyProductFilter(allProducts: list);
    });
    // ── صناديق (live) — لمتابعة حالة الجلسة ───────
    _crSub = SalesDataService.watchCashRegisters().listen((list) {
      final regId = widget.user.cashRegisterId;
      if (regId == null) { if (mounted) setState(() => _loading = false); return; }
      CashRegister? reg;
      try { reg = list.firstWhere((r) => r.id == regId); }
      catch (_) { reg = list.isNotEmpty ? list.first : null; }
      if (mounted) setState(() {
        _reg = reg;
        _sessionOpen = reg?.sessionOpen ?? false;
        _loading = false;
      });
    });
  }

  // منتجات مخزّنة خام للفلترة
  List<Product> _allProducts = [];
  void _applyProductFilter({List<Product>? allProducts}) {
    if (allProducts != null) _allProducts = allProducts;
    final whIds = _warehouses.map((w) => w.id).toSet();
    final filtered = _allProducts
        .where((p) => whIds.isEmpty || whIds.contains(p.warehouseId))
        .toList();
    if (mounted) setState(() => _products = filtered);
  }

  @override
  void dispose() {
    _setSub?.cancel(); _prodSub?.cancel();
    _whSub?.cancel();  _crSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {} // no-op — streams تحدث تلقائياً

  Future<void> _toggleSession() async {
    if (_reg == null) return;
    final nv = !_sessionOpen;
    await SalesDataService.setSessionOpen(_reg!.id, nv);
    setState(() => _sessionOpen = nv);
  }

  // ── تسجيل الخروج مع dialog تأكيد ──
  Future<void> _doLogout(BuildContext ctx) async {
    final ok = await _safeDialog<bool>(ctx, (dCtx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Row(children: [
        Icon(Icons.logout, color: Color(0xFF021B79)),
        SizedBox(width: 10),
        Text('تسجيل الخروج', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
      ]),
      content: const Text('هل تريد تسجيل الخروج؟'),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dCtx).pop(false),
          child: const Text('إلغاء')),
        ElevatedButton.icon(
          icon: const Icon(Icons.logout, color: Colors.white, size: 16),
          label: const Text('خروج', style: TextStyle(color: Colors.white)),
          style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
          onPressed: () => Navigator.of(dCtx).pop(true)),
      ],
    ));
    if (ok == true) await signOutAndGoToLogin();
  }

  @override
  Widget build(BuildContext context) {
    // ── تحميل ──
    if (_loading) {
      return Scaffold(
        backgroundColor: _kBlue,
        body: const Center(child: CircularProgressIndicator(color: Colors.white)));
    }

    // ── لا يوجد صندوق مُعيَّن ──
    if (_reg == null) {
      return Scaffold(
        backgroundColor: Colors.grey.shade50,
        appBar: AppBar(
          backgroundColor: _kBlue,
          foregroundColor: Colors.white,
          automaticallyImplyLeading: false,
          centerTitle: true,
          title: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('POS', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            Text(widget.user.name,
                style: const TextStyle(fontSize: 11, color: Colors.white70)),
          ]),
          actions: [
            IconButton(
              icon: const Icon(Icons.logout, color: Colors.white),
              tooltip: 'تسجيل الخروج',
              onPressed: () => _doLogout(context)),
          ]),
        body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.warning_amber_rounded, size: 72, color: Colors.orange),
          const SizedBox(height: 16),
          const Text('لم يتم تعيين صندوق لك',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('تواصل مع المدير لتعيين صندوق وفرع',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
          const SizedBox(height: 36),
          ElevatedButton.icon(
            icon: const Icon(Icons.logout, color: Colors.white),
            label: const Text('تسجيل الخروج', style: TextStyle(color: Colors.white)),
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            onPressed: () => _doLogout(context)),
        ])));
    }

    // ── الشاشة الرئيسية ──
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (_, __) {},
      child: Scaffold(
        backgroundColor: Colors.grey.shade100,
        appBar: AppBar(
          backgroundColor: _kBlue,
          foregroundColor: Colors.white,
          automaticallyImplyLeading: false,
          centerTitle: true,
          title: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(_reg!.name,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            Text(widget.user.name,
                style: const TextStyle(fontSize: 11, color: Colors.white70)),
          ]),
          actions: [
            if (_invs.length > 1) Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(child: Text('${_invs.length}/5',
                  style: const TextStyle(fontSize: 11)))),
            IconButton(
              icon: Icon(_sessionOpen ? Icons.lock_open : Icons.lock),
              tooltip: _sessionOpen ? 'إغلاق الجلسة' : 'فتح الجلسة',
              onPressed: _toggleSession),
            // ── زر تسجيل الخروج — دائم الظهور ──
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'تسجيل الخروج',
              onPressed: () => _doLogout(context)),
          ]),
        body: _sessionOpen ? _pos() : _closed()));
  }

  Widget _closed() => Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
    const Icon(Icons.lock, size: 80, color: Colors.grey),
    const SizedBox(height: 16),
    const Text('الجلسة مغلقة', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
    const SizedBox(height: 8),
    Text(_reg!.name, style: TextStyle(color: Colors.grey.shade600)),
    const SizedBox(height: 32),
    ElevatedButton.icon(
      icon: const Icon(Icons.play_arrow), label: const Text('فتح جلسة POS'),
      style: ElevatedButton.styleFrom(backgroundColor: _kBlue, foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16)),
      onPressed: _toggleSession),
  ]));

  Widget _pos() => Column(children: [
    if (_invs.length > 1) Container(
      height: 44, color: Colors.white,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        itemCount: _invs.length + (_invs.length < 5 ? 1 : 0),
        itemBuilder: (_, i) {
          if (i == _invs.length) {
            return GestureDetector(onTap: _newInvoice,
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(border: Border.all(color: _kBlue),
                    borderRadius: BorderRadius.circular(20)),
                alignment: Alignment.center,
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.add, size: 14, color: _kBlue),
                  SizedBox(width: 4),
                  Text('جديدة', style: TextStyle(color: _kBlue, fontSize: 12))])));
          }
          final sel = _active == i;
          return GestureDetector(onTap: () => setState(() => _active = i),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: sel ? _kBlue : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(20)),
              alignment: Alignment.center,
              child: Text('فاتورة ${i + 1} (${_invs[i].length})',
                  style: TextStyle(color: sel ? Colors.white : Colors.grey.shade700,
                      fontSize: 12, fontWeight: FontWeight.bold))));
        }),
    ),
    Expanded(child: _POSMainView(
      items: _invs[_active],
      products: _products,
      branchId: widget.user.branchId ?? '',
      onItemsChanged: (items) => setState(() => _invs[_active] = items),
      onCheckout: _checkout,
      onNewInvoice: _invs.length < 5 ? _newInvoice : null,
    )),
  ]);

  void _newInvoice() {
    if (_invs.length >= 5) return;
    setState(() { _invs.add([]); _active = _invs.length - 1; });
  }

  Future<void> _checkout() async {
    final items = List<InvoiceItem>.from(_invs[_active]);
    if (items.isEmpty) return;
    await Navigator.push(context, MaterialPageRoute(
      builder: (_) => CheckoutScreen(
        items: items, branchId: widget.user.branchId ?? '',
        cashRegisterId: _reg?.id ?? '',
        createdByUid: widget.user.uid,
        createdByName: widget.user.name,
        ownerUid: widget.user.ownerUid ?? widget.user.uid,
        currency: _currency)));
    if (mounted) {
      setState(() {
        _invs[_active] = [];
        if (_invs.length > 1) { _invs.removeAt(_active); _active = 0; }
      });
    }
  }
}

// ─── POS Main View ────────────────────────────
enum _POSView { camera, review }

class _POSMainView extends StatefulWidget {
  final List<InvoiceItem> items;
  final List<Product> products;
  final String branchId;
  final ValueChanged<List<InvoiceItem>> onItemsChanged;
  final VoidCallback onCheckout;
  final VoidCallback? onNewInvoice;
  const _POSMainView({required this.items, required this.products,
    required this.branchId, required this.onItemsChanged,
    required this.onCheckout, this.onNewInvoice});
  @override State<_POSMainView> createState() => _POSMainViewState();
}

class _POSMainViewState extends State<_POSMainView> {
  _POSView _view = _POSView.camera;
  late final MobileScannerController _cam;
  bool _torchOn = false, _busy = false;
  String? _toast;

  @override
  void initState() {
    super.initState();
    _cam = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  }

  @override void dispose() { _cam.dispose(); super.dispose(); }

  void _onDetect(BarcodeCapture cap) async {
    if (_busy) return;
    final raw = cap.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;
    _busy = true;
    final found = widget.products.where((p) => p.barcode == raw).toList();
    if (found.isNotEmpty) {
      final p = found.first;
      final items = List<InvoiceItem>.from(widget.items);
      final idx = items.indexWhere((i) => i.productId == p.id);
      if (idx >= 0) { items[idx].quantity += 1; }
      else { items.add(InvoiceItem(productId: p.id, productName: p.name,
          quantity: 1, unitPrice: p.priceForBranch(widget.branchId),
          vatRate: p.vatRate, barcode: p.barcode)); }
      widget.onItemsChanged(items);
      _showToast(p.name, true);
    } else {
      _showToast('غير موجود: $raw', false);
    }
    await Future.delayed(const Duration(milliseconds: 700));
    _busy = false;
  }

  void _showToast(String msg, bool ok) {
    setState(() => _toast = (ok ? '+ ' : '! ') + msg);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _toast = null);
    });
  }

  void _addManual() async {
    await showModalBottomSheet(context: context, isScrollControlled: true,
      useRootNavigator: true,
      builder: (_) => _ProductSearch(
        products: widget.products, branchId: widget.branchId,
        onSelect: (p) {
          final items = List<InvoiceItem>.from(widget.items);
          final idx = items.indexWhere((i) => i.productId == p.id);
          if (idx >= 0) { items[idx].quantity += 1; }
          else { items.add(InvoiceItem(productId: p.id, productName: p.name,
              quantity: 1, unitPrice: p.priceForBranch(widget.branchId),
              vatRate: p.vatRate, barcode: p.barcode)); }
          widget.onItemsChanged(items);
        }));
  }

  @override
  Widget build(BuildContext context) =>
      _view == _POSView.camera ? _camView() : _reviewView();

  Widget _camView() {
    final total = widget.items.fold(0.0, (s, i) => s + i.total);
    final count = widget.items.fold(0.0, (s, i) => s + i.quantity).toInt();
    return Column(children: [
      Expanded(child: Stack(children: [
        MobileScanner(controller: _cam, onDetect: _onDetect),
        Center(child: Container(width: 250, height: 160,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white, width: 2.5),
            borderRadius: BorderRadius.circular(12)))),
        Positioned(top: 12, right: 12, child: Column(children: [
          _camBtn(Icons.flash_on, _torchOn ? Colors.yellow : Colors.white, () {
            _cam.toggleTorch(); setState(() => _torchOn = !_torchOn); }),
          const SizedBox(height: 8),
          _camBtn(Icons.cameraswitch, Colors.white, () => _cam.switchCamera()),
          const SizedBox(height: 8),
          _camBtn(Icons.keyboard, Colors.white, _addManual),
        ])),
        if (_toast != null) Positioned(bottom: 12, left: 12, right: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: _toast!.startsWith('+') ? Colors.green.shade800 : Colors.orange.shade800,
              borderRadius: BorderRadius.circular(24)),
            child: Text(_toast!, textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)))),
      ])),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: Colors.white,
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$count منتج • ${total.toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: _kBlue)),
            const Text('مرر المنتجات أمام الكاميرا',
                style: TextStyle(fontSize: 11, color: Colors.grey)),
          ])),
          ElevatedButton.icon(
            icon: const Icon(Icons.receipt_long),
            label: Text(widget.items.isEmpty ? 'فاتورة' : 'مراجعة (${widget.items.length})'),
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.items.isEmpty ? Colors.grey : _kBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            onPressed: () => setState(() => _view = _POSView.review)),
        ])),
    ]);
  }

  Widget _camBtn(IconData icon, Color color, VoidCallback fn) => GestureDetector(
    onTap: fn,
    child: Container(padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(8)),
      child: Icon(icon, color: color, size: 22)));

  Widget _reviewView() {
    final total = widget.items.fold(0.0, (s, i) => s + i.total);
    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        backgroundColor: Colors.white, foregroundColor: _kBlue, elevation: 0,
        title: const Text('مراجعة الفاتورة',
            style: TextStyle(fontWeight: FontWeight.bold, color: _kBlue)),
        leading: IconButton(icon: const Icon(Icons.camera_alt),
            tooltip: 'العودة للكاميرا',
            onPressed: () => setState(() => _view = _POSView.camera)),
        actions: [
          if (widget.onNewInvoice != null)
            IconButton(icon: const Icon(Icons.add_circle_outline),
                onPressed: widget.onNewInvoice),
        ]),
      body: widget.items.isEmpty
          ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.receipt_outlined, size: 72, color: Colors.grey),
              const SizedBox(height: 12),
              const Text('الفاتورة فارغة', style: TextStyle(fontSize: 18, color: Colors.grey)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.camera_alt), label: const Text('ابدأ المسح'),
                style: ElevatedButton.styleFrom(backgroundColor: _kBlue, foregroundColor: Colors.white),
                onPressed: () => setState(() => _view = _POSView.camera))]))
          : ListView.builder(padding: const EdgeInsets.all(12),
              itemCount: widget.items.length,
              itemBuilder: (_, i) => _invTile(i)),
      bottomNavigationBar: widget.items.isEmpty ? null : Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 8, offset: const Offset(0, -2))]),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('الإجمالي:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(total.toStringAsFixed(2),
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: _kBlue)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton.icon(
              icon: const Icon(Icons.camera_alt), label: const Text('إضافة'),
              style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12),
                  side: const BorderSide(color: _kBlue)),
              onPressed: () => setState(() => _view = _POSView.camera))),
            const SizedBox(width: 10),
            Expanded(child: ElevatedButton.icon(
              icon: const Icon(Icons.payment), label: const Text('الدفع'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF27AE60), foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12)),
              onPressed: widget.onCheckout)),
          ]),
        ])),
    );
  }

  Widget _invTile(int i) {
    final item = widget.items[i];
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(children: [
          CircleAvatar(radius: 16, backgroundColor: _kBlue.withValues(alpha: 0.1),
              child: Text('${i+1}', style: const TextStyle(color: _kBlue, fontSize: 12, fontWeight: FontWeight.bold))),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.productName, style: const TextStyle(fontWeight: FontWeight.bold)),
            Text('${item.unitPrice.toStringAsFixed(2)} × ${item.quantity.toInt()}',
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ])),
          Text(item.total.toStringAsFixed(2),
              style: const TextStyle(fontWeight: FontWeight.bold, color: _kBlue)),
          const SizedBox(width: 8),
          Row(mainAxisSize: MainAxisSize.min, children: [
            InkWell(onTap: () {
              final items = List<InvoiceItem>.from(widget.items);
              if (items[i].quantity > 1) { items[i].quantity -= 1; }
              else { items.removeAt(i); }
              widget.onItemsChanged(items);
            }, child: Icon(Icons.remove_circle_outline,
                color: item.quantity > 1 ? _kBlue : Colors.red, size: 22)),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text('${item.quantity.toInt()}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
            InkWell(onTap: () {
              final items = List<InvoiceItem>.from(widget.items);
              items[i].quantity += 1;
              widget.onItemsChanged(items);
            }, child: const Icon(Icons.add_circle_outline, color: _kBlue, size: 22)),
            const SizedBox(width: 4),
            InkWell(onTap: () {
              final items = List<InvoiceItem>.from(widget.items);
              items.removeAt(i);
              widget.onItemsChanged(items);
            }, child: const Icon(Icons.delete_outline, color: Colors.red, size: 20)),
          ]),
        ])));
  }
}

// ─── Product Search ───────────────────────────
class _ProductSearch extends StatefulWidget {
  final List<Product> products; final String branchId;
  final Function(Product) onSelect;
  const _ProductSearch({required this.products, required this.branchId, required this.onSelect});
  @override State<_ProductSearch> createState() => _PSState();
}
class _PSState extends State<_ProductSearch> {
  String _q = '';
  List<Product> get _f => widget.products.where((p) =>
    p.name.contains(_q) || (p.barcode ?? '').contains(_q)).toList();
  @override
  Widget build(BuildContext context) => DraggableScrollableSheet(
    expand: false, initialChildSize: 0.7, maxChildSize: 0.95,
    builder: (_, ctrl) => Column(children: [
      const SizedBox(height: 8),
      Container(width: 40, height: 4,
          decoration: BoxDecoration(color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2))),
      const SizedBox(height: 12),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 16),
        child: TextField(autofocus: true,
          decoration: const InputDecoration(hintText: 'بحث...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(), isDense: true),
          onChanged: (v) => setState(() => _q = v))),
      const SizedBox(height: 8),
      Expanded(child: ListView.builder(controller: ctrl,
        itemCount: _f.length,
        itemBuilder: (_, i) {
          final p = _f[i];
          return ListTile(
            title: Text(p.name),
            subtitle: Text(p.barcode ?? ''),
            trailing: Text(p.priceForBranch(widget.branchId).toStringAsFixed(2),
                style: const TextStyle(fontWeight: FontWeight.bold)),
            onTap: () { widget.onSelect(p); Navigator.of(context).pop(); });
        })),
    ]));
}

// ─── Checkout Screen ──────────────────────────
class CheckoutScreen extends StatefulWidget {
  final List<InvoiceItem> items;
  final String branchId, cashRegisterId, createdByUid, createdByName, ownerUid;
  final String currency;
  const CheckoutScreen({super.key, required this.items, required this.branchId,
    required this.cashRegisterId, required this.createdByUid,
    required this.createdByName, required this.ownerUid,
    this.currency = 'SAR'});
  @override State<CheckoutScreen> createState() => _COState();
}
class _COState extends State<CheckoutScreen> {
  PaymentMethod _method = PaymentMethod.cash;
  final _cash = TextEditingController();
  final _phone = TextEditingController(); final _cName = TextEditingController();
  final _bank = TextEditingController(); final _transfer = TextEditingController();
  final _disc = TextEditingController(text: '0');
  bool _saving = false;
  LoyaltySettings _loyaltySettings = const LoyaltySettings();
  double _loyaltyDiscount = 0;
  int _loyaltyRedeemPoints = 0;
  String _loyaltyPhone = '', _loyaltyName = '';

  @override
  void initState() {
    super.initState();
    LoyaltyService.getSettings(widget.ownerUid).then((s) {
      if (mounted) setState(() => _loyaltySettings = s);
    });
  }

  double get _sub => widget.items.fold(0, (s, i) => s + i.subtotal);
  double get _vat => widget.items.fold(0, (s, i) => s + i.vatAmount);
  double get _disc2 => (double.tryParse(_disc.text) ?? 0) + _loyaltyDiscount;
  double get _total => _sub + _vat - _disc2;
  double get _rounded {
    final f = _total - _total.floor();
    return f >= 0.5 ? _total.ceil().toDouble() : _total.floor().toDouble();
  }
  double get _paid => double.tryParse(_cash.text) ?? 0;
  double get _change => _paid - _rounded;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('الدفع'),
        backgroundColor: _kBlue, foregroundColor: Colors.white),
    body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
      Card(color: _kBlue, child: Padding(padding: const EdgeInsets.all(16),
        child: Column(children: [
          _row('المجموع الفرعي', _sub.toStringAsFixed(2)),
          if (_vat > 0) _row('الضريبة', _vat.toStringAsFixed(2)),
          if (_loyaltyDiscount > 0)
            _row('خصم النقاط', '-${_loyaltyDiscount.toStringAsFixed(2)}'),
          const Divider(color: Colors.white30),
          _row('الإجمالي المُجبر', _rounded.toStringAsFixed(2), big: true),
        ]))),
      const SizedBox(height: 12),
      TextField(controller: _disc, keyboardType: TextInputType.number,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'الخصم',
              border: OutlineInputBorder(), prefixIcon: Icon(Icons.discount))),
      const SizedBox(height: 12),
      // ── Loyalty Widget ──────────────────────────────────────────
      if (_loyaltySettings.enabled) ...[
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF0F4FF),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFDDE3F0)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Row(children: [
              Icon(Icons.card_giftcard_outlined, size: 16, color: Color(0xFF021B79)),
              SizedBox(width: 6),
              Text('نظام الولاء', style: TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF021B79))),
            ]),
            const SizedBox(height: 10),
            LoyaltyCustomerWidget(
              ownerUid: widget.ownerUid,
              settings: _loyaltySettings,
              invoiceTotal: _sub + _vat,
              onCustomerSelected: (phone, name, discount) {
                setState(() {
                  _loyaltyPhone = phone;
                  _loyaltyName = name;
                  _loyaltyDiscount = discount;
                  _loyaltyRedeemPoints = discount > 0
                      ? (discount / _loyaltySettings.pointValue).round() : 0;
                  if (_phone.text.isEmpty) _phone.text = phone;
                  if (_cName.text.isEmpty) _cName.text = name;
                });
              },
              onClear: () => setState(() {
                _loyaltyPhone = ''; _loyaltyName = '';
                _loyaltyDiscount = 0; _loyaltyRedeemPoints = 0;
              }),
            ),
          ]),
        ),
        const SizedBox(height: 12),
      ],
      // ── Payment Methods ──────────────────────────────────────────
      Row(children: [
        _mBtn('نقداً', Icons.money, PaymentMethod.cash),
        const SizedBox(width: 6),
        _mBtn('بطاقة', Icons.credit_card, PaymentMethod.card),
        const SizedBox(width: 6),
        _mBtn('تحويل', Icons.account_balance, PaymentMethod.transfer),
      ]),
      const SizedBox(height: 12),
      if (_method == PaymentMethod.cash) ...[
        TextField(controller: _cash, keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'المبلغ المدفوع',
                border: OutlineInputBorder(), prefixIcon: Icon(Icons.money))),
        const SizedBox(height: 8),
        if (_paid > 0 && _paid < _rounded) _msg('متبقي: ${(_rounded - _paid).toStringAsFixed(2)}', Colors.orange),
        if (_paid >= _rounded && _paid > 0) _msg('الباقي: ${_change.toStringAsFixed(2)}', Colors.green),
      ],
      if (_method == PaymentMethod.transfer) ...[
        const SizedBox(height: 8),
        TextField(controller: _cName,
            decoration: const InputDecoration(labelText: 'اسم العميل', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _transfer,
            decoration: const InputDecoration(labelText: 'اسم صاحب الحساب', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _bank,
            decoration: const InputDecoration(labelText: 'اسم البنك', border: OutlineInputBorder())),
      ],
      const SizedBox(height: 12),
      TextField(controller: _phone, keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'هاتف العميل (اختياري)',
              border: OutlineInputBorder(), prefixIcon: Icon(Icons.phone))),
      const SizedBox(height: 20),
      SizedBox(width: double.infinity, child: ElevatedButton(
        onPressed: _saving ? null : _confirm,
        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF27AE60),
            foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16)),
        child: _saving ? const CircularProgressIndicator(color: Colors.white)
            : const Text('إنشاء الفاتورة', style: TextStyle(fontSize: 16)))),
    ])),
  );
  Widget _row(String t, String v, {bool big = false}) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(t, style: TextStyle(color: Colors.white70, fontSize: big ? 14 : 12)),
      Text(v, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold,
          fontSize: big ? 22 : 14))]);
  Widget _mBtn(String label, IconData icon, PaymentMethod m) => Expanded(
    child: GestureDetector(onTap: () => setState(() => _method = m),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: _method == m ? _kBlue : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _method == m ? _kBlue : Colors.grey.shade300)),
        child: Column(children: [
          Icon(icon, color: _method == m ? Colors.white : Colors.grey),
          Text(label, style: TextStyle(fontSize: 11,
              color: _method == m ? Colors.white : Colors.grey,
              fontWeight: FontWeight.bold)),
        ]))));
  Widget _msg(String t, Color c) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: c.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8), border: Border.all(color: c)),
    child: Row(children: [
      Icon(Icons.info_outline, color: c, size: 18),
      const SizedBox(width: 8),
      Text(t, style: TextStyle(color: c, fontWeight: FontWeight.bold))]));
  Future<void> _confirm() async {
    setState(() => _saving = true);
    try {
      final seq = await SalesDataService.getNextSeq();
      final number = SalesDataService.makeNumber(seq, widget.cashRegisterId, widget.branchId);
      final phone = _loyaltyPhone.isNotEmpty ? _loyaltyPhone
          : (_phone.text.trim().isEmpty ? null : _phone.text.trim());
      final name  = _loyaltyName.isNotEmpty ? _loyaltyName
          : (_cName.text.trim().isEmpty ? null : _cName.text.trim());
      await SalesDataService.saveInvoice(Invoice(
        id: '', number: number,
        cashRegisterId: widget.cashRegisterId, branchId: widget.branchId,
        ownerUid: widget.ownerUid,
        createdByUid: widget.createdByUid,
        items: widget.items, paymentMethod: _method,
        status: InvoiceStatus.closed,
        amountPaid: _method == PaymentMethod.cash ? _paid : _rounded,
        discount: _disc2,
        customerPhone: phone,
        customerName: name,
        bankName: _bank.text.trim().isEmpty ? null : _bank.text.trim(),
        transferAccountName: _transfer.text.trim().isEmpty ? null : _transfer.text.trim(),
        createdAt: DateTime.now(), createdByName: widget.createdByName));
      for (final item in widget.items) {
        await SalesDataService.updateProductQuantity(item.productId, -item.quantity);
      }
      // ── نقاط الولاء: استبدال ثم كسب ──────────────────────────
      if (phone != null && _loyaltySettings.enabled) {
        if (_loyaltyRedeemPoints > 0) {
          try {
            await LoyaltyService.redeemPoints(
              ownerUid: widget.ownerUid, phone: phone,
              pointsToRedeem: _loyaltyRedeemPoints,
              invoiceTotal: _sub + _vat, settings: _loyaltySettings,
              invoiceId: number);
          } catch (_) {}
        }
        // كسب نقاط على المبلغ المدفوع الفعلي (بعد الخصم)
        final earnOn = (_sub + _vat - _loyaltyDiscount).clamp(0.0, double.infinity);
        await LoyaltyService.addPoints(
          ownerUid: widget.ownerUid, phone: phone,
          invoiceAmount: earnOn, invoiceId: number,
          settings: _loyaltySettings, customerName: name);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تم إنشاء الفاتورة: $number')));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('خطأ: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

// ─── Loyalty Tab (for owner) ──────────────────
class _LoyaltyTab extends StatelessWidget {
  final String ownerUid;
  const _LoyaltyTab({required this.ownerUid});

  @override
  Widget build(BuildContext context) => LoyaltyManagementScreen(ownerUid: ownerUid);
}
