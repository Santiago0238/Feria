// js/modules/tienda.js
const TiendaModule = {
    premios: [
        { id: 1, name: "Sticker ecologico UAJMS", desc: "Sticker con diseno ambiental de la UAJMS.", cost: 50, stock: 20, icon: "fa-note-sticky" },
        { id: 2, name: "Lapicero reciclado", desc: "Lapicero fabricado con material reciclado.", cost: 100, stock: 15, icon: "fa-pen" }
    ],

    render: function(targetContainer) {
        const progress = window.EcoCollectibles?.getProgress() || { count: 0, total: 10, complete: false };

        if (!progress.complete) {
            targetContainer.innerHTML = `
                <div class="view-wrapper padded animated-fade">
                    <div class="store-locked">
                        <i class="fa-solid fa-lock"></i>
                        <h3>Tienda bloqueada</h3>
                        <p>Completa la coleccion de mascotas para habilitar los premios.</p>
                        <div class="collection-progress-bar">
                            <span style="width: ${(progress.count / progress.total) * 100}%"></span>
                        </div>
                        <strong>${progress.count}/${progress.total} mascotas desbloqueadas</strong>
                        <button class="btn-primary" onclick="switchView('coleccion')">
                            <i class="fa-solid fa-boxes-stacked"></i> Ver coleccion
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        const premiosHTML = this.premios.map(premio => `
            <div class="store-card reward-card">
                <div class="reward-icon"><i class="fa-solid ${premio.icon}"></i></div>
                <div class="store-card-body">
                    <h4>${premio.name}</h4>
                    <p>${premio.desc}</p>
                    <div class="store-meta">
                        <span class="cost-tag">${premio.cost} pts</span>
                        <span class="stock-tag">Stock: ${premio.stock}</span>
                    </div>
                </div>
                <button class="btn-action-store" onclick="TiendaModule.canjear(${premio.id}, ${premio.cost})">Canjear</button>
            </div>
        `).join('');

        targetContainer.innerHTML = `
            <div class="view-wrapper padded animated-fade">
                <div class="section-title">
                    <h3><i class="fa-solid fa-shop text-success"></i> Tienda de premios</h3>
                    <p>Coleccion completa. Ya puedes canjear tus EcoPuntos.</p>
                </div>
                <div class="store-flex-list">
                    ${premiosHTML}
                </div>
                <div class="store-footer-banner">
                    Premios canjeados: <span id="redeemed-count">0</span>
                </div>
            </div>
        `;
    },

    canjear: function(id, costo) {
        alert(`Procesando canje de premio. Costo: ${costo} EcoPuntos.`);
    }
};
