// The life of a court at war: what happens between the battles. Small things (a feast, a quarrel, a gift), hard
// knocks (a scandal, a traitor, fever in the camp, desertion) and conditions that last for seasons (a feud between
// generals, a failed harvest, veterans who swear to follow you). The engine draws from this deck each season with the
// war's own dice; every name is a living person of the war, and nobody dies of these: history keeps its own deaths.
//   needs: what the event needs to happen (see pick() in engine.js); fx: at once; lasting: a condition for some seasons
//   (power: an army fights stronger or weaker; income: the treasury takes more or less; stay: an army will not march).
export const DECK = [
  { id: 'feast', w: 3, mine: true, text: (n) => `${n.hero} holds a feast for the officers after the season's marching; the camp is merry for days`, fx: { morale: 5 } },
  { id: 'ceremony', w: 2, mine: true, text: () => 'A ceremony for the fallen: the whole army stands in silence, and marches the prouder for it', fx: { morale: 3, will: 2 } },
  { id: 'gift', w: 2, text: (n) => `Merchants who want ${n.side}'s favour send rich gifts: ${n.gold} gold for the war chest`, fx: { gold: 25 } },
  { id: 'envoy', w: 1, needs: 'neutral', mine: true, text: (n) => `An envoy of ${n.neutral} arrives with gifts and fine words, and asks only for friendship`, fx: { gold: 15 } },
  { id: 'quarrel', w: 2, needs: 'two', mine: true, text: (n) => `${n.a} and ${n.b} quarrel at dinner over who shall have the honour of the next battle; the officers take sides`, fx: { will: -1 } },
  { id: 'comet', w: 1, text: () => 'A comet blazes across the night sky; the soldiers mutter that it bodes ill', fx: { morale: -4 } },
  { id: 'affair', w: 1.4, mine: true, text: (n) => `Gossip runs through every camp: ${n.hero} has taken a nobleman's wife for a lover, and her kinsmen swear revenge`, fx: { will: -4 }, lasting: { kind: 'power', side: true, k: 0.96, seasons: 2, why: 'the scandal at court' } },
  { id: 'traitor', w: 1.2, needs: 'army', text: (n) => `A clerk in ${n.army}'s camp is caught selling the plans of ${n.side} to the enemy. Who knows how much they learned?`, lasting: { kind: 'power', army: true, k: 0.9, seasons: 1, why: 'its plans betrayed' } },
  { id: 'desert', w: 1.5, needs: 'away', text: (n) => `Homesick and unpaid, ${n.lost} men slip away from ${n.army}'s camp in the night`, fx: { armyMen: -0.05 } },
  { id: 'fever', w: 1.2, needs: 'away', text: (n) => `Fever spreads through ${n.army}'s camp: ${n.lost} men are too sick to march`, fx: { armyMen: -0.07, armyMorale: -5 } },
  { id: 'slander', w: 1.2, mine: true, text: (n) => `${n.hero}'s rivals at home spread slander: they say the war is lost, and the commander wants to be a tyrant`, fx: { will: -5 } },
  { id: 'wound', w: 0.8, needs: 'hero', mine: true, text: (n) => `${n.hero} is wounded in a skirmish with enemy scouts. The wound will heal, but for now the commander cannot ride at the head of the army`, lasting: { kind: 'power', hero: true, k: 0.92, seasons: 2, why: 'the commander wounded' } },
  { id: 'mutiny', w: 1, needs: 'tired', text: (n) => `The men of ${n.army} refuse to march another step until they have rested`, fx: { armyMorale: 6 }, lasting: { kind: 'stay', army: true, seasons: 1, why: 'the men refuse to march' } },
  { id: 'feud', w: 0.8, needs: 'two', mine: true, text: (n) => `${n.a} and ${n.b} have fallen out bitterly, and neither will take an order that comes through the other`, lasting: { kind: 'power', side: true, k: 0.95, seasons: 3, why: 'the feud among the generals' } },
  { id: 'harvest', w: 0.8, text: (n) => `The harvest fails in the lands of ${n.side}: the treasury will feel it for a year`, lasting: { kind: 'income', k: 0.7, seasons: 2, why: 'the failed harvest' } },
  { id: 'veterans', w: 0.6, needs: 'won', mine: true, text: (n) => `The veterans of your victories swear an oath to follow ${n.hero} wherever the war leads`, lasting: { kind: 'power', hero: true, k: 1.08, seasons: 99, why: 'the oath of the veterans' } },
  { id: 'spies', w: 1, needs: 'foe', mine: true, text: (n) => `Your spies come back from ${n.foe}'s camps with their plans for the season`, lasting: { kind: 'power', side: true, k: 1.06, seasons: 1, why: 'what the spies learned' } },
];
