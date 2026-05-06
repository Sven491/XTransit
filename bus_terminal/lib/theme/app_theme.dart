import 'package:flutter/material.dart';

/// Material 3 Theme configuratie voor bus_terminal
class AppTheme {
  static const Color _navy = Color(0xFF0F172A);
  static const Color _surface = Color(0xFFF8FAFC);
  static const Color _surfaceDark = Color(0xFF111827);
  static const Color _amber = Color(0xFFF59E0B);
  static const Color _cyan = Color(0xFF38BDF8);
  static const Color _success = Color(0xFF22C55E);
  static const Color _error = Color(0xFFEF4444);

  static TextTheme _textTheme(ColorScheme colorScheme) {
    return TextTheme(
      displayLarge: const TextStyle(fontSize: 46, fontWeight: FontWeight.w800, letterSpacing: -1.2),
      displayMedium: const TextStyle(fontSize: 38, fontWeight: FontWeight.w800, letterSpacing: -0.9),
      headlineLarge: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: -0.4),
      headlineMedium: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.3),
      titleLarge: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
      titleMedium: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      titleSmall: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      bodyLarge: TextStyle(fontSize: 16, height: 1.45, color: colorScheme.onSurface),
      bodyMedium: TextStyle(fontSize: 14, height: 1.45, color: colorScheme.onSurfaceVariant),
      bodySmall: TextStyle(fontSize: 12, height: 1.35, color: colorScheme.onSurfaceVariant),
      labelLarge: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      labelMedium: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      labelSmall: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.25),
    );
  }

  static ColorScheme _buildLightScheme() {
    return ColorScheme.fromSeed(
      seedColor: _cyan,
      brightness: Brightness.light,
      primary: _navy,
      secondary: _amber,
      tertiary: _cyan,
      surface: _surface,
      onSurface: _navy,
      error: _error,
    ).copyWith(
      surfaceContainerHighest: const Color(0xFFE2E8F0),
      outline: const Color(0xFF94A3B8),
    );
  }

  static ColorScheme _buildDarkScheme() {
    return ColorScheme.fromSeed(
      seedColor: _cyan,
      brightness: Brightness.dark,
      primary: _cyan,
      secondary: _amber,
      tertiary: _success,
      surface: _surfaceDark,
      onSurface: Colors.white,
      error: _error,
    ).copyWith(
      surfaceContainerHighest: const Color(0xFF1F2937),
      outline: const Color(0xFF334155),
    );
  }
  
  static ThemeData lightTheme() {
    final colorScheme = _buildLightScheme();
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFFF1F5F9),
      textTheme: _textTheme(colorScheme),
      appBarTheme: AppBarTheme(
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: _textTheme(colorScheme).titleLarge?.copyWith(color: colorScheme.onSurface),
      ),
      cardTheme: CardThemeData(
        color: colorScheme.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: DividerThemeData(color: colorScheme.outline.withOpacity(0.18), thickness: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: colorScheme.outline.withOpacity(0.25))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: colorScheme.outline.withOpacity(0.25))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: colorScheme.primary, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: colorScheme.error)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        labelStyle: TextStyle(color: colorScheme.onSurfaceVariant),
        hintStyle: TextStyle(color: colorScheme.onSurfaceVariant.withOpacity(0.8)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: colorScheme.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colorScheme.secondary,
          foregroundColor: colorScheme.onSecondary,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colorScheme.onSurface,
          minimumSize: const Size.fromHeight(52),
          side: BorderSide(color: colorScheme.outline.withOpacity(0.35)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: colorScheme.surfaceContainerHighest,
        labelStyle: TextStyle(color: colorScheme.onSurface, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: colorScheme.primary,
        linearTrackColor: colorScheme.primary.withOpacity(0.12),
      ),
    );
  }

  static ThemeData darkTheme() {
    final colorScheme = _buildDarkScheme();
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFF0B1220),
      textTheme: _textTheme(colorScheme).apply(bodyColor: Colors.white, displayColor: Colors.white),
      appBarTheme: AppBarTheme(
        backgroundColor: const Color(0xFF0B1220),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: _textTheme(colorScheme).titleLarge?.copyWith(color: Colors.white),
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFF111827),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: const DividerThemeData(color: Color(0xFF243244), thickness: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFF111827),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF334155))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF334155))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: colorScheme.primary, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: colorScheme.error)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        labelStyle: const TextStyle(color: Color(0xFFCBD5E1)),
        hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: colorScheme.primary,
          foregroundColor: Colors.black,
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colorScheme.secondary,
          foregroundColor: Colors.black,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          side: const BorderSide(color: Color(0xFF334155)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0xFF1E293B),
        labelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: colorScheme.primary,
        linearTrackColor: colorScheme.primary.withOpacity(0.16),
      ),
    );
  }
}
