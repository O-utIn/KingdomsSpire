import type { CardId } from './CardDef';

const STARTER_DECK_BY_CHAR: CardId[][] = [
    ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'survivor', 'bash'],
    ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'bash', 'bash'],
    ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'bash'],
];

export function getStarterDeckForCharacter(charId: number): CardId[] {
    return [...(STARTER_DECK_BY_CHAR[charId] ?? STARTER_DECK_BY_CHAR[0])];
}
