// The ancient world, 200 BC: Rome has just beaten Hannibal and turns on Philip V of Macedon; Antiochus III takes
// Coele-Syria from a boy Ptolemy; Liu Bang's Han meet Modu Chanyu's Xiongnu at Baideng; the Mauryan empire of Ashoka
// fades; Euthydemus holds Greek Bactria. The same map as 1200, with the owners, cities and peoples of the time.
// Forces of the age: Rome elects new consuls every January; the Xiongnu raid the Han frontier.
import { RULES as R } from '../rules.js';
import { provincesOf, living, newChar, setOwner, round1, chance, pick, ofR, say, cityOf, placeOf, PROV, usedNames, atWar } from '../core.js';
import { personName, pickTemper } from '../names.js';

// province: [owner, city, name, people]  (null owner: free land, anyone's to take)
const P = {
  // the far west
  connacht: [null, 'Cruachan', 'Connacht', 'briton'], ireland: [null, 'Dún Ailinne', 'Laigin', 'briton'], scotland: ['caledonii', 'Caledonian forts', 'Caledonia', 'briton'],
  york: ['brigantes', 'Isurium', 'Brigantia', 'briton'], wales: [null, 'Ordovician hillforts', 'Cambria', 'briton'], london: ['britons', 'Camulodunum', 'Britannia', 'briton'],
  galicia: [null, 'Brigantium', 'Gallaecia', 'celtiberian'], leon: [null, 'Lancia', 'Asturia', 'celtiberian'], portugal: ['lusitani', 'Conimbriga', 'Lusitania', 'celtiberian'],
  lisbon: ['lusitani', 'Olisipo', 'Olisipo', 'celtiberian'], seville: ['rome', 'Gades', 'Baetica', 'punic'], navarre: [null, 'Vasconian villages', 'Vasconia', 'celtiberian'],
  burgos: ['celtiberi', 'Numantia', 'Celtiberia', 'celtiberian'], aragon: ['celtiberi', 'Salduie', 'Ebro valley', 'celtiberian'], toledo: ['celtiberi', 'Toletum', 'Carpetania', 'celtiberian'],
  barcelona: ['rome', 'Tarraco', 'Hispania Citerior', 'celtiberian'], majorca: [null, 'Talaiot villages', 'Baleares', 'celtiberian'], valencia: ['rome', 'Saguntum', 'Edetania', 'celtiberian'],
  murcia: ['rome', 'Carthago Nova', 'Contestania', 'punic'], cordoba: ['rome', 'Corduba', 'Turdetania', 'celtiberian'], granada: ['rome', 'Iliberri', 'Bastetania', 'celtiberian'],
  // Gaul and the Rhine
  flanders: ['belgae', 'Bagacum', 'Belgica', 'gaulish'], normandy: ['armorica', 'Rotomagus', 'Caletia', 'gaulish'], paris: ['senones', 'Lutetia', 'Parisii', 'gaulish'],
  champagne: ['senones', 'Agedincum', 'Senonia', 'gaulish'], brittany: ['armorica', 'Darioritum', 'Armorica', 'gaulish'], anjou: ['armorica', 'Juliomagus', 'Andecavia', 'gaulish'],
  aquitaine: ['arverni', 'Burdigala', 'Aquitania', 'gaulish'], toulouse: ['volcae', 'Tolosa', 'Volcae', 'gaulish'], burgundy: ['aedui', 'Bibracte', 'Aeduia', 'gaulish'],
  lorraine: ['aedui', 'Divodurum', 'Mediomatrica', 'gaulish'], provence: ['massalia', 'Massalia', 'Massalia', 'hellenic'], alsace: ['helvetii', 'Argentorate', 'Upper Rhine', 'gaulish'],
  swabia: ['helvetii', 'Heuneburg', 'Helvetia', 'gaulish'], bavaria: ['helvetii', 'Manching', 'Vindelicia', 'gaulish'], tyrol: [null, 'Raetian valleys', 'Raetia', 'gaulish'],
  franconia: [null, 'Main oppida', 'Main lands', 'gaulish'], cologne: ['belgae', 'Atuatuca', 'Eburonia', 'gaulish'], frisia: [null, 'Frisian mounds', 'Frisia', 'germanic'],
  // the north
  jutland: ['cimbri', 'Himmerland', 'Cimbria', 'germanic'], holstein: ['cimbri', 'Teutonian shore', 'Teutonia', 'germanic'], zealand: [null, 'Zealand villages', 'Zealand', 'germanic'],
  scania: [null, 'Scanian villages', 'Scandia', 'germanic'], nidaros: [null, 'Trondheimsfjord', 'Trøndelag', 'germanic'], bergen: [null, 'Hordaland', 'Western fjords', 'germanic'],
  viken: [null, 'Oslofjord', 'Viken', 'germanic'], uppland: [null, 'Uppsala mounds', 'Svealand', 'germanic'], gotaland: [null, 'Götaland villages', 'Götaland', 'germanic'],
  finland: [null, 'Finnish lakes', 'Finland', 'baltic'], estonia: [null, 'Estonian forts', 'Estonia', 'baltic'], livonia: [null, 'Daugava villages', 'Livonia', 'baltic'],
  prussia: [null, 'Sambian amber coast', 'Sambia', 'baltic'], lithuania: [null, 'Nemunas forts', 'Lithuania', 'baltic'], pomerania: [null, 'Vistula mouth', 'Pomerania', 'germanic'],
  saxony: ['suebi', 'Elbe camps', 'Suebia', 'germanic'], thuringia: ['suebi', 'Hermunduria', 'Thuringia', 'germanic'], brandenburg: ['suebi', 'Semnonia', 'Semnones', 'germanic'],
  gniezno: [null, 'Warta forts', 'Lugia', 'germanic'], silesia: [null, 'Oder oppida', 'Silesia', 'gaulish'], krakow: [null, 'Vistula hills', 'Vistula lands', 'gaulish'],
  masovia: [null, 'Masovian forests', 'Masovia', 'baltic'], bohemia: ['boii', 'Boiohaemum', 'Boiohaemum', 'gaulish'], moravia: ['boii', 'Staré Hradisko', 'Moravia', 'gaulish'],
  halych: ['bastarnae', 'Bastarnian camps', 'Carpathian lands', 'germanic'], volhynia: [null, 'Volhynian forests', 'Volhynia', 'scythian'],
  // the Danube and the Balkans
  austria: ['noricum', 'Danube oppida', 'Noricum', 'gaulish'], styria: ['noricum', 'Noreia', 'Noricum south', 'gaulish'], hungary: [null, 'Pannonian oppida', 'Pannonia', 'gaulish'],
  croatia: [null, 'Segestica', 'Pannonia Savia', 'illyrian'], dalmatia: ['illyria', 'Delminium', 'Dalmatia', 'illyrian'], epirus: ['illyria', 'Scodra', 'Illyria', 'illyrian'],
  ras: ['scordisci', 'Singidunum', 'Scordiscia', 'gaulish'], transylvania: ['dacia', 'Sarmizegetusa', 'Dacia', 'thracian'], wallachia: ['dacia', 'Argedava', 'Getia', 'thracian'],
  sofia: ['odrysae', 'Serdica', 'Serdica', 'thracian'], tarnovo: ['odrysae', 'Seuthopolis', 'Odrysia', 'thracian'], varna: ['odrysae', 'Odessos', 'Odessos', 'thracian'],
  thrace: ['macedon', 'Uskudama', 'Thrace', 'thracian'], constantinople: ['byzantion', 'Byzantion', 'Byzantion', 'hellenic'], thessalonica: ['macedon', 'Pella', 'Macedonia', 'hellenic'],
  hellas: ['athens', 'Athens', 'Attica', 'hellenic'], morea: ['sparta', 'Sparta', 'Laconia', 'hellenic'],
  // Italy
  milan: ['insubres', 'Mediolanum', 'Insubria', 'gaulish'], venice: ['rome', 'Ateste', 'Venetia', 'roman'], genoa: [null, 'Genua', 'Liguria', 'gaulish'],
  romagna: ['rome', 'Ariminum', 'Umbria', 'roman'], tuscany: ['rome', 'Arretium', 'Etruria', 'roman'], rome: ['rome', 'Rome', 'Latium', 'roman'],
  naples: ['rome', 'Neapolis', 'Campania', 'roman'], apulia: ['rome', 'Tarentum', 'Apulia', 'roman'], palermo: ['rome', 'Panormus', 'Sicilia', 'roman'],
  // Africa
  tunis: ['carthage', 'Carthage', 'Africa', 'punic'], tripolitania: ['carthage', 'Leptis', 'Emporia', 'punic'], bejaia: ['numidia', 'Cirta', 'Numidia', 'numidian'],
  tlemcen: ['masaesyli', 'Siga', 'Masaesylia', 'numidian'], fez: ['mauretania', 'Volubilis', 'Mauretania', 'numidian'], marrakesh: ['mauretania', 'Atlas villages', 'Atlas', 'numidian'],
  sijilmasa: [null, 'Gaetulian camps', 'Gaetulia', 'numidian'], fezzan: ['garamantes', 'Garama', 'Garamantia', 'numidian'], barqa: ['ptolemaic', 'Cyrene', 'Cyrenaica', 'hellenic'],
  alexandria: ['ptolemaic', 'Alexandria', 'Lower Egypt', 'hellenic'], cairo: ['ptolemaic', 'Memphis', 'Middle Egypt', 'egyptian'], qus: ['thebaid', 'Thebes', 'Thebaid', 'egyptian'],
  nobadia: ['kush', 'Primis', 'Lower Nubia', 'kushite'], dongola: ['kush', 'Napata', 'Napata', 'kushite'], soba: ['kush', 'Meroe', 'Meroe', 'kushite'],
  aksum: [null, 'Yeha', 'Tigray', 'sabaean'], roha: [null, 'Lasta highlands', 'Lasta', 'kushite'], shewa: [null, 'Shewan highlands', 'Shewa', 'kushite'],
  zeila: [null, 'Malao', 'Barbaria', 'sabaean'], mogadishu: [null, 'Benadir coast', 'Azania north', 'sabaean'], mombasa: [null, 'Azanian coast', 'Azania', 'sabaean'],
  kilwa: [null, 'Rhapta', 'Rhapta', 'sabaean'], sofala: [null, 'Sofala coast', 'Sofala', 'shona'], zimbabwe: [null, 'Plateau villages', 'Zimbabwe plateau', 'shona'], mapungubwe: [null, 'Limpopo villages', 'Limpopo', 'shona'],
  takrur: [null, 'Senegal villages', 'Senegal', 'mande'], koumbi: [null, 'Dhar Tichitt', 'Tichitt', 'mande'], sosso: [null, 'Bambuk hills', 'Bambuk', 'mande'], kangaba: [null, 'Upper Niger villages', 'Manden', 'mande'],
  djenne: [null, 'Jenne-jeno', 'Inland Niger', 'mande'], timbuktu: [null, 'Niger bend camps', 'Niger bend', 'mande'], gao: [null, 'Gao', 'Middle Niger', 'mande'],
  kano: [null, 'Nok', 'Nok', 'sudanic'], njimi: [null, 'Lake Chad shores', 'Lake Chad', 'sudanic'], ife: [null, 'Ife hills', 'Yorubaland', 'forest'], benin: [null, 'Edo forest', 'Edo', 'forest'],
  // Anatolia, the Levant, Arabia
  nicaea: ['bithynia', 'Nicomedia', 'Bithynia', 'hellenic'], kastamonu: ['pontus', 'Gangra', 'Paphlagonia', 'hellenic'], trebizond: ['pontus', 'Trapezus', 'Pontus coast', 'hellenic'],
  sivas: ['pontus', 'Amaseia', 'Pontus', 'iranian'], ankara: ['galatia', 'Ancyra', 'Galatia', 'gaulish'], smyrna: ['pergamon', 'Pergamon', 'Mysia', 'hellenic'],
  konya: ['seleucid', 'Iconium', 'Lycaonia', 'hellenic'], attaleia: ['ptolemaic', 'Perge', 'Pamphylia', 'hellenic'], cyprus: ['ptolemaic', 'Salamis', 'Cyprus', 'hellenic'],
  kayseri: ['cappadocia', 'Mazaca', 'Cappadocia', 'iranian'], malatya: ['cappadocia', 'Melitene', 'Melitene', 'iranian'], cilicia: ['seleucid', 'Tarsus', 'Cilicia', 'hellenic'],
  erzurum: ['armenia', 'Karin', 'Upper Armenia', 'orontid'], ani: ['armenia', 'Armavir', 'Armenia', 'orontid'], amid: ['armenia', 'Carcathiocerta', 'Sophene', 'orontid'], nakhchivan: ['armenia', 'Naxuana', 'Vaspurakan', 'orontid'],
  kartli: ['iberia_k', 'Mtskheta', 'Iberia', 'kartvel'], imereti: ['colchis', 'Kutatisi', 'Colchis', 'kartvel'], arran: ['albania_k', 'Kabalaka', 'Albania', 'orontid'],
  shirvan: ['albania_k', 'Albanian coast', 'Albania east', 'orontid'], derbent: ['albania_k', 'Caspian Gates', 'Derbent', 'orontid'], alania: [null, 'Caucasus villages', 'North Caucasus', 'scythian'],
  edessa: ['seleucid', 'Edessa', 'Osroene', 'hellenic'], mosul: ['seleucid', 'Arbela', 'Adiabene', 'iranian'], aleppo: ['seleucid', 'Beroea', 'Cyrrhestica', 'hellenic'],
  antioch: ['seleucid', 'Antioch', 'Syria', 'hellenic'], homs: ['seleucid', 'Apamea', 'Apamene', 'hellenic'], tripoli: ['seleucid', 'Tripolis', 'Phoenicia', 'hellenic'],
  damascus: ['seleucid', 'Damascus', 'Damascene', 'hellenic'], acre: ['ptolemaic', 'Ptolemais', 'Galilee', 'hellenic'], jerusalem: ['ptolemaic', 'Jerusalem', 'Judea', 'hellenic'],
  karak: ['nabataea', 'Petra', 'Nabataea', 'nabataean'], yanbu: ['lihyan', 'Dedan', 'Lihyan', 'nabataean'], hejaz: [null, 'Hejaz oases', 'Hejaz', 'nabataean'],
  sanaa: ['saba', 'Marib', 'Saba', 'sabaean'], zabid: ['saba', 'Tihama ports', 'Tihama', 'sabaean'], aden: ['qataban', 'Timna', 'Qataban', 'sabaean'],
  hadramawt: ['hadramawt_k', 'Shabwa', 'Hadramawt', 'sabaean'], hasa: ['gerrha', 'Gerrha', 'Gerrha', 'sabaean'], najd: [null, 'al-Yamama', 'Yamama', 'nabataean'],
  oman: [null, 'Omani oases', 'Magan', 'sabaean'], sohar: [null, 'Omana', 'Omana', 'sabaean'],
  // Mesopotamia, Iran, Central Asia
  baghdad: ['seleucid', 'Seleucia', 'Babylonia', 'iranian'], basra: ['seleucid', 'Mesene', 'Mesene', 'iranian'], khuzestan: ['seleucid', 'Susa', 'Susiana', 'iranian'],
  shahrazur: ['seleucid', 'Zagros villages', 'Zagros', 'iranian'], lur: ['seleucid', 'Elymais', 'Elymais', 'iranian'], hamadan: ['seleucid', 'Ecbatana', 'Media', 'iranian'],
  isfahan: ['seleucid', 'Gabae', 'Paraetacene', 'iranian'], yazd: [null, 'Desert villages', 'Great desert', 'iranian'], fars: ['persis', 'Persepolis', 'Persis', 'iranian'],
  darabgerd: ['persis', 'Taoce', 'Persis south', 'iranian'], kerman: ['seleucid', 'Carmana', 'Carmania', 'iranian'], hormuz: ['seleucid', 'Harmozeia', 'Harmozeia', 'iranian'],
  rey: ['seleucid', 'Rhagae', 'Rhagiana', 'iranian'], qazvin: ['seleucid', 'Median villages', 'Media north', 'iranian'], alamut: [null, 'Cadusian hills', 'Cadusia', 'iranian'],
  gilan: [null, 'Gelae', 'Gelae', 'iranian'], tabriz: ['atropatene', 'Gazaka', 'Atropatene', 'iranian'], ardabil: ['atropatene', 'Ardabil plain', 'Atropatene east', 'iranian'], tabaristan: ['parthia', 'Tapuria', 'Tapuria', 'iranian'], gorgan: ['parthia', 'Zadracarta', 'Hyrcania', 'iranian'],
  kumis: ['parthia', 'Hecatompylos', 'Parthia', 'iranian'], nasa: ['parthia', 'Nisa', 'Nisa', 'iranian'], sarakhs: ['parthia', 'Sarakhs', 'Parthia east', 'iranian'],
  nishapur: ['parthia', 'Susia', 'Parthyene', 'iranian'], merv: ['bactria', 'Antiochia Margiana', 'Margiana', 'hellenic'], herat: ['bactria', 'Alexandria Ariana', 'Aria', 'hellenic'],
  quhistan: [null, 'Arian hills', 'Aria south', 'iranian'], sistan: ['sophagasenus', 'Prophthasia', 'Drangiana', 'iranian'], kandahar: ['sophagasenus', 'Alexandria Arachosia', 'Arachosia', 'mauryan'],
  kabul: ['sophagasenus', 'Kapisa', 'Paropamisadae', 'mauryan'], ghazni: ['sophagasenus', 'Arachosian hills', 'Arachosia north', 'mauryan'], bamiyan: ['sophagasenus', 'Bamiyan', 'Bamiyan', 'mauryan'],
  peshawar: ['sophagasenus', 'Pushkalavati', 'Gandhara', 'mauryan'], ghor: [null, 'Arian mountains', 'Ghor', 'iranian'], balkh: ['bactria', 'Bactra', 'Bactria', 'hellenic'],
  termez: ['bactria', 'Tarmita', 'Bactria north', 'hellenic'], khuttal: ['bactria', 'Ai-Khanoum', 'Oxus', 'hellenic'], badakhshan: ['bactria', 'Badakhshan', 'Badakhshan', 'iranian'],
  samarkand: ['bactria', 'Maracanda', 'Sogdiana', 'iranian'], bukhara: ['bactria', 'Bukhara', 'Sogdiana west', 'iranian'], nasaf: ['bactria', 'Nautaca', 'Nautaca', 'iranian'],
  ushrusana: ['bactria', 'Cyropolis', 'Ustrushana', 'iranian'], ferghana: ['dayuan', 'Ershi', 'Dayuan', 'saka'], shash: ['kangju', 'Chach', 'Chach', 'saka'],
  otrar: ['kangju', 'Kangju camps', 'Kangju', 'saka'], talas: ['kangju', 'Talas camps', 'Talas', 'saka'], jand: ['kangju', 'Syr Darya camps', 'Lower Jaxartes', 'saka'],
  gurganj: ['chorasmia', 'Akchakhan', 'Chorasmia', 'iranian'], khiva: ['chorasmia', 'Khiva', 'Chorasmia south', 'iranian'], kipchak: ['massagetae', 'Aral camps', 'Massagetae', 'saka'],
  mangyshlak: ['massagetae', 'Mangyshlak camps', 'Mangyshlak', 'saka'], saqsin: ['sarmatians', 'Volga camps', 'Sarmatia', 'scythian'], burtas: [null, 'Forest villages', 'Burtas', 'baltic'],
  bulgar: [null, 'Kama villages', 'Volga forests', 'baltic'], cumania: ['scythians', 'Dnieper camps', 'Scythia', 'scythian'], pereyaslavl: ['scythians', 'Forest-steppe forts', 'Scythia north', 'scythian'],
  kiev: [null, 'Dnieper forests', 'Dnieper', 'scythian'], chernigov: [null, 'Desna forests', 'Desna', 'baltic'], smolensk: [null, 'Upper Dnieper', 'Upper Dnieper', 'baltic'],
  polotsk: [null, 'Daugava forests', 'Polotsk lands', 'baltic'], novgorod: [null, 'Ilmen villages', 'Ilmen', 'baltic'], pskov: [null, 'Pskov villages', 'Pskov lands', 'baltic'],
  vladimir: [null, 'Volga forests', 'Upper Volga', 'baltic'], rostov: [null, 'Nero lake villages', 'Rostov lands', 'baltic'], murom: [null, 'Oka villages', 'Oka', 'baltic'], ryazan: [null, 'Oka steppe edge', 'Ryazan lands', 'scythian'],
  crimea: ['bosporus', 'Panticapaeum', 'Bosporus', 'scythian'], zichia: ['bosporus', 'Phanagoria', 'Sindica', 'scythian'],
  almaliq: ['sai', 'Ili camps', 'Ili', 'saka'], balasagun: ['sai', 'Issyk camps', 'Issyk-Kul', 'saka'], kashgar: ['yutian', 'Shule', 'Shule', 'saka'], khotan: ['yutian', 'Yutian', 'Yutian', 'saka'],
  qocho: [null, 'Jushi', 'Jushi', 'saka'], hami: ['yuezhi', 'Yiwu', 'Yiwu', 'saka'], shazhou: ['yuezhi', 'Dunhuang', 'Dunhuang', 'saka'], ganzhou: ['yuezhi', 'Qilian pastures', 'Qilian', 'saka'],
  liangzhou: ['yuezhi', 'Guzang', 'Hexi', 'saka'], amdo: [null, 'Qiang highlands', 'Qiang', 'saka'], lhasa: [null, 'Yarlung valley', 'Yarlung', 'saka'], ngari: [null, 'Zhangzhung', 'Zhangzhung', 'saka'],
  // the steppe of Modu Chanyu, and the Han
  xingqing: ['xiongnu', 'Ordos camps', 'Ordos', 'xiongnu'], gobi: ['xiongnu', 'Gobi wells', 'Gobi', 'xiongnu'], tula: ['xiongnu', 'Longcheng', 'Xiongnu heartland', 'xiongnu'],
  kherlen: ['xiongnu', 'Kherlen camps', 'Kherlen', 'xiongnu'], selenga: ['xiongnu', 'Selenga camps', 'Selenga', 'xiongnu'], buir: ['xiongnu', 'Donghu pastures', 'Donghu', 'xiongnu'],
  altai: ['xiongnu', 'Altai camps', 'Altai', 'xiongnu'], yenisei: ['xiongnu', 'Dingling forests', 'Dingling', 'xiongnu'], oirat: [null, 'Gekun forests', 'Gekun', 'xiongnu'], barga: [null, 'Baikal forests', 'Baikal', 'xiongnu'],
  huining: [null, 'Wuhuan camps', 'Wuhuan', 'xiongnu'], liaoyang: ['yan', 'Xiangping', 'Liaodong', 'han'], zhongdu: ['yan', 'Ji', 'Yan', 'han'], datong: ['han', 'Pingcheng', 'Dai', 'han'],
  taiyuan: ['han', 'Jinyang', 'Taiyuan', 'han'], jinan: ['qi', 'Linzi', 'Qi', 'han'], kaifeng: ['han', 'Daliang', 'Henan', 'han'], jingzhao: ['han', "Chang'an", 'Guanzhong', 'han'],
  hanzhong: ['han', 'Nanzheng', 'Hanzhong', 'han'], chengdu: ['han', 'Chengdu', 'Shu', 'han'], xiangyang: ['han', 'Xiangyang', 'Nanyang', 'han'], ezhou: ['han', 'Jiangling', 'Jing', 'han'],
  changsha: ['changsha_k', 'Linxiang', 'Changsha', 'han'], jiankang: ['han', 'Moling', 'Wu', 'han'], linan: ['han', 'Kuaiji', 'Kuaiji', 'yue'], quanzhou: ['minyue', 'Dongye', 'Minyue', 'yue'],
  guangzhou: ['nanyue', 'Panyu', 'Nanyue', 'yue'], dali: ['dian', 'Dian', 'Dian', 'yue'], thanglong: ['aulac', 'Cổ Loa', 'Âu Lạc', 'aulac'], nghean: ['aulac', 'Cửu Chân', 'Cửu Chân', 'aulac'],
  pyongyang: ['gojoseon', 'Wanggeom', 'Gojoseon', 'gojoseon'], kaesong: [null, 'Mahan villages', 'Mahan', 'gojoseon'], gyeongju: [null, 'Jinhan villages', 'Jinhan', 'gojoseon'],
  kyoto: [null, 'Yamato villages', 'Yamato', 'gojoseon'], kamakura: [null, 'Kanto villages', 'Kanto', 'gojoseon'], dazaifu: [null, 'Na', 'Tsukushi', 'gojoseon'], hiraizumi: [null, 'Emishi lands', 'Emishi', 'gojoseon'],
  // South-East Asia
  champa: [null, 'Sa Huỳnh villages', 'Sa Huỳnh', 'aulac'], angkor: [null, 'Mekong villages', 'Lower Mekong', 'pyu'], lavo: [null, 'Chao Phraya villages', 'Chao Phraya', 'pyu'],
  lanna: [null, 'Northern hills', 'Northern hills', 'pyu'], pegu: [null, 'Mon coast', 'Suvarnabhumi', 'pyu'], pagan: ['pyu', 'Beikthano', 'Pyu lands', 'pyu'], arakan: [null, 'Dhanyawadi', 'Arakan', 'pyu'],
  palembang: [null, 'Musi river villages', 'Sumatra', 'pyu'], kedah: [null, 'Kedah coast', 'Malaya', 'pyu'], kediri: [null, 'Brantas villages', 'Java', 'pyu'],
  // India
  kashmir: ['maurya', 'Srinagari', 'Kashmira', 'mauryan'], lahore: ['maurya', 'Sakala', 'Madra', 'mauryan'], multan: ['maurya', 'Multan', 'Malli', 'mauryan'],
  saltrange: ['maurya', 'Taxila', 'Takshashila', 'mauryan'], turan: [null, 'Gedrosian hills', 'Gedrosia north', 'iranian'], makran: [null, 'Gedrosian coast', 'Gedrosia', 'iranian'],
  thar: [null, 'Thar wells', 'Maru', 'mauryan'], marwar: [null, 'Maru villages', 'Marwar', 'mauryan'], sehwan: ['maurya', 'Sindhu', 'Sindhu', 'mauryan'], thatta: ['maurya', 'Patala', 'Patalene', 'mauryan'],
  ajmer: ['maurya', 'Bairat', 'Matsya', 'mauryan'], ranthambore: ['maurya', 'Madhyamika', 'Shibi', 'mauryan'], gujarat: ['maurya', 'Anarta', 'Anarta', 'mauryan'], saurashtra: ['maurya', 'Girinagara', 'Surashtra', 'mauryan'],
  delhi: ['maurya', 'Indraprastha', 'Kuru', 'mauryan'], kannauj: ['maurya', 'Kanyakubja', 'Panchala', 'mauryan'], gwalior: ['maurya', 'Padmavati', 'Chedi north', 'mauryan'],
  varanasi: ['maurya', 'Varanasi', 'Kashi', 'mauryan'], kalinjar: ['maurya', 'Kalanjara', 'Chedi', 'mauryan'], tripuri: ['maurya', 'Tripuri', 'Dahala', 'mauryan'],
  malwa: ['maurya', 'Ujjayini', 'Avanti', 'mauryan'], bihar: ['maurya', 'Pataliputra', 'Magadha', 'mauryan'], bengal: ['maurya', 'Pundranagara', 'Pundra', 'mauryan'],
  devagiri: ['satavahana', 'Pratishthana', 'Assaka', 'andhra'], nasik: ['satavahana', 'Nasika', 'Nasika', 'andhra'], konkan: ['satavahana', 'Shurparaka', 'Aparanta', 'andhra'],
  warangal: ['satavahana', 'Dhanyakataka', 'Andhra', 'andhra'], vengi: ['satavahana', 'Vengi', 'Vengi', 'andhra'], kalinga: ['kalinga', 'Tosali', 'Kalinga', 'mauryan'],
  bastar: [null, 'Dandaka forest', 'Dandakaranya', 'andhra'], dwarasamudra: ['maurya', 'Suvarnagiri', 'Suvarnagiri', 'sangam'], kanchi: ['chola', 'Kanchi', 'Tondai', 'sangam'],
  thanjavur: ['chola', 'Uraiyur', 'Chola country', 'sangam'], madurai: ['pandya', 'Madurai', 'Pandya country', 'sangam'], kerala: ['chera', 'Muziris', 'Chera country', 'sangam'],
  lanka: ['anuradhapura', 'Anuradhapura', 'Rajarata', 'lankan'],
};

const r = (id, name, short, color, capital, ruler, extra = {}) => ({ id, name, short, color, capital, ruler, generals: extra.generals ?? [], heir: extra.heir, fa: extra.fa ?? '', dynasty: extra.dynasty ?? short, lineage: extra.lineage ?? [], plural: extra.plural, nomad: extra.nomad, elective: extra.elective, overlord: extra.overlord, levy: extra.levy });
const k = (name, title, born, since, traits, skill = 3) => ({ name, title, born, since, traits, skill });
const g = (name, skill, traits, at) => ({ name, skill, traits, at });

const REALMS = [
  r('rome', 'Roman Republic', 'Rome', '#a3263b', 'rome', k('Publius Sulpicius Galba', 'Consul', -250, -200, ['bold', 'cruel'], 3), { elective: true, fa: 'Roma', dynasty: 'Senate and People of Rome', generals: [g('Titus Quinctius Flamininus', 4, ['ambitious'], 'apulia'), g('Publius Cornelius Scipio', 5, ['bold'], 'rome'), g('Marcus Porcius Cato', 3, ['steadfast'], 'barcelona')], levy: 1.3 }),
  r('carthage', 'Carthage', 'Carthage', '#7b2d6b', 'tunis', k('the Suffete of Carthage', 'Suffete', -245, -201, ['cautious']), { elective: true, fa: '𐤒𐤓𐤕𐤇𐤃𐤔𐤕', dynasty: 'the Council of Carthage', generals: [g('Hannibal Barca', 5, ['relentless', 'bold'], 'tunis')] }),
  r('numidia', 'Kingdom of Numidia', 'Numidia', '#c47a2c', 'bejaia', k('Masinissa', 'King', -238, -206, ['bold', 'shrewd'], 4), { heir: { name: 'Micipsa', born: -225, traits: ['wise'], relation: 'son' }, dynasty: 'Massyli' }),
  r('masaesyli', 'Masaesyli', 'Masaesyli', '#9a6a2a', 'tlemcen', k('Vermina', 'King', -225, -202, ['proud'])),
  r('mauretania', 'Kingdom of Mauretania', 'Mauretania', '#8a5a3a', 'fez', k('Baga', 'King', -240, -210, ['cautious'])),
  r('garamantes', 'Garamantes', 'Garamantes', '#a65a5a', 'fezzan', k('the Garamantian king', 'King', -240, -215, ['restless']), { plural: true }),
  r('ptolemaic', 'Ptolemaic Kingdom', 'Ptolemies', '#2a6f97', 'alexandria', k('Ptolemy V', 'King', -210, -204, ['timid']), { plural: true, fa: 'Πτολεμαῖοι', dynasty: 'Ptolemies', generals: [g('Scopas', 3, ['bold'], 'jerusalem')], lineage: [{ name: 'Ptolemy III', since: -246, until: -222 }, { name: 'Ptolemy IV', since: -222, until: -204 }] }),
  r('thebaid', 'Theban rising', 'Thebaid', '#c9a12b', 'qus', k('Hugronaphor', 'Pharaoh', -240, -205, ['proud', 'bold']), { dynasty: 'Native pharaohs' }),
  r('kush', 'Kingdom of Kush', 'Kush', '#6a4c9c', 'soba', k('Adikhalamani', 'Qore', -235, -207, ['steadfast']), { fa: 'Meroe', dynasty: 'Meroitic kings' }),
  r('nabataea', 'Nabataean kingdom', 'Nabataea', '#c4553a', 'karak', k('Aretas', 'King', -235, -210, ['shrewd'])),
  r('lihyan', 'Lihyan', 'Lihyan', '#9a8a3a', 'yanbu', k('the King of Lihyan', 'King', -240, -215, ['cautious'])),
  r('saba', 'Kingdom of Saba', 'Saba', '#b0894a', 'sanaa', k("Yada'il", 'King', -240, -215, ['wise'])),
  r('qataban', 'Kingdom of Qataban', 'Qataban', '#8f6f1f', 'aden', k('the King of Qataban', 'King', -240, -215, ['shrewd'])),
  r('hadramawt_k', 'Kingdom of Hadramawt', 'Hadramawt', '#7a6a4a', 'hadramawt', k('the King of Hadramawt', 'King', -240, -215, ['cautious'])),
  r('gerrha', 'Gerrha', 'Gerrha', '#4a8fa0', 'hasa', k('the Archon of Gerrha', 'Archon', -245, -215, ['shrewd']), { elective: true }),
  r('seleucid', 'Seleucid Empire', 'Seleucids', '#6aa84f', 'antioch', k('Antiochus III', 'King', -241, -222, ['relentless', 'ambitious'], 5), { plural: true, fa: 'Σελευκίδαι', dynasty: 'Seleucids', heir: { name: 'Antiochus', born: -221, traits: ['bold'], relation: 'son' },
    generals: [g('Zeuxis', 4, ['steadfast'], 'smyrna'.replace('smyrna', 'konya')), g('Antipater', 3, ['loyal'], 'damascus'), g('Nicanor', 3, ['bold'], 'baghdad')], lineage: [{ name: 'Seleucus III', since: -225, until: -223 }] }),
  r('persis', 'Persis', 'Persis', '#4f9a8a', 'fars', k('Vahbarz', 'Frataraka', -235, -210, ['proud']), { overlord: 'seleucid', fa: 'Pārsa' }),
  r('atropatene', 'Media Atropatene', 'Atropatene', '#5e8c3a', 'tabriz', k('Artabazanes', 'King', -270, -230, ['cautious', 'ailing']), { overlord: 'seleucid' }),
  r('armenia', 'Kingdom of Armenia', 'Armenia', '#b8b23a', 'ani', k('Orontes IV', 'King', -245, -212, ['proud']), { generals: [g('Artaxias', 4, ['ambitious'], 'erzurum')], dynasty: 'Orontids', fa: 'Հայք' }),
  r('iberia_k', 'Kingdom of Iberia', 'Iberia', '#a0846a', 'kartli', k('Saurmag I', 'King', -250, -234, ['steadfast']), { dynasty: 'Pharnavazids', fa: 'ქართლი' }),
  r('colchis', 'Colchis', 'Colchis', '#3f7f8f', 'imereti', k('the King of Colchis', 'King', -245, -215, ['shrewd'])),
  r('albania_k', 'Caucasian Albania', 'Albania', '#6a8a6a', 'arran', k('the King of the Albanians', 'King', -245, -215, ['cautious'])),
  r('parthia', 'Parthian kingdom', 'Parthia', '#8a3a3a', 'kumis', k('Arsaces II', 'King', -240, -211, ['bold', 'shrewd'], 4), { heir: { name: 'Phriapatius', born: -230, traits: ['cautious'], relation: 'nephew' }, dynasty: 'Arsacids', fa: 'Parθava' }),
  r('bactria', 'Greco-Bactrian kingdom', 'Bactria', '#c9a646', 'balkh', k('Euthydemus I', 'King', -260, -230, ['shrewd', 'steadfast'], 4), { heir: { name: 'Demetrius', born: -222, traits: ['ambitious', 'bold'], relation: 'son' }, dynasty: 'Euthydemids', fa: 'Βακτριανή' }),
  r('sophagasenus', 'Kingdom of Sophagasenus', 'Kapisa', '#c0612b', 'kabul', k('Sophagasenus', 'King', -250, -206, ['cautious'])),
  r('chorasmia', 'Chorasmia', 'Chorasmia', '#2f7d4f', 'gurganj', k('the King of Chorasmia', 'King', -240, -215, ['steadfast'])),
  r('dayuan', 'Dayuan', 'Dayuan', '#4a8a7a', 'ferghana', k('the King of Dayuan', 'King', -240, -215, ['proud'])),
  r('kangju', 'Kangju', 'Kangju', '#7a9a4a', 'otrar', k('the Kangju king', 'King', -240, -215, ['restless']), { nomad: true }),
  r('massagetae', 'Massagetae', 'Massagetae', '#8a8a8a', 'kipchak', k('the Massagetan king', 'King', -240, -215, ['restless', 'bold']), { nomad: true, plural: true }),
  r('sai', 'Sai (Saka)', 'Saka', '#9a5aa0', 'almaliq', k('the Saka king', 'King', -240, -215, ['restless']), { nomad: true }),
  r('yutian', 'Yutian', 'Yutian', '#c2477a', 'khotan', k('the King of Yutian', 'King', -240, -215, ['cautious'])),
  r('yuezhi', 'Yuezhi', 'Yuezhi', '#5a6a4a', 'ganzhou', k('the Yuezhi king', 'King', -240, -215, ['proud']), { nomad: true }),
  r('xiongnu', 'Xiongnu', 'Xiongnu', '#35567a', 'tula', k('Modu Chanyu', 'Chanyu', -234, -209, ['relentless', 'cruel', 'ambitious'], 5), { nomad: true, levy: 9, heir: { name: 'Jiyu', born: -225, traits: ['bold'], relation: 'son' }, dynasty: 'Luanti', fa: '匈奴', generals: [g('Han Xin of Hann', 3, ['scheming'], 'xingqing')] }),
  r('han', 'Han dynasty', 'Han', '#c54a3a', 'jingzhao', k('Liu Bang', 'Emperor', -256, -202, ['shrewd', 'scheming'], 4), { fa: '漢', dynasty: 'Liu', heir: { name: 'Liu Ying', born: -210, traits: ['timid'], relation: 'son' },
    generals: [g('Han Xin', 5, ['ambitious'], 'kaifeng'), g('Zhou Bo', 4, ['loyal'], 'datong'), g('Fan Kuai', 4, ['bold'], 'jingzhao')] }),
  r('qi', 'Kingdom of Qi', 'Qi', '#d9d4c3', 'jinan', k('Liu Fei', 'King', -221, -201, ['cautious']), { overlord: 'han', fa: '齊' }),
  r('yan', 'Kingdom of Yan', 'Yan', '#3b3b3b', 'zhongdu', k('Lu Wan', 'King', -256, -202, ['scheming']), { overlord: 'han', fa: '燕' }),
  r('changsha_k', 'Kingdom of Changsha', 'Changsha', '#e0c25a', 'changsha', k('Wu Chen', 'King', -230, -201, ['cautious']), { overlord: 'han', fa: '長沙' }),
  r('minyue', 'Minyue', 'Minyue', '#1e5f5a', 'quanzhou', k('Zou Wuzhu', 'King', -245, -202, ['proud']), { fa: '閩越' }),
  r('nanyue', 'Nanyue', 'Nanyue', '#6f8a3a', 'guangzhou', k('Zhao Tuo', 'King', -240, -204, ['shrewd', 'ambitious'], 4), { fa: '南越', dynasty: 'Zhao' }),
  r('dian', 'Kingdom of Dian', 'Dian', '#5b7f4a', 'dali', k('the King of Dian', 'King', -240, -215, ['cautious']), { fa: '滇' }),
  r('aulac', 'Âu Lạc', 'Âu Lạc', '#c46a4a', 'thanglong', k('An Dương Vương', 'King', -275, -257, ['wise', 'ailing']), { generals: [g('Cao Lỗ', 4, ['loyal'], 'thanglong')], fa: '甌雒' }),
  r('gojoseon', 'Gojoseon', 'Gojoseon', '#5a7fb8', 'pyongyang', k('Jun', 'King', -245, -220, ['cautious']), { generals: [g('Wiman', 4, ['ambitious', 'scheming'], 'pyongyang')], fa: '古朝鮮' }),
  r('pyu', 'Pyu city-states', 'Pyu', '#8a5a7a', 'pagan', k('the Pyu king', 'King', -240, -215, ['wise']), { plural: false }),
  r('maurya', 'Maurya Empire', 'Maurya', '#c9a12b', 'bihar', k('Devavarman', 'Emperor', -230, -202, ['timid']), { fa: 'मौर्य', dynasty: 'Mauryas', generals: [g('Pushyamitra Shunga', 4, ['ambitious', 'scheming'], 'malwa')],
    lineage: [{ name: 'Ashoka', since: -268, until: -232 }, { name: 'Dasharatha', since: -232, until: -224 }, { name: 'Samprati', since: -224, until: -215 }, { name: 'Shalishuka', since: -215, until: -202 }] }),
  r('satavahana', 'Satavahana kingdom', 'Satavahanas', '#8a3a6a', 'devagiri', k('Satakarni', 'King', -230, -205, ['ambitious']), { plural: true, fa: 'सातवाहन' }),
  r('kalinga', 'Kalinga', 'Kalinga', '#9a8a2a', 'kalinga', k('Mahameghavahana', 'King', -240, -215, ['proud'])),
  r('chola', 'Early Cholas', 'Cholas', '#a33a2a', 'thanjavur', k('Ilanchetchenni', 'King', -240, -215, ['bold']), { plural: true }),
  r('pandya', 'Early Pandyas', 'Pandyas', '#3a8a9a', 'madurai', k('Nedunjeliyan', 'King', -240, -215, ['proud']), { plural: true }),
  r('chera', 'Early Cheras', 'Cheras', '#6a9a3a', 'kerala', k('Uthiyan Cheralathan', 'King', -240, -215, ['shrewd']), { plural: true }),
  r('anuradhapura', 'Anuradhapura', 'Anuradhapura', '#c9a24a', 'lanka', k('Elara', 'King', -235, -205, ['just', 'wise']), { fa: 'අනුරාධපුර' }),
  r('pergamon', 'Kingdom of Pergamon', 'Pergamon', '#3a5a8a', 'smyrna', k('Attalus I', 'King', -269, -241, ['shrewd', 'ailing']), { heir: { name: 'Eumenes', born: -221, traits: ['wise'], relation: 'son' }, dynasty: 'Attalids', fa: 'Πέργαμον' }),
  r('bithynia', 'Kingdom of Bithynia', 'Bithynia', '#7a3d3d', 'nicaea', k('Prusias I', 'King', -243, -228, ['bold']), { fa: 'Βιθυνία' }),
  r('byzantion', 'Byzantion', 'Byzantion', '#d0a32a', 'constantinople', k('the Archon of Byzantion', 'Archon', -245, -210, ['shrewd']), { elective: true, fa: 'Βυζάντιον' }),
  r('pontus', 'Kingdom of Pontus', 'Pontus', '#5a8fa8', 'sivas', k('Mithridates III', 'King', -240, -220, ['cautious']), { dynasty: 'Mithridatids', fa: 'Πόντος' }),
  r('galatia', 'Galatians', 'Galatians', '#4f7a2a', 'ankara', k('Ortiagon', 'Chieftain', -230, -210, ['bold', 'restless']), { plural: true }),
  r('cappadocia', 'Kingdom of Cappadocia', 'Cappadocia', '#9a6a4a', 'kayseri', k('Ariarathes IV', 'King', -232, -220, ['cautious']), { dynasty: 'Ariarathids' }),
  r('macedon', 'Kingdom of Macedon', 'Macedon', '#b03a2e', 'thessalonica', k('Philip V', 'King', -238, -221, ['ambitious', 'cruel'], 4), { heir: { name: 'Perseus', born: -212, traits: ['scheming'], relation: 'son' }, dynasty: 'Antigonids', fa: 'Μακεδονία', generals: [g('Philocles', 3, ['steadfast'], 'thrace')] }),
  r('athens', 'Athens', 'Athens', '#3e6fa0', 'hellas', k('the Archon of Athens', 'Archon', -245, -201, ['proud']), { elective: true, fa: 'Ἀθῆναι' }),
  r('sparta', 'Sparta', 'Sparta', '#9b2d3d', 'morea', k('Nabis', 'King', -245, -207, ['cruel', 'bold'], 3), { fa: 'Σπάρτη' }),
  r('illyria', 'Illyrian kingdom', 'Illyria', '#8a6d3b', 'epirus', k('Pleuratus', 'King', -240, -206, ['cautious'])),
  r('odrysae', 'Odrysian kingdom', 'Odrysians', '#a64a8a', 'tarnovo', k('the Odrysian king', 'King', -240, -215, ['proud']), { plural: true }),
  r('dacia', 'Dacians', 'Dacians', '#6a7a3a', 'transylvania', k('Oroles', 'King', -240, -215, ['bold']), { plural: true }),
  r('scordisci', 'Scordisci', 'Scordisci', '#7a5a2a', 'ras', k('the Scordiscan chief', 'Chieftain', -240, -215, ['restless']), { plural: true }),
  r('noricum', 'Kingdom of Noricum', 'Noricum', '#c23b3b', 'styria', k('the King of Noricum', 'King', -240, -215, ['steadfast'])),
  r('boii', 'Boii', 'Boii', '#d9a23b', 'bohemia', k('the Boian chief', 'Chieftain', -240, -215, ['bold']), { plural: true }),
  r('insubres', 'Insubres', 'Insubres', '#5e9a5a', 'milan', k('the Insubrian chief', 'Chieftain', -240, -215, ['bold', 'proud']), { plural: true, generals: [g('Hamilcar the Carthaginian', 3, ['bold'], 'milan')] }),
  r('bosporus', 'Bosporan kingdom', 'Bosporus', '#3a6a5a', 'crimea', k('Spartocus V', 'King', -240, -210, ['shrewd']), { dynasty: 'Spartocids' }),
  r('scythians', 'Scythians', 'Scythians', '#8a7a3a', 'cumania', k('the Scythian king', 'King', -240, -215, ['restless']), { nomad: true, plural: true }),
  r('sarmatians', 'Sarmatians', 'Sarmatians', '#4a6a8a', 'saqsin', k('Amage', 'Queen', -235, -210, ['bold', 'shrewd'], 4), { nomad: true, plural: true }),
  r('suebi', 'Suebi', 'Suebi', '#7a8a4a', 'saxony', k('the Suebian chief', 'Chieftain', -240, -215, ['restless']), { plural: true }),
  r('cimbri', 'Cimbri', 'Cimbri', '#b65a2a', 'jutland', k('the Cimbrian chief', 'Chieftain', -240, -215, ['bold']), { plural: true }),
  r('bastarnae', 'Bastarnae', 'Bastarnae', '#6a6a8a', 'halych', k('the Bastarnian chief', 'Chieftain', -240, -215, ['restless', 'bold']), { plural: true }),
  r('senones', 'Senones', 'Senones', '#3557a6', 'champagne', k('the Senonian chief', 'Chieftain', -240, -215, ['proud']), { plural: true }),
  r('aedui', 'Aedui', 'Aedui', '#b8862b', 'burgundy', k('the Vergobret of the Aedui', 'Vergobret', -240, -215, ['shrewd']), { plural: true, elective: true }),
  r('arverni', 'Arverni', 'Arverni', '#8e3b5e', 'aquitaine', k('Celtillus', 'King', -240, -215, ['ambitious']), { plural: true }),
  r('armorica', 'Armorican tribes', 'Armoricans', '#2f7a5c', 'brittany', k('the Armorican chief', 'Chieftain', -240, -215, ['cautious']), { plural: true }),
  r('belgae', 'Belgae', 'Belgae', '#d4a017', 'flanders', k('the Belgic chief', 'Chieftain', -240, -215, ['bold']), { plural: true }),
  r('volcae', 'Volcae Tectosages', 'Volcae', '#b5523b', 'toulouse', k('the Volcan chief', 'Chieftain', -240, -215, ['proud']), { plural: true }),
  r('massalia', 'Massalia', 'Massalia', '#2e5e9e', 'provence', k('the Timouchos of Massalia', 'Timouchos', -245, -210, ['shrewd']), { elective: true, fa: 'Μασσαλία' }),
  r('helvetii', 'Helvetii', 'Helvetii', '#c0392b', 'swabia', k('the Helvetian chief', 'Chieftain', -240, -215, ['restless']), { plural: true }),
  r('britons', 'Catuvellauni', 'Britons', '#4f8a3a', 'london', k('the British chief', 'Chieftain', -240, -215, ['bold']), { plural: true }),
  r('brigantes', 'Brigantes', 'Brigantes', '#7a2e2e', 'york', k('the Brigantian chief', 'Chieftain', -240, -215, ['proud']), { plural: true }),
  r('caledonii', 'Caledonii', 'Caledonians', '#3a7a6a', 'scotland', k('the Caledonian chief', 'Chieftain', -240, -215, ['restless']), { plural: true }),
  r('celtiberi', 'Celtiberians', 'Celtiberians', '#9a7a3a', 'burgos', k('the Celtiberian chief', 'Chieftain', -240, -215, ['bold', 'proud']), { plural: true }),
  r('lusitani', 'Lusitanians', 'Lusitanians', '#6a3a6a', 'portugal', k('the Lusitanian chief', 'Chieftain', -240, -215, ['restless']), { plural: true }),
];
const rid = new Set(REALMS.map((x) => x.id));
for (const [pid, [owner]] of Object.entries(P)) if (owner && !rid.has(owner)) throw new Error(`200 BC: ${pid} is held by ${owner}, which is not a realm`);

const PEOPLE = {
  rome: { ruler: 'conqueror', generals: { 'Titus Quinctius Flamininus': 'glory', 'Publius Cornelius Scipio': 'loyal', 'Marcus Porcius Cato': 'steady' } },
  carthage: { ruler: 'miser', generals: { 'Hannibal Barca': 'glory' } },
  numidia: { ruler: 'conqueror', heir: 'builder' }, masaesyli: { ruler: 'conqueror' },
  ptolemaic: { ruler: 'negligent', generals: { Scopas: 'mercenary' }, vizier: { name: 'Aristomenes', born: -245, temper: 'able', title: 'Epitropos' } },
  thebaid: { ruler: 'tyrant' }, kush: { ruler: 'builder' }, nabataea: { ruler: 'miser' }, saba: { ruler: 'builder' },
  seleucid: { ruler: 'conqueror', heir: 'conqueror', consort: { name: 'Laodice', born: -240, temper: 'devoted', title: 'Queen' }, generals: { Zeuxis: 'steady', Antipater: 'loyal', Nicanor: 'glory' } },
  armenia: { ruler: 'negligent', generals: { Artaxias: 'treacherous' } }, parthia: { ruler: 'conqueror' },
  bactria: { ruler: 'diplomat', heir: 'conqueror', consort: { name: 'Apama', born: -250, temper: 'devoted', title: 'Queen' } },
  xiongnu: { ruler: 'conqueror', heir: 'conqueror', consort: { name: 'Yanzhi', born: -230, temper: 'schemer', title: 'Yanzhi' }, generals: { 'Han Xin of Hann': 'mercenary' } },
  han: { ruler: 'paranoid', heir: 'negligent', consort: { name: 'Lü Zhi', born: -241, temper: 'schemer', title: 'Empress' }, vizier: { name: 'Xiao He', born: -257, temper: 'able', title: 'Chancellor' },
    generals: { 'Han Xin': 'treacherous', 'Zhou Bo': 'loyal', 'Fan Kuai': 'glory' } },
  yan: { ruler: 'paranoid' }, nanyue: { ruler: 'diplomat' }, aulac: { ruler: 'builder', generals: { 'Cao Lỗ': 'loyal' } }, gojoseon: { ruler: 'negligent', generals: { Wiman: 'treacherous' } },
  maurya: { ruler: 'negligent', generals: { 'Pushyamitra Shunga': 'treacherous' }, vizier: { name: 'Vasumitra', born: -240, temper: 'kingmaker', title: 'Mantri' } },
  satavahana: { ruler: 'conqueror' }, kalinga: { ruler: 'conqueror' }, anuradhapura: { ruler: 'just' },
  pergamon: { ruler: 'diplomat', heir: 'builder', consort: { name: 'Apollonis', born: -260, temper: 'devoted', title: 'Queen' } },
  bithynia: { ruler: 'conqueror' }, pontus: { ruler: 'diplomat' }, cappadocia: { ruler: 'diplomat' },
  macedon: { ruler: 'conqueror', heir: 'paranoid', generals: { Philocles: 'steady' } }, sparta: { ruler: 'tyrant' }, athens: { ruler: 'diplomat' },
  sarmatians: { ruler: 'conqueror' }, insubres: { ruler: 'conqueror', generals: { 'Hamilcar the Carthaginian': 'glory' } }, arverni: { ruler: 'conqueror' },
};

const KNOWN = {
  torsion: ['rome', 'carthage', 'macedon', 'seleucid', 'ptolemaic', 'pergamon', 'athens', 'sparta', 'bithynia', 'pontus', 'bactria', 'byzantion', 'massalia', 'bosporus', 'numidia'],
  elephants: ['maurya', 'seleucid', 'ptolemaic', 'kalinga', 'satavahana', 'anuradhapura', 'chola', 'pandya', 'chera', 'sophagasenus', 'bactria'],
  legion: ['rome'],
  crossbow: ['han', 'qi', 'yan', 'changsha_k', 'nanyue', 'minyue', 'aulac'],
  steel: ['maurya', 'satavahana', 'chera', 'chola', 'pandya', 'anuradhapura'],
  credit: ['carthage', 'ptolemaic', 'athens', 'massalia', 'byzantion', 'gerrha'],
  observatory: ['ptolemaic', 'seleucid'],
  rotation: [],
};

// The Royal Road from Sardis to Susa, the road from Ecbatana to Bactra, the Grand Trunk road of the Mauryas, and the
// Incense Road from Saba to the sea.
const ROADS = [
  ['smyrna', 'konya', 'kayseri', 'malatya', 'edessa', 'mosul', 'baghdad', 'khuzestan'],
  ['baghdad', 'hamadan', 'rey', 'kumis', 'nishapur', 'merv', 'balkh'],
  ['peshawar', 'saltrange', 'lahore', 'delhi', 'kannauj', 'varanasi', 'bihar', 'bengal'],
  ['hadramawt', 'sanaa', 'hejaz', 'yanbu', 'karak', 'jerusalem'],
];

const names = Object.fromEntries(Object.entries(P).map(([pid, [, city, name]]) => [pid, { city, name, fa: city }]));
const cultures = Object.fromEntries(Object.entries(P).map(([pid, [, , , c]]) => [pid, c]));
// The great walls of the age: citadels that held for years against the best armies of their time.
const WALLS = { smyrna: 4, hellas: 3, morea: 2, constantinople: 4, rome: 3, tunis: 4, alexandria: 3, antioch: 3, baghdad: 3, balkh: 4, jingzhao: 4, bihar: 4, thanglong: 4, kumis: 2, ani: 3, hamadan: 3, khuzestan: 3, thessalonica: 3, nicaea: 3, kartli: 3, sanaa: 3, kalinga: 3, devagiri: 3, lanka: 3, guangzhou: 3, pyongyang: 3 };
const provinces = Object.fromEntries(Object.entries(P).map(([pid, [owner]]) => [pid, WALLS[pid] !== undefined ? { owner, walls: WALLS[pid] } : { owner }]));

export default {
  id: 'ancient',
  name: 'The ancient world, 200 BC',
  start: -200,
  months: 672,
  realms: REALMS,
  people: PEOPLE,
  provinces,
  names,
  cultures,
  wars: [['rome', 'macedon', 'history'], ['athens', 'macedon', 'history'], ['pergamon', 'macedon', 'history'], ['seleucid', 'ptolemaic', 'history'], ['thebaid', 'ptolemaic', 'rising'],
    ['xiongnu', 'han', 'history'], ['rome', 'insubres', 'history'], ['rome', 'boii', 'history']],
  allies: [['rome', 'pergamon'], ['rome', 'athens'], ['rome', 'numidia'], ['rome', 'massalia'], ['rome', 'illyria'], ['macedon', 'seleucid'], ['insubres', 'boii']],
  known: KNOWN,
  inventions: ['torsion', 'elephants', 'legion', 'crossbow', 'steel', 'credit', 'observatory', 'paper', 'compass', 'rotation'],
  roads: ROADS,
  female: ['Amage', 'Laodice', 'Lü Zhi', 'Apama', 'Apollonis', 'Yanzhi'],
  setup(s) {
    // Carthage pays Rome the indemnity of 201 BC, month after month, for the rest of the age.
    if (s.realms.carthage && s.realms.rome) {
      const tid = `t${s.nextId++}`;
      s.treaties[tid] = { id: tid, kind: 'peace', name: 'Peace of Zama', parties: ['carthage', 'rome'], signed: 0, until: 600, ended: null, broken: null, pay: { from: 'carthage', to: 'rome', gold: 2 }, text: 'the indemnity of 201 BC', sealed: null };
    }
    // Ptolemy V is ten years old: his minister rules for him.
    const P5 = s.realms.ptolemaic;
    if (P5?.vizier) P5.regent = P5.vizier;
  },
  month(s, rng, emit) {
    consuls(s, rng('consuls'), emit);
    raids(s, rng('raids'), emit);
  },
};

// Every January Rome elects new consuls: the old one steps down and, if he is able, takes an army as proconsul.
function consuls(s, rng, emit) {
  const rome = s.realms.rome;
  if (!rome || rome.fallen || s.month % 12 !== 0 || s.month === 0) return;
  const old = s.chars[rome.ruler];
  const id = newChar(s, { name: personName(rng, 'roman', usedNames(s)), title: 'Consul', role: 'ruler', realm: 'rome', born: s.startYear + Math.floor(s.month / 12) - 38 - Math.floor(rng() * 15), temper: pickTemper(rng, R.temper.ruler), skill: 2 + Math.floor(rng() * 3), culture: 'roman', invented: true, since: s.startYear + Math.floor(s.month / 12) });
  if (old) {
    rome.lineage = [...(rome.lineage ?? []), { name: old.name, title: 'Consul', since: old.since, until: s.startYear + Math.floor(s.month / 12), cause: 'term', id: old.id }].slice(-30);
    Object.assign(old, { role: old.army ? 'general' : 'courtier', title: old.army ? 'Proconsul' : 'Senator' });
  }
  Object.assign(rome, { ruler: id, plan: null, power: null });
  emit('crowned', `The Roman people elect ${s.chars[id].name} consul for the year`, { realms: ['rome'], chars: [id], minor: true });
}

// The Xiongnu ride over the Great Wall to plunder the Han frontier.
function raids(s, rng, emit) {
  const x = s.realms.xiongnu;
  if (!x || x.fallen || !chance(rng, 1 / 14)) return;
  const targets = provincesOf(s, 'xiongnu').flatMap((p) => p.neighbors).filter((n) => s.provinces[n].owner && s.provinces[n].owner !== 'xiongnu' && ['han', 'yan', 'qi', 'yuezhi'].includes(s.provinces[n].owner));
  if (!targets.length) return;
  const t = pick(rng, targets), p = s.provinces[t], victim = s.realms[p.owner];
  const loot = Math.min(victim.gold, PROV[t].wealth * 5);
  victim.gold = round1(victim.gold - loot);
  x.gold = round1(x.gold + loot);
  p.ravaged = Math.max(p.ravaged, 4);
  emit('raid', `Xiongnu riders sweep over the frontier into ${placeOf(s, t)}, carrying off ${Math.round(loot)} gold and captives`, { realms: ['xiongnu', victim.id], at: t });
}
