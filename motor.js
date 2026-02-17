// --- CONFIGURACIÓN ---
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwMdaEIZi3EqnDbVoul-EjVfjvl4bCu3GOwteHAQtK3rFqdVVCuh0EVcaKVRqCJ2pezqQ/exec'; 

// Estado Global
let state = {
    propiedadId: null,
    fechasOcupadas: [],
    fechaActual: new Date(),
    seleccion: { inicio: null, fin: null }
};

// Elementos DOM
const el = {
    home: document.getElementById('view-home'),
    booking: document.getElementById('view-booking'),
    lista: document.getElementById('property-list'),
    titulo: document.getElementById('propiedadNombre'),
    mes: document.getElementById('monthYear'),
    dias: document.getElementById('calendarDays'),
    resumen: document.getElementById('priceSummary'),
    btnBook: document.getElementById('btnBook'),
    msg: document.getElementById('msgBox')
};

// --- INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    // Router simple
    const params = new URLSearchParams(window.location.search);
    const id = params.get('propiedad');

    if (id) {
        cargarMotor(id);
    } else {
        cargarHome();
    }

    // Eventos botones mes
    document.getElementById('prevMonth').onclick = () => cambiarMes(-1);
    document.getElementById('nextMonth').onclick = () => cambiarMes(1);
    el.btnBook.onclick = enviarReserva;
});

// --- FUNCIONES CORE ---

async function cargarHome() {
    el.home.classList.remove('hidden');
    el.booking.classList.add('hidden');
    
    try {
        const res = await fetch(`${API_URL}?action=getProperties`);
        const lista = await res.json();
        
        el.lista.innerHTML = '';
        lista.forEach(p => {
            const btn = document.createElement('div');
            btn.innerHTML = `<h3>${p.name}</h3><button>Reservar</button>`;
            btn.style = "border:1px solid #ccc; padding:10px; margin:10px 0; cursor:pointer;";
            btn.onclick = () => window.location.href = `?propiedad=${p.id}`;
            el.lista.appendChild(btn);
        });
    } catch (e) {
        el.lista.innerHTML = `<p style="color:red">Error cargando propiedades: ${e.message}</p>`;
    }
}

async function cargarMotor(id) {
    state.propiedadId = id;
    el.home.classList.add('hidden');
    el.booking.classList.remove('hidden');
    el.dias.innerHTML = 'Cargando disponibilidad...';

    // 1. Obtener nombre (opcional) y 2. Disponibilidad
    try {
        // Cargar calendario inicial
        await actualizarCalendario();
    } catch (e) {
        el.dias.innerHTML = 'Error de conexión.';
    }
}

async function actualizarCalendario() {
    const mes = state.fechaActual.getMonth() + 1;
    const anio = state.fechaActual.getFullYear();
    
    el.mes.textContent = state.fechaActual.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    
    const url = `${API_URL}?action=getAvailability&propiedadId=${state.propiedadId}&month=${mes}&year=${anio}`;
    
    try {
        const res = await fetch(url);
        
        // 1. Leemos la respuesta como TEXTO PURO primero
        const textoCrudo = await res.text();
        console.log("Respuesta del servidor:", textoCrudo); // Míralo en la consola (F12)

        // 2. Intentamos convertirlo a JSON
        let data;
        try {
            data = JSON.parse(textoCrudo);
        } catch (jsonError) {
            // SI FALLA AQUÍ, ES QUE RECIBIMOS HTML (LOGIN O ERROR)
            throw new Error("No recibí JSON. Recibí esto: " + textoCrudo.substring(0, 100));
        }

        state.fechasOcupadas = Array.isArray(data) ? data : [];
        renderizarDias();

    } catch (e) {
        console.error(e);
        // ESTO PONDRÁ EL ERROR REAL EN LA PANTALLA
        el.dias.innerHTML = `<div style="color:red; padding:20px;">ERROR REAL: ${e.message}</div>`;
    }
}

function renderizarDias() {
    el.dias.innerHTML = '';
    const anio = state.fechaActual.getFullYear();
    const mes = state.fechaActual.getMonth();
    
    const primerDia = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    
    // Relleno inicial
    for(let i=0; i<primerDia; i++) el.dias.appendChild(document.createElement('div'));

    for(let d=1; d<=diasEnMes; d++) {
        const fecha = new Date(anio, mes, d);
        const fechaStr = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
        const div = document.createElement('div');
        div.className = 'day';
        div.textContent = d;

        // Lógica de Estado
        if (state.fechasOcupadas.includes(fechaStr)) {
            div.classList.add('occupied');
        } else {
            div.onclick = () => clickFecha(fecha);
            
            // Pintar selección
            if (state.seleccion.inicio && fecha.getTime() === state.seleccion.inicio.getTime()) div.classList.add('selected');
            if (state.seleccion.fin && fecha.getTime() === state.seleccion.fin.getTime()) div.classList.add('selected');
            if (state.seleccion.inicio && state.seleccion.fin && fecha > state.seleccion.inicio && fecha < state.seleccion.fin) div.classList.add('selected');
        }
        el.dias.appendChild(div);
    }
}

function clickFecha(fecha) {
    const { inicio, fin } = state.seleccion;
    
    if (!inicio || (inicio && fin)) {
        // Nueva selección
        state.seleccion = { inicio: fecha, fin: null };
        el.resumen.classList.add('hidden');
    } else {
        // Cerrar rango
        if (fecha > inicio && validarRango(inicio, fecha)) {
            state.seleccion.fin = fecha;
            cotizar();
        } else {
            state.seleccion = { inicio: fecha, fin: null }; // Reiniciar
        }
    }
    renderizarDias();
}

function validarRango(inicio, fin) {
    let d = new Date(inicio);
    d.setDate(d.getDate() + 1);
    while(d <= fin) {
        if (state.fechasOcupadas.includes(d.toISOString().split('T')[0])) return false;
        d.setDate(d.getDate() + 1);
    }
    return true;
}

async function cotizar() {
    el.resumen.classList.remove('hidden');
    document.getElementById('sTotal').textContent = 'Calculando...';
    
    const inStr = state.seleccion.inicio.toISOString().split('T')[0];
    const outStr = state.seleccion.fin.toISOString().split('T')[0];
    
    const res = await fetch(`${API_URL}?action=getPrice&propiedadId=${state.propiedadId}&checkIn=${inStr}&checkOut=${outStr}`);
    const data = await res.json();
    
    document.getElementById('sCheckIn').textContent = inStr;
    document.getElementById('sCheckOut').textContent = outStr;
    document.getElementById('sNights').textContent = data.nights;
    document.getElementById('sTotal').textContent = data.total;
}

async function enviarReserva() {
    el.btnBook.disabled = true;
    el.btnBook.textContent = "Procesando...";
    
    const datos = {
        action: 'createBooking',
        propiedadId: state.propiedadId,
        checkIn: state.seleccion.inicio.toISOString().split('T')[0],
        checkOut: state.seleccion.fin.toISOString().split('T')[0],
        customerName: document.getElementById('cName').value,
        customerEmail: document.getElementById('cEmail').value,
        customerPhone: document.getElementById('cPhone').value,
        total: document.getElementById('sTotal').textContent
    };

    // POST "no-cors" hack para GAS
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(datos)
    });

    // Asumimos éxito si no explota (GAS es tricky con CORS)
    el.resumen.innerHTML = `<h3 style="color:green">¡Reserva Enviada!</h3><p>Revisa tu correo.</p><button onclick="window.location.reload()">Nueva Reserva</button>`;
}

function cambiarMes(delta) {
    state.fechaActual.setMonth(state.fechaActual.getMonth() + delta);
    actualizarCalendario();
}
