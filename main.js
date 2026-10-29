OBR.onReady(async () => {
    console.log("Ao Ashi TTRPG - Sistema Carregado e Pronto");

    const noSelectionEl = document.getElementById("no-selection");
    const roleSelectionEl = document.getElementById("role-selection");
    const sheetEl = document.getElementById("character-sheet");
    const btnPlayer = document.getElementById("btn-player");
    const btnGm = document.getElementById("btn-gm");
    const btnBackRole = document.getElementById("btn-back-role");
    const roleBadge = document.getElementById("active-role-badge");
    const nameInput = document.getElementById("athlete-name");
    const approachGrid = document.getElementById("approach-grid");

    let currentTokenId = null;
    let isGM = false;

    // Verifica o papel do utilizador na sala
    try {
        const role = await OBR.player.getRole();
        isGM = (role === "GM");
        if (isGM && btnGm) {
            btnGm.style.display = "block";
        }
    } catch (e) {
        console.log("Erro ao checar papel do jogador:", e);
    }

    const approachesData = [
        { key: "vis", label: "VIS", name: "Visão", val: 0 },
        { key: "fis", label: "FIS", name: "Físico", val: 0 },
        { key: "con", label: "CON", name: "Condução", val: 0 },
        { key: "gar", label: "GAR", name: "Garra", val: 0 },
        { key: "ins", label: "INS", name: "Instinto", val: 0 },
        { key: "tec", label: "TEC", name: "Técnica", val: 0 }
    ];

    // Verifica a seleção atual logo ao abrir a extensão
    checkCurrentSelection();

    // Ouve alterações de seleção na mesa
    OBR.player.onChange((player) => {
        handleSelection(player.selection);
    });

    async function checkCurrentSelection() {
        try {
            const selection = await OBR.player.getSelection();
            handleSelection(selection);
        } catch (e) {
            console.log("Erro ao buscar seleção inicial:", e);
        }
    }

    async function handleSelection(selection) {
        if (!selection || selection.length === 0) {
            currentTokenId = null;
            noSelectionEl.style.display = "block";
            roleSelectionEl.style.display = "none";
            sheetEl.style.display = "none";
            return;
        }

        currentTokenId = selection[0];
        
        try {
            const items = await OBR.scene.items.getItems([currentTokenId]);
            const token = items[0];
            if (!token) return;

            noSelectionEl.style.display = "none";
            const meta = token.metadata["com.aoashi.ttrpg/data"] || {};

            if (!meta.role) {
                roleSelectionEl.style.display = "block";
                sheetEl.style.display = "none";
            } else {
                roleSelectionEl.style.display = "none";
                sheetEl.style.display = "block";
                renderSheet(token);
            }
        } catch (err) {
            console.log("Erro ao carregar dados do token:", err);
        }
    }

    // Botões de Escolha de Papel
    if (btnPlayer) btnPlayer.addEventListener("click", () => setTokenRole("Jogador"));
    if (btnGm) btnGm.addEventListener("click", () => setTokenRole("Mestre"));
    if (btnBackRole) btnBackRole.addEventListener("click", () => resetTokenRole());

    async function setTokenRole(roleName) {
        if (!currentTokenId) return;
        await updateTokenMeta((meta) => {
            meta.role = roleName;
        });
        roleSelectionEl.style.display = "none";
        sheetEl.style.display = "block";
        const items = await OBR.scene.items.getItems([currentTokenId]);
        renderSheet(items[0]);
    }

    async function resetTokenRole() {
        if (!currentTokenId) return;
        await updateTokenMeta((meta) => {
            delete meta.role;
        });
        roleSelectionEl.style.display = "block";
        sheetEl.style.display = "none";
    }

    function renderSheet(token) {
        const meta = token.metadata["com.aoashi.ttrpg/data"] || {};
        if (nameInput) nameInput.value = meta.name || token.text?.plainText || token.name || "Atleta";
        
        if (roleBadge) {
            roleBadge.textContent = meta.role || "Jogador";
            roleBadge.className = "role-badge " + (meta.role === "Mestre" ? "gm-badge" : "player-badge");
        }

        if (approachGrid) {
            approachGrid.innerHTML = "";
            approachesData.forEach(app => {
                const currentVal = meta.approaches?.[app.key] ?? app.val;
                const div = document.createElement("div");
                div.className = "approach-card";
                div.innerHTML = `
                    <div class="approach-info">
                        <span class="app-label">${app.label}</span>
                        <span class="app-fullname">${app.name}</span>
                    </div>
                    <div class="approach-action">
                        <input type="number" class="approach-val" data-key="${app.key}" value="${currentVal}">
                        <button class="roll-btn" data-key="${app.key}" data-label="${app.label}">
                            (${currentVal >= 0 ? '+' + currentVal : currentVal}) 🎲
                        </button>
                    </div>
                `;
                approachGrid.appendChild(div);
            });

            approachGrid.querySelectorAll(".approach-val").forEach(input => {
                input.addEventListener("input", async (e) => {
                    const key = e.target.dataset.key;
                    const val = Number(e.target.value);
                    await updateTokenMeta(meta => {
                        if (!meta.approaches) meta.approaches = {};
                        meta.approaches[key] = val;
                    });
                });
            });

            approachGrid.querySelectorAll(".roll-btn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const key = e.target.dataset.key;
                    const label = e.target.dataset.label;
                    const bonus = meta.approaches?.[key] ?? 0;
                    roll4DF(label, bonus, meta.role === "Mestre");
                });
            });
        }

        renderList("aspects", meta.aspects || []);
        renderList("techniques", meta.techniques || [], true);
        renderList("flaws", meta.flaws || []);
    }

    async function roll4DF(label, bonus, isGmRole) {
        let rollResults = [];
        let rollSum = 0;
        for (let i = 0; i < 4; i++) {
            const r = Math.floor(Math.random() * 3) - 1;
            rollResults.push(r);
            rollSum += r;
        }
        const total = rollSum + bonus;
        const formattedTotal = total >= 0 ? `+${total}` : `${total}`;
        const detailStr = rollResults.map(r => r > 0 ? '[+]' : r < 0 ? '[-]' : '[ ]').join(' ');

        const athleteName = nameInput ? nameInput.value : "Atleta";
        const chatMessage = `⚽ [${label}] ${athleteName} rolou 4DF: ${detailStr} (Mod: ${bonus >= 0 ? '+' + bonus : bonus}) ➔ **Resultado: ${formattedTotal}**`;

        if (isGmRole) {
            await OBR.room.setMetadata({ "com.aoashi.ttrpg/last-roll": { secret: true, text: chatMessage, time: Date.now() } });
            alert(`[Rolagem Oculta do Mestre]\n${chatMessage}`);
        } else {
            await OBR.room.setMetadata({ "com.aoashi.ttrpg/last-roll": { secret: false, text: chatMessage, time: Date.now() } });
            alert(`${chatMessage}`);
        }
    }

    function renderList(type, items, allowCustomColor = false) {
        const container = document.getElementById(`container-${type}`);
        if (!container) return;
        container.innerHTML = "";

        items.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "dynamic-item";
            card.style.borderColor = item.color || "#485460";

            card.innerHTML = `
                <div class="item-inputs">
                    <input type="text" class="item-title" placeholder="Título..." value="${item.title || ''}" data-type="${type}" data-index="${index}" style="color: ${item.color || '#fff'}">
                    <textarea class="item-desc" placeholder="Descrição..." data-type="${type}" data-index="${index}">${item.desc || ''}</textarea>
                </div>
                <div class="item-controls">
                    ${allowCustomColor ? `<input type="color" class="item-color" value="${item.color || '#00d2d3'}" data-type="${type}" data-index="${index}" title="Mudar cor da letra">` : ''}
                    <button class="delete-item-btn" data-type="${type}" data-index="${index}">🗑️</button>
                </div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll("input, textarea").forEach(el => {
            el.addEventListener("input", async (e) => {
                const t = e.target.dataset.type;
                const idx = Number(e.target.dataset.index);
                const field = e.target.classList.contains("item-title") ? "title" : e.target.classList.contains("item-color") ? "color" : "desc";
                
                await updateTokenMeta(meta => {
                    if (!meta[t]) meta[t] = [];
                    if (!meta[t][idx]) meta[t][idx] = { title: "", desc: "", color: "#ffffff" };
                    meta[t][idx][field] = e.target.value;
                    if (field === "color") {
                        const titleInput = container.querySelectorAll(".item-title")[idx];
                        if (titleInput) titleInput.style.color = e.target.value;
                    }
                });
            });
        });

        container.querySelectorAll(".delete-item-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const t = e.target.dataset.type;
                const idx = Number(e.target.dataset.index);
                await updateTokenMeta(meta => {
                    if (meta[t]) meta[t].splice(idx, 1);
                });
                const items = await OBR.scene.items.getItems([currentTokenId]);
                renderSheet(items[0]);
            });
        });
    }

    document.querySelectorAll(".add-item-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const targetType = e.target.dataset.target;
            await updateTokenMeta(meta => {
                if (!meta[targetType]) meta[targetType] = [];
                meta[targetType].push({ title: "", desc: "", color: "#00d2d3" });
            });
            const items = await OBR.scene.items.getItems([currentTokenId]);
            renderSheet(items[0]);
        });
    });

    if (nameInput) {
        nameInput.addEventListener("input", async (e) => {
            const val = e.target.value;
            await updateTokenMeta(meta => {
                meta.name = val;
            });
        });
    }

    async function updateTokenMeta(updateFn) {
        if (!currentTokenId) return;
        await OBR.scene.items.updateItems([currentTokenId], (items) => {
            for (let item of items) {
                if (!item.metadata["com.aoashi.ttrpg/data"]) {
                    item.metadata["com.aoashi.ttrpg/data"] = {};
                }
                updateFn(item.metadata["com.aoashi.ttrpg/data"]);
            }
        });
    }
});
