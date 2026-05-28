"use client";

import { useTournament } from "@/context/TournamentContext";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import React from "react";

const LAST_UPDATED = "12 stycznia 2026";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "administrator",
    title: "1. Administrator danych osobowych",
    content: (
      <>
        <p>
          Administratorem Twoich danych osobowych jest{" "}
          <strong>Polish Dota 2 Inhouse (PD2IH)</strong>, organizacja prowadz&#261;ca platform&#281;
          turniejow&#261; dost&#281;pn&#261; pod adresem{" "}
          <strong>dota2inhouse.pl</strong>.
        </p>
        <p>
          W sprawach zwi&#261;zanych z ochron&#261; danych osobowych mo&#380;esz skontaktowa&#263; si&#281; z nami
          za po&#347;rednictwem:
        </p>
        <ul>
          <li>Serwera Discord PD2IH &#8211; kana&#322; <strong>#kontakt</strong></li>
          <li>Wiadomo&#347;ci prywatnej do administratora na platformie Discord</li>
        </ul>
        <p>
          Nie wyznaczy&#322;i&#347;my Inspektora Ochrony Danych, gdy&#380; nie jeste&#347;my podmiotem
          zobowi&#261;zanym do jego powo&#322;ania na mocy art. 37 RODO.
        </p>
      </>
    ),
  },
  {
    id: "dane",
    title: "2. Zakres i \u017ar\u00f3d\u0142a przetwarzanych danych",
    content: (
      <>
        <p>
          W ramach &#347;wiadczenia us&#322;ug platformy przetwarzamy nast&#281;puj&#261;ce kategorie danych:
        </p>
        <h4>a) Dane uwierzytelniaj&#261;ce &#8211; Google OAuth</h4>
        <p>
          Przy logowaniu za pomoc&#261; konta Google otrzymujemy od us&#322;ugi Google LLC nast&#281;puj&#261;ce
          dane: imi&#281; i nazwisko (lub pseudonim konta Google), adres e&#8209;mail, adres URL zdj&#281;cia
          profilowego oraz unikalny identyfikator konta Google (Google UID). Dane te s&#261;
          pobierane automatycznie w momencie wyra&#380;enia przez Ciebie zgody na logowanie.
        </p>
        <h4>b) Dane profilu turnieju</h4>
        <p>
          Podczas rejestracji dru&#380;yny lub jako uczestnik turnieju mo&#380;esz nam przekaza&#263;
          nast&#281;puj&#261;ce dane: nick w grze (pseudonim), identyfikator lub adres profilu Steam,
          poziom MMR (rank), nazwa u&#380;ytkownika Discord, preferowana rola w grze. W przypadku
          turniej&#243;w z limitem MMR mo&#380;liwe jest przes&#322;anie zrzut&#243;w ekranu potwierdzaj&#261;cych
          poziom umiej&#281;tno&#347;ci.
        </p>
        <h4>c) Dane aktywno&#347;ci na platformie</h4>
        <p>
          Platforma przechowuje dane wygenerowane w trakcie korzystania z us&#322;ug, w tym:
          sk&#322;ady dru&#380;yn fantasy i prognozy Pick&apos;em sk&#322;adane przez u&#380;ytkownika, histori&#281;
          mecz&#243;w i statystyki z rozegranych gier (KDA, GPM, XPM, obra&#380;enia itp.) powi&#261;zane
          z identyfikatorem Steam, zg&#322;oszenia jako standin, profil komentatora (adres Twitch,
          biogram).
        </p>
        <h4>d) Dane przesy&#322;ane dobrowolnie</h4>
        <p>
          Do platformy mo&#380;na przes&#322;a&#263; pliki graficzne (logo dru&#380;yny, zrzuty ekranu MMR,
          logo turnieju). Pliki te s&#261; przechowywane w us&#322;udze Firebase Storage.
        </p>
        <p>
          <strong>Nie przetwarzamy danych dotycz&#261;cych p&#322;atno&#347;ci.</strong> Platforma nie
          pobiera op&#322;at od u&#380;ytkownik&#243;w i nie gromadzi danych kart p&#322;atniczych ani danych
          przelew&#243;w bankowych.
        </p>
      </>
    ),
  },
  {
    id: "podstawa",
    title: "3. Podstawa prawna przetwarzania",
    content: (
      <>
        <p>Przetwarzamy Twoje dane na nast&#281;puj&#261;cych podstawach prawnych:</p>
        <ul>
          <li>
            <strong>Art. 6 ust. 1 lit. a RODO</strong> &#8211; zgoda osoby, kt&#243;rej dane dotycz&#261;.
            Loguj&#261;c si&#281; za pomoc&#261; konta Google, wyra&#380;asz dobrowoln&#261; i &#347;wiadom&#261; zgod&#281; na
            przetwarzanie danych udost&#281;pnianych przez Google. Zgoda mo&#380;e by&#263; wycofana w
            dowolnym momencie (patrz: punkt 7 &#8211; Twoje prawa).
          </li>
          <li>
            <strong>Art. 6 ust. 1 lit. b RODO</strong> &#8211; wykonanie umowy lub podj&#281;cie
            dzia&#322;a&#324; przed jej zawarciem. Dane rejestracyjne dru&#380;yny i dane profilowe
            uczestnika przetwarzamy w celu umo&#380;liwienia Ci udzia&#322;u w turnieju i korzystania
            z funkcji platformy.
          </li>
          <li>
            <strong>Art. 6 ust. 1 lit. f RODO</strong> &#8211; prawnie uzasadniony interes
            administratora. W zakresie prowadzenia statystyk turniejowych, zapewnienia
            bezpiecze&#324;stwa platformy i ochrony przed nadu&#380;yciami przetwarzamy dane w
            oparciu o nasz uzasadniony interes.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "cel",
    title: "4. Cele przetwarzania danych",
    content: (
      <>
        <p>Twoje dane przetwarzamy wy&#322;&#261;cznie w poni&#380;szych celach:</p>
        <ul>
          <li>Umo&#380;liwienie logowania i identyfikacji u&#380;ytkownika na platformie</li>
          <li>Rejestracja i weryfikacja dru&#380;yn uczestnicz&#261;cych w turniejach</li>
          <li>Organizacja i przeprowadzenie rozgrywek turniejowych</li>
          <li>Wy&#347;wietlanie statystyk graczy i dru&#380;yn publicznie na platformie</li>
          <li>Obs&#322;uga funkcji Fantasy i Pick&apos;em</li>
          <li>Zarz&#261;dzanie systemem standin&#243;w i komentator&#243;w</li>
          <li>Wysy&#322;anie komunikat&#243;w systemowych (powiadomienia platformowe)</li>
          <li>Zapewnienie bezpiecze&#324;stwa i integralno&#347;ci platformy</li>
        </ul>
        <p>
          Nie przetwarzamy Twoich danych w celach marketingowych ani nie przekazujemy ich
          podmiotom reklamowym.
        </p>
      </>
    ),
  },
  {
    id: "odbiorcy",
    title: "5. Odbiorcy danych i przekazywanie do pa\u0144stw trzecich",
    content: (
      <>
        <p>
          Twoje dane s&#261; przetwarzane przez nast&#281;puj&#261;ce podmioty dzia&#322;aj&#261;ce jako nasi
          podprzetwarzaj&#261;cy (<em>processors</em>):
        </p>
        <ul>
          <li>
            <strong>Google LLC (Firebase)</strong> &#8211; dostarczamy us&#322;ugi w zakresie
            uwierzytelniania (Firebase Authentication), bazy danych (Cloud Firestore),
            przechowywania plik&#243;w (Firebase Storage) oraz hostingu (Firebase Hosting).
            Google LLC ma siedzib&#281; w USA. Transfer danych odbywa si&#281; na podstawie
            standardowych klauzul umownych (SCC) zatwierdzonych przez Komisj&#281; Europejsk&#261;
            zgodnie z art. 46 ust. 2 lit. c RODO.
          </li>
          <li>
            <strong>Valve Corporation / OpenDota</strong> &#8211; dane statystyczne gier
            pobieramy z publicznego API OpenDota oraz API Valve (Dota 2 League API) na
            podstawie publicznych identyfikator&#243;w mecz&#243;w turniejowych. Nie przekazujemy
            tym podmiotom &#380;adnych danych osobowych.
          </li>
        </ul>
        <p>
          Poza wymienionymi podmiotami nie udost&#281;pniamy Twoich danych osobowych &#380;adnym
          stronom trzecim, chyba &#380;e jeste&#347;my do tego zobowi&#261;zani przepisami prawa.
        </p>
      </>
    ),
  },
  {
    id: "retencja",
    title: "6. Okres przechowywania danych",
    content: (
      <>
        <p>Twoje dane osobowe przechowujemy przez nast&#281;puj&#261;ce okresy:</p>
        <ul>
          <li>
            <strong>Dane konta (profil u&#380;ytkownika):</strong> przez czas posiadania konta
            na platformie. Po usuni&#281;ciu konta dane s&#261; usuwane w ci&#261;gu 30 dni.
          </li>
          <li>
            <strong>Dane dru&#380;yn i uczestnik&#243;w archiwizowanych turniej&#243;w:</strong> dane
            historyczne mecz&#243;w i statystyki mog&#261; by&#263; przechowywane bezterminowo jako
            archiwum turniejowe, w postaci zanonimizowanej lub w powi&#261;zaniu z nickiem
            w grze (bez danych kontaktowych).
          </li>
          <li>
            <strong>Zrzuty ekranu MMR:</strong> usuwane po zako&#324;czeniu weryfikacji, nie
            p&#243;&#378;niej ni&#380; 90 dni od zako&#324;czenia turnieju.
          </li>
          <li>
            <strong>Logi techniczne:</strong> przechowywane maksymalnie przez 90 dni.
          </li>
        </ul>
        <p>
          Mo&#380;esz w dowolnym momencie z&#322;o&#380;y&#263; wniosek o usuni&#281;cie swoich danych osobowych
          (patrz: punkt 7).
        </p>
      </>
    ),
  },
  {
    id: "prawa",
    title: "7. Twoje prawa",
    content: (
      <>
        <p>
          Na podstawie RODO przys&#322;uguj&#261; Ci nast&#281;puj&#261;ce prawa w odniesieniu do Twoich
          danych osobowych:
        </p>
        <ul>
          <li>
            <strong>Prawo dost&#281;pu (art. 15 RODO)</strong> &#8211; mo&#380;esz uzyska&#263; potwierdzenie,
            czy i jakie dane na Tw&#243;j temat przetwarzamy, oraz uzyska&#263; ich kopi&#281;.
          </li>
          <li>
            <strong>Prawo do sprostowania (art. 16 RODO)</strong> &#8211; mo&#380;esz &#380;&#261;da&#263; poprawienia
            lub uzupe&#322;nienia nieprawid&#322;owych lub niekompletnych danych.
          </li>
          <li>
            <strong>Prawo do usuni&#281;cia danych (art. 17 RODO)</strong> &#8211; mo&#380;esz &#380;&#261;da&#263;
            usuni&#281;cia swoich danych, gdy nie s&#261; ju&#380; niezb&#281;dne do cel&#243;w, w kt&#243;rych zosta&#322;y
            zebrane, wycofa&#322;e&#347; zgod&#281; lub przetwarzanie odbywa si&#281; niezgodnie z prawem.
          </li>
          <li>
            <strong>Prawo do ograniczenia przetwarzania (art. 18 RODO)</strong> &#8211; mo&#380;esz
            &#380;&#261;da&#263; ograniczenia przetwarzania w przypadkach okre&#347;lonych w RODO.
          </li>
          <li>
            <strong>Prawo do przenoszenia danych (art. 20 RODO)</strong> &#8211; mo&#380;esz otrzyma&#263;
            swoje dane w ustrukturyzowanym formacie nadaj&#261;cym si&#281; do odczytu maszynowego.
          </li>
          <li>
            <strong>Prawo sprzeciwu (art. 21 RODO)</strong> &#8211; mo&#380;esz sprzeciwi&#263; si&#281;
            przetwarzaniu danych opartemu na uzasadnionym interesie administratora.
          </li>
          <li>
            <strong>Prawo do wycofania zgody</strong> &#8211; w przypadkach, gdy przetwarzanie
            odbywa si&#281; na podstawie zgody, mo&#380;esz j&#261; wycofa&#263; w dowolnym momencie bez
            podania przyczyny, co nie wp&#322;ywa na zgodno&#347;&#263; z prawem przetwarzania dokonanego
            przed jej wycofaniem.
          </li>
        </ul>
        <p>
          Aby skorzysta&#263; z przys&#322;uguj&#261;cych praw, skontaktuj si&#281; z nami przez Discord
          (patrz: punkt 1). Odpowiemy na Twoje &#380;&#261;danie bez zb&#281;dnej zw&#322;oki, nie p&#243;&#378;niej
          ni&#380; w ci&#261;gu 30 dni. W razie stwierdzenia naruszenia przepis&#243;w RODO przys&#322;uguje
          Ci prawo wniesienia skargi do{" "}
          <strong>Prezesa Urz&#281;du Ochrony Danych Osobowych (PUODO)</strong>,
          ul. Stawki 2, 00&#8209;193 Warszawa.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "8. Pliki cookies i technologie \u015bledzące",
    content: (
      <>
        <p>
          Platforma wykorzystuje pliki cookies wy&#322;&#261;cznie w celach technicznych i
          funkcjonalnych:
        </p>
        <ul>
          <li>
            <strong>Cookies sesji:</strong> niezb&#281;dne do utrzymania zalogowanej sesji
            u&#380;ytkownika. S&#261; usuwane po zamkni&#281;ciu przegl&#261;darki lub po wylogowaniu.
          </li>
          <li>
            <strong>Cookies preferencji:</strong> przechowuj&#261; wybrane przez Ciebie
            ustawienia (np. j&#281;zyk interfejsu). Wa&#380;no&#347;&#263; do 12 miesi&#281;cy.
          </li>
        </ul>
        <p>
          <strong>Nie stosujemy plik&#243;w cookies &#347;ledz&#261;cych, reklamowych ani narz&#281;dzi
          analityki stron trzecich</strong> (takich jak Google Analytics, Meta Pixel itp.).
        </p>
        <p>
          Mo&#380;esz zarz&#261;dza&#263; plikami cookies za pomoc&#261; ustawie&#324; swojej przegl&#261;darki
          internetowej. Wy&#322;&#261;czenie cookies sesji mo&#380;e uniemo&#380;liwi&#263; korzystanie z platformy.
        </p>
      </>
    ),
  },
  {
    id: "bezpieczenstwo",
    title: "9. Bezpiecze\u0144stwo danych",
    content: (
      <>
        <p>
          Stosujemy odpowiednie &#347;rodki techniczne i organizacyjne w celu ochrony Twoich
          danych przed nieuprawnionym dost&#281;pem, utrat&#261;, zniszczeniem lub ujawnieniem:
        </p>
        <ul>
          <li>Transmisja danych odbywa si&#281; wy&#322;&#261;cznie przez szyfrowane po&#322;&#261;czenie HTTPS</li>
          <li>
            Dost&#281;p do danych administracyjnych jest ograniczony i przyznawany tylko
            upowa&#380;nionym osobom
          </li>
          <li>
            Korzystamy z regu&#322; bezpiecze&#324;stwa Firestore ograniczaj&#261;cych dost&#281;p do danych
            wy&#322;&#261;cznie do uprawnionych u&#380;ytkownik&#243;w
          </li>
          <li>
            Uwierzytelnianie realizowane jest przez Google OAuth &#8211; nie przechowujemy hase&#322;
            u&#380;ytkownik&#243;w
          </li>
        </ul>
        <p>
          W przypadku wykrycia naruszenia ochrony danych osobowych, kt&#243;re mo&#380;e powodowa&#263;
          wysokie ryzyko naruszenia praw i wolno&#347;ci os&#243;b fizycznych, poinformujemy Ci&#281;
          bez zb&#281;dnej zw&#322;oki zgodnie z art. 34 RODO.
        </p>
      </>
    ),
  },
  {
    id: "zmiany",
    title: "10. Zmiany polityki prywatno\u015bci",
    content: (
      <>
        <p>
          Niniejsza polityka prywatno&#347;ci mo&#380;e by&#263; aktualizowana w zwi&#261;zku ze zmianami
          przepis&#243;w prawa, zmianami w zakresie przetwarzanych danych lub rozwojem platformy.
        </p>
        <p>
          O istotnych zmianach b&#281;dziemy informowa&#263; za po&#347;rednictwem serwera Discord PD2IH
          oraz przez komunikat wy&#347;wietlany na stronie g&#322;&#243;wnej platformy. Data ostatniej
          aktualizacji jest zawsze widoczna na g&#243;rze niniejszego dokumentu.
        </p>
        <p>
          Dalsze korzystanie z platformy po wej&#347;ciu w &#380;ycie zmienionej polityki
          prywatno&#347;ci oznacza akceptacj&#281; tych zmian.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  const { tournament, theme } = useTournament();

  if (!tournament) return null;

  return (
    <div className="relative overflow-x-hidden min-h-screen pb-16">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
          style={{
            background: "radial-gradient(ellipse at center, transparent 0%, transparent 40%, #00000020 100%)",
          }}
        />
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
          style={{ background: theme.primaryColor }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: theme.secondaryColor }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero header - matches teams/stats style */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4 py-8 relative mb-8"
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-32 blur-[100px] rounded-full pointer-events-none"
            style={{ background: `${theme.primaryColor}0D` }}
          />
          <h1
            className="text-5xl md:text-7xl font-logik-wide-black tracking-tighter uppercase relative z-10 drop-shadow-2xl"
            style={{ color: (theme as any).titleColor || theme.headingColor || theme.textColor }}
          >
            Prywatno&#347;&#263;
          </h1>
          <div className="flex items-center justify-center gap-4 opacity-60">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[var(--tournament-primary)]" />
            <div className="w-2 h-2 rotate-45 border border-[var(--tournament-primary)]" />
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[var(--tournament-primary)]" />
          </div>
          <p className="text-sm relative z-10" style={{ color: theme.mutedTextColor }}>
            Ostatnia aktualizacja: <strong>{LAST_UPDATED}</strong>
          </p>
        </motion.div>

        {/* Intro */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-8 p-5 rounded-xl text-sm leading-relaxed"
          style={{
            backgroundColor: `${theme.primaryColor}0D`,
            border: `1px solid ${theme.primaryColor}25`,
            color: theme.textColor,
          }}
        >
          Niniejsza Polityka Prywatno&#347;ci opisuje zasady przetwarzania danych osobowych przez
          platform&#281; <strong>dota2inhouse.pl</strong>, prowadzon&#261; przez{" "}
          <strong>Polish Dota 2 Inhouse (PD2IH)</strong>. Dokument ten jest zgodny z
          Rozporz&#261;dzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia
          2016&nbsp;r. w sprawie ochrony os&#243;b fizycznych w zwi&#261;zku z przetwarzaniem danych
          osobowych i w sprawie swobodnego przep&#322;ywu takich danych (<strong>RODO</strong>).
        </motion.div>

        {/* Table of contents */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10 p-5 rounded-xl"
          style={{ backgroundColor: theme.cardColor, border: `1px solid ${theme.borderColor}` }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: theme.mutedTextColor }}
          >
            Spis tre&#347;ci
          </p>
          <ul className="space-y-1.5">
            {SECTIONS.map(section => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                  style={{ color: theme.primaryColor }}
                >
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((section, index) => (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + index * 0.04 }}
              className="rounded-xl p-6 sm:p-8"
              style={{ backgroundColor: theme.cardColor, border: `1px solid ${theme.borderColor}` }}
            >
              <h2
                className="text-lg font-bold mb-4 pb-3 border-b"
                style={{ color: theme.headingColor, borderColor: theme.borderColor }}
              >
                {section.title}
              </h2>
              <div
                className="text-sm leading-relaxed space-y-3 prose-privacy"
                style={{ color: theme.textColor }}
              >
                {section.content}
              </div>
            </motion.section>
          ))}
        </div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="mt-10 text-center text-xs"
          style={{ color: theme.mutedTextColor }}
        >
          <p>
            &copy; {new Date().getFullYear()} Polish Dota 2 Inhouse (PD2IH) &mdash; dota2inhouse.pl
          </p>
          <p className="mt-1">
            Polityka Prywatno&#347;ci obowi&#261;zuje od dnia {LAST_UPDATED}.
          </p>
        </motion.div>
      </div>

      <style jsx global>{`
        .prose-privacy h4 {
          font-weight: 600;
          font-size: 0.875rem;
          margin-top: 1rem;
          margin-bottom: 0.375rem;
        }
        .prose-privacy ul {
          list-style-type: disc;
          padding-left: 1.5rem;
        }
        .prose-privacy ul li {
          margin-bottom: 0.375rem;
        }
        .prose-privacy strong {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
