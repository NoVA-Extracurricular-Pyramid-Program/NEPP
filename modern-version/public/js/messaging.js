import authManager from '/utils/auth-manager.js';
import MessagingService from '/services/messaging-service.js';

let currentUser = null;
let currentTeamId = null;
let currentChatId = null;
let unsubscribeMessages = null;
let unsubscribeTyping = null;

authManager.onAuthStateChanged(async (user) => {
  if (!user) return;
  currentUser = user;
  await loadTeams();
});

async function loadTeams() {
  const teams = await MessagingService.getUserTeams(currentUser.uid);
  const list = document.getElementById('team-list');
  list.innerHTML = '';
  teams.forEach(team => {
    const li = document.createElement('li');
    li.textContent = team.name;
    li.addEventListener('click', () => selectTeam(team.id, li));
    list.appendChild(li);
  });
}

async function selectTeam(teamId, element) {
  currentTeamId = teamId;
  [...document.querySelectorAll('#team-list li')].forEach(li => li.classList.remove('active'));
  if (element) element.classList.add('active');
  const chats = await MessagingService.getTeamChats(teamId);
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  chats.forEach(chat => {
    const li = document.createElement('li');
    li.textContent = chat.name;
    li.addEventListener('click', () => selectChat(chat.id, li));
    list.appendChild(li);
  });
  const btn = document.createElement('button');
  btn.textContent = '+ New Chat';
  btn.classList.add('create-chat');
  btn.addEventListener('click', async () => {
    const name = prompt('Chat name');
    if (!name) return;
    const membersInput = prompt('Enter member IDs separated by commas or leave blank for all team members');
    let members;
    if (membersInput && membersInput.trim()) {
      members = membersInput.split(',').map(s => s.trim());
    } else {
      const team = await MessagingService.getTeam(teamId);
      members = team.members || [];
    }
    await MessagingService.createChat(teamId, { name, members });
    selectTeam(teamId);
  });
  list.appendChild(btn);
}

function selectChat(chatId, element) {
  currentChatId = chatId;
  [...document.querySelectorAll('#chat-list li')].forEach(li => li.classList.remove('active'));
  if (element) element.classList.add('active');
  subscribeMessages();
  subscribeTyping();
}

function subscribeMessages() {
  if (unsubscribeMessages) unsubscribeMessages();
  unsubscribeMessages = MessagingService.listenForMessages(currentTeamId, currentChatId, (msgs) => {
    const container = document.getElementById('messages');
    container.innerHTML = '';
    msgs.forEach(msg => {
      const div = document.createElement('div');
      div.classList.add('message');
      if (msg.senderId === currentUser.uid) div.classList.add('mine');
      const textDiv = document.createElement('div');
      textDiv.textContent = msg.text;
      const metaDiv = document.createElement('div');
      metaDiv.classList.add('meta');
      const time = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
      metaDiv.textContent = `${msg.senderId} • ${time.toLocaleString()}${msg.edited ? ' (edited)' : ''}`;
      const reactionsDiv = document.createElement('div');
      reactionsDiv.classList.add('reactions');
      reactionsDiv.textContent = formatReactions(msg.reactions);
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('message-actions');
      const reactBtn = document.createElement('button');
      reactBtn.textContent = '👍';
      reactBtn.addEventListener('click', () => MessagingService.toggleReaction(currentTeamId, currentChatId, msg.id, '👍', currentUser.uid));
      actionsDiv.appendChild(reactBtn);
      if (msg.senderId === currentUser.uid) {
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', async () => {
          const newText = prompt('Edit message', msg.text);
          if (newText !== null) {
            await MessagingService.editMessage(currentTeamId, currentChatId, msg.id, newText);
          }
        });
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', async () => {
          if (confirm('Delete message?')) {
            await MessagingService.deleteMessage(currentTeamId, currentChatId, msg.id);
          }
        });
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);
      }
      const readDiv = document.createElement('div');
      readDiv.classList.add('read-receipt');
      const readCount = msg.readBy ? msg.readBy.length : 0;
      readDiv.textContent = `Read by ${readCount}`;
      div.appendChild(textDiv);
      div.appendChild(metaDiv);
      div.appendChild(reactionsDiv);
      div.appendChild(actionsDiv);
      div.appendChild(readDiv);
      container.appendChild(div);
      if (!msg.readBy || !msg.readBy.includes(currentUser.uid)) {
        MessagingService.markMessageRead(currentTeamId, currentChatId, msg.id, currentUser.uid);
      }
    });
    container.scrollTop = container.scrollHeight;
  });
}

function subscribeTyping() {
  if (unsubscribeTyping) unsubscribeTyping();
  unsubscribeTyping = MessagingService.listenForTyping(currentTeamId, currentChatId, (users) => {
    const indicator = document.getElementById('typing-indicator');
    const others = users.filter(u => u.userId !== currentUser.uid && u.isTyping);
    if (others.length) {
      indicator.textContent = `${others.map(u => u.userId).join(', ')} typing...`;
    } else {
      indicator.textContent = '';
    }
  });
}

const form = document.getElementById('message-form');
const input = document.getElementById('message-input');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !currentTeamId || !currentChatId) return;
  await MessagingService.sendMessage(currentTeamId, currentChatId, text, currentUser.uid);
  input.value = '';
  MessagingService.setTyping(currentTeamId, currentChatId, currentUser.uid, false);
});

input.addEventListener('input', () => {
  if (!currentTeamId || !currentChatId) return;
  MessagingService.setTyping(currentTeamId, currentChatId, currentUser.uid, input.value.length > 0);
});

function formatReactions(reactions = {}) {
  return Object.entries(reactions).map(([emoji, users]) => `${emoji} ${users.length}`).join(' ');
}
