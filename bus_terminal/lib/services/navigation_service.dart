import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import '../models/navigation.dart';

/// Navigation Service using OpenStreetMap
class NavigationService {
  // OSRM (OpenStreetMap Routing Machine) - free public service
  static const String _osrmBaseUrl = 'https://router.project-osrm.org/route/v1/car';

  /// Get current device location
  Future<NavigationPoint?> getCurrentLocation() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        await Geolocator.requestPermission();
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      return NavigationPoint(
        latitude: position.latitude,
        longitude: position.longitude,
        name: 'Current Location',
      );
    } catch (e) {
      throw Exception('Failed to get location: $e');
    }
  }

  /// Get route between two points
  /// Uses OSRM for open routing without API key
  Future<NavigationRoute> getRoute({
    required NavigationPoint start,
    required NavigationPoint end,
  }) async {
    try {
      // OSRM format: /route/v1/car/lon1,lat1;lon2,lat2
      final coordinates =
          '${start.longitude},${start.latitude};${end.longitude},${end.latitude}';
      final url =
          '$_osrmBaseUrl/$coordinates?overview=full&steps=true&geometries=geojson';

      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;

        if (data['code'] != 'Ok') {
          throw Exception('Route not found: ${data['message']}');
        }

        final route = NavigationRoute.fromJson(data);

        // Set start and end points properly
        return NavigationRoute(
          start: start,
          end: end,
          legs: route.legs,
          totalDistance: route.totalDistance,
          totalDuration: route.totalDuration,
        );
      } else {
        throw Exception('Failed to get route: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Navigation error: $e');
    }
  }

  /// Get multiple routes (alternatives)
  Future<List<NavigationRoute>> getMultipleRoutes({
    required NavigationPoint start,
    required NavigationPoint end,
    int alternatives = 2,
  }) async {
    try {
      final coordinates =
          '${start.longitude},${start.latitude};${end.longitude},${end.latitude}';
      final url =
          '$_osrmBaseUrl/$coordinates?overview=full&steps=true&geometries=geojson&alternatives=$alternatives';

      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;

        if (data['code'] != 'Ok') {
          throw Exception('Routes not found: ${data['message']}');
        }

        final routes = (data['routes'] as List)
            .map((routeData) {
              return NavigationRoute(
                start: start,
                end: end,
                legs: (routeData['legs'] as List)
                    .map((leg) =>
                        RouteLeg.fromJson(leg as Map<String, dynamic>))
                    .toList(),
                totalDistance:
                    (routeData['distance'] as num).toDouble(),
                totalDuration: (routeData['duration'] as num).toInt(),
              );
            })
            .toList();

        return routes;
      } else {
        throw Exception('Failed to get routes: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Navigation error: $e');
    }
  }

  /// Calculate straight-line distance between two points
  double calculateDistance(NavigationPoint p1, NavigationPoint p2) {
    const distance = Distance();
    return distance(
      LatLng(p1.latitude, p1.longitude),
      LatLng(p2.latitude, p2.longitude),
    );
  }
}
