// Custom exception for authentication errors
import 'app_navigator.dart';

class UnauthorizedException implements Exception {
  final String message;

  UnauthorizedException(this.message) {
    // Trigger centralized logout/navigation asynchronously
    try {
      handleAuthExpired(message: message);
    } catch (_) {}
  }

  @override
  String toString() => message;
}
