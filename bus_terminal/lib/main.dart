import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/schedule_overview_screen.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';
import 'services/app_navigator.dart';

void main() {
  runApp(const MainApp());
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bus Terminal',
      navigatorKey: navigatorKey,
      scaffoldMessengerKey: messengerKey,
      theme: AppTheme.lightTheme(),
      darkTheme: AppTheme.darkTheme(),
      themeMode: ThemeMode.system,
      routes: {
        '/login': (context) => const LoginScreen(),
        '/schedule': (context) => const ScheduleOverviewScreen(),
      },
      home: const _InitialRoute(),
    );
  }
}

/// Initial route checks if user is logged in
class _InitialRoute extends StatelessWidget {
  const _InitialRoute();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: AuthService().isLoggedIn(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        
        // If logged in, go to schedule; otherwise go to login
        return snapshot.data == true 
            ? const ScheduleOverviewScreen() 
            : const LoginScreen();
      },
    );
  }
}
