// js/app.js

// Usamos la instancia global creada en js/c
// js/app.js - Modifica las primeras líneas para que queden así:
const supabaseDB = window.supabaseClient || window.supabaseDB || window.supabase?.createClient("https://uqjtdklhjvshyromzzoa.supabase.co", "sb_publishable_m7D76P4JQAyymSIUogkVnQ_XqIxOkKv");
// Recuperamos el ID persistido del usuario (si ya se registró en este dispositivo)
let currentUserId = localStorage.getItem('eco_user_id');

// --- INICIALIZADOR CENTRAL ---
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Configurar los eventos de clic de la barra de navegación inferior y del modal
    initRouter();
    setupAuthEvents();

    // 2. Control del flujo de ingreso / Modal de Registro
    if (!currentUserId) {
        console.log("Sesión no encontrada. Mostrando modal de registro...");
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.remove('hidden');
        } else {
            console.error("Error crítico: No se encontró el contenedor '#auth-modal' en tu HTML.");
        }
        
        // Dejamos cargada la vista del mapa de fondo para mantener la estética
        switchView('campus');
    } else {
        console.log("Sesión activa detectada para el ID:", currentUserId);
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.add('hidden');
        }
        
        // Sincronizamos los EcoPuntos del usuario en la burbuja superior amarilla del Header
        await actualizarPuntosCabecera();
        
        // Iniciamos la aplicación directamente en la vista del Campus
        switchView('campus');
    }
});

// --- MANEJADOR DEL ENRUTADOR INFERIOR (BARRA MÓVIL) ---
function initRouter() {
    const navButtons = document.querySelectorAll('.bottom-nav .nav-item');
    
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const targetView = btn.getAttribute('data-view');
            
            // Remueve el estado activo del botón anterior y se lo asigna al presionado
            const activeBtn = document.querySelector('.nav-item.active');
            if (activeBtn) activeBtn.classList.remove('active');
            btn.classList.add('active');
            
            // Intercambia el contenido de la pantalla de forma dinámica
            switchView(targetView);
        });
    });
}

// --- INTERCAMBIADOR DINÁMICO DE VISTAS (SPA) ---
function switchView(viewName) {
    const container = document.getElementById('app-content');
    if (!container) {
        console.error("Error crítico: No se encontró el contenedor dinámico '#app-content' en tu HTML.");
        return;
    }
    
    // Ejecuta el método render de cada objeto modular alojado en la carpeta js/modules/
    switch(viewName) {
        case 'campus':
            if (typeof CampusModule !== 'undefined') CampusModule.render(container);
            break;
        case 'coleccion':
            if (typeof ColeccionModule !== 'undefined') ColeccionModule.render(container);
            break;
        case 'tienda':
            if (typeof TiendaModule !== 'undefined') TiendaModule.render(container);
            break;
        case 'perfil':
            if (typeof PerfilModule !== 'undefined') PerfilModule.render(container);
            break;
        case 'ranking':
            if (typeof RankingModule !== 'undefined') RankingModule.render(container);
            break;
        default:
            console.warn(`La vista solicitada [${viewName}] no está mapeada o definida.`);
    }
}

// --- CAPTURA Y PROCESAMIENTO DEL REGISTRO DE USUARIOS ---
function setupAuthEvents() {
    const btnRegister = document.getElementById('btn-register');
    if (btnRegister) {
        btnRegister.addEventListener('click', async () => {
            const usernameInput = document.getElementById('username-input').value.trim();
            
            if (usernameInput === "") {
                alert("Por favor, introduce un nombre de usuario válido para participar.");
                return;
            }
            
            // Genera el código alfanumérico aleatorio requerido para la columna 'codigo_eco'
            const randomCode = "ECO-" + Math.floor(1000 + Math.random() * 9000);
            
            // Bloqueamos el botón momentáneamente para evitar duplicados en la base de datos
            btnRegister.disabled = true;
            btnRegister.innerText = "Conectando con Supabase...";

            // Inserción directa en tu tabla real 'usuarios' de Postgres
            const { data, error } = await supabaseDB
                .from('usuarios')
                .insert([
                    { username: usernameInput, codigo_eco: randomCode, puntos: 0 }
                ])
                .select()
                .single();

            if (error) {
                console.error("Error de políticas RLS o Inserción fallida:", error.message);
                alert("Error al registrar el usuario. Verifica las políticas en Supabase: " + error.message);
                btnRegister.disabled = false;
                btnRegister.innerText = "Generar mi Código Eco";
                return;
            }

            // Guardamos el ID autogenerado en la memoria local del celular para persistir la sesión
            currentUserId = data.id;
            localStorage.setItem('eco_user_id', currentUserId);
            
            // Ocultamos el modal de ingreso de forma segura
            document.getElementById('auth-modal').classList.add('hidden');
            
            // Habilitamos nuevamente el botón para futuras limpiezas
            btnRegister.disabled = false;
            btnRegister.innerText = "Generar mi Código Eco";

            // Sincronizamos la interfaz y actualizamos los puntos de la cabecera superior
            await actualizarPuntosCabecera();
            switchView('campus');
            
            alert(`¡Registro exitoso! Bienvenido ${data.username}. Tu ID es: ${data.codigo_eco}`);
        });
    }
}
// js/app.js - Función corregida sin .single()
async function actualizarPuntosCabecera() {
    if (!currentUserId || !supabaseDB) return;
    
    // Quitamos .single() para evitar el error 406 de Supabase
    const { data, error } = await supabaseDB
        .from('usuarios')
        .select('puntos')
        .eq('id', currentUserId);
        
    if (error) {
        console.error("Error al sincronizar puntos globales del header:", error.message);
        return;
    }
        
    // Validamos que el array contenga al menos un registro antes de pintar
    if (data && data.length > 0 && document.getElementById('global-points')) {
        document.getElementById('global-points').innerText = data[0].puntos;
    }

}