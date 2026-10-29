OBR.onReady(() => {
    console.log("Extensão Ao Ashi TTRPG inicializada com sucesso!");

    const noSelectionEl = document.getElementById("no-selection");
    const sheetEl = document.getElementById("character-sheet");
    const nameInput = document.getElementById("char-name");
    const staminaInput = document.getElementById("char-stamina");

    // Ouve as alterações de seleção de itens (tokens) na mesa do Owlbear Rodeo
    OBR.player.onChange((selection) => {
        handleSelection(selection.selection);
    });

    // Função para verificar os tokens selecionados
    async function handleSelection(selectedIds) {
        if (selectedIds.length === 0) {
            noSelectionEl.style.display = "block";
            sheetEl.style.display = "none";
            return;
        }

        // Busca os itens selecionados na cena atual
        const items = await OBR.scene.items.getItems(selectedIds);
        const token = items[0]; // Pega o primeiro token selecionado

        if (token) {
            noSelectionEl.style.display = "none";
            sheetEl.style.display = "block";
            
            // Define o nome do token na ficha de forma dinâmica
            nameInput.value = token.text?.plainText || token.name || "Atleta Sem Nome";
            
            // Lê metadados salvos no token (se houver)
            const metadata = token.metadata["com.aoashi.ttrpg/data"] || {};
            staminaInput.value = metadata.stamina || 100;
        }
    }

    // Salva alterações de fôlego de volta para o token quando o valor mudar
    staminaInput.addEventListener("input", async (e) => {
        const selection = await OBR.player.getSelection();
        if (selection.length > 0) {
            await OBR.scene.items.updateItems(selection, (items) => {
                for (let item of items) {
                    if (!item.metadata["com.aoashi.ttrpg/data"]) {
                        item.metadata["com.aoashi.ttrpg/data"] = {};
                    }
                    item.metadata["com.aoashi.ttrpg/data"].stamina = Number(e.target.value);
                }
            });
        }
    });
});
