/**
 * Security Configuration for NEPP Application
 * Centralizes all security-related settings and policies
 */

export const SecurityConfig = {
    // Token Management
    TOKEN: {
        MAX_AGE: 45 * 60 * 1000, // 45 minutes
        REFRESH_INTERVAL: 30 * 60 * 1000, // 30 minutes
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 5000, // 5 seconds
    },

    // File Upload Security
    UPLOAD: {
        MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
        ALLOWED_TYPES: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ],
        FILENAME_SANITIZATION: /[^a-zA-Z0-9.-]/g, // Remove special characters
        MAX_FILENAME_LENGTH: 100
    },

    // Session Security
    SESSION: {
        INACTIVITY_TIMEOUT: 60 * 60 * 1000, // 1 hour
        REQUIRE_EMAIL_VERIFICATION: false, // Set to true for production
        FORCE_LOGOUT_ON_TOKEN_ERROR: true,
        AUTO_REFRESH_ENABLED: true
    },

    // API Security
    API: {
        RATE_LIMIT: {
            UPLOAD: { requests: 10, window: 60 * 1000 }, // 10 uploads per minute
            DOWNLOAD: { requests: 50, window: 60 * 1000 }, // 50 downloads per minute
            AUTH: { requests: 5, window: 60 * 1000 } // 5 auth attempts per minute
        },
        TIMEOUT: 30 * 1000, // 30 seconds
        RETRY_ATTEMPTS: 3
    },

    // Data Validation
    VALIDATION: {
        USER_ID_PATTERN: /^[a-zA-Z0-9_-]+$/, // Only alphanumeric, underscore, hyphen
        EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        FILENAME_PATTERN: /^[a-zA-Z0-9._-]+$/
    },

    // Logging and Monitoring
    LOGGING: {
        SECURITY_EVENTS: true,
        TOKEN_EVENTS: true,
        UPLOAD_EVENTS: true,
        ERROR_EVENTS: true,
        CONSOLE_LOGGING: true // Set to false in production
    },

    // Environment-specific settings
    ENVIRONMENT: {
        DEVELOPMENT: {
            STRICT_SSL: false,
            ALLOW_INSECURE_LOCALHOST: true,
            DEBUG_MODE: true,
            ENABLE_SECURITY_MONITORING: false // Disable aggressive monitoring in dev
        },
        PRODUCTION: {
            STRICT_SSL: true,
            ALLOW_INSECURE_LOCALHOST: false,
            DEBUG_MODE: false,
            REQUIRE_EMAIL_VERIFICATION: true,
            ENABLE_SECURITY_MONITORING: true
        }
    }
};

/**
 * Security utility functions
 */
export class SecurityUtils {
    static sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            throw new Error('Invalid filename');
        }

        // Remove path traversal attempts
        const sanitized = filename
            .replace(/[\/\\]/g, '') // Remove path separators
            .replace(SecurityConfig.UPLOAD.FILENAME_SANITIZATION, '_') // Replace special chars
            .slice(0, SecurityConfig.UPLOAD.MAX_FILENAME_LENGTH); // Limit length

        if (!sanitized || sanitized.length === 0) {
            throw new Error('Filename cannot be empty after sanitization');
        }

        return sanitized;
    }

    static validateFileType(mimeType) {
        return SecurityConfig.UPLOAD.ALLOWED_TYPES.includes(mimeType);
    }

    static validateFileSize(size) {
        return size <= SecurityConfig.UPLOAD.MAX_FILE_SIZE;
    }

    static validateUserId(userId) {
        if (!userId || typeof userId !== 'string') {
            return false;
        }
        return SecurityConfig.VALIDATION.USER_ID_PATTERN.test(userId);
    }

    static logSecurityEvent(event, details = {}) {
        if (SecurityConfig.LOGGING.SECURITY_EVENTS && SecurityConfig.LOGGING.CONSOLE_LOGGING) {
            console.log(`🔒 Security Event: ${event}`, {
                timestamp: new Date().toISOString(),
                ...details
            });
        }
    }

    static logTokenEvent(event, details = {}) {
        if (SecurityConfig.LOGGING.TOKEN_EVENTS && SecurityConfig.LOGGING.CONSOLE_LOGGING) {
            console.log(`🔑 Token Event: ${event}`, {
                timestamp: new Date().toISOString(),
                ...details
            });
        }
    }

    static isSecureContext() {
        return window.isSecureContext || window.location.protocol === 'https:' || 
               window.location.hostname === 'localhost';
    }

    static generateSecureHeaders() {
        return {
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };
    }
}

export default SecurityConfig;
