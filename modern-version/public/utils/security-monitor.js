import { SecurityConfig, SecurityUtils } from '/config/security-config.js';
import authManager from '/utils/auth-manager.js';

/**
 * Security Monitor - Actively monitors and prevents security issues
 */
class SecurityMonitor {
    constructor() {
        this.isActive = false;
        this.lastActivity = Date.now();
        this.sessionStartTime = Date.now();
        this.failedAttempts = new Map(); // Track failed attempts by type
        this.setupSecurityMonitoring();
    }

    setupSecurityMonitoring() {
        // Check if security monitoring should be enabled
        const isDevelopment = SecurityConfig.LOGGING.DEBUG_MODE;
        const enableMonitoring = isDevelopment ? 
            SecurityConfig.ENVIRONMENT.DEVELOPMENT.ENABLE_SECURITY_MONITORING : 
            SecurityConfig.ENVIRONMENT.PRODUCTION.ENABLE_SECURITY_MONITORING;

        if (!enableMonitoring) {
            console.log('🔒 Security Monitor: Disabled for development environment');
            this.isActive = false;
            return;
        }

        this.isActive = true;
        
        // Monitor user activity for session timeout
        this.setupActivityMonitoring();
        
        // Monitor for security violations
        this.setupViolationDetection();
        
        // Monitor token health
        this.setupTokenHealthMonitoring();
        
        // Setup page visibility monitoring
        this.setupVisibilityMonitoring();
        
        SecurityUtils.logSecurityEvent('Security Monitor Activated', {
            sessionId: this.generateSessionId()
        });
    }

    setupActivityMonitoring() {
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        activityEvents.forEach(event => {
            document.addEventListener(event, () => {
                this.updateLastActivity();
            }, true);
        });

        // Check for inactivity every minute
        setInterval(() => {
            this.checkInactivity();
        }, 60 * 1000);
    }

    setupViolationDetection() {
        // Monitor for console access attempts (potential developer tools usage)
        // Only in production environment
        if (SecurityConfig.ENVIRONMENT.PRODUCTION && !SecurityConfig.LOGGING.DEBUG_MODE) {
            let devtools = false;
            const threshold = 160;
            
            setInterval(() => {
                if (window.outerHeight - window.innerHeight > threshold || 
                    window.outerWidth - window.innerWidth > threshold) {
                    if (!devtools) {
                        devtools = true;
                        this.handleSecurityViolation('Developer tools detected', {
                            type: 'devtools_opened',
                            risk: 'low' // Reduced from medium to low
                        });
                    }
                } else {
                    devtools = false;
                }
            }, 5000);
        }

        // Monitor for unauthorized script injection attempts
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.tagName === 'SCRIPT' && !this.isAuthorizedScript(node)) {
                            this.handleSecurityViolation('Unauthorized script injection detected', {
                                type: 'script_injection',
                                risk: 'high',
                                scriptSrc: node.src || 'inline'
                            });
                        }
                    });
                }
            });
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    setupTokenHealthMonitoring() {
        // Check token health every 5 minutes
        setInterval(async () => {
            await this.checkTokenHealth();
        }, 5 * 60 * 1000);
    }

    setupVisibilityMonitoring() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                SecurityUtils.logSecurityEvent('Page Hidden', {
                    sessionDuration: Date.now() - this.sessionStartTime
                });
            } else {
                this.updateLastActivity();
                SecurityUtils.logSecurityEvent('Page Visible');
            }
        });
    }

    updateLastActivity() {
        this.lastActivity = Date.now();
    }

    checkInactivity() {
        const inactiveTime = Date.now() - this.lastActivity;
        
        if (inactiveTime > SecurityConfig.SESSION.INACTIVITY_TIMEOUT) {
            this.handleInactivityTimeout();
        } else if (inactiveTime > SecurityConfig.SESSION.INACTIVITY_TIMEOUT * 0.8) {
            // Warn user at 80% of timeout
            this.warnInactivityTimeout();
        }
    }

    async checkTokenHealth() {
        try {
            // Only check token health if user is supposed to be authenticated
            const currentUser = authManager.getCurrentUser();
            if (!currentUser) {
                // User is not logged in - this is normal, not a security violation
                SecurityUtils.logTokenEvent('No authenticated user - skipping token health check');
                return;
            }

            const sessionValidation = await authManager.validateSession();
            
            if (!sessionValidation.valid) {
                // Only treat as violation if user was previously authenticated
                SecurityUtils.logTokenEvent('Session validation failed', {
                    reason: sessionValidation.reason,
                    treatAsViolation: false
                });
                
                // Don't treat normal logout/session expiry as high-risk violation
                console.log('ℹ️ Session validation failed (normal logout/expiry):', sessionValidation.reason);
                return;
            }

            SecurityUtils.logTokenEvent('Token Health Check Passed', {
                emailVerified: sessionValidation.emailVerified,
                lastRefresh: sessionValidation.lastTokenRefresh
            });

        } catch (error) {
            // Only log as security violation if it's an unexpected error
            console.warn('Token health check error (not treating as violation):', error.message);
            SecurityUtils.logTokenEvent('Token Health Check Error', {
                error: error.message,
                treatAsViolation: false
            });
        }
    }

    handleInactivityTimeout() {
        SecurityUtils.logSecurityEvent('Session Timeout - Inactivity', {
            inactiveTime: Date.now() - this.lastActivity,
            sessionDuration: Date.now() - this.sessionStartTime
        });

        this.showSecurityAlert(
            'Session Timeout',
            'Your session has expired due to inactivity. Please log in again.',
            'warning'
        );

        // Force logout after brief delay
        setTimeout(() => {
            authManager.forceReauthentication();
        }, 3000);
    }

    warnInactivityTimeout() {
        const remainingTime = Math.ceil((SecurityConfig.SESSION.INACTIVITY_TIMEOUT - (Date.now() - this.lastActivity)) / 60000);
        
        this.showSecurityAlert(
            'Session Warning',
            `Your session will expire in ${remainingTime} minute(s) due to inactivity.`,
            'warning',
            5000 // Show for 5 seconds
        );
    }

    handleSecurityViolation(message, details = {}) {
        SecurityUtils.logSecurityEvent('Security Violation', {
            message,
            ...details,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });

        // Track failed attempts
        const attemptType = details.type || 'unknown';
        const attempts = this.failedAttempts.get(attemptType) || 0;
        this.failedAttempts.set(attemptType, attempts + 1);

        // Take action based on risk level
        switch (details.risk) {
            case 'high':
                this.handleHighRiskViolation(message, details);
                break;
            case 'medium':
                this.handleMediumRiskViolation(message, details);
                break;
            default:
                this.handleLowRiskViolation(message, details);
        }
    }

    handleLowRiskViolation(message, details) {
        // Log but don't alert user for low-risk violations
        console.info('ℹ️ Security monitoring:', message, details);
    }

    handleMediumRiskViolation(message, details) {
        // Log but don't show intrusive alerts for medium-risk violations
        console.warn('⚠️ Security monitoring:', message, details);
        
        // Only show alert if it's a repeated violation
        const attemptType = details.type || 'unknown';
        const attempts = this.failedAttempts.get(attemptType) || 0;
        
        if (attempts > 3) {
            this.showSecurityAlert(
                'Security Notice',
                'Multiple security events detected. Please ensure you are in a secure environment.',
                'warning',
                5000 // Shorter duration
            );
        }
    }

    handleHighRiskViolation(message, details) {
        this.showSecurityAlert(
            'Security Alert',
            'A potential security violation was detected. Your session will be terminated for safety.',
            'error'
        );

        // Force logout for high-risk violations
        setTimeout(() => {
            authManager.forceReauthentication();
        }, 2000);
    }

    isAuthorizedScript(scriptElement) {
        const authorizedDomains = [
            'www.gstatic.com',
            'firebase.googleapis.com',
            'firebasestorage.googleapis.com',
            window.location.hostname
        ];

        if (!scriptElement.src) {
            return true; // Allow inline scripts (they're from our own pages)
        }

        try {
            const url = new URL(scriptElement.src);
            return authorizedDomains.some(domain => url.hostname.includes(domain));
        } catch {
            return false; // Invalid URL
        }
    }

    showSecurityAlert(title, message, type = 'info', duration = 10000) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `security-alert security-alert-${type}`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10001;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            animation: slideIn 0.3s ease;
        `;

        alertDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 0.5rem;">${title}</div>
            <div>${message}</div>
        `;

        document.body.appendChild(alertDiv);

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, duration);
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getSecurityReport() {
        return {
            sessionStartTime: this.sessionStartTime,
            lastActivity: this.lastActivity,
            sessionDuration: Date.now() - this.sessionStartTime,
            failedAttempts: Object.fromEntries(this.failedAttempts),
            isSecureContext: SecurityUtils.isSecureContext(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
    }

    destroy() {
        this.isActive = false;
        SecurityUtils.logSecurityEvent('Security Monitor Deactivated');
    }
}

// Create global security monitor instance
const securityMonitor = new SecurityMonitor();

// Make it available globally for debugging (remove in production)
if (SecurityConfig.LOGGING.DEBUG_MODE) {
    window.securityMonitor = securityMonitor;
}

export default securityMonitor;
