document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURACIÓN ---
    // Esta es la URL de tu ÚLTIMO script de Google Apps Script que creamos desde cero.
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbytdfEwfk7tkmXKNVWeAJnsKXeQtc1EflxguAmHoH20awgaQzpPccpmzkxFuIiGxhm3/exec';
    
    // En una PWA, no tenemos un shortcode. La forma moderna de saber qué propiedad mostrar
    // es a través de un parámetro en la URL, por ejemplo: index.html?propiedad=DEPTO01
    const params = new URLSearchParams(window.location.search);
    const propiedadId = params.get('propiedad') || 'LMB101'; // Usamos DEPTO01 si no se especifica
    
    // --- FIN DE LA CONFIGURACIÓN ---
  
    let currentDate = new Date();
    let occupiedDates = [];
    let selection = { checkIn: null, checkOut: null };
    let currentPrice = 0;
  
    // ... (El resto de las constantes para los elementos del DOM son las mismas)
    const monthYearEl = document.getElementById('monthYear');
    const calendarDaysEl = document.getElementById('calendarDays');
    // etc...

    // Esta función es nueva: Obtiene el nombre de la propiedad para mostrarlo
    async function fetchPropiedadInfo() {
        // Por ahora, usamos un nombre de ejemplo. Más adelante, podemos hacer que esto
        // también lo traiga desde la Hoja de Cálculo de Google.
        const nombresPropiedades = {
            'DEPTO01': 'Departamento "El Cielo"',
            'DEPTO02': 'Departamento "La Arena"',
            'DEPTO03': 'Departamento "El Mar"'
        };
        document.getElementById('propiedadNombre').textContent = nombresPropiedades[propiedadId] || 'Propiedad no encontrada';
    }

    async function fetchOccupiedDates() {
        // En el último paso, cuando despleguemos en Netlify, crearemos un "proxy"
        // y cambiaremos esta URL a una local, como '/api/reservas'.
        // Por ahora, la dejamos apuntando directamente para futuras pruebas.
        const url = `${GOOGLE_SCRIPT_URL}?action=getAvailability&propiedadId=${propiedadId}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error de red al obtener disponibilidad.');
            const data = await response.json();
            if (data.status === 'success') {
                occupiedDates = data.ocupados;
                renderCalendar(currentDate);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error en fetchOccupiedDates:', error);
            // Mostramos un error más genérico, ya que el problema de Hostinger ya no existe.
            document.getElementById('bookingMessage').textContent = 'No se pudo cargar la disponibilidad. Intenta de nuevo más tarde.';
            document.getElementById('bookingMessage').style.display = 'block';
        }
    }
    
    // --- IMPORTANTE ---
    // Pega aquí el resto de las funciones que ya teníamos (sin cambios en su lógica interna):
    // - renderCalendar(date)
    // - handleDayClick(cell)
    // - updatePrice()
    // - validateForm()
    // - hideMessages()
    // - submitBooking()
    // Y también los Event Listeners. El código es exactamente el mismo que el de la versión del plugin.
    // Lo incluyo todo abajo para que no tengas que buscarlo.
    const customerNameEl = document.getElementById('customerName');
    const customerEmailEl = document.getElementById('customerEmail');
    const customerPhoneEl = document.getElementById('customerPhone'); 
    const submitBookingBtn = document.getElementById('submitBooking');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const priceSummaryEl = document.getElementById('priceSummary');
    const priceLoaderEl = document.getElementById('priceLoader');
    const summaryCheckInEl = document.getElementById('summaryCheckIn');
    const summaryCheckOutEl = document.getElementById('summaryCheckOut');
    const summaryNightsEl = document.getElementById('summaryNights');
    const summaryTotalEl = document.getElementById('summaryTotal');
    const bookingFormEl = document.getElementById('bookingForm');
    const bookingMessageEl = document.getElementById('bookingMessage');
    function formatDate(date) { if (!date) return ''; return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }); }
    function toISODateString(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
    function renderCalendar(date) { calendarDaysEl.innerHTML = ''; const month = date.getMonth(); const year = date.getFullYear(); monthYearEl.textContent = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); const firstDayOfMonth = new Date(year, month, 1); const lastDayOfMonth = new Date(year, month + 1, 0); const startDayOfWeek = firstDayOfMonth.getDay(); for (let i = 0; i < startDayOfWeek; i++) { calendarDaysEl.insertAdjacentHTML('beforeend', '<div class="calendar-day empty"></div>'); } for (let day = 1; day <= lastDayOfMonth.getDate(); day++) { const dayCell = document.createElement('div'); const dayDate = new Date(year, month, day); const isoDate = toISODateString(dayDate); const classes = ['calendar-day']; const todayISO = toISODateString(new Date()); if (isoDate === todayISO) classes.push('today'); if (occupiedDates.includes(isoDate) || dayDate < new Date().setHours(0,0,0,0)) { classes.push('occupied'); } else { dayCell.addEventListener('click', () => handleDayClick(dayCell)); } if (selection.checkIn && isoDate === toISODateString(selection.checkIn)) classes.push('selected'); if (selection.checkOut && isoDate === toISODateString(selection.checkOut)) classes.push('selected'); if (selection.checkIn && selection.checkOut && dayDate > selection.checkIn && dayDate < selection.checkOut) classes.push('selected'); dayCell.className = classes.join(' '); dayCell.textContent = day; dayCell.dataset.date = isoDate; calendarDaysEl.appendChild(dayCell); } }
    async function handleDayClick(cell) { const clickedDate = new Date(cell.dataset.date + 'T12:00:00Z'); hideMessages(); if (!selection.checkIn || (selection.checkIn && selection.checkOut)) { selection = { checkIn: clickedDate, checkOut: null }; priceSummaryEl.style.display = 'none'; bookingFormEl.style.display = 'none'; } else { if (clickedDate <= selection.checkIn) { selection = { checkIn: clickedDate, checkOut: null }; } else { let validRange = true; let tempDate = new Date(selection.checkIn); tempDate.setDate(tempDate.getDate() + 1); while (tempDate < clickedDate) { if (occupiedDates.includes(toISODateString(tempDate))) { validRange = false; break; } tempDate.setDate(tempDate.getDate() + 1); } if (validRange) { selection.checkOut = clickedDate; await updatePrice(); } else { alert('El rango seleccionado contiene días no disponibles.'); selection = { checkIn: null, checkOut: null }; priceSummaryEl.style.display = 'none'; bookingFormEl.style.display = 'none'; } } } renderCalendar(currentDate); }
    async function updatePrice() { if (!selection.checkIn || !selection.checkOut) return; priceLoaderEl.style.display = 'block'; priceSummaryEl.style.display = 'none'; bookingFormEl.style.display = 'none'; const checkInStr = toISODateString(selection.checkIn); const checkOutStr = toISODateString(selection.checkOut); try { const url = `${GOOGLE_SCRIPT_URL}?action=calculatePrice&propiedadId=${propiedadId}&checkIn=${checkInStr}&checkOut=${checkOutStr}`; const response = await fetch(url); if (!response.ok) throw new Error(`Network response was not ok`); const data = await response.json(); priceLoaderEl.style.display = 'none'; if (data.status === 'success') { summaryCheckInEl.textContent = formatDate(selection.checkIn); summaryCheckOutEl.textContent = formatDate(selection.checkOut); summaryNightsEl.textContent = data.numberOfNights; summaryTotalEl.textContent = `$${data.totalPrice.toLocaleString('es-MX')} MXN`; currentPrice = data.totalPrice; priceSummaryEl.style.display = 'block'; bookingFormEl.style.display = 'block'; } else { throw new Error(data.message); } } catch (error) { priceLoaderEl.style.display = 'none'; bookingMessageEl.textContent = `Error al calcular precio: ${error.message}`; bookingMessageEl.className = 'booking-message error'; bookingMessageEl.style.display = 'block'; } }
    function validateForm() { const nameValid = customerNameEl.value.trim() !== ''; const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmailEl.value); const phoneValid = /^\d{10}$/.test(customerPhoneEl.value.trim()); submitBookingBtn.disabled = !(nameValid && emailValid && phoneValid); }
    function hideMessages() { bookingMessageEl.style.display = 'none'; }
    async function submitBooking() { submitBookingBtn.disabled = true; submitBookingBtn.textContent = 'Procesando...'; const bookingData = { propiedadId: propiedadId, nombre: customerNameEl.value.trim(), email: customerEmailEl.value.trim(), celular: customerPhoneEl.value.trim(), checkIn: toISODateString(selection.checkIn), checkOut: toISODateString(selection.checkOut), totalPrice: currentPrice }; try { const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(bookingData), headers: {'Content-Type': 'text/plain;charset=utf-8'} }); /* En 'no-cors' no podemos leer la respuesta, así que asumimos éxito si no hay error de red */ bookingMessageEl.textContent = '¡Gracias! Tu solicitud de reserva ha sido enviada. Te contactaremos pronto para confirmar.'; bookingMessageEl.className = 'booking-message success'; bookingFormEl.style.display = 'none'; priceSummaryEl.style.display = 'none'; selection = { checkIn: null, checkOut: null }; await fetchOccupiedDates(); } catch (error) { bookingMessageEl.textContent = `Error: ${error.message}`; bookingMessageEl.className = 'booking-message error'; submitBookingBtn.disabled = false; } finally { bookingMessageEl.style.display = 'block'; submitBookingBtn.textContent = 'Confirmar Reserva'; } }
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate); });
    customerNameEl.addEventListener('input', validateForm);
    customerEmailEl.addEventListener('input', validateForm);
    customerPhoneEl.addEventListener('input', validateForm);
    submitBookingBtn.addEventListener('click', submitBooking);

    // Iniciar la app
    fetchPropiedadInfo();
    fetchOccupiedDates();
});