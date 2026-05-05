import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/schedule.dart';
import 'auth_service.dart';

/// Schedule/Route Service
class ScheduleService {
  // TODO: Implement API connector - configure base URL from env/config
  // Transit API runs on port 5001
  static const String _apiBaseUrl = 'http://192.168.2.66:5001';
  final _authService = AuthService();

  /// Get daily schedule for a specific date
  Future<DailySchedule> getDailySchedule(DateTime date) async {
    try {
      final headers = await _authService.getAuthHeaders();
      final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

      final response = await http.get(
        Uri.parse('$_apiBaseUrl/schedule/daily?date=$dateStr'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return DailySchedule.fromJson(data);
      } else if (response.statusCode == 401) {
        throw Exception('Unauthorized - Please login again');
      } else {
        throw Exception('Failed to load schedule: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Schedule error: $e');
    }
  }

  /// Get today's schedule
  Future<DailySchedule> getTodaySchedule() async {
    return getDailySchedule(DateTime.now());
  }

  /// Get route details
  Future<Route> getRouteDetails(int routeId) async {
    try {
      final headers = await _authService.getAuthHeaders();

      // Transit API exposes route details at /routes/:routeId
      final response = await http.get(
        Uri.parse('$_apiBaseUrl/routes/$routeId'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return Route.fromJson(data);
      } else if (response.statusCode == 401) {
        throw Exception('Unauthorized - Please login again');
      } else {
        throw Exception('Failed to load route: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Route error: $e');
    }
  }

  /// Update route status
  Future<void> updateRouteStatus(int routeId, String status) async {
    try {
      final headers = await _authService.getAuthHeaders();

      // Transit API updates status at /routes/:routeId/status
      final response = await http.patch(
        Uri.parse('$_apiBaseUrl/routes/$routeId/status'),
        headers: headers,
        body: jsonEncode({'status': status}),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to update status: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Status update error: $e');
    }
  }
}
