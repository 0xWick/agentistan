// The age of 1200: the Old World as history left it, with the quarrels, marriages and inventions of the time, the
// Silk Road's routes, and the forces peculiar to this age: the Kipchak raids, the hidden daggers of Alamut, and
// Temujin, who may or may not unite the steppe.
import realms from '../realms.json' with { type: 'json' };
import { RULES as R } from '../rules.js';
import { provincesOf, armiesOf, armiesChanged, living, friendly, setOwner, newChar, newArmy, round1, chance, pick, short, ofR, say, cityOf, placeOf, atWar, PROV } from '../core.js';
import { strength } from '../economy.js';
import { fall, declareWar } from '../war.js';

// Temperaments and families the chronicles give the people of 1200 (the rest are drawn by the world).
const PEOPLE = {
  khwarazm: { ruler: 'conqueror', heir: 'conqueror', generals: { 'Temur Malik': 'loyal', Inalchuq: 'mercenary' } },
  ghurid: { ruler: 'builder', generals: { "Mu'izz al-Din Muhammad": 'conqueror', 'Qutb al-Din Aibak': 'glory', 'Taj al-Din Yildiz': 'treacherous', 'Nasir al-Din Qubacha': 'treacherous', 'Bakhtiyar Khalji': 'glory' } },
  qarakhitai: { ruler: 'negligent', generals: { Tayangu: 'steady' } },
  karakhanid: { ruler: 'diplomat', heir: 'conqueror', generals: { Uthman: 'glory' } },
  abbasid: { ruler: 'reformer', generals: { 'Muzaffar al-Din Sunqur': 'steady' } },
  eldiguzid: { ruler: 'hedonist', heir: 'hedonist', generals: { Uzbek: 'cautious' } },
  georgia: { ruler: 'just', heir: 'hedonist', consortGeneral: 'David Soslan', generals: { 'Zakare Mkhargrdzeli': 'loyal', 'Ivane Mkhargrdzeli': 'loyal', 'David Soslan': 'loyal' } },
  alamut: { ruler: 'paranoid', heir: 'reformer' },
  salghurid: { ruler: 'builder' },
  zengid: { ruler: 'conqueror' },
  chaulukya: { ruler: 'negligent', generals: { Lavanaprasada: 'loyal' } },
  paramara: { ruler: 'conqueror' },
  chandela: { ruler: 'diplomat' },
  chahamana: { ruler: 'diplomat' },
  sena: { ruler: 'builder' },
  kipchak: { ruler: 'conqueror' },
  byzantium: { ruler: 'hedonist', consort: { name: 'Euphrosyne Doukaina', born: 1155, temper: 'schemer' }, generals: { 'Theodore Laskaris': 'glory', 'Alexios Doukas': 'treacherous', 'Manuel Kamytzes': 'treacherous' } },
  rum: { ruler: 'conqueror', generals: { 'Mubariz al-Din': 'steady' } },
  cilicia: { ruler: 'diplomat', generals: { 'Adam of Baghras': 'loyal' } },
  ayyubid: { ruler: 'diplomat', heir: 'diplomat', generals: { 'al-Kamil': 'cautious', "al-Mu'azzam Isa": 'glory' } },
  aleppo: { ruler: 'builder', generals: { Tughril: 'loyal' } },
  outremer: { ruler: 'diplomat', consort: { name: 'Isabella', born: 1172, temper: 'regent', title: 'Queen' }, generals: { 'John of Ibelin': 'loyal' } },
  antioch: { ruler: 'negligent', heir: 'conqueror', generals: { 'Bohemond IV': 'glory' } },
  almohad: { ruler: 'conqueror', heir: 'hedonist', generals: { 'Abu Muhammad ibn Abi Hafs': 'steady', "Abu Sa'id": 'steady' } },
  ghaniya: { ruler: 'conqueror', generals: { "Abd Allah ibn Ghaniya": 'glory' } },
  sicily: { ruler: 'reformer' },
  papal: { ruler: 'reformer' },
  venice: { ruler: 'conqueror' },
  genoa: { ruler: 'miser' },
  bulgaria: { ruler: 'conqueror', heir: 'paranoid' },
  serbia: { ruler: 'diplomat', heir: 'diplomat' },
  hungary: { ruler: 'paranoid', consort: { name: 'Constance of Aragon', born: 1179, temper: 'regent', title: 'Queen' } },
  jin: { ruler: 'builder', consort: { name: 'Li Shi\'er', born: 1165, temper: 'schemer', title: 'Consort' } },
  song: { ruler: 'negligent', consort: { name: 'Yang Meizi', born: 1162, temper: 'schemer', title: 'Empress' }, vizier: { name: 'Han Tuozhou', born: 1152, temper: 'kingmaker', title: 'Chancellor' } },
  xia: { ruler: 'diplomat' },
  mongol: { ruler: 'conqueror', heir: 'conqueror', consort: { name: 'Börte', born: 1161, temper: 'devoted', title: 'Khatun' }, generals: { "Bo'orchu": 'loyal', Muqali: 'loyal' } },
  kereit: { ruler: 'paranoid', heir: 'paranoid' },
  naiman: { ruler: 'negligent', heir: 'tyrant' },
  merkit: { ruler: 'conqueror' },
  tatar: { ruler: 'tyrant' },
  // the rest of the Old World
  france: { ruler: 'conqueror', heir: 'conqueror', consort: { name: 'Agnes of Merania', born: 1172, temper: 'devoted', title: 'Queen' }, generals: { 'Guillaume des Barres': 'loyal' } },
  angevin: { ruler: 'paranoid', consort: { name: 'Isabella of Angoulême', born: 1188, temper: 'schemer', title: 'Queen' }, generals: { 'William Marshal': 'loyal', 'Hubert de Burgh': 'steady' } },
  flanders: { ruler: 'conqueror', consort: { name: 'Marie of Champagne', born: 1174, temper: 'devoted', title: 'Countess' } },
  toulouse: { ruler: 'diplomat' },
  aragon: { ruler: 'conqueror' },
  gwynedd: { ruler: 'conqueror' },
  scotland: { ruler: 'diplomat', consort: { name: 'Ermengarde de Beaumont', born: 1170, temper: 'devoted', title: 'Queen' } },
  connacht: { ruler: 'just' },
  castile: { ruler: 'conqueror', consort: { name: 'Eleanor of England', born: 1162, temper: 'regent', title: 'Queen' }, generals: { 'Diego López de Haro': 'steady' } },
  leon: { ruler: 'reformer', heir: 'conqueror', consort: { name: 'Berengaria of Castile', born: 1179, temper: 'regent', title: 'Queen' } },
  portugal: { ruler: 'builder', heir: 'cautious' },
  navarre: { ruler: 'conqueror' },
  staufen: { ruler: 'diplomat', consort: { name: 'Irene Angelina', born: 1181, temper: 'devoted', title: 'Queen' }, generals: { 'Ludwig of Bavaria': 'loyal' } },
  welf: { ruler: 'conqueror' },
  austria: { ruler: 'builder' },
  bohemia: { ruler: 'diplomat', consort: { name: 'Constance of Hungary', born: 1180, temper: 'devoted', title: 'Queen' } },
  denmark: { ruler: 'diplomat', heir: 'conqueror' },
  norway: { ruler: 'conqueror' },
  sweden: { ruler: 'negligent' },
  poland: { ruler: 'diplomat', heir: 'tyrant' },
  silesia: { ruler: 'just', heir: 'builder' },
  pomerania: { ruler: 'miser' },
  lithuania: { ruler: 'conqueror' },
  novgorod: { ruler: 'miser' },
  vladimir: { ruler: 'builder', heir: 'diplomat', consort: { name: 'Maria Shvarnovna', born: 1158, temper: 'devoted', title: 'Princess' }, generals: { Yuri: 'glory' } },
  ryazan: { ruler: 'paranoid' },
  smolensk: { ruler: 'diplomat' },
  chernigov: { ruler: 'conqueror' },
  kiev: { ruler: 'tyrant' },
  galich: { ruler: 'conqueror', consort: { name: 'Anna', born: 1175, temper: 'regent', title: 'Princess' } },
  hejaz: { ruler: 'conqueror' },
  yemen: { ruler: 'tyrant' },
  yadava: { ruler: 'conqueror' },
  kakatiya: { ruler: 'builder' },
  hoysala: { ruler: 'conqueror' },
  chola: { ruler: 'conqueror' },
  pandya: { ruler: 'conqueror' },
  lanka: { ruler: 'hedonist' },
  pagan: { ruler: 'builder', heir: 'just' },
  khmer: { ruler: 'builder', consort: { name: 'Indradevi', born: 1130, temper: 'devoted', title: 'Queen' } },
  daiviet: { ruler: 'hedonist' },
  kediri: { ruler: 'tyrant' },
  goryeo: { ruler: 'negligent', vizier: { name: 'Choe Chung-heon', born: 1149, temper: 'kingmaker', title: 'Chief minister' }, generals: { 'Choe U': 'glory' } },
  kamakura: { ruler: 'hedonist', consort: { name: 'Wakasa no Tsubone', born: 1182, temper: 'devoted', title: 'Lady' }, vizier: { name: 'Hōjō Tokimasa', born: 1138, temper: 'kingmaker', title: 'Shikken' }, generals: { 'Hōjō Yoshitoki': 'steady', 'Wada Yoshimori': 'glory' } },
  ghana: { ruler: 'negligent' },
  sosso: { ruler: 'tyrant' },
  mali: { ruler: 'diplomat' },
  kanem: { ruler: 'just', heir: 'conqueror' },
  benin: { ruler: 'builder' },
  zagwe: { ruler: 'builder' },
};

// Who knew what in 1200: paper across the lands of the caliphs and China; counterweight engines in the West and the
// Levant; gunpowder, the compass and printing in China; crucible steel in India and Persia; credit among merchants.
const KNOWN = {
  paper: ['yemen', 'hejaz', 'oman', 'uyunid', 'kakatiya', 'chola', 'goryeo', 'kamakura', 'daiviet', 'kilwa', 'mogadishu', 'castile', 'aragon', 'abbasid', 'khwarazm', 'ghurid', 'karakhanid', 'qarakhitai', 'eldiguzid', 'salghurid', 'zengid', 'ayyubid', 'aleppo', 'rum', 'almohad', 'ghaniya', 'alamut', 'shirvan', 'georgia', 'byzantium', 'sicily', 'venice', 'genoa', 'cilicia', 'outremer', 'antioch', 'jin', 'song', 'xia', 'qocho'],
  trebuchet: ['france', 'angevin', 'castile', 'aragon', 'staufen', 'welf', 'flanders', 'byzantium', 'ayyubid', 'aleppo', 'outremer', 'antioch', 'sicily', 'venice', 'genoa', 'lombard', 'papal'],
  gunpowder: ['song', 'jin'],
  compass: ['song', 'goryeo'],
  windmill: ['ghurid', 'khwarazm', 'flanders', 'angevin'],
  rotation: ['hungary', 'lombard', 'france', 'flanders', 'angevin', 'staufen', 'welf', 'bohemia', 'denmark'],
  credit: ['flanders', 'france', 'yemen', 'kilwa', 'venice', 'genoa', 'lombard', 'ayyubid', 'abbasid', 'song', 'jin'],
  steel: ['chola', 'pandya', 'hoysala', 'yadava', 'kakatiya', 'lanka', 'ghurid', 'khwarazm', 'chaulukya', 'paramara', 'chandela', 'ayyubid'],
  printing: ['song', 'jin', 'goryeo'],
};

// The Silk Road, Constantinople to Chang'an, and its branches south to Baghdad and India.
const ROADS = [
  ['constantinople', 'nicaea', 'ankara', 'sivas', 'erzurum', 'tabriz', 'qazvin', 'rey', 'kumis', 'nishapur', 'sarakhs', 'merv', 'bukhara', 'samarkand', 'ushrusana', 'ferghana', 'kashgar', 'khotan', 'shazhou', 'ganzhou', 'liangzhou', 'jingzhao'],
  ['aleppo', 'edessa', 'mosul', 'baghdad', 'hamadan', 'rey'],
  ['merv', 'balkh', 'bamiyan', 'kabul', 'peshawar', 'lahore', 'delhi'],
  ['shazhou', 'hami', 'qocho', 'almaliq', 'balasagun', 'talas', 'shash', 'samarkand'],
];

const STEPPE = ['kherlen', 'tula', 'selenga', 'buir', 'altai']; // the Mongolian steppe, the khan's to unite

export default {
  id: '1200',
  name: 'The Silk Road, 1200',
  start: 1200,
  months: 672,
  realms,
  people: PEOPLE,
  wars: [['staufen', 'welf'], ['galich', 'kiev'], ['pandya', 'chola'], ['hoysala', 'yadava'], ['sosso', 'ghana'], ['norway', 'denmark'], ['khwarazm', 'ghurid'], ['georgia', 'eldiguzid'], ['ghurid', 'chandela'], ['byzantium', 'bulgaria'], ['mongol', 'tatar', 'steppe'], ['kereit', 'tatar', 'steppe'], ['almohad', 'ghaniya'], ['ayyubid', 'aleppo']],
  allies: [['karakhanid', 'qarakhitai'], ['mongol', 'kereit'], ['angevin', 'welf'], ['france', 'staufen'], ['castile', 'aragon'], ['flanders', 'angevin']],
  known: KNOWN,
  inventions: ['paper', 'trebuchet', 'gunpowder', 'compass', 'windmill', 'rotation', 'credit', 'steel', 'printing', 'observatory'],
  roads: ROADS,
  female: ['Tamar', 'Terken Khatun', 'Rusudan', 'Eirene', 'Anna'],
  // After the realms are set up: the marriages the chronicles record between people already at court.
  setup(s) {
    const g = s.realms.georgia, soslan = Object.values(s.chars).find((c) => c.name === 'David Soslan' && c.realm === 'georgia');
    if (g && soslan) {
      const tamar = s.chars[g.ruler];
      if (tamar.spouse && s.chars[tamar.spouse]) delete s.chars[tamar.spouse];
      tamar.spouse = soslan.id;
      soslan.spouse = tamar.id;
      const heir = s.chars[g.heir];
      if (heir) { heir.parentId = tamar.id; tamar.kids = [heir.id]; soslan.kids = [heir.id]; }
    }
  },
  month(s, rng, emit) {
    steppe(s, rng('steppe'), emit);
    alamut(s, rng('alamut'), emit);
    expedition(s, rng('expedition'), emit);
  },
};

// Venice's expedition: Frankish knights who cannot pay the Doge for their ships pay him in another coin. Between
// 1202 and 1205 they may land in Thrace and turn on Constantinople, as they did in 1203.
function expedition(s, rng, emit) {
  const V = s.realms.venice, B = s.realms.byzantium;
  if (s.flags?.expedition || s.month < 26 || s.month > 62 || !V || !B || V.fallen || B.fallen || s.provinces.constantinople?.owner !== 'byzantium') return;
  if (!chance(rng, 0.035)) return;
  (s.flags ??= {}).expedition = s.month;
  const land = ['thrace', 'thessalonica'].find((p) => s.provinces[p]?.owner === 'byzantium') ?? 'thrace';
  const lords = [['Boniface of Montferrat', 'glory', 4], ['Baldwin of Flanders', 'glory', 3], ['Louis of Blois', 'steady', 3]];
  for (const [name, temper, skill] of lords) {
    const g = newChar(s, { name, title: name.startsWith('Baldwin') ? 'Count' : 'Marquis', role: 'general', realm: 'venice', born: 1160 + Math.floor(rng() * 15), temper, skill, culture: 'latin', famous: true });
    const id = newArmy(s, 'venice', g, land, 9);
    s.armies[id].free = true; // the knights live off what they take
  }
  setOwner(s, land, 'venice', 'conquest');
  declareWar(s, 'venice', 'byzantium', emit, { cause: 'expedition', text: `Frankish knights in Venice's pay land at ${cityOf(s, land)}: Doge ${s.chars[V.ruler]?.name ?? ''} turns their swords on Constantinople`.replace('Doge  ', 'the Doge ') });
}

function steppe(s, rng, emit) {
  // Kipchak riders raid the settled lands next to the steppe.
  const kip = s.realms.kipchak;
  if (kip && !kip.fallen && chance(rng, 1 / R.steppe.raidEvery)) {
    const from = provincesOf(s, 'kipchak');
    const targets = from.flatMap((p) => p.neighbors).filter((n) => s.provinces[n].owner && s.provinces[n].owner !== 'kipchak' && !friendly(s, 'kipchak', s.provinces[n].owner));
    if (targets.length) {
      const t = pick(rng, targets), p = s.provinces[t], victim = s.realms[p.owner];
      const loot = Math.min(victim.gold, PROV[t].wealth * 4);
      victim.gold = round1(victim.gold - loot);
      victim.grain = round1(Math.max(0, (victim.grain ?? 0) - PROV[t].wealth * 6));
      kip.gold = round1(kip.gold + loot);
      p.ravaged = Math.max(p.ravaged, 4);
      emit('raid', `Kipchak riders raid ${placeOf(s, t)}, burning villages and carrying off ${Math.round(loot)} gold`, { realms: ['kipchak', victim.id], at: t });
    }
  }
  // Temujin's road to empire: hold the Mongolian steppe, and the tribes proclaim a Great Khan.
  const M = s.realms.mongol;
  const ours = (o) => o === 'mongol' || s.realms[o]?.overlord === 'mongol';
  if (M && !M.fallen && !M.horde && STEPPE.filter((p) => ours(s.provinces[p]?.owner)).length >= STEPPE.length - 1) {
    for (const v of living(s).filter((x) => x.overlord === 'mongol' && x.nomad)) { // the tribes that bowed ride with the khan now
      for (const p of [...provincesOf(s, v.id)]) setOwner(s, p.id, 'mongol', 'inheritance');
      for (const a of [...armiesOf(s, v.id)]) a.realm = 'mongol';
      armiesChanged(s);
      fall(s, v.id, emit, `The ${v.name} join the Mongol nation`, 'mongol');
    }
    const khan = s.chars[M.ruler];
    const was = khan.name;
    if (khan.name === 'Temujin') khan.name = 'Genghis Khan';
    Object.assign(khan, { title: 'Great Khan' });
    Object.assign(M, { horde: true, name: 'Mongol Empire', short: 'Mongols', fa: 'مغولان', plan: null });
    s.record.genghis = s.month;
    const G = R.steppe.mongols, taken = new Set(Object.values(s.chars).filter((c) => c.alive).map((c) => c.name));
    const names = ['Jebe', 'Subutai', 'Jochi', 'Chagatai', 'Ögedei', 'Tolui', 'Jelme', 'Qasar'].filter((n) => !taken.has(n));
    for (let i = 0; i < G.generals; i++) {
      const g = newChar(s, { name: names[i], role: 'general', realm: 'mongol', born: 1180 + i * 3, temper: i < 2 ? 'glory' : 'loyal', traits: i < 2 ? ['relentless', 'bold'] : ['bold'], skill: i < 2 ? 5 : 4, family: i > 1 ? 'Borjigin' : null, culture: 'mongol', famous: true });
      newArmy(s, 'mongol', g, M.capital, G.size / G.generals);
    }
    emit('horde', was === khan.name ? `${was} unites the steppe and is proclaimed Great Khan of all the Mongols` : `${was} unites the steppe and is proclaimed ${khan.name}, Great Khan of all the Mongols`, { realms: ['mongol'], at: M.capital, chars: [khan.id] });
  }
}

// The Lords of Alamut strike on their own account at whoever threatens them.
function alamut(s, rng, emit) {
  const al = s.realms.alamut, A = R.agents;
  if (!al || al.fallen || !chance(rng, 1 / A.alamutEvery) || al.gold < A.alamutStrike || al.contract) return;
  const foes = living(s).filter((r) => r.id !== 'alamut' && (atWar(s, r.id, 'alamut') || provincesOf(s, r.id).some((p) => p.neighbors.some((n) => s.provinces[n].owner === 'alamut'))));
  const target = foes.sort((a, b) => strength(s, b.id) - strength(s, a.id))[0];
  if (!target) return;
  const victims = Object.values(s.chars).filter((c) => c.alive && c.realm === target.id && ['ruler', 'general', 'heir', 'vizier'].includes(c.role));
  const v = victims.find((c) => c.id === target.ruler && rng() < 0.4) ?? pick(rng, victims);
  if (!v) return;
  al.gold -= A.alamutStrike;
  al.contract = { target: v.id, by: 'alamut' };
}
