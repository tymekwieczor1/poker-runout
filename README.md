# Poker Runout Online

Stół pokerowy na kilka telefonów. Host zakłada stół i dostaje 4-znakowy kod, a znajomi wpisują kod u siebie albo skanują kod QR. Każdy widzi tylko swoje karty. Board, kostki i wyniki widzą wszyscy. Host gra jak każdy inny gracz, tylko ma dodatkowe przyciski do prowadzenia gry.

Gry: Hold'em, PLO4, PLO5, PLO6, Ananas · 1–3 boardy · kostka po riverze · punkty z cofaniem i zerowaniem · tryb „ekran stołu” dla tabletu albo laptopa na środku.

---

## Jak wrzucić to do internetu (Render, za darmo)

Potrzebujesz dwóch darmowych kont: **GitHub** (tam trafią pliki) i **Render** (on uruchomi serwer).

### 1. Wrzuć pliki na GitHub
1. Załóż konto na <https://github.com> (jeśli nie masz).
2. Kliknij **+** w prawym górnym rogu, potem **New repository**.
3. Nazwa: `poker-runout`. Zostaw **Public** albo wybierz **Private** (oba działają) i kliknij **Create repository**.
4. Na stronie nowego repozytorium kliknij link **uploading an existing file**.
5. Rozpakuj `poker-runout-online.zip` na komputerze i przeciągnij do okna przeglądarki **zawartość** folderu: `server.js`, `package.json`, `package-lock.json`, `README.md`, `.gitignore` i cały folder `public`.
6. Na dole kliknij **Commit changes**.

### 2. Uruchom serwer na Render
1. Załóż konto na <https://render.com>. Najprościej przez **Sign in with GitHub**.
2. Kliknij **New +**, potem **Web Service**.
3. Wybierz repozytorium `poker-runout`. Jeśli go nie widać, kliknij **Configure account** i daj Renderowi dostęp do tego repozytorium.
4. Ustawienia:
   - **Region:** Frankfurt (EU Central), najbliżej Polski
   - **Language / Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Kliknij **Create Web Service** i poczekaj 2–3 minuty, aż pojawi się **Live**.
6. U góry zobaczysz adres w stylu `https://poker-runout-xxxx.onrender.com`. To jest twoja gra. Wyślij go znajomym albo po prostu pokaż im kod stołu.

### Aktualizacja do nowej wersji (gdy serwis na Renderze już działa)
1. Rozpakuj nową paczkę.
2. W repozytorium na GitHubie wybierz **Add file**, potem **Upload files** i przeciągnij całą zawartość folderu (pliki i folder `public`). GitHub podmieni stare pliki.
3. Kliknij **Commit changes**. Render sam zauważy zmianę i po 1–2 minutach postawi nową wersję. Postęp widać na Renderze w zakładce **Events**.

### Dobrze wiedzieć
- **Darmowy plan usypia serwer** po ok. 15 minutach bez ruchu. Pierwsze wejście po przerwie trwa wtedy do minuty. Podczas gry serwer nie zaśnie.
- **Stoły trzymane są w pamięci serwera.** Gdy serwer się uśpi albo zrestartuje (np. po wrzuceniu nowej wersji), otwarte stoły i punkty znikają. Trwały zapis gier dorobimy później.
- **Nowa wersja gry:** podmień pliki w repozytorium na GitHubie (Add file, potem Upload files). Render sam zbuduje i uruchomi nową wersję.

---

## Jak się gra

1. **Host:** wpisuje imię, wybiera **Załóż stół** i dostaje kod (np. `K7QF`). Przycisk z kodem u góry pokazuje duży kod, kod QR i link do skopiowania.
2. **Gracze:** wchodzą na stronę, wpisują imię i kod i klikają **Dołącz**. Mogą też zeskanować QR, wtedy kod wpisze się sam.
3. **Host** ustawia grę (Ustawienia): wersję, stawkę, liczbę boardów, kostkę i to, czy karty są ukryte, czy odkryte dla wszystkich. Potem klika **Rozdaj**, a następnie Flop, Turn, River, Rzuć kostką i Pokaż zwycięzcę. Czerwony przycisk **▶** przeprowadza rozdanie automatycznie (czeka na potwierdzenia graczy).
4. **Potwierdzenia:** po każdym etapie (rozdanie, flop, turn, river, kostka, wyniki) każdy gracz ma przycisk **Gotowy**. Host może pójść dalej, gdy wszyscy potwierdzą albo gdy minie 30 sekund. Na przycisku hosta widać licznik, np. „Czekamy na graczy 2/4 · 18 s”.
5. **Każdy gracz** widzi u siebie panel „Twoje karty” z układem na każdym boardzie. W Ananasie po flopie każdy dotyka kartę do wyrzucenia u siebie. Host może wyrzucić automatycznie za kogoś, kto zwleka.
6. **Ekran stołu:** na tablecie albo laptopie wpisz kod i wybierz „To jest ekran stołu”. Pokaże stół i wyniki bez niczyich kart.

Inne:
- Gracze mogą dołączać i odchodzić w trakcie gry. Nowa osoba dostaje karty od następnego rozdania.
- „Pauzuję” w menu sprawia, że gracz nie dostaje kart, aż wróci.
- Host może przekazać prowadzenie innemu graczowi albo usunąć kogoś ze stołu.
- Gdy telefon zaśnie albo strona się przeładuje, gra sama wraca do stołu.

## Uruchomienie lokalne (dla ciekawych)

```bash
npm install
npm start
# otwórz http://localhost:3000
```

Wymaga Node.js 18 lub nowszego.
