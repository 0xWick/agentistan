// Paints the pictures of the great-event cards and the portraits of famous people, once, with Workers AI (through
// the Worker's /internal/art), and saves them as JPEGs for tools/art.py to crop into web/art/.
//   node --env-file=.env tools/art.mjs [events|people|all] [only-this-key]
// Free tier: about 58 neurons a picture, 10,000 a day. Pictures already made are skipped.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const SITE = process.env.PUBLIC_URL || 'https://agentistan.umarkhatana.com';
const OUT = new URL('./art-raw/', import.meta.url).pathname;
const PERSIAN = 'Persian miniature painting in the style of a 13th-century illuminated manuscript, flat perspective, delicate brushwork, rich lapis blue, vermilion and gold pigments, aged parchment tones, no text, no letters, no border';
const LATIN = '13th-century illuminated manuscript miniature, flat gothic perspective, tempera and gold leaf, lapis blue and vermilion, aged parchment tones, no text, no letters, no border';
const SONG = 'Song dynasty court painting on silk, fine ink lines and mineral colours, muted gold and blue, aged silk tones, no text, no seals, no calligraphy';

export const EVENTS = {
  battle: 'two medieval armies clash on an open plain, armoured cavalry with lances and banners, horse archers loosing arrows, rising dust',
  siege: 'a walled city under siege, counterweight trebuchets hurling stones, soldiers climbing ladders, a tower burning',
  fallen: 'the smoking ruins of a captured palace, torn banners trampled on the ground, crows circling at dusk',
  crowned: 'a coronation in a palace hall, a new ruler seated on a jewelled throne receiving a crown, courtiers bowing',
  split: 'a rebel lord raising his own banner on a hill before his army, the old capital far behind him',
  coup: 'night in a torch-lit throne room, conspirators with drawn daggers, an overturned throne',
  horde: 'a vast Mongol army of horse archers riding across the open steppe under a great white standard of horse tails',
  golden: 'a city in a golden age, palace gardens with fountains and cypress trees, poets reading, a busy bazaar, domed palaces',
  charter: 'great lords gathered in a meadow forcing a king to seal a charter, a scroll with a red wax seal on a table',
  commune: 'a rich merchant city, guildsmen and merchants gathered in the square to elect their leader, ships in the harbour',
  uprising: 'a crowd of townspeople with torches and clubs storming a palace gate',
  turncoat: 'on a battlefield a general wheels his horsemen around to charge his own side, banners turning',
  invention: 'scholars in a great library with an astrolabe, books and scrolls, an engineer showing a model of a trebuchet',
  court: 'a ruler seated in judgement between two kneeling envoys holding scrolls, a balance scale on a cloth',
  war: 'an envoy delivering a declaration of war to a seated ruler, armies gathering outside the palace',
  decline: 'a half-empty city with cracked walls and overgrown fields, a weary old ruler on a worn throne',
  wedding: 'a royal wedding procession, a bride on a white horse under a canopy, musicians, gifts, two royal banners',
  plague: 'a plague-stricken town, people carrying the sick on litters, empty streets, smoke from fires',
  assassin: 'an assassin with a dagger striking in a palace corridor at night, lamplight and curtains',
  funeral: 'a royal funeral procession carrying a draped bier, mourners, banners lowered',
  expedition: 'a fleet of galleys landing armoured knights and horses on a beach, a great walled city with domes on the horizon',
  famine: 'famine, cracked dry fields, thin peasants beside an empty granary',
  earthquake: 'an earthquake striking a hill fortress, walls cracking and stones falling',
  flood: 'a great river flooding villages and fields under heavy monsoon rain',
  peace: 'two rulers clasping hands beneath a pavilion, scribes writing a treaty, courtiers on both sides',
  raid: 'steppe horsemen raiding a village, huts burning, riders carrying off sacks of loot',
  built: 'masons and labourers building a caravanserai and digging a canal, a master builder with plans, camels',
  winter: 'an army struggling through deep snow in a mountain pass, frozen banners, a blizzard',
};
const styleOf = (k) => (['charter', 'commune', 'expedition'].includes(k) ? LATIN : PERSIAN);

// name slug -> [description, style]
export const PEOPLE = {
  temujin: ['Temujin, a Mongol khan of forty with a braided beard and a fur-brimmed hat, stern gaze', PERSIAN],
  'genghis-khan': ['Genghis Khan, the Great Khan of the Mongols, grey-bearded, fur hat, fierce calm eyes', PERSIAN],
  tamar: ['Tamar, queen of Georgia, a regal woman in a jewelled crown and white veil, rich Georgian robes', PERSIAN],
  'muhammad-ii': ['Muhammad II, Khwarazmshah, a proud Turkic sultan in a white turban with a jewelled plume', PERSIAN],
  'jalal-al-din': ['Jalal al-Din, a young fierce Khwarazmian prince in mail armour and a turban', PERSIAN],
  'al-adil': ['al-Adil, an elderly Ayyubid sultan with a white beard and a large turban, shrewd eyes', PERSIAN],
  'alexios-iii-angelos': ['Alexios III Angelos, Byzantine emperor with a jewelled crown with hanging pearls, purple robes', LATIN],
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
  'han-tuozhou': ['Han Tuozhou, chancellor of the Song, in a black official hat with long wings', SONG],
  'leo-i': ['Leo I, king of Armenian Cilicia, crowned, with a dark beard and a red mantle', LATIN],
  'suleymanshah-ii': ['Suleymanshah II, Seljuk sultan of Rum, turban and armour, a bold face', PERSIAN],
  aimery: ['Aimery, a crusader king of Outremer in mail with a golden crown', LATIN],
  'stefan-nemanjic': ['Stefan Nemanjic, grand prince of Serbia, crowned, in Byzantine-style robes', LATIN],
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
  if (which !== 'people') for (const [k, p] of Object.entries(EVENTS)) jobs.push(['event', k, `${p}. ${styleOf(k)}`]);
  if (which !== 'events') for (const [k, [p, style]] of Object.entries(PEOPLE)) jobs.push(['person', k, `Portrait bust, head and shoulders, of ${p}, facing three-quarters, centred, plain gilded background. ${style}`]);
  for (const [kind, key, prompt] of jobs) {
    if (only && key !== only) continue;
    console.log(kind, key, await paint(kind, key, prompt));
  }
}
