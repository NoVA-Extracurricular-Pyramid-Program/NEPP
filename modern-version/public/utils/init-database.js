import { db } from '/config/firebase-config.js';
import { 
    collection, 
    addDoc, 
    doc, 
    setDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

/**
 * Database initialization utility
 * Run this once to set up your Firestore database with the required collections
 */
class DatabaseInitializer {
    constructor() {
        this.collections = [
            'users',
            'groups', 
            'folders',
            'resources',
            'forms',
            'form_responses',
            'announcements',
            'events',
            'feedback'
        ];
    }

    /**
     * Initialize all required collections with sample data
     */
    async initializeDatabase() {
        console.log('Starting database initialization...');
        
        try {
            // Initialize collections by adding sample documents
            await this.initializeCollections();
            console.log('✅ Database initialization completed successfully!');
            return true;
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create collections by adding initial documents
     * (Firestore creates collections automatically when first document is added)
     */
    async initializeCollections() {
        const promises = [];

        // Create a sample document for each collection to ensure they exist
        this.collections.forEach(collectionName => {
            promises.push(this.createSampleDocument(collectionName));
        });

        await Promise.all(promises);
        console.log('All collections initialized');
    }

    /**
     * Create a sample document for a collection
     */
    async createSampleDocument(collectionName) {
        try {
            const sampleData = this.getSampleData(collectionName);
            const docRef = await addDoc(collection(db, collectionName), sampleData);
            console.log(`✓ Created sample document in ${collectionName}:`, docRef.id);
            return docRef.id;
        } catch (error) {
            console.error(`Failed to create sample document in ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Get sample data for each collection type
     */
    getSampleData(collectionName) {
        const baseData = {
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            _sample: true // Mark as sample data
        };

        switch (collectionName) {
            case 'users':
                return {
                    ...baseData,
                    email: 'sample@example.com',
                    displayName: 'Sample User',
                    isActive: false
                };

            case 'groups':
                return {
                    ...baseData,
                    name: 'Sample Group',
                    description: 'This is a sample group for database initialization',
                    type: 'sample',
                    members: [],
                    admins: [],
                    isActive: false
                };

            case 'folders':
                return {
                    ...baseData,
                    name: 'Sample Folder',
                    type: 'folder',
                    parentFolderId: null,
                    userId: 'sample-user',
                    shareType: 'private',
                    sharedWith: [],
                    isShared: false
                };

            case 'resources':
                return {
                    ...baseData,
                    name: 'Sample Resource',
                    type: 'file',
                    folderId: null,
                    userId: 'sample-user',
                    shareType: 'private',
                    sharedWith: [],
                    isShared: false
                };

            case 'forms':
                return {
                    ...baseData,
                    title: 'Sample Form',
                    description: 'This is a sample form',
                    createdBy: 'sample-user',
                    fields: [],
                    isActive: false
                };

            case 'form_responses':
                return {
                    ...baseData,
                    formId: 'sample-form',
                    respondentId: 'sample-user',
                    responses: {},
                    isComplete: false
                };

            case 'announcements':
                return {
                    ...baseData,
                    title: 'Sample Announcement',
                    content: 'This is a sample announcement',
                    createdBy: 'sample-user',
                    targetAudience: 'sample',
                    isActive: false
                };

            case 'events':
                return {
                    ...baseData,
                    title: 'Sample Event',
                    description: 'This is a sample event',
                    createdBy: 'sample-user',
                    startDate: new Date(),
                    endDate: new Date(),
                    isActive: false
                };

            case 'feedback':
                return {
                    ...baseData,
                    message: 'Sample feedback message',
                    userId: 'sample-user',
                    type: 'general',
                    status: 'new'
                };

            default:
                return {
                    ...baseData,
                    name: `Sample ${collectionName} document`
                };
        }
    }

    /**
     * Check if database is already initialized
     */
    async isDatabaseInitialized() {
        try {
            // Check if at least one collection exists with documents
            const sampleDoc = await addDoc(collection(db, '_test'), { test: true });
            await sampleDoc.delete(); // Clean up test document
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clean up sample data (optional)
     */
    async cleanupSampleData() {
        console.log('Cleaning up sample data...');
        // Implementation for cleaning up sample documents
        // This would query each collection for documents with _sample: true and delete them
    }
}

// Export the initializer
export default new DatabaseInitializer();

// Auto-run initialization if this script is loaded directly
if (typeof window !== 'undefined') {
    window.initializeDatabase = async () => {
        try {
            const initializer = new DatabaseInitializer();
            await initializer.initializeDatabase();
            alert('Database initialized successfully! You can now create folders and files.');
        } catch (error) {
            alert(`Database initialization failed: ${error.message}`);
        }
    };
}