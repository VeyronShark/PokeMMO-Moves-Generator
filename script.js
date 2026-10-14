const btn = document.getElementById("get-moves-btn");
const textbox = document.getElementById("pokemon-name");

btn.addEventListener('click', async () => {
    console.clear();
    console.log("'Get Moves' button clicked");
    const pokemon = await getPokemon(textbox.value);
    const moves = await categorizeMoves(pokemon);
    const stats = await getStats(pokemon);
    const types = pokemon.types.map(obj => obj.type.name);
    const moveFormat = await getMoveFormat(stats, types);
    const finalMoves = await getFinalMoves(moveFormat, types, stats, moves);
    console.log(finalMoves);
});

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
    try {
        console.log(`Fetch Request for ${name} sent`)
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}/`);

        if (!response.ok) throw new Error(`Failed to fetch data: ${response.status}`);

        const data = await response.json();
        console.log('Received Pokemon Data');
        
        // console.log(data);
        return data;
    } catch(error) {
        console.error('Failed to fetch: ' + error);
    }
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

    for (stat in primaryStats){
        if (primaryStats[stat] == maxPrimary) primary.push(stat);
    }
    for (stat in secondaryStats){
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
    // console.log(moveObj.move);
    const moveDetails = moveObj.move;
    let moveData = {};

    try {
        // console.log(`Fetching move: '${moveDetails.name}' details`);
        const response = await fetch(moveDetails.url);

        if (!response.ok) throw new Error(`Failed to fetch data: ${response.status}`);

        const data = await response.json();
        // console.log("Recieved Move Data");

        // console.log(data);
        moveData = data;
    } catch(error){
        console.error(`Failed to fetch: ${error}`);
    }

    if (!moveData) return {error:"couldn't fetch"};
    
    if (moveData.generation.url[moveData.generation.url.length - 2] > 5) return 'too new';

    moveName = moveData.name;
    power = moveData.power;
    accuracy = moveData.accuracy;
    pp = moveData.pp;
    moveClass = moveData.damage_class.name;
    description = moveData.flavor_text_entries.filter(desc => desc.language.name === "en" && desc.version_group.name === "black-white");
    effectChance = moveData.effect_chance;
    effectEntry = moveData.effect_entries.filter(desc => desc.language.name === "en");
    type = moveData.type.name;
    
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