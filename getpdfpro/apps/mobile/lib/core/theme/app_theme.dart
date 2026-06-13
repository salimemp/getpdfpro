import 'package:flutter/material.dart';

/// App theme — light + dark, accessibility-friendly.
class AppTheme {
  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF0EA5E9), // sky-500
      brightness: brightness,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: brightness,
      visualDensity: VisualDensity.adaptivePlatformDensity,

      // Accessibility: minimum tap target 48x48
      materialTapTargetSize: MaterialTapTargetSize.padded,

      // High contrast for buttons
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),

      textTheme: TextTheme(
        bodyLarge: TextStyle(
          fontSize: 16,
          height: 1.5,
          color: isDark ? Colors.white : Colors.black87,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          height: 1.4,
          color: isDark ? Colors.white70 : Colors.black87,
        ),
      ),
    );
  }
}
