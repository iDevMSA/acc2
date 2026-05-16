// lib/welcome.dart
// ─────────────────────────────────────────────────────────
// شاشة الترحيب والمصادقة - مع دعم معلومات الشركة
// ─────────────────────────────────────────────────────────

import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'main.dart'; // DataService, CompanyInfo, accountsNotifier, …
import 'services/firebase_service.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  // ─── حالة الصفحة ───────────────────────
  _Page _page = _Page.landing;
  bool _loading = false;
  String? _error;
  bool _obscure = true;

  // ─── Controllers للمصادقة ───────────────
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  
  // ─── Controllers لمعلومات الشركة (جديدة) ───────────────
  final _companyNameCtrl = TextEditingController();
  final _companyPhoneCtrl = TextEditingController();
  final _companyEmailCtrl = TextEditingController();
  final _companyAddressCtrl = TextEditingController();
  
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _nameCtrl.dispose();
    _companyNameCtrl.dispose();
    _companyPhoneCtrl.dispose();
    _companyEmailCtrl.dispose();
    _companyAddressCtrl.dispose();
    super.dispose();
  }

  // ─── تسجيل الدخول ───────────────────────
  Future<void> _signIn() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    try {
      final cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text.trim(),
      );

      if (cred.user != null) {
        await FirebaseService.ensureUserExists();
        await DataService.initUserInFirebase();
        // مزامنة معلومات الشركة من السحابة
        await DataService.syncCompanyFromCloud();
      }
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _authError(e.code));
    } catch (e) {
      setState(() => _error = 'خطأ غير متوقع: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ─── إنشاء حساب جديد مع معلومات الشركة ────────────────────
  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    try {
      final cred = await FirebaseAuth.instance
          .createUserWithEmailAndPassword(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text.trim(),
      );

      if (cred.user != null) {
        final user = cred.user!;
        
        // تحديث اسم المستخدم
        await user.updateDisplayName(_nameCtrl.text.trim());
        
        // إنشاء معلومات الشركة
        final companyInfo = CompanyInfo(
          name: _companyNameCtrl.text.trim().isNotEmpty 
              ? _companyNameCtrl.text.trim() 
              : _nameCtrl.text.trim(),
          phone: _companyPhoneCtrl.text.trim(),
          email: _companyEmailCtrl.text.trim(),
          address: _companyAddressCtrl.text.trim(),
        );
        
        // حفظ في فايربيز + محلياً
        await DataService.initUserInFirebaseWithCompany(
          uid: user.uid,
          email: user.email ?? '',
          companyInfo: companyInfo,
        );
        
        // تهيئة البيانات المحلية
        await DataService.getAccounts();
        await DataService.getOperations();
      }
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _authError(e.code));
    } catch (e) {
      setState(() => _error = 'خطأ غير متوقع: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ─── إعادة تعيين كلمة المرور ─────────────
  Future<void> _resetPassword() async {
    if (_emailCtrl.text.trim().isEmpty) {
      setState(() => _error = 'أدخل بريدك الإلكتروني أولاً');
      return;
    }
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(
          email: _emailCtrl.text.trim());
      if (mounted) {
        _showSnack('✅ تم إرسال رابط إعادة التعيين إلى بريدك');
      }
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _authError(e.code));
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
            colors: [Color(0xFF021B79), Color(0xFF0575E6)],
          ),
        ),
        child: SafeArea(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: Colors.white))
              : _buildContent(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return switch (_page) {
      _Page.landing => _buildLanding(),
      _Page.login => _buildAuthForm(isLogin: true),
      _Page.register => _buildAuthForm(isLogin: false),
    };
  }

  // ── صفحة الترحيب ──────────────────────────
  Widget _buildLanding() {
    return Center(
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(
                      color: Colors.white.withOpacity(0.3), width: 1.5),
                ),
                child: const Icon(Icons.account_balance,
                    size: 52, color: Colors.white),
              ),
              const SizedBox(height: 32),
              const Text('منصتي المحاسبية',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Text(
                'إدارة حساباتك وقيودك المالية\nبكل سهولة وأمان',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.white.withOpacity(0.8), fontSize: 16, height: 1.6),
              ),
              const SizedBox(height: 56),
              _bigButton('تسجيل الدخول', onTap: () {
                setState(() { _page = _Page.login; _error = null; });
              }),
              const SizedBox(height: 14),
              _bigButton('إنشاء حساب جديد',
                  outlined: true,
                  onTap: () {
                    setState(() { _page = _Page.register; _error = null; });
                  }),
            ],
          ),
        ),
      ),
    );
  }

  // ── نموذج تسجيل الدخول / الإنشاء ──────────
  Widget _buildAuthForm({required bool isLogin}) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // زر الرجوع
              IconButton(
                icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                onPressed: () =>
                    setState(() { _page = _Page.landing; _error = null; }),
              ),
              const SizedBox(height: 12),
              // العنوان
              Text(
                isLogin ? 'تسجيل الدخول' : 'إنشاء حساب',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.bold),
              ),
SizedBox(height: isLogin ? 32 : 20),
              
              // البطاقة البيضاء
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withOpacity(0.15),
                        blurRadius: 20,
                        offset: const Offset(0, 8)),
                  ],
                ),
                child: Column(
                  children: [
                    // 👤 بيانات المستخدم
                    Text('👤 بيانات الحساب',
                        style: TextStyle(
                            color: Colors.grey.shade600, 
                            fontSize: 13, 
                            fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    
                    if (!isLogin) ...[
                      _authField(
                        controller: _nameCtrl,
                        label: 'الاسم الكامل *',
                        icon: Icons.person_outline,
                        validator: (v) => v!.isEmpty ? 'الاسم مطلوب' : null,
                      ),
                      const SizedBox(height: 16),
                    ],
                    _authField(
                      controller: _emailCtrl,
                      label: 'البريد الإلكتروني *',
                      icon: Icons.email_outlined,
                      type: TextInputType.emailAddress,
                      validator: (v) => !v!.contains('@') ? 'بريد غير صالح' : null,
                    ),
                    const SizedBox(height: 16),
                    _authField(
                      controller: _passCtrl,
                      label: 'كلمة المرور *',
                      icon: Icons.lock_outline,
                      obscure: _obscure,
                      suffix: IconButton(
                        icon: Icon(_obscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
                        constraints: const BoxConstraints(),
                        padding: EdgeInsets.zero,
                      ),
                      validator: (v) => v!.length < 6
                          ? '6 أحرف على الأقل' : null,
                    ),
                    
                    // 🏢 قسم معلومات الشركة (للتسجيل فقط)
                    if (!isLogin) ...[
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF021B79).withOpacity(0.05),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: const Color(0xFF021B79).withOpacity(0.2)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.business, 
                                    size: 16, color: Color(0xFF021B79)),
                                const SizedBox(width: 6),
                                Text('📋 معلومات الشركة',
                                    style: TextStyle(
                                        color: Colors.grey.shade700,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)),
                                const Spacer(),
                                Text('(اختياري)',
                                    style: TextStyle(
                                        color: Colors.grey.shade400,
                                        fontSize: 10)),
                              ],
                            ),
                            const SizedBox(height: 12),
                            _authField(
                              controller: _companyNameCtrl,
                              label: 'اسم الشركة',
                              icon: Icons.storefront_outlined,
                              hint: 'سيستخدم اسمك إذا تركته فارغاً',
                            ),
                            const SizedBox(height: 12),
                            _authField(
                              controller: _companyPhoneCtrl,
                              label: 'هاتف الشركة',
                              icon: Icons.phone_outlined,
                              type: TextInputType.phone,
                            ),
                            const SizedBox(height: 12),
                            _authField(
                              controller: _companyEmailCtrl,
                              label: 'بريد الشركة',
                              icon: Icons.mail_outline,
                              type: TextInputType.emailAddress,
                            ),
                            const SizedBox(height: 12),
                            _authField(
                              controller: _companyAddressCtrl,
                              label: 'عنوان الشركة',
                              icon: Icons.location_on_outlined,
                              maxLines: 2,
                            ),
                          ],
                        ),
                      ),
                    ],
                    
                    // رسالة الخطأ
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.red.shade200)),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline,
                                color: Colors.red.shade400, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                                child: Text(_error!,
                                    style: TextStyle(
                                        color: Colors.red.shade700,
                                        fontSize: 13))),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    
                    // زر الإجراء الرئيسي
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isLogin ? _signIn : _register,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF021B79),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                        ),
                        child: Text(
                          isLogin ? 'دخول' : 'إنشاء الحساب',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    
                    // نسيت كلمة المرور (تسجيل الدخول فقط)
                    if (isLogin) ...[
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: _resetPassword,
                        child: Text(
                          'نسيت كلمة المرور؟',
                          style: TextStyle(color: Colors.blue.shade700),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),
              
              // التبديل بين تسجيل الدخول والإنشاء
              Center(
                child: TextButton(
                  onPressed: () => setState(() {
                    _page = isLogin ? _Page.register : _Page.login;
                    _error = null;
                    _formKey.currentState?.reset();
                  }),
                  child: Text(
                    isLogin
                        ? 'ليس لديك حساب؟ أنشئ حساباً'
                        : 'لديك حساب؟ سجّل الدخول',
                    style: const TextStyle(
                        color: Colors.white,
                        decoration: TextDecoration.underline),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Widgets مساعدة ──────────────────────
  Widget _bigButton(String label,
      {required VoidCallback onTap, bool outlined = false}) {
    return SizedBox(
      width: double.infinity,
      child: outlined
          ? OutlinedButton(
              onPressed: onTap,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                side: const BorderSide(color: Colors.white, width: 1.5),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              child: Text(label,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            )
          : ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              child: Text(label,
                  style: const TextStyle(
                      color: Color(0xFF021B79),
                      fontSize: 16,
                      fontWeight: FontWeight.bold)),
            ),
    );
  }

  Widget _authField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? hint,
    TextInputType type = TextInputType.text,
    bool obscure = false,
    int maxLines = 1,
    Widget? suffix,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: type,
      obscureText: obscure,
      maxLines: maxLines,
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.right,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: const Color(0xFF021B79)),
        suffixIcon: suffix,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF021B79), width: 2)),
        filled: true,
        fillColor: Colors.grey.shade50,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: Colors.green.shade600,
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.all(16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  String _authError(String code) => switch (code) {
        'user-not-found' => 'البريد الإلكتروني غير مسجّل',
        'wrong-password' => 'كلمة المرور غير صحيحة',
        'email-already-in-use' => 'البريد مستخدم بالفعل',
        'weak-password' => 'كلمة المرور ضعيفة جداً',
        'invalid-email' => 'صيغة البريد الإلكتروني غير صحيحة',
        'too-many-requests' => 'محاولات كثيرة، حاول لاحقاً',
        'network-request-failed' => 'لا يوجد اتصال بالإنترنت',
        _ => 'خطأ: $code',
      };
}

// ── أنواع الصفحات الداخلية ──────────────────
enum _Page { landing, login, register }