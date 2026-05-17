/// User model
class User {
  final int id;
  final int userCode;
  final String? job;

  User({
    required this.id,
    required this.userCode,
    this.job,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    // userCode may be provided as 'userCode' or 'usercode' and may be int or string
    final dynamic rawUserCode = json['userCode'] ?? json['usercode'] ?? json['user_code'];
    int parsedUserCode;
    if (rawUserCode is int) {
      parsedUserCode = rawUserCode;
    } else if (rawUserCode is String) {
      parsedUserCode = int.tryParse(rawUserCode) ?? (throw FormatException('Invalid userCode'));
    } else {
      // If the backend doesn't return a userCode, treat as unknown (-1)
      parsedUserCode = -1;
    }

    return User(
      id: json['id'] as int,
      userCode: parsedUserCode,
      job: json['job'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userCode': userCode,
      'job': job,
    };
  }
}

/// Login response model
class AuthResponse {
  final String token;
  final User? user;

  AuthResponse({
    required this.token,
    this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    final dynamic rawToken = json['token'] ?? json['Token'] ?? json['authToken'];
    final token = rawToken?.toString();
    if (token == null || token.isEmpty) throw FormatException('Missing token in auth response');

    // Determine if a user object exists and appears valid
    Map<String, dynamic>? userMap;
    if (json.containsKey('user') && json['user'] is Map<String, dynamic>) {
      userMap = json['user'] as Map<String, dynamic>;
    } else {
      // maybe user fields are top-level (id, userCode, job)
      final hasUserFields = json.containsKey('id') || json.containsKey('userCode') || json.containsKey('usercode') || json.containsKey('user_code');
      if (hasUserFields) {
        // treat whole json as user map
        userMap = json.cast<String, dynamic>();
      }
    }

    User? parsedUser;
    if (userMap != null) {
      try {
        parsedUser = User.fromJson(userMap);
      } catch (e) {
        // If parsing user fails, ignore user but keep token
        parsedUser = null;
      }
    }

    return AuthResponse(
      token: token,
      user: parsedUser,
    );
  }
}
