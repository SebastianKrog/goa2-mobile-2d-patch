// Forecast only the currently revealed cards. Team choices remain deliberately
// unresolved; the coin is simulated locally and never changes game state.
function predictResolutionOrder(entries, coin, actorId = null) {
  if (!entries.length || entries.some(e => !e.team || !Number.isFinite(Number(e.initiative))))
    return entries;
  const ordered = entries.map((entry, index) => ({ ...entry, nativeIndex: index }))
    .sort((a, b) => Number(b.initiative) - Number(a.initiative) || a.nativeIndex - b.nativeIndex);
  const result = [];
  let offset = 0;
  while (offset < ordered.length) {
    let end = offset + 1;
    while (end < ordered.length && Number(ordered[end].initiative) === Number(ordered[offset].initiative)) end++;
    const group = ordered.slice(offset, end), teams = new Map();
    for (const entry of group) {
      if (!teams.has(entry.team)) teams.set(entry.team, []);
      teams.get(entry.team).push(entry);
    }
    // Actual actor selection is authoritative, including a teammate chosen
    // from a tie. Keep that hero at the front of their otherwise stable team.
    for (const members of teams.values()) members.sort((a, b) =>
      Number(b.heroId === actorId) - Number(a.heroId === actorId) || a.nativeIndex - b.nativeIndex);
    const remaining = new Map([...teams].map(([team, members]) => [team, members.length]));
    const slots = new Map([...teams.keys()].map(team => [team, []]));
    for (let index = 0; index < group.length; index++) {
      const available = [...remaining.keys()].filter(team => remaining.get(team) > 0);
      const actor = offset === 0 && index === 0 && group.find(e => e.heroId === actorId);
      const team = actor ? actor.team : available.includes(coin) ? coin : available[0];
      slots.get(team).push(offset + index + 1);
      remaining.set(team, remaining.get(team) - 1);
      if (available.length > 1) coin = available.find(other => other !== team);
    }
    // Each team keeps its own choice group, labelled by its earliest possible
    // slot. Later initiative groups still start after every tied hero has acted.
    const blocks = [...teams].map(([team, members]) => ({
      rank: slots.get(team)[0], entries: members,
    }));
    blocks.sort((a, b) => a.rank - b.rank);
    for (const block of blocks) for (let i = 0; i < block.entries.length; i++)
      result.push({ ...block.entries[i], order: block.rank, tied: i > 0,
        position: result.length + 1, current: false });
    offset = end;
  }
  const current = actorId ? result.find(e => e.heroId === actorId) : result[0];
  if (current) current.current = true;
  return result;
}

export { predictResolutionOrder };
