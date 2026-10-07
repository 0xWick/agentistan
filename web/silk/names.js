// Names for the people the world invents: heirs, new generals, rebel leaders, founders. Each region names its own,
// with the naming customs of the time, so a new Sultan of Multan never sounds like a Georgian prince.
export const CULTURE_OF = {
  // provinces default to 'persian'; these follow other customs
  georgian: ['kartli', 'imereti', 'ani'],
  arab: ['baghdad', 'basra', 'mosul', 'khuzestan', 'amid'],
  kurd: ['shahrazur', 'lur'],
  turk: ['gurganj', 'khiva', 'bukhara', 'samarkand', 'nasaf', 'ushrusana', 'shash', 'ferghana', 'otrar', 'jand', 'talas', 'balasagun', 'almaliq', 'kashgar', 'khotan', 'termez', 'arran', 'shirvan', 'derbent', 'tabriz', 'ardabil', 'nakhchivan'],
  steppe: ['kipchak', 'saqsin', 'mangyshlak'],
  afghan: ['ghor', 'bamiyan', 'ghazni', 'kabul', 'kandahar', 'sistan', 'badakhshan', 'khuttal', 'herat', 'balkh', 'peshawar'],
  punjabi: ['lahore', 'multan', 'saltrange'],
  sindhi: ['thatta', 'sehwan', 'makran', 'turan'],
  kashmiri: ['kashmir'],
  rajput: ['ajmer', 'ranthambore', 'gwalior', 'marwar', 'thar', 'gujarat', 'saurashtra', 'malwa', 'kalinjar'],
  hindustani: ['delhi', 'kannauj', 'varanasi', 'bihar'],
  bengali: ['bengal'],
  greek: ['constantinople', 'thrace', 'thessalonica', 'hellas', 'morea', 'epirus', 'nicaea', 'smyrna', 'attaleia', 'trebizond', 'cyprus'],
  latin: ['palermo', 'naples', 'apulia', 'rome', 'romagna', 'tuscany', 'venice', 'genoa', 'milan', 'acre', 'antioch', 'tripoli'],
  armenian: ['cilicia'],
  berber: ['marrakesh', 'fez', 'sijilmasa', 'tlemcen', 'bejaia', 'tunis'],
  nubian: ['dongola'],
  slavic: ['tarnovo', 'sofia', 'varna', 'ras'],
  magyar: ['hungary'],
  chinese: ['zhongdu', 'kaifeng', 'datong', 'liaoyang', 'huining', 'taiyuan', 'jingzhao', 'jinan', 'linan', 'jiankang', 'xiangyang', 'ezhou', 'chengdu', 'changsha', 'quanzhou', 'guangzhou', 'hanzhong', 'xingqing', 'ganzhou', 'shazhou', 'liangzhou', 'dali'],
  mongol: ['kherlen', 'tula', 'altai', 'selenga', 'buir', 'gobi'],
};
// Later additions to older cultures.
CULTURE_OF.arab.push('cairo', 'alexandria', 'qus', 'damascus', 'jerusalem', 'karak', 'homs', 'edessa', 'aleppo', 'tripolitania', 'barqa');
CULTURE_OF.turk.push('konya', 'kayseri', 'sivas', 'malatya', 'ankara', 'erzurum', 'kastamonu', 'qocho', 'hami');
CULTURE_OF.steppe.push('cumania');

const NAMES = {
  persian: ['Mas\'ud', 'Bahram', 'Kayqubad', 'Rustam', 'Shahriyar', 'Ardashir', 'Isfandiyar', 'Mahmud', 'Sa\'d', 'Nusrat al-Din', 'Fakhr al-Din', 'Shams al-Din', 'Izz al-Din', 'Abu Sa\'id', 'Farrukhzad', 'Qubad'],
  turk: ['Arslan', 'Tughril', 'Sanjar', 'Alp Tegin', 'Inanch', 'Qutlugh', 'Toghan', 'Kilij', 'Altuntash', 'Er Buqa', 'Tekish', 'Ilchi', 'Yaghan', 'Boz Arslan', 'Qara Sonqur', 'Uzbek'],
  steppe: ['Köten', 'Bachman', 'Tugor', 'Kunchek', 'Boniak', 'Konchak', 'Tarkhan', 'Itlar', 'Kutlu', 'Ay Aba'],
  mongol: ['Altan', 'Quchar', 'Daritai', 'Jamukha', 'Sorqan', 'Badai', 'Kishiliq', 'Naya', 'Toghon', 'Ilugei', 'Qorchi', 'Mönglik', 'Tolun', 'Kitbuqa'], // Genghis's sons and generals are kept for the Great Khan's own house
  arab: ['Ahmad', 'Ja\'far', 'Abd Allah', 'Muhammad', 'Ali', 'Hasan', 'Yusuf', 'Ibrahim', 'Isma\'il', 'Badr al-Din', 'Mu\'ayyad al-Din', 'Sharaf al-Din'],
  kurd: ['Hazarasp', 'Badr', 'Shuja\'', 'Mamlan', 'Abu\'l-Hayja', 'Sayf al-Din'],
  georgian: ['Giorgi', 'Davit', 'Bagrat', 'Demetre', 'Ivane', 'Zakaria', 'Vakhtang', 'Shalva', 'Avag', 'Rusudan', 'Tamar', 'Shota'],
  afghan: ['Ala al-Din', 'Baha al-Din', 'Shihab al-Din', 'Husayn', 'Sam', 'Sayf al-Din', 'Qutb al-Din', 'Taj al-Din', 'Fakhr al-Din', 'Nasir al-Din', 'Jalal al-Din', 'Ikhtiyar al-Din'],
  punjabi: ['Khokhar Rai Sal', 'Shaykha', 'Jaspal', 'Sarang', 'Rai Kamal', 'Nasir al-Din', 'Izz al-Din'],
  sindhi: ['Dodo', 'Chanesar', 'Bhungar', 'Armil', 'Hamir', 'Sanghar', 'Unar', 'Khafif'],
  kashmiri: ['Rajadeva', 'Jagadeva', 'Sangramadeva', 'Ramadeva', 'Lakshmanadeva', 'Simhadeva', 'Suhadeva'],
  rajput: ['Hammira', 'Vagbhata', 'Jaitrasimha', 'Viradhavala', 'Udayasimha', 'Arjunavarman', 'Devapala', 'Trailokyavarman', 'Vira', 'Jayasimha', 'Vishvamalla', 'Chachigadeva'],
  hindustani: ['Harishchandra', 'Adakkamalla', 'Hariraja', 'Jayachandra', 'Vijayapala', 'Ranapala'],
  bengali: ['Vishvarupa', 'Keshava', 'Madhava', 'Surya', 'Danuja', 'Sadhana'],
  greek: ['Theodore', 'Michael', 'Manuel', 'Alexios', 'Isaac', 'John', 'Andronikos', 'Constantine', 'Nikephoros', 'Leo', 'Basil', 'Demetrios', 'Eirene', 'Anna'],
  latin: ['Henry', 'Baldwin', 'Boniface', 'Walter', 'Raymond', 'Guy', 'Conrad', 'Manfred', 'Roger', 'William', 'Tancred', 'Pietro', 'Marco', 'Ranieri', 'Ottone'],
  armenian: ['Hethum', 'Thoros', 'Oshin', 'Rupen', 'Smbat', 'Vasak', 'Constantine', 'Leo'],
  berber: ['Yusuf', "Ya'qub", 'Abu Zakariya', 'Abu Hafs', 'Yaghmurasan', 'Abd al-Wahid', 'Idris', 'Tashfin', 'Abu Yahya'],
  nubian: ['Moses', 'Georgios', 'David', 'Basil', 'Kudanbes', 'Shekanda', 'Barak'],
  slavic: ['Boril', 'Asen', 'Peter', 'Stefan', 'Vukan', 'Radoslav', 'Strez', 'Dragan', 'Vladislav', 'Ivanko'],
  magyar: ['Béla', 'Andrew', 'Ladislaus', 'Stephen', 'Coloman', 'Géza'],
  chinese: ['Zhang Rou', 'Shi Tianze', 'Li Quan', 'Meng Gong', 'Wang Jian', 'Chen Hao', 'Liu Ying', 'Zhao Kui', 'Peng Yiwu', 'Wanyan Heda', 'Wanyan Yi', 'Puxian Wannu', 'Yan Shi', 'Du Gao'],
};

const TITLE = { persian: 'Malik', turk: 'Khan', steppe: 'Khan', mongol: 'Khan', arab: 'Amir', kurd: 'Amir', georgian: 'King', afghan: 'Sultan', punjabi: 'Rai', sindhi: 'Jam', kashmiri: 'King', rajput: 'Raja', hindustani: 'Raja', bengali: 'King',
  greek: 'Despot', latin: 'Count', armenian: 'Prince', berber: 'Amir', nubian: 'King', slavic: 'Prince', magyar: 'King', chinese: 'King' };
const KINGDOM = { persian: 'Kingdom of', turk: 'Khanate of', steppe: 'Horde of', mongol: 'Khanate of', arab: 'Emirate of', kurd: 'Emirate of', georgian: 'Kingdom of', afghan: 'Sultanate of', punjabi: 'Kingdom of', sindhi: 'Kingdom of', kashmiri: 'Kingdom of', rajput: 'Kingdom of', hindustani: 'Kingdom of', bengali: 'Kingdom of',
  greek: 'Despotate of', latin: 'County of', armenian: 'Principality of', berber: 'Emirate of', nubian: 'Kingdom of', slavic: 'Principality of', magyar: 'Kingdom of', chinese: 'Kingdom of' };

export function cultureOf(provinceId) {
  for (const [c, ids] of Object.entries(CULTURE_OF)) if (ids.includes(provinceId)) return c;
  return 'persian';
}

// pick(rng, list): rng() in [0,1)
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export function personName(rng, culture, used = new Set()) {
  const pool = NAMES[culture] ?? NAMES.persian;
  for (let i = 0; i < 8; i++) {
    const n = pick(rng, pool);
    if (!used.has(n)) return n;
  }
  return `${pick(rng, pool)} ${['the Younger', 'II', 'the Elder', 'III'][Math.floor(rng() * 4)]}`;
}

export const titleFor = (culture) => TITLE[culture] ?? 'Malik';
export const kingdomName = (culture, place) => `${KINGDOM[culture] ?? 'Kingdom of'} ${place}`;

// Traits shape what a character does when no AI is speaking for them, and how the AI plays them when it is.
export const TRAITS = ['bold', 'cautious', 'ambitious', 'loyal', 'greedy', 'just', 'cruel', 'wise', 'proud', 'restless', 'steadfast', 'scheming', 'beloved', 'timid', 'shrewd']; // none religious
export const randomTraits = (rng, n = 2) => {
  const out = new Set();
  while (out.size < n) out.add(pick(rng, TRAITS));
  return [...out];
};

// Daughters, consorts and queens, by the customs of each land.
const WOMEN = {
  persian: ['Shirin', 'Gawhar', 'Mahin', 'Khurshid', 'Parvin', 'Roshanak', 'Banu', 'Mihrnaz', 'Turan', 'Zarrin'],
  turk: ['Altun', 'Qutlugh', 'Ay Khatun', 'Toghay', 'Inanch Khatun', 'Khan Sultan', 'Saljuq Khatun', 'Ay Chichek', 'Türkan'],
  steppe: ['Ay Chichek', 'Altunchek', 'Saru', 'Bike', 'Kunchek', 'Aylin'],
  mongol: ['Altani', 'Qulan', 'Qadaqan', 'Oghul', 'Tümelün', 'Checheyigen', 'Alaqai', 'Qojin', 'Bulughan', 'Nomolun'],
  arab: ['Fatima', 'Zaynab', 'Maymuna', 'Dayfa', 'Shajar', 'Sitt al-Sham', 'Asma', 'Layla', 'Rabi\'a', 'Zumurrud'],
  kurd: ['Gulnar', 'Khanzad', 'Hamida', 'Rabi\'a', 'Nergis'],
  georgian: ['Rusudan', 'Gurandukht', 'Borena', 'Khoreshan', 'Mariam', 'Ketevan', 'Nestan', 'Tinatin'],
  afghan: ['Razia', 'Shah Turkan', 'Malika-yi Jahan', 'Gawhar', 'Zarrin', 'Banu'],
  punjabi: ['Kaulan', 'Sundari', 'Rupmati', 'Harbans', 'Jindan'],
  sindhi: ['Marui', 'Sasui', 'Nuri', 'Lila', 'Sohni'],
  kashmiri: ['Kota', 'Didda', 'Suryamati', 'Sugandha', 'Lalla'],
  rajput: ['Padmini', 'Samyukta', 'Karnavati', 'Rupmati', 'Durgavati', 'Hamsa'],
  hindustani: ['Lakshmi', 'Kumaradevi', 'Prabhavati', 'Sarasvati', 'Kamala'],
  bengali: ['Bhavani', 'Shyama', 'Chandra', 'Kamala', 'Malati'],
  greek: ['Eirene', 'Anna', 'Theodora', 'Maria', 'Euphrosyne', 'Zoe', 'Helena', 'Eudokia'],
  latin: ['Constance', 'Isabella', 'Margaret', 'Beatrice', 'Matilda', 'Adelaide', 'Agnes', 'Sibylla', 'Alice', 'Joanna'],
  armenian: ['Zabel', 'Rita', 'Stephanie', 'Tamta', 'Mariun'],
  berber: ['Zaynab', 'Tamima', 'Kanza', 'Fanu', 'Hawwa'],
  nubian: ['Mariam', 'Martha', 'Kyra', 'Eiparta'],
  slavic: ['Anna', 'Elena', 'Desislava', 'Irina', 'Kira', 'Milica'],
  magyar: ['Margaret', 'Gertrude', 'Elizabeth', 'Yolanda', 'Constance'],
  chinese: ['Li Fengniang', 'Yang Meizi', 'Wu Yun', 'Xie Daoqing', 'Zhou Ying', 'Han Yueniang', 'Zhao Jiao', 'Wanyan Ying'],
};
export function womanName(rng, culture, used = new Set()) {
  const pool = WOMEN[culture] ?? WOMEN.persian;
  for (let i = 0; i < 8; i++) {
    const n = pick(rng, pool);
    if (!used.has(n)) return n;
  }
  return `${pick(rng, pool)} ${['the Younger', 'II', 'the Elder'][Math.floor(rng() * 3)]}`;
}
const WOMEN_SET = new Set(Object.values(WOMEN).flat());
export const isWomanName = (n) => WOMEN_SET.has(n);

const CONSORT = { turk: 'Khatun', steppe: 'Khatun', mongol: 'Khatun', persian: 'Khatun', kurd: 'Khatun', afghan: 'Malika', arab: 'Sayyida', berber: 'Sayyida', punjabi: 'Rani', sindhi: 'Rani',
  rajput: 'Rani', hindustani: 'Rani', bengali: 'Rani', kashmiri: 'Queen', greek: 'Empress', chinese: 'Empress', latin: 'Queen', georgian: 'Queen', armenian: 'Queen', slavic: 'Queen', magyar: 'Queen', nubian: 'Queen' };
export const consortTitle = (culture, female = true) => (female ? CONSORT[culture] ?? 'Queen' : 'Prince consort');
const VIZIER = { greek: 'Logothete', slavic: 'Logothete', latin: 'Chancellor', magyar: 'Chancellor', georgian: 'Chancellor', armenian: 'Chancellor', chinese: 'Chancellor', rajput: 'Mantri', hindustani: 'Mantri', bengali: 'Mantri', kashmiri: 'Mantri', nubian: 'Eparch' };
export const vizierTitle = (culture) => VIZIER[culture] ?? 'Vizier';

// What each temperament means, in a word and a line: the card shows it, and the AI plays to it.
export const TEMPER_TEXT = {
  conqueror: ['Conqueror', 'lives for war and glory'], builder: ['Builder', 'raises canals, markets and caravanserais'], miser: ['Miser', 'hoards gold and keeps small armies'],
  negligent: ['Negligent', 'leaves famine, revolt and the frontier to others'], paranoid: ['Paranoid', 'sees plots everywhere and purges the court'], hedonist: ['Pleasure-lover', 'spends the treasury on feasts and palaces'],
  reformer: ['Reformer', 'changes laws, taxes and the army'], diplomat: ['Diplomat', 'prefers marriages and treaties to war'], just: ['Just', 'loved for fair judgement'], tyrant: ['Tyrant', 'rules by fear and heavy taxes'],
  loyal: ['Loyal', 'would die for the crown'], steady: ['Steady', 'does his duty'], glory: ['Glory-hunter', 'storms walls and attacks against the odds'], cautious: ['Cautious', 'breaks off a losing fight'],
  treacherous: ['Treacherous', 'may turn his coat in battle'], butcher: ['Butcher', 'ravages what he takes'], mercenary: ['Mercenary', 'follows the gold, and leaves when it stops'],
  devoted: ['Devoted', 'stands by the crown'], schemer: ['Schemer', 'plots to crown her own son'], regent: ['Born regent', 'rules well when the crown passes to a child'],
  able: ['Able', 'fills the treasury'], corrupt: ['Corrupt', 'skims the revenues'], kingmaker: ['Kingmaker', 'would rule through a puppet, or take the throne'],
};
// A weighted draw from a table of temperaments ({ name: { w } }).
export function pickTemper(rng, table) {
  const all = Object.entries(table), total = all.reduce((t, [, v]) => t + v.w, 0);
  let x = rng() * total;
  for (const [k, v] of all) if ((x -= v.w) < 0) return k;
  return all[0][0];
}
// Old traits suggest a temperament for the historic rulers who were given none.
export function temperFromTraits(traits = [], rng) {
  const t = new Set(traits);
  if (t.has('relentless') || (t.has('ambitious') && (t.has('bold') || t.has('proud')))) return 'conqueror';
  if (t.has('cruel')) return 'tyrant';
  if (t.has('builder') || t.has('learned')) return 'builder';
  if (t.has('carefree') || t.has('idle')) return 'hedonist';
  if (t.has('timid')) return 'negligent';
  if (t.has('greedy')) return 'miser';
  if (t.has('secretive') || t.has('scheming')) return 'paranoid';
  if (t.has('wise') || t.has('beloved') || t.has('just')) return 'just';
  if (t.has('shrewd') || t.has('cautious')) return 'diplomat';
  if (t.has('bold') || t.has('ambitious') || t.has('restless')) return 'conqueror';
  return rng && rng() < 0.5 ? 'builder' : 'diplomat';
}
