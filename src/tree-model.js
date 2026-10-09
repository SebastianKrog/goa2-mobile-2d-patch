// Printed card identity and paths; no Deck plans or native selection state.
function deckCardIdentity(card) {
  return card?.id || JSON.stringify([card?.color, card?.tier, card?.name]);
}
function deckTreeTier(card) {
  return { I: 1, II: 2, III: 3, 1: 1, 2: 2, 3: 3 }[String(card?.tier).toUpperCase()] || 0;
}
// Artwork IDs encode the printed A/B variant across heroes. Never infer paths
// from names, abilities, item types, or the order a hero happens to list cards.
function deckTreeVariant(card) {
  const artwork = String(card?.image_id || '').match(/(?:II|III)([AB])$/i),
    identity = String(card?.id || '').match(/(?:[-_]|\d)([ab])$/i);
  return (artwork?.[1] || identity?.[1] || 'A').toUpperCase() === 'B' ? 1 : 0;
}
function compareDeckTreeCards(a, b) {
  return deckTreeVariant(a) - deckTreeVariant(b);
}
function deckTreeGroup(card) {
  return String(card.color).toUpperCase() + ':' + deckTreeTier(card);
}
function deckTreePool(hero) {
  return [
    ...(hero?.hand || []),
    ...(hero?.discard_pile || []),
    ...(hero?.played_cards || []),
    ...(hero?.cast_spells || []),
    hero?.current_turn_card,
    hero?.extra_turn_card,
    Number(hero?.level) >= 8 ? hero?.ultimate_card : null,
  ].filter((card) => card && (!card.is_facedown || card.primary_action));
}

export { compareDeckTreeCards, deckCardIdentity, deckTreeGroup, deckTreePool, deckTreeTier };
