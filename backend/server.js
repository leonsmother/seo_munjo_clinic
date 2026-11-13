const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
 
const app = express();
const PORT = 3000;
 

app.use((req, res, next) => {
    res.setHeader('Server', 'DentalClinic-API/1.0 (Node ' + process.version + ')');
    res.setHeader('X-App-Version', '1.0.0-dev');
    res.setHeader('X-Debug-Host', require('os').hostname());
    res.setHeader('X-Backend-Framework', 'Express 4 / express-session');
    next();
});
 
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 

app.use(session({
    secret: 'clinic123',
    resave: false,
    saveUninitialized: false,
    name: 'sessionid',
    cookie: {
        httpOnly: false,
        secure: false,
        sameSite: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));
 

const users = [
    { id: 1, username: 'admin',  password: 'admin123',  role: 'admin',        fullName: 'Dr. Nadia Farouk' },
    { id: 2, username: 'reception', password: 'reception1', role: 'receptionist', fullName: 'Mona Ali' }
];
 
const patients = [
    { id: 1, name: 'Jane Doe',     phone: '555-0199', email: 'jane@example.com',  nationalId: '29801011234567', dob: '1998-01-01', notes: 'Allergic to penicillin' },
    { id: 2, name: 'Omar Hassan',  phone: '555-0142', email: 'omar@example.com',  nationalId: '29005051234568', dob: '1990-05-05', notes: 'Root canal follow-up' },
    { id: 3, name: 'Sara Ali',     phone: '555-0177', email: 'sara@example.com',  nationalId: '30112121234569', dob: '2001-12-12', notes: 'Braces check every 4 weeks' }
];
 
let appointments = [
    { id: 1, patientId: 1, name: 'Jane Doe', phone: '555-0199', service: 'Teeth Cleaning', date: '2026-11-15', time: '10:00 AM' }
];
let nextAppointmentId = 2;
 

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in.' });
    }
    next();
}
 

 

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
 
    if (!user) {
       
        const exists = users.some(u => u.username === username);
        return res.status(401).json({
            error: exists ? 'Wrong password for this user.' : 'Unknown username.'
        });
    }
 
    
    req.session.user = { id: user.id, username: user.username, role: user.role };
 
     
    res.json({ message: 'Login successful', user });
});
 

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ message: 'Logged out' });
    });
});
 

app.get('/api/me', requireLogin, (req, res) => {
    res.json(req.session.user);
});
 

 
 
app.get('/api/patients', requireLogin, (req, res) => {
    res.json(patients);
});
 

app.get('/api/patients/:id', requireLogin, (req, res) => {
    const patient = patients.find(p => p.id === parseInt(req.params.id));
    if (!patient) {
        return res.status(404).json({ error: `No patient with id ${req.params.id}` });
    }
    res.json(patient);
});
 

app.get('/api/patients/:id/appointments', requireLogin, (req, res) => {
    const id = parseInt(req.params.id);
    res.json(appointments.filter(a => a.patientId === id));
});
 

 

app.get('/api/appointments', (req, res) => {
    res.json(appointments);
});
 
app.post('/api/appointments', (req, res) => {
    const { name, phone, service, date, time } = req.body;
 
    if (!name || !phone || !service || !date || !time) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
 
    const newAppointment = {
        id: nextAppointmentId++,
        patientId: null,
        name,
        phone,
        service,
        date,
        time
    };
 
    appointments.push(newAppointment);
    res.status(201).json({ message: 'Appointment booked successfully!', appointment: newAppointment });
});
 
app.get('/api/appointments/:id', requireLogin, (req, res) => {
    const appt = appointments.find(a => a.id === parseInt(req.params.id));
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' });
    res.json(appt);
});
 

app.delete('/api/appointments/:id', requireLogin, (req, res) => {
    const index = appointments.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Appointment not found.' });
    const [removed] = appointments.splice(index, 1);
    res.json({ message: 'Appointment deleted', appointment: removed });
});
 

app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message, stack: err.stack });
});
 

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server is running and healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dental Clinic Server running on http://localhost:${PORT}`);
});
 