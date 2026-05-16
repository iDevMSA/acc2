import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('منصتي المحاسبية'),
        backgroundColor: const Color(0xFF0A2B4E),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: const Center(
        child: Text('الصفحة الرئيسية - سيتم إضافة المحتوى لاحقاً'),
      ),
    );
  }

}