/**
 * Security Integration - Initialize all security components
 * Import this file in your main HTML pages to activate comprehensive security
 */

import SecurityConfig from '/config/security-config.js';
import authManager from '/utils/auth-manager.js';
// Use disabled security monitor for development
import securityMonitor from '/utils/security-monitor-disabled.js';

// Security initialization
class SecurityInitializer {
    static async initialize() {
        console.log(' Initializing NEPP Security System...');
        
        try {
            // Wait for auth to be ready
            await authManager.waitForAuth();
            
            // Log security initialization
            console.log(' Security system initialized successfully');
            
            return true;
        } catch (error) {
            console.error('Security initialization failed:', error);
            return false;
        }
    }

    static getSecurityStatus() {
        return {
            authManager: {
                initialized: authManager.isAuthInitialized(),
                currentUser: authManager.getCurrentUser()?.uid || null,
                tokenRefreshActive: true
            },
            securityMonitor: {
                active: false, // Disabled for development
                report: null
            },
            config: {
                environment: SecurityConfig.ENVIRONMENT,
                tokenMaxAge: SecurityConfig.TOKEN.MAX_AGE,
                uploadLimits: SecurityConfig.UPLOAD
            }
        };
    }
}

// Auto-initialize when imported
SecurityInitializer.initialize();

// Make available globally for debugging
if (SecurityConfig.LOGGING.DEBUG_MODE) {
    window.NEPP_Security = {
        status: SecurityInitializer.getSecurityStatus,
        authManager,
        // securityMonitor, // Disabled
        config: SecurityConfig
    };
}

export default SecurityInitializer;
