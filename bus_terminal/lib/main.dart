import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/schedule_overview_screen.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';
import 'services/app_navigator.dart';
import 'services/error_log_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    void report() => ErrorLogService.report(
      service: 'bus_terminal',
      partOfService: 'FlutterError.onError',
      error: details.exceptionAsString(),
    );
    // ignore: unawaited_futures
    report();
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    // ignore: unawaited_futures
    ErrorLogService.report(
      service: 'bus_terminal',
      partOfService: 'PlatformDispatcher.onError',
      error: '$error\n$stack',
    );
    return true;
  };

  runZonedGuarded(() {
    runApp(const MainApp());
  }, (error, stack) {
    // ignore: unawaited_futures
    ErrorLogService.report(
      service: 'bus_terminal',
      partOfService: 'runZonedGuarded',
      error: '$error\n$stack',
    );
  });
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
