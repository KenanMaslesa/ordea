# Ordea — Developer Reference

Dokument za brzu orijentaciju u kodu. Čitaj kad se vratiš nakon pauze.

---

## Tech Stack

- **React Native** + **Expo Router** (file-based routing, `app/` folder)
- **Firebase Firestore** — real-time baza, multi-tenant
- **Firebase Auth** — samo za admin (email/password)
- **AsyncStorage** — lokalni podaci na uređaju (helper: `app/helper.ts`)
- **expo-av** — zvuk notifikacija
- **expo-haptics** — vibracije
- **@gorhom/bottom-sheet** — korpa u waiter ekranu

---

## Firestore Struktura

```
DEV:   dev_places/{placeId}/...
PROD:  places/{placeId}/...
```

> `__DEV__` (React Native global) određuje putanju — NE `process.env.NODE_ENV`.
> Definirano u `firebase.ts`.

```
places/
  {placeId}/
    orders/
      {orderId}        ← Order dokument
    menu/
      {nodeId}         ← MenuNode dokument (flat lista, gradi se u stablo)

(root-level)
places/{placeId}       ← Place dokument (ime, joinCode, sektori, zones...)
users/{uid}            ← { placeId, role: "admin" }
```

### Path helperi (firebase.ts)

```ts
placesRoot()           // "dev_places" | "places"
ordersPath(placeId)    // "places/{placeId}/orders"
menuPath(placeId)      // "places/{placeId}/menu"
```

---

## Auth Model

| Uloga | Auth | Identifikacija |
|---|---|---|
| **Admin** | Firebase Auth (email/password) | `auth.currentUser.uid` |
| **Konobar** | Nema — join code | `@waiterName` + `@deviceId` u AsyncStorage |
| **Šanker/Kuhar** | Nema — join code | `@sectorId` u AsyncStorage |

`useAuth(expectedRole)` hook — ako uloga ne odgovara, redirecta na `/join`.

---

## AsyncStorage Ključevi (`app/helper.ts`)

```
@placeId      ← ID objekta
@role         ← "waiter" | "bartender"
@waiterName   ← ime konobara
@deviceId     ← generisan device ID (waiter identifikator)
@loggedIn     ← admin login flag
@menuCache    ← JSON: { version: number, schemaV: number, menu: DynCat[] }  ← KEŠIRAN MENI
@sectorId     ← ID sektora za bartender
```

---

## Meni Sistem — Keširenje ⚠️ VAŽNO

### Zašto keš?

Meni se rijetko mijenja. Bez keša, svako otvaranje app-a čita N Firestore dokumenata. Sa kešom, Firestore se čita samo kad admin napravi izmjenu.

### Kako radi (waiter.tsx)

```
App se otvori
    │
    ├─► getItem("@menuCache") → prikaži odmah iz AsyncStorage (nema čekanja)
    │
    └─► onSnapshot(placeDoc) → sluša SAMO place dokument (1 doc, ne cijeli meni)
              │
              ├─ serverVersion === cachedVersion → ne radi ništa ✓
              │
              └─ serverVersion !== cachedVersion → getDocs(menuPath) → rebuild → setItem("@menuCache", ...)
```

### Kako admin triggeruje osvježenje

Svaki put kad admin doda/uredi/obriše stavku ili kategoriju u `AdminSettings.tsx`:

```ts
await incrementMenuVersion(placeId)  // uvećava place.menuVersion za 1
```

Waiter-ov listener to detektuje → fetchuje novi meni → updateuje keš.

### Cache Schema Verzionisanje (CACHE_SCHEMA_V)

Konst `CACHE_SCHEMA_V` u `waiter.tsx` služi za invalidaciju keša kad se **promijeni logika `buildMenu()`** (npr. prelazak s flat na rekurzivni algoritam), a `menuVersion` na serveru se **nije promijenio**.

```ts
const CACHE_SCHEMA_V = 2; // bump kad se mijenja buildMenu logika
```

| Situacija | Šta se desi |
|---|---|
| `schemaV` u kešu < `CACHE_SCHEMA_V` | Keš se ignorira → fresh fetch sa Firestore |
| `schemaV` == `CACHE_SCHEMA_V` i `version` == serverVersion | Keš se koristi ✓ |
| `version` != serverVersion | Fresh fetch (admin je napravio izmjenu) |

**Pravilo:** Svaki put kad se mijenja `buildMenu()` logika u `waiter.tsx`, uvećaj `CACHE_SCHEMA_V` za 1. Svi klijenti će automatski dobiti svježi meni pri sljedećem otvaranju app-a.

**Format keša u AsyncStorage:**
```json
{ "version": 5, "schemaV": 2, "menu": [...] }
```

### MenuNode stablo

Firestore čuva meni kao **flat listu** `MenuNode[]`. `buildMenu()` u `waiter.tsx` gradi hijerarhiju:

```
MenuNode (type: "category", parentId: null)   ← top-level kategorija (tab)
  └─ MenuNode (type: "category", parentId: catId)  ← potkategorija (sekcija)
       └─ MenuNode (type: "item", parentId: subId)  ← stavka
  └─ MenuNode (type: "item", parentId: catId)   ← direktna stavka (virtual sub)
```

`MenuNode.sectorId` — koji sektor sprema ovu stavku (šank, kuhinja...).

---

## Sektor Sistem

Sektori su liste tipa `Sector[]` na `Place` dokumentu:
```ts
{ id: string; name: string; emoji?: string }
```

### Tok narudžbe sa sektorima

1. **Admin** definiše sektore u `AdminVenueSettings.tsx`
2. **Admin** assignuje svaku meni stavku sektoru u `AdminSettings.tsx`
3. **Bartender** pri join-u odabere sektor → sprema `@sectorId`
4. **Konobar** kreira narudžbu — svaka stavka ima `sectorId` iz menija
5. `createOrder` automatski gradi:
   ```ts
   sectorStatus: { "sank_id": "pending", "kuhinja_id": "pending" }
   sectorNames:  { "sank_id": "Šank", "kuhinja_id": "Kuhinja" }
   sectorFinishedAt: {}
   ```
6. **Bartender (šank)** vidi samo stavke s `sectorId === @sectorId`
7. Pritisne "Završeno" → `markSectorDone()`:
   - Piše `sectorStatus.{sectorId} = "done"`
   - Ako su SVI sektori done → `status = "done"`, `finishedAt = now`
8. **Konobar** dobija notifikaciju kada se sektor završi

### Backward kompatibilnost

Narudžbe bez `sectorId` (stare ili iz statičnog menija) — `sectorStatus` je prazan.
`markSectorDone` i bartender to detektuju i ne pucaju.

---

## Location Sistem

Svaki Place ima `locationMode: "none" | "zones" | "tables" | "zones_tables"`.

| Mod | Region format |
|---|---|
| `none` | `""` |
| `zones` | `"Terasa"` |
| `tables` | `"Sto 5"` |
| `zones_tables` | `"Terasa · Sto 3"` |

Konobar bira zonu/sto u bottom sheet-u. `region` se sprema u narudžbu.

---

## Multi-Tenant

Svaki kafić/restoran je jedan `Place` dokument. Svaki place ima:
- Vlastiti meni (`menu/` subcollection)
- Vlastite narudžbe (`orders/` subcollection)
- Vlastiti join code (6 karaktera, jedinstvenost garantovana pri kreiranju)
- Vlastite sektore i zone

### Join Code Jedinstvenost

`generateUniqueJoinCode()` u `place.service.ts`:
1. Generira random 6-char kod (alfabet bez O, 0, I, 1 — nema konfuznih karaktera)
2. Provjeri Firestore da li već postoji
3. Ako postoji, generira novi — loop dok ne nađe slobodan
4. ~1 milijarda kombinacija, kolizija praktički nemoguća ali zaštita postoji

---

## Ključni Fajlovi

```
firebase.ts                          ← konfiguracija, path helperi
app/
  _layout.tsx                        ← root navigator (Stack)
  index.tsx                          ← ruta: čita @role, redirecta
  login.tsx                          ← admin login
  join.tsx                           ← join flow (kod → uloga → sektor/ime)
  waiter.tsx                         ← konobar ekran (meni + korpa + narudžbe)
  bartender.tsx                      ← šank/kuhinja ekran (real-time narudžbe)
  admin.tsx                          ← admin (3 taba: dashboard, meni, postavke)
  helper.ts                          ← AsyncStorage wrapper (web fallback na localStorage)

  types/
    order.types.ts                   ← SVE TypeScript vrste (Order, Place, MenuNode, Sector...)

  services/
    orders.service.ts                ← listenOrders, createOrder, markSectorDone, cancelOrder...
    place.service.ts                 ← createPlace, getPlaceByJoinCode, updateSectors...

  hooks/
    useAuth.ts                       ← provjera uloge, redirect
    useOrders.ts                     ← real-time listener za sve narudžbe
    useMyOrders.ts                   ← narudžbe jednog konobara
    useOrderDoneListener.ts          ← zvuk/notifikacija kad narudžba (ili sektor) završi

  screens/
    MyOrdersScreen.tsx               ← konobarove narudžbe s statusom sektora
    admin/
      AdminDashboard.tsx             ← statistike (prihod, top artikli, konobari, zone)
      AdminSettings.tsx              ← upravljanje menijem (CRUD MenuNode stabla)
      AdminVenueSettings.tsx         ← lokacija, zone, sektori, join code

  components/
    withAuth.tsx                     ← HOC za zaštitu ruta
```

---

## Narudžba — Kompletan Životni Ciklus

```
Konobar bira stavke
    │  (svaka stavka ima sectorId iz Firestore menija)
    ▼
createOrder() → Firestore orders/{orderId}
    { status: "pending", sectorStatus: { A: "pending", B: "pending" }, sectorNames: {...} }
    │
    ├─► Bartender A (sank) — vidi stavke s sectorId === A
    │       pritisne Završeno → markSectorDone(A)
    │       → sectorStatus.A = "done"
    │       → provjeri: da li su svi sektori done?
    │           NE → narudžba ostaje "pending"
    │
    ├─► Bartender B (kuhinja) — vidi stavke s sectorId === B
    │       pritisne Završeno → markSectorDone(B)
    │       → sectorStatus.B = "done"
    │       → provjeri: svi sektori done? DA
    │           → status = "done", finishedAt = now
    │
    └─► Konobar dobija notifikaciju (useOrderDoneListener):
            - po sektoru: kad A ili B završi
            - kompletno: kad status = "done"
```

---

## AdminDashboard — Statistike

- Period: Danas / 7 dana / 30 dana (filter po `dayKey` polju, format `"YYYY-MM-DD"`)
- KPI: ukupan prihod, broj narudžbi, prosječna vrijednost, broj otkazanih
- Top stavke po količini
- Top konobari po prihodu (`waiterId` grupiranje)
- Top zone/stolovi po prihodu (`region` grupiranje)

---

## Planirane Funkcionalnosti (nije implementirano)

- 📊 Grafovi (react-native-chart-kit ili Victory Native)
- 📩 Admin → staff poruke (nova Firestore kolekcija `messages/`)
- 📄 Excel export (expo-file-system + xlsx library)
- 📅 Automatski dnevni izvještaj (Firebase Cloud Functions ili cron job)
