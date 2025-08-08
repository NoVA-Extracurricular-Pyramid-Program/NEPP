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
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { 
    ref, 
    uploadBytesResumable, 
    getDownloadURL, 
    deleteObject,
    getMetadata 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";
import { db, storage, auth } from '/config/firebase-config.js';

class ResourcesService {
    constructor() {
        this.collectionName = 'resources';
    }

    // Upload file to Firebase Storage and save metadata to Firestore
    async uploadFile(file, userId, onProgress = null) {
        try {
            // Basic authentication check
            if (!auth.currentUser) {
                throw new Error('User must be authenticated to upload files');
            }

            if (auth.currentUser.uid !== userId) {
                throw new Error('User ID mismatch - cannot upload files for another user');
            }

            // Force fresh token - this is critical for Firebase Storage authentication
            await auth.currentUser.getIdToken(true);
            
            // Important: Wait for Firebase Storage to recognize the auth state
            // This delay is crucial for storage authentication to work properly
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Final auth check
            if (!auth.currentUser) {
                throw new Error('Authentication lost during preparation');
            }

            // Create unique filename
            const timestamp = Date.now();
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileName = `${timestamp}_${sanitizedFileName}`;
            const filePath = `resources/${userId}/${fileName}`;

            // Create storage reference
            const storageRef = ref(storage, filePath);
            
            // Use uploadBytesResumable for better progress tracking
            const uploadTask = uploadBytesResumable(storageRef, file);
            
            // Create upload promise with progress tracking
            const uploadPromise = new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (onProgress) {
                            onProgress(progress);
                        }
                    },
                    (error) => {
                        console.error('Upload failed:', error);
                        reject(error);
                    },
                    () => {
                        resolve(uploadTask.snapshot);
                    }
                );
            });

            const snapshot = await uploadPromise;
            
            // Get download URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            // Save file metadata to Firestore
            const fileData = {
                name: file.name,
                originalName: file.name,
                size: file.size,
                type: file.type,
                downloadURL,
                storagePath: filePath,
                userId,
                uploadedAt: serverTimestamp(),
                lastModified: new Date(file.lastModified)
            };

            const docRef = await addDoc(collection(db, this.collectionName), fileData);
            
            return {
                id: docRef.id,
                ...fileData,
                uploadedAt: new Date()
            };
            
        } catch (error) {
            console.error('Error uploading file:', error);
            
            if (error.code === 'storage/unauthenticated') {
                throw new Error('Authentication failed. Please refresh the page and try again.');
            }
            
            throw error;
        }
    }

    // Get all files for a user
    async getUserFiles(userId) {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId),
                orderBy('uploadedAt', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            const files = [];
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                files.push({
                    id: doc.id,
                    ...data,
                    uploadedAt: data.uploadedAt?.toDate() || new Date()
                });
            });
            
            return files;
        } catch (error) {
            console.error('Error fetching user files:', error);
            throw error;
        }
    }

    // Get files shared with user
    async getUserFilesWithShared(userId, userGroups = []) {
        try {
            console.log('🔍 Fetching files for user:', userId, 'with groups:', userGroups);
            
            // First, get user's own files
            const ownFilesQuery = query(
                collection(db, this.collectionName),
                where('userId', '==', userId),
                orderBy('uploadedAt', 'desc')
            );
            
            console.log('📁 Debug: Executing own files query...');
            const ownFilesSnapshot = await getDocs(ownFilesQuery);
            const files = [];
            
            ownFilesSnapshot.forEach(doc => {
                const data = doc.data();
                files.push({
                    id: doc.id,
                    ...data,
                    uploadedAt: data.uploadedAt?.toDate() || new Date(),
                    isOwned: true
                });
            });
            
            console.log(`📁 Found ${files.length} owned files`);
            
            // Now get shared files using a different approach
            await this.addSharedFilesToList(files, userId, userGroups);
            
            // Sort by upload date (most recent first)
            files.sort((a, b) => b.uploadedAt - a.uploadedAt);
            
            console.log(` Total files returned: ${files.length}`);
            return files;
        } catch (error) {
            console.error(' Error fetching user files:', error);
            // Fallback: try to get at least the user's own files
            try {
                console.log('🔄 Fallback: Getting only owned files...');
                const fallbackQuery = query(
                    collection(db, this.collectionName),
                    where('userId', '==', userId),
                    orderBy('uploadedAt', 'desc')
                );
                
                const fallbackSnapshot = await getDocs(fallbackQuery);
                const fallbackFiles = [];
                
                fallbackSnapshot.forEach(doc => {
                    const data = doc.data();
                    fallbackFiles.push({
                        id: doc.id,
                        ...data,
                        uploadedAt: data.uploadedAt?.toDate() || new Date(),
                        isOwned: true
                    });
                });
                
                console.log(` Fallback: Found ${fallbackFiles.length} owned files`);
                return fallbackFiles;
            } catch (fallbackError) {
                console.error(' Fallback also failed:', fallbackError);
                return [];
            }
        }
    }

    // Helper method to add shared files to the list
    async addSharedFilesToList(files, userId, userGroups = []) {
        try {
            console.log(' Loading shared files - NEW VERSION...');
            let sharedCount = 0;
            
            // Get ALL shared files and filter client-side (same pattern as forms service)
            try {
                console.log(' Debug: Querying all shared files...');
                const sharedQuery = query(
                    collection(db, this.collectionName),
                    where('isShared', '==', true)
                );
                
                const sharedSnapshot = await getDocs(sharedQuery);
                console.log(` Found ${sharedSnapshot.size} total shared files`);
                
                sharedSnapshot.forEach(doc => {
                    const data = doc.data();
                    const fileId = doc.id;
                    
                    // Skip if already in the list (user's own file)
                    if (files.find(f => f.id === fileId)) {
                        return;
                    }
                    
                    // Client-side filtering based on sharing logic
                    let shouldInclude = false;
                    let shareInfo = { isOwned: false };
                    
                    // Check if file is public
                    if (data.shareType === 'public') {
                        shouldInclude = true;
                        shareInfo = { ...shareInfo, isPublic: true, shareType: 'public' };
                    }
                    
                    // Check if file is shared specifically with this user
                    if (data.shareType === 'specific' && 
                        data.sharedWith && 
                        Array.isArray(data.sharedWith) && 
                        data.sharedWith.includes(userId)) {
                        shouldInclude = true;
                        shareInfo = { ...shareInfo, isSharedWithMe: true, shareType: 'specific' };
                    }
                    
                    // Check if file is shared with user's groups
                    if (data.shareType === 'group' && 
                        data.groupId && 
                        userGroups.includes(data.groupId)) {
                        shouldInclude = true;
                        shareInfo = { 
                            ...shareInfo, 
                            isSharedWithGroup: true, 
                            shareType: 'group',
                            sharedGroupId: data.groupId 
                        };
                    }
                    
                    if (shouldInclude) {
                        files.push({
                            id: fileId,
                            ...data,
                            uploadedAt: data.uploadedAt?.toDate() || new Date(),
                            ...shareInfo
                        });
                        sharedCount++;
                        console.log(`✅ Added shared file: ${data.name} (${data.shareType})`);
                    }
                });
                
                console.log(`📁 Total shared files added: ${sharedCount}`);
                
            } catch (sharedError) {
                console.warn('⚠️ Could not fetch shared files:', sharedError.message);
            }
            
        } catch (error) {
            console.warn('⚠️ Error fetching shared files (continuing with owned files only):', error);
        }
    }

    // Delete file
    async deleteFile(fileId, storagePath) {
        try {
            await deleteDoc(doc(db, this.collectionName, fileId));
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    }

    // Share file with users or groups
    async shareFile(fileId, shareData, userId) {
        try {
            // Get the file document
            const fileDoc = await getDoc(doc(db, this.collectionName, fileId));
            
            if (!fileDoc.exists()) {
                throw new Error('File not found');
            }

            const fileData = fileDoc.data();
            
            // Verify the user owns this file
            if (fileData.userId !== userId) {
                throw new Error('You can only share files you own');
            }

            // Prepare update data based on share type
            const updateData = {
                lastModified: serverTimestamp(),
                lastShared: serverTimestamp()
            };

            if (shareData.type === 'public') {
                updateData.isShared = true;
                updateData.shareType = 'public';
                if (shareData.description) {
                    updateData.shareDescription = shareData.description;
                }
            } else if (shareData.type === 'group') {
                updateData.groupId = shareData.groupId;
                updateData.shareType = 'group';
                updateData.isShared = true;
                if (shareData.description) {
                    updateData.shareDescription = shareData.description;
                }
            } else if (shareData.type === 'specific') {
                updateData.sharedWith = shareData.userIds;
                updateData.shareType = 'specific';
                updateData.isShared = true;
                if (shareData.description) {
                    updateData.shareDescription = shareData.description;
                }
            }

            // Update the file document
            await updateDoc(doc(db, this.collectionName, fileId), updateData);
            
            return true;
        } catch (error) {
            console.error('Error sharing file:', error);
            throw error;
        }
    }

    // Search files
    searchFiles(files, searchTerm) {
        if (!searchTerm.trim()) return files;
        
        const term = searchTerm.toLowerCase();
        return files.filter(file => 
            file.name.toLowerCase().includes(term) ||
            file.type.toLowerCase().includes(term)
        );
    }

    // Get file type category
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

    // Get file extension
    getFileExtension(fileName) {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
    }

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Format date
    formatDate(date) {
        if (!date) return 'Unknown';
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        
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

    // Validate file
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

    // Debug function to check shared files in database
    async debugSharedFiles() {
        try {
            console.log('🔍 Debug: Checking all resources with isShared=true...');
            const sharedQuery = query(
                collection(db, this.collectionName),
                where('isShared', '==', true)
            );
            
            const snapshot = await getDocs(sharedQuery);
            console.log(`📁 Found ${snapshot.size} shared files total`);
            
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`📄 File: ${data.name}, ShareType: ${data.shareType}, Owner: ${data.userId}`);
                if (data.shareType === 'specific') {
                    console.log(`   SharedWith: ${JSON.stringify(data.sharedWith)}`);
                } else if (data.shareType === 'group') {
                    console.log(`   GroupId: ${data.groupId}`);
                }
            });
        } catch (error) {
            console.error('❌ Debug query failed:', error);
        }
    }
}

export default new ResourcesService();
