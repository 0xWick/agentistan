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
  // the ancient world (200 BC)
  roman: ['Publius Sulpicius', 'Gaius Aurelius', 'Lucius Cornelius', 'Marcus Claudius', 'Quintus Fabius', 'Titus Quinctius', 'Gnaeus Domitius', 'Aulus Postumius', 'Servius Sulpicius', 'Tiberius Sempronius', 'Manius Acilius', 'Lucius Aemilius', 'Marcus Fulvius', 'Gaius Laelius'],
  punic: ['Hasdrubal', 'Hamilcar', 'Mago', 'Hanno', 'Bomilcar', 'Himilco', 'Gisco', 'Adherbal', 'Bostar', 'Carthalo', 'Maharbal'],
  hellenic: ['Antigonus', 'Demetrius', 'Seleucus', 'Ptolemy', 'Lysimachus', 'Philocles', 'Heraclides', 'Aratus', 'Cleomenes', 'Machanidas', 'Eumenes', 'Attalus', 'Nicanor', 'Zeuxis', 'Theodotus', 'Agathocles'],
  gaulish: ['Brennus', 'Ambiorix', 'Litaviccus', 'Orgetorix', 'Celtillus', 'Dumnorix', 'Bituitus', 'Viridomarus', 'Ducarius', 'Comontorius', 'Cavarus', 'Boduognatus'],
  celtiberian: ['Indibilis', 'Mandonius', 'Viriathus', 'Istolatius', 'Allucius', 'Thurrus', 'Caro', 'Olonicus', 'Retogenes', 'Ambon'],
  germanic: ['Boiorix', 'Teutobod', 'Segimer', 'Lugius', 'Gaesorix', 'Claodicus', 'Caesorix', 'Hrodulf'],
  thracian: ['Seuthes', 'Cotys', 'Teres', 'Sitalces', 'Rhescuporis', 'Amadocus', 'Abrupolis', 'Diegylis', 'Oroles', 'Rubobostes', 'Dromichaetes'],
  illyrian: ['Genthius', 'Scerdilaidas', 'Agron', 'Bato', 'Longarus', 'Monunius', 'Plator', 'Caravantius'],
  scythian: ['Skilurus', 'Palacus', 'Ateas', 'Saitapharnes', 'Gatalus', 'Spartocus', 'Paerisades', 'Leucon', 'Argotas', 'Medosaccus'],
  iranian: ['Artabazanes', 'Bagadates', 'Vahbarz', 'Ariobarzanes', 'Mithridates', 'Tiridates', 'Phraates', 'Artabanus', 'Vologases', 'Autophradates', 'Darius', 'Ardakhshir'],
  mauryan: ['Shatadhanvan', 'Brihadratha', 'Agnimitra', 'Vasumitra', 'Samprati', 'Dasharatha', 'Shalishuka', 'Bhagabhadra', 'Vasujyeshtha', 'Devabhuti'],
  andhra: ['Simuka', 'Kanha', 'Satakarni', 'Vedisri', 'Lambodara', 'Apilaka', 'Kuntala', 'Hala'],
  sangam: ['Karikala', 'Nedunjeliyan', 'Senguttuvan', 'Imayavaramban', 'Ilanchetchenni', 'Killivalavan', 'Mudukudumi', 'Athan'],
  lankan: ['Dutugamunu', 'Kavan Tissa', 'Saddha Tissa', 'Uttiya', 'Mahasiva', 'Suratissa', 'Sena', 'Guttika'],
  han: ['Zhou Bo', 'Fan Kuai', 'Cao Can', 'Chen Ping', 'Guan Ying', 'Xiahou Ying', 'Peng Yue', 'Ying Bu', 'Lü Chan', 'Lü Lu', 'Wang Ling', 'Shusun Tong', 'Lu Jia', 'Zhang Liang'],
  xiongnu: ['Jiyu', 'Junchen', 'Yizhixie', 'Huyan', 'Xulübu', 'Rizhu', 'Luli', 'Wuwei', 'Huhanxie', 'Zhizhi'],
  sabaean: ["Karib'il Watar", "Yada'il Dharih", "Sumhu'ali", "Yitha'amar", "Dhamar'ali", "Ilsharah", "Nasha'karib"],
  nabataean: ['Aretas', 'Obodas', 'Malichus', 'Rabbel', 'Syllaeus', 'Zaidu', 'Taimu'],
  kushite: ['Arkamani', 'Adikhalamani', 'Tabirqo', 'Tanyidamani', 'Naqyrinsan', 'Arnekhamani', 'Akinidad'],
  numidian: ['Micipsa', 'Mastanabal', 'Gulussa', 'Gauda', 'Hiempsal', 'Adherbal', 'Bocchus', 'Gaia', 'Oezalces', 'Capussa'],
  egyptian: ['Ankhwennefer', 'Hugronaphor', 'Harsiese', 'Petosiris', 'Nectanebo', 'Pa-di-Iset', 'Horemheb', 'Djedhor'],
  orontid: ['Orontes', 'Artaxias', 'Zariadres', 'Xerxes', 'Tigranes', 'Artavasdes', 'Arsames', 'Abdissares'],
  kartvel: ['Saurmag', 'Pharnavaz', 'Mirian', 'Farnajom', 'Arshak', 'Artag', 'Bartom', 'Kuji'],
  briton: ['Cassivellaunus', 'Tasciovanus', 'Commius', 'Dubnovellaunus', 'Addedomarus', 'Bodvoc', 'Cunobelin', 'Esup'],
  gojoseon: ['Wiman', 'Ugeo', 'Seong-gi', 'Jang-hang', 'Hwan', 'Ilchun', 'No-in'],
  aulac: ['Cao Lỗ', 'Trọng Thủy', 'Thục Phán', 'Lý Ông Trọng', 'Nồi Hầu', 'Đinh Tiên'],
  yue: ['Zou Yao', 'Zou Ying', 'Lü Jia', 'Zhao Mo', 'Zhao Yingqi', 'Zou Chou', 'Zhao Guang'],
  pyu: ['Duttabaung', 'Sri Prabhu', 'Vikrama', 'Harivikrama', 'Suryavikrama'],
  saka: ['Skunkha', 'Saurmag', 'Spalirises', 'Azes', 'Maues', 'Vonones', 'Arsakes', 'Amyrgius'],
  // the age of the world wars (1914)
  british: ['Arthur Hensley', 'Edward Marsh', 'George Whitcombe', 'Henry Ashdown', 'William Carrow', 'Thomas Pemberton', 'Charles Wexley', 'Frederick Hale', 'Albert Rowntree', 'Walter Kingsley', 'Harold Fenwick', 'Ernest Blakemore', 'Robert Dunmore', 'James Thornbury', 'Percy Aldridge', 'Hugh Calloway', 'Sean Doherty', 'Patrick Moran', 'Angus MacLeod', 'Owen Pritchard'],
  french_m: ['Henri Duval', 'Marcel Lefèvre', 'Louis Garnier', 'Paul Rivière', 'Georges Morel', 'Émile Fontaine', 'Jules Mercier', 'André Lambert', 'René Collin', 'Lucien Marchand', 'Pierre Delorme', 'Gaston Roux', 'Maurice Bertin', 'Charles Valette', 'Édouard Picard', 'Jean Lacoste', 'Raoul Vidal', 'Albert Masson'],
  german_m: ['Friedrich Albers', 'Otto Hartmann', 'Heinrich Vogel', 'Wilhelm Kessler', 'Ernst Lindner', 'Hermann Bauer', 'Walter Krüger', 'Gustav Ebner', 'Ludwig Scholz', 'Franz Weber', 'Johann Richter', 'Paul Winkler', 'Max Engel', 'Hans Keller', 'Georg Wolff', 'Rudolf Hahn', 'Kurt Lehmann', 'Emil Schuster'],
  russian_m: ['Ivan Volkov', 'Pyotr Sokolov', 'Nikolai Orlov', 'Sergei Morozov', 'Mikhail Lebedev', 'Andrei Kuznetsov', 'Dmitri Belov', 'Grigori Zaitsev', 'Vasily Petrov', 'Alexei Fyodorov', 'Fyodor Gusev', 'Boris Yermolov', 'Yakov Semyonov', 'Pavel Golubev', 'Stepan Antonov', 'Leonid Markov', 'Viktor Zhukovsky', 'Semyon Tarasov'],
  italian_m: ['Giuseppe Ferrero', 'Carlo Bianchi', 'Luigi Moretti', 'Enrico Galli', 'Antonio Russo', 'Vittorio Conti', 'Mario Esposito', 'Giovanni Marchetti', 'Alberto Fontana', 'Francesco Lombardi', 'Paolo Ricci', 'Umberto Costa', 'Ettore Bruno', 'Aldo Greco', 'Silvio Caruso', 'Renato Villa'],
  iberian_m: ['José Navarro', 'Manuel Ortega', 'Francisco Ibáñez', 'Antonio Salcedo', 'Juan Moreno', 'Luis Carrasco', 'Rafael Herrera', 'Fernando Ruiz', 'Joaquim Pereira', 'António Ferreira', 'Carlos Medina', 'Pedro Alvarado', 'Emilio Vargas', 'Ramón Castillo', 'Tomás Gil', 'Augusto Soares'],
  turkish_m: ['Ahmet Bey', 'Mehmet Rıza', 'Hasan Tahsin', 'Ali Rıfat', 'Mustafa Necati', 'İsmail Hakkı', 'Hüseyin Avni', 'Osman Nuri', 'Yusuf Ziya', 'Kemal Bey', 'Selim Sırrı', 'Ömer Lütfi', 'Rauf Bey', 'Salih Zeki', 'Şevket Bey', 'Ferid Bey'],
  arab_m: ['Ahmad al-Masri', 'Mahmud Shukri', 'Abd al-Rahman Bakr', 'Yusuf al-Hakim', 'Salim Haddad', 'Ibrahim Nasir', 'Khalil Mansur', 'Rashid Kamal', 'Hamid al-Tahir', 'Umar Farid', 'Said Najib', 'Mustafa Zaki', 'Ali Fawzi', 'Faris Khuri', 'Nasir Jabir', 'Abd al-Qadir Salih'],
  persian_m: ['Hossein Tabatabai', 'Mohammad Sadegh', 'Ali Akbar Davar', 'Reza Qoli', 'Hasan Moshir', 'Abbas Farmanfarma', 'Jafar Qoli', 'Mahmud Afshar', 'Karim Nazari', 'Esmail Bakhtiar', 'Mehdi Sharif', 'Nasrollah Javadi', 'Kazem Rashti', 'Asadollah Zand'],
  indian_m: ['Ram Prasad', 'Hari Narayan', 'Gopal Rao', 'Krishna Iyer', 'Abdul Karim', 'Mohan Lal', 'Shyam Sundar', 'Jagat Singh', 'Ganesh Pandit', 'Rahim Bakhsh', 'Prakash Chandra', 'Bhim Rao', 'Lakshman Das', 'Surendra Nath', 'Kishan Chand', 'Mahesh Varma', 'Amar Nath', 'Iqbal Hussain', 'Ravi Mehta', 'Narayan Pillai'],
  chinese_m: ['Wang Zhenbang', 'Li Shouxin', 'Zhang Guoliang', 'Chen Mingyuan', 'Liu Zhenhua', 'Zhao Dengyu', 'Huang Weiqing', 'Zhou Yinren', 'Lin Huaimin', 'Gao Shuxun', 'Tang Shengyuan', 'Wu Zhaolin', 'Sun Deming', 'Xu Bangjie', 'Hu Jingyi', 'Ma Zhanshan'],
  japanese_m: ['Tanaka Hiroshi', 'Suzuki Kentarō', 'Yamada Tarō', 'Satō Masao', 'Watanabe Jōtarō', 'Itō Shinsuke', 'Nakamura Kōji', 'Kobayashi Seizō', 'Yoshida Isamu', 'Matsumoto Kenji', 'Kimura Shigeru', 'Hayashi Ichirō', 'Shimizu Tetsuo', 'Ogawa Gorō'],
  korean_m: ['Kim Seong-su', 'Lee Dong-nyeong', 'Park Eun-sik', 'Choi Nam-seon', 'Jeong Jae-yong', 'Kang Woo-kyu', 'Han Yong-un', 'Yun Chi-ho', 'Seo Jae-pil', 'Oh Se-chang'],
  southslav_m: ['Milan Petrović', 'Stevan Jovanović', 'Dragomir Nikolić', 'Petar Marković', 'Ivan Horvat', 'Ante Kovačević', 'Josip Babić', 'Stojan Popov', 'Georgi Ivanov', 'Dimitar Petkov', 'Todor Stoyanov', 'Vladimir Pavlović', 'Nikola Đorđević', 'Boris Hristov'],
  greek_m: ['Georgios Papadopoulos', 'Konstantinos Nikolaou', 'Dimitrios Vlachos', 'Ioannis Karras', 'Nikolaos Zervas', 'Andreas Michalakis', 'Spyridon Lambrou', 'Petros Mavros', 'Stefanos Kalogeropoulos', 'Christos Delis'],
  romanian_m: ['Ion Popescu', 'Gheorghe Ionescu', 'Constantin Dumitrescu', 'Nicolae Stan', 'Vasile Radu', 'Mihai Georgescu', 'Alexandru Moldovan', 'Petre Constantinescu', 'Dumitru Marin', 'Florin Avram'],
  magyar_m: ['László Nagy', 'István Kovács', 'János Szabó', 'Ferenc Tóth', 'Gyula Horváth', 'Sándor Varga', 'Lajos Kiss', 'Imre Molnár', 'Béla Farkas', 'Zoltán Balogh', 'Károly Papp'],
  nordic_m: ['Lars Johansson', 'Erik Andersson', 'Nils Karlsson', 'Olav Hansen', 'Knut Larsen', 'Hans Nielsen', 'Jens Pedersen', 'Gustav Lindqvist', 'Anders Holm', 'Sven Berg', 'Axel Eriksen', 'Rolf Dahl'],
  african_m: ['Kwame Asante', 'Kofi Mensah', 'Oba Adeyemi', 'Samuel Okafor', 'Chinedu Eze', 'Mamadou Diallo', 'Amadou Traoré', 'Ousmane Keita', 'Kipchoge Arap', 'Njoroge Kamau', 'Tendai Moyo', 'Sipho Dlamini', 'Juma Mwinyi', 'Hailu Tekle', 'Tesfaye Bekele', 'Abebe Desta'],
  sea_m: ['Nguyễn Văn Thành', 'Trần Văn Lộc', 'Phạm Văn Hưng', 'Lê Quang Vinh', 'Maung Tin', 'Ba Pe', 'Thein Maung', 'Somchai Suksai', 'Prasert Wongsa', 'Raden Sutomo', 'Abdullah Hashim', 'Tan Keng Seng', 'Lim Chong Eu', 'Sisowath Chamroeun'],
  dutch_m: ['Jan de Vries', 'Pieter Jansen', 'Willem Bakker', 'Hendrik Visser', 'Cornelis Smit', 'Johannes Mulder', 'Gerrit de Boer', 'Koos van der Merwe', 'Hendrik Pretorius', 'Jacobus Botha', 'Andries du Toit', 'Daniel Malherbe'],
  slav_m: ['Jan Kowalski', 'Stanisław Nowak', 'Wojciech Zieliński', 'Karel Novák', 'Josef Dvořák', 'Václav Černý', 'Mykola Shevchenko', 'Petro Bondarenko', 'Ivan Kovalenko', 'Taras Melnyk', 'Andrzej Wiśniewski', 'Jozef Kováč'],
  baltic_m: ['Jaan Tamm', 'Karl Saar', 'Jānis Bērziņš', 'Pēteris Kalniņš', 'Jonas Petraitis', 'Antanas Kazlauskas', 'Matti Virtanen', 'Juho Korhonen', 'Eino Mäkinen', 'Väinö Nieminen'],
  caucasian_m: ['Giorgi Beridze', 'Davit Kapanadze', 'Levan Gelashvili', 'Aram Petrosyan', 'Vardan Hakobyan', 'Tigran Sargsyan', 'Ali Mammadov', 'Huseyn Aliyev', 'Rashid Gasimov', 'Shamil Aslanov'],
  turkestan_m: ['Abdullah Karimov', 'Rustam Yusupov', 'Nurmukhamed Bekov', 'Sultanbek Ismailov', 'Tursun Akhmedov', 'Mirza Rahimov', 'Kadyr Saidov', 'Bakhtiyar Umarov', 'Ernazar Kuljanov', 'Islam Toraev'],
  mongol_m: ['Batbayar', 'Ganbold', 'Dorj', 'Damdin', 'Sükhbat', 'Tömör', 'Baatar', 'Dashdorj', 'Lkhagva', 'Purev'],
  tibetan_m: ['Tenzin Dorje', 'Sonam Wangdu', 'Tashi Tsering', 'Kalsang Dhondup', 'Pemba Gyaltsen', 'Dawa Norbu', 'Jigme Namgyal', 'Phuntsok Wangyal'],
  albanian_m: ['Gjergj Kastrati', 'Ahmet Dibra', 'Hysen Shkodra', 'Ndue Gjomarkaj', 'Rexhep Mitrovica', 'Sali Butka', 'Isuf Vrioni', 'Qazim Koculi'],
  afghan_m: ['Ghulam Haidar', 'Abdul Rahim', 'Mohammad Wali', 'Sardar Ayub', 'Gul Mohammad', 'Abdul Quddus', 'Shah Mahmud', 'Faiz Mohammad', 'Mir Hashim', 'Sher Khan'],
};

const TITLE = { dutch_m: 'Prime Minister', slav_m: 'President', baltic_m: 'President', caucasian_m: 'President', turkestan_m: 'Emir', mongol_m: 'Khan', tibetan_m: 'Ruler', albanian_m: 'Prince',
  british: 'Prime Minister', french_m: 'President', german_m: 'Chancellor', russian_m: 'Premier', italian_m: 'Premier', iberian_m: 'President', turkish_m: 'Pasha', arab_m: 'Emir', persian_m: 'Shah', indian_m: 'Maharaja', chinese_m: 'President', japanese_m: 'Premier', korean_m: 'President', southslav_m: 'King', greek_m: 'King', romanian_m: 'King', magyar_m: 'Regent', nordic_m: 'King', african_m: 'King', sea_m: 'King', afghan_m: 'Emir',
  roman: 'Consul', punic: 'Suffete', hellenic: 'King', gaulish: 'Chieftain', celtiberian: 'Chieftain', germanic: 'Chieftain', thracian: 'King', illyrian: 'King', scythian: 'King', iranian: 'King', mauryan: 'Raja', andhra: 'King', sangam: 'King', lankan: 'King', han: 'King', xiongnu: 'Chanyu', sabaean: 'King', nabataean: 'King', kushite: 'Qore', numidian: 'King', egyptian: 'Pharaoh', orontid: 'King', kartvel: 'King', briton: 'Chieftain', gojoseon: 'King', aulac: 'King', yue: 'King', pyu: 'King', saka: 'King',
  frankish: 'Count', english: 'Earl', celtic: 'King', iberian: 'King', german: 'Duke', westslav: 'Duke', norse: 'Jarl', baltic: 'Duke', rus: 'Prince', alan: 'King', deccani: 'Raja', tamil: 'King', sinhala: 'King', burmese: 'King', khmer: 'King', viet: 'King', malay: 'Maharaja', korean: 'Lord', japanese: 'Lord', tibetan: 'Prince', mande: 'King', sudanic: 'Mai', forest: 'Oba', ethiopian: 'King', swahili: 'Sultan', shona: 'King',
  persian: 'Malik', turk: 'Khan', steppe: 'Khan', mongol: 'Khan', arab: 'Amir', kurd: 'Amir', georgian: 'King', afghan: 'Sultan', punjabi: 'Rai', sindhi: 'Jam', kashmiri: 'King', rajput: 'Raja', hindustani: 'Raja', bengali: 'King',
  greek: 'Despot', latin: 'Count', armenian: 'Prince', berber: 'Amir', nubian: 'King', slavic: 'Prince', magyar: 'King', chinese: 'King' };
const KINGDOM = { dutch_m: 'Republic of', slav_m: 'Republic of', baltic_m: 'Republic of', caucasian_m: 'Republic of', turkestan_m: 'Emirate of', mongol_m: 'Khanate of', albanian_m: 'Principality of',
  british: 'Republic of', french_m: 'Republic of', german_m: 'Republic of', russian_m: 'Republic of', italian_m: 'Republic of', iberian_m: 'Republic of', turkish_m: 'Republic of', chinese_m: 'Republic of', korean_m: 'Republic of', magyar_m: 'Republic of', indian_m: 'Republic of', persian_m: 'State of', arab_m: 'Kingdom of', african_m: 'Republic of', sea_m: 'Republic of',
  roman: 'Republic of', punic: 'Republic of', gaulish: 'Tribe of', celtiberian: 'Tribe of', germanic: 'Tribe of', briton: 'Tribe of', xiongnu: 'Horde of', saka: 'Horde of',
  frankish: 'County of', english: 'Earldom of', german: 'Duchy of', westslav: 'Duchy of', norse: 'Jarldom of', baltic: 'Duchy of', rus: 'Principality of', swahili: 'Sultanate of', malay: 'Kingdom of',
  persian: 'Kingdom of', turk: 'Khanate of', steppe: 'Horde of', mongol: 'Khanate of', arab: 'Emirate of', kurd: 'Emirate of', georgian: 'Kingdom of', afghan: 'Sultanate of', punjabi: 'Kingdom of', sindhi: 'Kingdom of', kashmiri: 'Kingdom of', rajput: 'Kingdom of', hindustani: 'Kingdom of', bengali: 'Kingdom of',
  greek: 'Despotate of', latin: 'County of', armenian: 'Principality of', berber: 'Emirate of', nubian: 'Kingdom of', slavic: 'Principality of', magyar: 'Kingdom of', chinese: 'Kingdom of' };

export function cultureOf(provinceId, s) {
  if (s?.cultures?.[provinceId]) return s.cultures[provinceId];
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
  roman: ['Cornelia', 'Aemilia', 'Claudia', 'Sempronia', 'Livia', 'Fabia', 'Julia', 'Tertia'],
  punic: ['Sophonisba', 'Elissa', 'Imilce', 'Batbaal', 'Arishat'],
  hellenic: ['Laodice', 'Apama', 'Stratonice', 'Apollonis', 'Phila', 'Arsinoe', 'Berenice', 'Cleopatra', 'Polycratia'],
  gaulish: ['Onomaris', 'Chiomara', 'Camma', 'Epona', 'Rosmerta'],
  celtiberian: ['Ilutia', 'Sacaroa', 'Ataecina', 'Ilduna'],
  germanic: ['Thusnelda', 'Veleda', 'Ganna', 'Gisla'],
  thracian: ['Bendis', 'Meda', 'Polemokratia', 'Kotyto'],
  illyrian: ['Teuta', 'Triteuta', 'Etuta', 'Bardyllis'],
  scythian: ['Amage', 'Tomyris', 'Zarinaea', 'Kamasarye', 'Opoia'],
  iranian: ['Rhodogune', 'Apama', 'Parysatis', 'Atossa', 'Musa', 'Rodogune'],
  mauryan: ['Kaurvaki', 'Asandhimitra', 'Tishyarakshita', 'Padmavati', 'Devi'],
  andhra: ['Naganika', 'Balasri', 'Gautami', 'Vasishthi'],
  sangam: ['Avvaiyar', 'Nachchellai', 'Kannagi', 'Madhavi'],
  lankan: ['Viharamahadevi', 'Anula', 'Somadevi', 'Sanghamitta'],
  han: ['Lü Zhi', 'Bo Ji', 'Qi Ji', 'Dou Yifang', 'Zhang Yan', 'Wang Zhi'],
  xiongnu: ['Yanzhi', 'Huanuo', 'Zhuanqu', 'Wang Zhaojun'],
  sabaean: ['Bilqis', "Yada'at", 'Shamsiya', 'Haram'],
  nabataean: ['Huldu', 'Shaqilath', 'Gamilath', 'Hagiru'],
  kushite: ['Shanakdakhete', 'Amanirenas', 'Amanishakheto', 'Nawidemak'],
  numidian: ['Sophonisba', 'Tanit', 'Thanit', 'Aggar'],
  egyptian: ['Nefertari', 'Taimhotep', 'Tasheret', 'Nitocris'],
  orontid: ['Satenik', 'Zabel', 'Anahit', 'Tsovinar'],
  kartvel: ['Tinatin', 'Nana', 'Abeshura', 'Sidonia'],
  briton: ['Cartimandua', 'Boudica', 'Sena', 'Verica'],
  gojoseon: ['Yuhwa', 'Soseono', 'Ye-ssi'],
  aulac: ['Mỵ Châu', 'Trưng Nhị', 'Bà Triệu'],
  yue: ['Jiu-shi', 'Zou Lan', 'Zhao Yan'],
  pyu: ['Panhtwa', 'Beikthano', 'Thiri'],
  saka: ['Tomyris', 'Zarina', 'Sparethra'],
  british: ['Mary', 'Elizabeth', 'Margaret', 'Victoria', 'Alexandra', 'Edith', 'Emmeline'],
  french_m: ['Marie', 'Jeanne', 'Henriette', 'Louise', 'Madeleine', 'Germaine'],
  german_m: ['Augusta Victoria', 'Cecilie', 'Viktoria Luise', 'Sophie', 'Hermine', 'Rosa', 'Clara'],
  russian_m: ['Alexandra', 'Olga', 'Tatiana', 'Maria', 'Anastasia', 'Xenia', 'Alexandra Kollontai'],
  italian_m: ['Elena', 'Margherita', 'Yolanda', 'Mafalda', 'Giovanna', 'Anna Kuliscioff'],
  iberian_m: ['Victoria Eugenie', 'Isabel', 'Carmen', 'Pilar', 'Amélia'],
  turkish_m: ['Halide Edib', 'Naciye', 'Emine', 'Fatma', 'Latife'],
  arab_m: ['Hoda Shaarawi', 'Fatima', 'Musbah', 'Nafisa', 'Huzaima'],
  persian_m: ['Malek Jahan', 'Taj ol-Saltaneh', 'Shams', 'Ashraf', 'Mehrangiz'],
  indian_m: ['Sarojini Naidu', 'Annie Besant', 'Kasturba', 'Kamala', 'Begum Hazrat'],
  chinese_m: ['Soong Ching-ling', 'Soong Mei-ling', 'Qiu Jin', 'He Xiangning', 'Wan Rong'],
  japanese_m: ['Teimei', 'Sadako', 'Hiraoka Raichō', 'Kaneko', 'Yosano Akiko'],
  korean_m: ['Yu Gwan-sun', 'Ha Ran-sa', 'Na Hye-sok'],
  southslav_m: ['Draga', 'Milica', 'Zorka', 'Eleonore'],
  greek_m: ['Sophia', 'Olga', 'Aspasia', 'Helen'],
  romanian_m: ['Marie', 'Elisabeth', 'Ecaterina', 'Elena'],
  magyar_m: ['Zita', 'Ilona', 'Katalin', 'Erzsébet'],
  nordic_m: ['Maud', 'Victoria', 'Alexandrine', 'Ingrid'],
  african_m: ['Yaa Asantewaa', 'Nehanda', 'Taytu', 'Zewditu', 'Menen'],
  sea_m: ['Indrasakdi', 'Nam Phương', 'Kartini', 'Khin Kyi'],
  dutch_m: ['Wilhelmina', 'Juliana', 'Emma', 'Aletta', 'Isie', 'Sibella'],
  slav_m: ['Alice Masaryková', 'Hana Benešová', 'Maria Skłodowska', 'Aleksandra Piłsudska', 'Lesya Ukrainka', 'Olena Teliha'],
  baltic_m: ['Aino', 'Lydia', 'Felicija', 'Elza', 'Minna'],
  caucasian_m: ['Tamar', 'Nino', 'Anahit', 'Sona', 'Khadija'],
  turkestan_m: ['Nodira', 'Tolganai', 'Saodat', 'Gulsara'],
  mongol_m: ['Dondogdulam', 'Yanjmaa', 'Sendmaa', 'Tsetseg'],
  tibetan_m: ['Pema Dolkar', 'Yangchen', 'Rinchen Dolma', 'Tsering'],
  albanian_m: ['Shote Galica', 'Sadije', 'Senije', 'Urani'],
  afghan_m: ['Soraya', 'Ulya', 'Sarwar'],
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

const CONSORT = { hellenic: 'Queen', roman: 'Matron', han: 'Empress', xiongnu: 'Yanzhi', egyptian: 'Queen', kushite: 'Kandake',
  frankish: 'Countess', english: 'Countess', celtic: 'Queen', iberian: 'Queen', german: 'Duchess', westslav: 'Duchess', norse: 'Queen', baltic: 'Duchess', rus: 'Princess', alan: 'Queen', deccani: 'Rani', tamil: 'Queen', sinhala: 'Queen', burmese: 'Queen', khmer: 'Queen', viet: 'Empress', malay: 'Queen', korean: 'Queen', japanese: 'Lady', tibetan: 'Lady', mande: 'Queen', sudanic: 'Magira', forest: 'Queen', ethiopian: 'Queen', swahili: 'Sayyida', shona: 'Queen',
  turk: 'Khatun', steppe: 'Khatun', mongol: 'Khatun', persian: 'Khatun', kurd: 'Khatun', afghan: 'Malika', arab: 'Sayyida', berber: 'Sayyida', punjabi: 'Rani', sindhi: 'Rani',
  rajput: 'Rani', hindustani: 'Rani', bengali: 'Rani', kashmiri: 'Queen', greek: 'Empress', chinese: 'Empress', latin: 'Queen', georgian: 'Queen', armenian: 'Queen', slavic: 'Queen', magyar: 'Queen', nubian: 'Queen' };
export const consortTitle = (culture, female = true) => (female ? CONSORT[culture] ?? 'Queen' : 'Prince consort');
const VIZIER = { british: 'Prime Minister', french_m: 'Prime Minister', german_m: 'Chancellor', russian_m: 'Prime Minister', italian_m: 'Prime Minister', japanese_m: 'Prime Minister', turkish_m: 'Grand Vizier', persian_m: 'Prime Minister', southslav_m: 'Prime Minister', greek_m: 'Prime Minister', magyar_m: 'Prime Minister', chinese_m: 'Premier',
  roman: 'Praetor', hellenic: 'Epistates', han: 'Chancellor', mauryan: 'Mantri', iranian: 'Hazarapat', punic: 'Rab',
  frankish: 'Seneschal', english: 'Justiciar', iberian: 'Chancellor', german: 'Chancellor', westslav: 'Palatine', norse: 'Chancellor', rus: 'Tysyatsky', deccani: 'Mantri', tamil: 'Mantri', japanese: 'Shikken', korean: 'Chief minister', viet: 'Chancellor', khmer: 'Minister', burmese: 'Minister', swahili: 'Vizier',
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
