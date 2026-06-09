import type { CardId } from './CardDef';

const STARTER_DECK_BY_CHAR: CardId[][] = [
    ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'descent_wusheng', 'descent_wolong', 'descent_wushuang', 'scheme'],
    ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'descent_wusheng', 'descent_wolong', 'descent_wushuang', 'scheme'],
    ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'descent_wusheng', 'descent_wolong', 'descent_wushuang', 'scheme'],
];

export function getStarterDeckForCharacter(charId: number): CardId[] {
    return [...(STARTER_DECK_BY_CHAR[charId] ?? STARTER_DECK_BY_CHAR[0])];
}
