// Paints the pictures of the great-event cards and the portraits of famous people, once, with Workers AI (through
// the Worker's /internal/art), and saves them as JPEGs for tools/art.py to crop into web/art/.
//   node --env-file=.env tools/art.mjs [events|1914|people|all] [only-this-key]
// Free tier: about 58 neurons a picture, 10,000 a day. Pictures already made are skipped.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const SITE = process.env.PUBLIC_URL || 'https://agentistan.umarkhatana.com';
const OUT = new URL('./art-raw/', import.meta.url).pathname;
const PERSIAN = 'Persian miniature painting in the style of a 13th-century illuminated manuscript, flat perspective, delicate brushwork, rich lapis blue, vermilion and gold pigments, aged parchment tones, plain coloured banners without emblems or symbols, no writing anywhere, no inscriptions, no calligraphy, no halos, no crosses or religious symbols, no border';
const LATIN = '13th-century illuminated manuscript miniature, flat gothic perspective, tempera and gold leaf, lapis blue and vermilion, aged parchment tones, plain coloured banners without emblems or symbols, no writing anywhere, no inscriptions, no calligraphy, no halos, no crosses or religious symbols, no border';
const SONG = 'Song dynasty court painting on silk, fine ink lines and mineral colours, muted gold and blue, aged silk tones, no writing anywhere, no seals, no calligraphy, no halos, no religious symbols';

// Left out after several tries: a coup, a wedding and a funeral (the model keeps adding halos, crosses and script).
export const EVENTS = {
  battle: 'two medieval armies clash on an open plain, armoured cavalry with lances and banners, horse archers loosing arrows, rising dust',
  siege: 'a walled city under siege, counterweight trebuchets hurling stones, soldiers climbing ladders against the walls, a tower burning, no flags',
  fallen: 'the smoking ruins of a captured palace, torn banners trampled on the ground, crows circling at dusk',
  crowned: 'a coronation in a palace hall, a new ruler seated on a jewelled throne receiving a crown, courtiers bowing',
  split: 'a rebel lord raising his own banner on a hill before his army, the old capital far behind him',
  horde: 'a vast Mongol army of horse archers riding across the open steppe under a great white standard of horse tails',
  golden: 'a city in a golden age, palace gardens with fountains and cypress trees, poets reading, a busy bazaar, domed palaces',
  charter: 'great lords gathered in a meadow forcing a king to seal a charter, a scroll with a red wax seal on a table',
  commune: 'a rich merchant city, guildsmen and merchants gathered in the square to elect their leader, ships in the harbour',
  uprising: 'a crowd of townspeople with torches and clubs storming a palace gate',
  turncoat: 'on a battlefield a general wheels his horsemen around to charge his own side, banners turning',
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
  winter: 'an army struggling through deep snow in a mountain pass, frozen banners, a blizzard',
};
const styleOf = (k) => (['charter', 'commune'].includes(k) ? LATIN : PERSIAN);

// The same cards for the age of the world wars (saved as 1914_<key>).
const MODERN = 'painted illustration in the style of a 1910s illustrated magazine, oil on canvas, muted khaki, grey, ochre and brick red, soft light, aged varnish, no writing anywhere, no letters or numbers, no signs or posters, plain flags without emblems or symbols, no religious symbols, no border';
export const EVENTS_1914 = {
  battle: 'soldiers of the First World War going over the top from muddy trenches across no man\'s land, barbed wire, shell bursts and smoke',
  siege: 'heavy artillery guns firing at a fortress city on the horizon, gun crews in greatcoats, smoke drifting',
  fallen: 'a shelled capital city at dusk, ruined government buildings, a torn plain flag lying in the street',
  crowned: 'a new head of state taking the oath of office in a grand parliament hall, officials in frock coats',
  split: 'a rebel general addressing his troops from a railway platform, an armoured train behind him',
  uprising: 'a revolutionary crowd with plain red banners storming the gates of a palace in a winter city, soldiers joining them',
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
  charter: 'striking workers with plain red banners in front of a parliament, a minister reading a proclamation from the steps',
  commune: 'a workers council meeting in a factory hall, men and women voting with raised hands',
};

// name slug -> [description, style]
export const PEOPLE = {
  temujin: ['Temujin, a Mongol khan of forty with a braided beard and a fur-brimmed hat, stern gaze', PERSIAN],
  'genghis-khan': ['Genghis Khan, the Great Khan of the Mongols, grey-bearded, fur hat, fierce calm eyes', PERSIAN],
  tamar: ['Tamar, queen of Georgia, a regal woman in a jewelled crown and white veil, rich Georgian robes', PERSIAN],
  'muhammad-ii': ['Muhammad II, Khwarazmshah, a proud Turkic sultan in a white turban with a jewelled plume', PERSIAN],
  'jalal-al-din': ['Jalal al-Din, a young fierce Khwarazmian prince in mail armour and a turban', PERSIAN],
  'al-adil': ['al-Adil, an elderly Ayyubid sultan with a white beard and a large turban, shrewd eyes', PERSIAN],
  kaloyan: ['Kaloyan, tsar of Bulgaria, a fierce bearded king with a golden crown and red cloak', LATIN],
  'enrico-dandolo': ['Enrico Dandolo, the aged blind Doge of Venice in the horned ducal cap and gold robe', LATIN],
  'theodore-laskaris': ['Theodore Laskaris, a Byzantine general in lamellar armour with a dark beard', LATIN],
  'mu-izz-al-din-muhammad': ['Muhammad of Ghor, a warrior sultan with a black beard, turban and mail', PERSIAN],
  'ghiyath-al-din-muhammad': ['Ghiyath al-Din of Ghor, an elderly sultan with a grey beard and a jewelled turban', PERSIAN],
  'qutb-al-din-aibak': ['Qutb al-Din Aibak, a Turkic general turned sultan, helmet and mail, short beard', PERSIAN],
  toghrul: ['Toghrul, the Ong Khan of the Kereit, an old steppe khan with a white beard and fur hat', PERSIAN],
  'yelu-zhilugu': ['Yelü Zhilugu, gurkhan of the Qara Khitai, in Chinese-style robes and a fur hat', SONG],
  kuchlug: ['Kuchlug, a young Naiman prince with a fur hat and a cruel smile', PERSIAN],
  zhangzong: ['Emperor Zhangzong of Jin in imperial robes and a black crown, a scholarly face', SONG],
  ningzong: ['Emperor Ningzong of Song in yellow robes and an imperial hat, a gentle tired face', SONG],
  'han-tuozhou': ['Han Tuozhou, chancellor of the Song, a stern man in a black official hat with long wings and a red robe', SONG],
  'suleymanshah-ii': ['Suleymanshah II, Seljuk sultan of Rum, turban and armour, a bold face', PERSIAN],
  aimery: ['Aimery, a crusader king of Outremer in mail with a golden crown', LATIN],
  emeric: ['Emeric, king of Hungary, crowned, with a forked beard and a fur-lined cloak', LATIN],
  borte: ['Borte, a Mongol khatun wearing the tall boqta headdress, wise calm face', PERSIAN],
  'terken-khatun': ['Terken Khatun, a formidable Turkic queen mother in jewels and a veil', PERSIAN],
  'david-soslan': ['David Soslan, a Georgian prince consort and warrior in a mail coat', PERSIAN],
  jebe: ['Jebe, a Mongol general and archer with a bow, fur hat, sharp eyes', PERSIAN],
  subutai: ['Subutai, a Mongol general with a weathered face and a helmet with a plume', PERSIAN],
  'lakshmana-sena': ['Lakshmana Sena, an aged king of Bengal with a jewelled turban and pearl necklaces', PERSIAN],
  'bakhtiyar-khalji': ['Bakhtiyar Khalji, a Turkic general with long arms, a turban and a sword', PERSIAN],
  'muhammad-an-nasir': ['Muhammad an-Nasir, the young Almohad ruler of the Maghreb in a white turban and burnous', PERSIAN],
  'az-zahir-ghazi': ['az-Zahir Ghazi, Ayyubid prince of Aleppo, a young bearded ruler in a turban', PERSIAN],
  frederick: ['Frederick of Sicily as a boy king, a golden crown on fair hair, a red mantle', LATIN],
  'euphrosyne-doukaina': ['Euphrosyne Doukaina, Byzantine empress, a jewelled crown with hanging pearls, a sharp face', LATIN],
  'yang-meizi': ['Empress Yang of Song, a court lady with a phoenix crown, a cunning gaze', SONG],
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const [which = 'all', only] = process.argv.slice(2);
  mkdirSync(OUT, { recursive: true });
  const jobs = [];
  if (which === 'events' || which === 'all') for (const [k, p] of Object.entries(EVENTS)) jobs.push(['event', k, `${p}. ${styleOf(k)}`]);
  if (which === '1914' || which === 'all') for (const [k, p] of Object.entries(EVENTS_1914)) jobs.push(['event', `1914_${k}`, `${p}. ${MODERN}`]);
  if (which === 'people' || which === 'all') for (const [k, [p, style]] of Object.entries(PEOPLE)) jobs.push(['person', k, `Portrait bust, head and shoulders, of ${p}, facing three-quarters, centred, plain gilded background. ${style}`]);
  for (const [kind, key, prompt] of jobs) {
    if (only && key !== only) continue;
    console.log(kind, key, await paint(kind, key, prompt));
  }
}
