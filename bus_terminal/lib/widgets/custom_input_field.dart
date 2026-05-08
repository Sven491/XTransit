import 'package:flutter/material.dart';

/// Custom input field optimized for bus drivers
/// - Large touch targets (40+ height)
/// - Clear visibility
/// - Accessible design
class CustomInputField extends StatefulWidget {
  final String label;
  final String hint;
  final TextEditingController controller;
  final bool obscureText;
  final TextInputType keyboardType;
  final String? Function(String?)? validator;

  const CustomInputField({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.validator,
  });

  @override
  State<CustomInputField> createState() => _CustomInputFieldState();
}

class _CustomInputFieldState extends State<CustomInputField> {
  late bool _obscureText;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.obscureText;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: widget.controller,
          obscureText: _obscureText,
          keyboardType: widget.keyboardType,
          validator: widget.validator,
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 16, // Larger vertical padding for touch targets
            ),
            prefixIcon: Icon(
              widget.obscureText ? Icons.lock_outline : Icons.badge_outlined,
              color: colorScheme.primary,
            ),
            filled: true,
            fillColor: colorScheme.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: colorScheme.outline.withOpacity(0.25)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: colorScheme.outline.withOpacity(0.25)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: colorScheme.primary, width: 2),
            ),
            suffixIcon: widget.obscureText
                ? IconButton(
                    tooltip: _obscureText ? 'Toon wachtwoord' : 'Verberg wachtwoord',
                    onPressed: () {
                      setState(() => _obscureText = !_obscureText);
                    },
                    icon: Icon(
                      _obscureText ? Icons.visibility_off : Icons.visibility,
                      size: 28, // Larger icon for accessibility
                      color: colorScheme.primary,
                    ),
                    splashRadius: 24,
                    constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                  )
                : null,
          ),
          style: Theme.of(context).textTheme.bodyLarge,
        ),
      ],
    );
  }
}
