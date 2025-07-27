import authManager from '/utils/auth-manager.js';

class SidebarManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.loadSidebar();
        this.setupAuthListener();
        this.highlightCurrentPage();
    }

    async loadSidebar() {
        try {
            const response = await fetch('/components/sidebar.html');
            const html = await response.text();
            
            const sidebarContainer = document.querySelector('.sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = html;
            } else {
                console.error('Sidebar container not found');
            }
        } catch (error) {
            console.error('Error loading sidebar:', error);
        }
    }

    setupAuthListener() {
        // Subscribe to global auth state changes
        authManager.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateSidebarUser(user);
        });
    }

    updateSidebarUser(user = this.currentUser) {
        const userNameElement = document.getElementById('sidebar-user-name');
        if (userNameElement) {
            if (user) {
                userNameElement.textContent = user.displayName || user.email || 'NEPP User';
            } else {
                userNameElement.textContent = 'NEPP User';
            }
        }
    }

    highlightCurrentPage() {
        const currentPage = window.location.pathname.split('/').pop();
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        
        sidebarItems.forEach(item => {
            const href = item.getAttribute('href');
            const hrefPage = href.split('/').pop();
            if (hrefPage === currentPage) {
                item.classList.add('active');
            }
        });
    }

    // Method to get current user from other modules
    getCurrentUser() {
        return this.currentUser;
    }
}

// Create global instance
const sidebarManager = new SidebarManager();

// Export for use in other modules
export default sidebarManager;
