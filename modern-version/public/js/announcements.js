import { auth, db } from '/config/firebase-config.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

class AnnouncementsManager {
  constructor() {
    this.currentUser = null;
    this.userGroups = [];
    this.announcements = [];
    this.editingAnnouncement = null;
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    this.initializeElements();
    this.bindEvents();
    this.setupAuthListener();
  }

  initializeElements() {
    this.createBtn = document.querySelector('.create-announcement');
    this.popup = document.querySelector('.announcement-popup');
    this.popupContent = document.querySelector('.popup-content');
    this.messageInput = document.querySelector('.popup-message');
    this.errorDiv = document.querySelector('.popup-error');
    this.submitBtn = document.querySelector('.popup-submit');
    this.cancelBtn = document.querySelector('.popup-cancel');
    this.announcementsList = document.querySelector('.announcements-list');
    
    // Debug logging
    console.log('Announcements elements found:', {
      createBtn: !!this.createBtn,
      popup: !!this.popup,
      messageInput: !!this.messageInput,
      announcementsList: !!this.announcementsList
    });
    
    // Add group selection to popup
    this.addGroupSelectionToPopup();
  }

  addGroupSelectionToPopup() {
    const groupSelectionHTML = `
      <div class="form-group">
        <label for="announcementGroup">Target Group:</label>
        <select id="announcementGroup" class="form-select">
          <option value="">Select a group...</option>
        </select>
      </div>
      <div class="form-group">
        <label for="announcementTitle">Title:</label>
        <input type="text" id="announcementTitle" class="form-input" placeholder="Announcement title..." maxlength="100">
      </div>
      <div class="form-group">
        <label for="scheduledDate">Schedule for later (optional):</label>
        <input type="datetime-local" id="scheduledDate" class="form-input">
      </div>
    `;
    
    // Insert before textarea
    this.messageInput.insertAdjacentHTML('beforebegin', groupSelectionHTML);
    
    this.groupSelect = document.getElementById('announcementGroup');
    this.titleInput = document.getElementById('announcementTitle');
    this.scheduledDateInput = document.getElementById('scheduledDate');
  }

  bindEvents() {
    this.createBtn.addEventListener('click', () => this.showCreatePopup());
    this.cancelBtn.addEventListener('click', () => this.hidePopup());
    this.submitBtn.addEventListener('click', () => this.handleSubmit());
    
    // Close popup when clicking outside
    this.popup.addEventListener('click', (e) => {
      if (e.target === this.popup) this.hidePopup();
    });
    
    // Escape key to close popup
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.popup.style.display !== 'none') {
        this.hidePopup();
      }
    });
  }

  setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        await this.loadUserGroups();
        await this.loadAnnouncements();
      } else {
        // Redirect to login if not authenticated
        window.location.href = '/login.html';
      }
    });
  }

  async loadUserGroups() {
    try {
      const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', this.currentUser.uid)
      );
      
      const groupsSnapshot = await getDocs(groupsQuery);
      this.userGroups = [];
      
      // Populate group select
      this.groupSelect.innerHTML = '<option value="">All groups</option>';
      
      groupsSnapshot.forEach(doc => {
        const group = doc.data();
        this.userGroups.push({ id: doc.id, ...group });
        
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = group.name;
        this.groupSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading user groups:', error);
    }
  }

  async loadAnnouncements() {
    try {
      console.log('Loading announcements for user:', this.currentUser?.uid);
      console.log('User groups:', this.userGroups);
      
      // Start with a simple query to get all announcements the user can see
      const announcementsQuery = query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(announcementsQuery);
      this.announcements = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('Found announcement:', doc.id, data);
        this.announcements.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          scheduledFor: data.scheduledFor?.toDate() || null
        });
      });
      
      console.log('Total announcements loaded:', this.announcements.length);
      this.displayAnnouncements();
    } catch (error) {
      console.error('Error loading announcements:', error);
      this.showError('Failed to load announcements');
    }
  }

  displayAnnouncements() {
    console.log('displayAnnouncements called with:', this.announcements.length, 'announcements');
    console.log('announcementsList element:', this.announcementsList);
    
    if (!this.announcementsList) {
      console.error('announcements-list element not found!');
      return;
    }

    if (this.announcements.length === 0) {
      this.announcementsList.innerHTML = `
        <div class="empty-state">
          <p>No announcements yet.</p>
        </div>
      `;
      return;
    }

    this.announcementsList.innerHTML = this.announcements.map(announcement => {
      const isOwner = announcement.createdBy === this.currentUser?.uid;
      const groupName = this.userGroups.find(g => g.id === announcement.groupId)?.name || 'General';
      const isScheduled = announcement.scheduledFor && announcement.scheduledFor > new Date();
      const userLiked = announcement.likes && announcement.likes.includes(this.currentUser?.uid);
      
      return `
        <div class="announcement-item ${isScheduled ? 'scheduled' : ''}" data-id="${announcement.id}">
          <div class="announcement-header">
            <div class="announcement-info">
              <h3 class="announcement-title">${announcement.title || 'Untitled'}</h3>
              <div class="announcement-meta">
                <span class="announcement-author">By: ${announcement.authorName || 'Anonymous'}</span>
                <span class="announcement-group">Group: ${groupName}</span>
                <span class="announcement-date">${this.formatDate(announcement.createdAt)}</span>
                ${isScheduled ? `<span class="scheduled-badge">Scheduled for ${this.formatDate(announcement.scheduledFor)}</span>` : ''}
              </div>
            </div>
            ${isOwner ? `
              <div class="announcement-actions">
                <button class="action-btn edit-btn" onclick="announcementsManager.editAnnouncement('${announcement.id}')" title="Edit">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                </button>
                <button class="action-btn delete-btn" onclick="announcementsManager.deleteAnnouncement('${announcement.id}')" title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            ` : ''}
          </div>
          <div class="announcement-content">
            <p class="announcement-message">${announcement.message}</p>
            <button class="like-button ${userLiked ? 'liked' : ''}" onclick="announcementsManager.toggleLike('${announcement.id}', this)" title="Like this announcement">
              <span class="like-icon">👍</span>
              <span class="like-count">${announcement.likeCount || 0}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  showCreatePopup() {
    this.editingAnnouncement = null;
    this.resetForm();
    this.popupContent.querySelector('h2').textContent = 'Create Announcement';
    this.submitBtn.textContent = 'Post';
    this.popup.style.display = 'flex';
    this.titleInput.focus();
  }

  showEditPopup(announcement) {
    this.editingAnnouncement = announcement;
    this.titleInput.value = announcement.title || '';
    this.messageInput.value = announcement.message || '';
    this.groupSelect.value = announcement.groupId || '';
    
    if (announcement.scheduledFor) {
      const date = new Date(announcement.scheduledFor);
      this.scheduledDateInput.value = date.toISOString().slice(0, 16);
    }
    
    this.popupContent.querySelector('h2').textContent = 'Edit Announcement';
    this.submitBtn.textContent = 'Update';
    this.popup.style.display = 'flex';
    this.titleInput.focus();
  }

  hidePopup() {
    this.popup.style.display = 'none';
    this.resetForm();
    this.editingAnnouncement = null;
  }

  resetForm() {
    this.titleInput.value = '';
    this.messageInput.value = '';
    this.groupSelect.value = '';
    this.scheduledDateInput.value = '';
    this.errorDiv.textContent = '';
  }

  async handleSubmit() {
    const title = this.titleInput.value.trim();
    const message = this.messageInput.value.trim();
    const groupId = this.groupSelect.value;
    const scheduledDate = this.scheduledDateInput.value;

    // Validation
    if (!title) {
      this.showError('Title is required');
      return;
    }
    
    if (!message) {
      this.showError('Message is required');
      return;
    }

    try {
      const announcementData = {
        title,
        message,
        groupId: groupId || '',
        authorName: this.currentUser.displayName || this.currentUser.email,
        createdBy: this.currentUser.uid,
        updatedAt: serverTimestamp()
      };

      if (scheduledDate) {
        announcementData.scheduledFor = new Date(scheduledDate);
      }

      if (this.editingAnnouncement) {
        // Update existing announcement
        announcementData.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'announcements', this.editingAnnouncement.id), announcementData);
        this.showSuccess('Announcement updated successfully');
      } else {
        // Create new announcement
        announcementData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'announcements'), announcementData);
        this.showSuccess('Announcement created successfully');
      }

      this.hidePopup();
      await this.loadAnnouncements();
    } catch (error) {
      console.error('Error saving announcement:', error);
      this.showError('Failed to save announcement');
    }
  }

  async editAnnouncement(announcementId) {
    const announcement = this.announcements.find(a => a.id === announcementId);
    if (announcement) {
      this.showEditPopup(announcement);
    }
  }

  async deleteAnnouncement(announcementId) {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'announcements', announcementId));
      this.showSuccess('Announcement deleted successfully');
      await this.loadAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      this.showError('Failed to delete announcement');
    }
  }

  async toggleLike(announcementId, button) {
    try {
      if (!this.currentUser) return;

      const announcementRef = doc(db, 'announcements', announcementId);
      const announcementDoc = await getDoc(announcementRef);
      
      if (!announcementDoc.exists()) return;

      const data = announcementDoc.data();
      const likes = data.likes || [];
      const likeCount = data.likeCount || 0;
      const userLiked = likes.includes(this.currentUser.uid);

      let newLikes, newLikeCount;
      if (userLiked) {
        // Remove like
        newLikes = likes.filter(uid => uid !== this.currentUser.uid);
        newLikeCount = Math.max(0, likeCount - 1);
        button.classList.remove('liked');
      } else {
        // Add like
        newLikes = [...likes, this.currentUser.uid];
        newLikeCount = likeCount + 1;
        button.classList.add('liked');
      }

      // Update Firestore
      await updateDoc(announcementRef, {
        likes: newLikes,
        likeCount: newLikeCount
      });

      // Update UI
      const countElement = button.querySelector('.like-count');
      if (countElement) {
        countElement.textContent = newLikeCount;
      }

      // Update the local announcements array
      const announcementIndex = this.announcements.findIndex(a => a.id === announcementId);
      if (announcementIndex !== -1) {
        this.announcements[announcementIndex].likes = newLikes;
        this.announcements[announcementIndex].likeCount = newLikeCount;
      }

    } catch (error) {
      console.error('Error toggling like:', error);
      this.showError('Failed to update like');
    }
  }

  formatDate(date) {
    if (!date) return 'Unknown date';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  showError(message) {
    this.errorDiv.textContent = message;
    this.errorDiv.style.color = '#ff3860';
  }

  showSuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 1000;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize the announcements manager
const announcementsManager = new AnnouncementsManager();

// Make it globally available for inline event handlers
window.announcementsManager = announcementsManager;