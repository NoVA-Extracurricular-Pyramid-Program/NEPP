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
        this.editingGroupId = null;
        
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
        this.joinByCodeBtn = document.getElementById('joinByCodeBtn');

        // Modal elements
        this.createGroupModal = document.getElementById('createGroupModal');
        this.createGroupForm = document.getElementById('createGroupForm');
        this.cancelCreateGroupBtn = document.getElementById('cancelCreateGroup');

        this.joinByCodeModal = document.getElementById('joinByCodeModal');
        this.joinByCodeForm = document.getElementById('joinByCodeForm');
        this.cancelJoinByCodeBtn = document.getElementById('cancelJoinByCode');
        
        this.groupDetailsModal = document.getElementById('groupDetailsModal');
        this.groupDetailsContainer = document.getElementById('groupDetailsContainer');
        this.closeGroupDetailsBtn = document.getElementById('closeGroupDetails');
        
        this.permissionsModal = document.getElementById('permissionsModal');
        this.cancelPermissionsBtn = document.getElementById('cancelPermissions');
        this.savePermissionsBtn = document.getElementById('savePermissions');
        this.permissionMemberName = document.getElementById('permissionMemberName');
        this.permissionMemberRole = document.getElementById('permissionMemberRole');
        
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

        // Join by code button
        this.joinByCodeBtn.addEventListener('click', () => {
            this.showJoinByCodeModal();
        });

        // Create group form
        this.createGroupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateGroup();
        });

        this.cancelCreateGroupBtn.addEventListener('click', () => {
            this.hideCreateGroupModal();
        });

        // Join by code form
        this.joinByCodeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleJoinByCode();
        });

        this.cancelJoinByCodeBtn.addEventListener('click', () => {
            this.hideJoinByCodeModal();
        });

        // Group details modal
        this.closeGroupDetailsBtn.addEventListener('click', () => {
            this.hideGroupDetailsModal();
        });

        // Permissions modal events
        this.cancelPermissionsBtn.addEventListener('click', () => {
            this.hidePermissionsModal();
        });

        this.savePermissionsBtn.addEventListener('click', () => {
            this.savePermissions();
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

        this.joinByCodeModal.addEventListener('click', (e) => {
            if (e.target === this.joinByCodeModal) {
                this.hideJoinByCodeModal();
            }
        });

        this.groupDetailsModal.addEventListener('click', (e) => {
            if (e.target === this.groupDetailsModal) {
                this.hideGroupDetailsModal();
            }
        });

        this.permissionsModal.addEventListener('click', (e) => {
            if (e.target === this.permissionsModal) {
                this.hidePermissionsModal();
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
                
                // Check for group parameter in URL (for notifications)
                this.checkForGroupParameter();
            } else {
                this.showAuthAlert();
            }
        });
    }

    checkForGroupParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const groupId = urlParams.get('group');
        
        if (groupId) {
            // Show the group details modal after a short delay to ensure everything is loaded
            setTimeout(() => {
                this.showGroupDetails(groupId);
                // Clean up the URL parameter
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }, 500);
        }
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
                    ${(role === 'owner' || role === 'admin') && group.joinCode ? `
                        <div class="join-code-section">
                            <div class="join-code-display">
                                <div class="join-code">${group.joinCode}</div>
                                <button class="copy-btn" onclick="event.stopPropagation(); groupsManager.copyJoinCode('${group.joinCode}')">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                                    </svg>
                                    Copy
                                </button>
                            </div>
                        </div>
                    ` : ''}
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
        
        // Reset form
        this.createGroupForm.reset();
        
        // Reset modal title and button text for next use
        this.createGroupModal.querySelector('h2').textContent = 'Create New Group';
        const submitBtn = this.createGroupForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Create Group';
        
        // Clear editing state
        this.editingGroupId = null;
    }

    showJoinByCodeModal() {
        this.joinByCodeForm.reset();
        this.joinByCodeModal.style.display = 'flex';
    }

    hideJoinByCodeModal() {
        this.joinByCodeModal.style.display = 'none';
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

            if (this.editingGroupId) {
                // Update existing group
                await GroupsService.updateGroup(this.editingGroupId, groupData, this.currentUser.uid);
                
                // Handle member additions during edit
                await this.handleMemberAdditions();
                
                this.showSuccess('Group updated successfully');
            } else {
                // Create new group
                await GroupsService.createGroup(groupData, this.currentUser.uid);
                this.showSuccess('Group created successfully');
            }

            this.hideCreateGroupModal();
            
            // Reload groups
            await this.loadGroups();
        } catch (error) {
            console.error('Error saving group:', error);
            this.showError(error.message);
        }
    }
    
    async handleMemberAdditions() {
        try {
            const selectedType = document.querySelector('input[name="memberSelectionType"]:checked').value;
            
            if (selectedType === 'individual') {
                // Add selected individual users
                const selectedUsers = Array.from(this.userSelector.selectedOptions).map(option => option.value);
                if (selectedUsers.length > 0) {
                    await GroupsService.addMembersToGroup(this.editingGroupId, selectedUsers);
                }
            } else if (selectedType === 'group') {
                // Add members from selected groups
                const selectedGroups = Array.from(this.groupSelector.selectedOptions).map(option => option.value);
                for (const groupId of selectedGroups) {
                    const group = await GroupsService.getGroupDetails(groupId);
                    await GroupsService.addMembersToGroup(this.editingGroupId, group.members);
                }
            }
        } catch (error) {
            console.error('Error adding members:', error);
            throw error;
        }
    }

    async handleJoinByCode() {
        try {
            const formData = new FormData(this.joinByCodeForm);
            const joinCode = formData.get('joinCode').trim().toUpperCase();

            if (!joinCode || joinCode.length !== 6) {
                this.showError('Please enter a valid 6-character join code');
                return;
            }

            // Join the group by code
            const result = await GroupsService.joinGroupByCode(joinCode, this.currentUser.uid);

            this.hideJoinByCodeModal();
            this.showSuccess(`Successfully joined "${result.groupName}"`);
            
            // Reload groups
            await this.loadGroups();
        } catch (error) {
            console.error('Error joining group by code:', error);
            this.showError(error.message);
        }
    }

    async generateJoinCode(groupId) {
        try {
            const group = await GroupsService.getGroupDetails(groupId);
            const isRegeneration = !!group.joinCode;
            
            const joinCode = await GroupsService.generateJoinCodeForGroup(groupId, this.currentUser.uid);
            
            if (isRegeneration) {
                this.showSuccess(`Join code regenerated successfully! New code: ${joinCode}`);
            } else {
                this.showSuccess(`Join code generated successfully: ${joinCode}`);
            }
            
            // Refresh the group details to show the new join code
            await this.showGroupDetails(groupId);
        } catch (error) {
            console.error('Error generating join code:', error);
            this.showError('Failed to generate join code: ' + error.message);
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

    async editGroup(groupId) {
        try {
            const group = await GroupsService.getGroupDetails(groupId);
            
            // Check if user is owner, admin, or co-owner
            const isOwner = group.ownerId === this.currentUser.uid;
            const isAdmin = group.admins && group.admins.includes(this.currentUser.uid);
            const isCoOwner = group.coOwners && group.coOwners.includes(this.currentUser.uid);

            if (!isOwner && !isAdmin && !isCoOwner) {
                this.showError('Only the group owner, admins, or co-owners can edit the group');
                return;
            }            // Populate the form with current values
            document.getElementById('groupName').value = group.name;
            document.getElementById('groupDescription').value = group.description || '';
            document.getElementById('groupType').value = group.type;
            document.getElementById('maxMembers').value = group.maxMembers || '';

            // Change modal title and button text
            this.createGroupModal.querySelector('h2').textContent = 'Edit Group';
            const submitBtn = this.createGroupForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Update Group';

            // Store the group ID for updating
            this.editingGroupId = groupId;

            // Show the modal
            this.createGroupModal.style.display = 'flex';
        } catch (error) {
            console.error('Error loading group for editing:', error);
            this.showError('Failed to load group details');
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
                ${(userRole === 'owner' || userRole === 'admin') ? `
                    <div class="join-code-section">
                        <h3 class="section-title">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1.25rem; height: 1.25rem;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" />
                            </svg>
                            Join Code
                        </h3>
                        ${group.joinCode ? `
                            <div class="join-code-display">
                                <div class="join-code">${group.joinCode}</div>
                                <div class="join-code-actions">
                                    <button class="copy-btn" onclick="groupsManager.copyJoinCode('${group.joinCode}')">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                                        </svg>
                                        Copy
                                    </button>
                                    <button class="regenerate-btn" onclick="groupsManager.generateJoinCode('${group.id}')" style="background: #ff6b6b; color: white; border: none; border-radius: 8px; padding: 0.75rem 1rem; cursor: pointer; font-weight: 600; margin-left: 0.5rem;">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1.25rem; height: 1.25rem; margin-right: 0.5rem;">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                        </svg>
                                        Regenerate
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div class="no-join-code">
                                <p style="color: #8892b0; margin-bottom: 1rem;">This group doesn't have a join code yet.</p>
                                <button class="generate-join-code-btn" onclick="groupsManager.generateJoinCode('${group.id}')" style="background: #4ecdc4; color: white; border: none; border-radius: 8px; padding: 0.75rem 1.5rem; cursor: pointer; font-weight: 600;">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1.25rem; height: 1.25rem; margin-right: 0.5rem;">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                        </svg>
                                        Generate Join Code
                                    </button>
                            </div>
                        `}
                    </div>
                ` : ''}
                <div class="group-members-section">
                    <div class="members-header">
                        <h3 class="section-title">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1.25rem; height: 1.25rem;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                            Members (${group.members.length})
                        </h3>
                        <div class="member-search-container">
                            <input type="text" id="memberFilterSearch" placeholder="Search members..." class="member-search-input">
                            <svg class="member-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                    </div>
                    <div class="member-list" id="memberListContainer">
                        Loading members...
                    </div>
                    <div class="member-pagination" id="memberPagination" style="display: none;">
                        <button id="prevPageBtn" class="pagination-btn" disabled>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                            Previous
                        </button>
                        <span id="pageInfo" class="page-info">Page 1 of 1</span>
                        <button id="nextPageBtn" class="pagination-btn" disabled>
                            Next
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>
                    ${(userRole === 'owner' || userRole === 'admin' || userRole === 'co-owner') ? `
                        <div class="add-member-section">
                            <h4 class="section-title">Add New Members</h4>
                            <div class="user-search-container">
                                <input type="text" id="memberSearch" placeholder="Search users by name or email..." class="search-input">
                                <div id="userSearchResults" class="search-results" style="display: none;"></div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            this.groupDetailsModal.style.display = 'flex';
            
            // Load member names
            this.loadMemberNames(group, groupId, userRole);
            
            // Initialize member search functionality if the section exists
            const memberSearch = document.getElementById('memberSearch');
            if (memberSearch) {
                this.initializeMemberSearch(groupId);
            }
        } catch (error) {
            console.error('Error loading group details:', error);
            this.showError('Failed to load group details');
        }
    }

    async loadMemberNames(group, groupId, userRole) {
        try {
            const memberListContainer = document.getElementById('memberListContainer');
            if (!memberListContainer) return;

            // Store data for pagination and search
            this.currentGroup = group;
            this.currentGroupId = groupId;
            this.currentUserRole = userRole;
            this.currentPage = 1;
            this.membersPerPage = 15;
            this.memberSearchQuery = '';

            // Fetch all member data
            const memberPromises = group.members.map(async (memberId) => {
                try {
                    const memberData = await GroupsService.getUserById(memberId);
                    return {
                        id: memberId,
                        name: memberData.name || memberData.displayName || memberData.email || 'Unknown User',
                        email: memberData.email,
                        role: GroupsService.getUserRole(group, memberId)
                    };
                } catch (error) {
                    console.error(`Error fetching user ${memberId}:`, error);
                    return {
                        id: memberId,
                        name: 'Unknown User',
                        email: '',
                        role: GroupsService.getUserRole(group, memberId)
                    };
                }
            });

            this.allMembers = await Promise.all(memberPromises);
            
            // Initialize search functionality
            this.initializeMemberFilter();
            
            // Render the member list
            this.renderMemberList();

        } catch (error) {
            console.error('Error loading member names:', error);
            const memberListContainer = document.getElementById('memberListContainer');
            if (memberListContainer) {
                memberListContainer.innerHTML = '<div class="error-message">Failed to load member information</div>';
            }
        }
    }

    initializeMemberFilter() {
        const memberFilterSearch = document.getElementById('memberFilterSearch');
        if (memberFilterSearch) {
            memberFilterSearch.addEventListener('input', (e) => {
                this.memberSearchQuery = e.target.value.toLowerCase().trim();
                this.currentPage = 1; // Reset to first page when searching
                this.renderMemberList();
            });
        }

        // Initialize pagination event listeners
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderMemberList();
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                const filteredMembers = this.getFilteredMembers();
                const totalPages = Math.ceil(filteredMembers.length / this.membersPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderMemberList();
                }
            });
        }
    }

    getFilteredMembers() {
        let filteredMembers = this.allMembers;
        
        // Apply search filter
        if (this.memberSearchQuery) {
            filteredMembers = filteredMembers.filter(member => 
                member.name.toLowerCase().includes(this.memberSearchQuery) ||
                member.email.toLowerCase().includes(this.memberSearchQuery) ||
                member.role.toLowerCase().includes(this.memberSearchQuery)
            );
        }
        
        // Sort members: prioritize roles, then alphabetical by name
        const roleOrder = { 'owner': 0, 'admin': 1, 'co-owner': 2, 'member': 3 };
        filteredMembers.sort((a, b) => {
            const roleComparison = roleOrder[a.role] - roleOrder[b.role];
            if (roleComparison !== 0) return roleComparison;
            return a.name.localeCompare(b.name);
        });
        
        return filteredMembers;
    }

    renderMemberList() {
        const memberListContainer = document.getElementById('memberListContainer');
        const memberPagination = document.getElementById('memberPagination');
        
        if (!memberListContainer) return;

        const filteredMembers = this.getFilteredMembers();
        const totalPages = Math.ceil(filteredMembers.length / this.membersPerPage);
        const startIndex = (this.currentPage - 1) * this.membersPerPage;
        const endIndex = startIndex + this.membersPerPage;
        const currentPageMembers = filteredMembers.slice(startIndex, endIndex);

        // Generate the member list HTML
        const memberListHTML = currentPageMembers.map(member => {
            const isCurrentUser = member.id === this.currentUser.uid;
            // Owners and admins can manage all members, co-owners can only manage regular members
            const canManage = (this.currentUserRole === 'owner' || this.currentUserRole === 'admin') || 
                            (this.currentUserRole === 'co-owner' && member.role === 'member');
            
            return `
                <div class="member-item">
                    <div class="member-info">
                        <div class="member-avatar">${member.name.charAt(0).toUpperCase()}</div>
                        <div class="member-details">
                            <div class="member-name">${isCurrentUser ? 'You' : member.name}</div>
                            <div class="member-role-text ${member.role}">${member.role}</div>
                        </div>
                    </div>
                    <div class="member-actions">
                        ${canManage && !isCurrentUser ? `
                            ${member.role === 'member' && (this.currentUserRole === 'owner' || this.currentUserRole === 'admin') ? `
                                <button class="member-action-btn" onclick="groupsManager.promoteToAdmin('${this.currentGroupId}', '${member.id}')">
                                    Make Admin
                                </button>
                            ` : ''}
                            ${member.role === 'member' && (this.currentUserRole === 'owner' || this.currentUserRole === 'admin') ? `
                                <button class="member-action-btn" onclick="groupsManager.promoteToCoOwner('${this.currentGroupId}', '${member.id}')">
                                    Make Co-Owner
                                </button>
                            ` : ''}
                            ${member.role === 'admin' && (this.currentUserRole === 'owner' || this.currentUserRole === 'admin') ? `
                                <button class="member-action-btn" onclick="groupsManager.removeAdmin('${this.currentGroupId}', '${member.id}')">
                                    Remove Admin
                                </button>
                            ` : ''}
                            ${member.role === 'co-owner' && (this.currentUserRole === 'owner' || this.currentUserRole === 'admin') ? `
                                <button class="member-action-btn" onclick="groupsManager.removeCoOwner('${this.currentGroupId}', '${member.id}')">
                                    Remove Co-Owner
                                </button>
                            ` : ''}
                            ${(this.currentUserRole === 'owner' || this.currentUserRole === 'admin') ? `
                                <button class="member-action-btn permissions" onclick="groupsManager.showPermissionsModal('${this.currentGroupId}', '${member.id}', '${member.name}', '${member.role}')">
                                    Permissions
                                </button>
                            ` : ''}
                            <button class="member-action-btn danger" onclick="groupsManager.confirmRemoveMember('${this.currentGroupId}', '${member.id}')">
                                Remove
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        memberListContainer.innerHTML = memberListHTML || '<div class="no-members-found">No members found</div>';

        // Update pagination
        if (memberPagination) {
            const prevPageBtn = document.getElementById('prevPageBtn');
            const nextPageBtn = document.getElementById('nextPageBtn');
            const pageInfo = document.getElementById('pageInfo');
            
            if (totalPages > 1) {
                memberPagination.style.display = 'flex';
                
                // Update buttons
                if (prevPageBtn) {
                    prevPageBtn.disabled = this.currentPage <= 1;
                }
                if (nextPageBtn) {
                    nextPageBtn.disabled = this.currentPage >= totalPages;
                }
                
                // Update page info
                if (pageInfo) {
                    pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
                }
            } else {
                memberPagination.style.display = 'none';
            }
        }
    }

    async initializeMemberSearch(groupId) {
        const memberSearch = document.getElementById('memberSearch');
        const searchResults = document.getElementById('userSearchResults');
        let allUsers = [];
        
        try {
            // Load all users
            allUsers = await GroupsService.getAllUsers();
        } catch (error) {
            console.error('Error loading users:', error);
            allUsers = []; // Fallback to empty array
        }
        
        memberSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                searchResults.style.display = 'none';
                return;
            }
            
            const filteredUsers = allUsers.filter(user => {
                const matchesQuery = user.name?.toLowerCase().includes(query.toLowerCase()) ||
                                   user.email?.toLowerCase().includes(query.toLowerCase());
                return matchesQuery && user.id !== this.currentUser.uid;
            });
            
            this.displayUserSearchResults(filteredUsers, groupId, searchResults);
        });
        
        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-search-container')) {
                searchResults.style.display = 'none';
            }
        });
    }
    
    displayUserSearchResults(users, groupId, resultsContainer) {
        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
        } else {
            resultsContainer.innerHTML = users.map(user => `
                <div class="user-search-result" onclick="groupsManager.addMemberToGroup('${groupId}', '${user.id}', '${user.name || user.email}')">
                    <div class="user-result-info">
                        <div class="user-result-name">${user.name || user.email}</div>
                        <div class="user-result-email">${user.email}</div>
                    </div>
                    <button class="add-member-btn">Add</button>
                </div>
            `).join('');
        }
        resultsContainer.style.display = 'block';
    }
    
    async addMemberToGroup(groupId, userId, userName) {
        try {
            await GroupsService.addMemberToGroup(groupId, userId, this.currentUser.uid);
            this.showSuccess(`${userName} has been added to the group`);
            
            // Hide search results and clear input
            const memberSearch = document.getElementById('memberSearch');
            const searchResults = document.getElementById('userSearchResults');
            if (memberSearch) memberSearch.value = '';
            if (searchResults) searchResults.style.display = 'none';
            
            // Refresh member list instead of reloading entire group details
            await this.refreshMemberList();
            await this.loadGroups();
        } catch (error) {
            console.error('Error adding member:', error);
            this.showError('Failed to add member to group');
        }
    }
    
    confirmRemoveMember(groupId, memberId) {
        this.showConfirmModal(
            'Remove Member',
            'Are you sure you want to remove this member from the group?',
            () => this.removeMemberFromGroup(groupId, memberId)
        );
    }
    
    async removeMemberFromGroup(groupId, memberId) {
        try {
            await GroupsService.removeMember(groupId, memberId, this.currentUser.uid);
            this.showSuccess('Member removed from group');
            
            // Refresh member list
            await this.refreshMemberList();
            await this.loadGroups();
        } catch (error) {
            console.error('Error removing member:', error);
            this.showError('Failed to remove member from group');
        }
    }
    
    async refreshMemberList() {
        if (this.currentGroup && this.currentGroupId && this.currentUserRole) {
            // Fetch updated group data
            const updatedGroup = await GroupsService.getGroupDetails(this.currentGroupId);
            this.currentGroup = updatedGroup;
            
            // Re-fetch member data and update the display
            const memberPromises = updatedGroup.members.map(async (memberId) => {
                try {
                    const memberData = await GroupsService.getUserById(memberId);
                    return {
                        id: memberId,
                        name: memberData.name || memberData.displayName || memberData.email || 'Unknown User',
                        email: memberData.email,
                        role: GroupsService.getUserRole(updatedGroup, memberId)
                    };
                } catch (error) {
                    console.error(`Error fetching user ${memberId}:`, error);
                    return {
                        id: memberId,
                        name: 'Unknown User',
                        email: '',
                        role: GroupsService.getUserRole(updatedGroup, memberId)
                    };
                }
            });

            this.allMembers = await Promise.all(memberPromises);
            
            // Update the member count in the header
            const membersHeader = document.querySelector('.section-title');
            if (membersHeader) {
                membersHeader.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1.25rem; height: 1.25rem;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                    Members (${updatedGroup.members.length})
                `;
            }
            
            // Re-render the member list
            this.renderMemberList();
        }
    }
    
    async promoteToAdmin(groupId, memberId) {
        try {
            await GroupsService.addAdmin(groupId, memberId, this.currentUser.uid);
            this.showSuccess('Member promoted to admin');
            
            // Refresh member list
            await this.refreshMemberList();
        } catch (error) {
            console.error('Error promoting member:', error);
            this.showError('Failed to promote member to admin');
        }
    }
    
    async removeAdmin(groupId, memberId) {
        try {
            await GroupsService.removeAdmin(groupId, memberId, this.currentUser.uid);
            this.showSuccess('Admin privileges removed');
            
            // Refresh member list
            await this.refreshMemberList();
        } catch (error) {
            console.error('Error removing admin privileges:', error);
            this.showError('Failed to remove admin privileges');
        }
    }

    async promoteToCoOwner(groupId, memberId) {
        try {
            // Get group and user details for notification
            const group = await GroupsService.getGroupDetails(groupId);
            const memberUser = await GroupsService.getUserById(memberId);
            const currentUserDoc = await GroupsService.getUserById(this.currentUser.uid);
            
            // Send notification instead of directly adding co-owner
            const NotificationService = (await import('/services/notification-service.js')).default;
            await NotificationService.createCoOwnerInvite(
                groupId,
                group.name,
                this.currentUser.uid,
                currentUserDoc.displayName || currentUserDoc.email,
                memberId
            );
            
            this.showSuccess(`Co-owner invitation sent to ${memberUser.name || memberUser.displayName || memberUser.email}`);
        } catch (error) {
            console.error('Error sending co-owner invitation:', error);
            this.showError('Failed to send co-owner invitation');
        }
    }

    async removeCoOwner(groupId, memberId) {
        try {
            await GroupsService.removeCoOwner(groupId, memberId);
            this.showSuccess('Co-owner privileges removed');
            
            // Refresh member list
            await this.refreshMemberList();
        } catch (error) {
            console.error('Error removing co-owner privileges:', error);
            this.showError('Failed to remove co-owner privileges');
        }
    }

    async removeMember(groupId, memberId) {
        try {
            await GroupsService.removeMemberFromGroup(groupId, memberId, this.currentUser.uid);
            this.showSuccess('Member removed from group');
            
            // Refresh member list
            await this.refreshMemberList();
            await this.loadGroups();
        } catch (error) {
            console.error('Error removing member:', error);
            this.showError('Failed to remove member from group');
        }
    }

    hideGroupDetailsModal() {
        this.groupDetailsModal.style.display = 'none';
    }

    copyJoinCode(joinCode) {
        navigator.clipboard.writeText(joinCode).then(() => {
            this.showSuccess('Join code copied to clipboard!');
        }).catch(() => {
            this.showError('Failed to copy join code');
        });
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

    showPermissionsModal(groupId, memberId, memberName, memberRole) {
        this.currentPermissionsGroupId = groupId;
        this.currentPermissionsMemberId = memberId;
        
        this.permissionMemberName.textContent = memberName;
        this.permissionMemberRole.textContent = memberRole;
        
        // Load current permissions
        this.loadMemberPermissions(groupId, memberId);
        
        this.permissionsModal.style.display = 'flex';
    }

    hidePermissionsModal() {
        this.permissionsModal.style.display = 'none';
    }

    async loadMemberPermissions(groupId, memberId) {
        try {
            // Get current permissions from group data or set defaults
            const group = await GroupsService.getGroupDetails(groupId);
            const memberPermissions = group.memberPermissions?.[memberId] || this.getDefaultPermissions();
            
            // Set checkbox states
            document.getElementById('canEditGroup').checked = memberPermissions.canEditGroup || false;
            document.getElementById('canDeleteGroup').checked = memberPermissions.canDeleteGroup || false;
            document.getElementById('canAddMembers').checked = memberPermissions.canAddMembers || false;
            document.getElementById('canRemoveMembers').checked = memberPermissions.canRemoveMembers || false;
            document.getElementById('canPromoteMembers').checked = memberPermissions.canPromoteMembers || false;
            document.getElementById('canCreateAnnouncements').checked = memberPermissions.canCreateAnnouncements || false;
            document.getElementById('canManageEvents').checked = memberPermissions.canManageEvents || false;
            document.getElementById('canManageForms').checked = memberPermissions.canManageForms || false;
        } catch (error) {
            console.error('Error loading member permissions:', error);
            this.showError('Failed to load member permissions');
        }
    }

    getDefaultPermissions() {
        return {
            canEditGroup: false,
            canDeleteGroup: false,
            canAddMembers: false,
            canRemoveMembers: false,
            canPromoteMembers: false,
            canCreateAnnouncements: false,
            canManageEvents: false,
            canManageForms: false
        };
    }

    async savePermissions() {
        try {
            const permissions = {
                canEditGroup: document.getElementById('canEditGroup').checked,
                canDeleteGroup: document.getElementById('canDeleteGroup').checked,
                canAddMembers: document.getElementById('canAddMembers').checked,
                canRemoveMembers: document.getElementById('canRemoveMembers').checked,
                canPromoteMembers: document.getElementById('canPromoteMembers').checked,
                canCreateAnnouncements: document.getElementById('canCreateAnnouncements').checked,
                canManageEvents: document.getElementById('canManageEvents').checked,
                canManageForms: document.getElementById('canManageForms').checked
            };

            await GroupsService.updateMemberPermissions(
                this.currentPermissionsGroupId, 
                this.currentPermissionsMemberId, 
                permissions
            );
            
            this.hidePermissionsModal();
            this.showSuccess('Permissions updated successfully');
        } catch (error) {
            console.error('Error saving permissions:', error);
            this.showError('Failed to save permissions');
        }
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
