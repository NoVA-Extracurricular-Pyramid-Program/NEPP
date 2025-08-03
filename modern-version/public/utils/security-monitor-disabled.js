/**
 * Disabled Security Monitor - Development Version
 * This is a placeholder that does nothing to prevent security monitoring in development
 */

class DisabledSecurityMonitor {
    constructor() {
        this.isActive = false;
        console.log('🔒 Security Monitor: DISABLED (Development Mode)');
    }

    // Do nothing methods
    initialize() {
        return Promise.resolve();
    }

    startMonitoring() {
        // No-op
    }

    stopMonitoring() {
        // No-op
    }

    getSecurityReport() {
        return {
            active: false,
            violations: [],
            lastCheck: new Date().toISOString(),
            status: 'disabled'
        };
    }

    logSecurityEvent() {
        // No-op
    }

    checkSecurity() {
        return true;
    }

    setupViolationDetection() {
        // No-op
    }
}

// Create and export a disabled instance
const disabledSecurityMonitor = new DisabledSecurityMonitor();

export default disabledSecurityMonitor;
