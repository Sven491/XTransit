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
      bool validCoord(double lat, double lon) {
        return lat.isFinite && lon.isFinite && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
      }

      if (!validCoord(start.latitude, start.longitude) || !validCoord(end.latitude, end.longitude)) {
        throw Exception('Invalid coordinates for routing: start=(${start.latitude},${start.longitude}) end=(${end.latitude},${end.longitude})');
      }
      // OSRM format: /route/v1/car/lon1,lat1;lon2,lat2
      final coordinates =
          '${start.longitude},${start.latitude};${end.longitude},${end.latitude}';
      final url =
          '$_osrmBaseUrl/$coordinates?overview=full&steps=true&geometries=geojson';

      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>?;
        if (data == null) {
          throw Exception('Empty response from routing service');
        }

        if (data['code'] != 'Ok') {
          throw Exception('Route not found: ${data['message'] ?? 'Unknown error'}');
        }

        final routes = data['routes'] as List?;
        if (routes == null || routes.isEmpty) {
          throw Exception('No route found in response');
        }

        final routeData = routes.first as Map<String, dynamic>;
        return NavigationRoute.fromOsrmRouteData(
          routeData,
          start: start,
          end: end,
        );
      } else if (response.statusCode == 400) {
        // Bad request: OSRM couldn't parse coordinates. Fall back to a simple straight-line route.
        try {
          final distanceMeters = calculateDistance(start, end);
          final durationSec = (distanceMeters / 11.111111).toInt(); // assume ~40 km/h -> 11.11 m/s
          final leg = RouteLeg.fromPoints(points: [start, end], distance: distanceMeters, duration: durationSec, summary: 'Direct');
          return NavigationRoute(start: start, end: end, legs: [leg], totalDistance: distanceMeters, totalDuration: durationSec);
        } catch (e) {
          throw Exception('Failed to get route (400) and fallback failed: ${e.toString()}');
        }
      } else {
        throw Exception('Failed to get route: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Navigation error: $e');
    }
  }

  /// Get a route that passes through the provided stops in the given order.
  Future<NavigationRoute> getRouteThroughStops({
    required List<NavigationPoint> stops,
  }) async {
    try {
      if (stops.length < 2) {
        throw Exception('At least two stops are required');
      }

      final coordinates = stops
          .map((stop) => '${stop.longitude},${stop.latitude}')
          .join(';');
      final url =
          '$_osrmBaseUrl/$coordinates?overview=full&steps=true&geometries=geojson&source=first&destination=last';

      final response = await http.get(Uri.parse(url));

      if (response.statusCode != 200) {
        throw Exception('Failed to get route: ${response.statusCode}');
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>?;
      if (data == null) {
        throw Exception('Empty response from routing service');
      }

      if (data['code'] != 'Ok') {
        throw Exception('Route not found: ${data['message'] ?? 'Unknown error'}');
      }

      final routes = data['routes'] as List?;
      if (routes == null || routes.isEmpty) {
        throw Exception('No route found in response');
      }

      final routeData = routes.first as Map<String, dynamic>;
      return NavigationRoute.fromOsrmRouteData(
        routeData,
        start: stops.first,
        end: stops.last,
      );
    } catch (e) {
      throw Exception('Navigation error: $e');
    }
  }

  /// Get an optimized trip through multiple stops.
  /// Keeps the first and last stops fixed and lets OSRM order the intermediates.
  Future<OptimizedRouteResult> getOptimizedRouteThroughStops({
    required List<NavigationPoint> stops,
  }) async {
    try {
      if (stops.length < 2) {
        throw Exception('At least two stops are required');
      }

      final coordinates = stops
          .map((stop) => '${stop.longitude},${stop.latitude}')
          .join(';');
      final url =
          'https://router.project-osrm.org/trip/v1/car/$coordinates?overview=full&steps=true&geometries=geojson&source=first&destination=last&roundtrip=false';

      final response = await http.get(Uri.parse(url));

      if (response.statusCode != 200) {
        if (response.statusCode == 400) {
          // fallback: return simple ordered stops route
          final distanceMeters = _sumDistancesBetween(stops);
          final durationSec = (distanceMeters / 11.111111).toInt();
          final leg = RouteLeg.fromPoints(points: stops, distance: distanceMeters, duration: durationSec, summary: 'Fallback optimized trip');
          final route = NavigationRoute(start: stops.first, end: stops.last, legs: [leg], totalDistance: distanceMeters, totalDuration: durationSec);
          return OptimizedRouteResult(route: route, orderedStops: stops);
        }
        throw Exception('Failed to get optimized route: ${response.statusCode}');
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>?;
      if (data == null) {
        throw Exception('Empty response from routing service');
      }

      if (data['code'] != 'Ok') {
        throw Exception('Optimized route not found: ${data['message'] ?? 'Unknown error'}');
      }

      final trips = data['trips'] as List?;
      if (trips == null || trips.isEmpty) {
        throw Exception('No optimized trip found');
      }

      final trip = trips.first as Map<String, dynamic>;
      final geometry = trip['geometry'] as Map<String, dynamic>?;
      final coordinatesData = geometry?['coordinates'] as List? ?? [];
      final points = coordinatesData
          .map((coord) {
            if (coord is List && coord.length >= 2) {
              return NavigationPoint(
                latitude: (coord[1] as num).toDouble(),
                longitude: (coord[0] as num).toDouble(),
              );
            }
            return null;
          })
          .whereType<NavigationPoint>()
          .toList();

      final waypointItems = (data['waypoints'] as List?) ?? [];
      final orderedPairs = <MapEntry<int, NavigationPoint>>[];

      for (var i = 0; i < waypointItems.length && i < stops.length; i++) {
        final waypoint = waypointItems[i];
        if (waypoint is! Map<String, dynamic>) continue;
        final index = waypoint['waypoint_index'] as num?;
        if (index == null) continue;
        orderedPairs.add(MapEntry(index.toInt(), stops[i]));
      }

      orderedPairs.sort((a, b) => a.key.compareTo(b.key));
      final orderedStops = orderedPairs.isNotEmpty
          ? orderedPairs.map((entry) => entry.value).toList()
          : stops;

      final route = NavigationRoute(
        start: orderedStops.first,
        end: orderedStops.last,
        legs: [
          RouteLeg.fromPoints(
            points: points,
            distance: (trip['distance'] as num?)?.toDouble() ?? 0.0,
            duration: (trip['duration'] as num?)?.toInt() ?? 0,
            summary: 'Optimized trip',
          ),
        ],
        totalDistance: (trip['distance'] as num?)?.toDouble() ?? 0.0,
        totalDuration: (trip['duration'] as num?)?.toInt() ?? 0,
      );

      return OptimizedRouteResult(
        route: route,
        orderedStops: orderedStops.isNotEmpty ? orderedStops : stops,
      );
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
        final data = jsonDecode(response.body) as Map<String, dynamic>?;
        if (data == null) {
          throw Exception('Empty response from routing service');
        }

        if (data['code'] != 'Ok') {
          throw Exception('Routes not found: ${data['message'] ?? 'Unknown error'}');
        }

        final routesData = data['routes'] as List?;
        if (routesData == null || routesData.isEmpty) {
          throw Exception('No routes found in response');
        }

        final routes = routesData
            .map((routeData) {
              if (routeData is! Map<String, dynamic>) return null;
              return NavigationRoute.fromOsrmRouteData(
                routeData,
                start: start,
                end: end,
              );
            })
            .whereType<NavigationRoute>()
            .toList();

        return routes;
      } else if (response.statusCode == 400) {
        // fallback: single straight-line route
        final distanceMeters = calculateDistance(start, end);
        final durationSec = (distanceMeters / 11.111111).toInt();
        final leg = RouteLeg.fromPoints(points: [start, end], distance: distanceMeters, duration: durationSec, summary: 'Direct');
        return [NavigationRoute(start: start, end: end, legs: [leg], totalDistance: distanceMeters, totalDuration: durationSec)];
      } else {
        throw Exception('Failed to get routes: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Navigation error: $e');
    }
  }

  double _sumDistancesBetween(List<NavigationPoint> points) {
    var total = 0.0;
    for (var i = 0; i < points.length - 1; i++) {
      total += calculateDistance(points[i], points[i + 1]);
    }
    return total;
  }

  /// Calculate straight-line distance between two points
  double calculateDistance(NavigationPoint p1, NavigationPoint p2) {
    const distance = Distance();
    return distance(
      LatLng(p1.latitude, p1.longitude),
      LatLng(p2.latitude, p2.longitude),
    );
  }

  /// Geocode a place name to coordinates using Nominatim (OpenStreetMap)
  Future<NavigationPoint> geocodePlace(String name) async {
    try {
      final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
        'q': name,
        'format': 'json',
        'limit': '1',
      });

      final response = await http.get(uri, headers: {
        'User-Agent': 'bus-terminal-app',
      });

      if (response.statusCode != 200) {
        throw Exception('Geocoding failed: ${response.statusCode}');
      }

      final list = jsonDecode(response.body) as List<dynamic>?;
      if (list == null || list.isEmpty) {
        throw Exception('No geocoding result for "$name"');
      }

      final item = list[0] as Map<String, dynamic>;
      final lat = double.parse(item['lat'] as String);
      final lon = double.parse(item['lon'] as String);
      final display = item['display_name'] as String? ?? name;

      return NavigationPoint(latitude: lat, longitude: lon, name: display);
    } catch (e) {
      throw Exception('Geocode error: $e');
    }
  }
}
