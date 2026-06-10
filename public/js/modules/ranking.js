// js/modules/ranking.js
const RankingModule = {
    render: async function(targetContainer) {
        targetContainer.innerHTML = `
            <div class="view-wrapper padded animated-fade">
                <div class="section-title">
                    <h3><i class="fa-solid fa-trophy text-yellow"></i> Ranking UAJMS</h3>
                </div>
                <div id="ranking-cards-list" class="ranking-flex-list">
                    <p class="loading-text">Buscando lideres en Supabase...</p>
                </div>
            </div>
        `;
        await this.fetchLeaderboard();
    },

    fetchLeaderboard: async function() {
        const db = window.supabaseClient || window.supabaseDB;

        if (!db) {
            console.error("Error: No se pudo conectar con la instancia de Supabase.");
            return;
        }

        const idLogueado = localStorage.getItem('eco_user_id');

        const { data: ranking, error } = await db
            .from('usuarios')
            .select('id, username, puntos')
            .order('puntos', { ascending: false })
            .limit(15);

        const listContainer = document.getElementById('ranking-cards-list');
        if (error || !listContainer) {
            console.error("Error al traer datos de Supabase:", error?.message);
            if (listContainer) listContainer.innerHTML = "<p>Error al cargar el ranking.</p>";
            return;
        }

        listContainer.innerHTML = "";

        ranking.forEach((user, index) => {
            const card = document.createElement('div');
            card.className = "rank-item-card";

            if (String(user.id) === String(idLogueado)) {
                card.classList.add('me-card');
            }

            const puestoText = index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : `#${index + 1}`;

            card.innerHTML = `
                <div class="rank-card-left">
                    <span class="position-number" style="min-width: 35px; display: inline-block;">${puestoText}</span>
                    <div class="student-meta">
                        <h4>${user.username}</h4>
                    </div>
                </div>
                <span class="rank-card-pts">${user.puntos} pts</span>
            `;
            listContainer.appendChild(card);
        });
    }
};
