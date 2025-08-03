import { auth, db } from '/config/firebase-config.js';
import { FormsService } from '/services/forms-service.js';
import { 
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

class FormCreator {
  constructor() {
    this.currentUser = null;
    this.selectedGroups = new Set();
    this.selectedUsers = new Set();
    this.allGroups = [];
    this.allUsers = [];
    this.questions = [];
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    this.setupAuthListener();
  }

  setupAuthListener() {
    auth.onAuthStateChanged((user) => {
      if (user) {
        this.currentUser = user;
        console.log('User authenticated:', user.email);
        this.initializePage();
      } else {
        console.log('User not authenticated');
        this.showAuthAlert();
      }
    });
  }

  showAuthAlert() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'auth-alert-dialog';
    dialog.innerHTML = `
      <h2>Sign In Required</h2>
      <p>You need to be signed in to create forms. Would you like to sign in now?</p>
      <div class="auth-alert-actions">
        <button class="sign-in-btn">Sign In</button>
        <button class="cancel-auth-btn">Cancel</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    dialog.querySelector('.sign-in-btn').addEventListener('click', () => {
      window.location.href = '/login.html';
    });

    dialog.querySelector('.cancel-auth-btn').addEventListener('click', () => {
      window.location.href = '/html/forms.html';
    });
  }

  initializePage() {
    console.log('Initializing form creator page...');
    
    // Initialize basic form elements
    this.initializeFormElements();
    
    // Initialize audience selector
    this.initializeAudienceSelector();
    
    // Initialize question builder
    this.initializeQuestionBuilder();
    
    console.log('Page initialization complete');
  }

  initializeFormElements() {
    // Cancel button
    const cancelBtn = document.getElementById('cancelForm');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel? All progress will be lost.')) {
          window.location.href = '/html/forms.html';
        }
      });
    }

    // Form submission
    const form = document.getElementById('createFormForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  }

  initializeAudienceSelector() {
    console.log('Initializing audience selector...');
    
    // Get references to audience selector elements
    this.audienceSelector = document.querySelector('.audience-selector');
    this.audienceTabs = document.querySelectorAll('.audience-tab');
    this.audienceSections = document.querySelectorAll('.audience-section');
    
    // Group elements
    this.selectedGroupsContainer = document.querySelector('#selectedGroups');
    this.groupSearch = document.querySelector('#groupSearch');
    this.groupResults = document.querySelector('#groupResults');
    
    // User elements
    this.selectedUsersContainer = document.querySelector('#selectedUsers');
    this.userSearch = document.querySelector('#userSearch');
    this.userResults = document.querySelector('#userResults');
    
    // Both mode elements
    this.bothGroupsContainer = document.querySelector('#selectedGroupsBoth');
    this.bothUsersContainer = document.querySelector('#selectedUsersBoth');
    this.bothGroupSearch = document.querySelector('#groupSearchBoth');
    this.bothUserSearch = document.querySelector('#userSearchBoth');
    this.bothGroupResults = document.querySelector('#groupResultsBoth');
    this.bothUserResults = document.querySelector('#userResultsBoth');
    
    if (!this.audienceSelector) {
      console.error('Audience selector not found!');
      return;
    }
    
    this.bindAudienceEvents();
    this.loadGroupsAndUsers();
    
    // Initialize placeholders
    this.updateSelectedGroups();
    this.updateSelectedUsers();
  }

  bindAudienceEvents() {
    // Tab switching
    this.audienceTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchAudienceTab(tab.dataset.target));
    });
    
    // Group search events
    if (this.groupSearch) {
      this.groupSearch.addEventListener('input', (e) => this.searchGroups(e.target.value));
      this.groupSearch.addEventListener('focus', () => this.showGroupResults());
    }
    
    if (this.bothGroupSearch) {
      this.bothGroupSearch.addEventListener('input', (e) => this.searchGroups(e.target.value, 'both'));
      this.bothGroupSearch.addEventListener('focus', () => this.showGroupResults('both'));
    }
    
    // User search events
    if (this.userSearch) {
      this.userSearch.addEventListener('input', (e) => this.searchUsers(e.target.value));
      this.userSearch.addEventListener('focus', () => this.showUserResults());
    }
    
    if (this.bothUserSearch) {
      this.bothUserSearch.addEventListener('input', (e) => this.searchUsers(e.target.value, 'both'));
      this.bothUserSearch.addEventListener('focus', () => this.showUserResults('both'));
    }
    
    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.group-search') && !e.target.closest('.group-results')) {
        this.hideGroupResults();
      }
      if (!e.target.closest('.user-search') && !e.target.closest('.user-results')) {
        this.hideUserResults();
      }
    });
  }

  async loadGroupsAndUsers() {
    try {
      console.log('Loading groups and users...');
      
      // Load groups where user is a member
      const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', this.currentUser.uid)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      this.allGroups = [];
      groupsSnapshot.forEach(doc => {
        this.allGroups.push({ id: doc.id, ...doc.data() });
      });
      
      // Load all users (except current user)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      this.allUsers = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (doc.id !== this.currentUser.uid) {
          this.allUsers.push({ id: doc.id, ...userData });
        }
      });
      
      console.log(`Loaded ${this.allGroups.length} groups and ${this.allUsers.length} users`);
      
    } catch (error) {
      console.error('Error loading groups and users:', error);
    }
  }

  switchAudienceTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Update active tab
    this.audienceTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.target === tabName);
    });
    
    // Update active section
    const sectionIdMap = {
      'groups': 'groups-selection',
      'individuals': 'individuals-selection', 
      'both': 'both-selection'
    };
    
    this.audienceSections.forEach(section => {
      section.classList.toggle('active', section.id === sectionIdMap[tabName]);
    });
    
    // Clear search inputs and hide results
    this.clearSearches();
  }

  clearSearches() {
    if (this.groupSearch) this.groupSearch.value = '';
    if (this.userSearch) this.userSearch.value = '';
    if (this.bothGroupSearch) this.bothGroupSearch.value = '';
    if (this.bothUserSearch) this.bothUserSearch.value = '';
    this.hideGroupResults();
    this.hideUserResults();
  }

  searchGroups(query, mode = 'groups') {
    if (!query.trim()) {
      this.hideGroupResults(mode);
      return;
    }
    
    const filteredGroups = this.allGroups.filter(group =>
      group.name?.toLowerCase().includes(query.toLowerCase()) ||
      group.description?.toLowerCase().includes(query.toLowerCase())
    );
    
    this.displayGroupResults(filteredGroups, mode);
  }

  displayGroupResults(groups, mode = 'groups') {
    const resultsContainer = mode === 'both' ? this.bothGroupResults : this.groupResults;
    if (!resultsContainer) return;
    
    if (groups.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No groups found</div>';
    } else {
      resultsContainer.innerHTML = groups.map(group => `
        <div class="group-result" onclick="formCreator.selectGroup('${group.id}', '${mode}')">
          <div class="group-result-name">${group.name}</div>
          <div class="group-result-description">${group.description || 'No description'}</div>
          <div class="group-result-meta">
            <span>${group.members?.length || 0} members</span>
          </div>
        </div>
      `).join('');
    }
    
    this.showGroupResults(mode);
  }

  searchUsers(query, mode = 'users') {
    if (!query.trim()) {
      this.hideUserResults(mode);
      return;
    }
    
    const filteredUsers = this.allUsers.filter(user =>
      user.displayName?.toLowerCase().includes(query.toLowerCase()) ||
      user.name?.toLowerCase().includes(query.toLowerCase()) ||
      user.email?.toLowerCase().includes(query.toLowerCase())
    );
    
    this.displayUserResults(filteredUsers, mode);
  }

  displayUserResults(users, mode = 'users') {
    const resultsContainer = mode === 'both' ? this.bothUserResults : this.userResults;
    if (!resultsContainer) return;
    
    if (users.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
    } else {
      resultsContainer.innerHTML = users.map(user => `
        <div class="user-result" onclick="formCreator.selectUser('${user.id}', '${mode}')">
          <div class="user-result-name">${user.displayName || user.name || user.email}</div>
          <div class="user-result-email">${user.email}</div>
        </div>
      `).join('');
    }
    
    this.showUserResults(mode);
  }

  selectGroup(groupId, mode = 'groups') {
    this.selectedGroups.add(groupId);
    this.updateSelectedGroups(mode);
    this.clearGroupSearch(mode);
  }

  selectUser(userId, mode = 'users') {
    this.selectedUsers.add(userId);
    this.updateSelectedUsers(mode);
    this.clearUserSearch(mode);
  }

  removeGroup(groupId) {
    this.selectedGroups.delete(groupId);
    this.updateSelectedGroups();
    this.updateSelectedGroups('both');
  }

  removeUser(userId) {
    this.selectedUsers.delete(userId);
    this.updateSelectedUsers();
    this.updateSelectedUsers('both');
  }

  updateSelectedGroups(mode = 'groups') {
    const containers = mode === 'both' ? [this.bothGroupsContainer] : 
                     mode === 'groups' ? [this.selectedGroupsContainer] : 
                     [this.selectedGroupsContainer, this.bothGroupsContainer];
    
    containers.forEach(container => {
      if (!container) return;
      
      if (this.selectedGroups.size === 0) {
        container.innerHTML = '<span class="placeholder">No groups selected</span>';
      } else {
        container.innerHTML = Array.from(this.selectedGroups).map(groupId => {
          const group = this.allGroups.find(g => g.id === groupId);
          return group ? `
            <div class="selected-group">
              <span>${group.name}</span>
              <button onclick="formCreator.removeGroup('${groupId}')" type="button">×</button>
            </div>
          ` : '';
        }).join('');
      }
    });
  }

  updateSelectedUsers(mode = 'users') {
    const containers = mode === 'both' ? [this.bothUsersContainer] : 
                     mode === 'users' ? [this.selectedUsersContainer] : 
                     [this.selectedUsersContainer, this.bothUsersContainer];
    
    containers.forEach(container => {
      if (!container) return;
      
      if (this.selectedUsers.size === 0) {
        container.innerHTML = '<span class="placeholder">No users selected</span>';
      } else {
        container.innerHTML = Array.from(this.selectedUsers).map(userId => {
          const user = this.allUsers.find(u => u.id === userId);
          return user ? `
            <div class="selected-user">
              <span>${user.displayName || user.name || user.email}</span>
              <button onclick="formCreator.removeUser('${userId}')" type="button">×</button>
            </div>
          ` : '';
        }).join('');
      }
    });
  }

  showGroupResults(mode = 'groups') {
    const resultsContainer = mode === 'both' ? this.bothGroupResults : this.groupResults;
    if (resultsContainer) resultsContainer.classList.add('show');
  }

  hideGroupResults(mode = null) {
    if (!mode || mode === 'groups') {
      if (this.groupResults) this.groupResults.classList.remove('show');
    }
    if (!mode || mode === 'both') {
      if (this.bothGroupResults) this.bothGroupResults.classList.remove('show');
    }
  }

  showUserResults(mode = 'users') {
    const resultsContainer = mode === 'both' ? this.bothUserResults : this.userResults;
    if (resultsContainer) resultsContainer.classList.add('show');
  }

  hideUserResults(mode = null) {
    if (!mode || mode === 'users') {
      if (this.userResults) this.userResults.classList.remove('show');
    }
    if (!mode || mode === 'both') {
      if (this.bothUserResults) this.bothUserResults.classList.remove('show');
    }
  }

  clearGroupSearch(mode = 'groups') {
    if (mode === 'both' && this.bothGroupSearch) {
      this.bothGroupSearch.value = '';
      this.hideGroupResults('both');
    } else if (this.groupSearch) {
      this.groupSearch.value = '';
      this.hideGroupResults('groups');
    }
  }

  clearUserSearch(mode = 'users') {
    if (mode === 'both' && this.bothUserSearch) {
      this.bothUserSearch.value = '';
      this.hideUserResults('both');
    } else if (this.userSearch) {
      this.userSearch.value = '';
      this.hideUserResults('users');
    }
  }

  // Question Builder Methods
  initializeQuestionBuilder() {
    console.log('Initializing question builder...');
    
    const questionTypeButtons = document.querySelectorAll('.question-type-btn');
    questionTypeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const type = button.getAttribute('data-type');
        if (type) {
          this.addQuestion(type);
        }
      });
    });

    // Event delegation for dynamic question elements
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-question-btn')) {
        const questionCard = e.target.closest('.question-card');
        const questionId = questionCard?.dataset.id;
        if (questionId) {
          this.deleteQuestion(parseInt(questionId));
        }
      } else if (e.target.classList.contains('add-option-btn')) {
        const optionsList = e.target.closest('.options-list');
        if (optionsList) {
          this.addOption(optionsList);
        }
      } else if (e.target.classList.contains('remove-option-btn')) {
        const optionItem = e.target.closest('.option-item');
        const optionsList = optionItem?.parentElement;
        if (optionsList && optionsList.querySelectorAll('.option-item').length > 1) {
          optionItem.remove();
        }
      }
    });
  }

  addQuestion(type) {
    console.log('Adding question of type:', type);
    
    const questionNumber = this.questions.length + 1;
    const questionData = {
      type: type,
      question: '',
      required: false,
      options: type === 'Multiple Choice' || type === 'Checkboxes' || type === 'Poll' ? [''] : [],
      id: Date.now()
    };
    
    this.questions.push(questionData);
    
    const questionHTML = `
      <div class="question-card" data-id="${questionData.id}" data-type="${type}">
        <div class="question-header">
          <h4>Question ${questionNumber}</h4>
          <button type="button" class="delete-question-btn">Delete</button>
        </div>
        <div class="question-content">
          <input type="text" class="question-text" placeholder="Enter your question" required>
          <div class="question-options">
            ${this.getQuestionTypeHTML(type, questionData.id)}
          </div>
          <label class="required-toggle">
            <input type="checkbox" class="required-checkbox">
            Required
          </label>
        </div>
      </div>
    `;
    
    const questionsContainer = document.getElementById('questionsContainer');
    if (questionsContainer) {
      questionsContainer.insertAdjacentHTML('beforeend', questionHTML);
    }
  }

  getQuestionTypeHTML(type, id) {
    switch (type.trim()) {
      case 'Multiple Choice':
        return `
          <div class="options-list" data-id="${id}">
            <div class="option-item">
              <input type="text" placeholder="Option 1" required>
              <button type="button" class="remove-option-btn">Remove</button>
            </div>
            <button type="button" class="add-option-btn">Add Option</button>
          </div>
        `;
      case 'Checkboxes':
        return `
          <div class="options-list" data-id="${id}">
            <div class="option-item">
              <input type="text" placeholder="Option 1" required>
              <button type="button" class="remove-option-btn">Remove</button>
            </div>
            <button type="button" class="add-option-btn">Add Option</button>
          </div>
        `;
      case 'Poll':
        return `
          <div class="options-list" data-id="${id}">
            <div class="option-item">
              <input type="text" placeholder="Option 1" required>
              <button type="button" class="remove-option-btn">Remove</button>
            </div>
            <button type="button" class="add-option-btn">Add Option</button>
          </div>
        `;
      case 'Short Answer':
        return '<input type="text" disabled placeholder="Short answer text">';
      case 'Long Answer':
        return '<textarea disabled placeholder="Long answer text"></textarea>';
      case 'File Upload':
        return `
          <div class="file-upload-config">
            <label>Allowed file types:</label>
            <div class="file-types">
              <label><input type="checkbox" value="pdf"> PDF</label>
              <label><input type="checkbox" value="image"> Images</label>
              <label><input type="checkbox" value="doc"> Documents</label>
            </div>
            <label>Max file size (MB):</label>
            <input type="number" min="1" max="50" value="10" class="file-size-limit">
          </div>
        `;
      case 'Linear Scale':
        return `
          <div class="linear-scale-config">
            <div class="scale-inputs">
              <div>
                <label>Start:</label>
                <input type="number" min="0" max="10" value="0" class="scale-start">
              </div>
              <div>
                <label>End:</label>
                <input type="number" min="0" max="10" value="5" class="scale-end">
              </div>
            </div>
            <div class="scale-labels">
              <input type="text" placeholder="Start label (e.g., Poor)" class="scale-start-label">
              <input type="text" placeholder="End label (e.g., Excellent)" class="scale-end-label">
            </div>
          </div>
        `;
      default:
        return '';
    }
  }

  addOption(optionsList) {
    const optionsCount = optionsList.querySelectorAll('.option-item').length;
    const addButton = optionsList.querySelector('.add-option-btn');
    
    const optionHTML = `
      <div class="option-item">
        <input type="text" placeholder="Option ${optionsCount + 1}" required>
        <button type="button" class="remove-option-btn">Remove</button>
      </div>
    `;
    
    addButton.insertAdjacentHTML('beforebegin', optionHTML);
  }

  deleteQuestion(id) {
    const questionElement = document.querySelector(`.question-card[data-id="${id}"]`);
    if (questionElement) {
      questionElement.remove();
      this.questions = this.questions.filter(q => q.id !== id);
      this.updateQuestionNumbers();
    }
  }

  updateQuestionNumbers() {
    document.querySelectorAll('.question-card').forEach((card, index) => {
      card.querySelector('h4').textContent = `Question ${index + 1}`;
    });
  }

  // Get author name from Auth profile or Firestore as fallback
  async getAuthorName() {
    try {
      // First try Firebase Auth displayName
      if (this.currentUser.displayName) {
        return this.currentUser.displayName;
      }

      // Fallback to Firestore user document
      const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
      const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
      
      if (userDoc.exists() && userDoc.data().displayName) {
        return userDoc.data().displayName;
      }

      // Final fallback to email
      return this.currentUser.email;
    } catch (error) {
      console.error('Error getting author name:', error);
      return this.currentUser.email || 'Unknown';
    }
  }

  // Form submission
  async handleFormSubmit(e) {
    e.preventDefault();
    
    const formTitle = document.getElementById('formTitle').value.trim();
    const formDescription = document.getElementById('formDescription').value.trim();
    const dueDate = document.getElementById('dueDate').value;

    // Validation
    if (!formTitle) {
      alert('Form title is required');
      return;
    }

    if (!dueDate) {
      alert('Due date is required');
      return;
    }

    if (this.selectedGroups.size === 0 && this.selectedUsers.size === 0) {
      alert('Please select at least one group or user as target audience');
      return;
    }

    if (this.questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    try {
      // Collect question data
      const formQuestions = [];
      document.querySelectorAll('.question-card').forEach((card, index) => {
        const questionText = card.querySelector('.question-text').value.trim();
        const isRequired = card.querySelector('.required-checkbox').checked;
        const type = card.dataset.type;
        
        if (!questionText) {
          throw new Error(`Question ${index + 1} text is required`);
        }
        
        const questionData = {
          question: questionText,
          type: type,
          required: isRequired,
          order: index
        };

        // Add type-specific data
        if (type === 'Multiple Choice' || type === 'Checkboxes' || type === 'Poll') {
          const options = [];
          card.querySelectorAll('.option-item input').forEach(input => {
            if (input.value.trim()) {
              options.push(input.value.trim());
            }
          });
          if (options.length === 0) {
            throw new Error(`Question ${index + 1} must have at least one option`);
          }
          questionData.options = options;
        } else if (type === 'File Upload') {
          const allowedTypes = [];
          card.querySelectorAll('.file-types input:checked').forEach(input => {
            allowedTypes.push(input.value);
          });
          const maxSize = card.querySelector('.file-size-limit').value;
          questionData.fileConfig = {
            allowedTypes: allowedTypes,
            maxSizeMB: parseInt(maxSize)
          };
        } else if (type === 'Linear Scale') {
          const start = card.querySelector('.scale-start').value;
          const end = card.querySelector('.scale-end').value;
          const startLabel = card.querySelector('.scale-start-label').value;
          const endLabel = card.querySelector('.scale-end-label').value;
          questionData.scaleConfig = {
            start: parseInt(start),
            end: parseInt(end),
            startLabel: startLabel,
            endLabel: endLabel
          };
        }
        
        formQuestions.push(questionData);
      });

      // Create form document
      const formData = {
        title: formTitle,
        description: formDescription,
        dueDate: new Date(dueDate),
        targetGroups: Array.from(this.selectedGroups),
        targetUsers: Array.from(this.selectedUsers),
        questions: formQuestions,
        createdBy: this.currentUser.uid,
        authorName: await this.getAuthorName(),
        status: 'active',
        type: 'public', // Required by FormsService
        isPublic: true  // Required by FormsService
      };

      console.log('Creating form with data:', formData);
      
      // Use FormsService which handles notifications
      const docRef = await FormsService.create(formData);
      console.log('Form created with ID:', docRef.id);
      
      alert('Form created successfully!');
      window.location.href = '/html/forms.html';
      
    } catch (error) {
      console.error('Error creating form:', error);
      alert('Error creating form: ' + error.message);
    }
  }
}

// Initialize the form creator
const formCreator = new FormCreator();

// Make it globally available for inline event handlers
window.formCreator = formCreator;
