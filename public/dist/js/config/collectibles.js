// js/config/collectibles.js
window.EcoCollectibles = {
    storageKey: 'eco_unlocked_collectibles',
    recycleKey: 'eco_recycle_count',
    items: [
        { id: 10, name: "Guardian Verde", rarity: "Legendaria", type: "Naturaleza", image: "assets/collectibles/10.avif" },
        { id: 9, name: "EcoBuho", rarity: "Epica", type: "Conocimiento", image: "assets/collectibles/9.avif" },
        { id: 8, name: "Chispin", rarity: "Epica", type: "Energia", image: "assets/collectibles/8.avif" },
        { id: 7, name: "Flora", rarity: "Rara", type: "Campus verde", image: "assets/collectibles/7.avif" },
        { id: 6, name: "Metalico", rarity: "Rara", type: "Metal", image: "assets/collectibles/6.avif" },
        { id: 5, name: "Compostin", rarity: "Poco Comun", type: "Organico", image: "assets/collectibles/5.avif" },
        { id: 4, name: "Gotin", rarity: "Poco Comun", type: "Agua", image: "assets/collectibles/4.avif" },
        { id: 3, name: "Frasquito", rarity: "Poco Comun", type: "Vidrio", image: "assets/collectibles/3.avif" },
        { id: 2, name: "Cartonix", rarity: "Comun", type: "Carton", image: "assets/collectibles/2.avif" },
        { id: 1, name: "Botellin", rarity: "Comun", type: "Plastico", image: "assets/collectibles/1.avif", model: "assets/models/figura10.glb" }
    ],

    getUnlockedIds: function() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '[]')
                .map(Number)
                .filter(id => Number.isInteger(id));
        } catch (error) {
            return [];
        }
    },

    saveUnlockedIds: function(ids) {
        const uniqueIds = [...new Set(ids.map(Number))]
            .filter(id => this.items.some(item => item.id === id));
        localStorage.setItem(this.storageKey, JSON.stringify(uniqueIds));
        return uniqueIds;
    },

    isUnlocked: function(id) {
        return this.getUnlockedIds().includes(Number(id));
    },

    getProgress: function() {
        const unlocked = this.getUnlockedIds();
        return {
            unlocked,
            count: unlocked.length,
            total: this.items.length,
            complete: unlocked.length >= this.items.length
        };
    },

    legendaryChance: 0.001,

    getUnlockWeight: function(item) {
        const rarityWeights = {
            "Comun": 45,
            "Poco Comun": 25,
            "Rara": 12,
            "Epica": 4,
            "Legendaria": 0.1
        };

        return rarityWeights[item.rarity] || 10;
    },

    rollRandomItem: function() {
        const legendaryItem = this.items.find(item => item.id === 10 || item.rarity === "Legendaria");
        const regularItems = this.items.filter(item => item !== legendaryItem);

        if (legendaryItem && Math.random() < this.legendaryChance) {
            return legendaryItem;
        }

        const candidates = regularItems.length ? regularItems : this.items;
        const totalWeight = candidates.reduce((sum, item) => sum + this.getUnlockWeight(item), 0);
        let roll = Math.random() * totalWeight;
        let selectedItem = candidates[candidates.length - 1];

        for (const item of candidates) {
            roll -= this.getUnlockWeight(item);
            if (roll <= 0) {
                selectedItem = item;
                break;
            }
        }

        return selectedItem;
    },

    unlockRandom: function() {
        const unlocked = this.getUnlockedIds();
        const selectedItem = this.rollRandomItem();
        if (!selectedItem) return null;

        const alreadyUnlocked = unlocked.includes(selectedItem.id);
        if (!alreadyUnlocked) {
            this.saveUnlockedIds([...unlocked, selectedItem.id]);
        }

        return {
            ...selectedItem,
            isNew: !alreadyUnlocked,
            isDuplicate: alreadyUnlocked
        };
    },

    unlockNext: function() {
        return this.unlockRandom();
    },

    incrementRecycleCount: function() {
        const current = Number(localStorage.getItem(this.recycleKey) || '0') + 1;
        localStorage.setItem(this.recycleKey, String(current));
        return current;
    },

    getRecycleCount: function() {
        return Number(localStorage.getItem(this.recycleKey) || '0');
    }
};
