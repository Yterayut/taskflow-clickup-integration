/**
 * Authentication Domain Errors
 * Custom error classes for authentication domain
 */

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

class SystemNotReadyError extends Error {
    constructor(message = 'System not ready for user authentication') {
        super(message);
        this.name = 'SystemNotReadyError';
    }
}

class InvalidCredentialsError extends Error {
    constructor(message = 'Invalid email or password') {
        super(message);
        this.name = 'InvalidCredentialsError';
    }
}

class UserNotFoundError extends Error {
    constructor(message = 'User not found') {
        super(message);
        this.name = 'UserNotFoundError';
    }
}

class OAuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OAuthError';
    }
}

class UnauthorizedUserError extends Error {
    constructor(message = 'Unauthorized user for this operation') {
        super(message);
        this.name = 'UnauthorizedUserError';
    }
}

class TokenExpiredError extends Error {
    constructor(message = 'Token has expired') {
        super(message);
        this.name = 'TokenExpiredError';
    }
}

class TokenRefreshError extends Error {
    constructor(message = 'Failed to refresh token') {
        super(message);
        this.name = 'TokenRefreshError';
    }
}

module.exports = {
    AuthenticationError,
    SystemNotReadyError,
    InvalidCredentialsError,
    UserNotFoundError,
    OAuthError,
    UnauthorizedUserError,
    TokenExpiredError,
    TokenRefreshError
};