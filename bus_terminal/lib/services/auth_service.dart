import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';

/// Authentication Service
class AuthService {
  // TODO: Implement API connector - configure base URL from env/config
  static const String _apiBaseUrl = 'http://localhost:5000';
  static const String _tokenKey = 'auth_token';

  late SharedPreferences _prefs;

  Future<void> _initPrefs() async {
    _prefs = await SharedPreferences.getInstance();
  }

  /// Login with userCode and password
  Future<AuthResponse> login({
    required String userCode,
    required String password,
  }) async {
    await _initPrefs();

    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userCode': userCode,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final authResponse = AuthResponse.fromJson(data);

        // Store token
        await _prefs.setString(_tokenKey, authResponse.token);

        return authResponse;
      } else if (response.statusCode == 401) {
        throw Exception('Invalid credentials');
      } else {
        throw Exception('Login failed: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Login error: $e');
    }
  }

  /// Get stored token
  Future<String?> getToken() async {
    await _initPrefs();
    return _prefs.getString(_tokenKey);
  }

  /// Check if user is logged in
  Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null;
  }

  /// Logout
  Future<void> logout() async {
    await _initPrefs();
    await _prefs.remove(_tokenKey);
  }

  /// Get Authorization header
  Future<Map<String, String>> getAuthHeaders() async {
    final token = await getToken();
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }
}
