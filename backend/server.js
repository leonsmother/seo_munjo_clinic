const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');          // ADDED: for serving the frontend
const pool = require('./db');          // ADDED: Postgres connection from db.js

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

// ADDED: serve the frontend (public/ is mounted into the container by docker-compose)
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

// REMOVED: the in-memory "appointments" array and nextAppointmentId
// (appointments now live in Postgres)


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


/* Ghada: the db wasnt working so i tweaked the code a bit */

 
const APPT_SELECT = `
    SELECT a.id, a.patient_id AS "patientId", p.name, p.phone, a.service,
           to_char(a.appointment_date, 'YYYY-MM-DD') AS date,
           to_char(a.appointment_date, 'HH12:MI AM') AS time
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id`;

app.get('/api/patients/:id/appointments', requireLogin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `${APPT_SELECT} WHERE a.patient_id = $1 ORDER BY a.appointment_date`,
            [parseInt(req.params.id)]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});


app.get('/api/appointments', async (req, res) => {
    try {
        const { rows } = await pool.query(`${APPT_SELECT} ORDER BY a.appointment_date`);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/appointments', async (req, res) => {
    const { name, phone, service, date, time } = req.body;

    if (!name || !phone || !service || !date || !time) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        // Reuse the patient if the phone number is already known, otherwise create one
        let patient = (await pool.query('SELECT id FROM patients WHERE phone = $1', [phone])).rows[0];
        if (!patient) {
            patient = (await pool.query(
                'INSERT INTO patients (name, phone) VALUES ($1, $2) RETURNING id',
                [name, phone]
            )).rows[0];
        }

        const inserted = await pool.query(
            `INSERT INTO appointments (patient_id, service, appointment_date)
             VALUES ($1, $2, $3::date + $4::time) RETURNING id`,
            [patient.id, service, date, time]
        );

        const { rows } = await pool.query(`${APPT_SELECT} WHERE a.id = $1`, [inserted.rows[0].id]);
        res.status(201).json({ message: 'Appointment booked successfully!', appointment: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Could not book appointment. Check the date and time format.' });
    }
});

app.get('/api/appointments/:id', requireLogin, async (req, res) => {
    try {
        const { rows } = await pool.query(`${APPT_SELECT} WHERE a.id = $1`, [parseInt(req.params.id)]);
        if (!rows[0]) return res.status(404).json({ error: 'Appointment not found.' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});


app.delete('/api/appointments/:id', requireLogin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'DELETE FROM appointments WHERE id = $1 RETURNING id',
            [parseInt(req.params.id)]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Appointment not found.' });
        res.json({ message: 'Appointment deleted', id: rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
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
