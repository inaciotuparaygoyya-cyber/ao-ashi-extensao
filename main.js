OBR.onReady(async () => {
    console.log("Ao Ashi TTRPG - Pronto");

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
    let userRole = "PLAYER";

    try {
        const role = await OBR.player.getRole();
        userRole = role;
        if (role === "GM" && btnGm) {
            btnGm.style.display = "block";
        }
    } catch (e) {
        console.log("Erro ao verificar papel:", e);
    }

    // Monitorização de seleção na mesa
    OBR.player.onChange(async (player) => {
        await handleSelectionChange(player.selection);
    });

    checkInitialSelection();

    async function checkInitialSelection() {
        try {
            const selection = await OBR.player.getSelection();
            await handleSelectionChange(selection);
        } catch (err) {
            console.error("Erro na seleção inicial:", err);
        }
    }

    async function handleSelectionChange(selection) {
        if (!selection || selection.length === 0) {
            currentTokenId = null;
            showState("none");
            return;
        }

        currentTokenId = selection[0];

        try {
            const items = await OBR.scene.items.getItems([currentTokenId]);
            const token = items[0];

            if (!token) {
                showState("none");
                return;
            }

            if (!token.metadata) token.metadata = {};
            const meta = token.metadata["aoashi/sheet"] || {};

            // Restrição de Mestre: Se a ficha for de Mestre e quem está a ver for um Jogador comum, bloqueia
            if (meta.role === "Mestre" && userRole !== "GM") {
                showState("none");
                alert("Esta ficha é restrita ao Mestre!");
                return;
            }

            if (!meta.role) {
                showState("role");
            } else {
                showState("sheet");
                renderSheet(token, meta);
            }
        } catch (error) {
            console.error("Erro ao carregar token:", error);
        }
    }

    function showState(state) {
        if (noSelectionEl) noSelectionEl.style.display = (state === "none") ? "block" : "none";
        if (roleSelectionEl) roleSelectionEl.style.display = (state === "role") ? "block" : "none";
        if (sheetEl) sheetEl.style.display = (state === "sheet") ? "block" : "none";
    }

    if (btnPlayer) btnPlayer.onclick = () => assignRole("Jogador");
    if (btnGm) btnGm.onclick = () => assignRole("Mestre");
    if (btnBackRole) btnBackRole.onclick = () => assignRole(null);

    async function assignRole(roleName) {
        if (!currentTokenId) return;

        if (roleName === "Mestre" && userRole !== "GM") {
            alert("Apenas o Mestre pode criar uma ficha de Mestre!");
            return;
        }

        await OBR.scene.items.updateItems([currentTokenId], (items) => {
            for (let item of items) {
                if (!item.metadata["aoashi/sheet"]) {
                    item.metadata["aoashi/sheet"] = {};
                }
                if (roleName === null) {
                    delete item.metadata["aoashi/sheet"].role;
                } else {
                    item.metadata["aoashi/sheet"].role = roleName;
                }
            }
        });

        const selection = await OBR.player.getSelection();
        await handleSelectionChange(selection);
    }

    function renderSheet(token, meta) {
        if (nameInput) {
            nameInput.value = meta.name || token.text?.plainText || token.name || "Atleta";
        }

        if (roleBadge) {
            roleBadge.textContent = meta.role || "Jogador";
            roleBadge.className = "role-badge " + (meta.role === "Mestre" ? "gm-badge" : "player-badge");
        }

        const approachesData = [
            { key: "vis", label: "VIS", name: "Visão" },
            { key: "fis", label: "FIS", name: "Físico" },
            { key: "con", label: "CON", name: "Condução" },
            { key: "gar", label: "GAR", name: "Garra" },
            { key: "ins", label: "INS", name: "Instinto" },
            { key: "tec", label: "TEC", name: "Técnica" }
        ];

        if (approachGrid) {
            approachGrid.innerHTML = "";
            approachesData.forEach(app => {
                const vals = meta.approaches || {};
                const currentVal = vals[app.key] ?? 0;

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
                input.oninput = async (e) => {
                    const key = e.target.dataset.key;
                    const val = Number(e.target.value);
                    await updateTokenData(item => {
                        if (!item.approaches) item.approaches = {};
                        item.approaches[key] = val;
                    });
                };
            });

            approachGrid.querySelectorAll(".roll-btn").forEach(btn => {
                btn.onclick = (e) => {
                    const label = e.target.dataset.label;
                    const key = e.target.dataset.key;
                    const vals = meta.approaches || {};
                    const bonus = vals[key] ?? 0;
                    execute4DFRoll(label, bonus, meta.role === "Mestre");
                };
            });
        }

        renderDynamicList("aspects", meta.aspects || [], false);
        renderDynamicList("techniques", meta.techniques || [], true);
        renderDynamicList("flaws", meta.flaws || [], false);
    }

    function execute4DFRoll(label, bonus, isGm) {
        let results = [];
        let sum = 0;
        for (let i = 0; i < 4; i++) {
            const r = Math.floor(Math.random() * 3) - 1;
            results.push(r);
            sum += r;
        }
        const total = sum + bonus;
        const formattedTotal = total >= 0 ? `+${total}` : `${total}`;
        const detailStr = results.map(r => r > 0 ? '[+]' : r < 0 ? '[-]' : '[ ]').join(' ');
        const athleteName = nameInput ? nameInput.value : "Atleta";

        const msg = `⚽ [${label}] ${athleteName} rolou 4DF: ${detailStr} (Mod: ${bonus >= 0 ? '+' + bonus : bonus}) ➔ **Resultado: ${formattedTotal}**`;

        if (isGm) {
            alert(`[Rolagem Oculta do Mestre]\n${msg}`);
        } else {
            alert(msg);
        }
    }

    function renderDynamicList(type, itemsList, allowColor) {
        const container = document.getElementById(`container-${type}`);
        if (!container) return;
        container.innerHTML = "";

        itemsList.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "dynamic-item";
            card.style.borderColor = item.color || "#00d2d3";

            card.innerHTML = `
                <div class="item-inputs">
                    <input type="text" class="item-title" placeholder="Título..." value="${item.title || ''}" data-type="${type}" data-index="${index}" style="color: ${item.color || '#fff'}">
                    <textarea class="item-desc" placeholder="Descrição..." data-type="${type}" data-index="${index}">${item.desc || ''}</textarea>
                </div>
                <div class="item-controls">
                    ${allowColor ? `<input type="color" class="item-color" value="${item.color || '#00d2d3'}" data-type="${type}" data-index="${index}">` : ''}
                    <button class="delete-btn" data-type="${type}" data-index="${index}">🗑️</button>
                </div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll("input, textarea").forEach(el => {
            el.oninput = async (e) => {
                const t = e.target.dataset.type;
                const idx = Number(e.target.dataset.index);
                const isColor = e.target.classList.contains("item-color");
                const isTitle = e.target.classList.contains("item-title");
                const field = isColor ? "color" : (isTitle ? "title" : "desc");

                await updateTokenData(item => {
                    if (!item[t]) item[t] = [];
                    if (!item[t][idx]) item[t][idx] = { title: "", desc: "", color: "#00d2d3" };
                    item[t][idx][field] = e.target.value;

                    if (isColor) {
                        const titleField = container.querySelectorAll(".item-title")[idx];
                        if (titleField) titleField.style.color = e.target.value;
                    }
                });
            };
        });

        container.querySelectorAll(".delete-btn").forEach(btn => {
            btn.onclick = async (e) => {
                const t = e.target.dataset.type;
                const idx = Number(e.target.dataset.index);
                await updateTokenData(item => {
                    if (item[t]) item[t].splice(idx, 1);
                });
                const selection = await OBR.player.getSelection();
                await handleSelectionChange(selection);
            };
        });
    }

    document.querySelectorAll(".add-item-btn").forEach(btn => {
        btn.onclick = async (e) => {
            const target = e.target.dataset.target;
            await updateTokenData(item => {
                if (!item[target]) item[target] = [];
                item[target].push({ title: "", desc: "", color: "#00d2d3" });
            });
            const selection = await OBR.player.getSelection();
            await handleSelectionChange(selection);
        };
    });

    if (nameInput) {
        nameInput.oninput = async (e) => {
            const val = e.target.value;
            await updateTokenData(item => {
                item.name = val;
            });
        };
    }

    async function updateTokenData(updater) {
        if (!currentTokenId) return;
        await OBR.scene.items.updateItems([currentTokenId], (items) => {
            for (let item of items) {
                if (!item.metadata["aoashi/sheet"]) {
                    item.metadata["aoashi/sheet"] = {};
                }
                updater(item.metadata["aoashi/sheet"]);
            }
        });
    }
});
