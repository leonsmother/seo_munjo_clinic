const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory data store for appointments
let appointments = [
    { id: 1, name: "Jane Doe", phone: "555-0199", service: "Teeth Cleaning", date: "2026-11-15", time: "10:00 AM" }
];

// GET: Fetch all appointments
app.get('/api/appointments', (req, res) => {
    res.json(appointments);
});

// POST: Book a new appointment
app.post('/api/appointments', (req, res) => {
    const { name, phone, service, date, time } = req.body;
    
    if (!name || !phone || !service || !date || !time) {
        return res.status(400).json({ error: "All fields are required." });
    }

    const newAppointment = {
        id: appointments.length + 1,
        name,
        phone,
        service,
        date,
        time
    };

    appointments.push(newAppointment);
    res.status(201).json({ message: "Appointment booked successfully!", appointment: newAppointment });
});

app.listen(PORT, () => {
    console.log(`Dental Clinic Server running on http://localhost:${PORT}`);
});