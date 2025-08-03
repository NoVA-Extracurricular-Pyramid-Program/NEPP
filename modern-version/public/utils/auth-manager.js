import { auth } from '/config/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

/**
 * Global authentication utility with enhanced security and token management
 */
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.listeners = [];
        this.authInitialized = false;
        this.authPromise = null;
        this.tokenRefreshInterval = null;
        this.lastTokenRefresh = null;
        this.maxTokenAge = 45 * 60 * 1000; // 45 minutes (tokens expire at 1 hour)
        this.setupAuthListener();
        this.setupTokenRefreshScheduler();
    }

    setupAuthListener() {
        // Create a promise that resolves when auth is initialized
        this.authPromise = new Promise((resolve) => {
            this.authResolve = resolve;
        });

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    metadata: user.metadata,
                    emailVerified: user.emailVerified
                };
                
                // Ensure token is fresh when user signs in
                await this.ensureFreshToken();
            } else {
                this.currentUser = null;
                this.clearTokenRefreshScheduler();
            }
            
            if (!this.authInitialized) {
                this.authInitialized = true;
                this.authResolve(this.currentUser);
            }
            
            // Notify all listeners about the auth state change
            this.listeners.forEach(callback => callback(this.currentUser));
        });
    }

    // Setup automatic token refresh to prevent expiration
    setupTokenRefreshScheduler() {
        // Refresh token every 30 minutes to ensure it's always fresh
        this.tokenRefreshInterval = setInterval(async () => {
            if (auth.currentUser) {
                try {
                    await this.ensureFreshToken();
                    console.log('✅ Token automatically refreshed');
                } catch (error) {
                    console.error('❌ Failed to refresh token automatically:', error);
                    this.handleTokenRefreshFailure(error);
                }
            }
        }, 30 * 60 * 1000); // 30 minutes
    }

    clearTokenRefreshScheduler() {
        if (this.tokenRefreshInterval) {
            clearInterval(this.tokenRefreshInterval);
            this.tokenRefreshInterval = null;
        }
        this.lastTokenRefresh = null;
    }

    // Ensure token is fresh and valid
    async ensureFreshToken(forceRefresh = false) {
        if (!auth.currentUser) {
            throw new Error('No authenticated user');
        }

        const now = Date.now();
        const tokenAge = this.lastTokenRefresh ? now - this.lastTokenRefresh : Infinity;
        
        // Force refresh if token is older than maxTokenAge or forceRefresh is true
        if (forceRefresh || tokenAge > this.maxTokenAge) {
            try {
                const token = await auth.currentUser.getIdToken(true); // Force refresh
                this.lastTokenRefresh = now;
                
                // Validate token format (basic check)
                if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
                    throw new Error('Invalid token format received');
                }
                
                console.log(' Authentication token refreshed successfully');
                return token;
            } catch (error) {
                console.error(' Token refresh failed:', error);
                throw new Error(`Token refresh failed: ${error.message}`);
            }
        } else {
            // Return existing token if it's still fresh
            return await auth.currentUser.getIdToken(false);
        }
    }

    // Handle token refresh failures
    async handleTokenRefreshFailure(error) {
        console.error('🚨 Token refresh failed, may need re-authentication:', error);
        
        // Check if user is still authenticated
        if (!auth.currentUser) {
            console.log('🔄 User is no longer authenticated, redirecting to login');
            this.redirectToLogin();
            return;
        }

        // Attempt one more refresh after a delay
        setTimeout(async () => {
            try {
                await this.ensureFreshToken(true);
                console.log('✅ Token refresh retry successful');
            } catch (retryError) {
                console.error('🚨 Token refresh retry failed, forcing re-authentication');
                this.forceReauthentication();
            }
        }, 5000); // Wait 5 seconds before retry
    }

    // Force user to re-authenticate
    async forceReauthentication() {
        try {
            await auth.signOut();
            console.log('🔄 User signed out due to token issues');
            this.redirectToLogin();
        } catch (error) {
            console.error('❌ Failed to sign out user:', error);
            // Force redirect anyway
            this.redirectToLogin();
        }
    }

    // Redirect to login page
    redirectToLogin() {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('login.html') && !currentPath.includes('signup.html')) {
            window.location.href = '/login.html';
        }
    }

    // Enhanced method to get valid token for API calls
    async getValidToken() {
        if (!this.currentUser || !auth.currentUser) {
            throw new Error('User not authenticated');
        }

        try {
            return await this.ensureFreshToken();
        } catch (error) {
            console.error('❌ Failed to get valid token:', error);
            throw new Error('Unable to obtain valid authentication token');
        }
    }

    // Check if current session is secure
    async validateSession() {
        if (!auth.currentUser) {
            return { valid: false, reason: 'No authenticated user' };
        }

        try {
            // Try to get a fresh token
            await this.ensureFreshToken();
            
            // Check if email is verified (optional but recommended)
            const emailVerified = auth.currentUser.emailVerified;
            
            return {
                valid: true,
                emailVerified,
                lastTokenRefresh: this.lastTokenRefresh,
                uid: auth.currentUser.uid
            };
        } catch (error) {
            return {
                valid: false,
                reason: error.message
            };
        }
    }

    // Wait for auth to be initialized
    async waitForAuth() {
        return this.authPromise;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAuthInitialized() {
        return this.authInitialized;
    }

    // Subscribe to auth state changes
    onAuthStateChanged(callback) {
        this.listeners.push(callback);
        
        // Only call immediately if auth has been initialized
        if (this.authInitialized) {
            callback(this.currentUser);
        }
        
        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
}

// Create global instance
const authManager = new AuthManager();

export default authManager;
