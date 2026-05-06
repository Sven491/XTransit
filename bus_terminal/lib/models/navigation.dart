import 'package:latlong2/latlong.dart';

/// Navigation route point
class NavigationPoint {
  final double latitude;
  final double longitude;
  final String? name;

  NavigationPoint({
    required this.latitude,
    required this.longitude,
    this.name,
  });

  LatLng toLatLng() => LatLng(latitude, longitude);

  factory NavigationPoint.fromLatLng(LatLng latlng, {String? name}) {
    return NavigationPoint(
      latitude: latlng.latitude,
      longitude: latlng.longitude,
      name: name,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
      'name': name,
    };
  }

  factory NavigationPoint.fromJson(Map<String, dynamic> json) {
    return NavigationPoint(
      latitude: json['latitude'] as double,
      longitude: json['longitude'] as double,
      name: json['name'] as String?,
    );
  }
}

/// Route leg with distance and duration
class RouteLeg {
  final List<NavigationPoint> points;
  final double distance; // in meters
  final int duration; // in seconds
  final String summary;

  RouteLeg({
    required this.points,
    required this.distance,
    required this.duration,
    required this.summary,
  });

  String getDistanceKm() => (distance / 1000).toStringAsFixed(1);
  String getDurationMinutes() => (duration ~/ 60).toString();

  factory RouteLeg.fromCoordinates(
    List<dynamic> coordinates, {
    double distance = 0.0,
    int duration = 0,
    String summary = 'Route',
  }) {
    return RouteLeg(
      points: coordinates
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
          .toList(),
      distance: distance,
      duration: duration,
      summary: summary,
    );
  }

  factory RouteLeg.fromPoints({
    required List<NavigationPoint> points,
    required double distance,
    required int duration,
    String summary = 'Route',
  }) {
    return RouteLeg(
      points: points,
      distance: distance,
      duration: duration,
      summary: summary,
    );
  }

  factory RouteLeg.fromJson(Map<String, dynamic> json) {
    final geometry = json['geometry'] as Map<String, dynamic>?;
    final coordinates = geometry?['coordinates'] as List? ?? [];
    
    return RouteLeg(
      points: coordinates
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
          .toList(),
      distance: (json['distance'] as num?)?.toDouble() ?? 0.0,
      duration: (json['duration'] as num?)?.toInt() ?? 0,
      summary: (json['summary'] as String?) ?? 'Route',
    );
  }
}

/// Complete navigation route from start to end
class NavigationRoute {
  final NavigationPoint start;
  final NavigationPoint end;
  final List<RouteLeg> legs;
  final double totalDistance; // in meters
  final int totalDuration; // in seconds

  NavigationRoute({
    required this.start,
    required this.end,
    required this.legs,
    required this.totalDistance,
    required this.totalDuration,
  });

  String getTotalDistanceKm() => (totalDistance / 1000).toStringAsFixed(1);
  String getTotalDurationMinutes() => (totalDuration ~/ 60).toString();
  String getTotalDurationHM() {
    final hours = totalDuration ~/ 3600;
    final minutes = (totalDuration % 3600) ~/ 60;
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }

  List<NavigationPoint> getAllPoints() {
    final allPoints = <NavigationPoint>[];
    for (final leg in legs) {
      allPoints.addAll(leg.points);
    }
    return allPoints;
  }

  factory NavigationRoute.fromJson(Map<String, dynamic> json) {
    final routes = json['routes'] as List?;
    if (routes == null || routes.isEmpty) {
      throw Exception('No route found in response');
    }

    final routeData = routes[0] as Map<String, dynamic>?;
    if (routeData == null) {
      throw Exception('Invalid route data');
    }

    return NavigationRoute.fromOsrmRouteData(
      routeData,
      start: NavigationPoint(latitude: 0, longitude: 0),
      end: NavigationPoint(latitude: 0, longitude: 0),
    );
  }

  factory NavigationRoute.fromOsrmRouteData(
    Map<String, dynamic> routeData, {
    required NavigationPoint start,
    required NavigationPoint end,
  }) {
    final geometry = routeData['geometry'] as Map<String, dynamic>?;
    final coordinates = geometry?['coordinates'] as List? ?? [];
    final distance = (routeData['distance'] as num?)?.toDouble() ?? 0.0;
    final duration = (routeData['duration'] as num?)?.toInt() ?? 0;

    final leg = RouteLeg.fromCoordinates(
      coordinates,
      distance: distance,
      duration: duration,
      summary: (routeData['summary'] as String?) ?? 'Route',
    );

    return NavigationRoute(
      start: start,
      end: end,
      legs: [leg],
      totalDistance: distance,
      totalDuration: duration,
    );
  }
}

/// Result of an optimized trip calculation with reordered stops.
class OptimizedRouteResult {
  final NavigationRoute route;
  final List<NavigationPoint> orderedStops;

  OptimizedRouteResult({
    required this.route,
    required this.orderedStops,
  });
}
