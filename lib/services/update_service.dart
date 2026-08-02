// ============================================================
// lib/services/update_service.dart
// نظام التحديث التلقائي داخل التطبيق
// يتحقق من Firebase → يعرض Dialog → يحمّل APK → يثبّت
// ============================================================

import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:open_file/open_file.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ─────────────────────────────────────────────
//  مفاتيح SharedPreferences
// ─────────────────────────────────────────────
const _kJustUpdated  = 'app_just_updated';
const _kReleaseNotes = 'app_release_notes';
const _kLastVersion  = 'app_last_version';

// ─────────────────────────────────────────────
//  معلومات التحديث المتاح
// ─────────────────────────────────────────────
class UpdateInfo {
  final String version;
  final String downloadUrl;
  final String releaseNotes;
  final bool force;
  const UpdateInfo({
    required this.version,
    required this.downloadUrl,
    required this.releaseNotes,
    required this.force,
  });
}

// ─────────────────────────────────────────────
//  الخدمة الرئيسية
// ─────────────────────────────────────────────
class UpdateService {

  /// يتحقق من Firebase ويرجع تحديثاً إن وُجد أحدث من النسخة المثبتة، وإلا null
  static Future<UpdateInfo?> checkLatestVersion() async {
    try {
      final snap = await FirebaseDatabase.instance.ref('appUpdate').get();
      if (!snap.exists) return null;

      final data    = Map<String, dynamic>.from(snap.value as Map);
      final latest  = (data['latestVersion'] as String?)?.trim() ?? '';
      final url     = (data['downloadUrl']   as String?)?.trim() ?? '';
      final force   = (data['forceUpdate']   as bool?)  ?? false;
      final notes   = (data['releaseNotes']  as String?)?.trim() ?? '';

      if (latest.isEmpty || url.isEmpty) return null;

      final info    = await PackageInfo.fromPlatform();
      if (!_isNewer(latest, info.version)) return null;

      return UpdateInfo(
          version: latest, downloadUrl: url, releaseNotes: notes, force: force);
    } catch (e) {
      debugPrint('[UpdateService] checkLatestVersion error: $e');
      return null;
    }
  }

  /// استدعِ هذا عند فتح التطبيق — يتحقق ويعرض Dialog إن وُجد تحديث
  static Future<void> checkForUpdate(BuildContext context) async {
    final update = await checkLatestVersion();
    if (update == null || !context.mounted) return;
    await showDialog(
      context: context,
      barrierDismissible: !update.force,
      builder: (_) => _UpdateDialog(
        version: update.version,
        notes: update.releaseNotes,
        downloadUrl: update.downloadUrl,
        force: update.force,
      ),
    );
  }

  /// استدعِ في initState — يتحقق هل تم التحديث للتو ويعرض رسالة النجاح
  static Future<void> checkJustUpdated(BuildContext context) async {
    try {
      final prefs   = await SharedPreferences.getInstance();
      final updated = prefs.getBool(_kJustUpdated) ?? false;
      if (!updated) return;

      final notes   = prefs.getString(_kReleaseNotes) ?? '';
      final version = prefs.getString(_kLastVersion)  ?? '';

      await prefs.remove(_kJustUpdated);
      await prefs.remove(_kReleaseNotes);
      await prefs.remove(_kLastVersion);

      if (context.mounted) {
        await showDialog(
          context: context,
          builder: (_) => _UpdatedSuccessDialog(version: version, notes: notes),
        );
      }
    } catch (e) {
      debugPrint('[UpdateService] checkJustUpdated error: $e');
    }
  }

  // ─── تحميل وتثبيت APK ───────────────────────────────────────
  static Future<void> downloadAndInstall({
    required String url,
    required String version,
    required String releaseNotes,
    required ValueChanged<double> onProgress,
    required VoidCallback onDone,
    required ValueChanged<String> onError,
  }) async {
    try {
      // صلاحية تثبيت مصادر مجهولة
      if (!await Permission.requestInstallPackages.isGranted) {
        final st = await Permission.requestInstallPackages.request();
        if (!st.isGranted) {
          onError('يرجى السماح بتثبيت التطبيقات من مصادر مجهولة\nالإعدادات ← التطبيقات ← مصادر مجهولة');
          return;
        }
      }

      // مسار الحفظ
      final dir  = await getExternalStorageDirectory()
                ?? await getApplicationDocumentsDirectory();
      final path = '${dir.path}/mansabti-update-v$version.apk';

      // حذف ملف قديم
      final f = File(path);
      if (await f.exists()) await f.delete();

      // تحميل مع progress
      await Dio().download(
        url,
        path,
        onReceiveProgress: (recv, total) {
          if (total > 0) onProgress(recv / total);
        },
        options: Options(
          responseType: ResponseType.bytes,
          followRedirects: true,
          receiveTimeout: const Duration(minutes: 10),
        ),
      );

      // احفظ للعرض بعد إعادة الفتح
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool  (_kJustUpdated,  true);
      await prefs.setString(_kReleaseNotes, releaseNotes);
      await prefs.setString(_kLastVersion,  version);

      // افتح APK للتثبيت
      final result = await OpenFile.open(
        path,
        type: 'application/vnd.android.package-archive',
      );
      if (result.type != ResultType.done) {
        onError('تعذّر فتح ملف التحديث:\n${result.message}');
      } else {
        onDone();
      }
    } on DioException catch (e) {
      onError('فشل التحميل: ${e.message}');
    } catch (e) {
      onError('حدث خطأ: $e');
    }
  }

  // ─── مقارنة إصدارين "1.2.0" > "1.1.0" ──────────────────────
  static bool _isNewer(String latest, String current) {
    try {
      final l = latest.split('.').map(int.parse).toList();
      final c = current.split('.').map(int.parse).toList();
      // اجعل الطولين متساويين
      while (l.length < 3) l.add(0);
      while (c.length < 3) c.add(0);
      for (int i = 0; i < 3; i++) {
        if (l[i] > c[i]) return true;
        if (l[i] < c[i]) return false;
      }
    } catch (_) {}
    return false;
  }
}

// ─────────────────────────────────────────────
//  Dialog التحديث
// ─────────────────────────────────────────────
class _UpdateDialog extends StatefulWidget {
  final String version, notes, downloadUrl;
  final bool force;
  const _UpdateDialog({
    required this.version,
    required this.notes,
    required this.downloadUrl,
    required this.force,
  });
  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  double  _progress    = 0;
  bool    _downloading = false;
  String  _error       = '';

  static const _blue = Color(0xFF0575E6);
  static const _dark = Color(0xFF021B79);

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 8),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        content: SizedBox(
          width: 340,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── أيقونة ──
              Container(
                width: 68, height: 68,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [_dark, _blue],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: _blue.withValues(alpha: .3),
                      blurRadius: 16, offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Icon(Icons.system_update_rounded,
                    color: Colors.white, size: 34),
              ),
              const SizedBox(height: 16),

              // ── العنوان ──
              Text(
                'تحديث متاح',
                style: const TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w900,
                  color: _dark,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: _blue.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'الإصدار ${widget.version}',
                  style: const TextStyle(
                    fontSize: 13, color: _blue, fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // ── Release Notes ──
              if (widget.notes.isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    widget.notes,
                    style: const TextStyle(
                      fontSize: 13, height: 1.75, color: Color(0xFF475569),
                    ),
                    textDirection: TextDirection.rtl,
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // ── Progress ──
              if (_downloading) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: _progress > 0 ? _progress : null,
                    minHeight: 8,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: const AlwaysStoppedAnimation(_blue),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _progress > 0
                      ? 'جاري التحميل... ${(_progress * 100).toInt()}%'
                      : 'جاري التحضير...',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 8),
              ],

              // ── خطأ ──
              if (_error.isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Text(
                    _error,
                    style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 8),
              ],
            ],
          ),
        ),
        actions: _downloading
            ? null
            : [
                if (!widget.force)
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text(
                      'لاحقاً',
                      style: TextStyle(color: Color(0xFF94A3B8)),
                    ),
                  ),
                ElevatedButton.icon(
                  onPressed: _start,
                  icon: const Icon(Icons.download_rounded, size: 18),
                  label: const Text('حدّث الآن'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                    textStyle: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
      ),
    );
  }

  void _start() {
    setState(() { _downloading = true; _error = ''; _progress = 0; });
    UpdateService.downloadAndInstall(
      url: widget.downloadUrl,
      version: widget.version,
      releaseNotes: widget.notes,
      onProgress: (p) { if (mounted) setState(() => _progress = p); },
      onDone: () { /* التطبيق سيُغلق تلقائياً للتثبيت */ },
      onError: (e) {
        if (mounted) setState(() { _error = e; _downloading = false; });
      },
    );
  }
}

// ─────────────────────────────────────────────
//  Dialog نجاح التحديث
// ─────────────────────────────────────────────
class _UpdatedSuccessDialog extends StatelessWidget {
  final String version, notes;
  const _UpdatedSuccessDialog({required this.version, required this.notes});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 8),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        content: SizedBox(
          width: 340,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── أيقونة نجاح ──
              Container(
                width: 68, height: 68,
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.check_circle_rounded,
                    color: Color(0xFF10B981), size: 38),
              ),
              const SizedBox(height: 16),

              const Text(
                'تم التحديث بنجاح! 🎉',
                style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w900,
                  color: Color(0xFF021B79),
                ),
              ),
              if (version.isNotEmpty) ...[
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'الإصدار $version',
                    style: const TextStyle(
                      fontSize: 13, color: Color(0xFF059669),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],

              if (notes.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'ما الجديد:',
                    style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w800,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    notes,
                    style: const TextStyle(
                      fontSize: 13, height: 1.75, color: Color(0xFF475569),
                    ),
                    textDirection: TextDirection.rtl,
                  ),
                ),
              ],
              const SizedBox(height: 8),
            ],
          ),
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: const Text(
                'رائع! 👍',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  بطاقة التحديثات داخل شاشة الإعدادات
//  (نفس تنسيق بطاقات الإعدادات: أبيض + شعاع 16 + ظل خفيف)
// ─────────────────────────────────────────────
class UpdateSettingsCard extends StatefulWidget {
  const UpdateSettingsCard({super.key});

  @override
  State<UpdateSettingsCard> createState() => _UpdateSettingsCardState();
}

class _UpdateSettingsCardState extends State<UpdateSettingsCard> {
  static const _dark = Color(0xFF021B79);
  static const _blue = Color(0xFF0575E6);

  String _currentVersion = '';
  bool _checking = true;
  UpdateInfo? _update;
  bool _downloading = false;
  double _progress = 0;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final info = await PackageInfo.fromPlatform();
    if (mounted) setState(() => _currentVersion = info.version);
    await _check();
  }

  Future<void> _check() async {
    setState(() {
      _checking = true;
      _error = '';
    });
    final update = await UpdateService.checkLatestVersion();
    if (mounted) {
      setState(() {
        _update = update;
        _checking = false;
      });
    }
  }

  void _startDownload() {
    final update = _update;
    if (update == null) return;
    setState(() {
      _downloading = true;
      _progress = 0;
      _error = '';
    });
    UpdateService.downloadAndInstall(
      url: update.downloadUrl,
      version: update.version,
      releaseNotes: update.releaseNotes,
      onProgress: (p) {
        if (mounted) setState(() => _progress = p);
      },
      onDone: () {
        // سيُغلق التطبيق تلقائياً لبدء التثبيت
      },
      onError: (e) {
        if (mounted) {
          setState(() {
            _error = e;
            _downloading = false;
          });
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final update = _update;
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_dark, _blue]),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.system_update_rounded,
                  color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('الإصدار الحالي',
                      style: TextStyle(fontSize: 11, color: Colors.grey)),
                  Text(
                    _currentVersion.isEmpty ? '...' : 'v$_currentVersion',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
            ),
            if (!_downloading)
              IconButton(
                tooltip: 'تحقق من التحديثات',
                onPressed: _checking ? null : _check,
                icon: _checking
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.refresh_rounded, color: _dark),
              ),
          ]),

          // ── لا يوجد تحديث ──
          if (!_checking && update == null) ...[
            const SizedBox(height: 10),
            const Row(children: [
              Icon(Icons.check_circle_rounded,
                  color: Color(0xFF10B981), size: 16),
              SizedBox(width: 6),
              Text('أنت تستخدم أحدث إصدار',
                  style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF10B981),
                      fontWeight: FontWeight.w600)),
            ]),
          ],

          // ── يوجد تحديث ──
          if (update != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _blue.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _blue.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                          color: _blue.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20)),
                      child: Text('الإصدار ${update.version}',
                          style: const TextStyle(
                              fontSize: 12,
                              color: _blue,
                              fontWeight: FontWeight.w700)),
                    ),
                    const Spacer(),
                    const Text('تحديث متاح',
                        style: TextStyle(
                            fontSize: 12,
                            color: _dark,
                            fontWeight: FontWeight.bold)),
                  ]),
                  if (update.releaseNotes.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      update.releaseNotes,
                      style: const TextStyle(
                          fontSize: 12, height: 1.6, color: Color(0xFF475569)),
                    ),
                  ],

                  // ── شريط التقدم ──
                  if (_downloading) ...[
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: _progress > 0 ? _progress : null,
                        minHeight: 8,
                        backgroundColor: const Color(0xFFE2E8F0),
                        valueColor: const AlwaysStoppedAnimation(_blue),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _progress > 0
                          ? 'جاري التحميل... ${(_progress * 100).toInt()}%'
                          : 'جاري التحضير...',
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],

                  if (_error.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(_error,
                        style: const TextStyle(fontSize: 11, color: Colors.red)),
                  ],

                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _downloading ? null : _startDownload,
                      icon: const Icon(Icons.download_rounded,
                          size: 18, color: Colors.white),
                      label: Text(
                        _downloading ? 'جاري التحميل...' : 'تحديث الآن',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _dark,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
