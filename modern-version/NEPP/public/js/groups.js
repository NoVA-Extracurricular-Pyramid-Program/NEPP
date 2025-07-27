import GroupsService from '/services/groups-service.js';
import authManager from '/utils/auth-manager.js';

class GroupsManager {
    constructor() {
        this.currentUser = null;
        this.myGroups = [];
        this.availableGroups = [];
        this.filteredMyGroups = [];
        this.filteredAvailableGroups = [];
        this.currentTab = 'my-groups';
        
        this.initializeElements();
        this.bindEvents();
        this.checkAuthentication();
    }

    initializeElements() {
        // Tab elements
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Search elements
        this.myGroupsSearch = document.getElementById('myGroupsSearch');
        this.availableGroupsSearch = document.getElementById('availableGroupsSearch');
        
        // List elements
        this.myGroupsList = document.getElementById('myGroupsList');
        this.availableGroupsList = document.getElementById('availableGroupsList');
        
        // Button elements
        this.createGroupBtn = document.getElementById('createGroupBtn');
        
        // Modal elements
        this.createGroupModal = document.getElementById('createGroupModal');
        this.createGroupForm = document.getElementById('createGroupForm');
        this.cancelCreateGroupBtn = document.getElementById('cancelCreateGroup');
        
        this.groupDetailsModal = document.getElementById('groupDetailsModal');
        this.groupDetailsContainer = document.getElementById('groupDetailsContainer');
        this.closeGroupDetailsBtn = document.getElementById('closeGroupDetails');
        
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmTitle = document.getElementById('confirmTitle');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.confirmCancelBtn = document.getElementById('confirmCancel');
        this.confirmActionBtn = document.getElementById('confirmAction');
    }

    bindEvents() {
        // Tab switching
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // Search functionality
        this.myGroupsSearch.addEventListener('input', (e) => {
            this.filterMyGroups(e.target.value);
        });

        this.availableGroupsSearch.addEventListener('input', (e) => {
            this.filterAvailableGroups(e.target.value);
        });

        // Create group button
        this.createGroupBtn.addEventListener('click', () => {
            this.showCreateGroupModal();
        });

        // Create group form
        this.createGroupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateGroup();
        });

        this.cancelCreateGroupBtn.addEventListener('click', () => {
            this.hideCreateGroupModal();
        });

        // Group details modal
        this.closeGroupDetailsBtn.addEventListener('click', () => {
            this.hideGroupDetailsModal();
        });

        // Confirm modal
        this.confirmCancelBtn.addEventListener('click', () => {
            this.hideConfirmModal();
        });

        // Close modals when clicking outside
        this.createGroupModal.addEventListener('click', (e) => {
            if (e.target === this.createGroupModal) {
                this.hideCreateGroupModal();
            }
        });

        this.groupDetailsModal.addEventListener('click', (e) => {
            if (e.target === this.groupDetailsModal) {
                this.hideGroupDetailsModal();
            }
        });

        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) {
                this.hideConfirmModal();
            }
        });
    }

    async checkAuthentication() {
        // Subscribe to global auth state changes
        authManager.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                
                // Load groups
                await this.loadGroups();
            } else {
                this.showAuthAlert();
            }
        });
    }

    showAuthAlert() {
        alert('Please log in to access groups.');
        window.location.href = 'login.html';
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        this.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });
        
        // Update tab content
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
    }

    async loadGroups() {
        try {
            // Load both my groups and available groups
            const [myGroups, availableGroups] = await Promise.all([
                GroupsService.getUserGroups(this.currentUser.uid),
                GroupsService.getAvailableGroups(this.currentUser.uid)
            ]);

            this.myGroups = myGroups;
            this.availableGroups = availableGroups;
            this.filteredMyGroups = [...myGroups];
            this.filteredAvailableGroups = [...availableGroups];

            this.renderMyGroups();
            this.renderAvailableGroups();
        } catch (error) {
            console.error('Error loading groups:', error);
            this.showError('Failed to load groups');
        }
    }

    filterMyGroups(searchTerm) {
        this.filteredMyGroups = GroupsService.searchGroups(this.myGroups, searchTerm);
        this.renderMyGroups();
    }

    filterAvailableGroups(searchTerm) {
        this.filteredAvailableGroups = GroupsService.searchGroups(this.availableGroups, searchTerm);
        this.renderAvailableGroups();
    }

    renderMyGroups() {
        if (this.filteredMyGroups.length === 0) {
            this.renderEmptyState(this.myGroupsList, 'No groups found', 'Create a group or join an existing one to get started.');
            return;
        }

        this.myGroupsList.innerHTML = this.filteredMyGroups.map(group => {
            const role = GroupsService.getUserRole(group, this.currentUser.uid);
            const memberCount = GroupsService.getMemberCountText(group.members.length, group.maxMembers);
            const createdDate = GroupsService.formatDate(group.createdAt);

            return `
                <div class="group-card" onclick="groupsManager.showGroupDetails('${group.id}')">
                    <div class="group-role ${role}">${role}</div>
                    <div class="group-header">
                        <div>
                            <h3 class="group-name">${group.name}</h3>
                        </div>
                        <div class="group-type ${group.type}">${group.type}</div>
                    </div>
                    <p class="group-description">${group.description || 'No description provided.'}</p>
                    <div class="group-meta">
                        <div class="group-members">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                            ${memberCount}
                        </div>
                        <div class="group-created">Created ${createdDate}</div>
                    </div>
                    <div class="group-actions" onclick="event.stopPropagation()">
                        ${role === 'owner' ? `
                            <button class="group-action-btn" onclick="groupsManager.editGroup('${group.id}')">Edit</button>
                            <button class="group-action-btn danger" onclick="groupsManager.confirmDeleteGroup('${group.id}')">Delete</button>
                        ` : `
                            <button class="group-action-btn" onclick="groupsManager.confirmLeaveGroup('${group.id}')">Leave</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAvailableGroups() {
        if (this.filteredAvailableGroups.length === 0) {
            this.renderEmptyState(this.availableGroupsList, 'No available groups', 'All public groups are either full or you\'re already a member.');
            return;
        }

        this.availableGroupsList.innerHTML = this.filteredAvailableGroups.map(group => {
            const memberCount = GroupsService.getMemberCountText(group.members.length, group.maxMembers);
            const createdDate = GroupsService.formatDate(group.createdAt);
            const isFull = group.maxMembers && group.members.length >= group.maxMembers;

            return `
                <div class="group-card" onclick="groupsManager.showGroupDetails('${group.id}')">
                    <div class="group-header">
                        <div>
                            <h3 class="group-name">${group.name}</h3>
                        </div>
                        <div class="group-type ${group.type}">${group.type}</div>
                    </div>
                    <p class="group-description">${group.description || 'No description provided.'}</p>
                    <div class="group-meta">
                        <div class="group-members">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                            ${memberCount}
                        </div>
                        <div class="group-created">Created ${createdDate}</div>
                    </div>
                    <div class="group-actions" onclick="event.stopPropagation()">
                        <button class="group-action-btn primary" 
                                ${isFull ? 'disabled' : ''} 
                                onclick="groupsManager.joinGroup('${group.id}')">
                            ${isFull ? 'Full' : 'Join'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderEmptyState(container, title, message) {
        container.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        `;
    }

    showCreateGroupModal() {
        this.createGroupForm.reset();
        this.createGroupModal.style.display = 'flex';
    }

    hideCreateGroupModal() {
        this.createGroupModal.style.display = 'none';
    }

    async handleCreateGroup() {
        try {
            const formData = new FormData(this.createGroupForm);
            const groupData = {
                name: formData.get('groupName').trim(),
                description: formData.get('groupDescription').trim(),
                type: formData.get('groupType'),
                maxMembers: formData.get('maxMembers') ? parseInt(formData.get('maxMembers')) : null
            };

            // Validate group data
            GroupsService.validateGroupData(groupData);

            // Create the group
            await GroupsService.createGroup(groupData, this.currentUser.uid);

            this.hideCreateGroupModal();
            this.showSuccess('Group created successfully');
            
            // Reload groups
            await this.loadGroups();
        } catch (error) {
            console.error('Error creating group:', error);
            this.showError(error.message);
        }
    }

    async joinGroup(groupId) {
        try {
            await GroupsService.joinGroup(groupId, this.currentUser.uid);
            this.showSuccess('Successfully joined the group');
            
            // Reload groups
            await this.loadGroups();
        } catch (error) {
            console.error('Error joining group:', error);
            this.showError(error.message);
        }
    }

    confirmLeaveGroup(groupId) {
        const group = this.myGroups.find(g => g.id === groupId);
        if (!group) return;

        this.showConfirmModal(
            'Leave Group',
            `Are you sure you want to leave "${group.name}"?`,
            () => this.leaveGroup(groupId)
        );
    }

    async leaveGroup(groupId) {
        try {
            await GroupsService.leaveGroup(groupId, this.currentUser.uid);
            this.showSuccess('Successfully left the group');
            
            // Reload groups
            await this.loadGroups();
        } catch (error) {
            console.error('Error leaving group:', error);
            this.showError(error.message);
        }
    }

    confirmDeleteGroup(groupId) {
        const group = this.myGroups.find(g => g.id === groupId);
        if (!group) return;

        this.showConfirmModal(
            'Delete Group',
            `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
            () => this.deleteGroup(groupId)
        );
    }

    async deleteGroup(groupId) {
        try {
            await GroupsService.deleteGroup(groupId, this.currentUser.uid);
            this.showSuccess('Group deleted successfully');
            
            // Reload groups
            await this.loadGroups();
        } catch (error) {
            console.error('Error deleting group:', error);
            this.showError(error.message);
        }
    }

    async showGroupDetails(groupId) {
        try {
            const group = await GroupsService.getGroupDetails(groupId);
            const userRole = GroupsService.getUserRole(group, this.currentUser.uid);
            
            this.groupDetailsContainer.innerHTML = `
                <div class="group-details-header">
                    <div>
                        <h2 class="group-details-title">${group.name}</h2>
                        <div class="group-details-meta">
                            <span class="group-type ${group.type}">${group.type}</span>
                            ${userRole ? `<span class="group-role ${userRole}">${userRole}</span>` : ''}
                            <span>${GroupsService.getMemberCountText(group.members.length, group.maxMembers)}</span>
                            <span>Created ${GroupsService.formatDate(group.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <div class="group-details-description">
                    ${group.description || 'No description provided.'}
                </div>
                <div class="group-members-section">
                    <h3 class="section-title">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1.25rem; height: 1.25rem;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                        </svg>
                        Members (${group.members.length})
                    </h3>
                    <div class="member-list">
                        ${group.members.map(memberId => {
                            const memberRole = GroupsService.getUserRole(group, memberId);
                            const isCurrentUser = memberId === this.currentUser.uid;
                            const canManage = userRole === 'owner' || (userRole === 'admin' && memberRole === 'member');
                            
                            return `
                                <div class="member-item">
                                    <div class="member-info">
                                        <div class="member-avatar">${memberId.charAt(0).toUpperCase()}</div>
                                        <div class="member-details">
                                            <div class="member-name">${isCurrentUser ? 'You' : memberId}</div>
                                            <div class="member-role-text">${memberRole}</div>
                                        </div>
                                    </div>
                                    ${canManage && !isCurrentUser ? `
                                        <div class="member-actions">
                                            ${memberRole === 'member' && userRole === 'owner' ? `
                                                <button class="member-action-btn" onclick="groupsManager.promoteToAdmin('${groupId}', '${memberId}')">
                                                    Make Admin
                                                </button>
                                            ` : ''}
                                            ${memberRole === 'admin' && userRole === 'owner' ? `
                                                <button class="member-action-btn" onclick="groupsManager.removeAdmin('${groupId}', '${memberId}')">
                                                    Remove Admin
                                                </button>
                                            ` : ''}
                                            <button class="member-action-btn danger" onclick="groupsManager.confirmRemoveMember('${groupId}', '${memberId}')">
                                                Remove
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            
            this.groupDetailsModal.style.display = 'flex';
        } catch (error) {
            console.error('Error loading group details:', error);
            this.showError('Failed to load group details');
        }
    }

    hideGroupDetailsModal() {
        this.groupDetailsModal.style.display = 'none';
    }

    showConfirmModal(title, message, onConfirm) {
        this.confirmTitle.textContent = title;
        this.confirmMessage.textContent = message;
        
        // Remove existing listeners
        const newConfirmBtn = this.confirmActionBtn.cloneNode(true);
        this.confirmActionBtn.parentNode.replaceChild(newConfirmBtn, this.confirmActionBtn);
        this.confirmActionBtn = newConfirmBtn;
        
        // Add new listener
        this.confirmActionBtn.addEventListener('click', () => {
            this.hideConfirmModal();
            onConfirm();
        });
        
        this.confirmModal.style.display = 'flex';
    }

    hideConfirmModal() {
        this.confirmModal.style.display = 'none';
    }

    showSuccess(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 2000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 2000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize the groups manager
const groupsManager = new GroupsManager();

// Make it globally available for inline event handlers
window.groupsManager = groupsManager;
