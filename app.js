document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURACIÓN PRINCIPAL ---
    // Usamos la ruta directa configurada en netlify.toml
    const API_ENDPOINT = '/api'; 
    
    // Detectar si estamos viendo una propiedad específica o la home
    const params = new URLSearchParams(window.location.search);
    const propiedadId = params.get('propiedad');

    // Elementos de Vistas
    // Asegúrate de que en tu HTML existan estos IDs o ajusta el HTML si es necesario.
    // Si tu index.html original no tiene vistas separadas, el router ajustará la visibilidad.
    const homeView = document.getElementById('view-home') || createDummyElement();
    const bookingView = document.getElementById('view-booking') || document.querySelector('.container'); // Fallback al container principal
    const propertyListEl = document.getElementById('property-list') || createDummyElement();
    const propiedadNombreTitle = document.getElementById('propiedadNombre');

    // --- VARIABLES GLOBALES DEL CALENDARIO ---
    let currentDate = new Date();
    let occupiedDates = [];
    let selection = { checkIn: null, checkOut: null };
    let currentPrice = 0;
  
    // --- ELEMENTOS DEL DOM (Booking Engine) ---
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
    const bookingFormEl = document.getElementById('bookingForm');
    const bookingMessageEl = document.getElementById('bookingMessage');

    // Elementos del Resumen
    const summaryCheckInEl = document.getElementById('summaryCheckIn');
    const summaryCheckOutEl = document.getElementById('summaryCheckOut');
    const summaryNightsEl = document.getElementById('summaryNights');
    const summaryTotalEl = document.getElementById('summaryTotal');

    // --- INICIALIZACIÓN ---
    init();

    function init() {
        // Si hay ID de propiedad en la URL, mostramos el motor de reservas
        if (propiedadId) {
            if(homeView.id !== 'dummy') homeView.style.display = 'none';
            if(bookingView) bookingView.style.display = 'block';
            loadBookingEngine(propiedadId);
        } else {
            // Si no, intentamos mostrar la lista (si el HTML lo soporta)
            // Si tu HTML es solo el motor, cargamos una propiedad por defecto o mostramos error
            if (document.getElementById('property-list')) {
                showHomePage();
            } else {
                // Fallback para HTML simple: Cargar la primera propiedad por defecto o error
                console.log("Modo Single-Property: Cargando LMB101 por defecto o esperando parametro.");
                if(!propiedadId) {
                    // Opcional: Redirigir a una por defecto
                    // window.location.search = '?propiedad=LMB101';
                }
            }
        }
    }

    // --- LÓGICA DE LA HOME (LISTA DE PROPIEDADES) ---
    async function showHomePage() {
        homeView.style.display = 'block';
        if(bookingView) bookingView.style.display = 'none';
        propertyListEl.innerHTML = '<p>Cargando propiedades...</p>';
        
        try {
            const response = await fetch(`${API_ENDPOINT}?action=getProperties`);
            if (!response.ok) throw new Error('Error de red al cargar propiedades');
            
            // EL BACKEND DEVUELVE UN ARRAY DIRECTO: [{id:..., name:...}]
            const properties = await response.json();
            
            if (Array.isArray(properties) && properties.length > 0) {
                propertyListEl.innerHTML = '';
                properties.forEach(prop => {
                    const card = document.createElement('div');
                    card.className = 'property-card';
                    // Estilo inline básico por si no hay CSS
                    card.style.border = '1px solid #ddd';
                    card.style.padding = '15px';
                    card.style.margin = '10px 0';
                    card.style.cursor = 'pointer';
                    card.innerHTML = `<h3>${prop.name}</h3><p>Click para reservar</p>`;
                    card.onclick = () => { window.location.href = `?propiedad=${prop.id}`; };
                    propertyListEl.appendChild(card);
                });
            } else {
                propertyListEl.innerHTML = '<p>No se encontraron propiedades activas.</p>';
            }
        } catch (error) {
            console.error(error);
            propertyListEl.innerHTML = '<p>Error cargando el catálogo.</p>';
        }
    }

    // --- LÓGICA DEL MOTOR DE RESERVAS ---
    async function loadBookingEngine(id) {
        // 1. Obtener nombre de la propiedad (Opcional, cosmético)
        try {
            const res = await fetch(`${API_ENDPOINT}?action=getProperties`);
            const props = await res.json();
            const currentProp = props.find(p => p.id === id);
            if (currentProp && propiedadNombreTitle) {
                propiedadNombreTitle.textContent = currentProp.name;
            }
        } catch(e) { console.log("No se pudo cargar nombre propiedad"); }

        // 2. Renderizar Calendario
        renderCalendar(currentDate);
    }

    async function renderCalendar(date) {
        const month = date.getMonth();
        const year = date.getFullYear();

        // Actualizar UI Header
        monthYearEl.textContent = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
        calendarDaysEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Cargando disponibilidad...</div>';

        try {
            // 3. PEDIR DISPONIBILIDAD AL BACKEND
            // backend espera: action=getAvailability&propiedadId=...
            const url = `${API_ENDPOINT}?action=getAvailability&propiedadId=${propiedadId}&month=${month + 1}&year=${year}`;
            const response = await fetch(url);
            
            // EL BACKEND DEVUELVE ARRAY DIRECTO: ["2025-01-01", "2025-01-02"]
            const data = await response.json();
            
            // Validación robusta: ¿Es array?
            if (Array.isArray(data)) {
                occupiedDates = data;
            } else if (data.occupiedDates) {
                // Soporte retroactivo por si acaso
                occupiedDates = data.occupiedDates;
            } else {
                occupiedDates = [];
            }

            drawDays(month, year);

        } catch (error) {
            console.error("Error calendario:", error);
            calendarDaysEl.innerHTML = '<div style="color:red; text-align:center;">Error de conexión. Intenta recargar.</div>';
        }
    }

    function drawDays(month, year) {
        calendarDaysEl.innerHTML = '';
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0,0,0,0);

        // Espacios vacíos antes del día 1
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            calendarDaysEl.appendChild(empty);
        }

        // Días del mes
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const dateStr = toISODateString(dayDate);
            const el = document.createElement('div');
            el.textContent = day;
            el.className = 'day';

            // ESTADOS: Pasado, Ocupado, Seleccionado
            if (dayDate < today) {
                el.classList.add('past');
            } else if (occupiedDates.includes(dateStr)) {
                el.classList.add('occupied');
                el.title = "No disponible";
            } else {
                // Disponible y clickable
                el.onclick = () => selectDate(dayDate);
                
                // Pintar selección
                if (selection.checkIn && dayDate.getTime() === selection.checkIn.getTime()) {
                    el.classList.add('selected', 'check-in');
                } else if (selection.checkOut && dayDate.getTime() === selection.checkOut.getTime()) {
                    el.classList.add('selected', 'check-out');
                } else if (selection.checkIn && selection.checkOut && dayDate > selection.checkIn && dayDate < selection.checkOut) {
                    el.classList.add('selected', 'in-range');
                }
            }
            calendarDaysEl.appendChild(el);
        }
    }

    // --- LÓGICA DE SELECCIÓN ---
    function selectDate(date) {
        // Reiniciar si ya hay rango completo o si clic antes de checkin
        if ((selection.checkIn && selection.checkOut) || (selection.checkIn && date < selection.checkIn)) {
            selection.checkIn = date;
            selection.checkOut = null;
            priceSummaryEl.style.display = 'none';
            bookingFormEl.style.display = 'none';
        } else if (!selection.checkIn) {
            selection.checkIn = date;
        } else {
            // Validar que no haya bloqueos en medio
            if (validateRange(selection.checkIn, date)) {
                selection.checkOut = date;
                calculateQuote(); // Cotizar
            } else {
                alert("No puedes seleccionar un rango que incluya fechas ocupadas.");
                selection.checkIn = date; // Reiniciar selección
                selection.checkOut = null;
            }
        }
        // Redibujar para mostrar colores
        drawDays(currentDate.getMonth(), currentDate.getFullYear());
    }

    function validateRange(start, end) {
        let d = new Date(start);
        d.setDate(d.getDate() + 1);
        while (d <= end) {
            if (occupiedDates.includes(toISODateString(d))) return false;
            d.setDate(d.getDate() + 1);
        }
        return true;
    }

    // --- COTIZACIÓN ---
    async function calculateQuote() {
        priceSummaryEl.style.display = 'block';
        priceLoaderEl.style.display = 'block';
        document.querySelector('.price-details').style.display = 'none';
        bookingFormEl.style.display = 'none';

        try {
            const inStr = toISODateString(selection.checkIn);
            const outStr = toISODateString(selection.checkOut);
            
            const url = `${API_ENDPOINT}?action=getPrice&propiedadId=${propiedadId}&checkIn=${inStr}&checkOut=${outStr}`;
            const res = await fetch(url);
            const data = await res.json();

            // Actualizar UI
            summaryCheckInEl.textContent = formatDate(selection.checkIn);
            summaryCheckOutEl.textContent = formatDate(selection.checkOut);
            summaryNightsEl.textContent = data.nights;
            summaryTotalEl.textContent = `$${data.total} MXN`;
            
            currentPrice = data.total;

            priceLoaderEl.style.display = 'none';
            document.querySelector('.price-details').style.display = 'block';
            bookingFormEl.style.display = 'block'; // Mostrar formulario

        } catch (error) {
            console.error(error);
            priceSummaryEl.innerHTML = '<p class="error">Error calculando precio.</p>';
        }
    }

    // --- ENVIAR RESERVA ---
    submitBookingBtn.addEventListener('click', async () => {
        if (!validateForm()) return;

        submitBookingBtn.disabled = true;
        submitBookingBtn.textContent = 'Procesando...';
        bookingMessageEl.style.display = 'none';

        const bookingData = {
            action: 'createBooking',
            propiedadId: propiedadId,
            checkIn: toISODateString(selection.checkIn),
            checkOut: toISODateString(selection.checkOut),
            customerName: customerNameEl.value,
            customerEmail: customerEmailEl.value,
            customerPhone: customerPhoneEl.value,
            total: currentPrice,
            nights: parseInt(summaryNightsEl.textContent)
        };

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                // Netlify functions manejan mejor body como string plano en POST
                body: JSON.stringify(bookingData)
            });
            
            const result = await response.json();

            if (result.status === 'success') {
                bookingFormEl.style.display = 'none';
                priceSummaryEl.style.display = 'none';
                bookingMessageEl.className = 'booking-message success';
                bookingMessageEl.innerHTML = `
                    <h3>¡Reserva Confirmada!</h3>
                    <p>Tu código de reserva es: <strong>${result.id}</strong></p>
                    <p>Hemos enviado los detalles a tu correo.</p>
                    <button onclick="window.location.reload()">Hacer otra reserva</button>
                `;
                bookingMessageEl.style.display = 'block';
            } else {
                throw new Error(result.message || 'Error desconocido');
            }

        } catch (error) {
            bookingMessageEl.className = 'booking-message error';
            bookingMessageEl.textContent = `Error: ${error.message}`;
            bookingMessageEl.style.display = 'block';
            submitBookingBtn.disabled = false;
            submitBookingBtn.textContent = 'Confirmar Reserva';
        }
    });

    // --- UTILIDADES ---
    function validateForm() {
        // Validación simple
        const isValid = customerNameEl.value && 
                        customerEmailEl.value.includes('@') && 
                        customerPhoneEl.value.length >= 10;
        // Habilitar botón solo si es válido (opcional, aquí lo dejamos manual en el click)
        return isValid;
    }

    function createDummyElement() {
        const el = document.createElement('div');
        el.id = 'dummy';
        el.style.display = 'none';
        document.body.appendChild(el);
        return el;
    }

    function formatDate(date) { 
        if (!date) return ''; 
        return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    function toISODateString(date) { 
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    // --- BOTONES MES ---
    if(prevMonthBtn) prevMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate); };
    if(nextMonthBtn) nextMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate); };

    // --- VALIDACIÓN INPUTS ---
    [customerNameEl, customerEmailEl, customerPhoneEl].forEach(el => {
        if(el) el.addEventListener('input', () => {
           submitBookingBtn.disabled = !validateForm();
        });
    });

});
