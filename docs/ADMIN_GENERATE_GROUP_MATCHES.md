# Instrukcja: Generowanie meczów fazy grupowej (Wiosenna)

**Dotyczy:** turnieje MMR-limitowane (np. Wiosenna Batalia) z fazą grupową  
**Cel:** Wygenerowanie wszystkich meczów round-robin w grupach z deadlinem 04.07.2026,  
bez z góry ustalonych godzin — kapitanowie sami umawiają terminy.

---

## Wymagania wstępne

Przed generowaniem meczów upewnij się, że:

1. **Grupy istnieją** — w zakładce „Grupy" muszą być utworzone co najmniej 2 grupy (np. Grupa A i Grupa B).
2. **Drużyny są przypisane do grup** — każda drużyna musi mieć ustawione `groupId`. Sprawdź to w sekcji „Przypisanie drużyn do grup" w tej samej zakładce.
3. **Każda grupa ma co najmniej 2 drużyny** — generowanie działa tylko gdy są co najmniej 2 drużyny.

---

## Kroki

### 1. Przejdź do panelu admina

Otwórz: **`/wiosenna/admin`**

---

### 2. Przejdź do zakładki „Grupy"

Kliknij zakładkę **„Grupy"** na górze panelu admina (ikona siatki).

---

### 3. Znajdź sekcję „Generuj mecze grupowe"

Przewiń w dół strony — pod sekcją przypisywania drużyn znajdziesz kartę zatytułowaną **„Generuj mecze grupowe"** (ikona pioruna ⚡).

---

### 4. Ustaw datę deadline

W polu **„Deadline (ostateczna data)"** wpisz lub wybierz:

```
2026-07-04
```

Jest to data, do której kapitanowie muszą rozegrać swoje mecze. Mecze będą widoczne w harmonogramie z tą datą jako domyślnym terminem, dopóki kapitanowie nie ustalą własnego.

---

### 5. Wygeneruj mecze dla Grupy A

Kliknij przycisk **„Generuj mecze: Grupa A"** (lub jak nazywa się Twoja pierwsza grupa).

Poczekaj na potwierdzenie — pojawi się komunikat z liczbą utworzonych meczów, np.:
> *„Mecze grupy „Grupa A" wygenerowane — Utworzono: 6, pominięto (istniały): 0."*

---

### 6. Wygeneruj mecze dla Grupy B

Kliknij przycisk **„Generuj mecze: Grupa B"**.

Poczekaj na potwierdzenie analogiczne jak wyżej.

---

### 7. Zweryfikuj wygenerowane mecze

1. Przejdź do zakładki **„Mecze"** w panelu admina.
2. Sprawdź, że pojawiły się nowe mecze dla obu grup.
3. Każdy mecz powinien mieć status **`unscheduled`** — oznacza to, że termin nie jest jeszcze ustalony przez kapitanów.

---

## Co dzieje się po wygenerowaniu meczów?

| Pole meczu | Wartość | Opis |
|------------|---------|------|
| `schedulingStatus` | `unscheduled` | Kapitanowie muszą sami ustalić termin |
| `scheduledFor` | `2026-07-04T23:59:59` | Deadline jako domyślna data wyświetlana |
| `status` | `pending` | Mecz nie jest jeszcze rozegrany |
| `series_format` | `bo2` | Format: best-of-2 |
| `group_id` | ID grupy | Mecz przypisany do danej grupy |

---

## Jak kapitanowie umawiają mecze?

Po wygenerowaniu meczów kapitanowie mogą:

1. Przejść do strony harmonogramu turnieju.
2. Wybrać swój mecz i zaproponować termin (datę i godzinę).
3. Kapitan drużyny przeciwnej potwierdza proponowany termin.
4. Po potwierdzeniu mecz zmienia status na `confirmed`.

**Ważne:** Jeśli kapitanowie nie umówią meczu przed deadlinem (04.07.2026), admin może ręcznie ustawić termin lub zarządzić walkower.

---

## Obsługa błędów

| Komunikat | Przyczyna | Rozwiązanie |
|-----------|-----------|-------------|
| „Brak drużyn w grupie" | Grupa nie ma przypisanych drużyn | Przypisz drużyny do grupy przed generowaniem |
| „pominięto (istniały): X" | Niektóre mecze już były | Normalny stan przy ponownym kliknięciu — duplikaty są pomijane |
| „Błąd generowania meczów" | Problem z bazą danych | Spróbuj ponownie; jeśli błąd się powtarza, sprawdź połączenie z Firebase |

---

## Uwagi

- **Bezpieczne do ponownego uruchomienia** — kliknięcie przycisku ponownie nie tworzy duplikatów. Istniejące pary są automatycznie pomijane.
- **Format round-robin** — każda drużyna zagra raz z każdą inną drużyną w swojej grupie. Dla N drużyn: N×(N-1)/2 meczów na grupę.
  - 4 drużyny → 6 meczów
  - 5 drużyn → 10 meczów
  - 6 drużyn → 15 meczów
