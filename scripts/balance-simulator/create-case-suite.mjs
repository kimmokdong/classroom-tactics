import { createHash } from 'node:crypto';

export const PLACEMENTS = Object.freeze(['standard', 'mirrored', 'spread']);
export const SIDE_DIRECTIONS = Object.freeze(['a-left', 'b-left']);
export const STRATEGY_GROUPS = Object.freeze([
    'reroll_core7',
    'reroll_final8',
    'standard_core8',
    'standard_final9',
    'highvalue_final9'
]);

const FINAL_GROUPS = new Set(['reroll_final8', 'standard_final9', 'highvalue_final9']);
const PROFILE_OUTPUT_DETAILS = new Set(['summary', 'cases', 'full']);

function pairs(decks) {
    const matchups = [];
    for (let index = 0; index < decks.length; index++) {
        for (let opponent = index + 1; opponent < decks.length; opponent++) {
            matchups.push([decks[index], decks[opponent]]);
        }
    }
    return matchups;
}

function cross(left, right) {
    return left.flatMap(deckA => right.map(deckB => [deckA, deckB]));
}

function sortedDecks(data, strategyGroup) {
    return data.decks
        .filter(deck => !strategyGroup || deck.strategyGroup === strategyGroup)
        .sort((left, right) => left.id.localeCompare(right.id));
}

function matchup(league, deckA, deckB) {
    return {
        league,
        deckAId: deckA.id,
        checkpointA: deckA.checkpointId,
        deckBId: deckB.id,
        checkpointB: deckB.checkpointId
    };
}

export function createLeagueMatchups(data) {
    const matchups = [];

    for (const group of STRATEGY_GROUPS) {
        pairs(sortedDecks(data, group)).forEach(([deckA, deckB]) => {
            matchups.push(matchup(`internal:${group}`, deckA, deckB));
        });
    }

    cross(sortedDecks(data, 'reroll_final8'), sortedDecks(data, 'standard_core8'))
        .forEach(([deckA, deckB]) => matchups.push(matchup('cross:level8', deckA, deckB)));
    cross(sortedDecks(data, 'standard_final9'), sortedDecks(data, 'highvalue_final9'))
        .forEach(([deckA, deckB]) => matchups.push(matchup('cross:level9', deckA, deckB)));

    const finalDecks = sortedDecks(data).filter(deck => FINAL_GROUPS.has(deck.strategyGroup));
    pairs(finalDecks).forEach(([deckA, deckB]) => {
        matchups.push(matchup('open:final', deckA, deckB));
    });

    return matchups;
}

export function validateSimulationProfile(profile, name = 'profile') {
    if (!profile || !Number.isSafeInteger(profile.repetitions) || profile.repetitions < 1) {
        throw new Error(`${name}: repetitions는 1 이상의 정수여야 합니다.`);
    }
    if (!Array.isArray(profile.placements) || profile.placements.length === 0) {
        throw new Error(`${name}: placements가 비어 있습니다.`);
    }
    if (new Set(profile.placements).size !== profile.placements.length
        || profile.placements.some(placement => !PLACEMENTS.includes(placement))) {
        throw new Error(`${name}: placements는 중복 없는 standard/mirrored/spread 조합이어야 합니다.`);
    }
    if (typeof profile.swapSides !== 'boolean') {
        throw new Error(`${name}: swapSides는 boolean이어야 합니다.`);
    }
    if (profile.pairedPlacementsOnly !== undefined && typeof profile.pairedPlacementsOnly !== 'boolean') {
        throw new Error(`${name}: pairedPlacementsOnly는 boolean이어야 합니다.`);
    }
    if (!PROFILE_OUTPUT_DETAILS.has(profile.outputDetail)) {
        throw new Error(`${name}: outputDetail은 summary/cases/full 중 하나여야 합니다.`);
    }
    return profile;
}

function assertIdPart(value, label) {
    if (typeof value !== 'string' || value.length === 0 || value.includes('|')) {
        throw new Error(`${label}은 비어 있지 않고 | 문자를 포함하지 않아야 합니다.`);
    }
}

export function createCaseId(parts) {
    const values = [
        parts.league,
        parts.deckAId,
        parts.checkpointA,
        parts.deckBId,
        parts.checkpointB,
        parts.placementA,
        parts.placementB,
        parts.sideDirection,
        String(parts.repetition),
        parts.rulesVersion
    ];
    values.forEach((value, index) => assertIdPart(value, `case ID 구성 요소 ${index + 1}`));
    return values.join('|');
}

function deriveSeed(type, ...parts) {
    return createHash('sha256')
        .update(['case-seed-v1', type, ...parts].join('\u001f'))
        .digest('hex')
        .slice(0, 24);
}

function matchupKey(parts) {
    return [parts.league, parts.deckAId, parts.checkpointA, parts.deckBId, parts.checkpointB].join('|');
}

function createCase(data, parts, validMatchups) {
    if (!validMatchups.has(matchupKey(parts))) throw new Error('case ID의 리그·덱·체크포인트 조합이 유효하지 않습니다.');
    if (!PLACEMENTS.includes(parts.placementA) || !PLACEMENTS.includes(parts.placementB)) {
        throw new Error('case ID의 배치가 유효하지 않습니다.');
    }
    if (!SIDE_DIRECTIONS.includes(parts.sideDirection)) throw new Error('case ID의 좌우 방향이 유효하지 않습니다.');
    if (!Number.isSafeInteger(parts.repetition) || parts.repetition < 1) throw new Error('case ID의 반복 번호가 유효하지 않습니다.');
    if (parts.rulesVersion !== data.rulesVersion) throw new Error(`규칙 버전 불일치: ${parts.rulesVersion}`);

    const id = createCaseId(parts);
    const pairedParts = [
        parts.league,
        parts.deckAId,
        parts.checkpointA,
        parts.deckBId,
        parts.checkpointB,
        parts.placementA,
        parts.placementB,
        String(parts.repetition),
        parts.rulesVersion
    ];

    return {
        id,
        ...parts,
        seeds: {
            battle: deriveSeed('battle', id),
            deckA: deriveSeed('deck', ...pairedParts, parts.deckAId),
            deckB: deriveSeed('deck', ...pairedParts, parts.deckBId),
            itemA: deriveSeed('item', ...pairedParts, parts.deckAId),
            itemB: deriveSeed('item', ...pairedParts, parts.deckBId)
        }
    };
}

function validMatchups(data) {
    return new Set(createLeagueMatchups(data).map(matchupKey));
}

export function* iterateCaseSuite(data, profile) {
    validateSimulationProfile(profile);
    const matchups = createLeagueMatchups(data);
    const matchupSet = new Set(matchups.map(matchupKey));
    const sides = profile.swapSides ? SIDE_DIRECTIONS : SIDE_DIRECTIONS.slice(0, 1);

    for (const leagueMatchup of matchups) {
        for (const placementA of profile.placements) {
            const placementBs = profile.pairedPlacementsOnly ? [placementA] : profile.placements;
            for (const placementB of placementBs) {
                for (let repetition = 1; repetition <= profile.repetitions; repetition++) {
                    for (const sideDirection of sides) {
                        yield createCase(data, {
                            ...leagueMatchup,
                            placementA,
                            placementB,
                            sideDirection,
                            repetition,
                            rulesVersion: data.rulesVersion
                        }, matchupSet);
                    }
                }
            }
        }
    }
}

export function createCaseSuite(data, profile) {
    return [...iterateCaseSuite(data, profile)];
}

export function countCaseSuite(data, profile) {
    validateSimulationProfile(profile);
    const placementPairs = profile.pairedPlacementsOnly
        ? profile.placements.length
        : profile.placements.length ** 2;
    return createLeagueMatchups(data).length
        * placementPairs
        * profile.repetitions
        * (profile.swapSides ? 2 : 1);
}

export function parseCaseId(data, id) {
    if (typeof id !== 'string') throw new Error('case ID는 문자열이어야 합니다.');
    const values = id.split('|');
    if (values.length !== 10) throw new Error('case ID는 10개 구성 요소여야 합니다.');
    const [
        league,
        deckAId,
        checkpointA,
        deckBId,
        checkpointB,
        placementA,
        placementB,
        sideDirection,
        repetitionText,
        rulesVersion
    ] = values;
    if (!/^[1-9][0-9]*$/.test(repetitionText)) throw new Error('case ID의 반복 번호가 유효하지 않습니다.');

    const parsed = createCase(data, {
        league,
        deckAId,
        checkpointA,
        deckBId,
        checkpointB,
        placementA,
        placementB,
        sideDirection,
        repetition: Number(repetitionText),
        rulesVersion
    }, validMatchups(data));
    if (parsed.id !== id) throw new Error('case ID가 정규 형식이 아닙니다.');
    return parsed;
}
