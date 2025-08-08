import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { db } from '/config/firebase-config.js';

class MessagingService {
  constructor() {
    this.teamsCollection = 'groups'; // reuse groups as teams
  }

  async getUserTeams(userId) {
    const q = query(collection(db, this.teamsCollection), where('members', 'array-contains', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async getTeam(teamId) {
    const teamRef = doc(db, this.teamsCollection, teamId);
    const teamSnap = await getDoc(teamRef);
    return { id: teamSnap.id, ...teamSnap.data() };
  }

  async getTeamChats(teamId) {
    const chatsCol = collection(db, this.teamsCollection, teamId, 'chats');
    const q = query(chatsCol, orderBy('createdAt'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async createChat(teamId, { name, members }) {
    const chatsCol = collection(db, this.teamsCollection, teamId, 'chats');
    return await addDoc(chatsCol, {
      name,
      members,
      createdAt: serverTimestamp()
    });
  }

  async sendMessage(teamId, chatId, text, senderId) {
    const msgCol = collection(db, this.teamsCollection, teamId, 'chats', chatId, 'messages');
    await addDoc(msgCol, {
      senderId,
      text,
      createdAt: serverTimestamp(),
      edited: false,
      reactions: {},
      readBy: [senderId]
    });
  }

  async editMessage(teamId, chatId, messageId, text) {
    const msgRef = doc(db, this.teamsCollection, teamId, 'chats', chatId, 'messages', messageId);
    await updateDoc(msgRef, {
      text,
      edited: true,
      editedAt: serverTimestamp()
    });
  }

  async deleteMessage(teamId, chatId, messageId) {
    const msgRef = doc(db, this.teamsCollection, teamId, 'chats', chatId, 'messages', messageId);
    await deleteDoc(msgRef);
  }

  listenForMessages(teamId, chatId, callback) {
    const msgCol = collection(db, this.teamsCollection, teamId, 'chats', chatId, 'messages');
    const q = query(msgCol, orderBy('createdAt'));
    return onSnapshot(q, snap => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(messages);
    });
  }

  async toggleReaction(teamId, chatId, messageId, emoji, userId) {
    const msgRef = doc(db, this.teamsCollection, teamId, 'chats', chatId, 'messages', messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const reactions = data.reactions || {};
    const current = reactions[emoji] || [];
    if (current.includes(userId)) {
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: arrayRemove(userId)
      });
    } else {
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: arrayUnion(userId)
      });
    }
  }

  async markMessageRead(teamId, chatId, messageId, userId) {
    const msgRef = doc(db, this.teamsCollection, teamId, 'chats', chatId, 'messages', messageId);
    await updateDoc(msgRef, {
      readBy: arrayUnion(userId)
    });
  }

  async setTyping(teamId, chatId, userId, isTyping) {
    const typingRef = doc(db, this.teamsCollection, teamId, 'chats', chatId, 'typing', userId);
    if (isTyping) {
      await setDoc(typingRef, {
        isTyping: true,
        updatedAt: serverTimestamp()
      });
    } else {
      await deleteDoc(typingRef);
    }
  }

  listenForTyping(teamId, chatId, callback) {
    const typingCol = collection(db, this.teamsCollection, teamId, 'chats', chatId, 'typing');
    return onSnapshot(typingCol, snap => {
      const users = snap.docs.map(d => ({ userId: d.id, ...d.data() }));
      callback(users);
    });
  }
}

export default new MessagingService();
