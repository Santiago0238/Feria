// js/modules/perfil.js
const PerfilModule = {
    render: async function(targetContainer) {
        const progress = window.EcoCollectibles?.getProgress() || { count: 0 };
        const recycleCount = window.EcoCollectibles?.getRecycleCount() || 0;

        targetContainer.innerHTML = `
            <div class="view-wrapper padded animated-fade">
                <div class="section-title">
                    <h3><i class="fa-solid fa-id-card text-success"></i> Perfil</h3>
                </div>

                <div class="profile-main-card">
                    <div class="profile-avatar-box">
                        <span id="perf-avatar-initial" class="avatar-logo-uajms">?</span>
                    </div>
                    <div class="profile-identifier">
                        <h4 id="perf-username">Cargando...</h4>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-num" id="perf-puntos">0</span>
                        <span class="stat-label">Puntos</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-num">${recycleCount}</span>
                        <span class="stat-label">Reciclajes</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-num">${progress.count}</span>
                        <span class="stat-label">Mascotas</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-num">0</span>
                        <span class="stat-label">Premios</span>
                    </div>
                </div>

                <div class="profile-details-list">
                    <div class="detail-row">
                        <span>USUARIO</span>
                        <strong id="perf-row-user">...</strong>
                    </div>
                    <div class="detail-row">
                        <span>CODIGO UNICO</span>
                        <strong id="perf-row-code">...</strong>
                    </div>
                    <div class="detail-row">
                        <span>PROGRESO DE COLECCION</span>
                        <strong>${progress.count}/10 mascotas desbloqueadas</strong>
                    </div>
                </div>
            </div>
        `;
        await this.loadProfileData();
    },

    loadProfileData: async function() {
        const userId = localStorage.getItem('eco_user_id');
        if (!userId) return;

        const db = window.supabaseClient || window.supabaseDB;

        if (!db) {
            console.error("Instancia de Supabase no encontrada en Perfil.");
            return;
        }

        const { data, error } = await db
            .from('usuarios')
            .select('username, codigo_eco, puntos')
            .eq('id', userId);

        if (error || !data || data.length === 0) {
            console.error("No se pudo mapear el perfil desde Supabase:", error?.message);
            return;
        }

        const usuarioReal = data[0];
        const username = usuarioReal.username || '';
        const initial = username.trim().charAt(0).toUpperCase() || '?';

        if (document.getElementById('perf-username')) {
            document.getElementById('perf-username').innerText = username;
        }
        if (document.getElementById('perf-avatar-initial')) {
            document.getElementById('perf-avatar-initial').innerText = initial;
        }
        if (document.getElementById('perf-puntos')) {
            document.getElementById('perf-puntos').innerText = usuarioReal.puntos;
        }
        if (document.getElementById('perf-row-user')) {
            document.getElementById('perf-row-user').innerText = usuarioReal.username;
        }
        if (document.getElementById('perf-row-code')) {
            document.getElementById('perf-row-code').innerText = usuarioReal.codigo_eco;
        }
    }
};
