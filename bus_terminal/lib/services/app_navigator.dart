import 'package:flutter/material.dart';
import 'auth_service.dart';

/// Global navigator and messenger keys so services can navigate/logout
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<ScaffoldMessengerState> messengerKey = GlobalKey<ScaffoldMessengerState>();

/// Handle expired authentication: clear stored token and navigate to login.
Future<void> handleAuthExpired({String? message}) async {
  try {
    await AuthService().logout();
  } catch (_) {}

  // Show a message if possible
  try {
    final messenger = messengerKey.currentState;
    if (messenger != null && message != null) {
      messenger.showSnackBar(SnackBar(content: Text(message)));
    }
  } catch (_) {}

  // Navigate to login, removing all previous routes
  try {
    final nav = navigatorKey.currentState;
    if (nav != null) {
      nav.pushNamedAndRemoveUntil('/login', (r) => false);
    }
  } catch (_) {}
}
