OBR.onReady(async () => {
    console.log("Ao Ashi TTRPG - Pronto e Operacional");

    const noSelectionEl = document.getElementById("no-selection");
    const roleSelectionEl = document.getElementById("role-selection");
    const sheetEl = document.getElementById("character-sheet");
    
    const btnPlayer = document.getElementById("btn-player");
    const btnGm = document.getElementById("btn-gm");
    const btnReset = document.getElementById("btn-reset");
    const nameInput = document.getElementById("athlete-name");
    const roleBadge = document.getElementById("role-badge");
    const approachList = document.getElementById("approach-list");

    let activeTokenId = null;
    let isUserGM = false;

    // Verifica se quem está a usar é o Mestre
    try {
        const role = await OBR.player.getRole();
        isUserGM = (role === "GM");
        if (isUserGM && btnGm) btnGm.style.display = "block";
    } catch (e) {
        console.log("Erro ao checar papel do utilizador:", e);
    }

    // Função principal que lê o token selecionado assim que a ficha abre ou muda
    async function loadTokenData() {
        const selection = await OBR.player.getSelection();
        if (!selection || selection.length === 0) {
            activeTokenId = null;
            noSelectionEl.style.display = "block";
            roleSelectionEl.style.display = "none";
            sheetEl.style.display = "none";
            return;
        }

        activeTokenId = selection[0];
        const items = await OBR.scene.items.getItems([activeTokenId]);
        const token = items[0];

        if (!token) {
            noSelectionEl.style.display = "block";
            roleSelectionEl.style.display = "none";
            sheetEl.style.display = "none";
            return;
        }

        noSelectionEl.style.display = "none";
        if (!token.metadata) token.metadata = {};
        const meta = token.metadata["aoashi/data"] || {};

        // Restrição de Mestre
        if (meta.role === "Mestre" && !isUserGM) {
            noSelectionEl.style.display = "block";
            noSelectionEl.innerHTML = "<h3>🔒 Ficha Restrita</h3><p>Apenas o Mestre pode aceder a esta ficha.</p>";
            roleSelectionEl.style.display = "none";
            sheetEl.style.display = "none";
            return;
        }

        if (!meta.role) {
            roleSelectionEl.style.display = "block";
            sheetEl.style.display = "none";
        } else {
            roleSelectionEl.style.display = "none";
            sheetEl.style.display = "block";
            renderSheet(token, meta);
        }
    }

    // Executa a leitura logo ao abrir
    loadTokenData();

    // Ouve alterações de seleção na mesa em tempo real
    OBR.player.onChange(() => {
        loadTokenData();
    });

    // Atribuir Papel (Jogador / Mestre)
    if (btnPlayer) btnPlayer.onclick = () => saveRole("Jogador");
    if (btnGm) btnGm.onclick = () => saveRole("Mestre");
    if (btnReset) btnReset.onclick = () => saveRole(null);

    async function saveRole(roleName) {
        if (!activeTokenId) return;
        await updateToken(meta => {
            if (roleName === null) delete meta.role;
            else meta.role = roleName;
        });
        loadTokenData();
    }

    // Renderiza a ficha no HTML
    function renderSheet(token, meta) {
        nameInput.value = meta.name || token.text?.plainText || token.name || "Atleta";
        roleBadge.textContent = meta.role || "Jogador";
        roleBadge.className = "badge " + (meta.role === "Mestre" ? "red" : "blue");

        // Abordagens
        const approaches = [
            { key: "vis", label: "VIS", name: "Visão" },
            { key: "fis", label: "FIS", name: "Físico" },
            { key: "con", label: "CON", name: "Condução" },
            { key: "gar", label: "GAR", name: "Garra" },
            { key: "ins", label: "INS", name: "Instinto" },
            { key: "tec", label: "TEC", name: "Técnica" }
        ];

        approachList.innerHTML = "";
        approaches.forEach(app => {
            const val = meta.approaches?.[app.key] ?? 0;
            const div = document.createElement("div");
            div.className = "approach-item";
            div.innerHTML = `
                <span><b>${app.label}</b> (${app.name})</span>
                <div class="approach-right">
                    <input type="number" class="app-input" data-key="${app.key}" value="${val}">
                    <button class="btn roll-btn" data-key="${app.key}" data-label="${app.label}">(${val >= 0 ? '+' + val : val}) 🎲</button>
                </div>
            `;
            approachList.appendChild(div);
        });

        // Atualizar valor das abordagens
        approachList.querySelectorAll(".app-input").forEach(input => {
            input.oninput = async (e) => {
                const key = e.target.dataset.key;
                const value = Number(e.target.value);
                await updateToken(meta => {
                    if (!meta.approaches) meta.approaches = {};
                    meta.approaches[key] = value;
                });
            };
        });

        // Sistema de Rolagem 4DF
        approachList.querySelectorAll(".roll-btn").forEach(btn => {
            btn.onclick = (e) => {
                const label = e.target.dataset.label;
                const key = e.target.dataset.key;
                const bonus = meta.approaches?.[key] ?? 0;
                
                // Rola 4 dados Fate (-1, 0, +1)
                let results = [];
                let sum = 0;
                for (let i = 0; i < 4; i++) {
                    const r = Math.floor(Math.random() * 3) - 1;
                    results.push(r);
                    sum += r;
                }
                const total = sum + bonus;
                const formatted = total >= 0 ? `+${total}` : `${total}`;
                const details = results.map(r => r > 0 ? '[+]' : r < 0 ? '[-]' : '[ ]').join(' ');
                
                const msg = `⚽ [${label}] ${nameInput.value} rolou 4DF: ${details} (Mod: ${bonus >= 0 ? '+' + bonus : bonus}) ➔ **Resultado: ${formatted}**`;

                if (meta.role === "Mestre") {
                    alert(`[Rolagem Oculta do Mestre]\n${msg}`);
                } else {
                    alert(msg);
                }
            };
        });

        // Listas dinâmicas (Aspectos, Técnicas, Falhas)
        renderList("aspects", meta.aspects || [], false);
        renderList("techniques", meta.techniques || [], true);
        renderList("flaws", meta.flaws || [], false);
    }

    // Renderizador genérico para Aspectos, Técnicas e Falhas
    function renderList(type, list, allowColor) {
        const container = document.getElementById(`container-${type}`);
        container.innerHTML = "";

        list.forEach((item, idx) => {
            const card = document.createElement("div");
            card.className = "dynamic-card";
            card.style.borderColor = item.color || "#00d2d3";

            card.innerHTML = `
                <div class="card-inputs">
                    <input type="text" class="c-title" placeholder="Título..." value="${item.title || ''}" data-type="${type}" data-idx="${idx}" style="color: ${item.color || '#fff'}">
                    <textarea class="c-desc" placeholder="Descrição..." data-type="${type}" data-idx="${idx}">${item.desc || ''}</textarea>
                </div>
                <div class="card-controls">
                    ${allowColor ? `<input type="color" class="c-color" value="${item.color || '#00d2d3'}" data-type="${type}" data-idx="${idx}">` : ''}
                    <button class="btn red delete-btn" data-type="${type}" data-idx="${idx}">🗑️</button>
                </div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll("input, textarea").forEach(el => {
            el.oninput = async (e) => {
                const t = e.target.dataset.type;
                const i = Number(e.target.dataset.idx);
                const isColor = e.target.classList.contains("c-color");
                const isTitle = e.target.classList.contains("c-title");
                const field = isColor ? "color" : (isTitle ? "title" : "desc");

                await updateToken(meta => {
                    if (!meta[t]) meta[t] = [];
                    if (!meta[t][i]) meta[t][i] = { title: "", desc: "", color: "#00d2d3" };
                    meta[t][i][field] = e.target.value;
                });
            };
        });

        container.querySelectorAll(".delete-btn").forEach(btn => {
            btn.onclick = async (e) => {
                const t = e.target.dataset.type;
                const i = Number(e.target.dataset.idx);
                await updateToken(meta => {
                    if (meta[t]) meta[t].splice(i, 1);
                });
                loadTokenData();
            };
        });
    }

    // Botões de Adicionar Item
    document.querySelectorAll(".add-btn").forEach(btn => {
        btn.onclick = async (e) => {
            const target = e.target.dataset.type;
            await updateToken(meta => {
                if (!meta[target]) meta[target] = [];
                meta[target].push({ title: "", desc: "", color: "#00d2d3" });
            });
            loadTokenData();
        };
    });

    if (nameInput) {
        nameInput.oninput = async (e) => {
            const val = e.target.value;
            await updateToken(meta => { meta.name = val; });
        };
    }

    // Função central para gravar dados no token selecionado
    async function updateToken(updater) {
        if (!activeTokenId) return;
        await OBR.scene.items.updateItems([activeTokenId], (items) => {
            for (let item of items) {
                if (!item.metadata["aoashi/data"]) {
                    item.metadata["aoashi/data"] = {};
                }
                updater(item.metadata["aoashi/data"]);
            }
        });
    }
});
