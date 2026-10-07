// The age of the world wars, 1914: the great empires at the height of their reach, bound by alliances, armed with
// railways, machine guns and heavy guns. The same map, with the owners, cities and peoples of the time.
// Forces of the age: the July Crisis and the powers that join the war one by one; the Arab Revolt; the Russian
// revolutions and the borderlands they set free; the Americans; the ministers and presidents who come and go;
// the Great Depression; and, where a nation is beaten or poor, the strongmen who promise to set it right.
import { RULES as R } from '../rules.js';
import { PROVINCES, provincesOf, living, newChar, newArmy, newRealm, setOwner, round1, chance, ofR, cityOf, placeOf, usedNames, atWar, allied, key, yearOf } from '../core.js';
import { personName } from '../names.js';
import { declareWar, makePeace } from '../war.js';
import { die, split } from '../court.js';
import { treaty } from '../acts.js';

// province: [owner, city, name, people]
const P = {
  // the British Isles and Iberia
  connacht: ['uk', 'Galway', 'Connacht', 'british'], ireland: ['uk', 'Dublin', 'Ireland', 'british'], scotland: ['uk', 'Edinburgh', 'Scotland', 'british'],
  york: ['uk', 'Manchester', 'Northern England', 'british'], wales: ['uk', 'Cardiff', 'Wales', 'british'], london: ['uk', 'London', 'England', 'british'],
  galicia: ['spain', 'A Coruña', 'Galicia', 'iberian_m'], leon: ['spain', 'León', 'León', 'iberian_m'], portugal: ['portugal', 'Porto', 'Northern Portugal', 'iberian_m'],
  lisbon: ['portugal', 'Lisbon', 'Lisbon', 'iberian_m'], seville: ['spain', 'Seville', 'Andalusia', 'iberian_m'], navarre: ['spain', 'Bilbao', 'Basque Country', 'iberian_m'],
  burgos: ['spain', 'Burgos', 'Old Castile', 'iberian_m'], aragon: ['spain', 'Zaragoza', 'Aragon', 'iberian_m'], toledo: ['spain', 'Madrid', 'New Castile', 'iberian_m'],
  barcelona: ['spain', 'Barcelona', 'Catalonia', 'iberian_m'], majorca: ['spain', 'Palma', 'Balearic Islands', 'iberian_m'], valencia: ['spain', 'Valencia', 'Valencia', 'iberian_m'],
  murcia: ['spain', 'Cartagena', 'Murcia', 'iberian_m'], cordoba: ['spain', 'Córdoba', 'Córdoba', 'iberian_m'], granada: ['spain', 'Málaga', 'Granada', 'iberian_m'],
  // France, the Low Countries and the Rhine
  flanders: ['belgium', 'Brussels', 'Belgium', 'french_m'], normandy: ['france', 'Rouen', 'Normandy', 'french_m'], paris: ['france', 'Paris', 'Île-de-France', 'french_m'],
  champagne: ['france', 'Verdun', 'Champagne', 'french_m'], brittany: ['france', 'Brest', 'Brittany', 'french_m'], anjou: ['france', 'Nantes', 'Loire', 'french_m'],
  aquitaine: ['france', 'Bordeaux', 'Aquitaine', 'french_m'], toulouse: ['france', 'Toulouse', 'Languedoc', 'french_m'], burgundy: ['france', 'Dijon', 'Burgundy', 'french_m'],
  lorraine: ['germany', 'Metz', 'Lorraine', 'german_m'], provence: ['france', 'Marseille', 'Provence', 'french_m'], alsace: ['germany', 'Strasbourg', 'Alsace', 'german_m'],
  swabia: ['germany', 'Stuttgart', 'Württemberg', 'german_m'], bavaria: ['germany', 'Munich', 'Bavaria', 'german_m'], tyrol: ['austria', 'Trento', 'Tyrol', 'german_m'],
  franconia: ['germany', 'Nuremberg', 'Franconia', 'german_m'], cologne: ['germany', 'Cologne', 'Rhineland', 'german_m'], frisia: ['netherlands', 'Amsterdam', 'Holland', 'dutch_m'],
  // the north
  jutland: ['denmark', 'Aarhus', 'Jutland', 'nordic_m'], holstein: ['germany', 'Kiel', 'Schleswig-Holstein', 'german_m'], zealand: ['denmark', 'Copenhagen', 'Zealand', 'nordic_m'],
  scania: ['sweden', 'Malmö', 'Scania', 'nordic_m'], nidaros: ['norway', 'Trondheim', 'Trøndelag', 'nordic_m'], bergen: ['norway', 'Bergen', 'Vestland', 'nordic_m'],
  viken: ['norway', 'Kristiania', 'Eastern Norway', 'nordic_m'], uppland: ['sweden', 'Stockholm', 'Svealand', 'nordic_m'], gotaland: ['sweden', 'Gothenburg', 'Götaland', 'nordic_m'],
  finland: ['russia', 'Helsingfors', 'Finland', 'baltic_m'], estonia: ['russia', 'Reval', 'Estonia', 'baltic_m'], livonia: ['russia', 'Riga', 'Livonia', 'baltic_m'],
  prussia: ['germany', 'Königsberg', 'East Prussia', 'german_m'], lithuania: ['russia', 'Vilna', 'Lithuania', 'baltic_m'], pomerania: ['germany', 'Danzig', 'West Prussia', 'german_m'],
  saxony: ['germany', 'Dresden', 'Saxony', 'german_m'], thuringia: ['germany', 'Erfurt', 'Thuringia', 'german_m'], brandenburg: ['germany', 'Berlin', 'Brandenburg', 'german_m'],
  gniezno: ['germany', 'Posen', 'Posen', 'slav_m'], silesia: ['germany', 'Breslau', 'Silesia', 'german_m'], krakow: ['austria', 'Kraków', 'West Galicia', 'slav_m'],
  masovia: ['russia', 'Warsaw', 'Poland', 'slav_m'], bohemia: ['austria', 'Prague', 'Bohemia', 'slav_m'], moravia: ['austria', 'Brünn', 'Moravia', 'slav_m'],
  halych: ['austria', 'Lemberg', 'East Galicia', 'slav_m'], volhynia: ['russia', 'Zhitomir', 'Volhynia', 'slav_m'],
  // the Danube and the Balkans
  austria: ['austria', 'Vienna', 'Lower Austria', 'german_m'], styria: ['austria', 'Graz', 'Styria', 'german_m'], hungary: ['austria', 'Budapest', 'Hungary', 'magyar_m'],
  croatia: ['austria', 'Zagreb', 'Croatia', 'southslav_m'], dalmatia: ['austria', 'Sarajevo', 'Bosnia', 'southslav_m'], epirus: ['albania_m', 'Durazzo', 'Albania', 'albanian_m'],
  ras: ['serbia', 'Belgrade', 'Serbia', 'southslav_m'], transylvania: ['austria', 'Kolozsvár', 'Transylvania', 'romanian_m'], wallachia: ['romania', 'Bucharest', 'Wallachia', 'romanian_m'],
  sofia: ['bulgaria', 'Sofia', 'Sofia', 'southslav_m'], tarnovo: ['bulgaria', 'Tarnovo', 'Tarnovo', 'southslav_m'], varna: ['bulgaria', 'Varna', 'Varna', 'southslav_m'],
  thrace: ['ottoman', 'Adrianople', 'Eastern Thrace', 'turkish_m'], constantinople: ['ottoman', 'Constantinople', 'Constantinople', 'turkish_m'], thessalonica: ['greece', 'Salonica', 'Macedonia', 'greek_m'],
  hellas: ['greece', 'Athens', 'Attica', 'greek_m'], morea: ['greece', 'Patras', 'Peloponnese', 'greek_m'],
  // Italy
  milan: ['italy', 'Milan', 'Lombardy', 'italian_m'], venice: ['italy', 'Venice', 'Veneto', 'italian_m'], genoa: ['italy', 'Turin', 'Piedmont', 'italian_m'],
  romagna: ['italy', 'Bologna', 'Emilia', 'italian_m'], tuscany: ['italy', 'Florence', 'Tuscany', 'italian_m'], rome: ['italy', 'Rome', 'Lazio', 'italian_m'],
  naples: ['italy', 'Naples', 'Campania', 'italian_m'], apulia: ['italy', 'Bari', 'Apulia', 'italian_m'], palermo: ['italy', 'Palermo', 'Sicily', 'italian_m'],
  // Africa
  tunis: ['tunisia', 'Tunis', 'Tunisia', 'arab_m'], tripolitania: ['italy', 'Tripoli', 'Tripolitania', 'arab_m'], bejaia: ['france', 'Algiers', 'Algeria', 'arab_m'],
  tlemcen: ['france', 'Oran', 'Oranie', 'arab_m'], fez: ['morocco', 'Fez', 'Morocco', 'arab_m'], marrakesh: ['morocco', 'Marrakesh', 'Marrakesh', 'arab_m'],
  sijilmasa: ['morocco', 'Tafilalt', 'Tafilalt', 'arab_m'], fezzan: ['italy', 'Murzuk', 'Fezzan', 'arab_m'], barqa: ['italy', 'Benghazi', 'Cyrenaica', 'arab_m'],
  alexandria: ['egypt', 'Alexandria', 'Lower Egypt', 'arab_m'], cairo: ['egypt', 'Cairo', 'Cairo', 'arab_m'], qus: ['egypt', 'Aswan', 'Upper Egypt', 'arab_m'],
  nobadia: ['uk', 'Wadi Halfa', 'Nubia', 'arab_m'], dongola: ['uk', 'Dongola', 'Dongola', 'arab_m'], soba: ['uk', 'Khartoum', 'Sudan', 'arab_m'],
  aksum: ['ethiopia', 'Aksum', 'Tigray', 'african_m'], roha: ['ethiopia', 'Dessie', 'Wollo', 'african_m'], shewa: ['ethiopia', 'Addis Ababa', 'Shewa', 'african_m'],
  zeila: ['uk', 'Berbera', 'Somaliland', 'african_m'], mogadishu: ['italy', 'Mogadishu', 'Italian Somaliland', 'african_m'], mombasa: ['uk', 'Mombasa', 'British East Africa', 'african_m'],
  kilwa: ['germany', 'Dar es Salaam', 'German East Africa', 'african_m'], sofala: ['portugal', 'Beira', 'Mozambique', 'african_m'], zimbabwe: ['uk', 'Salisbury', 'Rhodesia', 'african_m'],
  mapungubwe: ['southafrica', 'Pretoria', 'Transvaal', 'dutch_m'],
  takrur: ['france', 'Dakar', 'Senegal', 'african_m'], koumbi: ['france', 'Néma', 'Mauritania', 'african_m'], sosso: ['france', 'Kayes', 'Upper Senegal', 'african_m'], kangaba: ['france', 'Bamako', 'French Sudan', 'african_m'],
  djenne: ['france', 'Mopti', 'Inland Niger', 'african_m'], timbuktu: ['france', 'Timbuktu', 'Timbuktu', 'african_m'], gao: ['france', 'Niamey', 'Niger', 'african_m'],
  kano: ['uk', 'Kano', 'Northern Nigeria', 'african_m'], njimi: ['germany', 'Garua', 'Kamerun', 'african_m'], ife: ['uk', 'Lagos', 'Lagos', 'african_m'], benin: ['uk', 'Benin City', 'Southern Nigeria', 'african_m'],
  // Anatolia, the Caucasus, the Levant, Arabia
  nicaea: ['ottoman', 'Bursa', 'Bursa', 'turkish_m'], kastamonu: ['ottoman', 'Kastamonu', 'Kastamonu', 'turkish_m'], trebizond: ['ottoman', 'Trebizond', 'Trebizond', 'turkish_m'],
  sivas: ['ottoman', 'Sivas', 'Sivas', 'turkish_m'], ankara: ['ottoman', 'Angora', 'Angora', 'turkish_m'], smyrna: ['ottoman', 'Smyrna', 'Aydın', 'turkish_m'],
  konya: ['ottoman', 'Konya', 'Konya', 'turkish_m'], attaleia: ['ottoman', 'Adalia', 'Teke', 'turkish_m'], cyprus: ['uk', 'Nicosia', 'Cyprus', 'greek_m'],
  kayseri: ['ottoman', 'Kayseri', 'Kayseri', 'turkish_m'], malatya: ['ottoman', 'Harput', 'Mamuretülaziz', 'turkish_m'], cilicia: ['ottoman', 'Adana', 'Adana', 'turkish_m'],
  erzurum: ['ottoman', 'Erzurum', 'Erzurum', 'turkish_m'], ani: ['russia', 'Kars', 'Kars', 'caucasian_m'], amid: ['ottoman', 'Diyarbekir', 'Diyarbekir', 'turkish_m'], nakhchivan: ['russia', 'Erivan', 'Erivan', 'caucasian_m'],
  kartli: ['russia', 'Tiflis', 'Tiflis', 'caucasian_m'], imereti: ['russia', 'Kutais', 'Kutais', 'caucasian_m'], arran: ['russia', 'Elisabethpol', 'Elisabethpol', 'caucasian_m'],
  shirvan: ['russia', 'Baku', 'Baku', 'caucasian_m'], derbent: ['russia', 'Derbent', 'Dagestan', 'caucasian_m'], alania: ['russia', 'Vladikavkaz', 'Terek', 'caucasian_m'],
  edessa: ['ottoman', 'Urfa', 'Urfa', 'arab_m'], mosul: ['ottoman', 'Mosul', 'Mosul', 'arab_m'], aleppo: ['ottoman', 'Aleppo', 'Aleppo', 'arab_m'],
  antioch: ['ottoman', 'Alexandretta', 'Antioch', 'arab_m'], homs: ['ottoman', 'Homs', 'Homs', 'arab_m'], tripoli: ['ottoman', 'Beirut', 'Lebanon', 'arab_m'],
  damascus: ['ottoman', 'Damascus', 'Syria', 'arab_m'], acre: ['ottoman', 'Haifa', 'Galilee', 'arab_m'], jerusalem: ['ottoman', 'Jerusalem', 'Palestine', 'arab_m'],
  karak: ['ottoman', 'Maan', 'Transjordan', 'arab_m'], yanbu: ['hejaz', 'Yanbu', 'Northern Hejaz', 'arab_m'], hejaz: ['hejaz', 'Mecca', 'Hejaz', 'arab_m'],
  sanaa: ['yemen_m', "Sana'a", 'Yemen', 'arab_m'], zabid: ['yemen_m', 'Hodeidah', 'Tihama', 'arab_m'], aden: ['uk', 'Aden', 'Aden', 'arab_m'],
  hadramawt: ['uk', 'Mukalla', 'Hadhramaut', 'arab_m'], hasa: ['nejd', 'Hofuf', 'al-Hasa', 'arab_m'], najd: ['nejd', 'Riyadh', 'Nejd', 'arab_m'],
  oman: ['oman_m', 'Nizwa', 'Inner Oman', 'arab_m'], sohar: ['oman_m', 'Muscat', 'Muscat', 'arab_m'],
  // Mesopotamia, Persia, Afghanistan, Turkestan
  baghdad: ['ottoman', 'Baghdad', 'Baghdad', 'arab_m'], basra: ['ottoman', 'Basra', 'Basra', 'arab_m'], khuzestan: ['persia', 'Mohammerah', 'Arabistan', 'arab_m'],
  shahrazur: ['ottoman', 'Kirkuk', 'Shahrizor', 'arab_m'], lur: ['persia', 'Khorramabad', 'Luristan', 'persian_m'], hamadan: ['persia', 'Hamadan', 'Hamadan', 'persian_m'],
  isfahan: ['persia', 'Isfahan', 'Isfahan', 'persian_m'], yazd: ['persia', 'Yazd', 'Yazd', 'persian_m'], fars: ['persia', 'Shiraz', 'Fars', 'persian_m'],
  darabgerd: ['persia', 'Bushehr', 'Gulf coast', 'persian_m'], kerman: ['persia', 'Kerman', 'Kerman', 'persian_m'], hormuz: ['persia', 'Bandar Abbas', 'Hormozgan', 'persian_m'],
  rey: ['persia', 'Tehran', 'Tehran', 'persian_m'], qazvin: ['persia', 'Qazvin', 'Qazvin', 'persian_m'], alamut: ['persia', 'Zanjan', 'Khamseh', 'persian_m'],
  gilan: ['persia', 'Rasht', 'Gilan', 'persian_m'], tabriz: ['persia', 'Tabriz', 'Azerbaijan', 'persian_m'], ardabil: ['persia', 'Ardabil', 'Ardabil', 'persian_m'],
  tabaristan: ['persia', 'Sari', 'Mazandaran', 'persian_m'], gorgan: ['persia', 'Astarabad', 'Astarabad', 'persian_m'],
  kumis: ['persia', 'Semnan', 'Semnan', 'persian_m'], nasa: ['russia', 'Ashkhabad', 'Transcaspia', 'turkestan_m'], sarakhs: ['russia', 'Tejen', 'Tejen', 'turkestan_m'],
  nishapur: ['persia', 'Mashhad', 'Khorasan', 'persian_m'], merv: ['russia', 'Merv', 'Merv', 'turkestan_m'], herat: ['afghanistan', 'Herat', 'Herat', 'afghan_m'],
  quhistan: ['persia', 'Birjand', 'Qohestan', 'persian_m'], sistan: ['persia', 'Zabol', 'Sistan', 'persian_m'], kandahar: ['afghanistan', 'Kandahar', 'Kandahar', 'afghan_m'],
  kabul: ['afghanistan', 'Kabul', 'Kabul', 'afghan_m'], ghazni: ['afghanistan', 'Ghazni', 'Ghazni', 'afghan_m'], bamiyan: ['afghanistan', 'Bamiyan', 'Hazarajat', 'afghan_m'],
  peshawar: ['uk', 'Peshawar', 'North-West Frontier', 'afghan_m'], ghor: ['afghanistan', 'Chaghcharan', 'Ghor', 'afghan_m'], balkh: ['afghanistan', 'Mazar', 'Afghan Turkestan', 'afghan_m'],
  termez: ['bukhara_k', 'Termez', 'Termez', 'turkestan_m'], khuttal: ['bukhara_k', 'Dyushambe', 'Eastern Bukhara', 'turkestan_m'], badakhshan: ['afghanistan', 'Faizabad', 'Badakhshan', 'afghan_m'],
  samarkand: ['russia', 'Samarkand', 'Samarkand', 'turkestan_m'], bukhara: ['bukhara_k', 'Bukhara', 'Bukhara', 'turkestan_m'], nasaf: ['bukhara_k', 'Karshi', 'Karshi', 'turkestan_m'],
  ushrusana: ['russia', 'Khujand', 'Khujand', 'turkestan_m'], ferghana: ['russia', 'Kokand', 'Ferghana', 'turkestan_m'], shash: ['russia', 'Tashkent', 'Syr Darya', 'turkestan_m'],
  otrar: ['russia', 'Chimkent', 'Chimkent', 'turkestan_m'], talas: ['russia', 'Aulie-Ata', 'Talas', 'turkestan_m'], jand: ['russia', 'Perovsk', 'Lower Syr Darya', 'turkestan_m'],
  gurganj: ['khiva_k', 'Urgench', 'Khorezm', 'turkestan_m'], khiva: ['khiva_k', 'Khiva', 'Khiva', 'turkestan_m'], kipchak: ['russia', 'Turgai', 'Turgai steppe', 'turkestan_m'],
  mangyshlak: ['russia', 'Fort Alexandrovsk', 'Mangyshlak', 'turkestan_m'],
  // Russia
  saqsin: ['russia', 'Astrakhan', 'Astrakhan', 'russian_m'], burtas: ['russia', 'Saratov', 'Saratov', 'russian_m'],
  bulgar: ['russia', 'Kazan', 'Kazan', 'russian_m'], cumania: ['russia', 'Yekaterinoslav', 'New Russia', 'slav_m'], pereyaslavl: ['russia', 'Poltava', 'Poltava', 'slav_m'],
  kiev: ['russia', 'Kiev', 'Kiev', 'slav_m'], chernigov: ['russia', 'Chernigov', 'Chernigov', 'slav_m'], smolensk: ['russia', 'Smolensk', 'Smolensk', 'russian_m'],
  polotsk: ['russia', 'Vitebsk', 'Vitebsk', 'russian_m'], novgorod: ['russia', 'St Petersburg', 'St Petersburg', 'russian_m'], pskov: ['russia', 'Pskov', 'Pskov', 'russian_m'],
  vladimir: ['russia', 'Moscow', 'Moscow', 'russian_m'], rostov: ['russia', 'Yaroslavl', 'Yaroslavl', 'russian_m'], murom: ['russia', 'Nizhny Novgorod', 'Nizhny Novgorod', 'russian_m'],
  ryazan: ['russia', 'Tula', 'Tula', 'russian_m'], crimea: ['russia', 'Sevastopol', 'Taurida', 'russian_m'], zichia: ['russia', 'Yekaterinodar', 'Kuban', 'russian_m'],
  // Inner Asia
  almaliq: ['china', 'Kulja', 'Ili', 'turkestan_m'], balasagun: ['russia', 'Verny', 'Semirechye', 'turkestan_m'], kashgar: ['china', 'Kashgar', 'Kashgaria', 'turkestan_m'], khotan: ['china', 'Khotan', 'Khotan', 'turkestan_m'],
  qocho: ['china', 'Urumqi', 'Dzungaria', 'chinese_m'], hami: ['china', 'Hami', 'Kumul', 'turkestan_m'], shazhou: ['china', 'Dunhuang', 'Dunhuang', 'chinese_m'], ganzhou: ['china', 'Zhangye', 'Hexi', 'chinese_m'],
  liangzhou: ['china', 'Lanzhou', 'Gansu', 'chinese_m'], amdo: ['china', 'Xining', 'Qinghai', 'tibetan_m'], lhasa: ['tibet_m', 'Lhasa', 'Ü-Tsang', 'tibetan_m'], ngari: ['tibet_m', 'Gartok', 'Ngari', 'tibetan_m'],
  xingqing: ['china', 'Yinchuan', 'Ningxia', 'chinese_m'], gobi: ['mongolia_m', 'Uliastai', 'Gobi', 'mongol_m'], tula: ['mongolia_m', 'Urga', 'Outer Mongolia', 'mongol_m'],
  kherlen: ['mongolia_m', 'Kherlen', 'Kherlen', 'mongol_m'], selenga: ['mongolia_m', 'Kyakhta', 'Selenga', 'mongol_m'], buir: ['china', 'Hailar', 'Hulunbuir', 'mongol_m'],
  altai: ['mongolia_m', 'Kobdo', 'Khovd', 'mongol_m'], yenisei: ['russia', 'Krasnoyarsk', 'Yeniseysk', 'russian_m'], oirat: ['russia', 'Kyzyl', 'Uriankhai', 'mongol_m'], barga: ['russia', 'Irkutsk', 'Irkutsk', 'russian_m'],
  // China, Korea, Japan
  huining: ['china', 'Harbin', 'Heilongjiang', 'chinese_m'], liaoyang: ['china', 'Mukden', 'Fengtian', 'chinese_m'], zhongdu: ['china', 'Peking', 'Zhili', 'chinese_m'], datong: ['china', 'Kalgan', 'Chahar', 'chinese_m'],
  taiyuan: ['china', 'Taiyuan', 'Shanxi', 'chinese_m'], jinan: ['germany', 'Tsingtao', 'Kiautschou', 'chinese_m'], kaifeng: ['china', 'Kaifeng', 'Henan', 'chinese_m'], jingzhao: ['china', "Xi'an", 'Shaanxi', 'chinese_m'],
  hanzhong: ['china', 'Hanzhong', 'South Shaanxi', 'chinese_m'], chengdu: ['china', 'Chengdu', 'Sichuan', 'chinese_m'], xiangyang: ['china', 'Xiangyang', 'North Hubei', 'chinese_m'], ezhou: ['china', 'Wuhan', 'Hubei', 'chinese_m'],
  changsha: ['china', 'Changsha', 'Hunan', 'chinese_m'], jiankang: ['china', 'Nanking', 'Jiangsu', 'chinese_m'], linan: ['china', 'Shanghai', 'Zhejiang', 'chinese_m'], quanzhou: ['china', 'Fuzhou', 'Fujian', 'chinese_m'],
  guangzhou: ['china', 'Canton', 'Guangdong', 'chinese_m'], dali: ['china', 'Kunming', 'Yunnan', 'chinese_m'], thanglong: ['france', 'Hanoi', 'Tonkin', 'sea_m'], nghean: ['annam', 'Huế', 'Annam', 'sea_m'],
  pyongyang: ['japan', 'Pyongyang', 'Pyongan', 'korean_m'], kaesong: ['japan', 'Seoul', 'Gyeonggi', 'korean_m'], gyeongju: ['japan', 'Busan', 'Gyeongsang', 'korean_m'],
  kyoto: ['japan', 'Osaka', 'Kansai', 'japanese_m'], kamakura: ['japan', 'Tokyo', 'Kantō', 'japanese_m'], dazaifu: ['japan', 'Fukuoka', 'Kyūshū', 'japanese_m'], hiraizumi: ['japan', 'Sendai', 'Tōhoku', 'japanese_m'],
  // South-East Asia
  champa: ['annam', 'Qui Nhơn', 'South Annam', 'sea_m'], angkor: ['france', 'Saigon', 'Cochinchina', 'sea_m'], lavo: ['siam', 'Bangkok', 'Central Siam', 'sea_m'],
  lanna: ['siam', 'Chiang Mai', 'Lanna', 'sea_m'], pegu: ['uk', 'Rangoon', 'Lower Burma', 'sea_m'], pagan: ['uk', 'Mandalay', 'Upper Burma', 'sea_m'], arakan: ['uk', 'Akyab', 'Arakan', 'sea_m'],
  palembang: ['netherlands', 'Palembang', 'Sumatra', 'sea_m'], kedah: ['uk', 'Penang', 'Malaya', 'sea_m'], kediri: ['netherlands', 'Batavia', 'Java', 'sea_m'],
  // India
  kashmir: ['kashmir_m', 'Srinagar', 'Kashmir', 'indian_m'], lahore: ['uk', 'Lahore', 'Punjab', 'indian_m'], multan: ['uk', 'Multan', 'Multan', 'indian_m'],
  saltrange: ['uk', 'Rawalpindi', 'Rawalpindi', 'indian_m'], turan: ['uk', 'Quetta', 'Baluchistan', 'afghan_m'], makran: ['uk', 'Kalat', 'Makran', 'afghan_m'],
  thar: ['rajputana', 'Bikaner', 'Bikaner', 'indian_m'], marwar: ['rajputana', 'Jodhpur', 'Marwar', 'indian_m'], sehwan: ['uk', 'Sukkur', 'Upper Sind', 'indian_m'], thatta: ['uk', 'Karachi', 'Sind', 'indian_m'],
  ajmer: ['rajputana', 'Jaipur', 'Jaipur', 'indian_m'], ranthambore: ['rajputana', 'Udaipur', 'Mewar', 'indian_m'], gujarat: ['uk', 'Ahmedabad', 'Gujarat', 'indian_m'], saurashtra: ['uk', 'Rajkot', 'Kathiawar', 'indian_m'],
  delhi: ['uk', 'Delhi', 'Delhi', 'indian_m'], kannauj: ['uk', 'Lucknow', 'Oudh', 'indian_m'], gwalior: ['uk', 'Gwalior', 'Gwalior', 'indian_m'],
  varanasi: ['uk', 'Benares', 'Benares', 'indian_m'], kalinjar: ['uk', 'Jhansi', 'Bundelkhand', 'indian_m'], tripuri: ['uk', 'Jubbulpore', 'Central Provinces', 'indian_m'],
  malwa: ['uk', 'Indore', 'Malwa', 'indian_m'], bihar: ['uk', 'Patna', 'Bihar', 'indian_m'], bengal: ['uk', 'Calcutta', 'Bengal', 'indian_m'],
  devagiri: ['hyderabad', 'Aurangabad', 'Marathwada', 'indian_m'], nasik: ['uk', 'Poona', 'Deccan', 'indian_m'], konkan: ['uk', 'Bombay', 'Bombay', 'indian_m'],
  warangal: ['hyderabad', 'Hyderabad', 'Telangana', 'indian_m'], vengi: ['uk', 'Vizagapatam', 'Northern Circars', 'indian_m'], kalinga: ['uk', 'Cuttack', 'Orissa', 'indian_m'],
  bastar: ['uk', 'Jagdalpur', 'Bastar', 'indian_m'], dwarasamudra: ['mysore', 'Mysore', 'Mysore', 'indian_m'], kanchi: ['uk', 'Madras', 'Madras', 'indian_m'],
  thanjavur: ['uk', 'Tanjore', 'Tanjore', 'indian_m'], madurai: ['uk', 'Madura', 'Madura', 'indian_m'], kerala: ['uk', 'Calicut', 'Malabar', 'indian_m'],
  lanka: ['uk', 'Colombo', 'Ceylon', 'indian_m'],
};

const r = (id, name, short, color, capital, ruler, extra = {}) => ({ id, name, short, color, capital, ruler, seats: extra.seats, generals: extra.generals ?? [], heir: extra.heir, fa: extra.fa ?? '', dynasty: extra.dynasty ?? short, lineage: extra.lineage ?? [], plural: extra.plural, nomad: extra.nomad, elective: extra.elective, overlord: extra.overlord, levy: extra.levy, court: extra.court });
const k = (name, title, born, since, traits, skill = 3) => ({ name, title, born, since, traits, skill });
const g = (name, skill, traits, at, born, title) => ({ name, skill, traits, at, born, title });

const REALMS = [
  // the great powers
  r('uk', 'British Empire', 'Britain', '#d0657a', 'london', k('George V', 'King', 1865, 1910, ['steadfast', 'cautious'], 3), { seats: ['delhi', 'bengal', 'konkan', 'kanchi', 'pegu', 'kedah', 'soba', 'mombasa', 'ife', 'zimbabwe'], dynasty: 'Saxe-Coburg', fa: 'Britannia', heir: { name: 'Edward', title: 'Prince', born: 1894, traits: ['restless', 'proud'], relation: 'son' },
    generals: [g('John French', 3, ['proud'], 'london', 1852, 'Field Marshal'), g('Douglas Haig', 3, ['steadfast', 'cruel'], 'london', 1861, 'General'), g('Horatio Kitchener', 4, ['steadfast'], 'soba', 1850, 'Field Marshal'),
      g('Charles Townshend', 3, ['ambitious', 'bold'], 'konkan', 1861, 'General'), g('Edmund Allenby', 4, ['bold'], 'delhi', 1861, 'General')] }),
  r('france', 'French Republic', 'France', '#3d5fa8', 'paris', k('Raymond Poincaré', 'President', 1860, 1913, ['shrewd', 'proud'], 3), { elective: true, seats: ['bejaia', 'takrur', 'kangaba', 'angkor'], fa: 'République française', dynasty: 'Third Republic',
    generals: [g('Joseph Joffre', 4, ['steadfast'], 'champagne', 1852, 'General'), g('Ferdinand Foch', 5, ['bold'], 'burgundy', 1851, 'General'), g('Philippe Pétain', 4, ['cautious'], 'paris', 1856, 'General'),
      g('Joseph Gallieni', 4, ['shrewd'], 'paris', 1849, 'General'), g('Hubert Lyautey', 4, ['shrewd'], 'tlemcen', 1854, 'General')] }),
  r('germany', 'German Empire', 'Germany', '#6a6a6a', 'brandenburg', k('Wilhelm II', 'Kaiser', 1859, 1888, ['proud', 'restless'], 2), { dynasty: 'Hohenzollern', fa: 'Deutsches Reich', seats: ['kilwa', 'jinan', 'njimi'], heir: { name: 'Wilhelm', title: 'Crown Prince', born: 1882, traits: ['proud', 'bold'], relation: 'son' },
    generals: [g('Helmuth von Moltke', 3, ['cautious'], 'cologne', 1848, 'General'), g('Paul von Hindenburg', 5, ['steadfast'], 'prussia', 1847, 'Field Marshal'), g('Erich Ludendorff', 5, ['ambitious', 'scheming'], 'cologne', 1865, 'General'),
      g('Erich von Falkenhayn', 4, ['cruel'], 'lorraine', 1861, 'General'), { ...g('Wilhelm', 2, ['proud'], 'alsace'), heir: true }, g('Paul von Lettow-Vorbeck', 5, ['bold'], 'kilwa', 1870, 'Colonel'),
      g('Alfred Meyer-Waldeck', 2, ['steadfast'], 'jinan', 1864, 'Captain')] }),
  r('austria', 'Austria-Hungary', 'Austria', '#c9a84a', 'austria', k('Franz Joseph', 'Emperor', 1830, 1848, ['steadfast', 'cautious'], 2), { dynasty: 'Habsburg', fa: 'Österreich-Ungarn', heir: { name: 'Franz Ferdinand', title: 'Archduke', born: 1863, traits: ['proud', 'cautious'], relation: 'nephew' },
    generals: [g('Franz Conrad von Hötzendorf', 3, ['ambitious', 'bold'], 'austria', 1852, 'General'), g('Oskar Potiorek', 2, ['proud'], 'dalmatia', 1853, 'General'), g('Svetozar Boroević', 4, ['steadfast'], 'croatia', 1856, 'General'),
      g('Archduke Karl', 3, ['wise'], 'hungary', 1887, 'Archduke')] }),
  r('russia', 'Russian Empire', 'Russia', '#5e8f4e', 'novgorod', k('Nicholas II', 'Tsar', 1868, 1894, ['timid', 'steadfast'], 2), { dynasty: 'Romanov', fa: 'Россія', levy: 1.15, seats: ['vladimir', 'kiev', 'kartli', 'shash', 'barga'], heir: { name: 'Alexei', title: 'Tsarevich', born: 1904, traits: ['ailing'], relation: 'son' },
    generals: [g('Grand Duke Nicholas', 3, ['proud'], 'masovia', 1856, 'Grand Duke'), g('Alexei Brusilov', 5, ['bold'], 'volhynia', 1853, 'General'), g('Alexander Samsonov', 2, ['bold'], 'lithuania', 1859, 'General'),
      g('Paul von Rennenkampf', 2, ['cautious'], 'livonia', 1854, 'General'), g('Nikolai Yudenich', 4, ['steadfast'], 'kartli', 1862, 'General'), g('Mikhail Alekseyev', 4, ['wise'], 'kiev', 1857, 'General')] }),
  r('italy', 'Kingdom of Italy', 'Italy', '#4a9a5e', 'rome', k('Victor Emmanuel III', 'King', 1869, 1900, ['cautious', 'shrewd'], 3), { dynasty: 'Savoy', fa: 'Italia', seats: ['tripolitania'], heir: { name: 'Umberto', title: 'Prince', born: 1904, traits: ['proud'], relation: 'son' },
    generals: [g('Luigi Cadorna', 3, ['cruel', 'proud'], 'venice', 1850, 'General'), g('Armando Diaz', 4, ['steadfast'], 'milan', 1861, 'General'), g('Pietro Badoglio', 3, ['ambitious'], 'tripolitania', 1871, 'General')] }),
  r('ottoman', 'Ottoman Empire', 'Ottomans', '#9a3030', 'constantinople', k('Mehmed V', 'Sultan', 1844, 1909, ['timid'], 1), { plural: true, seats: ['damascus', 'baghdad', 'erzurum'], dynasty: 'House of Osman', fa: 'Devlet-i Aliyye', heir: { name: 'Mehmed Vahideddin', title: 'Prince', born: 1861, traits: ['scheming'], relation: 'brother' },
    generals: [g('Mustafa Kemal', 5, ['bold', 'proud'], 'thrace', 1881, 'Colonel'), g('Djemal Pasha', 3, ['cruel'], 'damascus', 1872, 'Pasha'), g('Otto Liman von Sanders', 4, ['steadfast'], 'constantinople', 1855, 'General'),
      g('Halil Kut', 3, ['bold'], 'baghdad', 1882, 'Pasha'), g('Fahreddin Pasha', 3, ['steadfast'], 'karak', 1868, 'Pasha')] }),
  r('japan', 'Empire of Japan', 'Japan', '#c44a3a', 'kamakura', k('Taishō', 'Emperor', 1879, 1912, ['ailing', 'timid'], 1), { dynasty: 'Yamato', fa: '大日本帝國', seats: ['kaesong'], heir: { name: 'Hirohito', title: 'Crown Prince', born: 1901, traits: ['cautious', 'wise'], relation: 'son' },
    generals: [g('Kamio Mitsuomi', 3, ['cautious'], 'dazaifu', 1856, 'General'), g('Akashi Motojiro', 3, ['scheming'], 'kaesong', 1864, 'General'), g('Tōgō Heihachirō', 5, ['steadfast'], 'kamakura', 1848, 'Admiral')] }),
  r('china', 'Republic of China', 'China', '#d9a53a', 'zhongdu', k('Yuan Shikai', 'President', 1859, 1912, ['ambitious', 'scheming'], 4), { fa: '中華民國', dynasty: 'Beiyang', seats: ['jiankang', 'chengdu', 'qocho', 'guangzhou'],
    generals: [g('Duan Qirui', 3, ['ambitious'], 'zhongdu', 1865), g('Feng Guozhang', 3, ['cautious'], 'jiankang', 1859), g('Cao Kun', 2, ['greedy'], 'kaifeng', 1862), g('Zhang Zuolin', 3, ['ambitious', 'scheming'], 'liaoyang', 1875),
      g('Cai E', 4, ['bold', 'just'], 'dali', 1882), g('Yang Zengxin', 3, ['shrewd'], 'qocho', 1864)] }),
  // the rest of Europe
  r('spain', 'Kingdom of Spain', 'Spain', '#d6a94e', 'toledo', k('Alfonso XIII', 'King', 1886, 1886, ['proud', 'shrewd'], 3), { dynasty: 'Bourbon', fa: 'España', heir: { name: 'Alfonso', title: 'Prince', born: 1907, traits: ['ailing'], relation: 'son' },
    generals: [g('Miguel Primo de Rivera', 3, ['ambitious'], 'seville', 1870, 'General'), g('Dámaso Berenguer', 3, ['cautious'], 'granada', 1873, 'General')] }),
  r('portugal', 'Portuguese Republic', 'Portugal', '#3f7f46', 'lisbon', k('Manuel de Arriaga', 'President', 1840, 1911, ['wise'], 2), { elective: true, seats: ['sofala'], fa: 'Portugal', dynasty: 'First Republic',
    generals: [g('Sidónio Pais', 3, ['ambitious'], 'lisbon', 1872, 'Major'), g('Fernando Tamagnini', 2, ['steadfast'], 'portugal', 1856, 'General'), g('Pereira de Eça', 3, ['bold'], 'sofala', 1852, 'General')] }),
  r('netherlands', 'Kingdom of the Netherlands', 'Netherlands', '#e0812e', 'frisia', k('Wilhelmina', 'Queen', 1880, 1890, ['steadfast', 'wise'], 3), { dynasty: 'Orange-Nassau', fa: 'Nederland', seats: ['kediri'], heir: { name: 'Juliana', title: 'Princess', born: 1909, traits: ['just'], relation: 'daughter' },
    generals: [g('Cornelis Snijders', 2, ['cautious'], 'frisia', 1852, 'General'), g('Johan van Heutsz', 3, ['cruel'], 'kediri', 1851, 'General')] }),
  r('belgium', 'Kingdom of Belgium', 'Belgium', '#b39a35', 'flanders', k('Albert I', 'King', 1875, 1909, ['bold', 'just'], 4), { dynasty: 'Saxe-Coburg', fa: 'Belgique', heir: { name: 'Leopold', title: 'Prince', born: 1901, traits: ['proud'], relation: 'son' },
    generals: [g('Gérard Leman', 3, ['steadfast'], 'flanders', 1851, 'General')] }),
  r('denmark', 'Kingdom of Denmark', 'Denmark', '#b03a44', 'zealand', k('Christian X', 'King', 1870, 1912, ['proud', 'steadfast'], 3), { dynasty: 'Glücksburg', fa: 'Danmark', heir: { name: 'Frederik', title: 'Crown Prince', born: 1899, traits: ['restless'], relation: 'son' } }),
  r('sweden', 'Kingdom of Sweden', 'Sweden', '#3a6ab0', 'uppland', k('Gustaf V', 'King', 1858, 1907, ['cautious'], 3), { dynasty: 'Bernadotte', fa: 'Sverige', heir: { name: 'Gustaf Adolf', title: 'Crown Prince', born: 1882, traits: ['wise'], relation: 'son' } }),
  r('norway', 'Kingdom of Norway', 'Norway', '#8a3a5a', 'viken', k('Haakon VII', 'King', 1872, 1905, ['steadfast', 'just'], 3), { dynasty: 'Glücksburg', fa: 'Norge', heir: { name: 'Olav', title: 'Crown Prince', born: 1903, traits: ['bold'], relation: 'son' } }),
  r('serbia', 'Kingdom of Serbia', 'Serbia', '#9a4466', 'ras', k('Peter I', 'King', 1844, 1903, ['steadfast'], 3), { dynasty: 'Karađorđević', fa: 'Србија', levy: 2.4, heir: { name: 'Alexander', title: 'Prince', born: 1888, traits: ['ambitious', 'bold'], relation: 'son' },
    generals: [g('Radomir Putnik', 5, ['steadfast', 'wise'], 'ras', 1847, 'Vojvoda'), g('Živojin Mišić', 4, ['bold'], 'ras', 1855, 'General'), g('Dragutin Dimitrijević', 3, ['scheming'], 'ras', 1876, 'Colonel')],
    court: [{ name: 'Nikola Pašić', role: 'prime minister', born: 1845 }] }),
  r('bulgaria', 'Kingdom of Bulgaria', 'Bulgaria', '#5a9a6e', 'sofia', k('Ferdinand I', 'Tsar', 1861, 1887, ['shrewd', 'scheming'], 3), { dynasty: 'Saxe-Coburg', fa: 'България', levy: 1.5, heir: { name: 'Boris', title: 'Prince', born: 1894, traits: ['cautious'], relation: 'son' },
    generals: [g('Nikola Žekov', 3, ['steadfast'], 'sofia', 1864, 'General')] }),
  r('romania', 'Kingdom of Romania', 'Romania', '#c9a23a', 'wallachia', k('Carol I', 'King', 1839, 1866, ['wise', 'cautious'], 3), { dynasty: 'Hohenzollern-Sigmaringen', fa: 'România', levy: 1.5, heir: { name: 'Ferdinand', title: 'Crown Prince', born: 1865, traits: ['timid'], relation: 'nephew' },
    generals: [g('Alexandru Averescu', 4, ['ambitious'], 'wallachia', 1859, 'General')] }),
  r('greece', 'Kingdom of Greece', 'Greece', '#4a86c0', 'hellas', k('Constantine I', 'King', 1868, 1913, ['proud', 'bold'], 4), { dynasty: 'Glücksburg', fa: 'Ελλάς', heir: { name: 'George', title: 'Crown Prince', born: 1890, traits: ['cautious'], relation: 'son' },
    generals: [g('Panagiotis Danglis', 3, ['steadfast'], 'thessalonica', 1853, 'General')], court: [{ name: 'Eleftherios Venizelos', role: 'statesman', born: 1864 }] }),
  r('albania_m', 'Principality of Albania', 'Albania', '#a0523a', 'epirus', k('Wilhelm of Wied', 'Prince', 1876, 1914, ['timid'], 1), { fa: 'Shqipëria', dynasty: 'Wied' }),
  // the Middle East and Asia
  r('persia', 'Persia', 'Persia', '#3f9a8a', 'rey', k('Ahmad Shah', 'Shah', 1898, 1909, ['timid'], 1), { dynasty: 'Qajar', fa: 'ایران',
    generals: [g('Reza Khan', 4, ['ambitious', 'bold'], 'rey', 1878, 'Colonel'), g('Sheikh Khazal', 2, ['greedy'], 'khuzestan', 1863, 'Sheikh')] }),
  r('afghanistan', 'Emirate of Afghanistan', 'Afghanistan', '#7a6a3a', 'kabul', k('Habibullah Khan', 'Emir', 1872, 1901, ['cautious', 'shrewd'], 3), { dynasty: 'Barakzai', fa: 'افغانستان', heir: { name: 'Amanullah Khan', title: 'Prince', born: 1892, traits: ['bold', 'ambitious'], relation: 'son' },
    generals: [g('Nadir Khan', 4, ['ambitious'], 'kandahar', 1883, 'General')] }),
  r('nejd', 'Emirate of Nejd and Hasa', 'Nejd', '#9a7a4a', 'najd', k('Ibn Saud', 'Emir', 1875, 1902, ['ambitious', 'shrewd', 'bold'], 5), { nomad: true, dynasty: 'Saud', fa: 'نجد', heir: { name: 'Turki', title: 'Prince', born: 1900, traits: ['bold'], relation: 'son' },
    generals: [g('Faisal al-Duwaish', 3, ['cruel', 'bold'], 'najd', 1882, 'Sheikh')] }),
  r('hejaz', 'Hejaz', 'Hejaz', '#4f8a4a', 'hejaz', k('Hussein bin Ali', 'Emir', 1854, 1908, ['proud', 'ambitious'], 3), { overlord: 'ottoman', dynasty: 'Hashemite', fa: 'الحجاز', heir: { name: 'Ali bin Hussein', title: 'Prince', born: 1879, traits: ['cautious'], relation: 'son' },
    generals: [g('Faisal bin Hussein', 4, ['bold', 'shrewd'], 'yanbu', 1885, 'Prince'), g('Abdullah bin Hussein', 3, ['shrewd'], 'hejaz', 1882, 'Prince')] }),
  r('yemen_m', 'Yemen', 'Yemen', '#7a4a4a', 'sanaa', k('Yahya Muhammad Hamid ed-Din', 'King', 1869, 1904, ['shrewd', 'steadfast'], 3), { overlord: 'ottoman', fa: 'اليمن', dynasty: 'Hamid ed-Din' }),
  r('oman_m', 'Muscat and Oman', 'Oman', '#b0503a', 'sohar', k('Taimur bin Feisal', 'Sultan', 1886, 1913, ['timid'], 2), { fa: 'عُمان', dynasty: 'Al Said' }),
  r('egypt', 'Khedivate of Egypt', 'Egypt', '#c9b06a', 'cairo', k('Abbas II', 'Khedive', 1874, 1892, ['proud', 'scheming'], 2), { overlord: 'uk', dynasty: 'House of Muhammad Ali', fa: 'مصر' }),
  r('morocco', 'Sultanate of Morocco', 'Morocco', '#9a3a3a', 'fez', k('Yusef', 'Sultan', 1882, 1912, ['cautious'], 2), { overlord: 'france', dynasty: 'Alawi', fa: 'المغرب' }),
  r('tunisia', 'Beylik of Tunis', 'Tunisia', '#6a5aa0', 'tunis', k('Muhammad V an-Nasir', 'Bey', 1855, 1906, ['timid'], 1), { overlord: 'france', dynasty: 'Husainid', fa: 'تونس' }),
  r('ethiopia', 'Ethiopian Empire', 'Ethiopia', '#2f8a3a', 'shewa', k('Lij Iyasu', 'Emperor', 1895, 1913, ['restless', 'proud'], 2), { fa: 'ኢትዮጵያ', dynasty: 'Shewan line',
    generals: [g('Habte Giyorgis', 4, ['steadfast'], 'shewa', 1851, 'Fitawrari'), g('Tafari Makonnen', 3, ['shrewd', 'ambitious'], 'shewa', 1892, 'Dejazmach'), g('Ras Mikael', 3, ['bold'], 'roha', 1850, 'Negus')] }),
  r('southafrica', 'Union of South Africa', 'South Africa', '#5a9a5a', 'mapungubwe', k('Louis Botha', 'Prime Minister', 1862, 1910, ['shrewd', 'steadfast'], 4), { overlord: 'uk', elective: true, fa: 'Suid-Afrika', dynasty: 'the Union',
    generals: [g('Jan Smuts', 4, ['wise', 'shrewd'], 'mapungubwe', 1870, 'General'), g('Christiaan de Wet', 3, ['bold', 'proud'], 'mapungubwe', 1854, 'General')] }),
  r('hyderabad', 'Hyderabad', 'Hyderabad', '#9a6a2a', 'warangal', k('Osman Ali Khan', 'Nizam', 1886, 1911, ['greedy', 'shrewd'], 3), { overlord: 'uk', dynasty: 'Asaf Jahi', fa: 'حیدرآباد' }),
  r('mysore', 'Kingdom of Mysore', 'Mysore', '#6a8a2a', 'dwarasamudra', k('Krishnaraja Wadiyar IV', 'Maharaja', 1884, 1894, ['wise', 'just'], 3), { overlord: 'uk', dynasty: 'Wadiyar', fa: 'ಮೈಸೂರು' }),
  r('kashmir_m', 'Jammu and Kashmir', 'Kashmir', '#4a6a8a', 'kashmir', k('Pratap Singh', 'Maharaja', 1848, 1885, ['cautious'], 2), { overlord: 'uk', dynasty: 'Dogra', fa: 'کشمیر', heir: { name: 'Hari Singh', title: 'Prince', born: 1895, traits: ['proud'], relation: 'nephew' } }),
  r('rajputana', 'Rajputana States', 'Rajputana', '#c0703a', 'thar', k('Ganga Singh', 'Maharaja', 1880, 1887, ['bold', 'shrewd'], 4), { overlord: 'uk', dynasty: 'Rathore', fa: 'राजपूताना' }),
  r('khiva_k', 'Khanate of Khiva', 'Khiva', '#8aa04a', 'khiva', k('Asfandiyar Khan', 'Khan', 1871, 1910, ['cruel', 'timid'], 2), { overlord: 'russia', dynasty: 'Qungrat', fa: 'خیوه',
    generals: [g('Junaid Khan', 3, ['bold', 'cruel'], 'gurganj', 1857, 'Chief')] }),
  r('bukhara_k', 'Emirate of Bukhara', 'Bukhara', '#a07a4a', 'bukhara', k('Alim Khan', 'Emir', 1880, 1910, ['greedy', 'cautious'], 2), { overlord: 'russia', dynasty: 'Manghit', fa: 'بخارا' }),
  r('siam', 'Kingdom of Siam', 'Siam', '#8a5aa0', 'lavo', k('Vajiravudh', 'King', 1881, 1910, ['proud', 'wise'], 3), { dynasty: 'Chakri', fa: 'สยาม', heir: { name: 'Prajadhipok', title: 'Prince', born: 1893, traits: ['cautious'], relation: 'brother' } }),
  r('annam', 'Empire of Annam', 'Annam', '#a04a3a', 'nghean', k('Duy Tân', 'Emperor', 1900, 1907, ['bold', 'just'], 2), { overlord: 'france', dynasty: 'Nguyễn', fa: 'Đại Nam' }),
  r('mongolia_m', 'Bogd Khanate of Mongolia', 'Mongolia', '#5a7ab8', 'tula', k('Bogd Khan', 'Khan', 1869, 1911, ['shrewd'], 2), { nomad: true, fa: 'Монгол', dynasty: 'Bogd',
    generals: [g('Manlaibaatar Damdinsüren', 3, ['bold'], 'tula', 1871), g('Khatanbaatar Magsarjav', 4, ['bold'], 'altai', 1877)] }),
  r('tibet_m', 'Tibet', 'Tibet', '#b08a5a', 'lhasa', k('Thubten Gyatso', 'Ruler', 1876, 1895, ['wise', 'shrewd'], 3), { fa: 'བོད', dynasty: 'Ganden Phodrang',
    generals: [g('Tsarong Dazang Dramdul', 3, ['bold', 'shrewd'], 'lhasa', 1888, 'Commander')] }),
];
const rid = new Set(REALMS.map((x) => x.id));
for (const [pid, [owner]] of Object.entries(P)) if (owner && !rid.has(owner)) throw new Error(`1914: ${pid} is held by ${owner}, which is not a realm`);
for (const p of PROVINCES) if (!P[p.id]) throw new Error(`1914: no owner given for ${p.id}`);

const PEOPLE = {
  uk: { ruler: 'just', heir: 'hedonist', consort: { name: 'Mary of Teck', born: 1867, temper: 'devoted', title: 'Queen' }, vizier: { name: 'H. H. Asquith', born: 1852, temper: 'able', title: 'Prime Minister' },
    generals: { 'John French': 'cautious', 'Douglas Haig': 'butcher', 'Horatio Kitchener': 'steady', 'Charles Townshend': 'loyal', 'Edmund Allenby': 'loyal' } },
  france: { ruler: 'diplomat', generals: { 'Joseph Joffre': 'steady', 'Ferdinand Foch': 'glory', 'Philippe Pétain': 'cautious', 'Joseph Gallieni': 'loyal', 'Hubert Lyautey': 'steady' } },
  germany: { ruler: 'paranoid', heir: 'conqueror', consort: { name: 'Augusta Victoria', born: 1858, temper: 'devoted', title: 'Empress' }, vizier: { name: 'Theobald von Bethmann Hollweg', born: 1856, temper: 'loyal', title: 'Chancellor' },
    generals: { 'Helmuth von Moltke': 'cautious', 'Paul von Hindenburg': 'steady', 'Erich Ludendorff': 'glory', 'Erich von Falkenhayn': 'butcher', 'Paul von Lettow-Vorbeck': 'loyal', 'Alfred Meyer-Waldeck': 'loyal' } },
  austria: { ruler: 'just', heir: 'reformer', vizier: { name: 'Leopold Berchtold', born: 1863, temper: 'loyal', title: 'Foreign Minister' },
    generals: { 'Franz Conrad von Hötzendorf': 'glory', 'Oskar Potiorek': 'cautious', 'Svetozar Boroević': 'steady', 'Archduke Karl': 'loyal' } },
  russia: { ruler: 'negligent', heir: 'just', consort: { name: 'Alexandra Feodorovna', born: 1872, temper: 'schemer', title: 'Empress' }, vizier: { name: 'Ivan Goremykin', born: 1839, temper: 'corrupt', title: 'Prime Minister' },
    generals: { 'Grand Duke Nicholas': 'steady', 'Alexei Brusilov': 'glory', 'Alexander Samsonov': 'loyal', 'Paul von Rennenkampf': 'cautious', 'Nikolai Yudenich': 'steady', 'Mikhail Alekseyev': 'loyal' } },
  italy: { ruler: 'diplomat', consort: { name: 'Elena of Montenegro', born: 1873, temper: 'devoted', title: 'Queen' }, vizier: { name: 'Antonio Salandra', born: 1853, temper: 'able', title: 'Prime Minister' },
    generals: { 'Luigi Cadorna': 'butcher', 'Armando Diaz': 'steady', 'Pietro Badoglio': 'glory' } },
  ottoman: { ruler: 'negligent', heir: 'paranoid', vizier: { name: 'Enver Pasha', born: 1881, temper: 'kingmaker', title: 'War Minister' },
    generals: { 'Mustafa Kemal': 'glory', 'Djemal Pasha': 'butcher', 'Otto Liman von Sanders': 'steady', 'Halil Kut': 'steady', 'Fahreddin Pasha': 'loyal' } },
  japan: { ruler: 'negligent', heir: 'conqueror', consort: { name: 'Teimei', born: 1884, temper: 'regent', title: 'Empress' }, vizier: { name: 'Ōkuma Shigenobu', born: 1838, temper: 'able', title: 'Prime Minister' },
    generals: { 'Kamio Mitsuomi': 'loyal', 'Akashi Motojiro': 'loyal', 'Tōgō Heihachirō': 'loyal' } },
  china: { ruler: 'tyrant', vizier: { name: 'Xu Shichang', born: 1855, temper: 'able', title: 'Secretary of State' },
    generals: { 'Duan Qirui': 'treacherous', 'Feng Guozhang': 'cautious', 'Cao Kun': 'mercenary', 'Zhang Zuolin': 'treacherous', 'Cai E': 'treacherous', 'Yang Zengxin': 'steady' } },
  spain: { ruler: 'hedonist', consort: { name: 'Victoria Eugenie', born: 1887, temper: 'devoted', title: 'Queen' }, vizier: { name: 'Eduardo Dato', born: 1856, temper: 'able', title: 'Prime Minister' },
    generals: { 'Miguel Primo de Rivera': 'treacherous', 'Dámaso Berenguer': 'steady' } },
  portugal: { ruler: 'diplomat', generals: { 'Sidónio Pais': 'treacherous', 'Fernando Tamagnini': 'loyal', 'Pereira de Eça': 'steady' } },
  netherlands: { ruler: 'diplomat', consort: { name: 'Hendrik', born: 1876, temper: 'devoted', title: 'Prince consort' }, generals: { 'Cornelis Snijders': 'cautious', 'Johan van Heutsz': 'butcher' } },
  belgium: { ruler: 'just', consort: { name: 'Elisabeth of Bavaria', born: 1876, temper: 'devoted', title: 'Queen' }, generals: { 'Gérard Leman': 'loyal' } },
  denmark: { ruler: 'diplomat', consort: { name: 'Alexandrine', born: 1879, temper: 'devoted', title: 'Queen' } },
  sweden: { ruler: 'diplomat', consort: { name: 'Victoria of Baden', born: 1862, temper: 'devoted', title: 'Queen' } },
  norway: { ruler: 'just', consort: { name: 'Maud', born: 1869, temper: 'devoted', title: 'Queen' } },
  serbia: { ruler: 'just', heir: 'conqueror', generals: { 'Radomir Putnik': 'steady', 'Živojin Mišić': 'glory', 'Dragutin Dimitrijević': 'treacherous' } },
  bulgaria: { ruler: 'diplomat', consort: { name: 'Eleonore Reuss', born: 1860, temper: 'devoted', title: 'Tsaritsa' }, generals: { 'Nikola Žekov': 'steady' } },
  romania: { ruler: 'diplomat', heir: 'negligent', consort: { name: 'Elisabeth of Wied', born: 1843, temper: 'devoted', title: 'Queen' }, generals: { 'Alexandru Averescu': 'glory' } },
  greece: { ruler: 'paranoid', consort: { name: 'Sophia of Prussia', born: 1870, temper: 'schemer', title: 'Queen' }, generals: { 'Panagiotis Danglis': 'loyal' } },
  albania_m: { ruler: 'negligent', consort: { name: 'Sophie of Schönburg', born: 1885, temper: 'devoted', title: 'Princess' } },
  persia: { ruler: 'hedonist', vizier: { name: 'Mostowfi ol-Mamalek', born: 1871, temper: 'able', title: 'Prime Minister' }, generals: { 'Reza Khan': 'treacherous', 'Sheikh Khazal': 'mercenary' } },
  afghanistan: { ruler: 'diplomat', heir: 'reformer', vizier: { name: 'Nasrullah Khan', born: 1874, temper: 'kingmaker', title: 'Naib' }, generals: { 'Nadir Khan': 'treacherous' } },
  nejd: { ruler: 'conqueror', generals: { 'Faisal al-Duwaish': 'treacherous' } },
  hejaz: { ruler: 'conqueror', generals: { 'Faisal bin Hussein': 'glory', 'Abdullah bin Hussein': 'loyal' } },
  yemen_m: { ruler: 'miser' }, oman_m: { ruler: 'negligent' }, egypt: { ruler: 'paranoid' }, morocco: { ruler: 'negligent' }, tunisia: { ruler: 'negligent' },
  ethiopia: { ruler: 'hedonist', generals: { 'Habte Giyorgis': 'loyal', 'Tafari Makonnen': 'treacherous', 'Ras Mikael': 'loyal' } },
  southafrica: { ruler: 'diplomat', generals: { 'Jan Smuts': 'loyal', 'Christiaan de Wet': 'treacherous' } },
  hyderabad: { ruler: 'miser' }, mysore: { ruler: 'builder' }, kashmir_m: { ruler: 'negligent' }, rajputana: { ruler: 'builder' },
  khiva_k: { ruler: 'tyrant', generals: { 'Junaid Khan': 'treacherous' } }, bukhara_k: { ruler: 'hedonist' },
  siam: { ruler: 'reformer' }, annam: { ruler: 'reformer' }, mongolia_m: { ruler: 'hedonist', consort: { name: 'Dondogdulam', born: 1876, temper: 'schemer', title: 'Queen' } }, tibet_m: { ruler: 'reformer' },
};

// What the world of 1914 already knows, and who knows it.
const ALL = REALMS.map((x) => x.id);
const GREAT = ['uk', 'france', 'germany', 'austria', 'russia', 'italy', 'japan'];
const EUROPE = [...GREAT, 'spain', 'portugal', 'netherlands', 'belgium', 'denmark', 'sweden', 'norway', 'serbia', 'bulgaria', 'romania', 'greece', 'ottoman'];
const KNOWN = {
  paper: ALL, gunpowder: ALL, compass: ALL, printing: ALL, windmill: ALL, rotation: ALL, steel: ALL,
  credit: [...EUROPE, 'egypt', 'southafrica'], observatory: [...EUROPE, 'china'],
  railways: [...EUROPE, 'china', 'egypt', 'southafrica', 'hyderabad', 'mysore', 'rajputana', 'siam', 'persia'],
  machineguns: [...EUROPE, 'china', 'southafrica'],
  artillery: [...GREAT, 'ottoman', 'serbia', 'bulgaria', 'romania', 'greece', 'spain', 'belgium'],
  industry: ['uk', 'france', 'germany', 'belgium', 'netherlands', 'austria', 'italy', 'japan', 'sweden', 'russia'],
  aircraft: ['uk', 'france', 'germany', 'russia', 'italy', 'austria'],
  radio: ['uk', 'france', 'germany', 'italy', 'russia', 'japan', 'austria'],
  tanks: [],
};

// The great railways and sea lanes: Berlin to Baghdad, the Danube, the road to India by Suez, the Grand Trunk Road,
// Peking to Canton, and Japan's road into Korea and Manchuria.
const ROADS = [
  ['brandenburg', 'bohemia', 'austria', 'hungary', 'ras', 'sofia', 'thrace', 'constantinople', 'nicaea', 'konya', 'cilicia', 'aleppo', 'mosul', 'baghdad'],
  ['bavaria', 'austria', 'hungary', 'ras', 'wallachia', 'varna'],
  ['london', 'alexandria', 'cairo', 'aden', 'konkan', 'lanka', 'kedah'],
  ['peshawar', 'saltrange', 'lahore', 'delhi', 'kannauj', 'varanasi', 'bihar', 'bengal'],
  ['zhongdu', 'kaifeng', 'ezhou', 'changsha', 'guangzhou'],
  ['kamakura', 'kyoto', 'dazaifu', 'gyeongju', 'kaesong', 'pyongyang', 'liaoyang', 'huining'],
];

// What each province is worth in 1914 (1 to 6): coal, steel, ports and people. Unlisted provinces keep 1.
const WEALTH = {
  london: 6, york: 6, scotland: 4, wales: 3, ireland: 3,
  brandenburg: 6, cologne: 6, saxony: 5, silesia: 4, franconia: 4, bavaria: 4, swabia: 4, thuringia: 3, holstein: 4, alsace: 3, lorraine: 4, gniezno: 2, pomerania: 2, prussia: 2, jinan: 2, kilwa: 2,
  paris: 6, normandy: 4, champagne: 3, burgundy: 3, anjou: 3, brittany: 2, aquitaine: 3, toulouse: 3, provence: 4, bejaia: 2, tlemcen: 2, angkor: 2, thanglong: 2, takrur: 2,
  flanders: 6, frisia: 5, kediri: 4, palembang: 2, zealand: 3, jutland: 2, uppland: 3, gotaland: 3, scania: 2, viken: 2, bergen: 2,
  austria: 5, bohemia: 5, moravia: 3, hungary: 4, transylvania: 2, croatia: 2, dalmatia: 2, styria: 2, tyrol: 2, krakow: 2, halych: 2,
  milan: 5, genoa: 4, venice: 3, romagna: 3, tuscany: 3, rome: 3, naples: 3, apulia: 2, palermo: 2,
  toledo: 3, barcelona: 4, navarre: 3, valencia: 2, seville: 2, galicia: 2, burgos: 2, aragon: 2, murcia: 2, cordoba: 2, granada: 2, lisbon: 2, portugal: 2,
  novgorod: 5, vladimir: 5, kiev: 3, masovia: 3, cumania: 4, livonia: 2, estonia: 2, finland: 2, lithuania: 2, smolensk: 2, chernigov: 2, pereyaslavl: 2, volhynia: 2, crimea: 2, zichia: 2,
  rostov: 2, murom: 2, ryazan: 2, bulgar: 2, kartli: 3, shirvan: 4, samarkand: 2, shash: 2, ferghana: 3,
  ras: 2, sofia: 2, tarnovo: 2, wallachia: 3, hellas: 2, thessalonica: 2,
  constantinople: 4, smyrna: 3, thrace: 2, nicaea: 2, konya: 2, cilicia: 2, baghdad: 2, damascus: 2, aleppo: 2, tripoli: 2,
  cairo: 4, alexandria: 4, qus: 2, fez: 2, marrakesh: 2, tunis: 2, mapungubwe: 4, soba: 2, cyprus: 2, aden: 2,
  rey: 2, tabriz: 2, isfahan: 2, nishapur: 2, fars: 2, kabul: 2, herat: 2, kandahar: 2, bukhara: 2, gurganj: 2, shewa: 2,
  lahore: 4, multan: 2, peshawar: 2, saltrange: 2, thatta: 2, sehwan: 2, delhi: 4, gwalior: 2, kannauj: 4, varanasi: 3, bihar: 4, bengal: 5, kalinjar: 2, malwa: 3, gujarat: 4, saurashtra: 2,
  nasik: 3, konkan: 5, vengi: 3, kanchi: 4, thanjavur: 3, madurai: 3, kerala: 3, kalinga: 3, tripuri: 2, lanka: 3, warangal: 3, devagiri: 2, dwarasamudra: 3, kashmir: 2, marwar: 2, ajmer: 2, ranthambore: 2,
  pegu: 3, pagan: 2, kedah: 3, kano: 2, ife: 2, benin: 2, mombasa: 2, zimbabwe: 2, lavo: 3, nghean: 2,
  zhongdu: 4, linan: 5, jiankang: 4, guangzhou: 4, ezhou: 4, chengdu: 4, kaifeng: 3, jingzhao: 2, taiyuan: 2, liaoyang: 3, huining: 2, changsha: 3, quanzhou: 2, xiangyang: 2, hanzhong: 2, dali: 2,
  kamakura: 5, kyoto: 5, dazaifu: 3, hiraizumi: 2, kaesong: 2, gyeongju: 2,
};
const wealth = Object.fromEntries(PROVINCES.map((p) => [p.id, WEALTH[p.id] ?? 1]));

// The forts and fortress cities of 1914.
const WALLS = { paris: 4, champagne: 4, lorraine: 4, alsace: 3, burgundy: 3, flanders: 3, halych: 3, masovia: 3, krakow: 3, constantinople: 4, thrace: 3, jinan: 3, erzurum: 3, ras: 3, venice: 3, tyrol: 3, novgorod: 3, brandenburg: 3, austria: 3, london: 3, baghdad: 2, kamakura: 3 };
const names = Object.fromEntries(Object.entries(P).map(([pid, [, city, name]]) => [pid, { city, name, fa: city }]));
const cultures = Object.fromEntries(Object.entries(P).map(([pid, [, , , c]]) => [pid, c]));
const provinces = Object.fromEntries(Object.entries(P).map(([pid, [owner]]) => [pid, WALLS[pid] !== undefined ? { owner, walls: WALLS[pid] } : { owner }]));

export default {
  id: 'modern',
  name: 'The age of the world wars, 1914',
  start: 1914,
  months: 384,
  realms: REALMS,
  people: PEOPLE,
  provinces,
  names,
  cultures,
  wealth,
  wars: [],
  mods: { peaceAfter: 48, betrayal: 0.5, war: 0.6 }, // the wars of 1914 are fought to exhaustion; armies of conscripts rarely follow a general against the state
  allies: [['france', 'russia'], ['germany', 'austria'], ['germany', 'italy'], ['austria', 'italy'], ['uk', 'japan'], ['uk', 'belgium'], ['russia', 'serbia']],
  known: KNOWN,
  inventions: ['paper', 'gunpowder', 'compass', 'printing', 'windmill', 'rotation', 'steel', 'credit', 'observatory', 'railways', 'machineguns', 'artillery', 'industry', 'radio', 'aircraft', 'tanks'],
  roads: ROADS,
  female: ['Wilhelmina', 'Juliana'],
  words: {
    world: 'the world',
    levy: 'orders a general mobilisation: every town sends its young men to the front',
    walls: 'digs a ring of forts and trenches around',
    bribe: 'buys the commander of',
    bribed: 'who surrenders the garrison',
    feast: 'holds a great victory parade: the crowds cheer',
    silktax: 'raises a tariff on the railways and the ports',
    daggers: "an assassin's bullet",
    guild: 'An anarchist cell gathers in the back streets of',
    siege: 'besieges',
    storm: 'storms the forts of',
    'work.canal': 'builds a dam and canals to water the fields of', 'workname.canal': 'dam', 'worklabel.canal': 'Dam and canals: more grain',
    'work.caravanserai': 'opens a railway junction at', 'workname.caravanserai': 'railway junction', 'worklabel.caravanserai': 'Railway junction: more trade',
    'work.market': 'opens a great factory in', 'workname.market': 'factory', 'worklabel.market': 'Factory: more gold',
    'work.library': 'founds a university in', 'workname.library': 'university', 'worklabel.library': 'University: more learning',
  },
  setup(s) {
    // Widowers: the world gave them a wife; history did not.
    for (const id of ['austria', 'serbia']) {
      const ruler = s.chars[s.realms[id]?.ruler], wife = s.chars[ruler?.spouse];
      if (wife) { delete s.chars[wife.id]; ruler.spouse = null; }
    }
    // The people the story of 1914 needs, kept alive until their hour.
    for (const [name, until] of [["Franz Ferdinand", 6], ["Yuan Shikai", 24], ["Hussein bin Ali", 30], ["Constantine I", 42], ["Nicholas II", 39]]) {
      const c = Object.values(s.chars).find((x) => x.name === name);
      if (c) c.spared = until;
    }
    // King Peter of Serbia is ill: his son Alexander rules as regent.
    const S = s.realms.serbia;
    if (S?.heir) S.regent = S.heir;
    // The long peace of Europe: no one starts a war before the summer of 1914 (history may, from June).
    const ids = living(s).map((x) => x.id);
    for (const a of ids) for (const b of ids) if (a < b) s.truces[key(a, b)] = 6;
    s.flags = { land: Object.fromEntries(ids.map((id) => [id, provincesOf(s, id).length])) };
  },
  month(s, rng, emit) {
    crisis(s, rng('crisis'), emit);
    revolution(s, rng('revolution'), emit);
    offices(s, rng('offices'), emit);
    slump(s, emit);
    strongmen(s, rng('strongmen'), emit);
  },
};

// ---------- helpers ----------
const alive = (s, id) => !!s.realms[id] && !s.realms[id].fallen && provincesOf(s, id).length > 0;
const monthOf = (s, year, month) => (year - s.startYear) * 12 + month; // month: 0 for January
function ally(s, a, b, name) {
  if (!alive(s, a) || !alive(s, b) || allied(s, a, b) || atWar(s, a, b)) return false;
  s.allies[key(a, b)] = { since: s.month };
  treaty(s, 'alliance', [a, b], { name });
  return true;
}
function unally(s, a, b) {
  delete s.allies[key(a, b)];
  for (const t of Object.values(s.treaties)) if (t.kind === 'alliance' && t.ended === null && t.parties.includes(a) && t.parties.includes(b)) t.ended = s.month;
}
// A new ruler for a realm: the old one goes into exile (or back to the benches, at the end of a term).
function reign(s, rid, c, cause) {
  const r = s.realms[rid], old = s.chars[r.ruler], year = yearOf(s.month, s);
  if (old) {
    r.lineage = [...(r.lineage ?? []), { name: old.name, epithet: old.epithet, title: old.title, since: old.since ?? year, until: year, cause, id: old.id }].slice(-30);
    old.role = old.army ? 'general' : cause === 'term' ? 'courtier' : 'exile';
  }
  const have = Object.values(s.chars).find((x) => x.alive && x.name === c.name && x.id !== old?.id);
  const id = have?.id ?? newChar(s, { born: year - 50, skill: 3, culture: r.culture, famous: true, ...c, role: 'ruler', realm: rid, since: year });
  const ch = s.chars[id];
  Object.assign(ch, { role: 'ruler', realm: rid, title: c.title, since: year, temper: c.temper ?? ch.temper, landAtStart: provincesOf(s, rid).length });
  if (!R.temper.ruler[ch.temper]) ch.temper = 'conqueror';
  Object.assign(r, { ruler: id, plan: null, power: null, regent: null });
  if (cause !== 'term' && r.heir && s.chars[r.heir]) { s.chars[r.heir].role = s.chars[r.heir].army ? 'general' : 'exile'; r.heir = null; }
  if (r.vizier === id) r.vizier = null;
  return id;
}

// ---------- the July Crisis, and the powers that join the war ----------
function crisis(s, rng, emit) {
  const f = s.flags, m = s.month;
  const go = (a, b, text, o = {}) => alive(s, a) && alive(s, b) && !atWar(s, a, b) && declareWar(s, a, b, emit, { cause: 'border', breakTruce: true, text, ...o });
  const onAt = (a, ...foes) => foes.some((b) => atWar(s, a, b));
  if (m === monthOf(s, 1914, 5) && !f.sarajevo) { // 28 June 1914
    f.sarajevo = true;
    const A = s.realms.austria, ff = Object.values(s.chars).find((c) => c.alive && c.realm === 'austria' && c.name === 'Franz Ferdinand');
    if (alive(s, 'austria') && ff && s.provinces.dalmatia.owner === 'austria' && alive(s, 'serbia')) {
      const karl = Object.values(s.chars).find((c) => c.alive && c.realm === 'austria' && c.name === 'Archduke Karl');
      if (karl && (A.heir === ff.id || A.ruler === ff.id)) { Object.assign(karl, { role: 'heir', relation: 'great-nephew' }); A.heir = karl.id; } // the crown passes to Karl
      die(s, ff.id, 'assassin', emit, rng, `is shot dead with his wife Sophie in the streets of ${cityOf(s, 'dalmatia')} by Gavrilo Princip, a Bosnian Serb student`);
      f.crisis = m;
    }
  }
  if (m === monthOf(s, 1914, 6) && f.crisis !== undefined && !f.july) {
    f.july = true;
    go('austria', 'serbia', `Austria-Hungary declares war on Serbia, which it blames for the murder at ${cityOf(s, 'dalmatia')}`, { cause: 'revenge' });
  }
  if (m === monthOf(s, 1914, 7) && !f.august) {
    f.august = true;
    if (alive(s, 'italy') && allied(s, 'italy', 'germany')) {
      unally(s, 'italy', 'germany');
      unally(s, 'italy', 'austria');
      emit('alliance', 'Italy declares its neutrality: the Triple Alliance binds it only to a war of defence', { realms: ['italy', 'germany', 'austria'] });
    }
    if (onAt('austria', 'serbia', 'russia')) {
      go('germany', 'russia', 'Germany declares war on Russia, which mobilises to stand by Serbia');
      go('germany', 'france', 'Germany declares war on France and wheels its armies west');
      go('germany', 'belgium', `German armies cross into Belgium on the road to ${cityOf(s, 'paris')}, tearing up the treaty that kept it neutral`);
      go('uk', 'germany', 'Britain declares war on Germany for the sake of Belgium');
      go('france', 'austria', 'France declares war on Austria-Hungary');
      go('uk', 'austria', 'Britain declares war on Austria-Hungary');
      if (s.provinces.jinan.owner === 'germany') go('japan', 'germany', `Japan, Britain's ally, declares war on Germany and sails for ${cityOf(s, 'jinan')}`);
    }
  }
  if (m === monthOf(s, 1914, 8) && !f.pact && atWar(s, 'germany', 'france')) { // September 1914: none of the three will make a separate peace
    f.pact = true;
    const signed = [['uk', 'france'], ['uk', 'russia']].filter(([a, b]) => atWar(s, a, 'germany') && atWar(s, b, 'germany') && ally(s, a, b, 'Pact of London'));
    if (signed.length) emit('alliance', 'Britain, France and Russia sign the Pact of London: none of them will make a separate peace', { realms: ['uk', 'france', 'russia'] });
  }
  if (m === monthOf(s, 1914, 10) && !f.ottoman && onAt('germany', 'russia', 'france', 'uk')) { // November 1914
    f.ottoman = true;
    if (ally(s, 'ottoman', 'germany', 'Ottoman–German alliance')) {
      go('ottoman', 'russia', `Ottoman warships under a German admiral shell ${cityOf(s, 'crimea')}: the Ottoman Empire enters the war at Germany's side`);
      go('uk', 'ottoman', 'Britain declares war on the Ottoman Empire');
      go('france', 'ottoman', 'France declares war on the Ottoman Empire');
    }
  }
  const E = s.realms.egypt;
  if (m === monthOf(s, 1914, 11) && !f.egypt && alive(s, 'egypt') && E.overlord === 'uk' && atWar(s, 'uk', 'ottoman')) {
    f.egypt = true;
    const was = s.chars[E.ruler]?.name ?? 'the Khedive';
    reign(s, 'egypt', { name: 'Hussein Kamel', title: 'Sultan', born: 1853, temper: 'diplomat', traits: ['cautious'], skill: 2 }, 'deposed');
    Object.assign(E, { name: 'Sultanate of Egypt', dynasty: 'House of Muhammad Ali' });
    emit('coup', `Britain deposes Khedive ${was}, who leans to the Ottomans, and makes his uncle Hussein Kamel Sultan of Egypt under British protection`, { realms: ['egypt', 'uk'], chars: [E.ruler] });
  }
  if (m === monthOf(s, 1915, 4) && !f.italy && alive(s, 'italy') && onAt('austria', 'russia', 'france', 'uk') && !CENTRAL.some((x) => allied(s, 'italy', x))) { // May 1915
    f.italy = true;
    if (go('italy', 'austria', `Italy, promised ${placeOf(s, 'tyrol')} and Trieste by a secret treaty signed in ${cityOf(s, 'london')}, declares war on Austria-Hungary`)) {
      ally(s, 'italy', 'uk', 'Treaty of London');
      ally(s, 'italy', 'france', 'Treaty of London');
    }
  }
  if (m === monthOf(s, 1915, 9) && !f.bulgaria && alive(s, 'bulgaria') && onAt('germany', 'russia', 'france', 'uk')) { // October 1915
    f.bulgaria = true;
    if (ally(s, 'bulgaria', 'germany', 'Treaty of Pless')) {
      go('bulgaria', 'serbia', 'Bulgaria, promised Macedonia, falls on Serbia from behind');
      go('uk', 'bulgaria', 'Britain declares war on Bulgaria');
      go('france', 'bulgaria', 'France declares war on Bulgaria');
    }
  }
  const Y = s.realms.china;
  if (m === monthOf(s, 1915, 11) && !f.emperor && alive(s, 'china') && s.chars[Y.ruler]?.name === 'Yuan Shikai') { // December 1915
    f.emperor = true;
    Object.assign(s.chars[Y.ruler], { title: 'Emperor' });
    Object.assign(Y, { name: 'Empire of China', fa: '中華帝國' });
    emit('crowned', 'Yuan Shikai proclaims himself the Hongxian Emperor: the Republic of China becomes an empire again', { realms: ['china'], chars: [Y.ruler] });
    const cai = Object.values(s.chars).find((c) => c.alive && c.realm === 'china' && c.name === 'Cai E' && c.army);
    if (cai) split(s, 'china', cai.id, rng, emit, `rises in ${placeOf(s, 'dali')} to defend the Republic`);
  }
  const H = s.realms.hejaz;
  if (m === monthOf(s, 1916, 5) && !f.arabs && alive(s, 'hejaz') && H.overlord === 'ottoman' && atWar(s, 'uk', 'ottoman')) { // June 1916
    f.arabs = true;
    if (go('hejaz', 'ottoman', `${s.chars[H.ruler]?.name ?? 'The Emir'} raises the Arab Revolt in ${cityOf(s, 'hejaz')}: the tribes rise against the Ottomans`, { cause: 'independence' })) {
      ally(s, 'hejaz', 'uk', 'McMahon–Hussein letters');
      const lawrence = newChar(s, { name: 'T. E. Lawrence', title: 'Colonel', role: 'general', realm: 'hejaz', born: 1888, temper: 'glory', skill: 4, traits: ['bold', 'shrewd'], culture: 'british', famous: true });
      const a = newArmy(s, 'hejaz', lawrence, s.provinces.yanbu.owner === 'hejaz' ? 'yanbu' : H.capital, 5);
      s.armies[a].free = true; // the tribes are paid in British gold
    }
  }
  if (m === monthOf(s, 1916, 7) && !f.romania && alive(s, 'romania') && atWar(s, 'austria', 'russia') && !CENTRAL.some((x) => allied(s, 'romania', x) || atWar(s, 'romania', 'russia'))) { // August 1916
    f.romania = true;
    if (go('romania', 'austria', `Romania declares war on Austria-Hungary and marches into ${placeOf(s, 'transylvania')}`)) {
      ally(s, 'romania', 'russia', 'Treaty of Bucharest');
      go('bulgaria', 'romania', 'Bulgaria declares war on Romania');
    }
  }
  if (m === monthOf(s, 1916, 8) && !f.tanks && alive(s, 'uk') && atWar(s, 'uk', 'germany') && !s.realms.uk.known.includes('tanks')) { // September 1916
    f.tanks = true;
    s.realms.uk.known.push('tanks');
    emit('invention', 'Britain sends the first tanks into battle on the Somme: armoured "landships" that roll over the trenches', { realms: ['uk'], invention: 'tanks', first: true });
  }
  if (m === monthOf(s, 1917, 3) && !f.america && alive(s, 'france') && atWar(s, 'france', 'germany')) { // April 1917
    f.america = true;
    emit('war', 'The United States declares war on Germany: across the Atlantic a great army begins to gather', { realms: ['germany', 'france', 'uk'] });
  }
  if (m === monthOf(s, 1918, 1) && f.america && !f.doughboys && alive(s, 'france') && atWar(s, 'france', 'germany')) { // February 1918
    f.doughboys = true;
    const at = s.provinces.brittany.owner === 'france' ? 'brittany' : s.realms.france.capital;
    const pershing = newChar(s, { name: 'John J. Pershing', title: 'General', role: 'general', realm: 'france', born: 1860, temper: 'steady', skill: 4, traits: ['steadfast'], culture: 'british', famous: true });
    const a = newArmy(s, 'france', pershing, at, 20);
    s.armies[a].free = true; // America pays its own soldiers
    emit('army.raised', `American divisions under John J. Pershing land at ${cityOf(s, at)} to fight beside the French`, { realms: ['france', 'germany'], at, chars: [pershing] });
  }
  const G = s.realms.greece;
  if (m === monthOf(s, 1917, 5) && !f.greece && alive(s, 'greece') && onAt('bulgaria', 'uk', 'france')) { // June 1917
    f.greece = true;
    const king = s.chars[G.ruler];
    if (king?.name === 'Constantine I') reign(s, 'greece', { name: 'Alexander', title: 'King', born: 1893, temper: 'negligent', traits: ['bold'], skill: 2, family: G.dynasty }, 'abdicated');
    if (go('greece', 'bulgaria', `${king?.name === 'Constantine I' ? 'Constantine I gives up the throne to his son Alexander, and ' : ''}Greece, led by Eleftherios Venizelos, joins the Allies against Bulgaria`)) ally(s, 'greece', 'uk', 'Salonica agreement');
  }
}

// ---------- the Russian revolutions ----------
const CENTRAL = ['germany', 'austria', 'ottoman', 'bulgaria'];
// The borderlands that break away when the old empire falls: [provinces, realm, short, leader, title, temperament, born]
const BORDERLANDS = [
  [['finland'], 'Republic of Finland', 'Finland', 'Pehr Evind Svinhufvud', 'Regent', 'just', 1861],
  [['estonia'], 'Republic of Estonia', 'Estonia', 'Konstantin Päts', 'Premier', 'builder', 1874],
  [['livonia'], 'Republic of Latvia', 'Latvia', 'Kārlis Ulmanis', 'Premier', 'builder', 1877],
  [['lithuania'], 'Republic of Lithuania', 'Lithuania', 'Antanas Smetona', 'President', 'diplomat', 1874],
  [['masovia'], 'Republic of Poland', 'Poland', 'Józef Piłsudski', 'Chief of State', 'conqueror', 1867],
  [['kiev', 'chernigov', 'pereyaslavl', 'cumania'], 'Ukrainian State', 'Ukraine', 'Pavlo Skoropadskyi', 'Hetman', 'paranoid', 1873],
  [['kartli', 'imereti'], 'Democratic Republic of Georgia', 'Georgia', 'Noe Zhordania', 'President', 'reformer', 1868],
  [['nakhchivan', 'ani'], 'Republic of Armenia', 'Armenia', 'Hovhannes Kajaznuni', 'Prime Minister', 'just', 1868],
  [['arran', 'shirvan'], 'Azerbaijan Democratic Republic', 'Azerbaijan', 'Fatali Khan Khoyski', 'Prime Minister', 'diplomat', 1875],
];
function revolution(s, rng, emit) {
  const f = s.flags, m = s.month, Ru = s.realms.russia;
  if (!alive(s, 'russia')) return;
  const foes = CENTRAL.filter((x) => atWar(s, 'russia', x));
  if (m === monthOf(s, 1917, 2) && !f.february && foes.length) { // March 1917
    f.february = m;
    const tsar = s.chars[Ru.ruler];
    emit('coup', `Bread riots in ${cityOf(s, Ru.capital)} become a revolution: the soldiers join the crowds, and ${tsar?.name ?? 'the Tsar'} gives up the throne. A Provisional Government rules Russia`, { realms: ['russia'], chars: [tsar?.id].filter(Boolean) });
    reign(s, 'russia', { name: 'Alexander Kerensky', title: 'Premier', born: 1881, temper: 'reformer', traits: ['bold', 'proud'], skill: 2, culture: 'russian_m' }, 'abdicated');
    Object.assign(Ru, { name: 'Russian Republic', elective: true, dynasty: 'Provisional Government' });
    if (Ru.vizier && s.chars[Ru.vizier]) { s.chars[Ru.vizier].role = 'courtier'; Ru.vizier = null; }
  }
  if (m === monthOf(s, 1917, 10) && f.february && !f.october) { // November 1917
    f.october = m;
    emit('coup', `The Bolsheviks seize the Winter Palace in ${cityOf(s, Ru.capital)}: Vladimir Lenin takes power and promises the people peace, land and bread`, { realms: ['russia'] });
    reign(s, 'russia', { name: 'Vladimir Lenin', title: 'Chairman', born: 1870, temper: 'tyrant', traits: ['scheming', 'cruel'], skill: 4, culture: 'russian_m' }, 'overthrown');
    Object.assign(Ru, { name: 'Soviet Russia', color: '#b0302a', fa: 'Советская Россия', elective: false, dynasty: 'the Bolsheviks' });
    const trotsky = newChar(s, { name: 'Lev Trotsky', title: 'Commissar', role: 'general', realm: 'russia', born: 1879, temper: 'loyal', skill: 4, traits: ['bold', 'cruel'], culture: 'russian_m', famous: true });
    newArmy(s, 'russia', trotsky, Ru.capital, 10);
  }
  if (m === monthOf(s, 1918, 2) && f.october && !f.brest) { // March 1918
    f.brest = m;
    for (const x of foes) makePeace(s, 'russia', x, emit, { winner: x, loser: 'russia', tribute: 0, lead: 9 });
    for (const [pids, name, short, leader, title, temper, born] of BORDERLANDS) free(s, rng, emit, pids, { name, short, leader, title, temper, born });
    const whites = free(s, rng, emit, ['zichia', 'crimea'], { name: 'Armed Forces of South Russia', short: 'Whites', plural: true, leader: 'Anton Denikin', title: 'General', temper: 'tyrant', born: 1872, war: true,
      text: (id) => `Anton Denikin raises the White armies in ${placeOf(s, 'zichia')} against the Bolsheviks: Russia falls into civil war` });
    if (whites) s.realms[whites].known = [...s.realms.russia.known];
  }
}
function free(s, rng, emit, pids, { name, short, leader, title, temper, born, war = false, plural = false, text }) {
  const mine = pids.filter((p) => s.provinces[p]?.owner === 'russia' && s.realms.russia.capital !== p);
  if (!mine.length) return null;
  const seat = mine[0];
  const gov = newChar(s, { name: leader, title, role: 'ruler', realm: null, born, temper, skill: 3, culture: s.cultures?.[seat], famous: true });
  const id = newRealm(s, rng, { name, short, capital: seat, ruler: gov, origin: 'separatist', plural });
  s.chars[gov].title = title;
  for (const p of mine) { setOwner(s, p, id, 'secession'); Object.assign(s.provinces[p], { loyalty: 62, conquered: 0, siege: null }); }
  s.realms[id].known = [...s.realms.russia.known];
  newArmy(s, id, gov, seat, round1(3 + mine.length * 2));
  s.record.founded++;
  if (war) declareWar(s, id, 'russia', () => {}, { cause: 'split' });
  emit(war ? 'split' : 'founded', text ? text(id) : `${leader} proclaims the ${name}: ${placeOf(s, seat)} is free of Russia`, { realms: [id, 'russia'], at: seat, chars: [gov], war: war ? s.wars[key(id, 'russia')]?.conflict : undefined });
  return id;
}

// ---------- presidents and prime ministers ----------
// [year, realm, office, name, title, temperament, born]: who history put in office, if the realm is still there to have them.
const OFFICES = [
  [1915, 'portugal', 'ruler', 'Bernardino Machado', 'President', 'diplomat', 1851],
  [1917, 'uk', 'vizier', 'David Lloyd George', 'Prime Minister', 'able', 1863],
  [1918, 'japan', 'vizier', 'Hara Takashi', 'Prime Minister', 'able', 1856],
  [1919, 'southafrica', 'ruler', 'Jan Smuts', 'Prime Minister', 'diplomat', 1870],
  [1920, 'france', 'ruler', 'Alexandre Millerand', 'President', 'diplomat', 1859],
  [1922, 'uk', 'vizier', 'Andrew Bonar Law', 'Prime Minister', 'loyal', 1858],
  [1923, 'uk', 'vizier', 'Stanley Baldwin', 'Prime Minister', 'loyal', 1867],
  [1924, 'france', 'ruler', 'Gaston Doumergue', 'President', 'diplomat', 1863],
  [1924, 'southafrica', 'ruler', 'J. B. M. Hertzog', 'Prime Minister', 'paranoid', 1866],
  [1927, 'japan', 'vizier', 'Tanaka Giichi', 'Prime Minister', 'corrupt', 1864],
  [1929, 'uk', 'vizier', 'Ramsay MacDonald', 'Prime Minister', 'able', 1866],
  [1931, 'france', 'ruler', 'Paul Doumer', 'President', 'just', 1857],
  [1932, 'france', 'ruler', 'Albert Lebrun', 'President', 'negligent', 1871],
  [1935, 'uk', 'vizier', 'Stanley Baldwin', 'Prime Minister', 'loyal', 1867],
  [1937, 'uk', 'vizier', 'Neville Chamberlain', 'Prime Minister', 'loyal', 1869],
  [1939, 'southafrica', 'ruler', 'Jan Smuts', 'Prime Minister', 'diplomat', 1870],
  [1940, 'uk', 'vizier', 'Winston Churchill', 'Prime Minister', 'able', 1874],
];
function offices(s, rng, emit) {
  if (s.month % 12 !== 0 || s.month === 0) return;
  const year = yearOf(s.month, s);
  for (const [y, id, office, name, title, temper, born] of OFFICES) {
    const r = s.realms[id];
    if (y !== year || !alive(s, id) || r.strongman) continue;
    if (office === 'ruler') {
      if (!r.elective || s.chars[r.ruler]?.name === name) continue;
      const was = s.chars[r.ruler]?.name;
      reign(s, id, { name, title, temper, born, skill: 3 }, 'term');
      emit('crowned', `${name} becomes ${title} of ${ofR(s, id)}${was ? `, after ${was}` : ''}`, { realms: [id], chars: [r.ruler], minor: true });
    } else {
      if (r.elective || !r.vizier || s.chars[r.vizier]?.name === name) continue;
      const old = s.chars[r.vizier];
      if (old) old.role = 'courtier';
      const have = Object.values(s.chars).find((c) => c.alive && c.name === name);
      const v = have?.id ?? newChar(s, { name, title, role: 'vizier', realm: id, born, temper, skill: 3, culture: r.culture, famous: true });
      Object.assign(s.chars[v], { role: 'vizier', realm: id, title, temper });
      r.vizier = v;
      emit('crowned', `${name} becomes ${title} of ${ofR(s, id)}${old ? `, after ${old.name}` : ''}`, { realms: [id], chars: [v], minor: true });
    }
  }
}

// ---------- the Great Depression ----------
function slump(s, emit) {
  if (s.month !== monthOf(s, 1929, 9) || s.flags.slump) return; // October 1929
  s.flags.slump = true;
  const hit = living(s).filter((r) => r.known.includes('credit') || r.known.includes('industry'));
  for (const r of hit) {
    r.gold = round1(r.gold * 0.4);
    for (const p of provincesOf(s, r.id)) s.provinces[p.id].prosperity = Math.max(0, (s.provinces[p.id].prosperity ?? 50) - 12);
  }
  emit('slump', `The New York stock market crashes, and the Great Depression runs from bank to bank: factories fall silent from ${cityOf(s, 'london')} to ${cityOf(s, 'kamakura')}, and the jobless queue for bread`, { realms: hit.map((r) => r.id) });
}

// ---------- strongmen ----------
// A great nation that has lost land, or sunk into poverty, may hand itself to a man who promises to set it right.
function strongmen(s, rng, emit) {
  const year = yearOf(s.month, s);
  if (s.month % 12 !== 0 || year < 1920 || year > 1939) return;
  for (const r of living(s)) {
    const was = s.flags.land?.[r.id] ?? 0, mine = provincesOf(s, r.id);
    if (was < 6 || r.strongman || r.nomad || !mine.length || living(s).some((o) => atWar(s, r.id, o.id))) continue;
    const poor = mine.reduce((t, p) => t + (s.provinces[p.id].prosperity ?? 50), 0) / mine.length < 40, beaten = mine.length < was * 0.85;
    if (!(poor || beaten) || !chance(rng, (poor && beaten ? 0.25 : 0.1) * (year >= 1930 ? 1.6 : 1))) continue;
    const name = personName(rng, r.culture, usedNames(s)), old = s.chars[r.ruler];
    reign(s, r.id, { name, title: 'Leader', born: year - 38 - Math.floor(rng() * 12), temper: beaten ? 'conqueror' : 'tyrant', traits: ['ambitious', 'cruel'], skill: 3 + (rng() < 0.4 ? 1 : 0), culture: r.culture, invented: true, famous: false }, 'overthrown');
    Object.assign(r, { strongman: s.month, elective: false, dynasty: `the party of ${name}` });
    emit('coup', `${name}, a soldier of the trenches turned street orator, takes power in ${ofR(s, r.id)}${old ? ` and pushes ${old.name} aside` : ''}: ${beaten ? 'he swears to win back every province that was lost' : 'he promises bread, work and order'}`, { realms: [r.id], chars: [r.ruler, old?.id].filter(Boolean) });
  }
}
