// js/modules/coleccion.js
const ColeccionModule = {
    render: function(targetContainer) {
        const progress = window.EcoCollectibles?.getProgress() || { unlocked: [], count: 0, total: 10, complete: false };
        const items = window.EcoCollectibles?.items || [];

        const cardsHTML = items.map(item => {
            const unlocked = progress.unlocked.includes(item.id);
            return `
                <article class="pet-card ${unlocked ? 'unlocked' : 'locked'}">
                    <div class="pet-image-wrap">
                        <img src="${item.image}" alt="${item.name}" class="pet-image" loading="lazy">
                        ${!unlocked ? '<div class="pet-lock"><i class="fa-solid fa-lock"></i><span>Por descubrir</span></div>' : ''}
                    </div>
                    <div class="pet-card-body">
                        <span class="rarity-badge">${unlocked ? item.rarity : 'Silueta'}</span>
                        <h4>${unlocked ? item.name : 'Mascota desconocida'}</h4>
                        <p>${unlocked ? item.type : 'Recicla en el campus para revelar su color y detalles.'}</p>
                    </div>
                    ${unlocked && item.model ? `
                        <button class="btn-view-3d" onclick="ColeccionModule.open3D(${item.id})">
                            <i class="fa-solid fa-cube"></i> Ver 3D
                        </button>
                    ` : ''}
                </article>
            `;
        }).join('');

        targetContainer.innerHTML = `
            <div class="view-wrapper padded collection-view animated-fade">
                <div class="section-title collection-title">
                    <div>
                        <h3><i class="fa-solid fa-boxes-stacked"></i> Coleccion UAJMS</h3>
                        <p>${progress.count}/${progress.total} mascotas encontradas</p>
                    </div>
                    <div class="collection-progress-ring" style="--progress: ${(progress.count / progress.total) * 360}deg">
                        <span>${Math.round((progress.count / progress.total) * 100)}%</span>
                    </div>
                </div>
                <div class="collection-progress-bar">
                    <span style="width: ${(progress.count / progress.total) * 100}%"></span>
                </div>
                <div class="collection-hint">
                    <i class="fa-solid fa-qrcode"></i>
                    Cada reciclaje registrado desbloquea una mascota.
                </div>
                <div class="pet-grid">
                    ${cardsHTML}
                </div>
            </div>
        `;
    },

    open3D: function(itemId) {
        const item = window.EcoCollectibles?.items.find(pet => pet.id === Number(itemId));
        if (!item || !item.model || !window.EcoCollectibles?.isUnlocked(item.id)) return;

        const modal = document.createElement('div');
        modal.className = 'pet-3d-modal';
        modal.innerHTML = `
            <div class="pet-3d-shell">
                <button class="pet-3d-close" aria-label="Cerrar visor 3D" onclick="this.closest('.pet-3d-modal').remove()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="pet-3d-header">
                    <span>${item.rarity}</span>
                    <h3>${item.name}</h3>
                </div>
                <model-viewer
                    src="${item.model}"
                    camera-controls
                    auto-rotate
                    shadow-intensity="0.8"
                    exposure="1"
                    ar
                    class="pet-model-viewer">
                </model-viewer>
                <p>Arrastra para girar la mascota.</p>
            </div>
        `;
        document.body.appendChild(modal);
    }
};
