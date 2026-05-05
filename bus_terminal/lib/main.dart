import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/daily_schedule_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const MainApp());
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bus Terminal',
      theme: AppTheme.lightTheme(),
      darkTheme: AppTheme.darkTheme(),
      themeMode: ThemeMode.system,
      routes: {
        '/login': (context) => const LoginScreen(),
        '/schedule': (context) => const DailyScheduleScreen(),
      },
      home: const LoginScreen(),
    );
  }
}
