const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { uid } = require('uid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// 🚀 In-memory "database" to replace Firebase
const db = {
    // Storing users with email and password
    users: {
        'testuser@example.com': { id: uid(16), email: 'testuser@example.com', password: 'password123', displayName: 'Test User', photoURL: 'https://via.placeholder.com/150', isBanned: false },
    },
    classes: {},
    sessions: {},
};

// Helper function for session management
const authMiddleware = (req, res, next) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId || !db.sessions[sessionId]) {
        return res.status(401).send('Unauthorized');
    }
    req.user = db.sessions[sessionId].user;
    next();
};

// 🗺️ API Routes
// --- User Authentication ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = Object.values(db.users).find(u => u.email === email);
    
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const sessionId = uid(24);
    db.sessions[sessionId] = { user: user };
    
    res.cookie('sessionId', sessionId, { httpOnly: true, sameSite: 'Strict' });
    res.status(200).json({ message: 'Login successful' });
});

app.post('/api/signup', (req, res) => {
    const { displayName, email, password } = req.body;

    if (Object.values(db.users).find(u => u.email === email)) {
        return res.status(409).json({ error: 'Email already exists' });
    }
    
    const userId = uid(16);
    const newUser = { id: userId, displayName, email, password, photoURL: 'https://via.placeholder.com/150', isBanned: false };
    db.users[userId] = newUser;

    const sessionId = uid(24);
    db.sessions[sessionId] = { user: newUser };
    
    res.cookie('sessionId', sessionId, { httpOnly: true, sameSite: 'Strict' });
    res.status(201).json({ message: 'Sign up successful' });
});

app.post('/api/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId && db.sessions[sessionId]) {
        delete db.sessions[sessionId];
    }
    res.clearCookie('sessionId');
    res.status(200).json({ message: 'Logged out successfully' });
});

app.get('/api/user', authMiddleware, (req, res) => {
    res.status(200).json({ user: req.user });
});

// --- Class Management ---
app.post('/api/createClass', authMiddleware, (req, res) => {
    const { title } = req.body;
    const user = req.user;
    const classId = uid(12);

    db.classes[classId] = {
        id: classId,
        title,
        creatorId: user.id,
        creatorName: user.displayName,
        createdAt: Date.now(),
        chatDisabled: false,
        chatLocked: false,
        members: {
            [user.id]: { userId: user.id, displayName: user.displayName, photoURL: user.photoURL },
        },
        assignments: {},
        chat: [],
    };

    res.status(201).json({ classId, message: 'Class created successfully' });
});

app.post('/api/joinClass', authMiddleware, (req, res) => {
    const { classId } = req.body;
    const user = req.user;

    const classroom = db.classes[classId];
    if (!classroom) {
        return res.status(404).json({ error: 'Class not found' });
    }

    if (classroom.members[user.id]) {
        return res.status(200).json({ message: 'Already a member' });
    }

    classroom.members[user.id] = { userId: user.id, displayName: user.displayName, photoURL: user.photoURL };
    res.status(200).json({ message: 'Successfully joined class' });
});

app.get('/api/classes', (req, res) => {
    res.status(200).json({ classes: Object.values(db.classes) });
});

// 🖼️ Dynamic HTML Rendering
app.get('/classroom/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'classroom.html'));
});

// --- Classroom Data Endpoints ---
app.get('/api/classroom/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const classroom = db.classes[id];
    if (!classroom) {
        return res.status(404).json({ error: 'Class not found' });
    }
    const isOwner = classroom.creatorId === req.user.id;
    res.status(200).json({ classroom, isOwner });
});

app.post('/api/classroom/:id/assignments', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;
    const user = req.user;
    const classroom = db.classes[id];

    if (!classroom || classroom.creatorId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const assignmentId = uid(10);
    classroom.assignments[assignmentId] = {
        id: assignmentId,
        title,
        description,
        dueDate,
        creatorId: user.id,
        createdAt: Date.now(),
        submissions: {}, // Submissions are now nested here
    };
    res.status(201).json({ message: 'Assignment posted successfully' });
});

app.post('/api/classroom/:id/assignments/:assignmentId/submit', authMiddleware, (req, res) => {
    const { id, assignmentId } = req.params;
    const user = req.user;
    const classroom = db.classes[id];
    const assignment = classroom?.assignments[assignmentId];

    if (!classroom || !assignment || user.id === classroom.creatorId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const isSubmitted = !!assignment.submissions[user.id];
    if (isSubmitted) {
        delete assignment.submissions[user.id];
        return res.status(200).json({ message: 'Assignment unmarked' });
    } else {
        assignment.submissions[user.id] = { userId: user.id, timestamp: Date.now() };
        return res.status(200).json({ message: 'Assignment marked as done' });
    }
});

// --- Chat Management ---
app.post('/api/classroom/:id/chat', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    const user = req.user;
    const classroom = db.classes[id];

    if (!classroom || classroom.chatDisabled || (classroom.chatLocked && classroom.creatorId !== user.id)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    classroom.chat.push({
        senderId: user.id,
        senderName: user.displayName,
        message,
        timestamp: Date.now(),
    });

    res.status(201).json({ message: 'Message sent' });
});

// --- Settings and Deletion ---
app.put('/api/classroom/:id/settings', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { chatDisabled, chatLocked } = req.body;
    const classroom = db.classes[id];

    if (!classroom || classroom.creatorId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    classroom.chatDisabled = chatDisabled ?? classroom.chatDisabled;
    classroom.chatLocked = chatLocked ?? classroom.chatLocked;

    res.status(200).json({ message: 'Settings updated' });
});

app.delete('/api/classroom/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const classroom = db.classes[id];
    if (!classroom || classroom.creatorId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    delete db.classes[id];
    res.status(200).json({ message: 'Class deleted' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
