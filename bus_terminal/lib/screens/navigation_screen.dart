// ignore_for_file: deprecated_member_use

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/navigation.dart';
import '../models/schedule.dart' as schedule;
import '../services/navigation_service.dart';
import '../services/schedule_service.dart';

class NavigationScreen extends StatefulWidget {
  final schedule.Route route;
  final List<NavigationPoint>? initialStops;

  const NavigationScreen({
    super.key,
    required this.route,
    this.initialStops,
  });

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  final _navigationService = NavigationService();
  final _scheduleService = ScheduleService();
  late MapController _mapController;

  NavigationRoute? _currentRoute;
  NavigationPoint? _currentLocation;
  bool _isLoading = false;
  String? _errorMessage;
  List<NavigationRoute>? _alternativeRoutes;
  List<NavigationPoint>? _stops;
  String? _stopsFetchError;
  int _currentStopIndex = 0;
  final Set<int> _completedStops = {};

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

      // Use provided initial stops when available, otherwise fetch from API
      if (widget.initialStops != null) {
        _stops = widget.initialStops;
        _stopsFetchError = null;
      } else {
        try {
          _stops = await _scheduleService.getStops(widget.route.busLine.id);
          _stopsFetchError = null;
        } catch (e) {
          _stops = [];
          _stopsFetchError = e.toString().replaceAll('Exception: ', '');
        }
      }

      // Defensive: filter out invalid stops (missing/NaN coordinates) and deduplicate
      if (_stops != null) {
        _stops = _stops!
            .where((s) => s != null)
            .where((s) => s.latitude != null && s.longitude != null)
            .where((s) => s.latitude.isFinite && s.longitude.isFinite)
            .toList();

        // Remove exact duplicates by lat/lon
        final seen = <String>{};
        _stops = _stops!.where((s) {
          final key = '${s.latitude.toStringAsFixed(6)}|${s.longitude.toStringAsFixed(6)}';
          if (seen.contains(key)) return false;
          seen.add(key);
          return true;
        }).toList();
      }

      // Determine start and end points: prefer stop locations if available.
      // If no stops are returned from the API, geocode the stop names.
      late NavigationPoint startPoint;
      late NavigationPoint endPoint;

      if (_stops != null && _stops!.length >= 2) {
        final optimized = await _navigationService.getOptimizedRouteThroughStops(stops: _stops!);
        _stops = optimized.orderedStops;
        startPoint = _stops!.first;
        endPoint = _stops!.last;

        if (mounted) {
          setState(() {
            _currentRoute = optimized.route;
            // limit alternatives to first two to avoid rendering many polylines
            _alternativeRoutes = null;
            _isLoading = false;
          });

          _fitMapToRoute(optimized.route);
        }

        return;
      } else if (_stops != null && _stops!.length == 1) {
        // With exactly one linked stop, force that stop into the route as start
        // so the marker is guaranteed to be in-view.
        startPoint = _stops!.first;

        try {
          endPoint = await _navigationService.geocodePlace(widget.route.busLine.endStop);
        } catch (_) {
          endPoint = NavigationPoint(
            latitude: startPoint.latitude + 0.01,
            longitude: startPoint.longitude + 0.01,
            name: widget.route.busLine.endStop,
          );
        }
      } else {
        // Try geocoding names; fall back to conservative defaults on failure
        try {
          startPoint = await _navigationService.geocodePlace(widget.route.busLine.startStop);
        } catch (_) {
          startPoint = NavigationPoint(
            latitude: 52.5200,
            longitude: 13.4050,
            name: widget.route.busLine.startStop,
          );
        }

        try {
          endPoint = await _navigationService.geocodePlace(widget.route.busLine.endStop);
        } catch (_) {
          endPoint = NavigationPoint(
            latitude: 52.5300,
            longitude: 13.4150,
            name: widget.route.busLine.endStop,
          );
        }
      }

      // Get route without waypoints
      final navRoute = await _navigationService.getRoute(start: startPoint, end: endPoint);

      // Get alternative routes (but cap to a small number)
      final alternatives = await _navigationService.getMultipleRoutes(start: startPoint, end: endPoint);

      if (mounted) {
        setState(() {
          _currentRoute = navRoute;
          _alternativeRoutes = (alternatives ?? []).take(2).toList();
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
    // Build list of points to include in bounds, filter invalids
    final allPoints = <LatLng>[];
    allPoints.addAll(route.getAllPoints().where((p) => p.latitude.isFinite && p.longitude.isFinite).map((point) => LatLng(point.latitude, point.longitude)));
    allPoints.addAll((_stops ?? []).where((s) => s.latitude.isFinite && s.longitude.isFinite).map((stop) => LatLng(stop.latitude, stop.longitude)));
    if (_currentLocation != null && _currentLocation!.latitude.isFinite && _currentLocation!.longitude.isFinite) {
      allPoints.add(LatLng(_currentLocation!.latitude, _currentLocation!.longitude));
    }

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

    // Clamp bounds to a reasonable maximum span to avoid huge map tiles requests
    const double maxSpanDegrees = 2.0; // ~222km lat span per degree ~111km; 2 degrees ~222km
    final latSpan = maxLat - minLat;
    final lonSpan = maxLon - minLon;

    double centerLat = (minLat + maxLat) / 2.0;
    double centerLon = (minLon + maxLon) / 2.0;

    double halfLat = latSpan / 2.0;
    double halfLon = lonSpan / 2.0;

    if (latSpan > maxSpanDegrees) halfLat = maxSpanDegrees / 2.0;
    if (lonSpan > maxSpanDegrees) halfLon = maxSpanDegrees / 2.0;

    final clampedMinLat = centerLat - halfLat;
    final clampedMaxLat = centerLat + halfLat;
    final clampedMinLon = centerLon - halfLon;
    final clampedMaxLon = centerLon + halfLon;

    final bounds = LatLngBounds(
      LatLng(clampedMinLat, clampedMinLon),
      LatLng(clampedMaxLat, clampedMaxLon),
    );

    _mapController.fitBounds(
      bounds,
      options: const FitBoundsOptions(padding: EdgeInsets.all(100)),
    );
  }

  int _nextUncompletedStopIndex([int startIndex = 0]) {
    if (_stops == null || _stops!.isEmpty) return 0;

    for (var index = startIndex; index < _stops!.length; index++) {
      if (!_completedStops.contains(index)) {
        return index;
      }
    }

    return _stops!.length - 1;
  }

  Future<void> _refreshRouteFromIndex(int index) async {
    if (_stops == null || _stops!.isEmpty) return;
    if (index < 0 || index >= _stops!.length) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _currentStopIndex = index;
    });

    try {
      final remainingStops = _stops!.sublist(index);
      final navRoute = remainingStops.length >= 2
          ? await _navigationService.getRouteThroughStops(stops: remainingStops)
          : _currentRoute;

      if (mounted) {
        setState(() {
          if (navRoute != null) {
            _currentRoute = navRoute;
          }
          _alternativeRoutes = null;
          _isLoading = false;
        });

        if (navRoute != null) {
          _fitMapToRoute(navRoute);
        }
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

  Future<void> _focusStop(int index) async {
    if (_stops == null || _stops!.isEmpty) return;
    if (index < 0 || index >= _stops!.length) return;
    await _refreshRouteFromIndex(index);
  }

  Future<void> _markStopCompleted(int index) async {
    if (_stops == null || _stops!.isEmpty) return;
    if (index < 0 || index >= _stops!.length) return;

    setState(() {
      _completedStops.add(index);
    });

    final nextIndex = _nextUncompletedStopIndex(index + 1);
    await _refreshRouteFromIndex(nextIndex);
  }

  double get _routeProgress {
    if (_stops == null || _stops!.isEmpty) return 0;
    if (_stops!.length == 1) return 1;
    return _currentStopIndex / (_stops!.length - 1);
  }

  Color get _routeColor => Color.lerp(Colors.blue, Colors.orange, _routeProgress) ?? Colors.blue;

  Color _stopColor(int index) {
    if (_completedStops.contains(index) || index < _currentStopIndex) return Colors.green;
    if (index == _currentStopIndex) return Colors.orange;
    return Colors.blueGrey;
  }

  IconData _stopIcon(int index) {
    if (_completedStops.contains(index) || index < _currentStopIndex) return Icons.check_circle;
    if (index == _currentStopIndex) return Icons.radio_button_checked;
    return Icons.location_on;
  }

  bool _isStopCompleted(int index) => _completedStops.contains(index) || index < _currentStopIndex;

  bool _hasStopNearPoint(NavigationPoint point, {double threshold = 0.00005}) {
    if (_stops == null || _stops!.isEmpty) return false;

    for (final stop in _stops!) {
      final latDiff = (stop.latitude - point.latitude).abs();
      final lonDiff = (stop.longitude - point.longitude).abs();
      if (latDiff <= threshold && lonDiff <= threshold) {
        return true;
      }
    }
    return false;
  }

  NavigationPoint? get _currentStopPoint {
    if (_stops == null || _stops!.isEmpty) return null;
    return _stops![_currentStopIndex.clamp(0, _stops!.length - 1)];
  }

  NavigationPoint? get _nextStopPoint {
    if (_stops == null || _stops!.isEmpty) return null;
    final nextIndex = _nextUncompletedStopIndex(_currentStopIndex + 1);
    return _stops![nextIndex.clamp(0, _stops!.length - 1)];
  }

  double get _completionRatio {
    if (_stops == null || _stops!.isEmpty) return 0;
    return _completedStops.length / _stops!.length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Route ${widget.route.busLine.lineNumber} Navigation'),
        elevation: 0,
      ),
      body: Row(
        children: [
          // Map area (left pane)
          Expanded(
            flex: 6,
            child: _currentRoute != null
                ? FlutterMap(
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
                          ...(_stops ?? []).asMap().entries.map((entry) {
                            final index = entry.key;
                            final stop = entry.value;
                            final color = _stopColor(index);

                            return Marker(
                              point: LatLng(stop.latitude, stop.longitude),
                              width: 46,
                              height: 46,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: color,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 3,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.22),
                                      blurRadius: 10,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    Icon(
                                      _stopIcon(index),
                                      color: Colors.white,
                                      size: 20,
                                    ),
                                    Positioned(
                                      bottom: 4,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: Colors.black.withOpacity(0.35),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          '${index + 1}',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                          // Start marker
                          if (!_hasStopNearPoint(_currentRoute!.start))
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
                          if (!_hasStopNearPoint(_currentRoute!.end))
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
                            color: _routeColor,
                            strokeWidth: 5,
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
                : (_isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : Center(
                        child: _errorMessage != null
                            ? Column(
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
                                    style:
                                        Theme.of(context).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    _errorMessage!,
                                    style: Theme.of(context).textTheme.bodySmall,
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              )
                            : const Text('No route'))),
          ),

          // Vertical divider
          Container(width: 1, color: Colors.grey[200]),

          // Stops / Info panel (right pane)
          Expanded(
            flex: 4,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(-2, 0),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0F172A), Color(0xFF1D4ED8)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.12),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.18),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.route,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Route ${widget.route.busLine.lineNumber}',
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                          ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${widget.route.busLine.startStop} → ${widget.route.busLine.endStop}',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                            color: Colors.white.withOpacity(0.85),
                                          ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              minHeight: 10,
                              value: _completionRatio,
                              backgroundColor: Colors.white.withOpacity(0.12),
                              valueColor: const AlwaysStoppedAnimation<Color>(Colors.amberAccent),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${(_completionRatio * 100).round()}% afgerond',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                              Text(
                                '${_completedStops.length}/${_stops?.length ?? 0} stops',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Colors.white.withOpacity(0.85),
                                    ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: _buildSummaryPill(
                                  'Huidig',
                                  _currentStopPoint?.name ?? 'Geen stop',
                                  Icons.radio_button_checked,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _buildSummaryPill(
                                  'Volgend',
                                  _nextStopPoint?.name ?? 'Einde route',
                                  Icons.skip_next,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: const Color(0xFF0F172A),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              onPressed: _stops == null || _stops!.isEmpty || _isStopCompleted(_currentStopIndex)
                                  ? null
                                  : () => _markStopCompleted(_currentStopIndex),
                              icon: const Icon(Icons.check_circle_outline),
                              label: const Text('Markeer huidige stop afgerond'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          _legendDot(Colors.green, 'Afgerond'),
                          const SizedBox(width: 12),
                          _legendDot(Colors.orange, 'Actief'),
                          const SizedBox(width: 12),
                          _legendDot(Colors.blueGrey, 'Te doen'),
                        ],
                      ),
                    ),
                    if (_stopsFetchError != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.red.withOpacity(0.25)),
                        ),
                        child: Text(
                          'Stops konden niet geladen worden voor buslijn ${widget.route.busLine.id}: $_stopsFetchError',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Text(
                      'Stops',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: _stops == null || _stops!.isEmpty
                          ? Center(
                              child: Text(
                                'No stops available for this line',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            )
                          : ListView.separated(
                              itemCount: _stops!.length,
                              separatorBuilder: (_, __) => const Divider(),
                              itemBuilder: (context, index) {
                                final s = _stops![index];
                                final color = _stopColor(index);
                                final completed = _isStopCompleted(index);
                                final isCurrent = index == _currentStopIndex;
                                return ListTile(
                                  leading: CircleAvatar(
                                    radius: 14,
                                    backgroundColor: color,
                                    child: Icon(
                                      _stopIcon(index),
                                      color: Colors.white,
                                      size: 16,
                                    ),
                                  ),
                                  title: Text(s.name ?? 'Stop ${index + 1}'),
                                  subtitle: Text('${s.latitude.toStringAsFixed(5)}, ${s.longitude.toStringAsFixed(5)}'),
                                  trailing: completed
                                      ? const Chip(
                                          label: Text('Afgerond'),
                                          visualDensity: VisualDensity.compact,
                                        )
                                      : TextButton.icon(
                                          onPressed: () => _markStopCompleted(index),
                                          icon: const Icon(Icons.check, size: 18),
                                          label: Text(isCurrent ? 'Afronden' : 'Klaarzetten'),
                                        ),
                                  onTap: () => _focusStop(index),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _buildSummaryPill(String title, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.16)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.white.withOpacity(0.75),
                        letterSpacing: 0.2,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
