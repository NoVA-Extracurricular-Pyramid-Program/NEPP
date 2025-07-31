import ResourcesService from '/services/resources-service.js';
import authManager from '/utils/auth-manager.js';
import { db } from '/config/firebase-config.js';
import { 
    collection, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

class ResourcesManager {
    constructor() {
        this.currentUser = null;
        this.files = [];
        this.folders = [];
        this.filteredFiles = [];
        this.filteredFolders = [];
        this.uploadQueue = [];
        this.isUploading = false;
        this.currentFolderId = null;
        this.folderPath = [];
        this.draggedItem = null;
        this.contextItem = null;
        
        this.initializeElements();
        this.bindEvents();
        this.setupAuthListener();
    }

    initializeElements() {
        // Main elements
        this.searchInput = document.getElementById('searchInput');
        this.fileFilter = document.getElementById('fileFilter');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.createFolderBtn = document.getElementById('createFolderBtn');
        this.fileInput = document.getElementById('fileInput');
        this.dropZone = document.getElementById('dropZone');
        this.filesList = document.getElementById('filesList');
        this.breadcrumbList = document.getElementById('breadcrumbList');
        this.rootFolderBtn = document.getElementById('rootFolder');
        
        // Modal elements
        this.uploadModal = document.getElementById('uploadModal');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.cancelUploadBtn = document.getElementById('cancelUpload');
        
        this.createFolderModal = document.getElementById('createFolderModal');
        this.folderNameInput = document.getElementById('folderName');
        this.cancelCreateFolderBtn = document.getElementById('cancelCreateFolder');
        this.confirmCreateFolderBtn = document.getElementById('confirmCreateFolder');
        
        this.renameModal = document.getElementById('renameModal');
        this.renameModalTitle = document.getElementById('renameModalTitle');
        this.newItemNameInput = document.getElementById('newItemName');
        this.cancelRenameBtn = document.getElementById('cancelRename');
        this.confirmRenameBtn = document.getElementById('confirmRename');
        
        this.moveModal = document.getElementById('moveModal');
        this.moveModalTitle = document.getElementById('moveModalTitle');
        this.folderTree = document.getElementById('folderTree');
        this.cancelMoveBtn = document.getElementById('cancelMove');
        this.confirmMoveBtn = document.getElementById('confirmMove');
        
        this.shareModal = document.getElementById('shareModal');
        this.shareType = document.getElementById('shareType');
        this.groupSelection = document.getElementById('groupSelection');
        this.groupSelect = document.getElementById('groupSelect');
        this.userSelection = document.getElementById('userSelection');
        this.userSelect = document.getElementById('userSelect');
        this.shareDescription = document.getElementById('shareDescription');
        this.cancelShareBtn = document.getElementById('cancelShare');
        this.confirmShareBtn = document.getElementById('confirmShare');
        
        this.previewModal = document.getElementById('previewModal');
        this.previewContainer = document.getElementById('previewContainer');
        this.closePreviewBtn = document.getElementById('closePreview');
        
        this.contextMenu = document.getElementById('contextMenu');
        this.contextRename = document.getElementById('contextRename');
        this.contextMove = document.getElementById('contextMove');
        this.contextShare = document.getElementById('contextShare');
        this.contextDelete = document.getElementById('contextDelete');
    }

    bindEvents() {
        // Search functionality
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filterItems(e.target.value);
            });
        }

        // Filter functionality
        if (this.fileFilter) {
            this.fileFilter.addEventListener('change', (e) => {
                this.filterByType(e.target.value);
            });
        }

        // Upload button
        if (this.uploadBtn) {
            this.uploadBtn.addEventListener('click', () => {
                this.fileInput.click();
            });
        }

        // Create folder button
        if (this.createFolderBtn) {
            this.createFolderBtn.addEventListener('click', () => {
                this.showCreateFolderModal();
            });
        }

        // File input
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(Array.from(e.target.files));
            });
        }

        // Root folder navigation
        if (this.rootFolderBtn) {
            this.rootFolderBtn.addEventListener('click', () => {
                this.navigateToFolder(null);
            });
        }

        // Drag and drop
        this.setupDragAndDrop();

        // Modal events
        this.setupModalEvents();

        // Context menu events
        this.setupContextMenu();

        // Global click to hide context menu
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Prevent context menu on right click in specific areas
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.files-list')) {
                e.preventDefault();
            }
        });
    }

    setupDragAndDrop() {
        if (!this.dropZone) return;

        // Drop zone events
        this.dropZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!this.dropZone.contains(e.relatedTarget)) {
                this.dropZone.classList.remove('drag-over');
            }
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            this.handleFileSelection(files);
        });

        // Global drag events for folder drag & drop
        document.addEventListener('dragstart', (e) => {
            const fileItem = e.target.closest('.file-item, .folder-item');
            if (fileItem) {
                this.draggedItem = {
                    id: fileItem.dataset.fileId || fileItem.dataset.folderId,
                    type: fileItem.classList.contains('folder-item') ? 'folder' : 'file',
                    element: fileItem
                };
                fileItem.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        document.addEventListener('dragend', (e) => {
            if (this.draggedItem) {
                this.draggedItem.element.classList.remove('dragging');
                this.draggedItem = null;
            }
            // Remove drag-over from all elements
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        document.addEventListener('dragover', (e) => {
            if (this.draggedItem) {
                e.preventDefault();
            }
        });

        document.addEventListener('drop', (e) => {
            if (this.draggedItem) {
                e.preventDefault();
                const targetFolder = e.target.closest('.folder-item');
                if (targetFolder && targetFolder !== this.draggedItem.element) {
                    const targetFolderId = targetFolder.dataset.folderId;
                    this.moveItemToFolder(this.draggedItem, targetFolderId);
                }
            }
        });
    }

    setupModalEvents() {
        // Create folder modal
        this.cancelCreateFolderBtn?.addEventListener('click', () => {
            this.hideCreateFolderModal();
        });

        this.confirmCreateFolderBtn?.addEventListener('click', () => {
            this.handleCreateFolder();
        });

        this.folderNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleCreateFolder();
            }
        });

        // Rename modal
        this.cancelRenameBtn?.addEventListener('click', () => {
            this.hideRenameModal();
        });

        this.confirmRenameBtn?.addEventListener('click', () => {
            this.handleRename();
        });

        this.newItemNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleRename();
            }
        });

        // Move modal
        this.cancelMoveBtn?.addEventListener('click', () => {
            this.hideMoveModal();
        });

        this.confirmMoveBtn?.addEventListener('click', () => {
            this.handleMove();
        });

        // Upload modal
        this.cancelUploadBtn?.addEventListener('click', () => {
            this.cancelUpload();
        });

        // Share modal
        this.shareType?.addEventListener('change', () => {
            this.updateShareOptions();
        });

        this.cancelShareBtn?.addEventListener('click', () => {
            this.hideShareModal();
        });

        this.confirmShareBtn?.addEventListener('click', () => {
            this.handleShareConfirm();
        });

        // Preview modal
        this.closePreviewBtn?.addEventListener('click', () => {
            this.closePreview();
        });

        // Close modals when clicking outside
        [this.uploadModal, this.createFolderModal, this.renameModal, this.moveModal, this.shareModal, this.previewModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
            }
        });
    }

    setupContextMenu() {
        this.contextRename?.addEventListener('click', () => {
            this.showRenameModal();
            this.hideContextMenu();
        });

        this.contextMove?.addEventListener('click', () => {
            this.showMoveModal();
            this.hideContextMenu();
        });

        this.contextShare?.addEventListener('click', () => {
            this.showShareModal(this.contextItem.id);
            this.hideContextMenu();
        });

        this.contextDelete?.addEventListener('click', () => {
            this.deleteItem();
            this.hideContextMenu();
        });
    }

    setupAuthListener() {
        authManager.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadFolderContents();
                this.checkForResourceParameter();
            } else {
                this.showAuthAlert();
            }
        });
    }

    checkForResourceParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const resourceId = urlParams.get('resource');
        const fileId = urlParams.get('file');
        
        const targetId = resourceId || fileId;
        if (targetId) {
            setTimeout(() => {
                const element = document.querySelector(`[data-file-id="${targetId}"], [data-folder-id="${targetId}"]`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.style.backgroundColor = 'rgba(255, 214, 0, 0.2)';
                    element.style.border = '2px solid #ffd600';
                    setTimeout(() => {
                        element.style.backgroundColor = '';
                        element.style.border = '';
                    }, 3000);
                }
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }, 1000);
        }
    }

    showAuthAlert() {
        alert('Please log in to access your resources.');
        window.location.href = 'login.html';
    }

    async loadFolderContents() {
        try {
            const { getDocs, query, where, collection } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
            const { db } = await import('/config/firebase-config.js');
            
            const groupsQuery = query(
                collection(db, 'groups'),
                where('members', 'array-contains', this.currentUser.uid)
            );
            
            const groupsSnapshot = await getDocs(groupsQuery);
            const userGroups = groupsSnapshot.docs.map(doc => doc.id);
            
            const contents = await ResourcesService.getFolderContents(this.currentUser.uid, this.currentFolderId, userGroups);
            this.folders = contents.folders || [];
            this.files = contents.files || [];
            
            this.filteredFolders = [...this.folders];
            this.filteredFiles = [...this.files];
            
            this.updateBreadcrumb();
            this.renderItems();
        } catch (error) {
            console.error('Error loading folder contents:', error);
            this.showError('Failed to load folder contents');
        }
    }

    async navigateToFolder(folderId) {
        this.currentFolderId = folderId;
        await this.loadFolderContents();
    }

    async updateBreadcrumb() {
        if (this.currentFolderId) {
            this.folderPath = await ResourcesService.getFolderPath(this.currentFolderId);
        } else {
            this.folderPath = [];
        }

        this.renderBreadcrumb();
    }

    renderBreadcrumb() {
        if (!this.breadcrumbList) return;

        // Clear existing breadcrumbs except root
        const rootItem = this.breadcrumbList.querySelector('.breadcrumb-item');
        this.breadcrumbList.innerHTML = '';
        this.breadcrumbList.appendChild(rootItem);

        // Add folder path
        this.folderPath.forEach((folder, index) => {
            const li = document.createElement('li');
            li.className = 'breadcrumb-item';
            
            const button = document.createElement('button');
            button.className = 'breadcrumb-btn';
            button.textContent = folder.name;
            button.addEventListener('click', () => {
                this.navigateToFolder(folder.id);
            });
            
            li.appendChild(button);
            this.breadcrumbList.appendChild(li);
        });
    }

    filterItems(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredFolders = [...this.folders];
            this.filteredFiles = [...this.files];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredFolders = this.folders.filter(folder => 
                folder.name.toLowerCase().includes(term)
            );
            this.filteredFiles = ResourcesService.searchFiles(this.files, searchTerm);
        }
        this.renderItems();
    }

    filterByType(filterType) {
        const currentUser = this.currentUser;
        if (!currentUser) return;

        let filteredFolders = [...this.folders];
        let filteredFiles = [...this.files];

        switch (filterType) {
            case 'my-files':
                filteredFolders = this.folders.filter(folder => folder.userId === currentUser.uid);
                filteredFiles = this.files.filter(file => file.userId === currentUser.uid);
                break;
            case 'shared-with-me':
                filteredFolders = this.folders.filter(folder => 
                    folder.userId !== currentUser.uid && (
                        folder.isShared === true ||
                        (folder.sharedWith && folder.sharedWith.includes(currentUser.uid)) ||
                        (folder.shareType === 'group' && folder.groupId)
                    )
                );
                filteredFiles = this.files.filter(file => 
                    file.userId !== currentUser.uid && (
                        file.isShared === true ||
                        (file.sharedWith && file.sharedWith.includes(currentUser.uid)) ||
                        (file.shareType === 'group' && file.groupId)
                    )
                );
                break;
            case 'shared-by-me':
                filteredFolders = this.folders.filter(folder => 
                    folder.userId === currentUser.uid && folder.isShared === true
                );
                filteredFiles = this.files.filter(file => 
                    file.userId === currentUser.uid && file.isShared === true
                );
                break;
            case 'all':
            default:
                // Keep current filtered state
                break;
        }
        
        // Apply search filter if active
        if (this.searchInput && this.searchInput.value.trim()) {
            const term = this.searchInput.value.toLowerCase();
            filteredFolders = filteredFolders.filter(folder => 
                folder.name.toLowerCase().includes(term)
            );
            filteredFiles = ResourcesService.searchFiles(filteredFiles, this.searchInput.value);
        }
        
        this.filteredFolders = filteredFolders;
        this.filteredFiles = filteredFiles;
        this.renderItems();
    }

    renderItems() {
        if (this.filteredFolders.length === 0 && this.filteredFiles.length === 0) {
            this.renderEmptyState();
            return;
        }

        const foldersHTML = this.filteredFolders.map(folder => this.renderFolder(folder)).join('');
        const filesHTML = this.filteredFiles.map(file => this.renderFile(file)).join('');
        
        this.filesList.innerHTML = foldersHTML + filesHTML;
        this.bindItemEvents();
    }

    renderFolder(folder) {
        const folderCount = 0; // We could load this if needed
        const date = ResourcesService.formatDate(folder.createdAt);

        return `
            <div class="folder-item" data-folder-id="${folder.id}" draggable="true">
                <div class="folder-item-header">
                    <div class="folder-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                        </svg>
                    </div>
                    <div class="folder-name" title="${folder.name}">
                        ${folder.name}
                    </div>
                </div>
                <div class="folder-info">
                    <span class="folder-item-count">${folderCount} items</span>
                    <span class="folder-date">${date}</span>
                </div>
            </div>
        `;
    }

    renderFile(file) {
        const category = ResourcesService.getFileTypeCategory(file.type);
        const extension = ResourcesService.getFileExtension(file.name);
        const size = ResourcesService.formatFileSize(file.size);
        const date = ResourcesService.formatDate(file.uploadedAt);

        return `
            <div class="file-item" data-file-id="${file.id}" draggable="true">
                <div class="file-actions">
                    <button class="file-action-btn" onclick="resourcesManager.previewFile('${file.id}')" title="Preview">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                    </button>
                    <button class="file-action-btn" onclick="resourcesManager.showShareModal('${file.id}')" title="Share">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314a2.25 2.25 0 1 1 .434 2.44L7.217 13.747m0-2.186 9.566 5.314m-9.566-5.314L7.217 13.747M10.5 12a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                        </svg>
                    </button>
                    <button class="file-action-btn" onclick="resourcesManager.downloadFile('${file.id}')" title="Download">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                    </button>
                    <button class="file-action-btn" onclick="resourcesManager.deleteFile('${file.id}', '${file.storagePath}')" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </button>
                </div>
                <div class="file-item-header">
                    <div class="file-icon ${category}">
                        ${extension}
                    </div>
                    <div class="file-name" title="${file.name}">
                        ${file.name}
                    </div>
                </div>
                <div class="file-info">
                    <span class="file-size">${size}</span>
                    <span class="file-date">${date}</span>
                </div>
            </div>
        `;
    }

    bindItemEvents() {
        // Double-click to open folders
        document.querySelectorAll('.folder-item').forEach(folderElement => {
            folderElement.addEventListener('dblclick', () => {
                const folderId = folderElement.dataset.folderId;
                this.navigateToFolder(folderId);
            });

            folderElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, folderId, 'folder');
            });

            // Drag over folder
            folderElement.addEventListener('dragover', (e) => {
                if (this.draggedItem && this.draggedItem.element !== folderElement) {
                    e.preventDefault();
                    folderElement.classList.add('drag-over');
                }
            });

            folderElement.addEventListener('dragleave', () => {
                folderElement.classList.remove('drag-over');
            });
        });

        // File events
        document.querySelectorAll('.file-item').forEach(fileElement => {
            fileElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const fileId = fileElement.dataset.fileId;
                this.showContextMenu(e, fileId, 'file');
            });
        });
    }

    renderEmptyState() {
        this.filesList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
                <h3>This folder is empty</h3>
                <p>Upload some files or create folders to get started.</p>
            </div>
        `;
    }

    // Folder Management Methods
    showCreateFolderModal() {
        this.folderNameInput.value = '';
        this.createFolderModal.style.display = 'flex';
        this.folderNameInput.focus();
    }

    hideCreateFolderModal() {
        this.createFolderModal.style.display = 'none';
    }

    async handleCreateFolder() {
        const name = this.folderNameInput.value.trim();
        if (!name) {
            this.showError('Please enter a folder name');
            return;
        }

        // Validate folder name length and characters
        if (name.length > 100) {
            this.showError('Folder name cannot exceed 100 characters');
            return;
        }

        if (!/^[a-zA-Z0-9\s\-_\.()]+$/.test(name)) {
            this.showError('Folder name contains invalid characters. Use only letters, numbers, spaces, hyphens, underscores, dots, and parentheses.');
            return;
        }

        // Check if user is authenticated
        if (!this.currentUser || !this.currentUser.uid) {
            this.showError('You must be logged in to create folders');
            return;
        }

        try {
            // Set loading state
            this.confirmCreateFolderBtn.disabled = true;
            this.confirmCreateFolderBtn.textContent = 'Creating...';

            // Create folder with proper parent folder ID (null for root level)
            const parentFolderId = this.currentFolderId || null;
            console.log('Creating folder:', { name, parentFolderId, userId: this.currentUser.uid });
            
            await ResourcesService.createFolder(name, parentFolderId, this.currentUser.uid);
            
            this.hideCreateFolderModal();
            this.showSuccess('Folder created successfully');
            await this.loadFolderContents();
        } catch (error) {
            console.error('Error creating folder:', error);
            
            // Provide more specific error messages
            if (error.code === 'permission-denied') {
                this.showError('Permission denied. Please check your account privileges.');
            } else if (error.code === 'unauthenticated') {
                this.showError('Authentication required. Please log in again.');
            } else if (error.message && error.message.includes('email_verified')) {
                this.showError('Email verification required. Please verify your email address.');
            } else {
                this.showError(`Failed to create folder: ${error.message || 'Unknown error'}`);
            }
        } finally {
            // Reset button state
            this.confirmCreateFolderBtn.disabled = false;
            this.confirmCreateFolderBtn.textContent = 'Create Folder';
        }
    }

    showContextMenu(event, itemId, itemType) {
        this.contextItem = { id: itemId, type: itemType };
        
        const x = event.clientX;
        const y = event.clientY;
        
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.style.display = 'block';
        
        // Adjust position if menu goes off screen
        const rect = this.contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.contextMenu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.contextMenu.style.top = `${y - rect.height}px`;
        }
    }

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.contextItem = null;
    }

    showRenameModal() {
        if (!this.contextItem) return;
        
        const item = this.contextItem.type === 'folder' ? 
            this.folders.find(f => f.id === this.contextItem.id) :
            this.files.find(f => f.id === this.contextItem.id);
            
        if (!item) return;
        
        this.renameModalTitle.textContent = `Rename ${this.contextItem.type === 'folder' ? 'Folder' : 'File'}`;
        this.newItemNameInput.value = item.name;
        this.renameModal.style.display = 'flex';
        this.newItemNameInput.focus();
        this.newItemNameInput.select();
    }

    hideRenameModal() {
        this.renameModal.style.display = 'none';
    }

    async handleRename() {
        if (!this.contextItem) return;
        
        const newName = this.newItemNameInput.value.trim();
        if (!newName) {
            this.showError('Please enter a name');
            return;
        }

        try {
            const isFolder = this.contextItem.type === 'folder';
            await ResourcesService.renameItem(this.contextItem.id, newName, isFolder);
            this.hideRenameModal();
            this.showSuccess(`${isFolder ? 'Folder' : 'File'} renamed successfully`);
            await this.loadFolderContents();
        } catch (error) {
            console.error('Error renaming item:', error);
            this.showError('Failed to rename item');
        }
    }

    async showMoveModal() {
        if (!this.contextItem) return;
        
        this.moveModalTitle.textContent = `Move ${this.contextItem.type === 'folder' ? 'Folder' : 'File'}`;
        this.moveModal.style.display = 'flex';
        
        // Load folder tree
        await this.loadFolderTree();
    }

    hideMoveModal() {
        this.moveModal.style.display = 'none';
        this.selectedTargetFolder = null;
    }

    async loadFolderTree() {
        try {
            // For simplicity, we'll show a flat list of folders
            // In a full implementation, you'd want a proper tree structure
            const allFolders = await ResourcesService.getFolders(this.currentUser.uid, null, []);
            
            this.folderTree.innerHTML = `
                <div class="folder-tree-item ${!this.selectedTargetFolder ? 'selected' : ''}" data-folder-id="">
                    <div class="folder-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                        </svg>
                    </div>
                    Root Folder
                </div>
            `;
            
            allFolders.forEach(folder => {
                if (folder.id !== this.contextItem.id) { // Don't allow moving into self
                    const div = document.createElement('div');
                    div.className = 'folder-tree-item';
                    div.dataset.folderId = folder.id;
                    div.innerHTML = `
                        <div class="folder-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                            </svg>
                        </div>
                        ${folder.name}
                    `;
                    this.folderTree.appendChild(div);
                }
            });
            
            // Bind click events
            this.folderTree.querySelectorAll('.folder-tree-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.folderTree.querySelectorAll('.folder-tree-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    this.selectedTargetFolder = item.dataset.folderId || null;
                });
            });
            
        } catch (error) {
            console.error('Error loading folder tree:', error);
            this.showError('Failed to load folders');
        }
    }

    async handleMove() {
        if (!this.contextItem) return;
        
        try {
            const isFolder = this.contextItem.type === 'folder';
            if (isFolder) {
                await ResourcesService.moveFolder(this.contextItem.id, this.selectedTargetFolder);
            } else {
                await ResourcesService.moveFile(this.contextItem.id, this.selectedTargetFolder);
            }
            
            this.hideMoveModal();
            this.showSuccess(`${isFolder ? 'Folder' : 'File'} moved successfully`);
            await this.loadFolderContents();
        } catch (error) {
            console.error('Error moving item:', error);
            this.showError('Failed to move item');
        }
    }

    async moveItemToFolder(draggedItem, targetFolderId) {
        try {
            if (draggedItem.type === 'folder') {
                await ResourcesService.moveFolder(draggedItem.id, targetFolderId);
            } else {
                await ResourcesService.moveFile(draggedItem.id, targetFolderId);
            }
            
            this.showSuccess(`${draggedItem.type === 'folder' ? 'Folder' : 'File'} moved successfully`);
            await this.loadFolderContents();
        } catch (error) {
            console.error('Error moving item:', error);
            this.showError('Failed to move item');
        }
    }

    async deleteItem() {
        if (!this.contextItem) return;
        
        const itemType = this.contextItem.type;
        const itemName = itemType === 'folder' ? 
            this.folders.find(f => f.id === this.contextItem.id)?.name :
            this.files.find(f => f.id === this.contextItem.id)?.name;
            
        if (!confirm(`Are you sure you want to delete this ${itemType}${itemName ? ` "${itemName}"` : ''}?`)) {
            return;
        }

        try {
            if (itemType === 'folder') {
                await ResourcesService.deleteFolder(this.contextItem.id, this.currentUser.uid);
            } else {
                const file = this.files.find(f => f.id === this.contextItem.id);
                await ResourcesService.deleteFile(this.contextItem.id, file.storagePath);
            }
            
            this.showSuccess(`${itemType === 'folder' ? 'Folder' : 'File'} deleted successfully`);
            await this.loadFolderContents();
        } catch (error) {
            console.error('Error deleting item:', error);
            this.showError('Failed to delete item');
        }
    }

    // File Management Methods (existing methods updated for folder context)
    async handleFileSelection(files) {
        if (!files || files.length === 0) return;

        const validFiles = [];
        for (const file of files) {
            try {
                ResourcesService.validateFile(file);
                validFiles.push(file);
            } catch (error) {
                this.showError(`${file.name}: ${error.message}`);
            }
        }

        if (validFiles.length === 0) return;

        try {
            const uploadedFileIds = await this.uploadFiles(validFiles);
            
            if (uploadedFileIds && uploadedFileIds.length > 0) {
                this.selectedFiles = uploadedFileIds;
                this.showShareModal();
            }
        } catch (error) {
            console.error('Error uploading files:', error);
        }
    }

    async uploadFiles(files) {
        if (this.isUploading) return [];

        this.isUploading = true;
        this.uploadQueue = [...files];
        this.showUploadModal();

        const uploadedFileIds = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileId = await this.uploadSingleFile(file, i);
                if (fileId) {
                    uploadedFileIds.push(fileId);
                }
            }

            await this.loadFolderContents();
            this.hideUploadModal();
            this.showSuccess(`Successfully uploaded ${files.length} file(s)`);
            
            return uploadedFileIds;
        } catch (error) {
            console.error('Upload error:', error);
            this.showError('Upload failed: ' + error.message);
            throw error;
        } finally {
            this.isUploading = false;
        }
    }

    async uploadSingleFile(file, index) {
        const progressId = `progress-${index}`;
        
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.id = progressId;
        progressItem.innerHTML = `
            <div class="progress-info">
                <div class="progress-name">${file.name}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-status">Preparing...</div>
            </div>
        `;
        this.uploadProgress.appendChild(progressItem);

        const progressBar = progressItem.querySelector('.progress-fill');
        const progressStatus = progressItem.querySelector('.progress-status');

        try {
            const result = await ResourcesService.uploadFile(
                file,
                this.currentUser.uid,
                this.currentFolderId, // Upload to current folder
                (progress) => {
                    progressBar.style.width = `${progress}%`;
                    progressStatus.textContent = `${progress}%`;
                }
            );

            progressStatus.textContent = 'Complete';
            progressBar.style.width = '100%';
            
            return result.id;
        } catch (error) {
            progressStatus.textContent = 'Failed';
            progressBar.style.background = '#f44336';
            throw error;
        }
    }

    showUploadModal() {
        this.uploadProgress.innerHTML = '';
        this.uploadModal.style.display = 'flex';
    }

    hideUploadModal() {
        this.uploadModal.style.display = 'none';
        this.uploadProgress.innerHTML = '';
    }

    cancelUpload() {
        this.isUploading = false;
        this.hideUploadModal();
    }

    // File preview, download, and sharing methods remain the same
    async previewFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        if (!ResourcesService.canPreview(file.type)) {
            this.showError('This file type cannot be previewed');
            return;
        }

        this.previewContainer.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';
        this.previewModal.style.display = 'flex';

        try {
            let previewHTML = '';

            if (file.type.startsWith('image/')) {
                previewHTML = `<img src="${file.downloadURL}" alt="${file.name}" />`;
            } else if (file.type.startsWith('video/')) {
                previewHTML = `<video controls src="${file.downloadURL}">Your browser does not support video playback.</video>`;
            } else if (file.type.startsWith('audio/')) {
                previewHTML = `<audio controls src="${file.downloadURL}">Your browser does not support audio playback.</audio>`;
            } else if (file.type === 'application/pdf') {
                previewHTML = `<iframe src="${file.downloadURL}"></iframe>`;
            } else if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('javascript')) {
                const response = await fetch(file.downloadURL);
                const text = await response.text();
                previewHTML = `<pre>${this.escapeHtml(text)}</pre>`;
            }

            this.previewContainer.innerHTML = previewHTML;
        } catch (error) {
            console.error('Preview error:', error);
            this.previewContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Failed to load preview</p>';
        }
    }

    closePreview() {
        this.previewModal.style.display = 'none';
        this.previewContainer.innerHTML = '';
    }

    downloadFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        const link = document.createElement('a');
        link.href = file.downloadURL;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async deleteFile(fileId, storagePath) {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            await ResourcesService.deleteFile(fileId, storagePath);
            await this.loadFolderContents();
            this.showSuccess('File deleted successfully');
        } catch (error) {
            console.error('Delete error:', error);
            this.showError('Failed to delete file');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Sharing functionality (existing methods remain the same)
    async showShareModal(fileId = null) {
        this.shareFileId = fileId;
        
        await this.loadGroups();
        await this.loadUsers();
        this.shareModal.style.display = 'flex';
    }

    hideShareModal() {
        this.shareModal.style.display = 'none';
        this.selectedFiles = [];
        this.shareFileId = null;
        
        this.shareType.value = 'group';
        this.shareDescription.value = '';
        this.updateShareOptions();
    }

    updateShareOptions() {
        const shareType = this.shareType.value;
        
        this.groupSelection.style.display = shareType === 'group' ? 'block' : 'none';
        this.userSelection.style.display = shareType === 'specific' ? 'block' : 'none';
    }

    async loadGroups() {
        try {
            const { getDocs, query, where, collection } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
            const { db } = await import('/config/firebase-config.js');
            
            const groupsQuery = query(
                collection(db, 'groups'),
                where('members', 'array-contains', this.currentUser.uid)
            );
            
            const groupsSnapshot = await getDocs(groupsQuery);
            
            this.groupSelect.innerHTML = '<option value="">Select a group...</option>';
            groupsSnapshot.forEach(doc => {
                const group = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = group.name;
                this.groupSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }

    async loadUsers() {
        try {
            const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
            const { db } = await import('/config/firebase-config.js');
            
            this.userSelection.innerHTML = `
                <label for="userSelect">Search Users:</label>
                <div class="user-search-container">
                    <input type="text" id="userSearchInput" class="user-search-input" placeholder="Type at least 2 characters to search users..." />
                    <div id="userSearchResults" class="user-search-results" style="display: none;"></div>
                    <div id="selectedUsersList" class="selected-users-list"></div>
                </div>
            `;
            
            const userSearchInput = document.getElementById('userSearchInput');
            const userSearchResults = document.getElementById('userSearchResults');
            const selectedUsersList = document.getElementById('selectedUsersList');
            let selectedUsers = new Set();
            let allUsers = [];
            
            const usersSnapshot = await getDocs(collection(db, 'users'));
            usersSnapshot.forEach(doc => {
                const user = doc.data();
                if (doc.id !== this.currentUser.uid) {
                    allUsers.push({
                        id: doc.id,
                        name: user.displayName || user.email,
                        email: user.email
                    });
                }
            });
            
            userSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.trim();
                
                if (searchTerm.length < 2) {
                    userSearchResults.style.display = 'none';
                    return;
                }
                
                const filteredUsers = allUsers.filter(user => 
                    !selectedUsers.has(user.id) && (
                        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        user.email.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                );
                
                if (filteredUsers.length === 0) {
                    userSearchResults.innerHTML = '<div class="no-results">No users found</div>';
                } else {
                    userSearchResults.innerHTML = filteredUsers.map(user => `
                        <div class="user-search-result" data-user-id="${user.id}">
                            <span class="user-name">${user.name}</span>
                            <span class="user-email">${user.email}</span>
                        </div>
                    `).join('');
                }
                
                userSearchResults.style.display = 'block';
            });
            
            userSearchResults.addEventListener('click', (e) => {
                const userResult = e.target.closest('.user-search-result');
                if (userResult) {
                    const userId = userResult.dataset.userId;
                    const user = allUsers.find(u => u.id === userId);
                    
                    selectedUsers.add(userId);
                    
                    const selectedUserEl = document.createElement('div');
                    selectedUserEl.className = 'selected-user';
                    selectedUserEl.innerHTML = `
                        <span>${user.name}</span>
                        <button type="button" class="remove-user-btn" data-user-id="${userId}">×</button>
                    `;
                    selectedUsersList.appendChild(selectedUserEl);
                    
                    userSearchInput.value = '';
                    userSearchResults.style.display = 'none';
                }
            });
            
            selectedUsersList.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-user-btn')) {
                    const userId = e.target.dataset.userId;
                    selectedUsers.delete(userId);
                    e.target.closest('.selected-user').remove();
                }
            });
            
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.user-search-container')) {
                    userSearchResults.style.display = 'none';
                }
            });
            
            this.getSelectedUsers = () => Array.from(selectedUsers);
            
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async handleShareConfirm() {
        try {
            const shareType = this.shareType.value;
            const description = this.shareDescription.value;
            
            let shareData = {
                type: shareType,
                description: description
            };

            if (shareType === 'group') {
                const selectedGroup = this.groupSelect.value;
                if (!selectedGroup) {
                    this.showError('Please select a group');
                    return;
                }
                shareData.groupId = selectedGroup;
            } else if (shareType === 'specific') {
                const selectedUsers = this.getSelectedUsers ? this.getSelectedUsers() : [];
                
                if (selectedUsers.length === 0) {
                    this.showError('Please select at least one user');
                    return;
                }
                shareData.userIds = selectedUsers;
            }

            let filesToShare = [];
            if (this.shareFileId) {
                filesToShare = [this.shareFileId];
            } else if (this.selectedFiles && this.selectedFiles.length > 0) {
                filesToShare = this.selectedFiles;
            } else {
                this.showError('No files selected for sharing');
                return;
            }

            for (const fileId of filesToShare) {
                await ResourcesService.shareFile(fileId, shareData, this.currentUser.uid);
            }

            this.showSuccess(`Successfully shared ${filesToShare.length} file(s)`);
            this.hideShareModal();
            
            await this.loadFolderContents();
        } catch (error) {
            console.error('Error sharing files:', error);
            this.showError('Failed to share files: ' + error.message);
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

// Initialize the resources manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const resourcesManager = new ResourcesManager();
    
    // Make it globally available for inline event handlers
    window.resourcesManager = resourcesManager;
});
