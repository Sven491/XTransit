/// Bus Line model
class BusLine {
  final int id;
  final int lineNumber;
  final String startStop;
  final String endStop;
  final int estimatedDuration; // in minutes
  final String? description;

  BusLine({
    required this.id,
    required this.lineNumber,
    required this.startStop,
    required this.endStop,
    required this.estimatedDuration,
    this.description,
  });

  factory BusLine.fromJson(Map<String, dynamic> json) {
    return BusLine(
      id: json['id'] as int,
      lineNumber: json['lineNumber'] as int,
      startStop: json['startStop'] as String,
      endStop: json['endStop'] as String,
      estimatedDuration: json['estimatedDuration'] as int,
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'lineNumber': lineNumber,
      'startStop': startStop,
      'endStop': endStop,
      'estimatedDuration': estimatedDuration,
      'description': description,
    };
  }
}

/// Bus type model
class BusType {
  final int id;
  final String name;
  final int seatCapacity;
  final String licensePlate;

  BusType({
    required this.id,
    required this.name,
    required this.seatCapacity,
    required this.licensePlate,
  });

  factory BusType.fromJson(Map<String, dynamic> json) {
    return BusType(
      id: json['id'] as int,
      name: json['name'] as String,
      seatCapacity: json['seatCapacity'] as int,
      licensePlate: json['licensePlate'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'seatCapacity': seatCapacity,
      'licensePlate': licensePlate,
    };
  }
}

/// Route model for daily schedule
class Route {
  final int id;
  final BusLine busLine;
  final BusType busType;
  final DateTime startTime;
  final DateTime? endTime;
  final String status; // scheduled, in_progress, completed, cancelled

  Route({
    required this.id,
    required this.busLine,
    required this.busType,
    required this.startTime,
    this.endTime,
    required this.status,
  });

  factory Route.fromJson(Map<String, dynamic> json) {
    return Route(
      id: json['id'] as int,
      busLine: BusLine.fromJson(json['busLine'] as Map<String, dynamic>),
      busType: BusType.fromJson(json['busType'] as Map<String, dynamic>),
      startTime: DateTime.parse(json['startTime'] as String),
      endTime:
          json['endTime'] != null ? DateTime.parse(json['endTime'] as String) : null,
      status: json['status'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'busLine': busLine.toJson(),
      'busType': busType.toJson(),
      'startTime': startTime.toIso8601String(),
      'endTime': endTime?.toIso8601String(),
      'status': status,
    };
  }
}

/// Daily schedule model
class DailySchedule {
  final List<Route> routes;
  final DateTime date;

  DailySchedule({
    required this.routes,
    required this.date,
  });

  factory DailySchedule.fromJson(Map<String, dynamic> json) {
    return DailySchedule(
      routes: (json['routes'] as List)
          .map((r) => Route.fromJson(r as Map<String, dynamic>))
          .toList(),
      date: DateTime.parse(json['date'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'routes': routes.map((r) => r.toJson()).toList(),
      'date': date.toIso8601String(),
    };
  }
}
