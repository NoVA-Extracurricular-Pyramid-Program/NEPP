import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    getDoc 
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { db } from '/config/firebase-config.js';

class GroupsService {
    constructor() {
        this.collectionName = 'groups';
    }

    // Create a new group
    async createGroup(groupData, userId) {
        try {
            const group = {
                name: groupData.name,
                description: groupData.description || '',
                type: groupData.type, // 'open' or 'invite'
                maxMembers: groupData.maxMembers || null,
                createdBy: userId, // Changed from ownerId to match Firestore rules
                ownerId: userId, // Keep ownerId for backward compatibility
                members: [userId],
                admins: [userId],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, this.collectionName), group);
            
            return {
                id: docRef.id,
                ...group,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Error creating group:', error);
            throw error;
        }
    }

    // Get all groups where user is a member
    async getUserGroups(userId) {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('members', 'array-contains', userId),
                orderBy('updatedAt', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            const groups = [];
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                groups.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date()
                });
            });
            
            return groups;
        } catch (error) {
            console.error('Error fetching user groups:', error);
            throw error;
        }
    }

    // Get all available public groups (not a member of)
    async getAvailableGroups(userId) {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('type', '==', 'open'),
                orderBy('createdAt', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            const groups = [];
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                // Only include groups where user is not a member
                if (!data.members.includes(userId)) {
                    groups.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        updatedAt: data.updatedAt?.toDate() || new Date()
                    });
                }
            });
            
            return groups;
        } catch (error) {
            console.error('Error fetching available groups:', error);
            throw error;
        }
    }

    // Join a group
    async joinGroup(groupId, userId) {
        try {
            const groupRef = doc(db, this.collectionName, groupId);
            const groupDoc = await getDoc(groupRef);
            
            if (!groupDoc.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupDoc.data();
            
            // Check if group is open
            if (groupData.type !== 'open') {
                throw new Error('This group is invite-only');
            }

            // Check if user is already a member
            if (groupData.members.includes(userId)) {
                throw new Error('You are already a member of this group');
            }

            // Check max members limit
            if (groupData.maxMembers && groupData.members.length >= groupData.maxMembers) {
                throw new Error('This group has reached its maximum number of members');
            }

            // Add user to group
            await updateDoc(groupRef, {
                members: arrayUnion(userId),
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error joining group:', error);
            throw error;
        }
    }

    // Leave a group
    async leaveGroup(groupId, userId) {
        try {
            const groupRef = doc(db, this.collectionName, groupId);
            const groupDoc = await getDoc(groupRef);
            
            if (!groupDoc.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupDoc.data();
            
            // Check if user is the owner
            if (groupData.ownerId === userId) {
                throw new Error('Group owner cannot leave the group. Transfer ownership or delete the group instead.');
            }

            // Remove user from group
            await updateDoc(groupRef, {
                members: arrayRemove(userId),
                admins: arrayRemove(userId), // Also remove from admins if they were one
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error leaving group:', error);
            throw error;
        }
    }

    // Delete a group (owner only)
    async deleteGroup(groupId, userId) {
        try {
            const groupRef = doc(db, this.collectionName, groupId);
            const groupDoc = await getDoc(groupRef);
            
            if (!groupDoc.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupDoc.data();
            
            // Check if user is the owner
            if (groupData.ownerId !== userId) {
                throw new Error('Only the group owner can delete the group');
            }

            await deleteDoc(groupRef);
            return true;
        } catch (error) {
            console.error('Error deleting group:', error);
            throw error;
        }
    }

    // Get group details with member information
    async getGroupDetails(groupId) {
        try {
            const groupRef = doc(db, this.collectionName, groupId);
            const groupDoc = await getDoc(groupRef);
            
            if (!groupDoc.exists()) {
                throw new Error('Group not found');
            }

            const data = groupDoc.data();
            return {
                id: groupDoc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        } catch (error) {
            console.error('Error fetching group details:', error);
            throw error;
        }
    }

    // Update group information (owner/admin only)
    async updateGroup(groupId, updates, userId) {
        try {
            const groupRef = doc(db, this.collectionName, groupId);
            const groupDoc = await getDoc(groupRef);
            
            if (!groupDoc.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupDoc.data();
            
            // Check if user is owner or admin
            if (groupData.ownerId !== userId && !groupData.admins.includes(userId)) {
                throw new Error('Only group owners and admins can update group information');
            }

            const updateData = {
                ...updates,
                updatedAt: serverTimestamp()
            };

            await updateDoc(groupRef, updateData);
            return true;
        } catch (error) {
            console.error('Error updating group:', error);
            throw error;
        }
    }

    // Add admin to group (owner only)
    async addAdmin(groupId, userIdToPromote, currentUserId) {
        try {
            const groupRef = doc(db, this.collectionName, groupId);
            const groupDoc = await getDoc(groupRef);
            
            if (!groupDoc.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupDoc.data();
            
            // Check if current user is the owner
            if (groupData.ownerId !== currentUserId) {
                throw new Error('Only the group owner can add admins');
            }

            // Check if user is a member
            if (!groupData.members.includes(userIdToPromote)) {
                throw new Error('User must be a member of the group');
            }

            // Add to admins if not already
            if (!groupData.admins.includes(userIdToPromote)) {
                await updateDoc(groupRef, {
                    admins: arrayUnion(userIdToPromote),
                    updatedAt: serverTimestamp()
                });
            }

            return true;
        } catch (error) {
            console.error('Error adding admin:', error);
            throw error;
        }
    }

    // Remove admin from group (owner only)
    async removeAdmin(groupId, userIdToRemove, currentUserId) {
        try {
            const groupRef = doc(db, this.collectionName, groupId);
            const groupDoc = await getDoc(groupRef);
            
            if (!groupDoc.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupDoc.data();
            
            // Check if current user is the owner
            if (groupData.ownerId !== currentUserId) {
                throw new Error('Only the group owner can remove admins');
            }

            // Cannot remove owner from admins
            if (userIdToRemove === groupData.ownerId) {
                throw new Error('Cannot remove owner from admins');
            }

            await updateDoc(groupRef, {
                admins: arrayRemove(userIdToRemove),
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error removing admin:', error);
            throw error;
        }
    }

    // Remove member from group (admin only)
    async removeMember(groupId, userIdToRemove, currentUserId) {
        try {
            const groupRef = doc(db, this.collectionName, groupId);
            const groupDoc = await getDoc(groupRef);
            
            if (!groupDoc.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupDoc.data();
            
            // Check if current user is owner or admin
            if (groupData.ownerId !== currentUserId && !groupData.admins.includes(currentUserId)) {
                throw new Error('Only group owners and admins can remove members');
            }

            // Cannot remove the owner
            if (userIdToRemove === groupData.ownerId) {
                throw new Error('Cannot remove the group owner');
            }

            await updateDoc(groupRef, {
                members: arrayRemove(userIdToRemove),
                admins: arrayRemove(userIdToRemove), // Also remove from admins if they were one
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    }

    // Search groups by name
    searchGroups(groups, searchTerm) {
        if (!searchTerm.trim()) return groups;
        
        const term = searchTerm.toLowerCase();
        return groups.filter(group => 
            group.name.toLowerCase().includes(term) ||
            (group.description && group.description.toLowerCase().includes(term))
        );
    }

    // Get user role in group
    getUserRole(group, userId) {
        if (group.ownerId === userId) return 'owner';
        if (group.admins.includes(userId)) return 'admin';
        if (group.members.includes(userId)) return 'member';
        return null;
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

    // Get member count display text
    getMemberCountText(memberCount, maxMembers) {
        if (maxMembers) {
            return `${memberCount}/${maxMembers} members`;
        }
        return `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
    }

    // Validate group data
    validateGroupData(groupData) {
        if (!groupData.name || groupData.name.trim().length < 2) {
            throw new Error('Group name must be at least 2 characters long');
        }

        if (groupData.name.length > 50) {
            throw new Error('Group name must be less than 50 characters');
        }

        if (groupData.description && groupData.description.length > 500) {
            throw new Error('Group description must be less than 500 characters');
        }

        if (groupData.maxMembers && (groupData.maxMembers < 1 || groupData.maxMembers > 1000)) {
            throw new Error('Maximum members must be between 1 and 1000');
        }

        if (!['open', 'invite'].includes(groupData.type)) {
            throw new Error('Invalid group type');
        }

        return true;
    }
}

export default new GroupsService();
