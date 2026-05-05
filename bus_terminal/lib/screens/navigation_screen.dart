// ignore_for_file: deprecated_member_use

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/navigation.dart';
import '../models/schedule.dart' as schedule;
import '../services/navigation_service.dart';

class NavigationScreen extends StatefulWidget {
  final schedule.Route route;

  const NavigationScreen({
    super.key,
    required this.route,
  });

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  final _navigationService = NavigationService();
  late MapController _mapController;

  NavigationRoute? _currentRoute;
  NavigationPoint? _currentLocation;
  bool _isLoading = false;
  String? _errorMessage;
  List<NavigationRoute>? _alternativeRoutes;

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _initializeNavigation();
  }

  Future<void> _initializeNavigation() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Get current location
      final currentLoc = await _navigationService.getCurrentLocation();
      setState(() => _currentLocation = currentLoc);

      // For demo: use the bus line start stop coordinates
      // In production, fetch actual GPS coordinates for stops
      final startPoint = NavigationPoint(
        latitude: 52.5200,
        longitude: 13.4050,
        name: widget.route.busLine.startStop,
      );

      final endPoint = NavigationPoint(
        latitude: 52.5300,
        longitude: 13.4150,
        name: widget.route.busLine.endStop,
      );

      // Get route
      final navRoute = await _navigationService.getRoute(
        start: startPoint,
        end: endPoint,
      );

      // Get alternative routes
      final alternatives = await _navigationService.getMultipleRoutes(
        start: startPoint,
        end: endPoint,
      );

      if (mounted) {
        setState(() {
          _currentRoute = navRoute;
          _alternativeRoutes = alternatives;
          _isLoading = false;
        });

        // Fit map to route bounds
        _fitMapToRoute(navRoute);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  void _fitMapToRoute(NavigationRoute route) {
    final allPoints = route.getAllPoints();
    if (allPoints.isEmpty) return;

    double minLat = allPoints.first.latitude;
    double maxLat = allPoints.first.latitude;
    double minLon = allPoints.first.longitude;
    double maxLon = allPoints.first.longitude;

    for (final point in allPoints) {
      minLat = min(minLat, point.latitude);
      maxLat = max(maxLat, point.latitude);
      minLon = min(minLon, point.longitude);
      maxLon = max(maxLon, point.longitude);
    }

    final bounds = LatLngBounds(
      LatLng(minLat, minLon),
      LatLng(maxLat, maxLon),
    );

    _mapController.fitBounds(
      bounds,
      options: const FitBoundsOptions(padding: EdgeInsets.all(100)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Route ${widget.route.busLine.lineNumber} Navigation'),
        elevation: 0,
      ),
      body: Stack(
        children: [
          // Map
          if (_currentRoute != null)
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: LatLng(
                  _currentRoute!.start.latitude,
                  _currentRoute!.start.longitude,
                ),
                initialZoom: 13.0,
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.bus_terminal',
                ),
                MarkerLayer(
                  markers: [
                    // Start marker
                    Marker(
                      point: LatLng(
                        _currentRoute!.start.latitude,
                        _currentRoute!.start.longitude,
                      ),
                      width: 40,
                      height: 40,
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.green,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white,
                            width: 2,
                          ),
                        ),
                        child: const Icon(
                          Icons.location_on,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                    // End marker
                    Marker(
                      point: LatLng(
                        _currentRoute!.end.latitude,
                        _currentRoute!.end.longitude,
                      ),
                      width: 40,
                      height: 40,
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white,
                            width: 2,
                          ),
                        ),
                        child: const Icon(
                          Icons.location_on,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                    // Current location marker
                    if (_currentLocation != null)
                      Marker(
                        point: LatLng(
                          _currentLocation!.latitude,
                          _currentLocation!.longitude,
                        ),
                        width: 30,
                        height: 30,
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.blue,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white,
                              width: 2,
                            ),
                          ),
                          child: const Icon(
                            Icons.directions_bus,
                            color: Colors.white,
                            size: 16,
                          ),
                        ),
                      ),
                  ],
                ),
                PolylineLayer(
                  polylines: [
                    // Main route
                    Polyline(
                      points: _currentRoute!
                          .getAllPoints()
                          .map((p) => LatLng(p.latitude, p.longitude))
                          .toList(),
                      color: Colors.blue,
                      strokeWidth: 4,
                    ),
                    // Alternative routes (lighter)
                    if (_alternativeRoutes != null)
                      ...List.generate(
                        _alternativeRoutes!.length,
                        (i) => Polyline(
                          points: _alternativeRoutes![i]
                              .getAllPoints()
                              .map((p) => LatLng(p.latitude, p.longitude))
                              .toList(),
                          color: Colors.grey.withOpacity(0.5),
                          strokeWidth: 2,
                        ),
                      ),
                  ],
                ),
              ],
            )
          else if (_isLoading)
            const Center(child: CircularProgressIndicator())
          else if (_errorMessage != null)
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.error_outline,
                    size: 64,
                    color: Colors.red[300],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Failed to load route',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _errorMessage!,
                    style: Theme.of(context).textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

          // Route info panel
          if (_currentRoute != null)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(16),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 10,
                      offset: const Offset(0, -2),
                    ),
                  ],
                ),
                child: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Route title
                        Text(
                          'Route Summary',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 16),

                        // Route info row
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            Column(
                              children: [
                                Icon(
                                  Icons.straighten,
                                  size: 32,
                                  color: Colors.blue,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '${_currentRoute!.getTotalDistanceKm()} km',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            Column(
                              children: [
                                Icon(
                                  Icons.timer,
                                  size: 32,
                                  color: Colors.orange,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _currentRoute!.getTotalDurationHM(),
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            Column(
                              children: [
                                Icon(
                                  Icons.speed,
                                  size: 32,
                                  color: Colors.green,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '${(_currentRoute!.totalDistance / _currentRoute!.totalDuration * 3.6).toStringAsFixed(0)} km/h',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Route details
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    Icons.location_on,
                                    color: Colors.green,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'From: ${_currentRoute!.start.name}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(
                                    Icons.location_on,
                                    color: Colors.red,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'To: ${_currentRoute!.end.name}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
