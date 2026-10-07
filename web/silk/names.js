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
};

const NAMES = {
  persian: ['Mas\'ud', 'Bahram', 'Kayqubad', 'Rustam', 'Shahriyar', 'Ardashir', 'Isfandiyar', 'Mahmud', 'Sa\'d', 'Nusrat al-Din', 'Fakhr al-Din', 'Shams al-Din', 'Izz al-Din', 'Abu Sa\'id', 'Farrukhzad', 'Qubad'],
  turk: ['Arslan', 'Tughril', 'Sanjar', 'Alp Tegin', 'Inanch', 'Qutlugh', 'Toghan', 'Kilij', 'Altuntash', 'Er Buqa', 'Tekish', 'Ilchi', 'Yaghan', 'Boz Arslan', 'Qara Sonqur', 'Uzbek'],
  steppe: ['Köten', 'Bachman', 'Tugor', 'Kunchek', 'Boniak', 'Konchak', 'Tarkhan', 'Itlar', 'Kutlu', 'Ay Aba'],
  mongol: ['Jebe', 'Subutai', 'Jochi', 'Chagatai', 'Ögedei', 'Tolui', 'Muqali', 'Tolun', 'Batu', 'Möngke', 'Hülegü', 'Kitbuqa', 'Baiju', 'Chormaqan'],
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
};

const TITLE = { persian: 'Malik', turk: 'Khan', steppe: 'Khan', mongol: 'Khan', arab: 'Amir', kurd: 'Amir', georgian: 'King', afghan: 'Sultan', punjabi: 'Rai', sindhi: 'Jam', kashmiri: 'King', rajput: 'Raja', hindustani: 'Raja', bengali: 'King' };
const KINGDOM = { persian: 'Kingdom of', turk: 'Khanate of', steppe: 'Horde of', mongol: 'Khanate of', arab: 'Emirate of', kurd: 'Emirate of', georgian: 'Kingdom of', afghan: 'Sultanate of', punjabi: 'Kingdom of', sindhi: 'Kingdom of', kashmiri: 'Kingdom of', rajput: 'Kingdom of', hindustani: 'Kingdom of', bengali: 'Kingdom of' };

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
