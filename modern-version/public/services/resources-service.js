import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    deleteDoc, 
    doc, 
    query, 
    where, 
    orderBy,
    updateDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject,
    getMetadata 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";
import { db, storage } from '/config/firebase-config.js';

class ResourcesService {
    constructor() {
        this.collectionName = 'resources';
        this.foldersCollectionName = 'folders';
    }

    // Create a new folder
    async createFolder(name, parentFolderId, userId) {
        try {
            const folderData = {
                name: name.trim(),
                parentFolderId: parentFolderId || null,
                userId,
                type: 'folder',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                // Sharing data
                shareType: 'private',
                shareDescription: '',
                groupId: null,
                sharedWith: [],
                isShared: false
            };

            const docRef = await addDoc(collection(db, this.foldersCollectionName), folderData);
            
            return {
                id: docRef.id,
                ...folderData,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Error creating folder:', error);
            throw error;
        }
    }

    // Get folders for a user with optional parent filter
    async getFolders(userId, parentFolderId = null, userGroups = []) {
        try {
            const queries = [];
            
            // User's own folders
            queries.push(
                query(
                    collection(db, this.foldersCollectionName),
                    where('userId', '==', userId),
                    where('parentFolderId', '==', parentFolderId),
                    orderBy('name', 'asc')
                )
            );
            
            // Folders shared with user's groups
            if (userGroups.length > 0) {
                for (const groupId of userGroups) {
                    queries.push(
                        query(
                            collection(db, this.foldersCollectionName),
                            where('groupId', '==', groupId),
                            where('shareType', '==', 'group'),
                            where('parentFolderId', '==', parentFolderId),
                            orderBy('name', 'asc')
                        )
                    );
                }
            }

            // Execute all queries
            const queryPromises = queries.map(q => getDocs(q));
            const querySnapshots = await Promise.all(queryPromises);
            
            // Combine results and remove duplicates
            const foldersMap = new Map();
            
            querySnapshots.forEach(querySnapshot => {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    foldersMap.set(doc.id, {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        updatedAt: data.updatedAt?.toDate() || new Date()
                    });
                });
            });
            
            return Array.from(foldersMap.values());
        } catch (error) {
            console.error('Error fetching folders:', error);
            throw error;
        }
    }

    // Get folder path for breadcrumb navigation
    async getFolderPath(folderId) {
        try {
            const path = [];
            let currentFolderId = folderId;

            while (currentFolderId) {
                const folderDoc = await getDoc(doc(db, this.foldersCollectionName, currentFolderId));
                if (folderDoc.exists()) {
                    const folderData = folderDoc.data();
                    path.unshift({
                        id: currentFolderId,
                        name: folderData.name
                    });
                    currentFolderId = folderData.parentFolderId;
                } else {
                    break;
                }
            }

            return path;
        } catch (error) {
            console.error('Error getting folder path:', error);
            return [];
        }
    }

    // Move file to a folder
    async moveFile(fileId, targetFolderId) {
        try {
            const fileRef = doc(db, this.collectionName, fileId);
            await updateDoc(fileRef, {
                folderId: targetFolderId,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error moving file:', error);
            throw error;
        }
    }

    // Move folder to another folder
    async moveFolder(folderId, targetParentFolderId) {
        try {
            // Check for circular dependency
            if (await this.wouldCreateCircularDependency(folderId, targetParentFolderId)) {
                throw new Error('Cannot move folder: would create circular dependency');
            }

            const folderRef = doc(db, this.foldersCollectionName, folderId);
            await updateDoc(folderRef, {
                parentFolderId: targetParentFolderId,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error moving folder:', error);
            throw error;
        }
    }

    // Check for circular dependency when moving folders
    async wouldCreateCircularDependency(sourceFolderId, targetParentFolderId) {
        if (!targetParentFolderId) return false;
        
        let currentFolderId = targetParentFolderId;
        while (currentFolderId) {
            if (currentFolderId === sourceFolderId) {
                return true;
            }
            
            const folderDoc = await getDoc(doc(db, this.foldersCollectionName, currentFolderId));
            if (folderDoc.exists()) {
                currentFolderId = folderDoc.data().parentFolderId;
            } else {
                break;
            }
        }
        
        return false;
    }

    // Rename file or folder
    async renameItem(itemId, newName, isFolder = false) {
        try {
            const collectionName = isFolder ? this.foldersCollectionName : this.collectionName;
            const itemRef = doc(db, collectionName, itemId);
            
            await updateDoc(itemRef, {
                name: newName.trim(),
                updatedAt: serverTimestamp()
            });
            
            return true;
        } catch (error) {
            console.error('Error renaming item:', error);
            throw error;
        }
    }

    // Delete folder and all its contents
    async deleteFolder(folderId, userId) {
        try {
            const batch = writeBatch(db);
            
            // Get folder to verify ownership
            const folderDoc = await getDoc(doc(db, this.foldersCollectionName, folderId));
            if (!folderDoc.exists()) {
                throw new Error('Folder not found');
            }
            
            const folderData = folderDoc.data();
            if (folderData.userId !== userId) {
                throw new Error('You can only delete folders you own');
            }

            // Recursively delete all subfolders and files
            await this.deleteRecursively(folderId, batch, userId);
            
            // Delete the folder itself
            batch.delete(doc(db, this.foldersCollectionName, folderId));
            
            await batch.commit();
            return true;
        } catch (error) {
            console.error('Error deleting folder:', error);
            throw error;
        }
    }

    // Recursively delete folder contents
    async deleteRecursively(folderId, batch, userId) {
        // Delete all files in this folder
        const filesQuery = query(
            collection(db, this.collectionName),
            where('folderId', '==', folderId),
            where('userId', '==', userId)
        );
        const filesSnapshot = await getDocs(filesQuery);
        
        for (const fileDoc of filesSnapshot.docs) {
            const fileData = fileDoc.data();
            // Delete from storage
            if (fileData.storagePath) {
                try {
                    const storageRef = ref(storage, fileData.storagePath);
                    await deleteObject(storageRef);
                } catch (storageError) {
                    console.warn('Failed to delete file from storage:', fileData.storagePath, storageError);
                }
            }
            // Delete from Firestore
            batch.delete(fileDoc.ref);
        }
        
        // Delete all subfolders
        const subfoldersQuery = query(
            collection(db, this.foldersCollectionName),
            where('parentFolderId', '==', folderId),
            where('userId', '==', userId)
        );
        const subfoldersSnapshot = await getDocs(subfoldersQuery);
        
        for (const subfolderDoc of subfoldersSnapshot.docs) {
            await this.deleteRecursively(subfolderDoc.id, batch, userId);
            batch.delete(subfolderDoc.ref);
        }
    }

    // Upload file to Firebase Storage and save metadata to Firestore with folder support
    async uploadFile(file, userId, folderId = null, onProgress = null) {
        try {
            // Create unique filename with timestamp
            const timestamp = Date.now();
            const fileName = `${timestamp}_${file.name}`;
            const filePath = `resources/${userId}/${fileName}`;
            
            // Create storage reference
            const storageRef = ref(storage, filePath);
            
            // Upload file with progress tracking
            const uploadTask = uploadBytes(storageRef, file);
            
            if (onProgress) {
                // Note: Firebase v9 doesn't have built-in progress tracking for uploadBytes
                // We'll simulate progress for now
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += 10;
                    onProgress(Math.min(progress, 90));
                    if (progress >= 90) {
                        clearInterval(progressInterval);
                    }
                }, 100);
            }

            const snapshot = await uploadTask;
            
            if (onProgress) {
                onProgress(100);
            }

            // Get download URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            // Get file metadata
            const metadata = await getMetadata(snapshot.ref);
            
            // Save file metadata to Firestore
            const fileData = {
                name: file.name,
                originalName: file.name,
                size: file.size,
                type: file.type,
                downloadURL,
                storagePath: filePath,
                userId,
                folderId: folderId || null,
                uploadedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastModified: new Date(file.lastModified)
            };

            const docRef = await addDoc(collection(db, this.collectionName), fileData);
            
            return {
                id: docRef.id,
                ...fileData,
                uploadedAt: new Date(),
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    // Get all files for a user in a specific folder (including shared files)
    async getUserFilesInFolder(userId, folderId = null, userGroups = []) {
        try {
            const queries = [];
            
            // User's own files
            queries.push(
                query(
                    collection(db, this.collectionName),
                    where('userId', '==', userId),
                    where('folderId', '==', folderId),
                    orderBy('uploadedAt', 'desc')
                )
            );
            
            // Files shared with user's groups
            if (userGroups.length > 0) {
                for (const groupId of userGroups) {
                    queries.push(
                        query(
                            collection(db, this.collectionName),
                            where('groupId', '==', groupId),
                            where('shareType', '==', 'group'),
                            where('folderId', '==', folderId),
                            orderBy('uploadedAt', 'desc')
                        )
                    );
                }
            }

            // Execute all queries
            const queryPromises = queries.map(q => getDocs(q));
            const querySnapshots = await Promise.all(queryPromises);
            
            // Combine results and remove duplicates
            const filesMap = new Map();
            
            querySnapshots.forEach(querySnapshot => {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    filesMap.set(doc.id, {
                        id: doc.id,
                        ...data,
                        uploadedAt: data.uploadedAt?.toDate() || new Date(),
                        updatedAt: data.updatedAt?.toDate() || new Date(),
                        lastModified: data.lastModified?.toDate() || new Date()
                    });
                });
            });
            
            // Convert to array and sort by date
            const files = Array.from(filesMap.values());
            return files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        } catch (error) {
            console.error('Error fetching user files in folder:', error);
            throw error;
        }
    }

    // Get all files for a user (including shared files) - updated for legacy compatibility
    async getUserFilesWithShared(userId, userGroups = []) {
        return this.getUserFilesInFolder(userId, null, userGroups);
    }

    // Get folder contents (both folders and files)
    async getFolderContents(userId, folderId = null, userGroups = []) {
        try {
            const [folders, files] = await Promise.all([
                this.getFolders(userId, folderId, userGroups),
                this.getUserFilesInFolder(userId, folderId, userGroups)
            ]);

            return {
                folders: folders || [],
                files: files || []
            };
        } catch (error) {
            console.error('Error fetching folder contents:', error);
            throw error;
        }
    }

    // Share folder
    async shareFolder(folderId, shareData, userId) {
        try {
            console.log('Sharing folder:', { folderId, shareData, userId });
            
            const folderDocRef = doc(db, this.foldersCollectionName, folderId);
            const folderDoc = await getDoc(folderDocRef);
            
            if (!folderDoc.exists()) {
                throw new Error('Folder not found');
            }

            const folderData = folderDoc.data();
            
            // Check if user owns the folder
            if (folderData.userId !== userId) {
                throw new Error('You can only share folders you own');
            }

            // Update the folder with sharing information
            const updateData = {
                shareType: shareData.type,
                shareDescription: shareData.description || '',
                groupId: shareData.groupId || null,
                sharedWith: shareData.sharedWith || [],
                isShared: shareData.type !== 'private',
                lastShared: serverTimestamp()
            };

            await updateDoc(folderDocRef, updateData);
            
            // Send notifications for folder sharing
            try {
                await this.sendFolderShareNotifications(folderId, folderData.name, shareData, userId);
            } catch (notificationError) {
                console.warn('Error sending folder share notifications:', notificationError);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error sharing folder:', error);
            throw error;
        }
    }

    // Send notifications for folder sharing
    async sendFolderShareNotifications(folderId, folderName, shareData, sharerUserId) {
        try {
            const NotificationService = (await import('/services/notification-service.js')).default;
            
            // Get sharer's display name
            const userRef = doc(db, 'users', sharerUserId);
            const userDoc = await getDoc(userRef);
            const sharerName = userDoc.exists() ? 
                (userDoc.data().displayName || userDoc.data().email?.split('@')[0] || 'Someone') : 
                'Someone';

            const notifications = [];
            const recipientIds = new Set();

            // Notify directly shared users
            if (shareData.sharedWith && shareData.sharedWith.length > 0) {
                for (const userId of shareData.sharedWith) {
                    if (userId !== sharerUserId && !recipientIds.has(userId)) {
                        recipientIds.add(userId);
                        notifications.push(
                            NotificationService.createResourceSharedNotification(
                                folderId,
                                `📁 ${folderName}`,
                                sharerUserId,
                                sharerName,
                                userId
                            )
                        );
                    }
                }
            }

            // Notify group members if shared with a group
            if (shareData.groupId && shareData.type === 'group') {
                try {
                    const GroupsService = (await import('/services/groups-service.js')).default;
                    const group = await GroupsService.getGroupDetails(shareData.groupId);
                    if (group && group.members) {
                        for (const memberId of group.members) {
                            if (memberId !== sharerUserId && !recipientIds.has(memberId)) {
                                recipientIds.add(memberId);
                                notifications.push(
                                    NotificationService.createResourceSharedNotification(
                                        folderId,
                                        `📁 ${folderName}`,
                                        sharerUserId,
                                        sharerName,
                                        memberId
                                    )
                                );
                            }
                        }
                    }
                } catch (groupError) {
                    console.warn(`Could not load group ${shareData.groupId} for notifications:`, groupError);
                }
            }

            // Send all notifications
            if (notifications.length > 0) {
                await Promise.allSettled(notifications);
                console.log(`Sent ${notifications.length} folder share notifications for folder: ${folderName}`);
            }

        } catch (error) {
            console.error('Error sending folder share notifications:', error);
            throw error;
        }
    }

    // Delete file from both Storage and Firestore
    async deleteFile(fileId, storagePath) {
        try {
            // Delete from Firestore
            await deleteDoc(doc(db, this.collectionName, fileId));
            
            // Delete from Storage
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
            
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    }

    // Upload file with sharing options
    async uploadFileWithSharing(file, userId, shareData, folderId = null, onProgress = null) {
        try {
            // Create unique filename with timestamp
            const timestamp = Date.now();
            const fileName = `${timestamp}_${file.name}`;
            const filePath = `resources/${userId}/${fileName}`;
            
            // Create storage reference
            const storageRef = ref(storage, filePath);
            
            // Upload file with progress tracking
            const uploadTask = uploadBytes(storageRef, file);
            
            if (onProgress) {
                // Note: Firebase v9 doesn't have built-in progress tracking for uploadBytes
                // We'll simulate progress for now
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += 10;
                    onProgress(Math.min(progress, 90));
                    if (progress >= 90) {
                        clearInterval(progressInterval);
                    }
                }, 100);
            }

            const snapshot = await uploadTask;
            
            if (onProgress) {
                onProgress(100);
            }

            // Get download URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            // Get file metadata
            const metadata = await getMetadata(snapshot.ref);
            
            // Save file metadata to Firestore with sharing information
            const fileData = {
                name: file.name,
                originalName: file.name,
                size: file.size,
                type: file.type,
                downloadURL,
                storagePath: filePath,
                userId,
                folderId: folderId || null,
                uploadedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastModified: new Date(file.lastModified),
                // Sharing data
                shareType: shareData.type,
                shareDescription: shareData.description || '',
                groupId: shareData.groupId || null,
                sharedWith: shareData.sharedWith || [],
                isShared: shareData.type !== 'private'
            };

            const docRef = await addDoc(collection(db, this.collectionName), fileData);
            
            return {
                id: docRef.id,
                ...fileData,
                uploadedAt: new Date(),
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Error uploading file with sharing:', error);
            throw error;
        }
    }

    // Share an existing file
    async shareFile(fileId, shareData, userId) {
        try {
            console.log('Sharing file:', { fileId, shareData, userId });
            
            // Ensure fileId is a string
            if (!fileId || typeof fileId !== 'string') {
                throw new Error(`Invalid file ID: ${fileId} (type: ${typeof fileId})`);
            }
            
            const fileDocRef = doc(db, this.collectionName, fileId);
            const fileDoc = await getDoc(fileDocRef);
            
            if (!fileDoc.exists()) {
                throw new Error('File not found');
            }

            const fileData = fileDoc.data();
            
            // Check if user owns the file
            if (fileData.userId !== userId) {
                throw new Error('You can only share files you own');
            }

            // Update the file with sharing information
            const updateData = {
                shareType: shareData.type,
                shareDescription: shareData.description || '',
                groupId: shareData.groupId || null,
                sharedWith: shareData.sharedWith || [],
                isShared: shareData.type !== 'private',
                lastShared: serverTimestamp()
            };

            await updateDoc(fileDocRef, updateData);
            
            // Send notifications for file sharing
            try {
                await this.sendFileShareNotifications(fileId, fileData.name, shareData, userId);
            } catch (notificationError) {
                console.warn('Error sending file share notifications:', notificationError);
                // Don't fail file sharing if notifications fail
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error sharing file:', error);
            throw error;
        }
    }

    // Send notifications for file sharing
    async sendFileShareNotifications(fileId, fileName, shareData, sharerUserId) {
        try {
            // Import services dynamically to avoid circular dependencies
            const NotificationService = (await import('/services/notification-service.js')).default;
            
            // Get sharer's display name
            const userRef = doc(db, 'users', sharerUserId);
            const userDoc = await getDoc(userRef);
            const sharerName = userDoc.exists() ? 
                (userDoc.data().displayName || userDoc.data().email?.split('@')[0] || 'Someone') : 
                'Someone';

            const notifications = [];
            const recipientIds = new Set(); // Prevent duplicate notifications

            // Notify directly shared users
            if (shareData.sharedWith && shareData.sharedWith.length > 0) {
                for (const userId of shareData.sharedWith) {
                    if (userId !== sharerUserId && !recipientIds.has(userId)) {
                        recipientIds.add(userId);
                        notifications.push(
                            NotificationService.createResourceSharedNotification(
                                fileId,
                                fileName,
                                sharerUserId,
                                sharerName,
                                userId
                            )
                        );
                    }
                }
            }

            // Notify group members if shared with a group
            if (shareData.groupId && shareData.type === 'group') {
                try {
                    const GroupsService = (await import('/services/groups-service.js')).default;
                    const group = await GroupsService.getGroupDetails(shareData.groupId);
                    if (group && group.members) {
                        for (const memberId of group.members) {
                            if (memberId !== sharerUserId && !recipientIds.has(memberId)) {
                                recipientIds.add(memberId);
                                notifications.push(
                                    NotificationService.createResourceSharedNotification(
                                        fileId,
                                        fileName,
                                        sharerUserId,
                                        sharerName,
                                        memberId
                                    )
                                );
                            }
                        }
                    }
                } catch (groupError) {
                    console.warn(`Could not load group ${shareData.groupId} for notifications:`, groupError);
                }
            }

            // Send all notifications
            if (notifications.length > 0) {
                await Promise.allSettled(notifications);
                console.log(`Sent ${notifications.length} file share notifications for file: ${fileName}`);
            }

        } catch (error) {
            console.error('Error sending file share notifications:', error);
            throw error;
        }
    }

    // Search files by name
    searchFiles(files, searchTerm) {
        if (!searchTerm.trim()) return files;
        
        const term = searchTerm.toLowerCase();
        return files.filter(file => 
            file.name.toLowerCase().includes(term) ||
            file.type.toLowerCase().includes(term)
        );
    }

    // Get file type category for styling
    getFileTypeCategory(mimeType) {
        if (!mimeType) return 'other';
        
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType === 'application/pdf') return 'pdf';
        if (mimeType.includes('text/') || 
            mimeType.includes('application/json') || 
            mimeType.includes('application/javascript') ||
            mimeType.includes('application/xml')) return 'code';
        if (mimeType.includes('document') || 
            mimeType.includes('spreadsheet') || 
            mimeType.includes('presentation') ||
            mimeType.includes('officedocument')) return 'document';
        if (mimeType.includes('zip') || 
            mimeType.includes('rar') || 
            mimeType.includes('tar') ||
            mimeType.includes('compressed')) return 'archive';
        
        return 'other';
    }

    // Get file extension for display
    getFileExtension(fileName) {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
    }

    // Format file size for display
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Format date for display
    formatDate(date) {
        if (!date) return 'Unknown';
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return date.toLocaleDateString();
    }

    // Check if file can be previewed
    canPreview(mimeType) {
        if (!mimeType) return false;
        
        const previewableTypes = [
            'image/', 'video/', 'audio/', 'text/', 'application/pdf',
            'application/json', 'application/javascript', 'application/xml'
        ];
        
        return previewableTypes.some(type => mimeType.startsWith(type));
    }

    // Validate file before upload
    validateFile(file) {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const allowedTypes = [
            'image/', 'video/', 'audio/', 'text/', 'application/',
            'font/', 'model/'
        ];

        if (file.size > maxSize) {
            throw new Error(`File size must be less than ${this.formatFileSize(maxSize)}`);
        }

        const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
        if (!isAllowed) {
            throw new Error('File type not supported');
        }

        return true;
    }
}

export default new ResourcesService();
