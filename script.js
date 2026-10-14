const btn = document.getElementById("get-moves-btn");
const textbox = document.getElementById("pokemon-name");
const searchForm = document.getElementById("pokemon-search");
const results = document.getElementById("results");
const statusMessage = document.getElementById("status-message");

const typeColors = {
    normal: ["#a8a878", "#f3f3e7"],
    fire: ["#f08030", "#fdf0e5"],
    water: ["#6890f0", "#edf2fd"],
    electric: ["#f8d030", "#fcf7df"],
    grass: ["#78c850", "#eef8e8"],
    ice: ["#98d8d8", "#edf8f8"],
    fighting: ["#c03028", "#f8eaea"],
    poison: ["#a040a0", "#f5eaf5"],
    ground: ["#e0c068", "#faf5e7"],
    flying: ["#a890f0", "#f2effc"],
    psychic: ["#f85888", "#fdecf1"],
    bug: ["#a8b820", "#f4f5e6"],
    rock: ["#b8a038", "#f6f3e7"],
    ghost: ["#705898", "#f0edf6"],
    dragon: ["#7038f8", "#f0ebfe"],
    dark: ["#705848", "#f2efed"],
    steel: ["#b8b8d0", "#f2f2f7"],
    fairy: ["#ee99ac", "#fdf0f3"]
};

const categoryLabels = {
    highSTAB: "Best STAB",
    midSTAB1: "Primary type",
    midSTAB2: "Secondary type",
    coverage: "Coverage",
    status: "Status"
};

searchForm.addEventListener('submit', async event => {
    event.preventDefault();
    const pokemonName = textbox.value.trim().toLowerCase();
    if (!pokemonName) return;

    btn.disabled = true;
    results.replaceChildren();
    statusMessage.textContent = `Finding moves for ${pokemonName}...`;
    statusMessage.dataset.state = "loading";

    try {
        const pokemon = await getPokemon(pokemonName);
        const moves = await categorizeMoves(pokemon);
        const stats = await getStats(pokemon);
        const types = pokemon.types.map(obj => obj.type.name);
        const moveFormat = await getMoveFormat(stats, types);
        const finalMoves = await getFinalMoves(moveFormat, types, stats, moves);

        renderMoves(pokemon, finalMoves);
        statusMessage.textContent = "Your suggested moves are ready.";
        statusMessage.dataset.state = "success";
    } catch (error) {
        console.error("Unable to generate moveset:", error);
        statusMessage.textContent = error.message || "Unable to load this Pokémon. Please try again.";
        statusMessage.dataset.state = "error";
    } finally {
        btn.disabled = false;
    }
});

function renderMoves(pokemon, finalMoves) {
    const heading = document.createElement("div");
    heading.className = "results-heading";

    const title = document.createElement("h2");
    title.textContent = `${pokemon.name}'s moves`;
    heading.append(title);

    const typeList = document.createElement("div");
    typeList.className = "type-list";
    for (const pokemonType of pokemon.types) {
        const badge = document.createElement("span");
        badge.className = "type-badge";
        badge.textContent = pokemonType.type.name;
        typeList.append(badge);
    }
    heading.append(typeList);

    const list = document.createElement("div");
    list.className = "move-list";
    let moveCount = 0;

    for (const [category, moves] of Object.entries(finalMoves)) {
        if (moves.length === 0) continue;
        moveCount += 1;

        const card = document.createElement("article");
        card.className = "move-card";
        card.setAttribute("aria-label", categoryLabels[category] || category);

        const categoryName = document.createElement("p");
        categoryName.className = "move-category";
        categoryName.textContent = categoryLabels[category] || category;
        card.append(categoryName);

        const moveName = document.createElement("p");
        moveName.className = "move-name";

        const metadata = document.createElement("div");
        metadata.className = "move-meta";

        const showMove = move => {
            const [color, tint] = typeColors[move.type] || ["#8793a5", "#f0f2f5"];
            card.style.setProperty("--type-color", color);
            card.style.setProperty("--type-tint", tint);
            moveName.textContent = formatMoveName(move.moveName);
            const flavorText = move.description?.[0]?.flavor_text;
            card.title = flavorText ? flavorText.replace(/[\f\n\r]+/g, " ").trim() : "";

            const stats = [
                move.type,
                move.moveClass,
                move.power === null ? "Status" : `Power ${move.power}`,
                `Accuracy ${move.accuracy === null ? "—" : `${move.accuracy}%`}`,
                `PP ${move.pp}`
            ];
            metadata.replaceChildren();
            for (const stat of stats) {
                const badge = document.createElement("span");
                badge.textContent = stat;
                metadata.append(badge);
            }
        };

        if (moves.length > 1) {
            const select = document.createElement("select");
            select.setAttribute("aria-label", `${categoryLabels[category] || category} move choices`);
            moves.forEach((move, index) => {
                const option = document.createElement("option");
                const [color, tint] = typeColors[move.type] || ["#8793a5", "#f0f2f5"];
                option.value = String(index);
                option.textContent = `${formatMoveName(move.moveName)} · ${move.type} · ${move.power === null ? "Status" : `Power ${move.power}`}`;
                option.style.backgroundColor = tint;
                option.style.color = color;
                select.append(option);
            });
            select.addEventListener("change", () => {
                showMove(moves[Number(select.value)]);
            });
            card.append(select);
        } else {
            card.append(moveName);
        }

        card.append(metadata);
        showMove(moves[0]);
        list.append(card);
    }

    if (moveCount === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-moves";
        emptyMessage.textContent = "No suitable moves were found for this Pokémon.";
        list.append(emptyMessage);
    }

    results.replaceChildren(heading, list);
}

function formatMoveName(name) {
    return name.replace(/-/g, " ");
}

async function categorizeMoves(pokemon) {
    const moves = {
        physical: [],
        special: [],
        status: []
    }

    console.log("Categorizing all Moves")
    for (const move of pokemon.moves) {
        const moveDetails = await getMoveDetails(move);

        if (moveDetails === 'too new') continue;

        if (moveDetails.moveClass === "physical") moves.physical.push(moveDetails);
        else if (moveDetails.moveClass === "status") moves.status.push(moveDetails);
        else moves.special.push(moveDetails);

    }
    console.log("Moves Categorized");

    return moves;
    // getMoveDetails(pokemon.moves[1]);
}

async function getPokemon(name) {
    console.log(`Fetch Request for ${name} sent`);
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}/`);

    if (response.status === 404) throw new Error(`No Pokémon named "${name}" was found.`);
    if (!response.ok) throw new Error(`Failed to fetch Pokémon data (${response.status}).`);

    const data = await response.json();
    console.log('Received Pokemon Data');
    return data;
}

async function getStats(pokemon) {
    let primary = [];
    let secondary = [];

    console.log("Retrieving Primary and Secondary Stats");
    const atk = pokemon.stats.filter(stat => stat.stat.name === "attack")[0].base_stat;
    const spAtk = pokemon.stats.filter(stat => stat.stat.name === "special-attack")[0].base_stat;
    const def = pokemon.stats.filter(stat => stat.stat.name === "defense")[0].base_stat;
    const spDef = pokemon.stats.filter(stat => stat.stat.name === "special-defense")[0].base_stat;
    const hp = pokemon.stats.filter(stat => stat.stat.name === "hp")[0].base_stat;
    const spd = pokemon.stats.filter(stat => stat.stat.name === "speed")[0].base_stat;
    const avgDef = Math.floor((def + spDef) / 2.0);

    const maxPrimary = Math.max(atk, spAtk, avgDef);
    const maxSecondary = Math.max(hp, spd);
    const primaryStats = {atk, spAtk, avgDef};
    const secondaryStats = {hp, spd};

    for (const stat in primaryStats){
        if (primaryStats[stat] == maxPrimary) primary.push(stat);
    }
    for (const stat in secondaryStats){
        if (secondaryStats[stat] == maxSecondary) secondary.push(stat);
    }
    console.log("Stats retrieved");

    // console.log({primary, secondary});
    return {primary, secondary};
}

async function getMoveFormat(stats, types) {
    const format = [];

    console.log("Generating final moves format")
    // midSTAB1, midstab2, highSTAB, status, coverage

    if (types.length === 1) format.push('midSTAB1', 'highSTAB');
    else format.push('midSTAB1', 'midSTAB2');

    if (stats.primary.includes('avgDef')) format.push('status', 'coverage'); 
    else {
        format.push('coverage');
        if (types.length > 1) format.push('highSTAB');
        else if (stats.secondary.includes('spd')) format.push('status');
        else format.push('coverage');     
    }

    console.log('Final Moves format generated');

    return format;
}

async function getMoveDetails(moveObj) {
    const moveDetails = moveObj.move;
    const response = await fetch(moveDetails.url);
    if (!response.ok) throw new Error(`Failed to fetch move "${moveDetails.name}" (${response.status}).`);
    const moveData = await response.json();
    
    if (moveData.generation.url[moveData.generation.url.length - 2] > 5) return 'too new';

    const moveName = moveData.name;
    const power = moveData.power;
    const accuracy = moveData.accuracy;
    const pp = moveData.pp;
    const moveClass = moveData.damage_class.name;
    const description = moveData.flavor_text_entries.filter(desc => desc.language.name === "en" && desc.version_group.name === "black-white");
    const effectChance = moveData.effect_chance;
    const effectEntry = moveData.effect_entries.filter(desc => desc.language.name === "en");
    const type = moveData.type.name;
    
    return {moveName, power, accuracy, pp, moveClass, description, effectChance, effectEntry, type};
}

async function getFinalMoves(format, types, stats, moves) {
    console.log(types, format, stats);
    const atkFilters = [];
    const finalMoves = {};
    const selectedMoveNames = new Set();

    console.log('Generating Final Moveset');
    if (stats.primary.includes("atk")) atkFilters.push('physical');
    if (stats.primary.includes("spAtk")) atkFilters.push('special');
    if (atkFilters.length === 0) atkFilters.push('physical', 'special');

    const getStrongestAvailableMoves = predicate => {
        let strongestMoves = [];

        for (const atkFilter of atkFilters) {
            const availableMoves = moves[atkFilter].filter(move =>
                !selectedMoveNames.has(move.moveName) && predicate(move)
            );

            for (const move of availableMoves) {
                if (strongestMoves.length === 0 || strongestMoves[0].power < move.power) {
                    strongestMoves = [move];
                } else if (strongestMoves[0].power === move.power) {
                    strongestMoves.push(move);
                }
            }
        }

        for (const move of strongestMoves) {
            selectedMoveNames.add(move.moveName);
        }
        return strongestMoves;
    };
    
    if (format.includes('highSTAB')) {
        finalMoves['highSTAB'] = getStrongestAvailableMoves(move => types.includes(move.type));
    }

    if (format.includes('midSTAB1')) {
        const type = types[0];
        finalMoves['midSTAB1'] = getStrongestAvailableMoves(move => move.type === type && move.pp >= 15);
    }

    if (format.includes('midSTAB2')) {
        const type = types[1];
        finalMoves['midSTAB2'] = getStrongestAvailableMoves(move => move.type === type && move.pp >= 15);
    }

    if (format.includes('coverage')) {
        const viableMoves = getStrongestAvailableMoves(move =>
            !types.includes(move.type) && move.pp >= 15 && move.power < 120
        );

        viableMoves.sort((a, b) => {
            if (a.type === 'normal') return 1;
            else if (b.type === 'normal') return -1;
            else return 0;
        });
        finalMoves['coverage'] = viableMoves;
    }

    if (format.includes('status')) {
        const filterMoves = moves['status'].filter(move =>
            !selectedMoveNames.has(move.moveName) && types.includes(move.type) && move.pp >= 15
        );
        for (const move of filterMoves) {
            selectedMoveNames.add(move.moveName);
        }
        finalMoves['status'] = filterMoves;
    }

    console.log('Final Moves Generated');
    return finalMoves;
}