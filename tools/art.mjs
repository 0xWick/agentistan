// Paints the pictures of the great-event cards and the portraits of famous people, once, with Workers AI (through
// the Worker's /internal/art), and saves them as JPEGs for tools/art.py to crop into web/art/.
//   node --env-file=.env tools/art.mjs [events|1914|people|campaigns|cards|all] [only-this-key]
// Free tier: about 58 neurons a picture, 10,000 a day. Pictures already made are skipped.
// The look is true to the period, never a game's: oil paintings in the manner of the old masters and the academic
// history painters, and for the age of the world wars, the photographs of the time.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const SITE = process.env.PUBLIC_URL || 'https://agentistan.umarkhatana.com';
const OUT = new URL('./art-raw/', import.meta.url).pathname;
const NOT = 'no writing anywhere, no letters, no inscriptions, no calligraphy, no flags or banners, no halos, no statues, no crosses or religious symbols, no frame, no border';
const SCENE = `photorealistic oil painting, a 19th-century academic history painting in the manner of Jean-Léon Gérôme and Ernest Meissonier, lifelike figures, true period costume, arms and armour, natural light, atmospheric depth, fine detail, aged varnish, ${NOT}`;
const PORTRAIT = `photorealistic old master oil portrait in the manner of Titian and Rembrandt, lifelike skin and eyes, soft chiaroscuro light, dark plain background, fine brushwork, aged varnish, ${NOT}`;
const PHOTO = 'an authentic black and white documentary photograph from the 1910s, glass plate negative, sepia tone, film grain, natural light, archival press photograph, no writing anywhere, no letters or numbers, no signs or posters, plain flags without emblems or symbols, no religious symbols, no border';
const PHOTO_PORTRAIT = 'an authentic black and white studio portrait photograph of the period, sepia tone, film grain, soft window light, plain backdrop, no writing, no badges or armbands with symbols, no border';
const Y1200 = 'around the year 1200';

// The living world of 1200 (saved as <key>).
// Left out after several tries: a coup, a wedding and a funeral (the model keeps adding halos, crosses and script).
export const EVENTS = {
  battle: 'two armies of medieval Persia and Central Asia clash on an open plain, armoured cavalry in mail and lamellar with lances, horse archers loosing arrows, rising dust',
  siege: 'a walled city under siege, counterweight trebuchets hurling stones, soldiers climbing ladders against the walls, a tower burning, no flags',
  fallen: 'the smoking ruins of a captured brick palace with domes, broken shields and spears trampled on the ground, crows circling at dusk',
  crowned: 'a coronation in a Persian palace hall, a new ruler seated on a jewelled throne receiving a crown, courtiers bowing',
  split: 'a rebel lord on horseback on a hill before his army, pointing away from the old capital far behind him',
  horde: 'a vast Mongol army of horse archers riding across the open steppe under a great white standard of horse tails',
  golden: 'a city in a golden age, palace gardens with fountains and cypress trees, poets reading, a busy bazaar, domed palaces',
  charter: 'great lords gathered in a meadow forcing a king to seal a charter, a scroll with a red wax seal on a table',
  commune: 'a rich merchant city, guildsmen and merchants gathered in the square to elect their leader, ships in the harbour',
  uprising: 'a crowd of townspeople with torches and clubs storming a palace gate',
  turncoat: 'on a battlefield a general wheels his horsemen around to charge his own side, dust rising',
  invention: 'scholars gathered around a brass astrolabe and a celestial globe on a carpet, shelves of bound books, an engineer holding a small model of a siege engine',
  court: 'a ruler seated in judgement between two kneeling envoys holding scrolls, a balance scale on a cloth',
  war: 'an envoy delivering a declaration of war to a seated ruler, armies gathering outside the palace',
  decline: 'a half-empty city with cracked walls and overgrown fields, a weary old ruler on a worn throne',
  plague: 'a plague-stricken town, people carrying the sick on litters, empty streets, smoke from fires',
  assassin: 'an assassin with a dagger striking in a palace corridor at night, lamplight and curtains',
  expedition: 'a fleet of galleys with plain red sails landing armoured knights and horses on a beach, a great walled city with plain domes and towers on the horizon',
  famine: 'famine, cracked dry fields, thin peasants beside an empty granary',
  earthquake: 'an earthquake striking a hill fortress, walls cracking and stones falling',
  flood: 'a great river flooding villages and fields under heavy monsoon rain',
  peace: 'two rulers clasping hands beneath a pavilion, scribes writing a treaty, courtiers on both sides',
  raid: 'steppe horsemen raiding a village, huts burning, riders carrying off sacks of loot',
  built: 'masons laying the brick arches of a caravanserai courtyard, labourers digging a canal beside it, camels resting, a master builder pointing',
  winter: 'an army struggling through deep snow in a mountain pass, frozen spears and cloaks, a blizzard',
};

// The same cards for the age of the world wars (saved as 1914_<key>).
export const EVENTS_1914 = {
  battle: 'soldiers of the First World War, no flags, going over the top from muddy trenches across no man\'s land, barbed wire, shell bursts and smoke',
  siege: 'heavy artillery guns firing at a fortress city on the horizon, gun crews in greatcoats, smoke drifting',
  fallen: 'a shelled capital city at dusk, ruined government buildings, a torn plain flag lying in the street',
  crowned: 'a new head of state taking the oath of office in a grand parliament hall, officials in frock coats',
  split: 'a rebel general addressing his troops from a railway platform, an armoured train behind him',
  uprising: 'a revolutionary crowd storming the gates of a palace in a winter city, soldiers joining them',
  turncoat: 'an army column marching away from the front under a different plain flag, an officer on horseback leading them',
  invention: 'engineers in a hangar beside an early biplane, a wireless radio set and blueprints on a workbench',
  court: 'diplomats in morning coats around a long table at a conference, maps spread out before them',
  war: 'crowds cheering soldiers boarding a troop train in a great railway station, soldiers waving from the carriages',
  decline: 'a poor industrial town in the rain, closed factories, idle workers in flat caps',
  assassin: 'a city street in 1914, an open motor car with an archduke in uniform, a young man stepping from the crowd with a pistol',
  peace: 'statesmen signing a treaty in a gilded hall of mirrors, photographers with tripod cameras',
  built: 'workers building a steel railway bridge beside a factory with tall chimneys, cranes and steam',
  coup: 'soldiers with rifles surrounding a government ministry at night, an armoured car, searchlights',
  slump: 'a long queue of jobless men in overcoats and flat caps outside a closed bank in the rain',
  winter: 'soldiers in greatcoats trudging through deep snow on a frozen front, a blizzard',
  famine: 'famine in a dry countryside, thin farmers beside an empty grain store, cracked fields',
  plague: 'nurses in white masks tending rows of patients in a field hospital during an epidemic',
  flood: 'a great river flooding a town, people in rowing boats rescuing families from rooftops',
  earthquake: 'an earthquake striking a city, collapsed brick buildings, people fleeing into the street',
  golden: 'a prosperous city boulevard, electric trams, cafes, electric street lights, elegant crowds',
  raid: 'cavalry raiders sweeping through a frontier village, haystacks burning',
  charter: 'a crowd of striking workers in front of a parliament, a minister reading a proclamation from the steps',
  commune: 'a workers council meeting in a factory hall, men and women voting with raised hands',
};

// The campaigns' cards: the Mediterranean of antiquity (ancient_<key>), Han China (han_<key>), and each war's own
// picture for its briefing (c_<id>).
export const ANCIENT = {
  battle: 'two armies of classical antiquity clash on a dusty plain, ranks of infantry in bronze helmets with large round shields and long spears, horsemen charging on the flank, dust rising',
  siege: 'an ancient walled city of stone under siege, a tall wooden siege tower and a roofed battering ram at the gate, torsion catapults hurling stones, soldiers with oval shields below the walls',
  expedition: 'a fleet of ancient war galleys with banks of oars and square sails and bronze rams at the prow, landing soldiers on a rocky Mediterranean shore',
  court: 'a general of antiquity in a bronze cuirass and a red cloak in council with his officers inside a large leather tent, a map scratched on a table, oil lamps',
  peace: 'two commanders of antiquity clasping hands in a marble colonnade, envoys and scribes with wax tablets around them, a Mediterranean sky',
  fallen: 'a captured ancient city of stone houses and colonnades burning at dusk, broken columns in the streets, soldiers leading captives away',
  crowned: 'an ancient king acclaimed by his army, soldiers raising their spears and shields as he stands on a dais in a purple cloak and a plain white diadem',
  uprising: 'farmers and townspeople rising in revolt in the rocky hills of the ancient Near East, with slings, spears and farm tools, a watchtower burning',
  built: 'soldiers and engineers of antiquity building a long timber bridge across a wide river, treadwheel cranes, piles being driven into the water',
  charter: 'the citizens of an ancient Greek city seated on the stone steps of an open-air assembly on a hillside, an old man speaking from a plain stone platform, a clerk holding a wax tablet',
  war: 'an ancient army marching along a paved road through olive groves, infantry with oval shields and spears, baggage mules, a commander on horseback',
  horde: 'a great host of Gallic tribal warriors with long hair, moustaches, long shields and swords gathering on a forested hill, war horns raised',
  raid: 'light horsemen of antiquity raiding farmland, olive groves and grain fields burning, villagers fleeing to a walled town',
  turncoat: 'on an ancient battlefield a body of horsemen in bronze helmets wheels away and rides over to the enemy line, its commander pointing with his sword, dust rising, spears only, no flags',
};
export const HAN = {
  war: 'a vast army of Han dynasty China marching along a river valley, infantry in lamellar armour with halberds and crossbows, a general in a chariot',
  raid: 'Han dynasty horsemen raiding a farming village in northern China, grain stacks burning, villagers fleeing',
  court: 'a Han dynasty chancellor in black robes and a tall official hat seated in a timber hall, generals and strategists kneeling on mats before him, maps on silk',
  crowned: 'the enthronement of a new emperor of ancient China in a timber palace hall, officials in black robes kneeling in rows',
  siege: 'a walled city of Han dynasty China, rammed earth walls and wooden gate towers, under siege with ladders and crossbowmen, smoke',
};
export const BRIEFS = {
  persian: 'the sea battle of Salamis in 480 BC, Greek triremes ramming the Persian fleet in a narrow strait, rocky shores, oars and splintered hulls',
  sparta: 'Spartan hoplites in red cloaks and bronze helmets marching through the burning fields of Attica, the long walls of Athens in the distance',
  alexander: 'Alexander the Great on his black horse leading his cavalry in a charge across a dusty plain at the battle of Gaugamela, the vast Persian army and its chariots ahead, no flags',
  hannibal: 'Hannibal\'s army with war elephants crossing the snowy Alps, soldiers and horses on a narrow mountain path, clouds below',
  maccabees: 'Judean rebels hidden among the rocks of the hills of Judea, watching an army with elephants march through a narrow valley below',
  caesar: 'the Roman siege works around the hill fortress of Alesia, earth ramparts, ditches and wooden towers, Gallic warriors on the hill',
  threekingdoms: 'the battle of Red Cliffs in 208, a burning fleet of ancient Chinese warships on the Yangtze river at night, high cliffs lit by fire',
};

// name slug -> [description, style]. The campaigns' heroes and councils first, then the cast of the living world.
const P = PORTRAIT, PP = PHOTO_PORTRAIT;
export const PEOPLE = {
  // the campaigns
  themistocles: ['Themistocles of Athens, a clever, weathered Greek statesman of fifty with a short beard, in a plain wool cloak', P],
  aristides: ['Aristides the Just, an austere elderly Athenian with a grey beard, in a plain white cloak', P],
  xanthippus: ['Xanthippus, an Athenian general with a dark beard, in a bronze helmet pushed back on his head', P],
  'king-archidamus': ['King Archidamus of Sparta, a grey-bearded Spartan king in a red cloak and a bronze cuirass, long hair', P],
  brasidas: ['Brasidas, a bold young Spartan officer with long hair and a beard, in a red cloak and a crested bronze helmet held at his side', P],
  lysander: ['Lysander, a Spartan admiral with long hair and a hard face, in a red cloak, the sea behind him', P],
  alcibiades: ['Alcibiades, a strikingly handsome Athenian aristocrat of forty with curled hair, in a fine embroidered cloak, a sly smile', P],
  alexander: ['Alexander the Great, a young clean-shaven Macedonian king of twenty-five with tousled hair and intense eyes, in a bronze cuirass', P],
  parmenion: ['Parmenion, an old Macedonian general of sixty-five with a white beard, in armour and a purple cloak', P],
  hephaestion: ['Hephaestion, a tall handsome young Macedonian nobleman with dark curls, in a cavalry cuirass', P],
  craterus: ['Craterus, a broad-shouldered Macedonian general of forty with a short beard, in a plain iron helmet', P],
  perdiccas: ['Perdiccas, a stern Macedonian cavalry commander of thirty-five with a beard, in a crested helmet', P],
  'hannibal-barca': ['Hannibal Barca, a Carthaginian general of thirty with a dark curly beard, in a bronze cuirass and a dark cloak, a scar near one eye', P],
  maharbal: ['Maharbal, a lean Carthaginian cavalry commander with a black beard, in a leather cuirass and a red cloak', P],
  'mago-barca': ['Mago Barca, a young Carthaginian with a short dark beard, in a bronze helmet, an eager look', P],
  'judah-maccabee': ['Judah Maccabee, a rugged Judean rebel leader of thirty with a dark beard, in a wool tunic and a leather cuirass, a sword at his shoulder', P],
  simon: ['Simon, an older Judean leader with a long greying beard and a wise face, in a striped wool robe', P],
  jonathan: ['Jonathan, a young Judean fighter with a short black beard, in a wool tunic and a leather cuirass', P],
  eleazar: ['Eleazar, a powerfully built Judean warrior with a thick beard and a spear', P],
  'julius-caesar': ['Julius Caesar at forty-two, a lean Roman general with thinning hair and sharp eyes, clean-shaven, in a muscled cuirass and a red general\'s cloak', P],
  'titus-labienus': ['Titus Labienus, a tough Roman legate of fifty with short grey hair, clean-shaven, in mail armour', P],
  'mark-antony': ['Mark Antony at thirty, a strong Roman officer with curly hair and a thick neck, clean-shaven, in a cuirass', P],
  'cao-cao': ['Cao Cao, a Han dynasty chancellor of fifty with a thin moustache and a goatee, in black robes and a tall black official hat, shrewd eyes', P],
  'guo-jia': ['Guo Jia, a young Han dynasty strategist with a pale clever face and a wispy beard, in grey robes and a scholar\'s cap', P],
  'xun-yu': ['Xun Yu, a dignified Han dynasty minister with a long black beard, in dark robes and an official hat', P],
  'sima-yi': ['Sima Yi, a watchful Han dynasty official of thirty with a thin beard and narrow eyes, in black robes and an official hat', P],
  'jia-xu': ['Jia Xu, an elderly cunning Han dynasty adviser with a long grey beard, in plain robes', P],
  // the campaigns still to come
  attila: ['Attila, king of the Huns, a broad-faced steppe warrior king with a thin beard and deep-set eyes, in furs and a gold-trimmed coat', P],
  'khalid-ibn-al-walid': ['Khalid ibn al-Walid, an Arab general of the seventh century with a black beard, in a mail coat and a simple turban, desert light', P],
  'william-of-normandy': ['William, Duke of Normandy, a powerful clean-shaven Norman lord of thirty-eight with short hair, in a mail hauberk', P],
  'godfrey-of-bouillon': ['Godfrey of Bouillon, a tall fair-bearded Frankish duke of thirty-five in a mail coif and a plain undyed surcoat', P],
  saladin: ['Saladin, Sultan of Egypt and Syria, a slight man of fifty with a short black beard and calm eyes, in a white turban and a plain robe over mail', P],
  'henry-v': ['Henry V of England, a young king of twenty-eight with a long face and short pudding-bowl hair, clean-shaven, in plate armour, a gold circlet', P],
  'jan-zizka': ['Jan Žižka, a grizzled Bohemian commander of sixty with a long moustache and a patch over one eye, in a fur hat and a leather coat', P],
  'mehmed-ii': ['Mehmed II, the young Ottoman sultan of twenty-one with a hooked nose and a short beard, in a large white turban and a rich kaftan', P],
  'isabella-of-castile': ['Isabella I, Queen of Castile, a fair-haired woman of thirty-five with a calm resolute face, in a dark velvet gown and a jewelled headdress', P],
  babur: ['Babur, a Central Asian king of forty with a moustache and a short beard, in a turban and a quilted coat, a sword at his side', P],
  'henry-of-navarre': ['Henry IV, King of France and Navarre, a lively man of forty with a hooked nose and a short grey beard, in black doublet with a white ruff', P],
  'gustavus-adolphus': ['Gustavus Adolphus, King of Sweden, a heavy-set fair man of thirty-six with an upturned moustache and a pointed beard, in a buff leather coat and a steel gorget', P],
  napoleon: ['Napoleon Bonaparte at thirty-six, Emperor of the French, in the plain green coat of a colonel of chasseurs, short dark hair', P],
  'wilhelm-ii': ['Kaiser Wilhelm II of Germany at fifty-five, with his upturned moustache, in a plain grey field uniform', PP],
  'winston-churchill': ['Winston Churchill at sixty-five, the British Prime Minister, a round face and a stern look, in a dark suit and bow tie', PP],
  'georgy-zhukov': ['Marshal Georgy Zhukov at forty-five, a square-jawed Soviet commander in a plain military tunic and peaked cap', PP],
  // the living world
  temujin: [`Temujin, a Mongol khan of forty with a braided beard and a fur-brimmed hat, stern gaze, ${Y1200}`, P],
  'genghis-khan': [`Genghis Khan, the Great Khan of the Mongols, grey-bearded, fur hat, fierce calm eyes, ${Y1200}`, P],
  tamar: ['Tamar, queen of Georgia, a regal woman in a jewelled crown and white veil, rich Georgian robes', P],
  'muhammad-ii': ['Muhammad II, Khwarazmshah, a proud Turkic sultan in a white turban with a jewelled plume', P],
  'jalal-al-din': ['Jalal al-Din, a young fierce Khwarazmian prince in mail armour and a turban', P],
  'al-adil': ['al-Adil, an elderly Ayyubid sultan with a white beard and a large turban, shrewd eyes', P],
  kaloyan: ['Kaloyan, tsar of Bulgaria, a fierce bearded king with a golden crown and red cloak', P],
  'enrico-dandolo': ['Enrico Dandolo, the aged blind Doge of Venice in the horned ducal cap and gold robe', P],
  'theodore-laskaris': ['Theodore Laskaris, a Byzantine general in lamellar armour with a dark beard', P],
  'mu-izz-al-din-muhammad': ['Muhammad of Ghor, a warrior sultan with a black beard, turban and mail', P],
  'ghiyath-al-din-muhammad': ['Ghiyath al-Din of Ghor, an elderly sultan with a grey beard and a jewelled turban', P],
  'qutb-al-din-aibak': ['Qutb al-Din Aibak, a Turkic general turned sultan, helmet and mail, short beard', P],
  toghrul: ['Toghrul, the Ong Khan of the Kereit, an old steppe khan with a white beard and fur hat', P],
  'yelu-zhilugu': ['Yelü Zhilugu, gurkhan of the Qara Khitai, in Chinese-style robes and a fur hat', P],
  kuchlug: ['Kuchlug, a young Naiman prince with a fur hat and a cruel smile', P],
  zhangzong: ['Emperor Zhangzong of Jin in imperial robes and a black crown, a scholarly face', P],
  ningzong: ['Emperor Ningzong of Song in yellow robes and an imperial hat, a gentle tired face', P],
  'han-tuozhou': ['Han Tuozhou, chancellor of the Song, a stern man in a black official hat with long wings and a red robe', P],
  'suleymanshah-ii': ['Suleymanshah II, Seljuk sultan of Rum, turban and armour, a bold face', P],
  aimery: ['Aimery, a king of Outremer in mail with a golden crown and a plain surcoat', P],
  emeric: ['Emeric, king of Hungary, crowned, with a forked beard and a fur-lined cloak', P],
  borte: ['Borte, a Mongol khatun wearing the tall boqta headdress, wise calm face', P],
  'terken-khatun': ['Terken Khatun, a formidable Turkic queen mother in jewels and a veil', P],
  'david-soslan': ['David Soslan, a Georgian prince consort and warrior in a mail coat', P],
  jebe: ['Jebe, a Mongol general and archer with a bow, fur hat, sharp eyes', P],
  subutai: ['Subutai, a Mongol general with a weathered face and a helmet with a plume', P],
  'lakshmana-sena': ['Lakshmana Sena, an aged king of Bengal with a jewelled turban and pearl necklaces', P],
  'bakhtiyar-khalji': ['Bakhtiyar Khalji, a Turkic general with long arms, a turban and a sword', P],
  'muhammad-an-nasir': ['Muhammad an-Nasir, the young Almohad ruler of the Maghreb in a white turban and burnous', P],
  'az-zahir-ghazi': ['az-Zahir Ghazi, Ayyubid prince of Aleppo, a young bearded ruler in a turban', P],
  frederick: ['Frederick of Sicily as a boy king, a golden crown on fair hair, a red mantle', P],
  'euphrosyne-doukaina': ['Euphrosyne Doukaina, Byzantine empress, a jewelled crown with hanging pearls, a sharp face', P],
  'yang-meizi': ['Empress Yang of Song, a court lady with a phoenix crown, a cunning gaze', P],
};

async function paint(kind, key, prompt) {
  const file = `${OUT}${kind}-${key}.jpg`;
  if (existsSync(file)) return 'kept';
  const res = await fetch(`${SITE}/internal/art`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-realm-secret': process.env.REALM_SECRET }, body: JSON.stringify({ prompt, steps: 6 }) });
  if (!res.ok) return `failed ${res.status} ${(await res.text()).slice(0, 120)}`;
  const { image } = await res.json();
  writeFileSync(file, Buffer.from(image, 'base64'));
  return 'painted';
}

// Each campaign card's own picture: the war, the moment, the scene its text describes.
async function cardJobs() {
  const { CAMPAIGNS } = await import('../web/campaign/catalog.js');
  const out = [];
  for (const C of CAMPAIGNS) for (const c of C.cards ?? []) {
    const scene = String(c.text ?? '').split(/(?<=[.!?])\s/)[0].replace(/\byou(r)?\b/gi, (w) => (w.toLowerCase() === 'your' ? 'the' : 'the commander'));
    out.push(['event', `card_${C.id}_${c.id}`, `${C.title}, ${C.years}: ${c.title}. ${scene} ${C.hero.look === 'han' ? 'Han dynasty China.' : 'Classical antiquity.'} ${SCENE}`]);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [which = 'all', only] = process.argv.slice(2);
  mkdirSync(OUT, { recursive: true });
  const jobs = [], is = (w) => which === w || which === 'all';
  if (is('campaigns')) {
    for (const [k, p] of Object.entries(BRIEFS)) jobs.push(['event', `c_${k}`, `${p}. ${SCENE}`]);
    for (const [k, p] of Object.entries(ANCIENT)) jobs.push(['event', `ancient_${k}`, `${p}. ${SCENE}`]);
    for (const [k, p] of Object.entries(HAN)) jobs.push(['event', `han_${k}`, `${p}. ${SCENE}`]);
  }
  if (is('cards')) jobs.push(...await cardJobs());
  if (is('events')) for (const [k, p] of Object.entries(EVENTS)) jobs.push(['event', k, `${p}, ${Y1200}. ${SCENE}`]);
  if (is('1914')) for (const [k, p] of Object.entries(EVENTS_1914)) jobs.push(['event', `1914_${k}`, `${p}. ${PHOTO}`]);
  if (is('people')) for (const [k, [p, style]] of Object.entries(PEOPLE)) jobs.push(['person', k, `Portrait bust, head and shoulders, of ${p}, facing three-quarters, centred. ${style}`]);
  for (const [kind, key, prompt] of jobs) {
    if (only && key !== only) continue;
    const r = await paint(kind, key, prompt);
    console.log(kind, key, r);
    if (r.startsWith('failed') && /neuron|quota|limit|4006/i.test(r)) break; // the day's allowance is spent
  }
}
