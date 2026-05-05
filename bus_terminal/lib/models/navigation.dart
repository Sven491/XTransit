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

  factory RouteLeg.fromJson(Map<String, dynamic> json) {
    final coords = json['geometry']['coordinates'] as List;
    return RouteLeg(
      points: coords
          .map((coord) => NavigationPoint(
                latitude: coord[1] as double,
                longitude: coord[0] as double,
              ))
          .toList(),
      distance: (json['distance'] as num).toDouble(),
      duration: (json['duration'] as num).toInt(),
      summary: json['summary'] as String? ?? 'Route',
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
    final routes = json['routes'] as List;
    if (routes.isEmpty) {
      throw Exception('No route found');
    }

    final routeData = routes[0] as Map<String, dynamic>;
    final legs = (routeData['legs'] as List)
        .map((leg) => RouteLeg.fromJson(leg as Map<String, dynamic>))
        .toList();

    return NavigationRoute(
      start: NavigationPoint(latitude: 0, longitude: 0), // TODO: Set from request
      end: NavigationPoint(latitude: 0, longitude: 0), // TODO: Set from request
      legs: legs,
      totalDistance: (routeData['distance'] as num).toDouble(),
      totalDuration: (routeData['duration'] as num).toInt(),
    );
  }
}
