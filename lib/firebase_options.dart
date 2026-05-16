// 📁 lib/firebase_options.dart
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show kIsWeb;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    throw UnsupportedError(
      'DefaultFirebaseOptions are not supported for this platform.',
    );
  }

  static const FirebaseOptions web = FirebaseOptions(
  apiKey: "AIzaSyADqEEGiORR7tX791K4Kee0M06PLZGeGD4",
  authDomain: "alaraby-4ccdd.firebaseapp.com",
  databaseURL: "https://alaraby-4ccdd-default-rtdb.firebaseio.com",
  projectId: "alaraby-4ccdd",
  storageBucket: "alaraby-4ccdd.firebasestorage.app",
  messagingSenderId: "633240001820",
  appId: "1:633240001820:web:9a813dec49d00e1e6a2ed9",
  measurementId: "G-WTNG0T0EZM"
    );
}