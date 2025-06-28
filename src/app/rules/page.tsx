
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";
import Link from "next/link";

export default function RulesPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(/backgrounds/rules.png)` }} 
          data-ai-hint="neon fantasy space"
        />
        <div className="relative z-10">
           <ScrollText className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            Regulamin Turnieju "Jesienna Zadyma"
          </h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
            Prosimy o dokładne zapoznanie się z regulaminem, aby zapewnić uczciwą grę i płynny przebieg turnieju dla wszystkich uczestników.
          </p>
        </div>
      </Card>

      <Card>
        <CardContent className="p-6 md:p-8 space-y-6 prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl 2xl:prose-2xl mx-auto dark:prose-invert">
          <section id="administratorzy-zapisy">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">1. Administratorzy i Zapisy</h2>
            <p><strong>Administratorzy:</strong> Cienszki, SATO, AxePerson, vanRooD</p>
            <p>Zapisy trwają od <strong>16.09.24</strong> do <strong>28.09.2024</strong> do północy (czasu polskiego).</p>
            <p>Kapitan drużyny jest odpowiedzialny za:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Kontakt z administracją i innymi uczestnikami turnieju.</li>
              <li>Zapisanie drużyny na kanale Zapisy oraz Challonge pod linkiem <Link href="#" className="text-accent hover:underline">LINK</Link> (<Link href="#" className="text-accent hover:underline">instrukcja wideo</Link>).</li>
              <li>Informowanie jej członków na temat regulaminu, ogłoszeń i wszystkich pozostałych kwestii organizacyjnych.</li>
            </ul>
          </section>

          <section id="mmr">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">2. Zasady MMR</h2>
            <p>Sumaryczny MMR wszystkich 5-ciu zawodników w drużynie nie może przekroczyć <strong>22000</strong>, np:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>5000+5000+5000+5000+5000 = 25000 {"<-"} <span className="text-destructive">❌za dużo</span></li>
                <li>5000+5000+5000+5000+2000 = 22000 {"<-"} <span className="text-green-400">✅max, dopuszczalny</span></li>
                <li>5000+5000+5000+4000+2000 = 21000 {"<-"} <span className="text-green-400">✅prawidłowo, można grać</span></li>
            </ul>
            <p>Kapitan musi wysłać zrzuty ekranu zawierające MMR wszystkich członków drużyny do jednego z adminów: Cienszki lub AxePerson.</p>
            <p>Nieskalibrowani gracze będą rozpatrywani indywidualnie. Na podstawie historii ich gier administracja zdecyduje o randze na tyle dokładnie na tyle ile będzie to możliwe.</p>
            <p>Gracze posiadający mniej niż 1000 MMR liczeni będą za 1000.</p>
          </section>

          <section id="format-turnieju">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">3. Format Turnieju</h2>
            <p>Turniej składa się z dwóch etapów: Faza grupowa oraz Drabinka.</p>
            <h3 className="text-xl font-semibold text-accent mt-4 mb-2">Faza grupowa:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>W systemie szwajcarskim na platformie Challonge (System szwajcarski to sposób rozgrywania turnieju, w którym uczestnicy grają kilka rund z przeciwnikami o podobnych wynikach, a nie każdy z każdym - <Link href="#" className="text-accent hover:underline">link</Link>).</li>
              <li>Mecze rozgrywane są w formacie BO1.</li>
              <li>Przeciwnicy na kolejną rundę zostaną wyłonieni dopiero po rozegraniu wcześniejszej.</li>
            </ul>
            <h3 className="text-xl font-semibold text-accent mt-4 mb-2">Drabinka (Play-off):</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Drabinka składa się z Drabinki Wygranych (DW) i Drabinki Przegranych (DP).</li>
              <li>12 drużyn z najgorszym wynikiem po Fazie Grupowej odpada z turnieju.</li>
              <li>8 drużyn z najlepszymi wynikami trafia do Drabinki Wygranych.</li>
              <li>Pozostałe 8 drużyn trafia do Drabinki Przegranych (DP).</li>
              <li>Mecze DW odbywają się w trybie BO3.</li>
              <li>Mecze DP odbywają się w trybie BO1 a od rundy 3. włącznie - B03.</li>
              <li>Drużyna po przegranym meczu DW spada do DP.</li>
              <li>Drużyny które przegrają swoje mecze w DP odpadają z turnieju.</li>
            </ul>
          </section>

          <section id="harmonogram">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">4. Harmonogram Meczów</h2>
            <p>Mecze muszą zostać rozegrane zgodnie z poniższym harmonogramem. Mecze muszą być rozegrane do północy 23:59 ostatniego dnia terminów (Czwartki/Niedziele).</p>
            <h3 className="text-xl font-semibold text-accent mt-4 mb-2">Faza grupowa:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do 03/10 (Czwartek) 23:00 RUNDA 1</li>
              <li>Do 06/10 (Niedziela) 23:00 RUNDA 2</li>
              <li>Do 10/10 (Czwartek) 23:00 RUNDA 3</li>
              <li>Do 13/10 (Niedziela) 23:00 RUNDA 4</li>
              <li>Do 17/10 (Czwartek) 23:00 RUNDA 5</li>
            </ul>
            <h3 className="text-xl font-semibold text-accent mt-4 mb-2">Drabinka play-off:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do 20/10 (Niedziela) 23:00 RUNDA 1 DW i DP</li>
              <li>Do 24/10 (Czwartek) 23:00 RUNDA 2 DW i DP</li>
              <li>Do 27/10 (Niedziela) 23:00 RUNDA 3 DW i Semifinal DP</li>
              <li>Do 31/10 (Czwartek) 23:00 RUNDA 4 i 5 DP</li>
              <li>03/11 Finał DP oraz Wielki Finał</li>
            </ul>
          </section>

          <section id="terminy-punktualnosc">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">5. Terminy Meczów i Punktualność</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Ostateczny termin meczu:</strong> W przypadku gdy drużyny nie mogą dojść do porozumienia w kwestii terminu, ostatecznym terminem jest godzina 20:00 ostatniego dnia Rundy.</li>
              <li>Drużyna która nie stawi się na mecz w ustalonym (lub ostatecznym pkt.1) terminie to przegrywa spotkanie.</li>
              <li>W przypadku gdy mecz się nie odbędzie, bo nie został ustalony termin lub drużyny się nie stawiły do ostatecznego terminu (pkt. 1) obie drużyny ponoszą porażkę.</li>
              <li>Dopuszcza się 15 min spóźnienia na ustalony termin meczu.</li>
              <li>Jeśli drużyna nie pojawi się po 15 min to przegrywa mecz, a przypadku spotkań rozgrywanych BO3/BO5 przegrywa jeden z meczy z całej serii i otrzymuje kolejne 15 min na stawienie się do meczu.</li>
              <li>Po zakończonym meczu Kapitan wygranej drużyny musi wpisać wynik na Challonge niezwłocznie po zakończonym meczu.</li>
            </ol>
          </section>

          <section id="ustawienia-meczu">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">6. Ustawienia Meczu i Procedury</h2>
            <p>Kapitanowie zobowiązani są do stworzenia poczekalni przed meczem zgodnie z następującymi wytycznymi: (<Link href="#" className="text-accent hover:underline">podgląd tutaj</Link>)</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Tryb: Captains Mode</li>
              <li>Wybór stron/Selection Priority: Automatic(Coin toss)</li>
              <li>Opóźnienie: 5 min</li>
              <li>Ustawienie ligi turniejowej (League): Jesienna Zadyma</li>
              <li>Serwer: Europa West/Austria</li>
              <li>Widoczność: publiczna</li>
            </ul>
            <p className="mt-2">Pauzowanie dopuszczalne jest zgodnie z regułami wewnątrz gry tzn. Przeciwna drużyna może odpauzować kiedy jest taka możliwość. To samo dotyczy sytuacji gdy gracz opuści grę.</p>
            <p>Dopuszcza się opcje rehostowania gry w ciągu pierwszych 5 min (od czasu gry 0:00) jeśli kapitanowie obu drużyn wyrażą zgodę. Po upływie 5 min nie ma takiej możliwości. Rehostowanie może zdarzyć się tylko w przypadku bugów w grze, crashu serwera, lub kiedy z powodu błędu w grze gracz nie może ponownie połączyć się z rozgrywką.</p>
          </section>

          <section id="standins">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">7. Stand-ins (Zawodnicy Rezerwowi)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>W przypadku konieczności zastąpienia zawodnika tzw. Standinem, dopuszczalna jest wymiana maksymalnie 2 zawodników przez drużynę. Spełniając poniższe warunki:</li>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                    <li>Drużyna grająca ze standnin’em nie może przekroczyć sumarycznego limitu 22000 MMR.</li>
                    <li>Standin nie może być członkiem innego zespołu biorącego aktualnie udział w turnieju. Można natomiast wykorzystać zawodnika który z turnieju już odpadł (pamiętając o pkt. 1).</li>
                </ul>
              <li>W razie problemu ze znalezieniem standina prosimy o kontakt z administracją.</li>
              <li>Kapitan ma obowiązek bezzwłocznie zweryfikować MMR standin’a z administracją.</li>
            </ol>
          </section>

          <section id="zabronione">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">8. Działania Zabronione</h2>
            <p>ZABRONIONE jest:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Smurfowanie.</li>
              <li>Granie jednego zawodnika na więcej niż jednym koncie.</li>
              <li>Granie zawodnika w więcej niż 1 drużynie.</li>
              <li>Korzystanie z trenerów w czasie meczu.</li>
              <li>Wykorzystywanie zewnętrznych programów ułatwiających rozgrywkę, skryptów oraz cheatów.</li>
              <li>Wykorzystywanie bugów i exploitów które nie powinny mieć miejsca np. Niszczenie fontanny, korzystanie z midas buga, itp.</li>
            </ul>
          </section>

          <section id="kodeks-postepowania">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">9. Kodeks Postępowania i Kary</h2>
            <p>Oczekuje się, że wszyscy gracze wykażą się pozytywną postawą i zachowają szacunek dla organizatorów, innych graczy i widzów. Wykażą się uczciwością i będą stosować zasadę fair play. Każdy zawodnik, który zachowuje się niewłaściwie lub narusza regulamin może podlegać karze dyskwalifikacji (np. publicznie obrażanie, znęcanie się, szkalowanie organizatorów, uczestników lub widzów) oraz stracić możliwość przyszłego udziału lub wygrania potencjalnych nagród. Dotyczy to wszystkich otwartych kanałów np. Discord, Twitch itp.</p>
            <p>Zachowaniem niedopuszczalnym jest abusowanie pauzy tzn. używanie pauzy w krytycznych momentach gry: teamfight, lub środek akcji. W takich przypadkach incydent powinien zostać zgłoszony do administracji, a drużyna nadużywająca pauzy otrzymuje żółtą kartkę. W przypadku drugiej żółtej kartki, drużyna jest wykluczona z turnieju.</p>
          </section>

          <section id="streaming-postanowienia-koncowe">
            <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">10. Streaming i Postanowienia Końcowe</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Gracze mogą streamować własne mecze. Jednak administracja nie ponosi odpowiedzialności za podglądanie meczu przez przeciwnika (zalecamy delay 10 min).</li>
              <li>Wszelkie podejrzenia złamania regulaminu powinny być niezwłocznie zgłaszane do administracji.</li>
              <li>Wszelkie sytuacje nieprzewidziane w regulaminie będą rozpatrywane przez administrację w trakcie turnieju.</li>
              <li>Administracja zobowiązana jest do traktowania wszystkich uczestników równo, sprawiedliwie i zgodnie z zasadami turnieju.</li>
              <li>Wszyscy uczestnicy zobowiązują się do przestrzegania regulaminu turnieju. Brak znajomości regulaminu i wynikające z tego powodu nieporozumienia są na niekorzyść drużyny.</li>
              <li>Wybrane mecze streamowane będą na oficjalnym kanale Twitch <Link href="https://www.twitch.tv/polishdota2inhouse" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">https://www.twitch.tv/polishdota2inhouse</Link></li>
            </ul>
          </section>
          
          <p className="text-center text-muted-foreground pt-4 italic">
            Administratorzy zastrzegają sobie prawo do podejmowania ostatecznych decyzji we wszystkich sprawach nieobjętych wyraźnie niniejszym regulaminem lub w nieprzewidzianych okolicznościach, zawsze w celu utrzymania uczciwej konkurencji i integralności turnieju. Powodzenia dla wszystkich uczestników!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Regulamin | Tournament Tracker",
  description: "Oficjalny regulamin turnieju Jesienna Zadyma.",
};
