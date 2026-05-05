import 'package:flutter/material.dart';
import '../models/schedule.dart';
import '../services/schedule_service.dart';
import '../widgets/route_card.dart';

class DailyScheduleScreen extends StatefulWidget {
  const DailyScheduleScreen({super.key});

  @override
  State<DailyScheduleScreen> createState() => _DailyScheduleScreenState();
}

class _DailyScheduleScreenState extends State<DailyScheduleScreen> {
  final _scheduleService = ScheduleService();
  late Future<DailySchedule> _scheduleFuture;
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _scheduleFuture = _scheduleService.getTodaySchedule();
  }

  Future<void> _refreshSchedule() async {
    setState(() {
      _scheduleFuture = _scheduleService.getDailySchedule(_selectedDate);
    });
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            dialogBackgroundColor: Colors.white,
          ),
          child: child!,
        );
      },
    );

    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
      _refreshSchedule();
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateStr =
        '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
    final isToday = DateTime(
          _selectedDate.year,
          _selectedDate.month,
          _selectedDate.day,
        ) ==
        DateTime(
          DateTime.now().year,
          DateTime.now().month,
          DateTime.now().day,
        );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Schedule'),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Date selector
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isToday ? 'Today' : 'Scheduled Date',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: Colors.grey[600],
                          ),
                    ),
                    Text(
                      dateStr,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ),
                OutlinedButton.icon(
                  onPressed: _selectDate,
                  icon: const Icon(Icons.calendar_today),
                  label: const Text('Change'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(),

          // Routes list
          Expanded(
            child: FutureBuilder<DailySchedule>(
              future: _scheduleFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(),
                  );
                }

                if (snapshot.hasError) {
                  return Center(
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
                          'Failed to load schedule',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          snapshot.error.toString(),
                          style: Theme.of(context).textTheme.bodySmall,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),
                        FilledButton.icon(
                          onPressed: _refreshSchedule,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  );
                }

                if (!snapshot.hasData || snapshot.data!.routes.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.calendar_today,
                          size: 64,
                          color: Colors.grey[300],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No routes scheduled',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Check back later for your schedule',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Colors.grey[600],
                              ),
                        ),
                      ],
                    ),
                  );
                }

                final schedule = snapshot.data!;
                final routes = schedule.routes;

                // Separate routes by status
                final scheduledRoutes = routes
                    .where((r) => r.status == 'scheduled')
                    .toList();
                final inProgressRoutes = routes
                    .where((r) => r.status == 'in_progress')
                    .toList();
                final completedRoutes = routes
                    .where((r) => r.status == 'completed')
                    .toList();

                return RefreshIndicator(
                  onRefresh: _refreshSchedule,
                  child: ListView(
                    children: [
                      // In Progress section
                      if (inProgressRoutes.isNotEmpty) ...[
                        Padding(
                          padding: const EdgeInsets.only(
                            left: 16,
                            top: 24,
                            bottom: 8,
                          ),
                          child: Text(
                            'In Progress',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.orange,
                                ),
                          ),
                        ),
                        ...inProgressRoutes.map((route) => RouteCard(
                          route: route,
                          onTap: () {},
                        )),
                      ],

                      // Scheduled section
                      if (scheduledRoutes.isNotEmpty) ...[
                        Padding(
                          padding: const EdgeInsets.only(
                            left: 16,
                            top: 24,
                            bottom: 8,
                          ),
                          child: Text(
                            'Scheduled',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.blue,
                                ),
                          ),
                        ),
                        ...scheduledRoutes.map((route) => RouteCard(
                          route: route,
                          onTap: () {},
                        )),
                      ],

                      // Completed section
                      if (completedRoutes.isNotEmpty) ...[
                        Padding(
                          padding: const EdgeInsets.only(
                            left: 16,
                            top: 24,
                            bottom: 8,
                          ),
                          child: Text(
                            'Completed',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green,
                                ),
                          ),
                        ),
                        ...completedRoutes.map((route) => RouteCard(
                          route: route,
                          onTap: () {},
                        )),
                      ],

                      const SizedBox(height: 16),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
