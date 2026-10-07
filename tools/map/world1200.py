# The rest of the Old World in 1200, made playable: Europe from Ireland to the Volga, Arabia, south India and Lanka,
# South-East Asia, Korea and Japan, Tibet, the Siberian forest, and Africa from the Sahel to the Limpopo.
# Adds provinces to web/silk/provinces.json and realms to web/silk/realms.json (skipping any already there), then
# run build.py provinces && build.py tiles. Rulers are those of 1200; where the chronicles lose a name, "the ..." lets
# the world invent one. No religion in any fact.
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / 'web' / 'silk'

# id, name, city, lat, lon, terrain, wealth, walls, owner, native name, fact
P = [
    # France, the Angevin lands, the Low Countries
    ('paris', 'Île-de-France', 'Paris', 48.85, 2.35, 'river', 5, 2, 'france', 'Parisius', 'Philip Augustus walls his capital and raises the Louvre.'),
    ('champagne', 'Champagne', 'Troyes', 48.3, 4.08, 'plains', 4, 1, 'france', 'Trecae', 'Its great fairs draw merchants from Flanders to Italy.'),
    ('burgundy', 'Burgundy', 'Dijon', 47.32, 5.04, 'hills', 3, 2, 'france', 'Divio', 'A duchy of vines on the road between Flanders and Italy.'),
    ('flanders', 'Flanders', 'Ghent', 51.05, 3.72, 'plains', 5, 2, 'flanders', 'Gandavum', 'Cloth towns that weave English wool, rich and restless.'),
    ('normandy', 'Normandy', 'Rouen', 49.44, 1.1, 'river', 4, 3, 'angevin', 'Rotomagus', 'Held by King John; Château Gaillard guards the Seine.'),
    ('anjou', 'Anjou', 'Angers', 47.47, -0.55, 'river', 3, 2, 'angevin', 'Andegavum', 'Heartland of the Angevin house on the Loire.'),
    ('brittany', 'Brittany', 'Rennes', 48.11, -1.68, 'forest', 2, 1, 'angevin', 'Redones', 'A rugged duchy claimed by young Arthur, John\'s nephew.'),
    ('aquitaine', 'Aquitaine', 'Bordeaux', 44.84, -0.58, 'river', 4, 2, 'angevin', 'Burdigala', 'Wine of Gascony sails from here to England.'),
    ('toulouse', 'Toulouse', 'Toulouse', 43.6, 1.44, 'plains', 4, 2, 'toulouse', 'Tolosa', 'A proud southern county of troubadours.'),
    ('provence', 'Provence', 'Marseille', 43.3, 5.37, 'hills', 3, 2, 'aragon', 'Massilia', 'An old Greek port, held by the house of Barcelona.'),
    ('london', 'England', 'London', 51.51, -0.13, 'river', 5, 3, 'angevin', 'Londinium', 'The richest city of King John\'s island realm.'),
    ('york', 'Northumbria', 'York', 53.96, -1.08, 'hills', 3, 2, 'angevin', 'Eboracum', 'The old capital of the north of England.'),
    ('wales', 'Wales', 'Aberffraw', 53.19, -4.45, 'mountains', 1, 1, 'gwynedd', 'Cymru', 'Llywelyn the Great is gathering the Welsh princes.'),
    ('scotland', 'Scotland', 'Dunfermline', 56.07, -3.46, 'hills', 2, 2, 'scotland', 'Scotia', 'William the Lion, King of Scots, rules from Fife.'),
    ('ireland', 'Leinster', 'Dublin', 53.35, -6.26, 'plains', 2, 2, 'angevin', 'Eblana', 'Dublin and the Pale, held by John as Lord of Ireland.'),
    ('connacht', 'Connacht', 'Athlone', 53.42, -7.94, 'plains', 1, 1, 'connacht', 'Connachta', 'Cathal of the Red Hand rules the last great kingdom of the Irish.'),
    # Iberia
    ('toledo', 'New Castile', 'Toledo', 39.86, -4.02, 'hills', 4, 3, 'castile', 'طليطلة', 'Taken from al-Andalus in 1085, now a city of translators and scholars.'),
    ('burgos', 'Old Castile', 'Burgos', 42.34, -3.7, 'plains', 3, 2, 'castile', 'Burgi', 'The old heart of Castile on the road to the west.'),
    ('leon', 'León', 'León', 42.6, -5.57, 'plains', 3, 2, 'leon', 'Legio', 'Royal city of Alfonso IX, who called the first parliament of Europe.'),
    ('galicia', 'Galicia', 'Lugo', 43.01, -7.56, 'hills', 2, 2, 'leon', 'Lucus', 'Green hills of the far north-west, ruled from León.'),
    ('portugal', 'Portugal', 'Coimbra', 40.2, -8.42, 'hills', 3, 2, 'portugal', 'Conimbriga', 'Sancho I, the Populator, settles the new kingdom.'),
    ('lisbon', 'Lisbon', 'Lisbon', 38.72, -9.14, 'river', 4, 3, 'portugal', 'لشبونة', 'A great harbour on the Tagus, Portuguese since 1147.'),
    ('navarre', 'Navarre', 'Pamplona', 42.82, -1.64, 'mountains', 2, 2, 'navarre', 'Pompaelo', 'Sancho the Strong keeps the passes of the Pyrenees.'),
    ('aragon', 'Aragon', 'Zaragoza', 41.65, -0.88, 'river', 4, 3, 'aragon', 'سرقسطة', 'Peter II rules Aragon from the Ebro.'),
    ('barcelona', 'Catalonia', 'Barcelona', 41.39, 2.17, 'hills', 4, 3, 'aragon', 'Barcino', 'A trading city of the western sea.'),
    ('valencia', 'Valencia', 'Valencia', 39.47, -0.38, 'plains', 4, 2, 'almohad', 'بلنسية', 'Orchards and rice fields of the Almohad east.'),
    ('murcia', 'Murcia', 'Murcia', 37.99, -1.13, 'plains', 3, 2, 'almohad', 'مرسية', 'A garden city of al-Andalus.'),
    ('cordoba', 'Córdoba', 'Córdoba', 37.88, -4.78, 'river', 5, 3, 'almohad', 'قرطبة', 'The old city of the caliphs of al-Andalus, still great.'),
    ('seville', 'Seville', 'Seville', 37.39, -5.98, 'river', 5, 3, 'almohad', 'إشبيلية', 'The Almohad capital in al-Andalus, with its great new tower.'),
    ('granada', 'Granada', 'Granada', 37.18, -3.6, 'mountains', 3, 3, 'almohad', 'غرناطة', 'A fortress city under the Sierra Nevada.'),
    ('majorca', 'Majorca', 'Palma', 39.57, 2.65, 'hills', 3, 2, 'ghaniya', 'ميورقة', 'Island stronghold of the Banu Ghaniya.'),
    # The Empire and its neighbours
    ('swabia', 'Swabia', 'Ulm', 48.4, 9.99, 'hills', 4, 2, 'staufen', 'Suebia', 'Homeland of the Hohenstaufen, Philip\'s own duchy.'),
    ('franconia', 'Franconia', 'Nuremberg', 49.45, 11.08, 'forest', 4, 3, 'staufen', 'Norimberga', 'Imperial castle and markets of Franconia.'),
    ('bavaria', 'Bavaria', 'Regensburg', 49.01, 12.1, 'river', 4, 2, 'staufen', 'Ratisbona', 'The Wittelsbach duke backs Philip for the crown.'),
    ('alsace', 'Upper Rhine', 'Strasbourg', 48.58, 7.75, 'river', 4, 3, 'staufen', 'Argentoratum', 'A rich Rhine city of the Staufen lands.'),
    ('thuringia', 'Thuringia', 'Erfurt', 50.98, 11.03, 'forest', 3, 2, 'staufen', 'Erfordia', 'Its landgrave changes sides with every season.'),
    ('brandenburg', 'Brandenburg', 'Brandenburg', 52.41, 12.55, 'forest', 2, 2, 'staufen', 'Brandenburgum', 'A march of the Ascanians on the Slav frontier.'),
    ('lorraine', 'Lorraine', 'Metz', 49.12, 6.18, 'hills', 3, 3, 'staufen', 'Mettis', 'A duchy between the Empire and France.'),
    ('tyrol', 'Tyrol', 'Trento', 46.07, 11.12, 'mountains', 2, 2, 'staufen', 'Tridentum', 'The Brenner road from Germany into Italy.'),
    ('saxony', 'Saxony', 'Brunswick', 52.27, 10.52, 'plains', 3, 2, 'welf', 'Brunopolis', 'The Welf heartland, Otto\'s own.'),
    ('cologne', 'Lower Rhine', 'Cologne', 50.94, 6.96, 'river', 5, 3, 'welf', 'Colonia', 'The greatest city of the Empire, where Otto was crowned.'),
    ('frisia', 'Holland', 'Utrecht', 52.09, 5.12, 'river', 3, 2, 'welf', 'Traiectum', 'Low lands of the Rhine mouths, with Otto.'),
    ('austria', 'Austria', 'Vienna', 48.21, 16.37, 'river', 4, 3, 'austria', 'Vindobona', 'Leopold VI the Glorious rules from Vienna.'),
    ('styria', 'Styria', 'Graz', 47.07, 15.44, 'mountains', 2, 2, 'austria', 'Graecium', 'Alpine march of the Babenbergs.'),
    ('bohemia', 'Bohemia', 'Prague', 50.08, 14.43, 'hills', 4, 3, 'bohemia', 'Praga', 'Ottokar I is crowned King of Bohemia.'),
    ('moravia', 'Moravia', 'Olomouc', 49.59, 17.25, 'plains', 3, 2, 'bohemia', 'Olomucium', 'The eastern lands of the Přemyslids.'),
    ('croatia', 'Croatia', 'Zagreb', 45.81, 15.98, 'hills', 3, 2, 'hungary', 'Zagrabia', 'Croatia, joined to the Hungarian crown.'),
    ('dalmatia', 'Dalmatia', 'Zara', 44.12, 15.23, 'hills', 3, 2, 'hungary', 'Iadera', 'A Hungarian port that Venice covets.'),
    ('transylvania', 'Transylvania', 'Alba Iulia', 46.07, 23.58, 'mountains', 3, 2, 'hungary', 'Alba Iulia', 'Mountains and salt mines of the Hungarian east.'),
    ('wallachia', 'Wallachia', 'Argeș', 45.1, 24.6, 'plains', 2, 1, None, 'Țara Românească', 'Vlach shepherds and Cuman riders between the Carpathians and the Danube.'),
    # The North
    ('zealand', 'Zealand', 'Roskilde', 55.64, 12.08, 'plains', 3, 2, 'denmark', 'Roskildia', 'Seat of the Danish kings.'),
    ('jutland', 'Jutland', 'Viborg', 56.45, 9.4, 'plains', 3, 1, 'denmark', 'Jutia', 'Peninsula of the Danes.'),
    ('scania', 'Scania', 'Lund', 55.7, 13.19, 'plains', 3, 2, 'denmark', 'Lunda', 'Herring fairs make Scania rich.'),
    ('holstein', 'Holstein', 'Lübeck', 53.87, 10.69, 'plains', 4, 2, 'denmark', 'Lubeca', 'Lübeck, the new Baltic port, under Danish rule.'),
    ('nidaros', 'Trøndelag', 'Nidaros', 63.43, 10.39, 'mountains', 2, 2, 'norway', 'Nidrosia', 'King Sverre\'s Birkebeiners hold the north.'),
    ('bergen', 'Western Norway', 'Bergen', 60.39, 5.32, 'mountains', 3, 2, 'norway', 'Bjørgvin', 'The kings\' trading port on the western sea.'),
    ('viken', 'Viken', 'Oslo', 59.91, 10.75, 'forest', 2, 1, 'norway', 'Ásló', 'Bagler rebels contest the south.'),
    ('uppland', 'Svealand', 'Sigtuna', 59.62, 17.72, 'forest', 2, 1, 'sweden', 'Sigtunum', 'The Swedes\' old royal town on Lake Mälaren.'),
    ('gotaland', 'Götaland', 'Linköping', 58.41, 15.62, 'forest', 2, 1, 'sweden', 'Lincopia', 'Land of the Geats.'),
    ('finland', 'Finland', 'Turku', 60.45, 22.27, 'forest', 1, 0, None, 'Aboa', 'Lakes and forests of the Finns.'),
    # Poland and the Baltic
    ('krakow', 'Lesser Poland', 'Kraków', 50.06, 19.94, 'hills', 3, 2, 'poland', 'Cracovia', 'Seat of the senior duke of the Piasts.'),
    ('gniezno', 'Greater Poland', 'Poznań', 52.41, 16.93, 'plains', 3, 2, 'poland', 'Posnania', 'The old heart of the Piasts.'),
    ('masovia', 'Masovia', 'Płock', 52.55, 19.7, 'forest', 2, 1, 'poland', 'Plocia', 'The eastern march on the Vistula.'),
    ('silesia', 'Silesia', 'Wrocław', 51.11, 17.03, 'river', 3, 2, 'silesia', 'Vratislavia', 'Towns rise along the Oder.'),
    ('pomerania', 'Pomerania', 'Szczecin', 53.43, 14.55, 'plains', 2, 2, 'pomerania', 'Stetinum', 'Dukes of the Pomeranians on the Oder mouth.'),
    ('prussia', 'Prussia', 'Truso', 54.2, 19.4, 'forest', 1, 0, None, 'Prusai', 'Forest tribes of the Prussians, who answer to no king.'),
    ('lithuania', 'Lithuania', 'Kernavė', 54.88, 24.85, 'forest', 1, 1, 'lithuania', 'Lietuva', 'Lithuanian dukes raid their neighbours from the forests.'),
    ('livonia', 'Livonia', 'Riga', 56.95, 24.11, 'forest', 1, 0, None, 'Rīga', 'Livs and Letts on the Daugava; German merchants have just founded Riga.'),
    ('estonia', 'Estonia', 'Lindanise', 59.44, 24.75, 'forest', 1, 1, None, 'Eestimaa', 'Free Estonian lands on the Gulf of Finland.'),
    # The Rus and the Volga
    ('novgorod', 'Novgorod', 'Novgorod', 58.52, 31.27, 'forest', 5, 3, 'novgorod', 'Новгород', 'Lord Novgorod the Great, a republic of fur merchants and boyars.'),
    ('pskov', 'Pskov', 'Pskov', 57.82, 28.33, 'forest', 2, 2, 'novgorod', 'Псков', 'Novgorod\'s western bulwark.'),
    ('vladimir', 'Vladimir-Suzdal', 'Vladimir', 56.13, 40.41, 'forest', 4, 3, 'vladimir', 'Владимир', 'Vsevolod Big Nest makes his city the first of the Rus.'),
    ('rostov', 'Rostov', 'Rostov', 57.19, 39.42, 'forest', 3, 2, 'vladimir', 'Ростов', 'An old town on Lake Nero, rich in furs.'),
    ('murom', 'Murom', 'Murom', 55.57, 42.05, 'forest', 2, 1, 'vladimir', 'Муром', 'A forest town on the Oka.'),
    ('ryazan', 'Ryazan', 'Ryazan', 54.63, 39.69, 'forest', 2, 2, 'ryazan', 'Рязань', 'The steppe frontier of the Rus.'),
    ('smolensk', 'Smolensk', 'Smolensk', 54.78, 32.05, 'forest', 3, 2, 'smolensk', 'Смоленск', 'On the portage between the Baltic and the Black Sea.'),
    ('polotsk', 'Polotsk', 'Polotsk', 55.49, 28.78, 'forest', 2, 2, 'polotsk', 'Полоцк', 'A Rus principality on the Daugava.'),
    ('chernigov', 'Chernigov', 'Chernigov', 51.49, 31.29, 'forest', 3, 2, 'chernigov', 'Чернигов', 'Igor of the famous Lay rules here.'),
    ('kiev', 'Kiev', 'Kiev', 50.45, 30.52, 'river', 4, 3, 'kiev', 'Киев', 'Mother of the cities of the Rus, fought over by every prince.'),
    ('pereyaslavl', 'Pereyaslavl', 'Pereyaslavl', 50.07, 31.45, 'plains', 2, 2, 'kiev', 'Переяславль', 'Facing the Cuman steppe.'),
    ('halych', 'Galicia', 'Halych', 49.12, 24.73, 'hills', 3, 3, 'galich', 'Галич', 'Roman the Great has just joined Galicia to Volhynia.'),
    ('volhynia', 'Volhynia', 'Volodymyr', 50.85, 24.32, 'forest', 3, 2, 'galich', 'Володимир', 'Roman\'s own principality.'),
    ('bulgar', 'Volga Bulgaria', 'Bilär', 54.95, 50.4, 'forest', 4, 3, 'volgabulgar', 'بلار', 'Furs and silver change hands at the great bend of the Volga.'),
    ('burtas', 'Burtas', 'Burtas', 53.2, 45.0, 'forest', 1, 0, None, 'Буртасы', 'Forest folk between the Rus and the Bulgars.'),
    ('alania', 'Alania', 'Magas', 43.7, 44.6, 'mountains', 2, 2, 'alania', 'Алания', 'The Alans of the Caucasus, kin of David Soslan.'),
    ('zichia', 'Circassia', 'Tmutarakan', 45.2, 36.7, 'hills', 1, 0, None, 'Зихия', 'Hill tribes on the straits of Kerch.'),
    ('crimea', 'Crimea', 'Sudak', 44.85, 34.97, 'hills', 3, 2, 'kipchak', 'Сугдея', 'A trading port where the Cumans meet the Black Sea merchants.'),
    # Arabia
    ('hejaz', 'Hejaz', 'Jeddah', 21.49, 39.19, 'desert', 3, 1, 'hejaz', 'جدة', 'Red Sea port of the Hejaz, where caravans meet ships.'),
    ('yanbu', 'Northern Hejaz', 'Yanbu', 24.09, 38.06, 'desert', 2, 1, 'hejaz', 'ينبع', 'Port of the northern Hejaz.'),
    ('sanaa', 'Yemen', 'Sanaa', 15.37, 44.19, 'mountains', 3, 3, 'yemen', 'صنعاء', 'A highland city of tower houses, ruled by an Ayyubid prince.'),
    ('aden', 'Aden', 'Aden', 12.79, 45.03, 'desert', 4, 3, 'yemen', 'عدن', 'The great harbour of the Indian trade.'),
    ('zabid', 'Tihama', 'Zabid', 14.2, 43.32, 'plains', 3, 2, 'yemen', 'زبيد', 'A lowland city of scholars and indigo.'),
    ('hadramawt', 'Hadramawt', 'Shibam', 15.93, 48.63, 'desert', 2, 2, None, 'شبام', 'Mud-brick towers in a desert valley.'),
    ('oman', 'Oman', 'Nizwa', 22.93, 57.53, 'mountains', 3, 2, 'oman', 'نزوى', 'The Banu Nabhan rule the mountains of Oman.'),
    ('sohar', 'Batina', 'Sohar', 24.36, 56.75, 'desert', 3, 2, 'oman', 'صحار', 'Port of Oman on the route to India.'),
    ('hasa', 'al-Hasa', 'al-Hasa', 25.38, 49.59, 'desert', 3, 2, 'uyunid', 'الأحساء', 'An oasis of date palms ruled by the Uyunid emirs.'),
    ('najd', 'Najd', 'al-Yamama', 24.15, 47.3, 'desert', 1, 0, None, 'اليمامة', 'Desert of the Bedouin tribes.'),
    # South India and Lanka
    ('devagiri', 'Deccan', 'Devagiri', 19.94, 75.21, 'hills', 4, 4, 'yadava', 'देवगिरि', 'The Yadava fortress-capital, said to be impregnable.'),
    ('nasik', 'Nasik', 'Nasik', 20.0, 73.79, 'hills', 2, 1, 'yadava', 'नासिक', 'On the upper Godavari, under the Yadavas.'),
    ('konkan', 'Konkan', 'Goa', 15.5, 73.83, 'hills', 3, 2, 'hoysala', 'गोवा', 'Kadamba port of Goa on the western sea.'),
    ('warangal', 'Andhra', 'Warangal', 17.97, 79.6, 'hills', 4, 3, 'kakatiya', 'ఓరుగల్లు', 'Young Ganapati of the Kakatiyas builds his great fort.'),
    ('vengi', 'Vengi', 'Rajahmundry', 17.0, 81.8, 'river', 3, 2, 'kakatiya', 'వేంగి', 'The Godavari delta, rich in rice.'),
    ('dwarasamudra', 'Karnata', 'Dwarasamudra', 13.21, 75.99, 'hills', 4, 3, 'hoysala', 'ದ್ವಾರಸಮುದ್ರ', 'Veera Ballala II rules the Hoysalas from their carved city.'),
    ('kanchi', 'Tondaimandalam', 'Kanchipuram', 12.83, 79.7, 'plains', 4, 2, 'chola', 'காஞ்சி', 'A city of silk weavers, once the Pallava capital.'),
    ('thanjavur', 'Chola country', 'Thanjavur', 10.79, 79.14, 'river', 5, 3, 'chola', 'தஞ்சாவூர்', 'The old Chola heartland on the Kaveri delta.'),
    ('madurai', 'Pandya country', 'Madurai', 9.93, 78.12, 'river', 4, 3, 'pandya', 'மதுரை', 'The Pandyas of Madurai, rising against the Cholas.'),
    ('kerala', 'Kerala', 'Kollam', 8.89, 76.6, 'forest', 3, 1, 'venad', 'കൊല്ലം', 'Pepper ports of the Malabar coast.'),
    ('kalinga', 'Kalinga', 'Cuttack', 20.46, 85.88, 'river', 4, 3, 'ganga', 'କଟକ', 'The Eastern Gangas rule Kalinga from the Mahanadi.'),
    ('tripuri', 'Dahala', 'Tripuri', 23.16, 79.94, 'hills', 3, 2, 'kalachuri', 'त्रिपुरी', 'Seat of the Kalachuris of Tripuri on the Narmada.'),
    ('bastar', 'Chakrakuta', 'Barsur', 19.07, 81.4, 'forest', 1, 1, None, 'चक्रकूट', 'A forest kingdom of the Nagas.'),
    ('lanka', 'Lanka', 'Polonnaruwa', 7.94, 81.0, 'forest', 3, 2, 'lanka', 'පොළොන්නරුව', 'The island kingdom, torn by rival claimants since Nissanka Malla.'),
    # South-East Asia
    ('pagan', 'Pagan', 'Pagan', 21.17, 94.86, 'river', 4, 2, 'pagan', 'ပုဂံ', 'King Narapatisithu\'s capital on the Irrawaddy.'),
    ('pegu', 'Lower Burma', 'Pegu', 17.34, 96.48, 'river', 3, 2, 'pagan', 'ပဲခူး', 'Mon rice lands and ports, ruled from Pagan.'),
    ('arakan', 'Arakan', 'Pyinsa', 20.6, 93.2, 'hills', 2, 1, 'arakan', 'ရခိုင်', 'A coastal kingdom beyond the mountains.'),
    ('angkor', 'Cambodia', 'Angkor', 13.41, 103.87, 'river', 5, 3, 'khmer', 'អង្គរ', 'Jayavarman VII rebuilds Angkor Thom, with roads and rest houses.'),
    ('lavo', 'Lavo', 'Lopburi', 14.8, 100.62, 'river', 3, 2, 'khmer', 'ละโว้', 'A Khmer province in the Chao Phraya valley.'),
    ('lanna', 'Haripunjaya', 'Lamphun', 18.58, 99.01, 'hills', 2, 1, None, 'หริภุญชัย', 'A Mon kingdom in the northern hills.'),
    ('champa', 'Champa', 'Vijaya', 13.9, 109.1, 'plains', 3, 2, 'champa', 'Vijaya', 'The Cham kingdom, under Khmer rule after its defeat.'),
    ('thanglong', 'Dai Viet', 'Thang Long', 21.03, 105.85, 'river', 4, 3, 'daiviet', '昇龍', 'Capital of the Ly kings in the Red River delta.'),
    ('nghean', 'Nghe An', 'Nghe An', 18.67, 105.68, 'plains', 2, 1, 'daiviet', '乂安', 'The southern march of Dai Viet, facing Champa.'),
    ('palembang', 'Srivijaya', 'Palembang', -2.99, 104.76, 'river', 4, 2, 'srivijaya', 'Śrīvijaya', 'The old maritime empire of the straits.'),
    ('kedah', 'Kedah', 'Kedah', 6.12, 100.37, 'forest', 3, 1, 'srivijaya', 'Kadaram', 'A port on the Malay peninsula, under Srivijaya.'),
    ('kediri', 'Java', 'Kediri', -7.82, 112.01, 'river', 4, 2, 'kediri', 'Kadiri', 'Kertajaya of Kediri rules eastern Java.'),
    # Korea and Japan
    ('kaesong', 'Goryeo', 'Kaesong', 37.97, 126.55, 'hills', 4, 3, 'goryeo', '開京', 'Royal capital of Goryeo; the Choe dictators rule behind the throne.'),
    ('gyeongju', 'Gyeongsang', 'Gyeongju', 35.86, 129.22, 'hills', 3, 2, 'goryeo', '慶州', 'The old Silla capital in the south-east.'),
    ('pyongyang', 'Seogyeong', 'Pyongyang', 39.03, 125.75, 'river', 3, 3, 'goryeo', '西京', 'The Western Capital on the Taedong.'),
    ('kamakura', 'Kanto', 'Kamakura', 35.32, 139.55, 'plains', 4, 2, 'kamakura', '鎌倉', 'Seat of the shogunate of the eastern warriors.'),
    ('kyoto', 'Kinai', 'Kyoto', 35.01, 135.77, 'river', 5, 2, 'kamakura', '京都', 'The emperor\'s city, where the old court still reigns.'),
    ('dazaifu', 'Kyushu', 'Dazaifu', 33.51, 130.52, 'hills', 3, 2, 'kamakura', '大宰府', 'Gateway to Korea and China.'),
    ('hiraizumi', 'Mutsu', 'Hiraizumi', 38.99, 141.11, 'forest', 3, 1, 'kamakura', '平泉', 'Gold country of the north, taken in 1189.'),
    # Tibet and the forests of the north
    ('lhasa', 'Ü-Tsang', 'Lhasa', 29.65, 91.1, 'mountains', 2, 1, None, 'ལྷ་ས', 'Rival clans share the high valleys since the old empire fell.'),
    ('ngari', 'Ngari', 'Purang', 30.3, 81.2, 'mountains', 1, 1, None, 'མངའ་རིས', 'A remote kingdom of the western plateau.'),
    ('amdo', 'Amdo', 'Xining', 36.62, 101.78, 'mountains', 2, 1, None, 'ཨ་མདོ', 'Herders and horse fairs on the edge of the plateau.'),
    ('yenisei', 'Yenisei', 'Kem-Kemchik', 51.7, 93.0, 'forest', 1, 1, 'kyrgyz', 'Енисей', 'The Kyrgyz of the upper Yenisei.'),
    ('oirat', 'Oirat forests', 'Shishgid', 51.0, 99.0, 'forest', 1, 0, None, 'Ойрад', 'Forest people west of Lake Baikal.'),
    ('barga', 'Barguzin', 'Barguzin', 53.6, 109.6, 'forest', 1, 0, None, 'Баргузин', 'Forest hunters beyond Lake Baikal.'),
    # Africa
    ('koumbi', 'Wagadu', 'Koumbi Saleh', 15.77, -7.97, 'desert', 3, 2, 'ghana', 'كومبي صالح', 'The old capital of Ghana, the land of gold, now in decline.'),
    ('sosso', 'Sosso', 'Sosso', 13.5, -7.5, 'plains', 2, 2, 'sosso', 'صوصو', 'Sumanguru the blacksmith king gathers iron and warriors.'),
    ('kangaba', 'Manden', 'Niani', 11.37, -8.66, 'plains', 2, 1, 'mali', 'نياني', 'A small Mande kingdom on the upper Niger.'),
    ('djenne', 'Inland Niger', 'Djenné', 13.9, -4.55, 'river', 3, 2, None, 'جني', 'A mud-brick trading town in the Niger floodlands.'),
    ('timbuktu', 'Timbuktu', 'Timbuktu', 16.77, -3.0, 'desert', 3, 1, None, 'تنبكت', 'A Tuareg camp grown into a caravan town.'),
    ('gao', 'Songhai', 'Gao', 16.27, -0.04, 'river', 3, 2, 'songhai', 'كاو', 'The Za kings of Songhai at the bend of the Niger.'),
    ('takrur', 'Takrur', 'Takrur', 16.5, -14.3, 'river', 2, 1, 'takrur', 'التكرور', 'On the Senegal river, trading gold to the Maghreb.'),
    ('kano', 'Hausaland', 'Kano', 12.0, 8.52, 'plains', 3, 2, 'kano', 'كنو', 'A walled Hausa city of dyers and weavers.'),
    ('njimi', 'Kanem', 'Njimi', 14.5, 15.8, 'desert', 3, 2, 'kanem', 'كانم', 'Kanem\'s kings rule the trade road to Fezzan.'),
    ('fezzan', 'Fezzan', 'Zawila', 26.18, 15.12, 'desert', 2, 1, None, 'زويلة', 'An oasis on the Saharan gold road.'),
    ('ife', 'Ife', 'Ile-Ife', 7.48, 4.56, 'forest', 3, 1, 'ife', 'Ifẹ̀', 'The Yoruba city famed for its bronze heads.'),
    ('benin', 'Benin', 'Edo', 6.34, 5.62, 'forest', 3, 2, 'benin', 'Ẹdo', 'Oba Eweka founds a new dynasty in the forest city.'),
    ('roha', 'Lasta', 'Roha', 12.03, 39.04, 'mountains', 3, 3, 'zagwe', 'ሮሓ', 'King Lalibela\'s capital, with its halls cut into the rock.'),
    ('aksum', 'Tigray', 'Aksum', 14.13, 38.72, 'mountains', 3, 2, 'zagwe', 'አክሱም', 'Ancient capital of the old kings, with its tall stelae.'),
    ('shewa', 'Shewa', 'Debre Berhan', 9.68, 39.53, 'mountains', 2, 2, 'zagwe', 'ሸዋ', 'Southern highlands of the Zagwe kings.'),
    ('soba', 'Alodia', 'Soba', 15.5, 32.68, 'river', 3, 2, 'alodia', 'Soba', 'The southern Nubian kingdom at the meeting of the Niles.'),
    ('zeila', 'Adal', 'Zeila', 11.35, 43.47, 'desert', 2, 1, None, 'زيلع', 'A port of the Somali coast facing Aden.'),
    ('mogadishu', 'Benadir', 'Mogadishu', 2.04, 45.34, 'desert', 3, 2, 'mogadishu', 'مقديشو', 'A rich port of the Indian Ocean trade.'),
    ('mombasa', 'Mombasa', 'Mombasa', -4.04, 39.67, 'forest', 2, 1, None, 'ممباسا', 'A Swahili port of coral stone.'),
    ('kilwa', 'Kilwa', 'Kilwa', -8.96, 39.52, 'forest', 3, 2, 'kilwa', 'كلوة', 'The Kilwa sultans grow rich on gold from the south.'),
    ('mapungubwe', 'Mapungubwe', 'Mapungubwe', -22.19, 29.39, 'plains', 3, 1, 'mapungubwe', 'Mapungubwe', 'A hilltop kingdom of gold and ivory on the Limpopo.'),
    ('zimbabwe', 'Great Zimbabwe', 'Great Zimbabwe', -20.27, 30.93, 'hills', 2, 2, None, 'Dzimba dza mabwe', 'Stone walls rising on the plateau.'),
]

def ruler(name, title, born, since, traits, skill=3, **k): return {'name': name, 'title': title, 'born': born, 'since': since, 'traits': traits, 'skill': skill, **k}
def gen(name, skill, traits, at, **k): return {'name': name, 'skill': skill, 'traits': traits, 'at': at, **k}

# id, name, short, color, capital, ruler, heir, generals, native name, dynasty, extra
REALMS = [
    ('france', 'Kingdom of France', 'France', '#3557a6', 'paris', ruler('Philip II Augustus', 'King', 1165, 1180, ['shrewd', 'ambitious'], 4), {'name': 'Louis', 'born': 1187, 'traits': ['bold'], 'relation': 'son'}, [gen('Guillaume des Barres', 4, ['loyal'], 'paris')], 'Francia', 'Capetians', {'lineage': [{'name': 'Louis VI', 'since': 1108, 'until': 1137}, {'name': 'Louis VII', 'since': 1137, 'until': 1180}]}),
    ('angevin', 'Angevin Empire', 'Angevins', '#b03a2e', 'london', ruler('John', 'King', 1166, 1199, ['scheming', 'cruel'], 2), None, [gen('William Marshal', 5, ['loyal'], 'normandy'), gen('Hubert de Burgh', 3, ['steadfast'], 'aquitaine')], 'Anglia', 'Plantagenets', {'plural': True, 'lineage': [{'name': 'Henry II', 'since': 1154, 'until': 1189}, {'name': 'Richard I', 'since': 1189, 'until': 1199}]}),
    ('flanders', 'County of Flanders', 'Flanders', '#d0a32a', 'flanders', ruler('Baldwin IX', 'Count', 1172, 1194, ['bold', 'ambitious']), None, [], 'Flandria', 'House of Flanders', {}),
    ('toulouse', 'County of Toulouse', 'Toulouse', '#b5523b', 'toulouse', ruler('Raymond VI', 'Count', 1156, 1194, ['shrewd']), None, [], 'Tolosa', 'House of Toulouse', {}),
    ('aragon', 'Crown of Aragon', 'Aragon', '#d4a017', 'aragon', ruler('Peter II', 'King', 1178, 1196, ['bold'], 4), None, [], 'Aragonia', 'House of Barcelona', {}),
    ('gwynedd', 'Principality of Gwynedd', 'Gwynedd', '#4f8a3a', 'wales', ruler('Llywelyn ab Iorwerth', 'Prince', 1173, 1200, ['ambitious', 'shrewd'], 4), None, [], 'Gwynedd', 'House of Aberffraw', {}),
    ('scotland', 'Kingdom of Scotland', 'Scotland', '#3e6fa0', 'scotland', ruler('William the Lion', 'King', 1143, 1165, ['proud']), {'name': 'Alexander', 'born': 1198, 'traits': ['wise'], 'relation': 'son'}, [], 'Scotia', 'House of Dunkeld', {}),
    ('connacht', 'Kingdom of Connacht', 'Connacht', '#5e9a5a', 'connacht', ruler('Cathal Crobhdearg', 'King', 1153, 1189, ['steadfast']), None, [], 'Connachta', 'Ua Conchobair', {}),
    ('castile', 'Kingdom of Castile', 'Castile', '#b8862b', 'toledo', ruler('Alfonso VIII', 'King', 1155, 1158, ['bold', 'wise'], 4), {'name': 'Ferdinand', 'born': 1189, 'traits': ['bold'], 'relation': 'son'}, [gen('Diego López de Haro', 4, ['steadfast'], 'burgos')], 'Castella', 'House of Ivrea', {}),
    ('leon', 'Kingdom of León', 'León', '#8e3b5e', 'leon', ruler('Alfonso IX', 'King', 1171, 1188, ['proud', 'wise']), {'name': 'Ferdinand', 'born': 1199, 'traits': ['wise'], 'relation': 'son'}, [], 'Legio', 'House of Ivrea', {}),
    ('portugal', 'Kingdom of Portugal', 'Portugal', '#2f7a5c', 'portugal', ruler('Sancho I', 'King', 1154, 1185, ['wise']), {'name': 'Afonso', 'born': 1185, 'traits': ['cautious'], 'relation': 'son'}, [], 'Portucale', 'House of Burgundy', {}),
    ('navarre', 'Kingdom of Navarre', 'Navarre', '#9b2d3d', 'navarre', ruler('Sancho VII the Strong', 'King', 1157, 1194, ['bold', 'proud'], 4), None, [], 'Navarra', 'Jiménez', {}),
    ('staufen', 'Kingdom of Germany (Staufen)', 'Staufen', '#c9b13a', 'swabia', ruler('Philip of Swabia', 'King', 1177, 1198, ['shrewd'], 3), None, [gen('Ludwig of Bavaria', 3, ['loyal'], 'bavaria')], 'Regnum Teutonicum', 'Hohenstaufen', {}),
    ('welf', 'Kingdom of Germany (Welf)', 'Welfs', '#7a5a2a', 'saxony', ruler('Otto IV', 'King', 1175, 1198, ['proud', 'bold'], 3), None, [], 'Regnum Teutonicum', 'House of Welf', {'plural': True}),
    ('austria', 'Duchy of Austria', 'Austria', '#c23b3b', 'austria', ruler('Leopold VI', 'Duke', 1176, 1198, ['just']), None, [], 'Austria', 'Babenberg', {}),
    ('bohemia', 'Kingdom of Bohemia', 'Bohemia', '#a64a8a', 'bohemia', ruler('Ottokar I', 'King', 1155, 1197, ['shrewd']), None, [], 'Bohemia', 'Přemyslids', {}),
    ('denmark', 'Kingdom of Denmark', 'Denmark', '#c0392b', 'zealand', ruler('Canute VI', 'King', 1163, 1182, ['cautious']), {'name': 'Valdemar', 'born': 1170, 'traits': ['bold', 'ambitious'], 'relation': 'brother'}, [], 'Dania', 'Estridsen', {}),
    ('norway', 'Kingdom of Norway', 'Norway', '#7a2e2e', 'bergen', ruler('Sverre', 'King', 1151, 1177, ['relentless', 'shrewd'], 4), {'name': 'Haakon', 'born': 1182, 'traits': ['bold'], 'relation': 'son'}, [], 'Norvegia', 'Sverre\'s house', {}),
    ('sweden', 'Kingdom of Sweden', 'Sweden', '#2e5e9e', 'uppland', ruler('Sverker II', 'King', 1164, 1196, ['cautious']), None, [], 'Svecia', 'House of Sverker', {}),
    ('poland', 'Duchy of Poland', 'Poland', '#d24b4b', 'krakow', ruler('Mieszko III the Old', 'Duke', 1122, 1198, ['shrewd', 'ailing']), {'name': 'Władysław Spindleshanks', 'born': 1161, 'traits': ['ambitious'], 'relation': 'son'}, [], 'Polonia', 'Piasts', {}),
    ('silesia', 'Duchy of Silesia', 'Silesia', '#d9a23b', 'silesia', ruler('Bolesław the Tall', 'Duke', 1127, 1163, ['proud', 'ailing']), {'name': 'Henry the Bearded', 'born': 1165, 'traits': ['wise'], 'relation': 'son'}, [], 'Silesia', 'Silesian Piasts', {}),
    ('pomerania', 'Duchy of Pomerania', 'Pomerania', '#5a8fa8', 'pomerania', ruler('Bogusław II', 'Duke', 1178, 1187, ['cautious']), None, [], 'Pomerania', 'Griffins', {}),
    ('lithuania', 'Lithuanian dukes', 'Lithuania', '#6b8e23', 'lithuania', ruler('the Lithuanian duke', 'Duke', 1165, 1190, ['bold', 'restless']), None, [], 'Lietuva', 'Lithuanian dukes', {}),
    ('novgorod', 'Novgorod Republic', 'Novgorod', '#8a6d3b', 'novgorod', ruler('Miroshka Nezdinich', 'Posadnik', 1140, 1189, ['shrewd']), None, [], 'Новгород', 'Boyars of Novgorod', {'elective': True}),
    ('vladimir', 'Grand Principality of Vladimir', 'Vladimir', '#b65a2a', 'vladimir', ruler('Vsevolod Big Nest', 'Grand Prince', 1154, 1176, ['shrewd', 'wise'], 4), {'name': 'Konstantin', 'born': 1186, 'traits': ['wise'], 'relation': 'son'}, [gen('Yuri', 3, ['bold'], 'rostov')], 'Владимир', 'Yurievichi', {}),
    ('ryazan', 'Principality of Ryazan', 'Ryazan', '#9a7a3a', 'ryazan', ruler('Roman Glebovich', 'Prince', 1150, 1180, ['proud']), None, [], 'Рязань', 'Princes of Ryazan', {}),
    ('smolensk', 'Principality of Smolensk', 'Smolensk', '#6a7a3a', 'smolensk', ruler('Mstislav Romanovich', 'Prince', 1160, 1197, ['cautious']), None, [], 'Смоленск', 'Rostislavichi', {}),
    ('polotsk', 'Principality of Polotsk', 'Polotsk', '#4a6a8a', 'polotsk', ruler('Vladimir of Polotsk', 'Prince', 1160, 1184, ['steadfast']), None, [], 'Полоцк', 'Izyaslavichi', {}),
    ('chernigov', 'Principality of Chernigov', 'Chernigov', '#7a4a6a', 'chernigov', ruler('Igor Svyatoslavich', 'Prince', 1151, 1198, ['bold', 'proud']), None, [], 'Чернигов', 'Olgovichi', {}),
    ('kiev', 'Principality of Kiev', 'Kiev', '#b08d4a', 'kiev', ruler('Rurik Rostislavich', 'Grand Prince', 1140, 1194, ['restless']), None, [], 'Киев', 'Rostislavichi', {}),
    ('galich', 'Galicia-Volhynia', 'Galicia', '#3a7a6a', 'halych', ruler('Roman the Great', 'Prince', 1155, 1199, ['bold', 'relentless'], 4), None, [], 'Галич', 'Romanovichi', {}),
    ('volgabulgar', 'Volga Bulgaria', 'Bulgars', '#4a9a8a', 'bulgar', ruler('the Emir of the Bulgars', 'Emir', 1160, 1190, ['shrewd']), None, [], 'بلغار', 'Emirs of Bulgar', {'plural': True}),
    ('alania', 'Kingdom of Alania', 'Alania', '#8a4a3a', 'alania', ruler('the King of the Alans', 'King', 1165, 1190, ['bold']), None, [], 'Алания', 'Alan kings', {}),
    ('hejaz', 'Emirate of the Hejaz', 'Hejaz', '#6a8a4a', 'hejaz', ruler('Qatada ibn Idris', 'Emir', 1130, 1200, ['shrewd', 'bold']), None, [], 'الحجاز', 'Banu Qatada', {}),
    ('yemen', 'Ayyubid Yemen', 'Yemen', '#c48a3a', 'sanaa', ruler("al-Mu'izz Isma'il", 'Malik', 1176, 1197, ['cruel', 'proud']), None, [], 'اليمن', 'Ayyubids of Yemen', {}),
    ('oman', 'Oman', 'Oman', '#5a7a9a', 'oman', ruler('the Nabhani malik', 'Malik', 1160, 1185, ['cautious']), None, [], 'عُمان', 'Banu Nabhan', {}),
    ('uyunid', 'Uyunid Emirate', 'Uyunids', '#9a6a4a', 'hasa', ruler('the Uyunid emir', 'Emir', 1155, 1185, ['steadfast']), None, [], 'العيونيون', 'Uyunids', {'plural': True}),
    ('yadava', 'Yadavas of Devagiri', 'Yadavas', '#c96a2b', 'devagiri', ruler('Jaitugi', 'Raja', 1170, 1191, ['bold'], 4), None, [], 'यादव', 'Seuna Yadavas', {'plural': True}),
    ('kakatiya', 'Kakatiya kingdom', 'Kakatiyas', '#8a3a6a', 'warangal', ruler('Ganapati', 'Raja', 1185, 1199, ['wise']), None, [], 'కాకతీయ', 'Kakatiyas', {'plural': True}),
    ('hoysala', 'Hoysala kingdom', 'Hoysalas', '#3a6a3a', 'dwarasamudra', ruler('Veera Ballala II', 'King', 1155, 1173, ['bold', 'proud'], 4), None, [], 'ಹೊಯ್ಸಳ', 'Hoysalas', {'plural': True}),
    ('chola', 'Chola Empire', 'Cholas', '#a33a2a', 'thanjavur', ruler('Kulottunga III', 'Emperor', 1150, 1178, ['proud'], 4), None, [], 'சோழ', 'Cholas', {'plural': True}),
    ('pandya', 'Pandya kingdom', 'Pandyas', '#3a8a9a', 'madurai', ruler('Jatavarman Kulasekhara', 'King', 1160, 1190, ['bold']), None, [], 'பாண்டியர்', 'Pandyas', {'plural': True}),
    ('venad', 'Kingdom of Venad', 'Venad', '#6a9a3a', 'kerala', ruler('the Venad king', 'King', 1160, 1185, ['cautious']), None, [], 'വേണാട്', 'Venad kings', {}),
    ('ganga', 'Eastern Ganga kingdom', 'Gangas', '#9a8a2a', 'kalinga', ruler('Rajaraja III', 'King', 1170, 1198, ['cautious']), None, [], 'ଗଙ୍ଗ', 'Eastern Gangas', {'plural': True}),
    ('kalachuri', 'Kalachuris of Tripuri', 'Kalachuris', '#7a5a8a', 'tripuri', ruler('Vijayasimha', 'King', 1150, 1180, ['cautious']), None, [], 'कलचुरि', 'Kalachuris', {'plural': True}),
    ('lanka', 'Kingdom of Polonnaruwa', 'Lanka', '#c9a24a', 'lanka', ruler('Sahassa Malla', 'King', 1155, 1200, ['carefree']), None, [], 'ලංකා', 'Kalinga line of Lanka', {}),
    ('pagan', 'Pagan Empire', 'Pagan', '#b07a2a', 'pagan', ruler('Narapatisithu', 'King', 1138, 1174, ['wise']), {'name': 'Htilominlo', 'born': 1175, 'traits': ['just'], 'relation': 'son'}, [], 'ပုဂံ', 'Pagan dynasty', {}),
    ('arakan', 'Kingdom of Arakan', 'Arakan', '#5a8a6a', 'arakan', ruler('the Arakanese king', 'King', 1160, 1185, ['cautious']), None, [], 'ရခိုင်', 'Arakanese kings', {}),
    ('khmer', 'Khmer Empire', 'Khmer', '#2a7a7a', 'angkor', ruler('Jayavarman VII', 'King', 1122, 1181, ['wise', 'ambitious'], 4), None, [], 'កម្ពុជ', 'Mahidharapura', {}),
    ('champa', 'Champa', 'Champa', '#9a5a7a', 'champa', ruler('the Cham king', 'King', 1165, 1192, ['proud']), None, [], 'Campā', 'Cham kings', {'overlord': 'khmer'}),
    ('daiviet', 'Dai Viet', 'Dai Viet', '#c25a3a', 'thanglong', ruler('Ly Cao Tong', 'Emperor', 1173, 1175, ['carefree']), None, [], '大越', 'Ly dynasty', {}),
    ('srivijaya', 'Srivijaya', 'Srivijaya', '#3a5a9a', 'palembang', ruler('the Maharaja of Srivijaya', 'Maharaja', 1160, 1183, ['shrewd']), None, [], 'Śrīvijaya', 'Sailendras', {}),
    ('kediri', 'Kingdom of Kediri', 'Kediri', '#8a7a3a', 'kediri', ruler('Kertajaya', 'King', 1165, 1194, ['proud', 'cruel']), None, [], 'Kadiri', 'Isyana', {}),
    ('goryeo', 'Kingdom of Goryeo', 'Goryeo', '#4a6aaa', 'kaesong', ruler('Sinjong', 'King', 1144, 1197, ['timid']), None, [gen('Choe U', 3, ['ambitious'], 'kaesong')], '高麗', 'House of Wang', {}),
    ('kamakura', 'Kamakura shogunate', 'Japan', '#c24a5a', 'kamakura', ruler('Minamoto no Yoriie', 'Lord', 1182, 1199, ['carefree', 'proud']), {'name': 'Ichiman', 'born': 1198, 'traits': [], 'relation': 'son'}, [gen('Hōjō Yoshitoki', 4, ['shrewd'], 'kamakura'), gen('Wada Yoshimori', 4, ['bold'], 'kyoto')], '日本', 'Minamoto', {}),
    ('kyrgyz', 'Yenisei Kyrgyz', 'Kyrgyz', '#7a8a4a', 'yenisei', ruler('the Kyrgyz inal', 'Inal', 1160, 1185, ['restless']), None, [], 'Кыргыз', 'Kyrgyz inals', {'nomad': True, 'plural': True}),
    ('ghana', 'Kingdom of Ghana', 'Ghana', '#c9a33a', 'koumbi', ruler('the King of Ghana', 'King', 1150, 1180, ['proud', 'ailing']), None, [], 'غانة', 'Cissé kings', {}),
    ('sosso', 'Sosso kingdom', 'Sosso', '#7a3a3a', 'sosso', ruler('Sumanguru Kanté', 'King', 1160, 1200, ['cruel', 'bold'], 4), None, [], 'صوصو', 'Kanté', {}),
    ('mali', 'Kingdom of Mali', 'Mali', '#3a8a4a', 'kangaba', ruler('Naré Maghann Konaté', 'King', 1170, 1195, ['wise']), None, [], 'مالي', 'Keita', {}),
    ('songhai', 'Songhai kingdom', 'Songhai', '#a3693a', 'gao', ruler('the Za of Gao', 'Za', 1160, 1185, ['steadfast']), None, [], 'سنغاي', 'Za dynasty', {}),
    ('takrur', 'Kingdom of Takrur', 'Takrur', '#5a7a3a', 'takrur', ruler('the King of Takrur', 'King', 1160, 1185, ['cautious']), None, [], 'التكرور', 'Takrur kings', {}),
    ('kano', 'Kingdom of Kano', 'Kano', '#9a4a2a', 'kano', ruler('the Sarki of Kano', 'Sarki', 1160, 1185, ['shrewd']), None, [], 'كنو', 'Bagauda line', {}),
    ('kanem', 'Kanem Empire', 'Kanem', '#8a6a2a', 'njimi', ruler("Abd al-Jalil", 'Mai', 1160, 1194, ['steadfast']), {'name': 'Dunama', 'born': 1180, 'traits': ['ambitious', 'bold'], 'relation': 'son'}, [], 'كانم', 'Sayfawa', {}),
    ('ife', 'Kingdom of Ife', 'Ife', '#6a4a8a', 'ife', ruler('the Ooni of Ife', 'Ooni', 1160, 1185, ['wise']), None, [], 'Ifẹ̀', 'Oonis', {}),
    ('benin', 'Kingdom of Benin', 'Benin', '#a33a4a', 'benin', ruler('Eweka I', 'Oba', 1170, 1180, ['wise']), None, [], 'Ẹdo', 'House of Eweka', {}),
    ('zagwe', 'Zagwe dynasty', 'Zagwe', '#6a3a6a', 'roha', ruler('Gebre Meskel Lalibela', 'King', 1162, 1185, ['wise'], 3), None, [], 'ዛጔ', 'Zagwe', {}),
    ('alodia', 'Kingdom of Alodia', 'Alodia', '#4a7a8a', 'soba', ruler('the King of Alodia', 'King', 1160, 1185, ['cautious']), None, [], 'Alwa', 'Kings of Alwa', {}),
    ('mogadishu', 'Sultanate of Mogadishu', 'Mogadishu', '#3a6a5a', 'mogadishu', ruler('the Sultan of Mogadishu', 'Sultan', 1160, 1185, ['shrewd']), None, [], 'مقديشو', 'Mogadishu sultans', {}),
    ('kilwa', 'Kilwa Sultanate', 'Kilwa', '#2a8a7a', 'kilwa', ruler('the Sultan of Kilwa', 'Sultan', 1160, 1185, ['shrewd']), None, [], 'كلوة', 'Shirazi sultans', {}),
    ('mapungubwe', 'Kingdom of Mapungubwe', 'Mapungubwe', '#b0893a', 'mapungubwe', ruler('the King of Mapungubwe', 'King', 1160, 1185, ['wise']), None, [], 'Mapungubwe', 'Mapungubwe kings', {}),
]

if __name__ == '__main__':
    provs = json.loads((DATA / 'provinces.json').read_text())
    have = {p['id'] for p in provs}
    added = 0
    for (pid, name, city, lat, lon, terrain, wealth, walls, owner, fa, fact) in P:
        if pid in have: continue
        provs.append({'id': pid, 'name': name, 'city': city, 'lat': lat, 'lon': lon, 'terrain': terrain, 'wealth': wealth, 'walls': walls, 'owner': owner, 'silk': False, 'fact': fact, 'fa': fa})
        added += 1
    realms = json.loads((DATA / 'realms.json').read_text())
    rhave = {r['id'] for r in realms}
    owners = {p['owner'] for p in provs if p['owner']}
    radded = 0
    for (rid, name, short, color, cap, rul, heir, gens, fa, dyn, extra) in REALMS:
        if rid in rhave: continue
        assert rid in owners, f'{rid} holds no province'
        r = {'id': rid, 'name': name, 'short': short, 'color': color, 'capital': cap, 'ruler': rul, 'generals': gens, 'fa': fa, 'dynasty': dyn, 'lineage': extra.pop('lineage', [])}
        if heir: r['heir'] = heir
        r.update(extra)
        realms.append(r)
        radded += 1
    known = {r['id'] for r in realms}
    missing = sorted({p['owner'] for p in provs if p['owner'] and p['owner'] not in known})
    assert not missing, f'provinces held by unknown realms: {missing}'
    (DATA / 'provinces.json').write_text('[\n' + ',\n'.join('  ' + json.dumps(p, ensure_ascii=False) for p in provs) + '\n]\n')
    (DATA / 'realms.json').write_text('[\n' + ',\n'.join('  ' + json.dumps(r, ensure_ascii=False) for r in realms) + '\n]\n')
    print(f'provinces +{added} = {len(provs)}, realms +{radded} = {len(realms)}')
