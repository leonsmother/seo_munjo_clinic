const API_URL = '/api/appointments';

const form = document.getElementById('bookingForm');
const list = document.getElementById('appointmentList');
const emptyMsg = document.getElementById('listEmpty');
const listError = document.getElementById('listError');
const submitBtn = document.getElementById('submitBtn');
const formStatus = document.getElementById('formStatus');

// Don't allow booking dates in the past (local date, not UTC)
const dateInput = document.getElementById('date');
const now = new Date();
dateInput.min = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
].join('-');

// Opening hours: Saturday to Thursday, 10:00 to 20:00 (Friday closed)
const OPEN_TIME = '10:00';
const CLOSE_TIME = '20:00';
const CLOSED_DAY = 5; // Friday (Sunday is 0)

const timeInput = document.getElementById('time');
timeInput.min = OPEN_TIME;
timeInput.max = CLOSE_TIME;

dateInput.addEventListener('input', () => {
    const [y, m, d] = dateInput.value.split('-').map(Number);
    const isClosed = dateInput.value && new Date(y, m - 1, d).getDay() === CLOSED_DAY;
    dateInput.setCustomValidity(isClosed ? 'We’re closed on Fridays. Please pick another day.' : '');
});

function setStatus(message, type) {
    formStatus.textContent = message;
    formStatus.className = 'status' + (type ? ' ' + type : '');
}

// Build the list item with textContent so user input is never parsed as HTML
function renderAppointment(app) {
    const li = document.createElement('li');

    const title = document.createElement('span');
    title.className = 'appt-title';
    title.textContent = app.name;

    const service = document.createElement('span');
    service.className = 'appt-service';
    service.textContent = ' - ' + app.service;

    const meta = document.createElement('small');
    meta.className = 'appt-meta';
    meta.textContent = `📅 ${app.date} at ${app.time} | 📞 ${app.phone}`;

    li.append(title, service, meta);
    return li;
}

// Load existing appointments
async function fetchAppointments() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Bad response: ' + res.status);
        const data = await res.json();

        // Earliest first
        data.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

        list.innerHTML = '';
        data.forEach(app => list.appendChild(renderAppointment(app)));

        emptyMsg.hidden = data.length > 0;
        listError.hidden = true;
    } catch (err) {
        console.error(err);
        listError.hidden = false;
    }
}

// Handle booking form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        service: document.getElementById('service').value,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value
    };

    if (!payload.name || !payload.phone) {
        setStatus('Please enter your name and phone number.', 'error');
        return;
    }

    submitBtn.disabled = true;
    setStatus('Sending your request…');

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Bad response: ' + res.status);

        form.reset();
        setStatus('Appointment booked. We’ll call you to confirm.', 'ok');
        fetchAppointments();
    } catch (err) {
        console.error(err);
        setStatus('Couldn’t book the appointment. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
    }
});

// Initial fetch
fetchAppointments();