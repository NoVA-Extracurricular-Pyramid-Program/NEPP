export async function getCurrentUser() {

  return { id: "user123", name: "Alex", role: "student", teamId: "team456" };
}

export async function getLatestAnnouncement(teamId) {
 
  return { title: "MUN Conference This Saturday!" };
}

export async function getLatestForm(teamId) {
 
  return { title: "Event Permission Slip" };
}

export async function getNextEvent(userId) {
 
  return { title: "Mock Debate Round", date: new Date(Date.now() + 86400000).toISOString() };
}