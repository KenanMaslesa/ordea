# Unaprijedite uslugu u Va�em ugostiteljskom objektu

**Moderni sistem digitalnih narud�bi koji �tedi vrijeme, smanjuje gre�ke i povecava zadovoljstvo gostiju i uposlenika.**

---

## Koji problemi se rje�avaju?

U klasicnoj usluzi konobar uzme narud�bu, pi�e je na blok, odnosi papir u �ank ili kuhinju � gubi korak, gubi minutu, gubi se. U vr�nom periodu to stvara gu�vu, gre�ke i sporiju uslugu.

**Na�a aplikacija uklanja svaki nepotrebni korak:**

- Konobar unosi narud�bu za 10 sekundi, direktno s telefona
- Narud�ba u istom trenutku stigne u �ank, kuhinju � ili oba odjednom
- �anker odmah pocinje s pripremom � konobar ne mora ni doci
- Tek kad je sve gotovo, konobar dolazi po narud�bu

Rezultat: **br�a usluga, manje gu�ve, manje gre�aka, zadovoljniji gosti.**

---

## Posebno korisno kada:

- Objekat ima **sprat, terasu ili odvojene salone** � konobar ne mora silaziti u �ank po svaki napitak
- **Vr�ni sati** kad je �ank pretrpan � narud�be se redaju automatski, bez galame
- Imate **vi�e sektora** (�ank + kuhinja) � svaki dobija samo ono �to ga se tice
- �elite **manje papira, manje gre�aka, manje stresa**

---

## Kako radi?

### ?? Konobar (telefon)

1. Otvori aplikaciju, odabere sto ili zonu
2. Prstom bira stavke iz menija po kategorijama
3. Doda napomenu ako treba (npr. "bez �ecera")
4. Pritisne "Po�alji" � gotovo, za 10 sekundi

Nema pisanja na blok, nema gu�ve u �anku, nema gre�aka pri prijenosu narud�be.

### ?? �ank / ?? Kuhinja (tablet)

- Narud�ba se pojavi odmah � uz zvucni alarm
- Vidljive samo stavke koje se ticu tog sektora (�ank vidi pice, kuhinja vidi hranu)
- Kad je sektor zavr�io pripremu � pritisnu "Zavr�eno"
- Konobar automatski dobija obavijest na telefon

### ?? Admin / Vlasnik (poseban ekran)

- Real-time uvid u sve aktivne narud�be
- Statistika: prihod, broj narud�bi, prosjecna vrijednost narud�be
- Pregled po konobarima � ko je ostvario koliki promet
- Pregled po stolovima i zonama

---

## Sve funkcionalnosti

### Za konobara

- ? Meni s artiklima rasporedenim po kategorijama
- ? Odabir stola / zone / kombinacije (fleksibilno per objekat)
- ? Neogranicen broj konobara i uredaja
- ? Narud�ba u realnom vremenu sti�e u �ank/kuhinju
- ? Pregled svojih narud�bi i statusa (na cekanju / zavr�eno)
- ? Prikaz ukupnog iznosa racuna za svaki sto
- ? Napomena uz narud�bu ili uz pojedinu stavku

### Za �ank / kuhinju

- ? Real-time primanje narud�bi s audio alarmom i vibracijama
- ? Automatsko rasporedivanje artikala u odgovarajuci sektor
- ? Neogranicen broj uredaja po sektoru
- ? Podr�ka za vi�e sektora (�ank, kuhinja, ro�tilj, poslasticarnica...)
- ? Prikaz napomene i oznake stola
- ? Brza potvrda zavr�etka � "Zavr�eno" dugme

### Za vlasnike / menad�ere

- ? Real-time pregled svih aktivnih narud�bi
- ? Statistika za danas / 7 dana / 30 dana
- ? Prihod, broj narud�bi, prosjecna vrijednost
- ? Top artikli po prodaji
- ? Anga�man po konobarima (ko je ostvario koliki promet)
- ? Pregled po stolovima i zonama (gdje se najvi�e tro�i)
- ? Upravljanje menijem (dodaj, uredi, obri�i stavke)
- ? Podr�ka za vi�e sektora � svaki sektor ima vlastiti meni

---

## Za koje objekte je pogodna?

| Tip objekta | Primjer koristi |
|---|---|
| ? Kafic / caf� bar | Konobar na terasi �alje narud�bu, �anker pocinje odmah |
| ?? Restoran | Kuhinja dobija hranu, �ank dobija pice � odvojeno, automatski |
| ?? Hotel (bar + restoran) | Vi�e sektora, vi�e spratova � sve pod kontrolom |
| ?? Event / catering | Brza usluga bez papira, uvid u cijeli promet |
| ?? Pub / nocni bar | Vr�ni sati bez gu�ve, alarm na svaku narud�bu |

---

## Planirane opcije *(u razvoju)*

- ?? Graficki prikaz prihoda i broja narud�bi kroz dan / tjedan / mjesec
- ?? Slanje poruka uposlenicima direktno kroz aplikaciju
- ?? Automatski izvje�taj na kraju radnog dana / smjene
- ?? Export statistike u Excel format
- ?? Tihi / glasni mod za alert po smjenama

---

---

# Razvojna dokumentacija

## Implementirano ✅

### Autentifikacija i role
- Firebase Auth (email/password prijava)
- Tri role: **Admin**, **Konobar**, **Bartender/Sanker**
- `useAuth` hook — zaštita ekrana po roli, admin prolazi kroz bilo koji ekran
- Sesija u AsyncStorage: `@role`, `@placeId`, `@waiterName`, `@deviceId`, `@sectorIds`, `@loggedIn`

### Admin panel
- **Dashboard** — statistike za danas / 7 dana / 30 dana:
  - Ukupan prihod, broj narudžbi, prosječna vrijednost, otkazane
  - Top artikli (prikaz: `Kategorija - Naziv`)
  - Top konobari po prihodu
  - Top zone/stolovi po prihodu
- **Preview mode** — admin ulazi u Konobar ili Sektor ekran direktno iz Dashboarda, `@sectorIds` se automatski postavi
- **← Admin** link u headeru konobar/bartender ekrana vraća admina natrag
- **Meni (AdminSettings)** — stablo kategorija i artikala:
  - Hijerarhija: Kategorija → Podkategorija → Artikal
  - Drag & drop redoslijed
  - Ionicons icon picker (horizontalni scroll, 52 halal-friendly ikone)
  - Cijena i sektorska dodjela po artiklu
- **Postavke mjesta (AdminPlaceSettings)**:
  - Sektori (Kuhinja, Šank…) s Ionicons ikonom (44 ikone, horizontalni scroll)
  - Zone s brojem stolova
  - Lokacijski mod: bez lokacije / zone / stolovi / zone + stolovi

### Konobar ekran
- Dinamički meni iz Firestore s cache-iranjem (verzionirana shema)
- Ionicons ikone u category tab baru
- Swipe i tap navigacija između kategorija (FlatList pager, bez flickera)
- Odabir stola / zone po konfiguraciji mjesta
- Napomena po narudžbi i po stavci
- Automatsko ime "Admin" u preview modu (bez modala za ime)

### Moje narudžbe (konobar)
- Live prikaz vlastitih narudžbi (pending / done)
- Prikaz: `Kategorija - Naziv`, količina **crvena** ako > 1
- Sector status badges, brisanje završenih

### Bartender ekran
- Live narudžbe filtrirane po dodijeljenim sektorima
- Artikli grupirani **po kategoriji** unutar narudžbe
- Naziv i količina **crveni** ako qty > 1
- "Ostale stavke" — collapsible sekcija za druge sektore
- `markSectorDone` — narudžba se zatvara tek kad svi sektori završe
- Zvučna notifikacija (expo-av) + haptics + blink animacija

### Infrastruktura
- Firebase Firestore real-time (onSnapshot)
- Expo Router (file-based routing)
- `@expo/vector-icons` Ionicons
- Expo Haptics, Expo Device, Expo AV

---

## Prijedlozi za povećanje vrijednosti

### Visoki prioritet
| Funkcionalnost | Zašto |
|---|---|
| **QR kod po stolu** | Gost/konobar skenira → sto automatski odabran, nema greške |
| **Termalni print** | Kuhinja želi papir (ESC/POS Bluetooth); bez ovog teško u ozbiljnim restoranima |
| **Naplata / račun** | Prikaz ukupnog po stolu, generisanje računa; ključno za restorane |

### Srednji prioritet
| Funkcionalnost | Zašto |
|---|---|
| **Višejezičnost** | EN/DE/TR za turiste i hotele |
| **Alergeni / dijetalne oznake** | Veganski, bezglutenski, halal badge po artiklu |
| **Narudžbe unaprijed** | Catering, korporativni ured, rezervacije |
| **Offline mod** | Slanje kad nema neta, sync po povratku veze |
| **Push notifikacije** | Konobar dobija push kad narudžba gotova |

### Niži prioritet
| Funkcionalnost | Zašto |
|---|---|
| **Grafička analitika** | Vizualni trendovi, usporedba perioda |
| **Multi-tenant SaaS** | Objekt kreira account sam bez developera |
| **Integracija s plaćanjem** | Stripe / lokalni gateway |
| **Export (Excel/PDF)** | Kraj dana / smjene izvještaj |

---

## Tržišni segmenti

### Odmah primjenjivo
Kafić, caffe bar, restoran, pizzeria, fast food, slastičarnica, pekara, beach bar, noćni klub, konoba, food court

### Uz manje prilagodbe
| Segment | Šta nedostaje |
|---|---|
| Hotel | Broj sobe kao lokacija |
| Catering / Events | Višelokacijski setup |
| Stadion / Arena | QR po sjedištu |
| Korporativni ured | Tjedni meni, narudžbe unaprijed |
| Škola / Fakultet | QR po prostoriji / sali |

### Konkurentska prednost
- Radi na bilo kom Android/iOS uređaju — nema skupog hardvera
- Real-time bez osvježavanja
- Višesektorski model (kuhinja + šank neovisno)
- Objekt može biti live za < 1 sat


dodati:
-opcija otkazivanja narudzbe admin setuje i vrijeme u kojem se moze otkazati 1min npr

-admin mora imati uvid ko koristi app i izbrisati korisnike (deviceid+name) se unese kad konobar unese ime/promijeni ga spremi se u firestore

- napraviti da admin moze raditi sve kao konobar, kao sanker, gledat admin dio.. to je za male lokale a i ahmed i hamza su admini a rade kao konobari
znaci trebaju imati svoje ime kao konobari normalno