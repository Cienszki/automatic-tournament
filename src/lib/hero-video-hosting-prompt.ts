import type { HeroMediaSlot } from '@/types/tournament';
import { HERO_SLOT_VIDEO_SHAPE } from '@/lib/hero-video';

/**
 * Prompt organizers paste into any AI chat to get walked through preparing and
 * hosting a hero video themselves (the platform only hosts videos for its own
 * tournaments). Written for the AI, in Polish because the organizers are — and
 * specific enough that the AI doesn't have to guess our requirements.
 *
 * Keep the requirements in sync with what the site actually does: the edge fade
 * and CRT overlay are applied by the page, the video is always muted, the link
 * is played by a plain <video> tag, and Bunny Stream links are converted to
 * their MP4 by the panel (src/lib/bunny-stream-link.ts).
 */
export function buildHeroVideoHostingPrompt(slot: HeroMediaSlot): string {
  return `Pomóż mi krok po kroku przygotować i opublikować krótkie, zapętlone wideo do sekcji głównej strony turnieju Dota 2 na dota2inhouse.pl. Na końcu potrzebuję dwóch rzeczy do wklejenia w panelu organizatora: bezpośredniego linku do pliku wideo i (opcjonalnie) linku do miniatury.

Odpowiadaj po polsku. Zanim zaczniesz, zapytaj mnie:
1. Jakiego systemu używam (Windows, macOS, Linux) i czy wolę program z okienkami, czy wiersz poleceń.
2. Jaki mam plik źródłowy — format, długość, rozdzielczość, wielkość. Jeśli nie wiem, pokaż mi, jak to sprawdzić.
3. Czy mam już jakiś hosting, własną stronę albo konto w chmurze (np. bunny.net, Cloudflare).
Potem prowadź mnie po jednym kroku naraz i czekaj, aż potwierdzę, że się udało.

## Jak strona używa wideo (żebyś rozumiał wymagania)
Strona odtwarza plik w zwykłym znaczniku <video>: automatycznie, bez dźwięku, w pętli, rozciągnięty na cały panel (object-fit: cover — nadmiar kadru jest przycinany). Sama wygasza krawędzie wideo w tło strony i opcjonalnie nakłada efekt monitora CRT. Każdy odwiedzający pobiera cały plik — również na telefonie — więc rozmiar ma ogromne znaczenie.

Kształt panelu, do którego jest to wideo: ${HERO_SLOT_VIDEO_SHAPE[slot]}

## Wymagania dotyczące pliku
- Kontener MP4, kodek wideo H.264 (profil High), piksele yuv420p. Bez ścieżki audio — i tak jest wyciszane, a tylko zwiększa rozmiar.
- Szerokość maksymalnie 1920 px (1080p), 24–30 klatek na sekundę.
- Długość 10–20 sekund. Koniec musi płynnie przechodzić w początek — w pętli nie może być widać skoku.
- Rozmiar najlepiej poniżej 8 MB, maksymalnie ok. 15 MB.
- Metadane na początku pliku („fast start” / „Web Optimized”), żeby wideo ruszało, zanim pobierze się całe.
- Czysty obraz: bez własnych ramek, winiety, efektu CRT, wygaszania krawędzi czy napisów przy brzegach — strona robi to sama, a brzegi są wygaszane i przycinane.

## Kompresja — zaproponuj jedną drogę, zależnie od moich odpowiedzi
Jeśli wybiorę Bunny Stream (niżej), pomiń ten krok — Bunny kompresuje wideo sam, wystarczy przyciąć pętlę do 10–20 s.
A) HandBrake (darmowy, z okienkami). Ustawienia: Format MP4 z zaznaczonym „Web Optimized”; Video Encoder H.264 (x264); Framerate 30, Constant Framerate; Constant Quality RF 24–28; Encoder Preset „slow”; Profile „High”; w zakładce Dimensions maksymalna szerokość 1920; w zakładce Audio usuń wszystkie ścieżki. Jeśli plik wyjdzie za duży, podnieś RF o 2 i zakoduj ponownie (wyższe RF = mniejszy plik, niższa jakość).
B) ffmpeg (wiersz poleceń):
ffmpeg -i wejscie.mp4 -an -vf "scale='min(1920,iw)':-2,fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 26 -profile:v high -movflags +faststart wideo.mp4
Aby wyciąć fragment, dodaj przed -i np. -ss 00:00:05 -t 15. Jeśli plik jest za duży, podnieś -crf o 2; jeśli jakość jest za słaba, obniż.
Jeśli koniec nie pasuje do początku, pomóż mi zrobić płynne przejście (np. krótkie przenikanie końcówki z początkiem) w narzędziu, którego używam.

## Miniatura (zalecana)
Jedna klatka z wideo jako JPG, maksymalnie 1280 px szerokości, ok. 100–200 KB. Widzą ją osoby z włączonym ograniczeniem animacji lub oszczędzaniem danych, a także wszyscy, zanim wideo się załaduje. Przykład w ffmpeg:
ffmpeg -ss 0.1 -i wideo.mp4 -frames:v 1 -vf "scale='min(1280,iw)':-2" -q:v 3 miniatura.jpg

## Gdzie opublikować plik — pomóż mi wybrać i skonfigurować
- Bunny Stream (najprostsze — sam kompresuje wideo, więc mogę wgrać plik prosto z edytora; serwery w Europie; minimum ok. 1 USD miesięcznie). Kroki:
  1. Załóż konto na bunny.net i dodaj bibliotekę wideo (Stream → Add Video Library), główny region w Europie.
  2. ZANIM wgrasz film: w ustawieniach biblioteki → Encoding włącz „MP4 Fallback”. Filmy wgrane przed włączeniem tej opcji nie dostaną plików MP4 i nie zadziałają na stronie — trzeba je wgrać ponownie.
  3. W ustawieniach biblioteki → Security zostaw wyłączone „Token authentication” i „Block direct URL file access”. Jeśli ustawisz listę „Allowed domains”, dodaj do niej dota2inhouse.pl.
  4. Wgraj film (Add Media → Upload) i poczekaj, aż skończy się przetwarzanie.
  5. Na stronie filmu, w sekcji „Video and asset links”, skopiuj „HLS Playlist URL” albo „Direct play URL” i wklej go w panelu organizatora. Panel sam zamieni go na plik MP4, dobierze miniaturę i lżejszą wersję na telefony — pole miniatury możesz zostawić puste, a punkty 2–3 z listy kontrolnej na końcu pominąć.
- Cloudflare R2: darmowe 10 GB miejsca i brak opłat za transfer. Utwórz bucket, włącz publiczny dostęp (adres r2.dev albo własna domena), wgraj oba pliki, skopiuj ich publiczne adresy.
- bunny.net Storage z Pull Zone: tanio, serwery w Europie, minimum ok. 1 USD miesięcznie.
- Własny hosting lub strona, jeśli już ją mam — wgranie przez FTP albo panel hostingu.
Nie nadają się: YouTube i Vimeo (to linki do odtwarzacza, nie do pliku), Google Drive, OneDrive i Dropbox (strony pośrednie, limity transferu), linki z Discorda (wygasają po około dobie), Streamable, WeTransfer.

## Link musi spełniać — przeprowadź mnie przez tę listę na końcu
1. Zaczyna się od https:// i prowadzi bezpośrednio do pliku (zwykle kończy się na .mp4). Wyjątek: link z Bunny Stream — panel przerobi go sam.
2. Otwarty w oknie prywatnym/incognito od razu odtwarza samo wideo — bez logowania, strony pośredniej i reklam.
3. Serwer zwraca nagłówki Content-Type: video/mp4 oraz Accept-Ranges: bytes. Pokaż mi, jak to sprawdzić (np. curl -I "LINK" albo narzędzia deweloperskie przeglądarki → zakładka Sieć).
4. Plik nie zniknie ani nie zmieni adresu do końca turnieju.
5. Opcjonalnie: nagłówek Access-Control-Allow-Origin: * — wtedy panel organizatora pokaże mi rozmiar pliku i ostrzeże, jeśli jest za duży.

Na koniec podaj mi gotowe do wklejenia: link do wideo i link do miniatury.`;
}
