import { auth, db } from '/config/firebase-config.js';
import { 
  collection,
  addDoc,
  getDocs,
  Timestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

let currentFormType = 'public';
let questions = [];
let isInitialized = false;

// Show authentication alert dialog
function showAuthAlert() {
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
    window.location.href = 'login.html'; // Redirect to your login page
  });

  dialog.querySelector('.cancel-auth-btn').addEventListener('click', () => {
    overlay.remove();
    dialog.remove();
    window.location.href = 'forms.html'; // Redirect back to forms list
  });
}

// Initialize event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Set up the auth state listener first
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is signed in
      console.log('User is signed in:', user.email);
      initializePage(); // Initialize the page when user is confirmed signed in
    } else {
      // User is not signed in
      console.log('No user is signed in');
      showAuthAlert();
    }
  });
});

// Add this near the top of your file
auth.onAuthStateChanged((user) => {
  if (!user) {
    showAuthAlert();
  }
});

function initializePage() {
  if (isInitialized) return; // Prevent multiple initializations
  
  initializeFormTypeButtons();
  initializeQuestionTypeButtons();
  initializeCancelButton();
  initializeFormSubmission();
  loadGroups();
  
  isInitialized = true;
}

function initializeFormTypeButtons() {
  const formTypeButtons = document.querySelectorAll('.form-type-btn');
  formTypeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      formTypeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      currentFormType = button.getAttribute('data-type');
      const groupSelector = document.getElementById('groupSelector');
      if (groupSelector) {
        groupSelector.style.display = currentFormType === 'private' ? 'block' : 'none';
      }
    });
  });
}

function initializeQuestionTypeButtons() {
  const questionTypeButtons = document.querySelectorAll('.question-type-btn');
  questionTypeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const type = button.getAttribute('data-type');
      if (type) {
        addQuestion(type);
      }
    });
  });
}

function initializeCancelButton() {
  const cancelButton = document.getElementById('cancelForm');
  if (cancelButton) {
    cancelButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to cancel? All progress will be lost.')) {
        window.location.href = 'forms.html';
      }
    });
  }
}

function initializeFormSubmission() {
  const form = document.getElementById('createFormForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
}

// Add question function with improved functionality
function addQuestion(type) {
  console.log('Adding question of type:', type); // Debug log
  const questionNumber = questions.length + 1;
  const questionData = {
    type: type,
    question: '',
    required: false,
    options: type === 'Multiple Choice' || type === 'Checkboxes' ? [''] : [],
    correctAnswer: type === 'Multiple Choice' ? '' : null,
    id: Date.now()
  };
  
  questions.push(questionData);
  
  const questionHTML = `
    <div class="question-card" data-id="${questionData.id}" data-type="${type}">
      <div class="question-header">
        <h4>Question ${questionNumber}</h4>
        <button type="button" class="delete-question-btn" onclick="deleteQuestion(${questionData.id})">Delete</button>
      </div>
      <div class="question-content">
        <input type="text" class="question-text" placeholder="Enter your question" required>
        <div class="question-options">
          ${getQuestionTypeHTML(type, questionData.id)}
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

function getQuestionTypeHTML(type, id) {
  switch (type.trim()) {
    case 'Multiple Choice':
      return `
        <div class="options-list" data-id="${id}">
          <div class="option-item">
            <input type="text" placeholder="Option 1" required>
            <input type="radio" name="correct-${id}" class="correct-option" style="width: 20px; height: 20px; margin: 0 10px;">
            <label style="color: #FFD600; margin-right: 10px;">Correct</label>
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
            <input type="checkbox" class="checkbox-option" style="width: 20px; height: 20px; margin: 0 10px;">
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

// Delete question function
window.deleteQuestion = function(id) {
  const questionElement = document.querySelector(`.question-card[data-id="${id}"]`);
  if (questionElement) {
    questionElement.remove();
    questions = questions.filter(q => q.id !== id);
    updateQuestionNumbers();
  }
};

function updateQuestionNumbers() {
  document.querySelectorAll('.question-card').forEach((card, index) => {
    card.querySelector('h4').textContent = `Question ${index + 1}`;
  });
}

// Add event delegation for dynamically added elements
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('add-option-btn')) {
    const optionsList = e.target.closest('.options-list');
    if (optionsList) {
      const questionId = optionsList.dataset.id;
      const optionsCount = optionsList.querySelectorAll('.option-item').length;
      addNewOption(optionsList, questionId, optionsCount + 1);
    }
  } else if (e.target.classList.contains('remove-option-btn')) {
    const optionItem = e.target.closest('.option-item');
    const optionsList = optionItem?.parentElement;
    if (optionsList && optionsList.querySelectorAll('.option-item').length > 1) {
      optionItem.remove();
    }
  }
});

/** @type {(e: SubmitEvent) => Promise<void>} */
// Form submission handler
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const user = auth.currentUser;
  if (!user) {
    showAuthAlert();
    return;
  }

  const formTitle = document.getElementById('formTitle').value;
  const formDescription = document.getElementById('formDescription').value;
  const dueDate = document.getElementById('dueDate').value;

  if (!formTitle || questions.length === 0 || !dueDate) {
    alert('Please complete all required fields including at least one question.');
    return;
  }

  // Gather question data
  const formQuestions = [];
  document.querySelectorAll('.question-card').forEach(card => {
    const id = card.dataset.id;
    const question = {
      id: id,
      type: questions.find(q => q.id.toString() === id).type,
      question: card.querySelector('.question-text').value,
      required: card.querySelector('.required-checkbox').checked
    };

    // Handle different question types
    const optionsList = card.querySelector('.options-list');
    if (optionsList) {
      question.options = Array.from(optionsList.querySelectorAll('.option-item input[type="text"]'))
        .map(input => input.value);
      
      if (question.type === 'Multiple Choice') {
        const correctOption = optionsList.querySelector('input[type="radio"]:checked');
        question.correctAnswer = correctOption ? 
          Array.from(optionsList.querySelectorAll('.option-item')).indexOf(correctOption.closest('.option-item')) : -1;
      }
    }

    if (question.type === 'File Upload') {
      const config = card.querySelector('.file-upload-config');
      question.fileTypes = Array.from(config.querySelectorAll('.file-types input:checked'))
        .map(input => input.value);
      question.maxFileSize = parseInt(config.querySelector('.file-size-limit').value);
    }

    if (question.type === 'Linear Scale') {
      const config = card.querySelector('.linear-scale-config');
      question.scaleStart = parseInt(config.querySelector('.scale-start').value);
      question.scaleEnd = parseInt(config.querySelector('.scale-end').value);
      question.startLabel = config.querySelector('.scale-start-label').value;
      question.endLabel = config.querySelector('.scale-end-label').value;
    }

    formQuestions.push(question);
  });

  try {
    const formData = {
      title: formTitle,
      description: formDescription,
      dueDate: Timestamp.fromDate(new Date(dueDate)),
      type: currentFormType,
      createdBy: auth.currentUser.uid,
      creatorName: auth.currentUser.displayName || auth.currentUser.email || 'Anonymous',
      createdAt: Timestamp.now(),
      questions: formQuestions,
      group: currentFormType === 'private' ? document.getElementById('group').value : null
    };

    await addDoc(collection(db, 'forms'), formData);
    window.location.href = 'forms.html';
  } catch (error) {
    console.error('Error creating form:', error);
    alert('Error creating form: ' + error.message);
  }
}

// Update your loadGroups function to check auth state
async function loadGroups() {
  const user = auth.currentUser;
  if (!user) return;

  const groupSelect = document.getElementById('group');
  if (!groupSelect) return;

  try {
    const querySnapshot = await getDocs(collection(db, 'groups'));
    querySnapshot.forEach((doc) => {
      const group = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = group.name;
      groupSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading groups:", error);
  }
}

// Add this function after your other functions
function addNewOption(optionsList, questionId, optionNumber) {
  const type = optionsList.closest('.question-card').dataset.type;
  const newOption = document.createElement('div');
  newOption.className = 'option-item';
  
  if (type === 'Multiple Choice') {
    newOption.innerHTML = `
      <input type="text" placeholder="Option ${optionNumber}" required>
      <input type="radio" name="correct-${questionId}" class="correct-option" style="width: 20px; height: 20px; margin: 0 10px;">
      <label style="color: #FFD600; margin-right: 10px;">Correct</label>
      <button type="button" class="remove-option-btn">Remove</button>
    `;
  } else if (type === 'Checkboxes') {
    newOption.innerHTML = `
      <input type="text" placeholder="Option ${optionNumber}" required>
      <input type="checkbox" class="checkbox-option" style="width: 20px; height: 20px; margin: 0 10px;">
      <button type="button" class="remove-option-btn">Remove</button>
    `;
  } else {
    newOption.innerHTML = `
      <input type="text" placeholder="Option ${optionNumber}" required>
      <button type="button" class="remove-option-btn">Remove</button>
    `;
  }
  
  optionsList.insertBefore(newOption, optionsList.querySelector('.add-option-btn'));
}