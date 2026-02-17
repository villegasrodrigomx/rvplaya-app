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
    const params = new URLSearchParams(window.location.search);
    const id = params.get('propiedad');

    if (id) {
        cargarMotor(id);
    } else {
        cargarHome();
    }

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
        el.lista.innerHTML = `<p style="color:red">Error Home: ${e.message}</p>`;
    }
}

async function cargarMotor(id) {
    state.propiedadId = id;
    el.home.classList.add('hidden');
    el.booking.classList.remove('hidden');
    el.dias.innerHTML = 'Iniciando diagnóstico...';

    // ¡AQUÍ ESTABA EL ERROR! 
    // He quitado el try/catch que ocultaba la verdad.
    await actualizarCalendario();
}

async function actualizarCalendario() {
    const mes = state.fechaActual.getMonth() + 1;
    const anio = state.fechaActual.getFullYear();
    
    el.mes.textContent = state.fechaActual.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    
    const url = `${API_URL}?action=getAvailability&propiedadId=${state.propiedadId}&month=${mes}&year=${anio}`;
    
    try {
        const res = await fetch(url);
        
        // LEER TEXTO CRUDO PARA DIAGNÓSTICO
        const texto = await res.text();
        console.log("Respuesta RAW:", texto);

        // INTENTAR PARSEAR JSON
        let data;
        try {
            data = JSON.parse(texto);
        } catch (e) {
            // SI FALLA AQUÍ, MOSTRAMOS LO QUE LLEGÓ (HTML DE ERROR O LOGIN)
            throw new Error(`NO ES JSON. Recibí: ${texto.substring(0, 150)}...`);
        }

        // Si llegamos aquí, es JSON válido
        state.fechasOcupadas = Array.isArray(data) ? data : [];
        renderizarDias();

    } catch (e) {
        console.error(e);
        // AHORA SÍ VERÁS EL ERROR REAL EN PANTALLA
        el.dias.innerHTML = `
            <div style="color:red; padding:10px; border:1px solid red; background:#fff0f0;">
                <strong>DIAGNÓSTICO TONY:</strong><br>
                ${e.message}
            </div>`;
    }
}

function renderizarDias() {
    el.dias.innerHTML = '';
    const anio = state.fechaActual.getFullYear();
    const mes = state.fechaActual.getMonth();
    
    const primerDia = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    
    for(let i=0; i<primerDia; i++) el.dias.appendChild(document.createElement('div'));

    for(let d=1; d<=diasEnMes; d++) {
        const fecha = new Date(anio, mes, d);
        const fechaStr = fecha.toISOString().split('T')[0];
        const div = document.createElement('div');
        div.className = 'day';
        div.textContent = d;

        if (state.fechasOcupadas.includes(fechaStr)) {
            div.classList.add('occupied');
        } else {
            div.onclick = () => clickFecha(fecha);
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
        state.seleccion = { inicio: fecha, fin: null };
        el.resumen.classList.add('hidden');
    } else {
        if (fecha > inicio && validarRango(inicio, fecha)) {
            state.seleccion.fin = fecha;
            cotizar();
        } else {
            state.seleccion = { inicio: fecha, fin: null };
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

    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(datos)
    });

    el.resumen.innerHTML = `<h3 style="color:green">¡Reserva Enviada!</h3><p>Revisa tu correo.</p><button onclick="window.location.reload()">Nueva Reserva</button>`;
}

function cambiarMes(delta) {
    state.fechaActual.setMonth(state.fechaActual.getMonth() + delta);
    actualizarCalendario();
}
