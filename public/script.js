// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = "https://uqjtdklhjvshyromzzoa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_m7D76P4JQAyymSIUogkVnQ_XqIxOkKv";

// Conexión segura usando el objeto global del CDN para evitar errores de redeclaración
const supabaseDB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- VARIABLES GLOBALES DEL SISTEMA ---
let currentUserId = null;
let activePointId = null;

// Puntos de reciclaje simulados en la UAJMS
const ecoPoints = [
    { id: 1, name: "Basurero Central - Tecnología", desc: "Contenedor de Botellas PET y Plásticos.", lat: -21.5145, lng: -65.2340 },
    { id: 2, name: "EcoPoint - Bloque Económicas", desc: "Reciclaje de Papel, Cartón y apuntes en desuso.", lat: -21.5152, lng: -65.2335 },
    { id: 3, name: "Punto Verde - Entrada Principal", desc: "Punto general y recolección de Tapitas.", lat: -21.5138, lng: -65.2345 }
];

// --- INICIALIZACIÓN DE LA APP ---
document.addEventListener("DOMContentLoaded", async () => {
    await inicializarApp();
    initMap();
    setupEventListeners();
});

// --- GESTIÓN DE SESIÓN Y FLUJO PRINCIPAL ---
async function inicializarApp() {
    // Recuperamos el ID autogenerado del usuario guardado en este navegador
    currentUserId = localStorage.getItem('eco_user_id');

    if (!currentUserId) {
        // Si no existe, abrimos el modal para que cree su nombre de usuario
        document.getElementById('auth-modal').classList.remove('hidden');
        // Cargamos de todos modos el ranking global para ver el progreso de los demás
        await cargarRankingGlobal(null);
        return;
    }

    // Si ya existe sesión local, ocultamos el modal de ingreso
    document.getElementById('auth-modal').classList.add('hidden');

    // Cargar los datos del perfil y el ranking global en paralelo
    await Promise.all([
        cargarDatosUsuario(currentUserId),
        cargarRankingGlobal(currentUserId)
    ]);
}

// --- GESTIÓN DE REGISTRO DE NUEVOS USUARIOS ---
async function registerUser() {
    const usernameInput = document.getElementById('username-input').value.trim();
    if (usernameInput === "") {
        alert("Por favor, introduce un nombre de usuario válido.");
        return;
    }
    
    // Generar código único para la columna 'codigo_eco' (Ej: ECO-2489)
    const randomCode = "ECO-" + Math.floor(1000 + Math.random() * 9000);
    
    // Insertamos el nuevo registro directamente en tu tabla 'usuarios'
    const { data, error } = await supabaseDB
        .from('usuarios')
        .insert([
            { username: usernameInput, codigo_eco: randomCode, puntos: 0 }
        ])
        .select()
        .single();

    if (error) {
        console.error("Error al registrar en Supabase:", error.message);
        alert("No se pudo crear el usuario. Asegúrate de haber configurado las políticas RLS en Supabase: " + error.message);
        return;
    }

    // Almacenamos el ID de la base de datos localmente para mantener la sesión
    currentUserId = data.id;
    localStorage.setItem('eco_user_id', currentUserId);
    
    document.getElementById('auth-modal').classList.add('hidden');
    
    // Refrescamos toda la UI con la información recién creada
    await cargarDatosUsuario(currentUserId);
    await cargarRankingGlobal(currentUserId);
}

// --- ACTUALIZACIÓN DE INTERFAZ DEL USUARIO (PERFIL) ---
async function cargarDatosUsuario(userId) {
    const { data: perfil, error } = await supabaseDB
        .from('usuarios')
        .select('username, codigo_eco, puntos')
        .eq('id', userId)
        .single();

    if (error) {
        console.error("Error al cargar perfil de Supabase:", error.message);
        return;
    }

    // Sincronizar elementos del Header original de tu HTML
    if (document.getElementById('user-display')) {
        document.getElementById('user-display').innerHTML = `<i class="fa-solid fa-user"></i> ${perfil.username}`;
    }
    if (document.getElementById('user-code')) {
        document.getElementById('user-code').innerText = `ID: ${perfil.codigo_eco}`;
    }
    if (document.getElementById('score-display')) {
        document.getElementById('score-display').innerText = `${perfil.puntos} pts`;
    }
}

// --- RENDERS DEL RANKING GLOBAL ---
async function cargarRankingGlobal(idLogueado) {
    const { data: ranking, error } = await supabaseDB
        .from('usuarios')
        .select('id, username, codigo_eco, puntos')
        .order('puntos', { ascending: false }) // Trae los puntajes más altos primero
        .limit(20);

    if (error) {
        console.error("Error al cargar ranking de Supabase:", error.message);
        return;
    }

    const tbody = document.getElementById('ranking-body');
    if (!tbody) return;

    tbody.innerHTML = ""; // Limpiar loaders

    ranking.forEach((user, index) => {
        // Conversión segura para comparar strings/números/UUIDs
        const esElUsuarioActual = String(user.id) === String(idLogueado);
        const fila = document.createElement('tr');

        // Clases estéticas para el podio
        if (index === 0) fila.className = "rank-1";
        else if (index === 1) fila.className = "rank-2";
        else if (index === 2) fila.className = "rank-3";
        
        if (esElUsuarioActual) fila.classList.add("rank-current");

        const puestoText = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1;

        fila.innerHTML = `
            <td style="text-align: center; font-weight: bold;">${puestoText}</td>
            <td style="font-weight: ${esElUsuarioActual ? '600' : '400'}">
                ${user.username} 
            </td>
            <td><small style="color: #666;">${user.codigo_eco}</small></td>
            <td style="text-align: right; font-weight: bold; color: #10b981;">${user.puntos} pts</td>
        `;

        tbody.appendChild(fila);
    });
}

// --- ACTUALIZACIÓN ASÍNCRONA DE PUNTOS DIRECTA ---
async function agregarPuntosPorReciclaje(puntosAAsignar) {
    if (!currentUserId) {
        alert("No se identificó un usuario activo.");
        return;
    }

    // 1. Obtener puntaje actual actualizado desde la base de datos
    const { data: usuario, errorFetch } = await supabaseDB
        .from('usuarios')
        .select('puntos')
        .eq('id', currentUserId)
        .single();

    if (errorFetch) {
        console.error("Error al obtener puntos actuales:", errorFetch.message);
        return;
    }

    const nuevosPuntos = usuario.puntos + puntosAAsignar;

    // 2. Guardar el nuevo puntaje acumulado en Supabase
    const { error: errorUpdate } = await supabaseDB
        .from('usuarios')
        .update({ 
            puntos: nuevosPuntos,
            actualizado_en: new Date().toISOString() 
        })
        .eq('id', currentUserId);

    if (errorUpdate) {
        alert("Hubo un error al registrar tus puntos en el servidor: " + errorUpdate.message);
    } else {
        alert(`¡Comprobante enviado con éxito! Has sumado ${puntosAAsignar} EcoPoints.`);
        
        // Recargar el perfil y la tabla de posiciones en tiempo real
        await cargarDatosUsuario(currentUserId);
        await cargarRankingGlobal(currentUserId);
    }
}

// --- CONFIGURACIÓN DEL MAPA INTERACTIVO (LEAFLET) ---
function initMap() {
    const uajmsCoords = [-21.5145, -65.2340];
    const map = L.map('map').setView(uajmsCoords, 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    ecoPoints.forEach(point => {
        const greenIcon = L.divIcon({
            html: `<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white; font-size:10px;"><i class="fa-solid fa-trash"></i></div>`,
            className: 'custom-pin',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([point.lat, point.lng], { icon: greenIcon }).addTo(map);
        
        marker.on('click', () => {
            openUploadSheet(point);
        });
    });
}

// --- CONTROL DE VENTANAS MODALES (BOTTOM SHEET) ---
function openUploadSheet(point) {
    activePointId = point.id;
    document.getElementById('point-title').innerText = point.name;
    document.getElementById('point-desc').innerText = point.desc;
    document.getElementById('upload-modal').classList.remove('hidden');
}

function closeUploadSheet() {
    document.getElementById('upload-modal').classList.add('hidden');
    document.getElementById('upload-form').reset();
    document.getElementById('preview-container').classList.add('hidden');
    activePointId = null;
}

// --- CONTROLADORES DE EVENTOS (LISTENERS) ---
function setupEventListeners() {
    document.getElementById('btn-register').addEventListener('click', registerUser);
    document.getElementById('close-sheet').addEventListener('click', closeUploadSheet);

    // Captura y previsualización de la imagen cargada
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imgPreview = document.getElementById('image-preview');
                    imgPreview.src = e.target.result;
                    document.getElementById('preview-container').classList.remove('hidden');
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // Intercepción del envío de formulario
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Ejecuta el incremento directo de 15 puntos hacia la base de datos
            await agregarPuntosPorReciclaje(15);
            closeUploadSheet();
        });
    }
}
