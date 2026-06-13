import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'env.dart';

/// Single API client for the GetPDFPro FastAPI backend.
///
/// Uses Dio for HTTP. The auth interceptor pulls the current
/// Supabase access token from `Supabase.instance.client.auth` and
/// attaches it as `Authorization: Bearer <jwt>` on every request.
/// If no session, the request goes out unauthenticated — the
/// server allows anonymous calls but enforces per-IP daily
/// quotas (1 task/day) and lower file-size caps.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  final Dio _dio = Dio(
    BaseOptions(
      baseUrl: Env.apiUrl,
      connectTimeout: Env.apiTimeout,
      sendTimeout: Env.uploadTimeout,
      receiveTimeout: Env.downloadTimeout,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        // Identify the mobile client so server logs can separate
        // web traffic from native traffic.
        'X-Client-Platform': 'flutter-mobile',
        'X-Client-Version': Env.appVersion,
      },
    ),
  );

  /// The raw Dio. Exposed for callers that need full control (e.g.
  /// the file-upload endpoints that need FormData + onSendProgress).
  Dio get dio => _dio;

  /// Returns the currently signed-in user's Supabase access token, or
  /// null if the user is signed out / Supabase isn't initialized.
  String? _bearerToken() {
    try {
      final session = Supabase.instance.client.auth.currentSession;
      return session?.accessToken;
    } catch (_) {
      // Supabase not initialized (e.g. dev build before env is set).
      return null;
    }
  }

  /// Installs the auth interceptor. Call this from `main()` after
  /// `Supabase.initialize()`.
  void installAuthInterceptor() {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _bearerToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }
}

/// Raised when the server returns a non-2xx status with a JSON
/// error body. The `detail` field matches the FastAPI convention
/// (`{"detail": "..."}` or `{"detail": [{"loc": ...}]}`).
class ApiException implements Exception {
  ApiException({required this.status, required this.detail, this.endpoint});

  final int status;
  final String detail;
  final String? endpoint;

  bool get isAuth => status == 401 || status == 403;
  bool get isRateLimited => status == 429 || status == 402;
  bool get isServerError => status >= 500;
  bool get isClientError => status >= 400 && status < 500;

  @override
  String toString() => 'ApiException($status: $detail)';
}

/// Helper to parse a FastAPI error body into a readable string.
String formatApiError(Object? data) {
  if (data == null) return 'Unknown error';
  if (data is String) return data;
  if (data is Map) {
    final detail = data['detail'];
    if (detail is String) return detail;
    if (detail is List && detail.isNotEmpty) {
      final first = detail.first;
      if (first is Map) {
        final loc = (first['loc'] as List?)?.join('.') ?? '';
        final msg = first['msg'] ?? 'invalid';
        return '$loc: $msg';
      }
      return first.toString();
    }
    return data.toString();
  }
  return data.toString();
}
