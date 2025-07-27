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
    and,
    getDoc 
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { db } from '/config/firebase-config.js';

class EventsService {
    constructor() {
        this.collectionName = 'events';
    }

    // Create a new event
    async createEvent(eventData, userId) {
        try {
            const event = {
                title: eventData.title,
                description: eventData.description || '',
                date: eventData.date,
                time: eventData.time,
                location: eventData.location || '',
                groupId: eventData.groupId || null,
                visibility: eventData.visibility, // 'public', 'group', 'private'
                createdBy: userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, this.collectionName), event);
            
            return {
                id: docRef.id,
                ...event,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    }

    // Get events that user can see (based on visibility and group membership)
    async getUserEvents(userId, userGroups = []) {
        try {
            // Get public events, user's private events, and group events for groups user is in
            const queries = [];
            
            // Public events
            queries.push(
                query(
                    collection(db, this.collectionName),
                    where('visibility', '==', 'public'),
                    orderBy('date', 'asc')
                )
            );
            
            // User's private events
            queries.push(
                query(
                    collection(db, this.collectionName),
                    and(
                        where('createdBy', '==', userId),
                        where('visibility', '==', 'private')
                    ),
                    orderBy('date', 'asc')
                )
            );
            
            // Group events for groups user is in
            if (userGroups.length > 0) {
                queries.push(
                    query(
                        collection(db, this.collectionName),
                        and(
                            where('visibility', '==', 'group'),
                            where('groupId', 'in', userGroups.slice(0, 10)) // Firestore limit
                        ),
                        orderBy('date', 'asc')
                    )
                );
            }

            // Execute all queries
            const queryPromises = queries.map(q => getDocs(q));
            const querySnapshots = await Promise.all(queryPromises);
            
            // Combine results and remove duplicates
            const eventsMap = new Map();
            
            querySnapshots.forEach(querySnapshot => {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    eventsMap.set(doc.id, {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        updatedAt: data.updatedAt?.toDate() || new Date()
                    });
                });
            });
            
            // Convert to array and sort by date
            const events = Array.from(eventsMap.values());
            return events.sort((a, b) => new Date(a.date) - new Date(b.date));
        } catch (error) {
            console.error('Error fetching user events:', error);
            throw error;
        }
    }

    // Get event details
    async getEventDetails(eventId) {
        try {
            const eventRef = doc(db, this.collectionName, eventId);
            const eventDoc = await getDoc(eventRef);
            
            if (!eventDoc.exists()) {
                throw new Error('Event not found');
            }

            const data = eventDoc.data();
            return {
                id: eventDoc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        } catch (error) {
            console.error('Error fetching event details:', error);
            throw error;
        }
    }

    // Update event (creator only)
    async updateEvent(eventId, updates, userId) {
        try {
            const eventRef = doc(db, this.collectionName, eventId);
            const eventDoc = await getDoc(eventRef);
            
            if (!eventDoc.exists()) {
                throw new Error('Event not found');
            }

            const eventData = eventDoc.data();
            
            // Check if user is the creator
            if (eventData.createdBy !== userId) {
                throw new Error('Only the event creator can update this event');
            }

            const updateData = {
                ...updates,
                updatedAt: serverTimestamp()
            };

            await updateDoc(eventRef, updateData);
            return true;
        } catch (error) {
            console.error('Error updating event:', error);
            throw error;
        }
    }

    // Delete event (creator only)
    async deleteEvent(eventId, userId) {
        try {
            const eventRef = doc(db, this.collectionName, eventId);
            const eventDoc = await getDoc(eventRef);
            
            if (!eventDoc.exists()) {
                throw new Error('Event not found');
            }

            const eventData = eventDoc.data();
            
            // Check if user is the creator
            if (eventData.createdBy !== userId) {
                throw new Error('Only the event creator can delete this event');
            }

            await deleteDoc(eventRef);
            return true;
        } catch (error) {
            console.error('Error deleting event:', error);
            throw error;
        }
    }

    // Filter events by time range
    filterEventsByTime(events, timeFilter) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (timeFilter) {
            case 'upcoming':
                return events.filter(event => new Date(event.date) >= today);
            case 'past':
                return events.filter(event => new Date(event.date) < today);
            case 'today':
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return events.filter(event => {
                    const eventDate = new Date(event.date);
                    return eventDate >= today && eventDate < tomorrow;
                });
            case 'this-week':
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 7);
                return events.filter(event => {
                    const eventDate = new Date(event.date);
                    return eventDate >= startOfWeek && eventDate < endOfWeek;
                });
            case 'this-month':
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                return events.filter(event => {
                    const eventDate = new Date(event.date);
                    return eventDate >= startOfMonth && eventDate < endOfMonth;
                });
            default:
                return events;
        }
    }

    // Filter events by group
    filterEventsByGroup(events, groupId) {
        if (!groupId) return events;
        return events.filter(event => event.groupId === groupId);
    }

    // Search events by title or description
    searchEvents(events, searchTerm) {
        if (!searchTerm.trim()) return events;
        
        const term = searchTerm.toLowerCase();
        return events.filter(event => 
            event.title.toLowerCase().includes(term) ||
            (event.description && event.description.toLowerCase().includes(term)) ||
            (event.location && event.location.toLowerCase().includes(term))
        );
    }

    // Get upcoming events (next 5)
    getUpcomingEvents(events, limit = 5) {
        const now = new Date();
        return events
            .filter(event => new Date(event.date) >= now)
            .slice(0, limit);
    }

    // Format date for display
    formatDate(date) {
        if (!date) return 'Unknown';
        
        const eventDate = new Date(date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (eventDate.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (eventDate.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else {
            return eventDate.toLocaleDateString();
        }
    }

    // Format time for display
    formatTime(time) {
        if (!time) return '';
        
        const [hours, minutes] = time.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    // Get events for a specific date (for calendar)
    getEventsForDate(events, date) {
        const targetDate = new Date(date);
        const dateString = targetDate.toISOString().split('T')[0];
        
        return events.filter(event => event.date === dateString);
    }

    // Validate event data
    validateEventData(eventData) {
        if (!eventData.title || eventData.title.trim().length < 2) {
            throw new Error('Event title must be at least 2 characters long');
        }

        if (eventData.title.length > 100) {
            throw new Error('Event title must be less than 100 characters');
        }

        if (eventData.description && eventData.description.length > 1000) {
            throw new Error('Event description must be less than 1000 characters');
        }

        if (!eventData.date) {
            throw new Error('Event date is required');
        }

        if (!eventData.time) {
            throw new Error('Event time is required');
        }

        const eventDateTime = new Date(`${eventData.date}T${eventData.time}`);
        if (eventDateTime < new Date()) {
            throw new Error('Event cannot be scheduled in the past');
        }

        if (!['public', 'group', 'private'].includes(eventData.visibility)) {
            throw new Error('Invalid event visibility');
        }

        if (eventData.visibility === 'group' && !eventData.groupId) {
            throw new Error('Group must be selected for group events');
        }

        return true;
    }
}

export default new EventsService();
