import authManager from '/utils/auth-manager.js';
import MessagingService from '/services/messaging-service.js';

let currentUser = null;
let currentTeamId = null;
let currentChatId = null;
let currentChatName = '';
let currentTeamMembers = [];
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
  currentTeamMembers = await MessagingService.getTeamMembers(teamId);
  const chats = await MessagingService.getTeamChats(teamId);
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  currentTeamMembers
    .filter(m => m.id !== currentUser.uid)
    .forEach(member => {
      const li = document.createElement('li');
      li.textContent = member.displayName || member.email || member.id;
      li.addEventListener('click', () => selectUser(member, li));
      list.appendChild(li);
    });
  chats
    .filter(c => c.members && c.members.length > 2)
    .forEach(chat => {
      const li = document.createElement('li');
      li.textContent = chat.name;
      li.addEventListener('click', () => selectChat(chat.id, li, chat.name));
      list.appendChild(li);
    });
  const btn = document.createElement('button');
  btn.textContent = '+ Create Group';
  btn.classList.add('create-chat');
  btn.addEventListener('click', openGroupModal);
  list.appendChild(btn);
}

async function selectUser(member, element) {
  const chat = await MessagingService.getOrCreateDirectChat(currentTeamId, currentUser.uid, member.id);
  selectChat(chat.id, element, member.displayName || member.email || member.id);
}

function selectChat(chatId, element, name) {
  currentChatId = chatId;
  currentChatName = name || '';
  document.getElementById('chat-title').textContent = currentChatName;
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

function openGroupModal() {
  const modal = document.getElementById('group-modal');
  document.getElementById('group-name').value = '';
  const membersDiv = document.getElementById('group-members');
  membersDiv.innerHTML = '';
  currentTeamMembers
    .filter(m => m.id !== currentUser.uid)
    .forEach(member => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = member.id;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(member.displayName || member.email || member.id));
      membersDiv.appendChild(label);
    });
  modal.classList.remove('hidden');
}

document.getElementById('group-cancel').addEventListener('click', () => {
  document.getElementById('group-modal').classList.add('hidden');
});

document.getElementById('group-create').addEventListener('click', async () => {
  const name = document.getElementById('group-name').value.trim();
  const selected = [...document.querySelectorAll('#group-members input:checked')].map(i => i.value);
  if (!name || !selected.length) return;
  await MessagingService.createChat(currentTeamId, { name, members: [currentUser.uid, ...selected] });
  document.getElementById('group-modal').classList.add('hidden');
  selectTeam(currentTeamId);
});
