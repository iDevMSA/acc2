// lib/services/session_manager.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'auth_service.dart';

class SessionManager {
  Timer? _inactivityTimer;
  VoidCallback? _onTimeout;
  final AuthService _authService = AuthService();
  
  // مدة التحقق من النشاط (كل دقيقة)
  static const Duration checkInterval = Duration(minutes: 1);
  
  void startMonitoring(VoidCallback onTimeout) {
    _onTimeout = onTimeout;
    
    // بدأ التحقق الدوري
    _inactivityTimer = Timer.periodic(checkInterval, (timer) async {
      final isValid = await _authService.isSessionValid();
      if (!isValid && _onTimeout != null) {
        _onTimeout!();
        timer.cancel();
      }
    });
  }
  
  // تسجيل نشاط المستخدم
  void notifyActivity() {
    _authService.updateLastActivity();
  }
  
  void dispose() {
    _inactivityTimer?.cancel();
  }
}