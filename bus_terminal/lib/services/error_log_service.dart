import 'dart:convert';
import 'package:http/http.dart' as http;

class ErrorLogService {
  static const String _apiBaseUrl = 'https://transit.xtransit.testinstance.nl';

  static Future<void> report({
    required String service,
    required String partOfService,
    required String error,
  }) async {
    try {
      await http.post(
        Uri.parse('$_apiBaseUrl/error_log'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'service': service,
          'partOfService': partOfService,
          'error': error,
        }),
      );
    } catch (_) {
      // Intentionally ignore logging failures.
    }
  }
}
