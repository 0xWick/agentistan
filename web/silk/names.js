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
CULTURE_OF.steppe.push('cumania', 'crimea', 'yenisei', 'oirat', 'barga', 'wallachia');
// The rest of the Old World, added with the full map of 1200.
CULTURE_OF.arab.push('hejaz', 'yanbu', 'sanaa', 'aden', 'zabid', 'hadramawt', 'oman', 'sohar', 'hasa', 'najd');
CULTURE_OF.berber.push('valencia', 'murcia', 'cordoba', 'seville', 'granada', 'majorca');
CULTURE_OF.turk.push('bulgar');
CULTURE_OF.magyar.push('croatia', 'dalmatia', 'transylvania');
CULTURE_OF.nubian.push('soba', 'nobadia');
Object.assign(CULTURE_OF, {
  frankish: ['paris', 'champagne', 'burgundy', 'flanders', 'normandy', 'anjou', 'brittany', 'aquitaine', 'toulouse', 'provence'],
  english: ['london', 'york', 'ireland'],
  celtic: ['wales', 'scotland', 'connacht'],
  iberian: ['toledo', 'burgos', 'leon', 'galicia', 'portugal', 'lisbon', 'navarre', 'aragon', 'barcelona'],
  german: ['swabia', 'franconia', 'bavaria', 'alsace', 'thuringia', 'brandenburg', 'lorraine', 'tyrol', 'saxony', 'cologne', 'frisia', 'austria', 'styria', 'holstein'],
  westslav: ['bohemia', 'moravia', 'krakow', 'gniezno', 'masovia', 'silesia', 'pomerania'],
  norse: ['zealand', 'jutland', 'scania', 'nidaros', 'bergen', 'viken', 'uppland', 'gotaland', 'finland'],
  baltic: ['prussia', 'lithuania', 'livonia', 'estonia'],
  rus: ['novgorod', 'pskov', 'vladimir', 'rostov', 'murom', 'ryazan', 'smolensk', 'polotsk', 'chernigov', 'kiev', 'pereyaslavl', 'halych', 'volhynia', 'burtas'],
  alan: ['alania', 'zichia'],
  deccani: ['devagiri', 'nasik', 'konkan', 'warangal', 'vengi', 'dwarasamudra', 'kalinga', 'tripuri', 'bastar'],
  tamil: ['kanchi', 'thanjavur', 'madurai', 'kerala'],
  sinhala: ['lanka'],
  burmese: ['pagan', 'pegu', 'arakan'],
  khmer: ['angkor', 'lavo', 'lanna', 'champa'],
  viet: ['thanglong', 'nghean'],
  malay: ['palembang', 'kedah', 'kediri'],
  korean: ['kaesong', 'gyeongju', 'pyongyang'],
  japanese: ['kamakura', 'kyoto', 'dazaifu', 'hiraizumi'],
  tibetan: ['lhasa', 'ngari', 'amdo'],
  mande: ['koumbi', 'sosso', 'kangaba', 'djenne', 'timbuktu', 'gao', 'takrur'],
  sudanic: ['kano', 'njimi', 'fezzan'],
  forest: ['ife', 'benin'],
  ethiopian: ['roha', 'aksum', 'shewa'],
  swahili: ['zeila', 'mogadishu', 'mombasa', 'kilwa', 'sofala'],
  shona: ['mapungubwe', 'zimbabwe'],
});

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
  frankish: ['Louis', 'Hugh', 'Robert', 'Guy', 'Thibaut', 'Geoffrey', 'Simon', 'Amaury', 'Enguerrand', 'Gaucher', 'Philip', 'Mathieu', 'Raoul', 'Bertrand'],
  english: ['Henry', 'Richard', 'Geoffrey', 'William', 'Hubert', 'Ranulf', 'Roger', 'Stephen', 'Walter', 'Gilbert', 'Robert', 'Ralph'],
  celtic: ['Llywelyn', 'Gruffydd', 'Owain', 'Madog', 'Dafydd', 'Alexander', 'Malcolm', 'Domnall', 'Cathal', 'Áed', 'Ruaidrí', 'Toirdelbach'],
  iberian: ['Alfonso', 'Sancho', 'Fernando', 'Pedro', 'Rodrigo', 'Diego', 'García', 'Ramón', 'Jaime', 'Álvaro', 'Nuño', 'Gonzalo', 'Afonso', 'Martim'],
  german: ['Frederick', 'Conrad', 'Otto', 'Ludwig', 'Albert', 'Hermann', 'Leopold', 'Rudolf', 'Berthold', 'Dietrich', 'Heinrich', 'Gerhard', 'Engelbert', 'Bernhard'],
  westslav: ['Bolesław', 'Mieszko', 'Władysław', 'Kazimierz', 'Leszek', 'Konrad', 'Henryk', 'Přemysl', 'Vladislav', 'Soběslav', 'Bořivoj', 'Václav', 'Ziemomysł', 'Mestwin'],
  norse: ['Knut', 'Valdemar', 'Haakon', 'Inge', 'Erik', 'Magnus', 'Sigurd', 'Olaf', 'Sverker', 'Birger', 'Harald', 'Skule', 'Ingvar', 'Folke'],
  baltic: ['Mindaugas', 'Dausprungas', 'Živinbudas', 'Stekšys', 'Traidenis', 'Vykintas', 'Lembitu', 'Kaupo', 'Daugerutis', 'Gedvydas'],
  rus: ['Vsevolod', 'Yuri', 'Konstantin', 'Yaroslav', 'Mstislav', 'Rurik', 'Roman', 'Igor', 'Sviatoslav', 'Daniil', 'Vasilko', 'Rostislav', 'Gleb', 'Vladimir'],
  alan: ['Soslan', 'Batraz', 'Khetag', 'Dawit', 'Aslan', 'Uruzmag', 'Kazbek'],
  deccani: ['Singhana', 'Bhillama', 'Rudra', 'Narasimha', 'Ballala', 'Vishnuvardhana', 'Someshvara', 'Anangabhima', 'Prolaraja', 'Mahadeva', 'Ramachandra', 'Jaitugi'],
  tamil: ['Kulottunga', 'Rajaraja', 'Rajendra', 'Sundara', 'Vikrama', 'Kulasekhara', 'Maravarman', 'Jatavarman', 'Ravi Varma', 'Kopperunchinga', 'Virarajendra'],
  sinhala: ['Parakramabahu', 'Vijayabahu', 'Nissanka', 'Gajabahu', 'Vikramabahu', 'Bhuvanekabahu', 'Mahinda'],
  burmese: ['Htilominlo', 'Kyaswa', 'Uzana', 'Narathu', 'Sithu', 'Kyansittha', 'Naratheinkha', 'Sawlu', 'Nadaungmya'],
  khmer: ['Indravarman', 'Suryavarman', 'Yasovarman', 'Dharanindravarman', 'Srindravarman', 'Jaya Indravarman', 'Harivarman', 'Rajendravarman'],
  viet: ['Lý Huệ Tông', 'Trần Thừa', 'Trần Lý', 'Đỗ Kính Tu', 'Tô Hiến Thành', 'Trần Thủ Độ', 'Phạm Bỉnh Di', 'Đoàn Thượng'],
  malay: ['Ken Arok', 'Anusapati', 'Tohjaya', 'Parameswara', 'Sang Sapurba', 'Trailokyaraja', 'Kertanagara', 'Wisnuwardhana'],
  korean: ['Choe Hang', 'Wang Yeong', 'Kim Chwi-ryeo', 'Yi Ui-min', 'Kyeong Dae-seung', 'Jeong Jung-bu', 'Kim Bo-dang', 'Pak Seo', 'Yi Gyu-bo'],
  japanese: ['Minamoto no Sanetomo', 'Taira no Munemori', 'Kajiwara Kagetoki', 'Hatakeyama Shigetada', 'Ōe no Hiromoto', 'Miura Yoshimura', 'Hiki Yoshikazu', 'Adachi Kagemori'],
  tibetan: ['Dorje', 'Lhundrub', 'Sonam', 'Tenzin', 'Gyaltsen', 'Namgyal', 'Drakpa', 'Tsering'],
  mande: ['Dankaran Tuman', 'Fakoli', 'Tiramakan', 'Kangoro', 'Abu Bakr', 'Sumanguru', 'Mamadi', 'Kankou'],
  sudanic: ['Dunama', 'Bello', 'Dabo', 'Kanajeji', 'Yaji', 'Umme', 'Bagauda', 'Gijimasu'],
  forest: ['Ewuare', 'Oranmiyan', 'Obalufon', 'Ehenmihen', 'Ewedo', 'Oguola', 'Edoni', 'Uwakhuahen'],
  ethiopian: ["Na'akueto La'ab", 'Yetbarak', 'Harbay', 'Yemrehana', 'Tantawidim', 'Mairari', 'Dil Na’od'],
  swahili: ['al-Hasan ibn Talut', 'Sulayman', 'Ali ibn al-Hasan', 'Dawud', 'Fakhr al-Din', 'Abu Bakr', 'Talut'],
  shona: ['Mutota', 'Nyatsimba', 'Chikura', 'Mapunga', 'Nemanwa', 'Chingoo'],
};

const TITLE = { frankish: 'Count', english: 'Earl', celtic: 'King', iberian: 'King', german: 'Duke', westslav: 'Duke', norse: 'Jarl', baltic: 'Duke', rus: 'Prince', alan: 'King', deccani: 'Raja', tamil: 'King', sinhala: 'King', burmese: 'King', khmer: 'King', viet: 'King', malay: 'Maharaja', korean: 'Lord', japanese: 'Lord', tibetan: 'Prince', mande: 'King', sudanic: 'Mai', forest: 'Oba', ethiopian: 'King', swahili: 'Sultan', shona: 'King',
  persian: 'Malik', turk: 'Khan', steppe: 'Khan', mongol: 'Khan', arab: 'Amir', kurd: 'Amir', georgian: 'King', afghan: 'Sultan', punjabi: 'Rai', sindhi: 'Jam', kashmiri: 'King', rajput: 'Raja', hindustani: 'Raja', bengali: 'King',
  greek: 'Despot', latin: 'Count', armenian: 'Prince', berber: 'Amir', nubian: 'King', slavic: 'Prince', magyar: 'King', chinese: 'King' };
const KINGDOM = { frankish: 'County of', english: 'Earldom of', german: 'Duchy of', westslav: 'Duchy of', norse: 'Jarldom of', baltic: 'Duchy of', rus: 'Principality of', swahili: 'Sultanate of', malay: 'Kingdom of',
  persian: 'Kingdom of', turk: 'Khanate of', steppe: 'Horde of', mongol: 'Khanate of', arab: 'Emirate of', kurd: 'Emirate of', georgian: 'Kingdom of', afghan: 'Sultanate of', punjabi: 'Kingdom of', sindhi: 'Kingdom of', kashmiri: 'Kingdom of', rajput: 'Kingdom of', hindustani: 'Kingdom of', bengali: 'Kingdom of',
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
  frankish: ['Blanche', 'Alix', 'Isabelle', 'Marguerite', 'Jeanne', 'Agnès', 'Adèle', 'Ermengarde', 'Mahaut'],
  english: ['Matilda', 'Eleanor', 'Isabel', 'Joan', 'Alice', 'Margery', 'Hawise', 'Nicola'],
  celtic: ['Gwenllian', 'Nest', 'Angharad', 'Ada', 'Margaret', 'Gormlaith', 'Derbforgaill', 'Isobel'],
  iberian: ['Urraca', 'Berenguela', 'Sancha', 'Teresa', 'Leonor', 'Mafalda', 'Dulce', 'Constanza', 'Elvira'],
  german: ['Agnes', 'Beatrix', 'Gertrud', 'Kunigunde', 'Mechthild', 'Adelheid', 'Sophia', 'Irmgard', 'Jutta'],
  westslav: ['Agnieszka', 'Rycheza', 'Jadwiga', 'Ludmila', 'Dobrava', 'Viola', 'Salomea', 'Grzymisława'],
  norse: ['Ingrid', 'Kristin', 'Margrete', 'Ragnhild', 'Sigrid', 'Helena', 'Cecilia', 'Dagmar', 'Ingeborg'],
  baltic: ['Morta', 'Gaudvilė', 'Rimgailė', 'Aldona', 'Birutė'],
  rus: ['Verkhuslava', 'Agafia', 'Feodosia', 'Anna', 'Yevfrosinia', 'Maria', 'Olga', 'Rogneda'],
  alan: ['Burdukhan', 'Satana', 'Zarina', 'Agunda'],
  deccani: ['Rudrama', 'Umadevi', 'Padmaladevi', 'Somaladevi', 'Ganapamba', 'Mailama'],
  tamil: ['Kundavai', 'Lokamahadevi', 'Arumolinangai', 'Ammangadevi', 'Madhurantaki'],
  sinhala: ['Lilavati', 'Kalyanavati', 'Sugala', 'Ratnavali', 'Mitta'],
  burmese: ['Weluwaddy', 'Saw Mya Kan', 'Pwa Saw', 'Saw Hla', 'Shin Saw'],
  khmer: ['Jayarajadevi', 'Indradevi', 'Rajendradevi', 'Kambujalakshmi'],
  viet: ['Trần Thị Dung', 'Đàm thị', 'Lý Chiêu Hoàng', 'Thiên Cực'],
  malay: ['Ken Dedes', 'Ken Umang', 'Dyah Wiyat', 'Puteri Hijau'],
  korean: ['Wang-ssi', 'Kim-ssi', 'Yu-ssi', 'Choe-ssi'],
  japanese: ['Hōjō Masako', 'Shizuka', 'Tomoe', 'Wakasa', 'Ōhime'],
  tibetan: ['Dolma', 'Pema', 'Yangchen', 'Dechen'],
  mande: ['Sogolon', 'Sassouma', 'Nana Triban', 'Kolonkan', 'Kankou'],
  sudanic: ['Amina', 'Fatima', 'Zaria', 'Aisha'],
  forest: ['Moremi', 'Idia', 'Iyalode', 'Emotan'],
  ethiopian: ['Masqal Kibra', 'Tsion', 'Eleni', 'Seble'],
  swahili: ['Fatima', 'Mwana', 'Mwanamkuu', 'Zaynab'],
  shona: ['Nehanda', 'Chipo', 'Tsitsi'],
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

const CONSORT = { frankish: 'Countess', english: 'Countess', celtic: 'Queen', iberian: 'Queen', german: 'Duchess', westslav: 'Duchess', norse: 'Queen', baltic: 'Duchess', rus: 'Princess', alan: 'Queen', deccani: 'Rani', tamil: 'Queen', sinhala: 'Queen', burmese: 'Queen', khmer: 'Queen', viet: 'Empress', malay: 'Queen', korean: 'Queen', japanese: 'Lady', tibetan: 'Lady', mande: 'Queen', sudanic: 'Magira', forest: 'Queen', ethiopian: 'Queen', swahili: 'Sayyida', shona: 'Queen',
  turk: 'Khatun', steppe: 'Khatun', mongol: 'Khatun', persian: 'Khatun', kurd: 'Khatun', afghan: 'Malika', arab: 'Sayyida', berber: 'Sayyida', punjabi: 'Rani', sindhi: 'Rani',
  rajput: 'Rani', hindustani: 'Rani', bengali: 'Rani', kashmiri: 'Queen', greek: 'Empress', chinese: 'Empress', latin: 'Queen', georgian: 'Queen', armenian: 'Queen', slavic: 'Queen', magyar: 'Queen', nubian: 'Queen' };
export const consortTitle = (culture, female = true) => (female ? CONSORT[culture] ?? 'Queen' : 'Prince consort');
const VIZIER = { frankish: 'Seneschal', english: 'Justiciar', iberian: 'Chancellor', german: 'Chancellor', westslav: 'Palatine', norse: 'Chancellor', rus: 'Tysyatsky', deccani: 'Mantri', tamil: 'Mantri', japanese: 'Shikken', korean: 'Chief minister', viet: 'Chancellor', khmer: 'Minister', burmese: 'Minister', swahili: 'Vizier',
  greek: 'Logothete', slavic: 'Logothete', latin: 'Chancellor', magyar: 'Chancellor', georgian: 'Chancellor', armenian: 'Chancellor', chinese: 'Chancellor', rajput: 'Mantri', hindustani: 'Mantri', bengali: 'Mantri', kashmiri: 'Mantri', nubian: 'Eparch' };
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
