import 'package:flutter/material.dart';

/// Material 3 Theme configuratie voor bus_terminal
class AppTheme {
  // TODO: Implement Material 3 theme for bus drivers
  // - Large touch targets
  // - High contrast
  // - Clear visual hierarchy
  
  static ThemeData lightTheme() {
    return ThemeData(
      useMaterial3: true,
      // TODO: Configure Material 3 theme
    );
  }

  static ThemeData darkTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      // TODO: Configure Material 3 dark theme
    );
  }
}
