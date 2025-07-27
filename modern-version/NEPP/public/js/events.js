import EventsService from '/services/events-service.js';
import GroupsService from '/services/groups-service.js';
import { CalendarWidget } from '/components/calendar-widget.js';
import authManager from '/utils/auth-manager.js';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { db } from '/config/firebase-config.js';

class EventsManager {
    constructor() {
        this.currentUser = null;
        this.userGroups = [];
        this.events = [];
        this.formDueDates = [];
        this.announcements = [];
        this.filteredEvents = [];
        this.currentView = 'list';
        this.calendar = null;
        
        this.initializeElements();
        this.bindEvents();
        this.setupAuthListener();
    }

    initializeElements() {
        // Header elements
        this.createEventBtn = document.getElementById('createEventBtn');
        
        // Control elements
        this.viewButtons = document.querySelectorAll('.view-btn');
        this.groupFilter = document.getElementById('groupFilter');
        this.timeFilter = document.getElementById('timeFilter');
        this.searchInput = document.getElementById('eventsSearch');
        
        // View elements
        this.eventsListView = document.getElementById('eventsListView');
        this.eventsCalendarView = document.getElementById('eventsCalendarView');
        this.eventsList = document.getElementById('eventsList');
        this.eventsCalendar = document.getElementById('eventsCalendar');
        
        // Sidebar elements
        this.miniCalendar = document.getElementById('miniCalendar');
        this.upcomingEventsList = document.getElementById('upcomingEventsList');
        
        // Modal elements
        this.createEventModal = document.getElementById('createEventModal');
        this.createEventForm = document.getElementById('createEventForm');
        this.cancelCreateEventBtn = document.getElementById('cancelCreateEvent');
        
        this.eventDetailsModal = document.getElementById('eventDetailsModal');
        this.eventDetailsContainer = document.getElementById('eventDetailsContainer');
        this.closeEventDetailsBtn = document.getElementById('closeEventDetails');
    }

    bindEvents() {
        // Create event button
        this.createEventBtn.addEventListener('click', () => {
            this.showCreateEventModal();
        });

        // View switching
        this.viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.switchView(button.dataset.view);
            });
        });

        // Filter and search
        this.groupFilter.addEventListener('change', () => {
            this.filterEvents();
        });

        this.timeFilter.addEventListener('change', () => {
            this.filterEvents();
        });

        this.searchInput.addEventListener('input', () => {
            this.filterEvents();
        });

        // Create event form
        this.createEventForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateEvent();
        });

        this.cancelCreateEventBtn.addEventListener('click', () => {
            this.hideCreateEventModal();
        });

        // Event details modal
        this.closeEventDetailsBtn.addEventListener('click', () => {
            this.hideEventDetailsModal();
        });

        // Close modals when clicking outside
        this.createEventModal.addEventListener('click', (e) => {
            if (e.target === this.createEventModal) {
                this.hideCreateEventModal();
            }
        });

        this.eventDetailsModal.addEventListener('click', (e) => {
            if (e.target === this.eventDetailsModal) {
                this.hideEventDetailsModal();
            }
        });
    }

    setupAuthListener() {
        // Subscribe to global auth state changes
        authManager.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                
                // Load all data and initialize calendar
                await this.loadAllData();
                this.initializeCalendar();
            } else {
                this.showAuthAlert();
            }
        });
    }

    showAuthAlert() {
        alert('Please log in to access events.');
        window.location.href = 'login.html';
    }

    async loadAllData() {
        try {
            // Load user groups first
            await this.loadUserGroups();
            
            // Load all event data in parallel
            await Promise.all([
                this.loadEvents(),
                this.loadFormDueDates(),
                this.loadScheduledAnnouncements()
            ]);
            
            // Combine and filter all events
            this.combineAllEvents();
            this.filterEvents();
            this.renderEvents();
            this.renderUpcomingEvents();
            
        } catch (error) {
            console.error('Error loading events data:', error);
            this.showError('Failed to load events data');
        }
    }

    async loadFormDueDates() {
        try {
            // Get forms with due dates that the user has access to
            // First, get forms created by the user
            const userFormsQuery = query(
                collection(db, 'forms'),
                where('createdBy', '==', this.currentUser.uid),
                where('dueDate', '!=', null),
                orderBy('dueDate', 'asc')
            );
            
            const userFormsSnapshot = await getDocs(userFormsQuery);
            let allForms = [...userFormsSnapshot.docs];
            
            // Then, get forms from groups the user is a member of
            if (this.userGroups && this.userGroups.length > 0) {
                for (const group of this.userGroups) {
                    const groupFormsQuery = query(
                        collection(db, 'forms'),
                        where('groupId', '==', group.id),
                        where('dueDate', '!=', null),
                        orderBy('dueDate', 'asc')
                    );
                    
                    const groupFormsSnapshot = await getDocs(groupFormsQuery);
                    // Avoid duplicates
                    const newForms = groupFormsSnapshot.docs.filter(doc => 
                        !allForms.some(existingDoc => existingDoc.id === doc.id)
                    );
                    allForms = [...allForms, ...newForms];
                }
            }
            
            this.formDueDates = allForms.map(doc => {
                const data = doc.data();
                return {
                    id: `form-${doc.id}`,
                    type: 'form-due',
                    title: `Form Due: ${data.title}`,
                    description: `Form "${data.title}" is due`,
                    date: data.dueDate.toDate(),
                    time: data.dueTime || '23:59',
                    location: 'Online Form',
                    formId: doc.id,
                    visibility: data.type || 'public',
                    createdBy: data.createdBy,
                    category: 'deadline'
                };
            });
        } catch (error) {
            console.error('Error loading form due dates:', error);
            this.formDueDates = [];
        }
    }

    async loadScheduledAnnouncements() {
        try {
            // Get announcements with scheduled dates that the user has access to
            // First, get announcements created by the user
            const userAnnouncementsQuery = query(
                collection(db, 'announcements'),
                where('createdBy', '==', this.currentUser.uid),
                where('scheduledDate', '!=', null),
                orderBy('scheduledDate', 'asc')
            );
            
            const userAnnouncementsSnapshot = await getDocs(userAnnouncementsQuery);
            let allAnnouncements = [...userAnnouncementsSnapshot.docs];
            
            // Then, get announcements from groups the user is a member of
            if (this.userGroups && this.userGroups.length > 0) {
                for (const group of this.userGroups) {
                    const groupAnnouncementsQuery = query(
                        collection(db, 'announcements'),
                        where('groupId', '==', group.id),
                        where('scheduledDate', '!=', null),
                        orderBy('scheduledDate', 'asc')
                    );
                    
                    const groupAnnouncementsSnapshot = await getDocs(groupAnnouncementsQuery);
                    // Avoid duplicates
                    const newAnnouncements = groupAnnouncementsSnapshot.docs.filter(doc => 
                        !allAnnouncements.some(existingDoc => existingDoc.id === doc.id)
                    );
                    allAnnouncements = [...allAnnouncements, ...newAnnouncements];
                }
            }
            
            this.announcements = allAnnouncements.map(doc => {
                const data = doc.data();
                return {
                    id: `announcement-${doc.id}`,
                    type: 'announcement',
                    title: data.title,
                    description: data.content,
                    date: data.scheduledDate.toDate(),
                    time: data.scheduledTime || '09:00',
                    location: 'Announcement',
                    announcementId: doc.id,
                    visibility: 'public',
                    createdBy: data.createdBy,
                    category: 'announcement'
                };
            });
        } catch (error) {
            console.error('Error loading scheduled announcements:', error);
            this.announcements = [];
        }
    }

    combineAllEvents() {
        // Combine events, form due dates, and announcements
        this.events = [
            ...this.events,
            ...this.formDueDates,
            ...this.announcements
        ];
        
        // Sort by date
        this.events.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    initializeCalendar() {
        // Initialize the main calendar widget
        this.calendar = new CalendarWidget('eventsCalendar');
        
        // Pass events data to calendar
        this.calendar.setEvents(this.events);
        
        // Add event listener for date selection
        document.getElementById('eventsCalendar').addEventListener('dateSelected', (e) => {
            this.handleDateSelection(e.detail.dateString, e.detail.date);
        });
        
        // Initialize mini calendar
        this.miniCalendar = new CalendarWidget('miniCalendar');
        this.miniCalendar.setEvents(this.events);
        this.miniCalendar.setMiniMode(true);
        
        // Add event listener for mini calendar date selection
        document.getElementById('miniCalendar').addEventListener('dateSelected', (e) => {
            this.handleDateSelection(e.detail.dateString, e.detail.date);
        });
    }

    handleDateSelection(dateString, selectedDate) {
        // Ensure events array exists
        if (!this.events) {
            this.events = [];
        }
        
        // Get events for the selected date
        const eventsForDate = this.events.filter(event => {
            const eventDateString = this.formatDateString(new Date(event.date));
            return eventDateString === dateString;
        });

        // Update the events sidebar to show events for this date
        this.displayDayEvents(eventsForDate, selectedDate);
    }

    formatDateString(date) {
        return date.toISOString().split('T')[0];
    }

    displayDayEvents(events, selectedDate) {
        // Find or create a day events display area
        let dayEventsContainer = document.querySelector('.day-events-container');
        
        if (!dayEventsContainer) {
            // Create the container and add it to the sidebar
            dayEventsContainer = document.createElement('div');
            dayEventsContainer.className = 'day-events-container';
            this.eventsSidebar.appendChild(dayEventsContainer);
        }

        const dateStr = selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        if (events.length === 0) {
            dayEventsContainer.innerHTML = `
                <div class="day-events">
                    <h3>Events for ${dateStr}</h3>
                    <p class="no-events">No events scheduled for this date.</p>
                </div>
            `;
        } else {
            dayEventsContainer.innerHTML = `
                <div class="day-events">
                    <h3>Events for ${dateStr}</h3>
                    <div class="day-events-list">
                        ${events.map(event => `
                            <div class="day-event-item" onclick="eventsManager.showEventDetails('${event.id}')">
                                <div class="day-event-time">${this.formatTime(event.time)}</div>
                                <div class="day-event-info">
                                    <div class="day-event-title">${event.title}</div>
                                    <div class="day-event-type">${this.getEventTypeLabel(event.type)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    getEventTypeLabel(type) {
        switch(type) {
            case 'form-due': return 'Form Due';
            case 'announcement': return 'Announcement';
            default: return 'Event';
        }
    }

    formatTime(time) {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    }

    async loadUserGroups() {
        try {
            this.userGroups = await GroupsService.getUserGroups(this.currentUser.uid);
            
            // Populate group filter
            this.populateGroupFilter();
        } catch (error) {
            console.error('Error loading user groups:', error);
            this.userGroups = [];
        }
    }

    async loadEvents() {
        try {
            // Load events created by user or for their groups
            const userGroupIds = this.userGroups.map(group => group.id);
            this.events = await EventsService.getUserEvents(this.currentUser.uid, userGroupIds);
        } catch (error) {
            console.error('Error loading events:', error);
            this.events = [];
        }
    }

    renderEvents() {
        if (this.currentView === 'list') {
            this.renderListView();
        } else {
            this.renderCalendarView();
        }
    }

    showError(message) {
        // Simple error notification
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
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    populateGroupFilter() {
        // Clear existing options except "All Groups"
        this.groupFilter.innerHTML = '<option value="">All Groups</option>';
        
        // Add user groups
        this.userGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            this.groupFilter.appendChild(option);
        });
    }

    switchView(view) {
        this.currentView = view;
        
        // Update view buttons
        this.viewButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.view === view);
        });
        
        // Update view content
        this.eventsListView.classList.toggle('active', view === 'list');
        this.eventsCalendarView.classList.toggle('active', view === 'calendar');
        
        if (view === 'calendar') {
            this.renderCalendarView();
        }
    }

    filterEvents() {
        let filtered = [...this.events];
        
        // Apply group filter
        const groupId = this.groupFilter.value;
        if (groupId) {
            filtered = EventsService.filterEventsByGroup(filtered, groupId);
        }
        
        // Apply time filter
        const timeFilter = this.timeFilter.value;
        filtered = EventsService.filterEventsByTime(filtered, timeFilter);
        
        // Apply search filter
        const searchTerm = this.searchInput.value;
        filtered = EventsService.searchEvents(filtered, searchTerm);
        
        this.filteredEvents = filtered;
        this.renderEvents();
    }

    renderEvents() {
        if (this.filteredEvents.length === 0) {
            this.renderEmptyState();
            return;
        }

        this.eventsList.innerHTML = this.filteredEvents.map(event => {
            const group = this.userGroups.find(g => g.id === event.groupId);
            const isCreator = event.createdBy === this.currentUser.uid;
            
            // Determine event category for display
            let eventCategory = 'event';
            let categoryText = 'Event';
            
            if (event.type === 'form-due') {
                eventCategory = 'deadline';
                categoryText = 'Form Due';
            } else if (event.type === 'announcement') {
                eventCategory = 'announcement';
                categoryText = 'Announcement';
            }
            
            return `
                <div class="event-card" onclick="eventsManager.showEventDetails('${event.id}')">
                    <div class="event-header">
                        <div class="event-category ${eventCategory}">${categoryText}</div>
                        <h3 class="event-title">${event.title}</h3>
                        <div class="event-time">
                            ${EventsService.formatDate(event.date)} at ${EventsService.formatTime(event.time)}
                        </div>
                    </div>
                    ${event.description ? `<p class="event-description">${event.description}</p>` : ''}
                    <div class="event-meta">
                        <div class="event-details">
                            ${event.location ? `
                                <div class="event-location">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                    </svg>
                                    ${event.location}
                                </div>
                            ` : ''}
                        </div>
                        <div class="event-badges">
                            ${group ? `<span class="event-group">${group.name}</span>` : ''}
                            <span class="event-visibility ${event.visibility}">${event.visibility}</span>
                            ${isCreator ? '<span class="event-creator">Created by you</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderEmptyState() {
        this.eventsList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <h3>No events found</h3>
                <p>Create an event or adjust your filters to see events.</p>
            </div>
        `;
    }

    renderUpcomingEvents() {
        const upcomingEvents = EventsService.getUpcomingEvents(this.events, 5);
        
        if (upcomingEvents.length === 0) {
            this.upcomingEventsList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No upcoming events</p>';
            return;
        }

        this.upcomingEventsList.innerHTML = upcomingEvents.map(event => `
            <div class="upcoming-event-item" onclick="eventsManager.showEventDetails('${event.id}')">
                <div class="upcoming-event-date">
                    ${new Date(event.date).getDate()}
                </div>
                <div class="upcoming-event-info">
                    <div class="upcoming-event-title">${event.title}</div>
                    <div class="upcoming-event-time">${EventsService.formatTime(event.time)}</div>
                </div>
            </div>
        `).join('');
    }

    renderMiniCalendar() {
        // Simple mini calendar - you can enhance this
        const now = new Date();
        const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        this.miniCalendar.innerHTML = `
            <h3>${monthName}</h3>
            <div style="text-align: center; color: var(--text-muted); font-size: 0.875rem;">
                Click on calendar view for full calendar
            </div>
        `;
    }

    renderCalendarView() {
        // Create calendar widget container
        this.eventsCalendar.innerHTML = `
            <div class="calendar-container">
                <div id="events-calendar-widget"></div>
                <div class="calendar-legend">
                    <h4>Legend</h4>
                    <div class="legend-item">
                        <span class="legend-color event-type-event"></span>
                        <span>Events</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color event-type-form-due"></span>
                        <span>Form Due Dates</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color event-type-announcement"></span>
                        <span>Scheduled Announcements</span>
                    </div>
                </div>
            </div>
        `;

        // Initialize calendar widget
        const calendarContainer = document.getElementById('events-calendar-widget');
        if (calendarContainer && window.CalendarWidget) {
            this.calendarWidget = new CalendarWidget(calendarContainer);
            
            // Set events on the calendar
            if (this.allEvents && this.allEvents.length > 0) {
                this.calendarWidget.setEvents(this.allEvents);
            }
        }
    }

    showCreateEventModal() {
        this.createEventForm.reset();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('eventDate').value = today;
        
        // Populate group dropdown
        this.populateEventGroupSelect();
        
        this.createEventModal.style.display = 'flex';
    }

    hideCreateEventModal() {
        this.createEventModal.style.display = 'none';
    }

    populateEventGroupSelect() {
        const eventGroupSelect = document.getElementById('eventGroup');
        eventGroupSelect.innerHTML = '<option value="">Personal Event</option>';
        
        this.userGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            eventGroupSelect.appendChild(option);
        });
    }

    async handleCreateEvent() {
        try {
            const formData = new FormData(this.createEventForm);
            const eventData = {
                title: formData.get('eventTitle').trim(),
                description: formData.get('eventDescription').trim(),
                date: formData.get('eventDate'),
                time: formData.get('eventTime'),
                location: formData.get('eventLocation').trim(),
                groupId: formData.get('eventGroup') || null,
                visibility: formData.get('eventVisibility'),
                type: formData.get('eventType') || 'event'
            };

            // Validate event data
            EventsService.validateEventData(eventData);

            // Create the event
            await EventsService.createEvent(eventData, this.currentUser.uid);

            this.hideCreateEventModal();
            this.showSuccess('Event created successfully');
            
            // Reload events
            await this.loadAllData();
        } catch (error) {
            console.error('Error creating event:', error);
            this.showError(error.message);
        }
    }

    async showEventDetails(eventId) {
        try {
            let event;
            
            // Handle different event types
            if (eventId.startsWith('form-')) {
                // This is a form due date, get details from forms collection
                const formId = eventId.replace('form-', '');
                const formRef = doc(db, 'forms', formId);
                const formDoc = await getDoc(formRef);
                
                if (!formDoc.exists()) {
                    throw new Error('Form not found');
                }
                
                const formData = formDoc.data();
                event = {
                    id: eventId,
                    title: `Form Due: ${formData.title}`,
                    description: formData.description || `Form "${formData.title}" is due`,
                    date: formData.dueDate.toDate(),
                    time: formData.dueTime || '23:59',
                    location: 'Online Form',
                    type: 'form-due',
                    formId: formId,
                    createdBy: formData.createdBy,
                    visibility: formData.type || 'public'
                };
            } else if (eventId.startsWith('announcement-')) {
                // This is a scheduled announcement, get details from announcements collection
                const announcementId = eventId.replace('announcement-', '');
                const announcementRef = doc(db, 'announcements', announcementId);
                const announcementDoc = await getDoc(announcementRef);
                
                if (!announcementDoc.exists()) {
                    throw new Error('Announcement not found');
                }
                
                const announcementData = announcementDoc.data();
                event = {
                    id: eventId,
                    title: announcementData.title,
                    description: announcementData.content,
                    date: announcementData.scheduledDate.toDate(),
                    time: announcementData.scheduledTime || '09:00',
                    location: 'Announcement',
                    type: 'announcement',
                    announcementId: announcementId,
                    createdBy: announcementData.createdBy,
                    visibility: 'public'
                };
            } else {
                // This is a regular event
                event = await EventsService.getEventDetails(eventId);
            }
            
            const group = this.userGroups.find(g => g.id === event.groupId);
            const isCreator = event.createdBy === this.currentUser.uid;
            
            this.eventDetailsContainer.innerHTML = `
                <div class="event-details-header">
                    <h2>${event.title}</h2>
                    <div class="event-details-meta">
                        <span class="event-visibility ${event.visibility}">${event.visibility}</span>
                        ${group ? `<span class="event-group">${group.name}</span>` : ''}
                        ${isCreator ? '<span class="event-creator">Created by you</span>' : ''}
                    </div>
                </div>
                
                <div class="event-details-info">
                    <div class="event-detail-item">
                        <strong>Date:</strong> ${EventsService.formatDate(event.date)}
                    </div>
                    <div class="event-detail-item">
                        <strong>Time:</strong> ${EventsService.formatTime(event.time)}
                    </div>
                    ${event.location ? `
                        <div class="event-detail-item">
                            <strong>Location:</strong> ${event.location}
                        </div>
                    ` : ''}
                    ${event.description ? `
                        <div class="event-detail-item">
                            <strong>Description:</strong>
                            <p style="margin-top: 0.5rem;">${event.description}</p>
                        </div>
                    ` : ''}
                </div>
                
                ${isCreator ? `
                    <div class="event-actions" style="margin-top: 2rem; display: flex; gap: 1rem;">
                        <button class="submit-btn" onclick="eventsManager.editEvent('${event.id}')">Edit Event</button>
                        <button class="cancel-btn" onclick="eventsManager.deleteEvent('${event.id}')">Delete Event</button>
                    </div>
                ` : ''}
            `;
            
            this.eventDetailsModal.style.display = 'flex';
        } catch (error) {
            console.error('Error loading event details:', error);
            this.showError('Failed to load event details');
        }
    }

    hideEventDetailsModal() {
        this.eventDetailsModal.style.display = 'none';
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

    editEvent(eventId) {
        // Navigate to edit events page with event ID as parameter
        window.location.href = `edit-events.html?eventId=${encodeURIComponent(eventId)}`;
    }

    async deleteEvent(eventId) {
        if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
            return;
        }

        try {
            const user = await this.authManager.getCurrentUser();
            if (!user) {
                throw new Error('You must be logged in to delete events');
            }

            await this.eventsService.deleteEvent(eventId, user.uid);
            this.showSuccess('Event deleted successfully');
            this.hideEventDetailsModal();
            // Refresh the events list
            await this.loadAllEvents();
        } catch (error) {
            console.error('Error deleting event:', error);
            this.showError('Failed to delete event');
        }
    }
}

// Initialize the events manager
const eventsManager = new EventsManager();

// Make it globally available for inline event handlers
window.eventsManager = eventsManager;
