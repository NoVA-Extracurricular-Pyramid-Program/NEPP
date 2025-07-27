import { auth, db } from '/config/firebase-config.js';
import { 
  doc, 
  getDoc,
  collection,
  query,
  where,
  getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Get form ID from URL
const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('id');

if (!formId) {
  window.location.href = 'forms.html';
}

let formData = null;
let responses = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  await loadFormAndResponses();
});

async function loadFormAndResponses() {
  try {
    // Load form data
    const formDoc = await getDoc(doc(db, 'forms', formId));
    if (!formDoc.exists()) {
      throw new Error('Form not found');
    }

    formData = formDoc.data();
    
    // Verify user is the form creator
    if (formData.createdBy !== auth.currentUser?.uid) {
      throw new Error('Unauthorized access');
    }

    // Load responses
    const responsesQuery = query(
      collection(db, 'form_responses'),
      where('formId', '==', formId)
    );
    const responsesSnapshot = await getDocs(responsesQuery);
    responses = responsesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      score: calculateScore(doc.data().answers, formData.questions)
    }));

    displayFormDetails();
    displaySummary();
    displayIndividualResponses();

  } catch (error) {
    console.error("Error loading results:", error);
    document.querySelector('.main-content').innerHTML = `
      <div class="error-container">
        <h2>Error Loading Results</h2>
        <p>${error.message}</p>
        <button onclick="window.location.href='forms.html'" class="cancel-btn">
          Return to Forms
        </button>
      </div>
    `;
  }
}

function calculateScore(answers, questions) {
  let correctAnswers = 0;
  let totalQuestions = 0;

  questions.forEach((question, index) => {
    if (question.type === 'Multiple Choice' && question.correctAnswer) {
      totalQuestions++;
      if (answers[`q${index}`] === question.correctAnswer) {
        correctAnswers++;
      }
    }
  });

  return totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : null;
}

function displayFormDetails() {
  document.getElementById('formTitle').textContent = formData.title;
  document.getElementById('formType').textContent = formData.type;
  document.getElementById('responsesCount').textContent = `${responses.length} Responses`;
  
  const scores = responses.map(r => r.score).filter(s => s !== null);
  if (scores.length > 0) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    document.getElementById('avgScore').textContent = `Average Score: ${avgScore.toFixed(1)}%`;
  }
}

function displaySummary() {
  const container = document.getElementById('questionsSummary');
  container.innerHTML = '';

  formData.questions.forEach((question, qIndex) => {
    const questionResponses = responses.map(r => r.answers[`q${qIndex}`]);
    const summary = document.createElement('div');
    summary.className = 'question-summary';
    
    let summaryHTML = `
      <div class="question-header">
        <span class="question-text">${question.question}</span>
        <span class="response-rate">${questionResponses.filter(Boolean).length}/${responses.length} responses</span>
      </div>
    `;

    switch (question.type) {
      case 'Multiple Choice':
        summaryHTML += generateMultipleChoiceSummary(question, questionResponses);
        break;
      case 'Checkboxes':
        summaryHTML += generateCheckboxesSummary(question, questionResponses);
        break;
      case 'Short Answer':
      case 'Long Answer':
        summaryHTML += generateTextSummary(questionResponses);
        break;
      case 'Linear Scale':
        summaryHTML += generateScaleSummary(question, questionResponses);
        break;
    }

    summary.innerHTML = summaryHTML;
    container.appendChild(summary);
  });
}

function generateMultipleChoiceSummary(question, responses) {
  const optionCounts = {};
  question.options.forEach(opt => optionCounts[opt] = 0);
  responses.forEach(r => r && optionCounts[r]++);

  const totalResponses = responses.filter(Boolean).length;
  const correctAnswers = responses.filter(r => r === question.correctAnswer).length;
  
  let html = `
    <div class="correct-rate">Correct Answers: ${correctAnswers}/${totalResponses} (${((correctAnswers/totalResponses || 0) * 100).toFixed(1)}%)</div>
    <div class="chart-container">
      <div class="bar-chart">
  `;

  question.options.forEach(option => {
    const count = optionCounts[option];
    const percentage = totalResponses ? (count / totalResponses * 100) : 0;
    const isCorrect = option === question.correctAnswer;
    
    html += `
      <div class="bar" style="height: ${percentage}%; background: ${isCorrect ? '#2ecc71' : '#FFD600'}">
        <span class="bar-value">${count}</span>
        <span class="bar-label">${option}</span>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

// Add other summary generation functions here...

function displayIndividualResponses() {
  const container = document.getElementById('responsesList');
  container.innerHTML = '';

  responses.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .forEach(response => {
      const card = document.createElement('div');
      card.className = 'response-card';
      
      let answersHTML = '';
      formData.questions.forEach((question, qIndex) => {
        const answer = response.answers[`q${qIndex}`];
        const isCorrect = question.type === 'Multiple Choice' && 
          question.correctAnswer === answer;
        
        answersHTML += `
          <div class="answer-item">
            <span class="answer-question">${question.question}</span>
            <span class="answer-value ${isCorrect ? 'answer-correct' : question.correctAnswer ? 'answer-incorrect' : ''}">${answer || 'No answer'}</span>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="response-header">
          <span>Submitted by ${response.userName} on ${new Date(response.submittedAt).toLocaleString()}</span>
          ${response.score !== null ? `<span class="response-score">Score: ${response.score.toFixed(1)}%</span>` : ''}
        </div>
        <div class="answer-list">
          ${answersHTML}
        </div>
      `;

      container.appendChild(card);
    });
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    button.classList.add('active');
    document.getElementById(`${button.dataset.tab}Tab`).classList.add('active');
  });
});

// Export results
document.getElementById('exportBtn').addEventListener('click', () => {
  const csv = generateCSV();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${formData.title}_results.csv`;
  a.click();
});

function generateCSV() {
  // Generate CSV data here...
}