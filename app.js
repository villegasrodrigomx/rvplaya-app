document.addEventListener('DOMContentLoaded', function() {
    
    const API_ENDPOINT = '/.netlify/functions/engine';
    const params = new URLSearchParams(window.location.search);
    const propiedadId = params.get('propiedad');

    const homeView = document.getElementById('view-home');
    const bookingView = document.getElementById('view-booking');
    const propertyListEl = document.getElementById('property-list');

    function router() {
        if (propiedadId) {
            showBookingPage(propiedadId);
        } else {
            showHomePage();
        }
    }

    async function showHomePage() {
        homeView.style.display = 'block';
        bookingView.style.display = 'none';
        propertyListEl.innerHTML = '<p>Cargando propiedades...</p>';
        const url = `${API_ENDPOINT}?action=getProperties`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('No se pudo cargar la lista de propiedades.');
            const data = await response.json();
            if (data.status === 'success') {
                propertyListEl.innerHTML = '';
                data.properties.forEach(prop => {
                    const propertyCard = document.createElement('a');
                    propertyCard.href = `?propiedad=${prop.id}`;
                    propertyCard.className = 'property-card';
                    propertyCard.innerHTML = `<h3>${prop.nombre}</h3><p>Ver disponibilidad y reservar &rarr;</p>`;
                    propertyListEl.appendChild(propertyCard);
                });
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            propertyListEl.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    function showBookingPage(propiedadId) {
        homeView.style.display = 'none';
        bookingView.style.display = 'block';
        initializeBookingEngine(propiedadId);
    }
    
    function initializeBookingEngine(propiedadId) {
        let currentDate = new Date();
        let occupiedDates = [];
        let selection = { checkIn: null, checkOut: null };
        let currentPrice = 0;
        let hoyOficial = ''; // <-- NUEVA VARIABLE para guardar el "hoy" del servidor
    
        const monthYearEl = document.getElementById('monthYear');
        const calendarDaysEl = document.getElementById('calendarDays');
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
        const propiedadNombreEl = document.getElementById('propiedadNombre');

        async function displayPropiedadInfo() {
            const url = `${API_ENDPOINT}?action=getProperties`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                if(data.status === 'success'){
                    const prop = data.properties.find(p => p.id === propiedadId);
                    propiedadNombreEl.textContent = prop ? prop.nombre : 'Propiedad no encontrada';
                }
            } catch (e) {
                propiedadNombreEl.textContent = 'Error al cargar nombre';
            }
        }

        async function fetchOccupiedDates() {
            const cacheBuster = `&t=${new Date().getTime()}`;
            const url = `${API_ENDPOINT}?action=getAvailability&propiedadId=${propiedadId}${cacheBuster}`;
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`El servidor respondió con un error.`);
                
                const data = await response.json();
                if (data.status === 'success') {
                    occupiedDates = data.ocupados;
                    hoyOficial = data.hoy; // <-- Guardamos el "hoy" oficial
                    renderCalendar(currentDate);
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                // ... (código del catch sin cambios)
            }
        }
        
        function renderCalendar(date) { 
            calendarDaysEl.innerHTML = ''; 
            monthYearEl.textContent = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); 
            const month = date.getMonth(); 
            const year = date.getFullYear(); 
            const firstDayOfMonth = new Date(year, month, 1); 
            const lastDayOfMonth = new Date(year, month + 1, 0); 
            const startDayOfWeek = firstDayOfMonth.getDay(); 
            for (let i = 0; i < startDayOfWeek; i++) { 
                calendarDaysEl.insertAdjacentHTML('beforeend', '<div class="calendar-day empty"></div>');
            } 
            for (let day = 1; day <= lastDayOfMonth.getDate(); day++) { 
                const dayCell = document.createElement('div'); 
                const dayDate = new Date(year, month, day); 
                const isoDate = toISODateString(dayDate); 
                const classes = ['calendar-day']; 
                const todayISO = toISODateString(new Date()); 
                if (isoDate === hoyOficial) classes.push('today');
                if (occupiedDates.includes(isoDate) || isoDate < hoyOficial) {
                    classes.push('occupied');
                } else {
                    dayCell.addEventListener('click', () => handleDayClick(dayCell));
                }
                if (selection.checkIn && isoDate === toISODateString(selection.checkIn)) classes.push('selected');
                if (selection.checkOut && isoDate === toISODateString(selection.checkOut)) classes.push('selected');
                if (selection.checkIn && selection.checkOut && dayDate > selection.checkIn && dayDate < selection.checkOut) classes.push('selected');
                dayCell.className = classes.join(' ');
                dayCell.textContent = day;
                dayCell.dataset.date = isoDate;
                calendarDaysEl.appendChild(dayCell);
            }
        }
        
        async function handleDayClick(cell) { const clickedDate = new Date(cell.dataset.date + 'T12:00:00Z'); hideMessages(); if (!selection.checkIn || (selection.checkIn && selection.checkOut)) { selection = { checkIn: clickedDate, checkOut: null }; priceSummaryEl.style.display = 'none'; bookingFormEl.style.display = 'none'; } else { if (clickedDate <= selection.checkIn) { selection = { checkIn: clickedDate, checkOut: null }; } else { let validRange = true; let tempDate = new Date(selection.checkIn); tempDate.setDate(tempDate.getDate() + 1); while (tempDate < clickedDate) { if (occupiedDates.includes(toISODateString(tempDate))) { validRange = false; break; } tempDate.setDate(tempDate.getDate() + 1); } if (validRange) { selection.checkOut = clickedDate; await updatePrice(); } else { alert('El rango seleccionado contiene días no disponibles.'); selection = { checkIn: null, checkOut: null }; priceSummaryEl.style.display = 'none'; bookingFormEl.style.display = 'none'; } } } renderCalendar(currentDate); }
async function updatePrice() {
        if (!selection.checkIn || !selection.checkOut) return;
        
        priceLoaderEl.style.display = 'block';
        priceSummaryEl.style.display = 'none';
        bookingFormEl.style.display = 'none';
        
        const checkInStr = toISODateString(selection.checkIn);
        const checkOutStr = toISODateString(selection.checkOut);
        
        try {
            const url = `${API_ENDPOINT}?action=calculatePrice&propiedadId=${propiedadId}&checkIn=${checkInStr}&checkOut=${checkOutStr}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Error de red`);
            
            const data = await response.json();
            priceLoaderEl.style.display = 'none';

            if (data.status === 'success') {
                // Seleccionamos los nuevos elementos del HTML
                const summarySubtotalEl = document.getElementById('summarySubtotal');
                const summaryCleaningFeeEl = document.getElementById('summaryCleaningFee');

                // Populamos el desglose
                summaryCheckInEl.textContent = formatDate(selection.checkIn);
                summaryCheckOutEl.textContent = formatDate(selection.checkOut);
                summaryNightsEl.textContent = data.numberOfNights;
                summarySubtotalEl.textContent = `$${data.subtotal.toLocaleString('es-MX')} MXN`;
                summaryCleaningFeeEl.textContent = `$${data.cleaningFee.toLocaleString('es-MX')} MXN`;
                summaryTotalEl.textContent = `$${data.totalPrice.toLocaleString('es-MX')} MXN`;

                currentPrice = data.totalPrice;
                priceSummaryEl.style.display = 'block';
                bookingFormEl.style.display = 'block';
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            priceLoaderEl.style.display = 'none';
            bookingMessageEl.textContent = `Error al calcular precio: ${error.message}`;
            bookingMessageEl.className = 'booking-message error';
            bookingMessageEl.style.display = 'block';
        }
    }
        
        async function submitBooking() { submitBookingBtn.disabled = true; submitBookingBtn.textContent = 'Procesando...'; const bookingData = { propiedadId: propiedadId, nombre: customerNameEl.value.trim(), email: customerEmailEl.value.trim(), celular: customerPhoneEl.value.trim(), checkIn: toISODateString(selection.checkIn), checkOut: toISODateString(selection.checkOut), totalPrice: currentPrice }; try { const response = await fetch(API_ENDPOINT, { method: 'POST', body: JSON.stringify(bookingData), headers: { 'Content-Type': 'application/json' } }); if (!response.ok) { const errorResult = await response.json().catch(() => ({ message: 'Error en el servidor.' })); throw new Error(errorResult.message); } const result = await response.json(); if (result.status === 'success') { bookingMessageEl.textContent = '¡Reserva confirmada con éxito! Gracias.'; bookingMessageEl.className = 'booking-message success'; bookingFormEl.style.display = 'none'; priceSummaryEl.style.display = 'none'; selection = { checkIn: null, checkOut: null }; await fetchOccupiedDates(); } else { throw new Error(result.message); } } catch (error) { bookingMessageEl.textContent = `Error: ${error.message}`; bookingMessageEl.className = 'booking-message error'; submitBookingBtn.disabled = false; } finally { bookingMessageEl.style.display = 'block'; submitBookingBtn.textContent = 'Confirmar Reserva'; } }
        function validateForm() { const nameValid = customerNameEl.value.trim() !== ''; const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmailEl.value); const phoneValid = /^\d{10}$/.test(customerPhoneEl.value.trim()); submitBookingBtn.disabled = !(nameValid && emailValid && phoneValid); }
        function hideMessages() { bookingMessageEl.style.display = 'none'; }
        function formatDate(date) { if (!date) return ''; return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }); }
        function toISODateString(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }

        prevMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate); };
        nextMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate); };
        customerNameEl.oninput = validateForm;
        customerEmailEl.oninput = validateForm;
        customerPhoneEl.oninput = validateForm;
        submitBookingBtn.onclick = submitBooking;

        displayPropiedadInfo();
        fetchOccupiedDates();
    }
    router();
});
