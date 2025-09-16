const { getFirestore, writeBatch } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let initialized = false;
if (!initialized) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
    initialized = true;
  } catch (e) {
    if (!e.message.includes('already exists')) {
      console.error('Firebase Admin initialization error:', e);
    }
  }
}

const classroomHtmlTemplate = (classId) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ClassNow - Classroom ${classId}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f3f4f6;
        }
        .tab-btn.active {
            background-color: #e5e7eb;
        }
    </style>
</head>
<body class="bg-gray-100 flex items-center justify-center min-h-screen">
    <!-- Main Container -->
    <div id="main-content" class="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden p-6 mx-4 sm:mx-8 md:mx-auto">
        <!-- Header -->
        <header class="pb-4 border-b border-gray-200 mb-4 flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <img id="user-photo" class="w-10 h-10 rounded-full hidden" alt="User Photo">
                <p id="user-status" class="text-sm text-gray-500 font-medium"></p>
            </div>
            <button id="sign-out-btn" class="text-sm font-semibold text-red-500 hover:text-red-700">Sign Out</button>
        </header>

        <!-- Message Box for notifications -->
        <div id="message-box" class="p-3 my-4 text-sm rounded-lg transition-all duration-300 transform scale-0 h-0"></div>

        <!-- Main App Section -->
        <div>
            <div class="flex items-center justify-between">
                <h2 class="text-2xl font-semibold text-gray-800" id="current-class-title"></h2>
                <button id="back-to-classes-btn" class="text-sm text-blue-500 hover:text-blue-700 font-semibold">Back to Classes</button>
            </div>
            <!-- Tab Navigation -->
            <div class="flex flex-wrap my-6 bg-gray-100 rounded-lg p-1">
                <button id="assignments-btn" class="tab-btn flex-1 px-4 py-2 rounded-md font-medium text-gray-700 transition-colors hover:bg-gray-200">Assignments</button>
                <button id="people-btn" class="tab-btn flex-1 px-4 py-2 rounded-md font-medium text-gray-700 transition-colors hover:bg-gray-200">People</button>
                <button id="chat-btn" class="tab-btn flex-1 px-4 py-2 rounded-md font-medium text-gray-700 transition-colors hover:bg-gray-200">Chat</button>
                <button id="assignment-status-btn" class="tab-btn flex-1 px-4 py-2 rounded-md font-medium text-gray-700 transition-colors hover:bg-gray-200 hidden">Assignment Status</button>
                <button id="settings-btn" class="tab-btn flex-1 px-4 py-2 rounded-md font-medium text-gray-700 transition-colors hover:bg-gray-200 hidden">Settings</button>
            </div>

            <!-- Assignments Tab Content -->
            <div id="assignments-section" class="tab-content hidden space-y-6">
                <h3 class="text-xl font-semibold text-gray-700">Assignments</h3>
                <div id="assignments-list" class="space-y-4"></div>
                <div id="create-assignment-form-section" class="bg-gray-50 p-6 rounded-lg shadow-inner hidden">
                    <h3 class="text-lg font-medium mb-3">Create New Assignment</h3>
                    <form id="create-assignment-form" class="space-y-4">
                        <input type="text" id="assignment-title-input" placeholder="Assignment Title" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <textarea id="assignment-desc-input" placeholder="Description" rows="3" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                        <input type="date" id="assignment-due-date-input" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <button type="submit" class="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors">Post Assignment</button>
                    </form>
                </div>
            </div>

            <!-- People Tab Content -->
            <div id="people-section" class="tab-content hidden space-y-6">
                <h3 class="text-xl font-semibold text-gray-700">Class Members</h3>
                <div id="people-list" class="space-y-4"></div>
            </div>

            <!-- Chat Tab Content -->
            <div id="chat-section" class="tab-content hidden flex flex-col h-[70vh] max-h-[70vh]">
                <h3 class="text-xl font-semibold text-gray-700 mb-4">Class Chat</h3>
                <div id="chat-messages" class="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg shadow-inner flex flex-col space-y-2"></div>
                <form id="chat-form" class="mt-4 flex space-x-2">
                    <input type="text" id="message-input" placeholder="Type a message..." class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors">Send</button>
                </form>
            </div>

            <!-- Assignment Status Tab Content (owner only) -->
            <div id="assignment-status-section" class="tab-content hidden space-y-6">
                <h3 class="text-xl font-semibold text-gray-700">Student Assignment Status</h3>
                <div class="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
                    <table class="w-full text-sm text-left text-gray-500">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr id="assignment-status-table-head"></tr>
                        </thead>
                        <tbody id="assignment-status-table-body"></tbody>
                    </table>
                </div>
            </div>

            <!-- Settings Tab Content (owner only) -->
            <div id="settings-section" class="tab-content hidden space-y-6">
                <h3 class="text-xl font-semibold text-gray-700">Class Settings</h3>
                <div class="bg-gray-50 p-6 rounded-lg shadow-inner">
                    <h4 class="text-lg font-medium text-gray-800 mb-3">Chat Management</h4>
                    <div class="flex items-center justify-between mb-4">
                        <label for="disable-chat-toggle" class="text-sm text-gray-600">Disable Chat</label>
                        <input type="checkbox" id="disable-chat-toggle" class="toggle-switch">
                    </div>
                    <div class="flex items-center justify-between">
                        <label for="lock-chat-toggle" class="text-sm text-gray-600">Lock Chat (Teacher-only messages)</label>
                        <input type="checkbox" id="lock-chat-toggle" class="toggle-switch">
                    </div>
                </div>
                <div class="bg-gray-50 p-6 rounded-lg shadow-inner">
                    <h4 class="text-lg font-medium text-gray-800 mb-3">Danger Zone</h4>
                    <p class="text-sm text-gray-600 mb-4">Permanently delete this class and all associated data, including assignments and chat messages. This action cannot be undone.</p>
                    <button id="delete-class-btn" class="w-full bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors">Delete Class</button>
                </div>
            </div>

        </div>

        <!-- Modals -->
        <div id="delete-class-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center hidden">
            <div class="bg-white p-8 rounded-lg shadow-xl text-center">
                <p class="text-lg font-semibold mb-4">Are you sure you want to delete this class?</p>
                <p class="text-sm text-gray-600 mb-6">This action is permanent and cannot be undone.</p>
                <div class="flex justify-center space-x-4">
                    <button id="cancel-delete-class-btn" class="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
                    <button id="confirm-delete-class-btn" class="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
                </div>
            </div>
        </div>
        <div id="remove-student-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center hidden">
            <div class="bg-white p-8 rounded-lg shadow-xl text-center">
                <p class="text-lg font-semibold mb-4">Are you sure you want to remove this student?</p>
                <p class="text-sm text-gray-600 mb-6">They will be removed from this class permanently.</p>
                <div class="flex justify-center space-x-4">
                    <button id="cancel-remove-student-btn" class="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
                    <button id="confirm-remove-student-btn" class="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Remove</button>
                </div>
            </div>
        </div>
    </div>

    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
        import { getFirestore, collection, doc, onSnapshot, getDoc, setDoc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
        import { setLogLevel } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

        // Firebase Config from previous chat
        const firebaseConfig = {
            apiKey: "AIzaSyDXuqG3e-LZuSpSG-WRPtuZbDVLyqswBFo",
            authDomain: "classnow-a5164.firebaseapp.com",
            projectId: "classnow-a5164",
            storageBucket: "classnow-a5164.firebasestorage.app",
            messagingSenderId: "490753047342",
            appId: "1:490753047342:web:09afd4c93397fd9e1f98bf"
        };
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);
        setLogLevel('debug');

        // Global variables provided by the environment
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initialAuthToken : null;
        
        // Extract class ID from URL
        const pathSegments = window.location.pathname.split('/');
        const activeClassId = pathSegments[pathSegments.length - 1];

        // UI elements
        const messageBox = document.getElementById('message-box');
        const userStatusEl = document.getElementById('user-status');
        const userPhotoEl = document.getElementById('user-photo');
        const assignmentsListEl = document.getElementById('assignments-list');
        const chatMessagesEl = document.getElementById('chat-messages');
        const peopleListEl = document.getElementById('people-list');
        const createAssignmentForm = document.getElementById('create-assignment-form-section');
        const deleteClassBtn = document.getElementById('delete-class-btn');
        const deleteClassModal = document.getElementById('delete-class-modal');
        const confirmDeleteClassBtn = document.getElementById('confirm-delete-class-btn');
        const cancelDeleteClassBtn = document.getElementById('cancel-delete-class-btn');
        const settingsTabBtn = document.getElementById('settings-btn');
        const assignmentsTabBtn = document.getElementById('assignments-btn');
        const peopleTabBtn = document.getElementById('people-btn');
        const chatTabBtn = document.getElementById('chat-btn');
        const assignmentStatusTabBtn = document.getElementById('assignment-status-btn');
        const removeStudentModal = document.getElementById('remove-student-modal');
        const confirmRemoveStudentBtn = document.getElementById('confirm-remove-student-btn');
        const cancelRemoveStudentBtn = document.getElementById('cancel-remove-student-btn');
        const disableChatToggle = document.getElementById('disable-chat-toggle');
        const lockChatToggle = document.getElementById('lock-chat-toggle');
        let currentStudentToRemove = null;

        // State variables
        let userId = null;
        let isUserBanned = false;
        let isClassOwner = false;
        let chatDisabled = false;
        let chatLocked = false;

        function showMessage(message, isError = false) {
            messageBox.textContent = message;
            messageBox.className = `p-3 my-4 text-sm rounded-lg ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} transition-all duration-300 transform scale-100`;
            
            setTimeout(() => {
                messageBox.textContent = '';
                messageBox.className = 'transition-all duration-300 transform scale-0 h-0';
            }, 3000);
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(`${tabName}-section`).classList.remove('hidden');
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active', 'bg-gray-200'));
            document.getElementById(`${tabName}-btn`).classList.add('active', 'bg-gray-200');

            if (tabName === 'assignment-status') {
                displayAssignmentStatus();
            }
        }

        async function handleSignOut() {
            try {
                await signOut(auth);
                window.location.href = '/';
            } catch (error) {
                console.error("Sign-out error:", error);
                showMessage(`Sign-out failed: ${error.message}`, true);
            }
        }

        function displayAssignments(assignments, submissions) {
            assignmentsListEl.innerHTML = '';
            if (assignments.length === 0) {
                assignmentsListEl.innerHTML = '<p class="text-gray-500">No assignments posted yet.</p>';
            }
            assignments.forEach(assignment => {
                const isSubmitted = submissions.some(sub => sub.id === assignment.id);
                const assignmentCard = document.createElement('div');
                assignmentCard.className = 'bg-white p-6 rounded-lg shadow-md mb-4';
                assignmentCard.innerHTML = `
                    <h3 class="text-lg font-semibold text-gray-800">${assignment.title}</h3>
                    <p class="text-gray-600 my-2">${assignment.description}</p>
                    <p class="text-sm text-gray-500">Due: ${new Date(assignment.dueDate).toLocaleDateString()}</p>
                    <div class="mt-4 flex space-x-2">
                        <button class="submit-btn px-4 py-2 text-white text-sm rounded-lg shadow-md transition-colors ${isSubmitted ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'}">
                            ${isSubmitted ? 'Unmark as Done' : 'Mark as Done'}
                        </button>
                    </div>
                `;

                if (isClassOwner) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn px-4 py-2 bg-red-500 text-white text-sm rounded-lg shadow-md hover:bg-red-600 transition-colors';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.addEventListener('click', async () => {
                        try {
                            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId, 'assignments', assignment.id));
                            showMessage('Assignment deleted.');
                        } catch (error) {
                            console.error("Error deleting assignment:", error);
                            showMessage("Failed to delete assignment.", true);
                        }
                    });
                    assignmentCard.querySelector('div').appendChild(deleteBtn);
                }

                assignmentCard.querySelector('.submit-btn').addEventListener('click', async () => {
                    const submissionsRef = doc(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId, 'assignments', assignment.id, 'submissions', userId);
                    try {
                        if (isSubmitted) {
                            await deleteDoc(submissionsRef);
                            showMessage('Assignment unmarked!');
                        } else {
                            await setDoc(submissionsRef, {
                                userId: userId,
                                timestamp: Date.now()
                            });
                            showMessage('Assignment marked as done!');
                        }
                    } catch (error) {
                        console.error("Error updating assignment status:", error);
                        showMessage("Failed to update assignment status.", true);
                    }
                });
                assignmentsListEl.appendChild(assignmentCard);
            });
        }

        function displayChat(messages) {
            chatMessagesEl.innerHTML = '';
            messages.forEach(msg => {
                const isUser = msg.senderId === userId;
                const messageEl = document.createElement('div');
                messageEl.className = `p-3 rounded-lg shadow-sm max-w-xs mb-2 break-words ${isUser ? 'bg-blue-500 text-white self-end' : 'bg-gray-200 text-gray-800 self-start'}`;
                messageEl.textContent = `${msg.senderName}: ${msg.message}`;
                chatMessagesEl.appendChild(messageEl);
            });
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }

        function displayPeople(members, creatorId) {
            peopleListEl.innerHTML = '';
            members.forEach(member => {
                const isTeacher = member.userId === creatorId;
                const isBanned = member.isBanned;
                const memberCard = document.createElement('div');
                memberCard.className = `flex items-center space-x-4 bg-white p-4 rounded-lg shadow-md ${isBanned ? 'bg-gray-200 opacity-50' : ''}`;
                memberCard.innerHTML = `
                    <img src="${member.photoURL}" alt="${member.displayName}" class="w-10 h-10 rounded-full">
                    <div class="flex-1">
                        <p class="font-semibold text-gray-800">${member.displayName}</p>
                        <p class="text-sm text-gray-500">${isTeacher ? 'Teacher' : 'Student'}${isBanned ? ' (Banned)' : ''}</p>
                    </div>
                `;

                if (isClassOwner && !isTeacher && !isBanned) {
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors';
                    removeBtn.textContent = 'Remove';
                    removeBtn.addEventListener('click', () => {
                        currentStudentToRemove = member.userId;
                        removeStudentModal.classList.remove('hidden');
                    });
                    memberCard.appendChild(removeBtn);
                }
                peopleListEl.appendChild(memberCard);
            });
        }

        async function removeStudent() {
            if (!currentStudentToRemove || !activeClassId) return;
            const memberRef = doc(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId, 'members', currentStudentToRemove);
            try {
                await deleteDoc(memberRef);
                showMessage('Student removed successfully.');
            } catch (error) {
                console.error("Error removing student:", error);
                showMessage("Failed to remove student.", true);
            } finally {
                currentStudentToRemove = null;
                removeStudentModal.classList.add('hidden');
            }
        }

        async function displayAssignmentStatus() {
            if (!isClassOwner) return;

            const assignmentStatusTableBody = document.getElementById('assignment-status-table-body');
            const assignmentStatusTableHead = document.getElementById('assignment-status-table-head');
            assignmentStatusTableBody.innerHTML = '';
            assignmentStatusTableHead.innerHTML = `<th class="px-4 py-2 text-left">Student</th>`;

            const assignmentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId, 'assignments');
            const membersRef = collection(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId, 'members');

            try {
                const [assignmentsSnapshot, membersSnapshot] = await Promise.all([
                    getDocs(assignmentsRef),
                    getDocs(membersRef)
                ]);

                const assignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
                const members = await Promise.all(membersSnapshot.docs.map(async (memberDoc) => {
                    const memberData = memberDoc.data();
                    const userRef = doc(db, 'artifacts', appId, 'users', memberData.userId);
                    const userDoc = await getDoc(userRef);
                    return { ...memberData, isBanned: userDoc.exists() ? userDoc.data().isBanned || false : false };
                }));

                assignments.forEach(assignment => {
                    const th = document.createElement('th');
                    th.className = 'px-4 py-2 text-center';
                    th.textContent = assignment.title;
                    assignmentStatusTableHead.appendChild(th);
                });

                for (const member of members) {
                    if (member.isBanned) continue;
                    const row = document.createElement('tr');
                    row.className = 'border-b border-gray-200';
                    row.innerHTML = `<td class="px-4 py-2">${member.displayName}</td>`;

                    for (const assignment of assignments) {
                        const submissionRef = doc(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId, 'assignments', assignment.id, 'submissions', member.userId);
                        const submissionDoc = await getDoc(submissionRef);
                        const status = submissionDoc.exists() ? '✅' : '❌';
                        row.innerHTML += `<td class="px-4 py-2 text-center">${status}</td>`;
                    }
                    assignmentStatusTableBody.appendChild(row);
                }
            } catch (error) {
                console.error("Error fetching assignment status:", error);
                assignmentStatusTableBody.innerHTML = '<tr><td colspan="100%" class="px-4 py-4 text-center text-gray-500">Failed to load assignment status.</td></tr>';
                showMessage("Failed to load assignment status.", true);
            }
        }

        async function setupClassListeners(classId) {
            const classDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'classes', classId));
            const classData = classDoc.exists() ? classDoc.data() : null;
            if (!classData) {
                showMessage("Class not found or no longer exists.", true);
                return;
            }
            const creatorId = classData.creatorId;
            const isOwner = creatorId === userId;
            isClassOwner = isOwner;
            document.getElementById('current-class-title').textContent = classData.title;

            if (isOwner) {
                disableChatToggle.checked = classData?.chatDisabled || false;
                lockChatToggle.checked = classData?.chatLocked || false;
                disableChatToggle.disabled = false;
                lockChatToggle.disabled = false;
            } else {
                disableChatToggle.disabled = true;
                lockChatToggle.disabled = true;
            }

            chatDisabled = classData?.chatDisabled || false;
            chatLocked = classData?.chatLocked || false;

            updateChatUI();
            updateTeacherUI();
            switchTab('assignments');

            onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'classes', classId, 'assignments'), async (assignmentsSnapshot) => {
                const assignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const submissions = (await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'classes', classId, 'assignments'), where('submissions.' + userId, '==', true)))).docs.map(doc => ({id: doc.id}));
                displayAssignments(assignments, submissions);
            }, (error) => {
                console.error("Error listening to assignments:", error);
                showMessage("Error loading assignments.", true);
            });
            
            onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'classes', classId), (docSnapshot) => {
                const data = docSnapshot.data();
                if (data) {
                    chatDisabled = data.chatDisabled || false;
                    chatLocked = data.chatLocked || false;
                    updateChatUI();
                }
            });

            onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'classes', classId, 'chat'), (snapshot) => {
                const messages = snapshot.docs.map(doc => doc.data()).sort((a, b) => a.timestamp - b.timestamp);
                displayChat(messages);
            }, (error) => {
                console.error("Error listening to chat:", error);
                showMessage("Error loading chat.", true);
            });

            onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'classes', classId, 'members'), async (snapshot) => {
                const members = await Promise.all(snapshot.docs.map(async (memberDoc) => {
                    const memberData = memberDoc.data();
                    const userRef = doc(db, 'artifacts', appId, 'users', memberData.userId);
                    const userDoc = await getDoc(userRef);
                    return { ...memberData, isBanned: userDoc.exists() ? userDoc.data().isBanned || false : false };
                }));
                displayPeople(members, creatorId);
            }, (error) => {
                console.error("Error listening to members:", error);
                showMessage("Error loading class members.", true);
            });
        }

        function updateChatUI() {
            if (chatDisabled) {
                chatTabBtn.classList.add('hidden');
                document.getElementById('chat-section').classList.add('hidden');
            } else {
                chatTabBtn.classList.remove('hidden');
            }
            if (chatLocked && !isClassOwner) {
                document.getElementById('chat-form').classList.add('hidden');
            } else {
                document.getElementById('chat-form').classList.remove('hidden');
            }
        }

        function updateTeacherUI() {
            if (isClassOwner && !isUserBanned) {
                createAssignmentForm.classList.remove('hidden');
                settingsTabBtn.classList.remove('hidden');
                assignmentStatusTabBtn.classList.remove('hidden');
            } else {
                createAssignmentForm.classList.add('hidden');
                settingsTabBtn.classList.add('hidden');
                assignmentStatusTabBtn.classList.add('hidden');
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
             onAuthStateChanged(auth, async (user) => {
                if (user) {
                    userId = user.uid;
                    const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        isUserBanned = userDoc.data().isBanned || false;
                    } else {
                        await setDoc(userDocRef, {
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            isBanned: false,
                            createdAt: Date.now()
                        });
                        isUserBanned = false;
                    }
                    if (isUserBanned) {
                        await signOut(auth);
                        showMessage('You have been banned.', true);
                        return;
                    }
                    userStatusEl.textContent = user.displayName;
                    userPhotoEl.src = user.photoURL;
                    userPhotoEl.classList.remove('hidden');
                    setupClassListeners(activeClassId);
                } else {
                    showMessage('Please sign in to view this class.', true);
                    setTimeout(() => window.location.href = '/', 2000);
                }
            });
        });

        assignmentsTabBtn.addEventListener('click', () => switchTab('assignments'));
        chatTabBtn.addEventListener('click', () => switchTab('chat'));
        peopleTabBtn.addEventListener('click', () => switchTab('people'));
        settingsTabBtn.addEventListener('click', () => switchTab('settings'));
        assignmentStatusTabBtn.addEventListener('click', () => switchTab('assignment-status'));
        document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
        document.getElementById('back-to-classes-btn').addEventListener('click', () => window.location.href = '/');
        
        document.getElementById('create-assignment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeClassId) return showMessage('Class ID not found.', true);

            const assignmentTitle = document.getElementById('assignment-title-input').value;
            const assignmentDesc = document.getElementById('assignment-desc-input').value;
            const assignmentDueDate = document.getElementById('assignment-due-date-input').value;

            if (!assignmentTitle || !assignmentDesc || !assignmentDueDate) {
                return showMessage('All assignment fields are required.', true);
            }

            const assignmentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId, 'assignments');
            try {
                await addDoc(assignmentsRef, {
                    title: assignmentTitle,
                    description: assignmentDesc,
                    dueDate: new Date(assignmentDueDate).getTime(),
                    creatorId: userId,
                    createdAt: Date.now()
                });
                showMessage('Assignment posted successfully!');
                e.target.reset();
            } catch (error) {
                console.error("Error posting assignment:", error);
                showMessage("Failed to post assignment.", true);
            }
        });

        document.getElementById('chat-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const messageInput = document.getElementById('message-input');
            const messageText = messageInput.value.trim();

            if (!messageText || !activeClassId || (chatLocked && !isClassOwner)) return;

            const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId, 'chat');
            try {
                await addDoc(chatRef, {
                    senderId: userId,
                    senderName: auth.currentUser.displayName,
                    message: messageText,
                    timestamp: Date.now()
                });
                messageInput.value = '';
            } catch (error) {
                console.error("Error sending message:", error);
                showMessage("Failed to send message.", true);
            }
        });

        deleteClassBtn.addEventListener('click', () => { deleteClassModal.classList.remove('hidden'); });
        cancelDeleteClassBtn.addEventListener('click', () => { deleteClassModal.classList.add('hidden'); });
        confirmDeleteClassBtn.addEventListener('click', async () => {
            deleteClassModal.classList.add('hidden');
            try {
                const batch = writeBatch(db);
                const classRef = doc(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId);

                const assignmentsSnapshot = await getDocs(collection(classRef, 'assignments'));
                assignmentsSnapshot.forEach(doc => batch.delete(doc.ref));
                const chatSnapshot = await getDocs(collection(classRef, 'chat'));
                chatSnapshot.forEach(doc => batch.delete(doc.ref));
                const membersSnapshot = await getDocs(collection(classRef, 'members'));
                membersSnapshot.forEach(doc => batch.delete(doc.ref));
                batch.delete(classRef);
                await batch.commit();
                showMessage('Class and all its data have been deleted.');
                setTimeout(() => window.location.href = '/', 2000);
            } catch (error) {
                console.error("Error deleting class:", error);
                showMessage("Failed to delete class.", true);
            }
        });

        confirmRemoveStudentBtn.addEventListener('click', removeStudent);
        cancelRemoveStudentBtn.addEventListener('click', () => {
            currentStudentToRemove = null;
            removeStudentModal.classList.add('hidden');
        });

        disableChatToggle.addEventListener('change', async (e) => {
            if (!activeClassId) return;
            const classRef = doc(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId);
            try {
                await updateDoc(classRef, { chatDisabled: e.target.checked });
                showMessage(`Chat has been ${e.target.checked ? 'disabled' : 'enabled'}.`);
            } catch (error) {
                console.error("Error updating chat settings:", error);
                showMessage("Failed to update chat settings.", true);
            }
        });

        lockChatToggle.addEventListener('change', async (e) => {
            if (!activeClassId) return;
            const classRef = doc(db, 'artifacts', appId, 'public', 'data', 'classes', activeClassId);
            try {
                await updateDoc(classRef, { chatLocked: e.target.checked });
                showMessage(`Chat has been ${e.target.checked ? 'locked' : 'unlocked'}.`);
            } catch (error) {
                console.error("Error updating chat settings:", error);
                showMessage("Failed to update chat settings.", true);
            }
        });
    </script>
</body>
</html>
`;

module.exports = async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).send('Classroom ID is required.');
    }

    try {
        const db = getFirestore();
        const classRef = db.collection('artifacts').doc('default-app-id').collection('public').doc('data').collection('classes').doc(id);
        const classDoc = await classRef.get();

        if (!classDoc.exists) {
            return res.status(404).send('Classroom not found.');
        }

        // Send the full HTML template as the response
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(classroomHtmlTemplate(id));

    } catch (error) {
        console.error('Error serving classroom page:', error);
        res.status(500).send('Internal Server Error.');
    }
};

