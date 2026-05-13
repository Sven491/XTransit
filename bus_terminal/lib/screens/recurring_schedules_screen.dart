// ignore_for_file: use_build_context_synchronously

import 'package:flutter/material.dart';
import '../models/schedule.dart' as sched;
import '../services/schedule_service.dart';

class RecurringSchedulesScreen extends StatefulWidget {
  const RecurringSchedulesScreen({super.key});

  @override
  State<RecurringSchedulesScreen> createState() => _RecurringSchedulesScreenState();
}

class _RecurringSchedulesScreenState extends State<RecurringSchedulesScreen> {
  final _scheduleService = ScheduleService();
  late Future<List<sched.ServiceSchedule>> _schedulesFuture;
  String _selectedSortBy = 'line'; // 'line', 'time', 'weekday'
  final Set<int> _expandedLineIds = {};

  @override
  void initState() {
    super.initState();
    _loadRecurringSchedules();
  }

  void _loadRecurringSchedules() {
    _schedulesFuture = _scheduleService.getRecurringSchedules();
  }

  String _formatWeekdays(List<int> weekdays) {
    const dayLabels = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
    if (weekdays.isEmpty) return 'Eenmalig';
    if (weekdays.length == 7) return 'Dagelijks';

    final sorted = weekdays.toSet().toList()..sort((a, b) => a.compareTo(b));
    return sorted.map((d) => dayLabels[d]).join(', ');
  }

  String _formatTime(DateTime dt) {
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  List<sched.ServiceSchedule> _sortSchedules(List<sched.ServiceSchedule> schedules) {
    final sorted = List<sched.ServiceSchedule>.from(schedules);

    switch (_selectedSortBy) {
      case 'line':
        sorted.sort((a, b) => a.lineNumber.compareTo(b.lineNumber));
        break;
      case 'time':
        sorted.sort((a, b) => a.startTime.compareTo(b.startTime));
        break;
      case 'weekday':
        sorted.sort((a, b) {
          final aFirst = a.weekdays.isEmpty ? 7 : a.weekdays.first;
          final bFirst = b.weekdays.isEmpty ? 7 : b.weekdays.first;
          return aFirst.compareTo(bFirst);
        });
        break;
    }

    return sorted;
  }

  Map<int, List<sched.ServiceSchedule>> _groupByLine(List<sched.ServiceSchedule> schedules) {
    final grouped = <int, List<sched.ServiceSchedule>>{};
    for (final schedule in schedules) {
      grouped.putIfAbsent(schedule.lineNumber, () => []).add(schedule);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vaste Diensten'),
        centerTitle: true,
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              setState(() => _selectedSortBy = value);
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'line',
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.sort_by_alpha, color: _selectedSortBy == 'line' ? colorScheme.primary : null),
                    const SizedBox(width: 8),
                    const Text('Lijn'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'time',
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.schedule, color: _selectedSortBy == 'time' ? colorScheme.primary : null),
                    const SizedBox(width: 8),
                    const Text('Tijd'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'weekday',
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.calendar_today, color: _selectedSortBy == 'weekday' ? colorScheme.primary : null),
                    const SizedBox(width: 8),
                    const Text('Weekdag'),
                  ],
                ),
              ),
            ],
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Icon(Icons.filter_list),
            ),
          ),
        ],
      ),
      body: FutureBuilder<List<sched.ServiceSchedule>>(
        future: _schedulesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: colorScheme.error),
                  const SizedBox(height: 16),
                  Text(
                    'Fout bij laden: ${snapshot.error}',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () {
                      setState(() => _loadRecurringSchedules());
                    },
                    child: const Text('Opnieuw proberen'),
                  ),
                ],
              ),
            );
          }

          final schedules = snapshot.data ?? [];

          if (schedules.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.event_note_outlined, size: 48, color: colorScheme.outline),
                  const SizedBox(height: 16),
                  Text(
                    'Geen vaste diensten gevonden',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
            );
          }

          final sortedSchedules = _sortSchedules(schedules);
          final groupedByLine = _groupByLine(sortedSchedules);

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
            itemCount: groupedByLine.length,
            itemBuilder: (context, lineIndex) {
              final lineNumber = groupedByLine.keys.toList()[lineIndex];
              final lineSchedules = groupedByLine[lineNumber] ?? [];
              final isExpanded = _expandedLineIds.contains(lineNumber);

              return Column(
                children: [
                  Card(
                    child: InkWell(
                      onTap: () {
                        setState(() {
                          if (isExpanded) {
                            _expandedLineIds.remove(lineNumber);
                          } else {
                            _expandedLineIds.add(lineNumber);
                          }
                        });
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Lijn $lineNumber',
                                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${lineSchedules.length} diensten',
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: colorScheme.outline,
                                      ),
                                ),
                              ],
                            ),
                            Icon(
                              isExpanded ? Icons.expand_less : Icons.expand_more,
                              color: colorScheme.primary,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (isExpanded)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: lineSchedules.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, scheduleIndex) {
                          final schedule = lineSchedules[scheduleIndex];
                          return _ScheduleCard(schedule: schedule, formatTime: _formatTime, formatWeekdays: _formatWeekdays);
                        },
                      ),
                    ),
                  const SizedBox(height: 8),
                ],
              );
            },
          );
        },
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  final sched.ServiceSchedule schedule;
  final String Function(DateTime) formatTime;
  final String Function(List<int>) formatWeekdays;

  const _ScheduleCard({
    required this.schedule,
    required this.formatTime,
    required this.formatWeekdays,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        schedule.busName,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: colorScheme.outline,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(
                  label: Text(
                    formatWeekdays(schedule.weekdays),
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  avatar: const Icon(Icons.calendar_today, size: 16),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
