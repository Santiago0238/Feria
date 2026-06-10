// js/modules/campus.js
const CampusModule = {
    campusCenter: [-21.54592, -64.72188],
    campusRadiusMeters: 260,
    map: null,
    playerMarker: null,
    accuracyCircle: null,
    watchId: null,
    scanStream: null,
    scanAnimationFrame: null,
    scanLocked: false,
    ecoPoints: [], 
    activePoint: null,

    render: async function(targetContainer) {
        targetContainer.innerHTML = `
            <div class="view-wrapper campus-game-view animated-fade">
                <div id="map" class="mobile-map-layer"></div>

                <div class="game-hud">
                    <div class="hud-chip">
                        <i class="fa-solid fa-location-crosshairs"></i>
                        <span id="campus-status">Cargando EcoPoints desde Supabase...</span>
                    </div>
                    <button id="btn-center-player" class="hud-round-btn" title="Centrar jugador">
                        <i class="fa-solid fa-crosshairs"></i>
                    </button>
                </div>

            </div>
        `;

        await this.cargarPuntosDesdeSupabase();

        if (this.ecoPoints.length > 0) {
            this.activePoint = this.ecoPoints[0];
            this.initLeaflet();
            this.setupModuleEvents();
        } else {
            const status = document.getElementById('campus-status');
            if (status) status.innerText = "Error al conectar con los EcoPoints.";
        }
    },

    cargarPuntosDesdeSupabase: async function() {
        const db = window.supabaseClient || window.supabaseDB;
        if (!db) return;

        try {
            const { data, error } = await db
                .from('puntos_reciclaje')
                .select('id, name, desc_info, lat, lng, points, type_material, icon_name');

            if (error) throw error;

            this.ecoPoints = data.map(item => ({
                id: item.id,
                name: item.name,
                desc: item.desc_info,
                lat: Number(item.lat),
                lng: Number(item.lng),
                points: item.points,
                type: item.type_material,
                icon: item.icon_name || 'fa-recycle'
            })).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));

        } catch (err) {
            console.error("Error al descargar puntos de reciclaje:", err.message);
            this.ecoPoints = [];
        }
    },

    initLeaflet: function() {
        if (this.watchId && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        if (this.map) {
            this.map.remove();
            this.map = null;
            this.playerMarker = null;
            this.accuracyCircle = null;
        }

        const startCenter = this.getCampusStartCenter();
        this.campusCenter = startCenter;

        const map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            minZoom: 16,
            maxZoom: 19
        }).setView(startCenter, 18);
        this.map = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19
        }).addTo(map);

        this.ecoPoints.forEach(point => {
            const customIcon = L.divIcon({
                html: `
                    <div class="eco-stop-marker">
                        <span class="eco-stop-pulse"></span>
                        <div class="eco-stop-core"><i class="fa-solid ${point.icon}"></i></div>
                        <small>${point.points}</small>
                    </div>
                `,
                className: 'custom-leaflet-marker',
                iconSize: [54, 64],
                iconAnchor: [27, 54]
            });

            const marker = L.marker([point.lat, point.lng], { icon: customIcon }).addTo(map);

            marker.on('click', () => {
                this.setActivePoint(point, true);
                this.requestQrScan();
            });
        });

        this.fitMapToEcoPoints();
        this.setPlayerPosition(startCenter[0], startCenter[1], 18, false);
        this.updateNearbyBins(startCenter[0], startCenter[1]);
        setTimeout(() => map.invalidateSize(), 80);
        this.startLocationTracking();
    },

    setupModuleEvents: function() {
        const btnCenter = document.getElementById('btn-center-player');
        if (btnCenter) {
            btnCenter.addEventListener('click', () => {
                if (!this.map || !this.playerMarker) return;
                this.map.setView(this.playerMarker.getLatLng(), 19, { animate: true });
            });
        }
    },

    getCampusStartCenter: function() {
        if (!this.ecoPoints.length) return this.campusCenter;

        const total = this.ecoPoints.reduce((acc, point) => ({
            lat: acc.lat + point.lat,
            lng: acc.lng + point.lng
        }), { lat: 0, lng: 0 });

        return [total.lat / this.ecoPoints.length, total.lng / this.ecoPoints.length];
    },

    fitMapToEcoPoints: function() {
        if (!this.map || !this.ecoPoints.length) return;

        const bounds = L.latLngBounds(this.ecoPoints.map(point => [point.lat, point.lng]));
        this.map.fitBounds(bounds.pad(0.35), {
            animate: false,
            maxZoom: 18
        });
    },

    setActivePoint: function(point, panMap) {
        if (!point) return;

        this.activePoint = point;
        if (panMap && this.map) {
            this.map.panTo([point.lat, point.lng], { animate: true, duration: 0.45 });
        }
    },

    requestQrScan: function() {
        const userId = localStorage.getItem('eco_user_id');
        const db = window.supabaseClient || window.supabaseDB;

        if (!userId || !db) {
            alert("Debes registrarte o iniciar sesion primero.");
            return;
        }

        this.openQrScanner();
    },

   openQrScanner: async function() {
        this.closeQrScanner();
        this.scanLocked = false;

        const modal = document.createElement('div');
        modal.className = 'qr-scanner-modal';
        modal.innerHTML = `
            <div class="qr-scanner-shell">
                <button class="qr-close-btn" aria-label="Cerrar scanner" onclick="CampusModule.closeQrScanner()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="qr-scanner-header">
                    <span><i class="fa-solid fa-qrcode"></i> RECONOCIMIENTO ACTIVO</span>
                    <h3>${this.activePoint.name}</h3>
                    <p>Apunta la cámara directamente al código QR físico.</p>
                </div>
                <div class="qr-camera-frame">
                    <video id="qr-camera-video" autoplay playsinline muted></video>
                    <canvas id="qr-scan-canvas" style="display: none;"></canvas>
                    <div class="qr-scan-box">
                        <span></span><span></span><span></span><span></span>
                    </div>
                    <div class="qr-scan-line"></div>
                </div>
                <p id="qr-scan-status" class="qr-scan-status">Iniciando lente de la cámara...</p>
            </div>
        `;
        document.body.appendChild(modal);

        const video = document.getElementById('qr-camera-video');
        const status = document.getElementById('qr-scan-status');

        if (!navigator.mediaDevices?.getUserMedia) {
            status.innerText = "Error: Este navegador no permite acceso a la cámara o requiere HTTPS.";
            return;
        }

        try {
            this.scanStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 640 }, // Bajamos un poco la resolución para optimizar el procesamiento en vivo en móviles
                    height: { ideal: 480 }
                },
                audio: false
            });
            video.srcObject = this.scanStream;
            await video.play();

            status.innerText = "Buscando código QR en tiempo real...";
            
            // Priorizamos jsQR si la librería cargó correctamente en el objeto global de ventana
            if (typeof jsQR === 'function') {
                this.scanQrLoopFallback(video);
            } else if ('BarcodeDetector' in window) {
                // Respaldo secundario por hardware nativo
                const detector = new BarcodeDetector({ formats: ['qr_code'] });
                this.scanQrLoop(video, detector);
            } else {
                status.innerText = "Error: No se pudo cargar el decodificador QR (jsQR).";
            }
        } catch (error) {
            console.error("No se pudo abrir la camara:", error);
            status.innerText = "Error de hardware: Permiso de cámara denegado o bloqueado.";
        }
    },

    scanQrLoop: function(video, detector) {
        const scan = async () => {
            if (this.scanLocked || !document.body.contains(video)) return;

            try {
                if (video.readyState >= 2) {
                    const codes = await detector.detect(video);
                    if (codes.length > 0) {
                        const valorDetectado = codes[0].rawValue;
                        if (valorDetectado) {
                            this.handleQrDetected(valorDetectado);
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error("Fallo loop nativo:", error);
            }
            this.scanAnimationFrame = requestAnimationFrame(scan);
        };
        this.scanAnimationFrame = requestAnimationFrame(scan);
    },

    // ESTA FUNCIÓN PROCESA E IDENTIFICA LOS QR DE FORMA UNIVERSAL USANDO CANVAS Y JSQR
    scanQrLoopFallback: function(video) {
        const canvas = document.getElementById('qr-scan-canvas');
        if (!canvas) return;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        const scanFallback = () => {
            if (this.scanLocked || !document.body.contains(video)) return;

            if (video.readyState >= 2) {
                // Ajustar tamaño del lienzo interno al tamaño real del flujo de video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // Dibujar el cuadro actual de la cámara en el canvas oculto
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Extraer la información de colores/píxeles
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                
                // Ejecutar motor jsQR
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    console.log("[Lector jsQR] Código detectado:", code.data);
                    this.handleQrDetected(code.data);
                    return; // Detiene el bucle inmediatamente tras la lectura
                }
            }
            this.scanAnimationFrame = requestAnimationFrame(scanFallback);
        };
        this.scanAnimationFrame = requestAnimationFrame(scanFallback);
    },

    handleQrDetected: async function(qrValue) {
        if (this.scanLocked || !qrValue) return;
        this.scanLocked = true;

        const status = document.getElementById('qr-scan-status');
        if (status) status.innerText = "Código reconocido. Validando parámetros...";

        await this.processRecycling(qrValue);
    },

    closeQrScanner: function() {
        if (this.scanAnimationFrame) {
            cancelAnimationFrame(this.scanAnimationFrame);
            this.scanAnimationFrame = null;
        }

        if (this.scanStream) {
            this.scanStream.getTracks().forEach(track => track.stop());
            this.scanStream = null;
        }

        const modal = document.querySelector('.qr-scanner-modal');
        if (modal) modal.remove();
        this.scanLocked = false;
    },

    validarCodigoQR: function(qrValue) {
        if (!qrValue) return false;

        let valorCrudo = String(qrValue).trim().toLowerCase();

        if (valorCrudo.includes('?point=')) {
            valorCrudo = valorCrudo.split('?point=')[1];
        } else if (valorCrudo.includes('=')) {
            valorCrudo = valorCrudo.split('=').pop();
        } else if (valorCrudo.includes('/')) {
            valorCrudo = valorCrudo.split('/').pop();
        }

        const idEsperado = String(this.activePoint.id);
        console.log(`[Seguridad Campus] QR Leído: "${valorCrudo}" | Requerido en base de datos: "${idEsperado}"`);

        return valorCrudo === idEsperado;
    },

    processRecycling: async function(qrValue, options = {}) {
        const userId = localStorage.getItem('eco_user_id');
        const db = window.supabaseClient || window.supabaseDB;

        if (!userId || !db) {
            alert("Debes registrarte o iniciar sesion primero.");
            this.closeQrScanner();
            return;
        }

        // --- VALIDACIÓN 1: COMPUERTA DE RECONOCIMIENTO ÓPTICO OBLIGATORIA ---
        const qrEsValido = this.validarCodigoQR(qrValue);

        if (!qrEsValido) {
            alert(`❌ Código Inválido: El código QR escaneado por la cámara no pertenece a "${this.activePoint.name}". Camina hacia el punto correcto.`);
            this.closeQrScanner();
            return;
        }

        // --- VALIDACIÓN 2: CONTROL DE GPS REAL ---
        if (!options.simulated && !this.playerMarker) {
            alert("❌ Error: Buscando una señal de geolocalización estable.");
            this.scanLocked = false;
            return;
        }

        const playerLatLng = this.playerMarker?.getLatLng();
        const targetLatLng = L.latLng(this.activePoint.lat, this.activePoint.lng);
        const distanceMeters = playerLatLng ? playerLatLng.distanceTo(targetLatLng) : 0;

        if (!options.simulated && distanceMeters > 25) {
            alert(`❌ Ubicación no coincide: Estás a ${Math.round(distanceMeters)}m de este EcoPoint. Debes situarte al lado del basurero real.`);
            this.closeQrScanner();
            return;
        }

        try {
            // --- VALIDACIÓN 3: CONTROL ANTI-SPAM (10 MINUTOS) ---
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            
            const { data: recentScans, errorCheck } = await db
                .from('historial_reciclaje')
                .select('id')
                .eq('usuario_id', userId)
                .eq('basurero_id', this.activePoint.id)
                .gt('creado_en', tenMinutesAgo);

            if (errorCheck) throw errorCheck;

            if (recentScans && recentScans.length > 0) {
                alert(`⚠️ Límite alcanzado: Ya has validado "${this.activePoint.name}" recientemente. Espera 10 minutos.`);
                this.closeQrScanner();
                return;
            }

            // Registrar en historial_reciclaje
            const { error: errorHistorial } = await db
                .from('historial_reciclaje')
                .insert([{ usuario_id: userId, basurero_id: this.activePoint.id }]);

            if (errorHistorial) throw errorHistorial;

            // Extraer y actualizar puntos en la tabla usuarios
            const { data: usuario, errorFetch } = await db
                .from('usuarios')
                .select('puntos')
                .eq('id', userId);

            if (errorFetch || !usuario || usuario.length === 0) throw errorFetch;

            const nuevosPuntos = (usuario[0].puntos || 0) + this.activePoint.points;

            const { error: errorUpdate } = await db
                .from('usuarios')
                .update({
                    puntos: nuevosPuntos,
                    actualizado_en: new Date().toISOString()
                })
                .eq('id', userId);

            if (errorUpdate) throw errorUpdate;

            if (typeof actualizarPuntosCabecera === 'function') {
                await actualizarPuntosCabecera();
            }

            const unlockedPet = window.EcoCollectibles?.unlockRandom();
            window.EcoCollectibles?.incrementRecycleCount();

            this.closeQrScanner();
            this.showPetRewardCard(unlockedPet, qrValue);
            
        } catch (err) {
            console.error("Error crítico en transacción:", err.message);
            alert("Error de conexión con Supabase.");
            this.scanLocked = false;
        }
    },

    showPetRewardCard: function(unlockedPet) {
        const pet = unlockedPet || window.EcoCollectibles?.items[window.EcoCollectibles.items.length - 1];
        const isDuplicate = Boolean(unlockedPet?.isDuplicate);
        const rewardLabel = isDuplicate ? 'Carta repetida' : 'Nueva carta';
        const frontLabel = isDuplicate ? 'Ya la tenias' : 'Mascota desbloqueada';
        const petImage = pet?.image || 'assets/collectibles/1.avif';

        const modal = document.createElement('div');
        modal.className = 'reward-reveal-modal';
        modal.innerHTML = `
            <div class="reward-sparkles">
                ${Array.from({ length: 18 }).map((_, index) => `<span style="--i:${index}"></span>`).join('')}
            </div>
            <div class="reward-card-flip">
                <div class="reward-card-inner">
                    <div class="reward-card-face reward-card-back reward-card-prize">
                        <span class="reward-tag">${rewardLabel}</span>
                        <img src="${petImage}" alt="${pet?.name || 'Mascota'}">
                        <strong>${pet?.name || 'Mascota eco'}</strong>
                    </div>
                    <div class="reward-card-face reward-card-front">
                        <span class="reward-tag">${frontLabel}</span>
                        <img src="${petImage}" alt="${pet?.name || 'Mascota'}">
                        <h3>${pet?.name || 'Mascota eco'}</h3>
                        <p>${pet.rarity} - ${pet.type}${isDuplicate ? ' - repetida' : ''}</p>
                        <b>+${this.activePoint.points} EcoPuntos</b>
                    </div>
                </div>
            </div>
            <button class="reward-continue-btn" onclick="this.closest('.reward-reveal-modal').remove(); switchView('coleccion');">
                Ver coleccion
            </button>
        `;
        document.body.appendChild(modal);
    },

    startLocationTracking: function() {
        if (!navigator.geolocation) return;

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = Math.min(position.coords.accuracy || 25, 80);
                const currentLatLng = L.latLng(lat, lng);
                const campusDistance = currentLatLng.distanceTo(L.latLng(this.campusCenter));
                const status = document.getElementById('campus-status');

                if (status) {
                    status.innerText = campusDistance <= this.campusRadiusMeters ? "Estas en UAJMS" : "Fuera del campus";
                }

                this.setPlayerPosition(lat, lng, accuracy, false);
                this.updateNearbyBins(lat, lng);
            },
            () => {
                const status = document.getElementById('campus-status');
                if (status) status.innerText = "GPS pendiente";
                if (!this.playerMarker) {
                    this.setPlayerPosition(this.campusCenter[0], this.campusCenter[1], 30, false);
                    this.updateNearbyBins(this.campusCenter[0], this.campusCenter[1]);
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 3000,
                timeout: 10000
            }
        );
    },

    setPlayerPosition: function(lat, lng, accuracy, centerMap) {
        if (!this.map) return;

        const icon = L.divIcon({
            html: `
                <div class="player-avatar-marker">
                    <span class="player-shadow"></span>
                    <div class="player-body">
                        <i class="fa-solid fa-person-walking"></i>
                    </div>
                    <span class="player-direction"></span>
                </div>
            `,
            className: 'custom-leaflet-marker',
            iconSize: [58, 74],
            iconAnchor: [29, 58]
        });

        if (!this.playerMarker) {
            this.playerMarker = L.marker([lat, lng], {
                icon,
                zIndexOffset: 1000
            }).addTo(this.map);
        } else {
            this.playerMarker.setLatLng([lat, lng]);
        }

        if (!this.accuracyCircle) {
            this.accuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#38bdf8',
                fillColor: '#7dd3fc',
                fillOpacity: 0.16,
                weight: 2,
                interactive: false
            }).addTo(this.map);
        } else {
            this.accuracyCircle.setLatLng([lat, lng]);
            this.accuracyCircle.setRadius(accuracy);
        }

        if (centerMap) {
            this.map.setView([lat, lng], 19, { animate: true });
        }
    },

    updateNearbyBins: function(lat, lng) {
        if (!this.map || this.ecoPoints.length === 0) return;

        const current = L.latLng(lat, lng);
        const sorted = this.ecoPoints
            .map(point => ({
                ...point,
                distance: Math.round(current.distanceTo(L.latLng(point.lat, point.lng)))
            }))
            .sort((a, b) => a.distance - b.distance);
        const recommended = sorted[0];

        if (recommended) {
            this.setActivePoint(recommended, false);
        }
    },

    selectEcoPoint: function(pointId) {
        const point = this.ecoPoints.find(item => item.id === Number(pointId));
        if (!point || !this.map) return;

        this.setActivePoint(point, true);
        this.requestQrScan();
    }
};
