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
            console.log('🔍 Debug: Starting file upload...');
            
            // Basic authentication check
            if (!auth.currentUser) {
                console.error('❌ No authenticated user found');
                throw new Error('User must be authenticated to upload files');
            }

            if (auth.currentUser.uid !== userId) {
                console.error('❌ User ID mismatch');
                throw new Error('User ID mismatch - cannot upload files for another user');
            }

            console.log('✅ Authentication verified for user:', userId);

            // Force fresh token - this is critical for Firebase Storage authentication
            await auth.currentUser.getIdToken(true);
            console.log('✅ Fresh authentication token obtained');
            
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
            
            console.log('📁 Upload path:', filePath);

            // Create storage reference
            const storageRef = ref(storage, filePath);
            
            console.log('🚀 Attempting upload to Firebase Storage...');
            
            // Use uploadBytesResumable for better progress tracking
            const uploadTask = uploadBytesResumable(storageRef, file);
            
            // Create upload promise with progress tracking
            const uploadPromise = new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`Upload is ${progress}% done`);
                        if (onProgress) {
                            onProgress(progress);
                        }
                    },
                    (error) => {
                        console.error('❌ Upload failed:', error);
                        reject(error);
                    },
                    () => {
                        console.log('✅ Upload completed successfully');
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
            const queries = [];
            
            // User's own files
            queries.push(
                query(
                    collection(db, this.collectionName),
                    where('userId', '==', userId),
                    orderBy('uploadedAt', 'desc')
                )
            );
            
            // Files shared directly with user
            queries.push(
                query(
                    collection(db, this.collectionName),
                    where('sharedWith', 'array-contains', userId),
                    orderBy('uploadedAt', 'desc')
                )
            );

            const queryPromises = queries.map(q => getDocs(q));
            const querySnapshots = await Promise.all(queryPromises);
            
            const allFiles = new Map();
            
            querySnapshots.forEach(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    allFiles.set(doc.id, {
                        id: doc.id,
                        ...data,
                        uploadedAt: data.uploadedAt?.toDate() || new Date()
                    });
                });
            });
            
            return Array.from(allFiles.values()).sort((a, b) => b.uploadedAt - a.uploadedAt);
        } catch (error) {
            console.error('Error fetching user files with shared:', error);
            return [];
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
}

export default new ResourcesService();
