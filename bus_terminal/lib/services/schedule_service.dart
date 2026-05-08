import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/schedule.dart';
import '../models/navigation.dart';
import 'auth_service.dart';
import 'exceptions.dart';

/// Schedule/Route Service
class ScheduleService {
  // TODO: Implement API connector - configure base URL from env/config
  // Transit API runs on port 5001
  static const String _apiBaseUrl = 'http://192.168.2.66:5001';
  final _authService = AuthService();

  /// Get public schedules for a specific date.
  Future<List<ServiceSchedule>> getSchedules(DateTime date, {int? lineId}) async {
    try {
      final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      final queryParameters = <String, String>{'date': dateStr};
      if (lineId != null) {
        queryParameters['lineId'] = lineId.toString();
      }

      final uri = Uri.parse('$_apiBaseUrl/schedules').replace(queryParameters: queryParameters);
      final response = await http.get(uri);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return (data['schedules'] as List? ?? [])
            .map((schedule) => schedule as Map<String, dynamic>)
            .map(ServiceSchedule.fromJson)
            .toList();
      }

      throw Exception('Failed to load schedules: ${response.statusCode}');
    } catch (e) {
      throw Exception('Schedule error: $e');
    }
  }

  /// Get stop list for a specific schedule.
  Future<List<ScheduleStop>> getScheduleStops(int scheduleId) async {
    try {
      final response = await http.get(Uri.parse('$_apiBaseUrl/schedules/$scheduleId/stops'));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return (data['stops'] as List? ?? [])
            .map((stop) => stop as Map<String, dynamic>)
            .map(ScheduleStop.fromJson)
            .toList();
      }

      throw Exception('Failed to load schedule stops: ${response.statusCode}');
    } catch (e) {
      throw Exception('Schedule stops error: $e');
    }
  }

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
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        await _authService.logout();
        throw UnauthorizedException('Session expired - Please login again');
      } else {
        throw Exception('Failed to load schedule: ${response.statusCode}');
      }
    } catch (e) {
      if (e is UnauthorizedException) rethrow;
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
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        await _authService.logout();
        throw UnauthorizedException('Session expired - Please login again');
      } else {
        throw Exception('Failed to load route: ${response.statusCode}');
      }
    } catch (e) {
      if (e is UnauthorizedException) rethrow;
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

      if (response.statusCode == 401 || response.statusCode == 403) {
        await _authService.logout();
        throw UnauthorizedException('Session expired - Please login again');
      } else if (response.statusCode != 200) {
        throw Exception('Failed to update status: ${response.statusCode}');
      }
    } catch (e) {
      if (e is UnauthorizedException) rethrow;
      throw Exception('Status update error: $e');
    }
  }

  /// Update schedule status for driver-facing schedule workflows.
  Future<void> updateScheduleStatus(int scheduleId, String status) async {
    try {
      final headers = await _authService.getAuthHeaders();

      final response = await http.patch(
        Uri.parse('$_apiBaseUrl/driver/schedules/$scheduleId/status'),
        headers: headers,
        body: jsonEncode({'status': status}),
      );

      if (response.statusCode == 401 || response.statusCode == 403) {
        await _authService.logout();
        throw UnauthorizedException('Session expired - Please login again');
      } else if (response.statusCode != 200) {
        throw Exception('Failed to update schedule status: ${response.statusCode}');
      }
    } catch (e) {
      if (e is UnauthorizedException) rethrow;
      throw Exception('Schedule status update error: $e');
    }
  }

  /// Get stops for a bus line
  Future<List<NavigationPoint>> getStops(int busLineId) async {
    try {
      final headers = await _authService.getAuthHeaders();

      final response = await http.get(
        Uri.parse('$_apiBaseUrl/bus-lines/$busLineId/stops'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final stops = (data['stops'] as List?)
                ?.map((s) => s as Map<String, dynamic>)
                .map((s) {
                  final lat = (s['latitude'] ?? s['lat']) as num?;
                  final lon = (s['longitude'] ?? s['lon']) as num?;
                  final name = (s['name'] ?? s['stop_name'] ?? s['stopName']) as String?;
                  if (lat == null || lon == null) return null;
                  return NavigationPoint(
                    latitude: lat.toDouble(),
                    longitude: lon.toDouble(),
                    name: name,
                  );
                })
                .whereType<NavigationPoint>()
                .toList() ?? [];
        return stops;
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        await _authService.logout();
        throw UnauthorizedException('Session expired - Please login again');
      } else {
        throw Exception('Failed to load stops: ${response.statusCode}');
      }
    } catch (e) {
      if (e is UnauthorizedException) rethrow;
      throw Exception('Get stops error: $e');
    }
  }

  /// Mark a schedule stop as passed by the driver.
  Future<void> markScheduleStopPassed({
    required int scheduleId,
    required int stopOrder,
    DateTime? actualPassedAt,
  }) async {
    try {
      final headers = await _authService.getAuthHeaders();

      final response = await http.post(
        Uri.parse('$_apiBaseUrl/driver/schedules/$scheduleId/stops/$stopOrder/passed'),
        headers: headers,
        body: jsonEncode({
          if (actualPassedAt != null) 'actualPassedAt': actualPassedAt.toIso8601String(),
        }),
      );

      if (response.statusCode == 401 || response.statusCode == 403) {
        await _authService.logout();
        throw UnauthorizedException('Session expired - Please login again');
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Failed to mark stop as passed: ${response.statusCode}');
      }
    } catch (e) {
      if (e is UnauthorizedException) rethrow;
      throw Exception('Mark stop passed error: $e');
    }
  }
}
