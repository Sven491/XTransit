import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/custom_input_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _userCodeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authService = AuthService();

  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _userCodeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final input = _userCodeController.text.trim();
      final parsedUserCode = int.tryParse(input);
      if (parsedUserCode == null) {
        throw Exception('User code must be a number');
      }

      await _authService.login(
        userCode: parsedUserCode,
        password: _passwordController.text,
      );

      if (mounted) {
        // Navigate to daily schedule screen
        Navigator.of(context).pushReplacementNamed('/schedule');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String? _validateUserCode(String? value) {
    final v = value?.trim();
    if (v?.isEmpty ?? true) {
      return 'User code is required';
    }
    if (int.tryParse(v!) == null) {
      return 'User code must be a number';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value?.isEmpty ?? true) {
      return 'Password is required';
    }
    if ((value?.length ?? 0) < 3) {
      return 'Password must be at least 3 characters';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: Theme.of(context).brightness == Brightness.dark
                ? const [Color(0xFF0B1220), Color(0xFF111827), Color(0xFF1D4ED8)]
                : const [Color(0xFFF1F5F9), Color(0xFFE2E8F0), Color(0xFFBAE6FD)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0F172A), Color(0xFF1D4ED8)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.18),
                            blurRadius: 24,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.16),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.directions_bus,
                              color: Colors.white,
                              size: 30,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Bus Terminal',
                                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w800,
                                      ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Driver access dashboard',
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: Colors.white.withOpacity(0.82),
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: colorScheme.surface.withOpacity(0.92),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: colorScheme.outline.withOpacity(0.14)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.08),
                            blurRadius: 22,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Driver Login',
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Sign in to view your route, stops and live navigation.',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: colorScheme.onSurfaceVariant,
                                ),
                          ),
                          const SizedBox(height: 28),

                          if (_errorMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: colorScheme.error.withOpacity(0.12),
                                border: Border.all(color: colorScheme.error.withOpacity(0.35)),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.error_outline, color: colorScheme.error),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      _errorMessage!,
                                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                            color: colorScheme.onSurface,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                          ],

                          CustomInputField(
                            label: 'User Code',
                            hint: 'Enter your user code',
                            controller: _userCodeController,
                            validator: _validateUserCode,
                          ),
                          const SizedBox(height: 20),
                          CustomInputField(
                            label: 'Password',
                            hint: 'Enter your password',
                            controller: _passwordController,
                            obscureText: true,
                            validator: _validatePassword,
                          ),
                          const SizedBox(height: 28),

                          FilledButton(
                            onPressed: _isLoading ? null : _handleLogin,
                            child: _isLoading
                                ? SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(colorScheme.onPrimary),
                                    ),
                                  )
                                : const Text('Login'),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _statusPill(Icons.shield_outlined, 'Secure access'),
                              const SizedBox(width: 10),
                              _statusPill(Icons.route_outlined, 'Live route data'),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _statusPill(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.72),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium,
          ),
        ],
      ),
    );
  }
}
