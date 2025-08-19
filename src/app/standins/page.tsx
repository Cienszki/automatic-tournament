"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Shield, CheckCircle, Clock, Upload } from "lucide-react";
import { doc, setDoc, getDoc, collection } from "firebase/firestore";
import { db, isFirebaseInitialized } from "@/lib/firebase";
import type { Standin } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { uploadStandinScreenshot } from "@/lib/storage";
import { ImageModal } from "@/components/ui/image-modal";

const ROLES = [
  { id: 'Carry', name: 'Carry' },
  { id: 'Mid', name: 'Mid' },
  { id: 'Offlane', name: 'Offlane' },
  { id: 'Soft Support', name: 'Soft Support' },
  { id: 'Hard Support', name: 'Hard Support' }
];

export default function StandinsPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [existingStandin, setExistingStandin] = useState<Standin | null>(null);
  const [formData, setFormData] = useState({
    nickname: '',
    discordUsername: '',
    mmr: '',
    steamProfileUrl: '',
    roles: [] as string[],
    description: ''
  });
  const [profileScreenshot, setProfileScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    console.log('Standins page useEffect: user =', user, 'loading =', loading);
    
    // Only proceed if:
    // 1. Loading is complete
    // 2. User exists and is authenticated
    // 3. User has a valid UID
    if (!loading && user?.uid && user.emailVerified !== false) {
      console.log('Standins page: calling checkExistingStandin');
      // Add a small delay to ensure Firebase auth state is fully settled
      const timeoutId = setTimeout(() => {
        checkExistingStandin();
      }, 200);
      
      return () => clearTimeout(timeoutId);
    } else {
      console.log('Standins page: skipping checkExistingStandin because:', {
        loading,
        hasUser: !!user,
        hasUid: !!user?.uid,
        emailVerified: user?.emailVerified
      });
    }
  }, [user, loading]);

  const checkExistingStandin = async () => {
    if (!user?.uid) {
      console.log('checkExistingStandin: No user or user.uid, skipping');
      return;
    }
    
    setCheckingExisting(true);
    try {
      console.log('Checking existing standin for user:', user.uid);
      
      // Add a small delay to ensure user is fully authenticated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if Firebase is properly initialized
      if (!isFirebaseInitialized()) {
        console.log('Firebase not properly initialized, skipping standin check');
        return;
      }
      
      const standinDoc = await getDoc(doc(db, 'standins', user.uid));
      console.log('Standin doc exists:', standinDoc.exists());
      if (standinDoc.exists()) {
        setExistingStandin({ id: standinDoc.id, ...standinDoc.data() } as Standin);
      }
    } catch (error) {
      console.error('Error checking existing standin:', error);
      // Check if this is a permission error
      if (error instanceof Error && error.message.includes('insufficient permissions')) {
        console.log('Permission error - user may not be fully authenticated yet');
        // Don't show error to user for permission issues during initial load
      } else {
        // For other errors, we might want to show them
        console.error('Non-permission error:', error);
      }
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleRoleToggle = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }));
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProfileScreenshot(file);
    
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setScreenshotPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    if (formData.roles.length === 0) {
      toast({
        title: "Błąd",
        description: "Musisz wybrać przynajmniej jedną rolę!",
        variant: "destructive"
      });
      return;
    }

    if (parseInt(formData.mmr) < 1000 || parseInt(formData.mmr) > 12000) {
      toast({
        title: "Błąd",
        description: "MMR musi być w zakresie 1000-12000!",
        variant: "destructive"
      });
      return;
    }

    if (formData.description.length > 300) {
      toast({
        title: "Błąd",
        description: "Opis nie może przekraczać 300 znaków!",
        variant: "destructive"
      });
      return;
    }

    if (!profileScreenshot) {
      toast({
        title: "Błąd",
        description: "Musisz przesłać zrzut ekranu profilu!",
        variant: "destructive"
      });
      return;
    }

    if (!formData.steamProfileUrl) {
      toast({
        title: "Błąd",
        description: "Musisz podać link do profilu Steam!",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Validate Steam profile and get Steam IDs
      const steamResponse = await fetch('/api/validate-steam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          steamProfileUrl: formData.steamProfileUrl,
        }),
      });

      const steamData = await steamResponse.json();
      
      if (!steamResponse.ok) {
        toast({
          title: "Błąd",
          description: steamData.error || "Nie udało się zweryfikować profilu Steam",
          variant: "destructive"
        });
        return;
      }

      const { steamId64, steamId32 } = steamData;

      // Upload screenshot
      const screenshotUrl = await uploadStandinScreenshot(profileScreenshot, user.uid);

      const standinData: Omit<Standin, 'id'> = {
        userId: user.uid,
        nickname: formData.nickname,
        discordUsername: formData.discordUsername,
        mmr: parseInt(formData.mmr),
        profileScreenshotUrl: screenshotUrl,
        steamProfileUrl: formData.steamProfileUrl,
        steamId: steamId64,
        steamId32: steamId32,
        roles: formData.roles,
        description: formData.description,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Submit to server-side API route
      const response = await fetch('/api/register-standin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(standinData)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Błąd podczas rejestracji rezerwowego.');
      }
      toast({
        title: "Sukces!",
        description: "Zgłoszenie zostało wysłane! Oczekuj weryfikacji przez administratora."
      });
      checkExistingStandin();
    } catch (error) {
      console.error('Error submitting standin:', error);
      toast({
        title: "Błąd",
        description: error instanceof Error ? error.message : "Wystąpił błąd podczas wysyłania zgłoszenia.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checkingExisting) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg">{t('common.loading')}...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-lg"></div>
              <div className="relative bg-background border-2 border-primary/30 rounded-full p-6">
                <Shield className="h-12 w-12 text-primary" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-6">
            Zostań Rezerwowym
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Dołącz do grona pomocnych graczy i wspieraj zespoły w turnieju!
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Pomóż Zespołom</h3>
              <p className="text-sm text-muted-foreground">
                Zastąp nieobecnych graczy i zapewnij sprawiedliwe rozgrywki
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-accent/20 hover:border-accent/40 transition-colors">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-8 w-8 text-accent mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Zdobądź Doświadczenie</h3>
              <p className="text-sm text-muted-foreground">
                Graj z różnymi zespołami i rozwijaj swoje umiejętności
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Elastyczny Czas</h3>
              <p className="text-sm text-muted-foreground">
                Grasz tylko gdy jesteś dostępny - bez zobowiązań
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main CTA Card */}
        <Card className="max-w-2xl mx-auto border-2 border-primary/30 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-primary to-accent p-3 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              Gotowy na akcję?
            </CardTitle>
            <CardDescription className="text-lg">
              Zaloguj się i dołącz do społeczności rezerwowych już dziś!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Co to znaczy być rezerwowym?</h4>
              <p className="text-sm text-muted-foreground">
                Rezerwowi to gracze, którzy mogą zastąpić nieobecnych członków drużyn podczas meczów. 
                To ważna rola, która pomaga utrzymać sprawiedliwość i ciągłość turnieju.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-lg"
                onClick={signInWithGoogle}
              >
                🚀 {t('common.signInWithGoogle')}
              </Button>
            </div>
            
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Szybka rejestracja
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4 text-blue-500" />
                Bezpieczne logowanie
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (existingStandin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center gap-3">
              {existingStandin.status === 'verified' ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <Clock className="h-8 w-8 text-yellow-500" />
              )}
              Status rezerwowego
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="space-y-4">
              <Badge 
                className={`text-lg px-6 py-2 ${
                  existingStandin.status === 'verified' 
                    ? 'bg-green-500/20 text-green-300 border-green-500/40' 
                    : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                }`}
              >
                {existingStandin.status === 'verified' ? 'Zweryfikowany' : 'Oczekuje weryfikacji'}
              </Badge>
              
              <div className="bg-muted/20 rounded-lg p-6 text-left space-y-3">
                <p><strong>Nick:</strong> {existingStandin.nickname}</p>
                <p><strong>Discord:</strong> {existingStandin.discordUsername}</p>
                <p><strong>MMR:</strong> {existingStandin.mmr}</p>
                <p><strong>Role:</strong> {existingStandin.roles.join(', ')}</p>
                <p><strong>Opis:</strong> {existingStandin.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-lg font-semibold text-primary">
                Dziękujemy za rejestrację jako rezerwowy!
              </p>
              
              {existingStandin.status === 'verified' ? (
                <p className="text-muted-foreground">
                  Twój status został zweryfikowany. Kapitanowie drużyn mogą teraz skontaktować się z Tobą przez Discord, 
                  gdy będą potrzebować rezerwowego. Sprawdzaj regularnie swoją skrzynkę Discord!
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Twoje zgłoszenie oczekuje weryfikacji przez administratora. 
                  Po zweryfikowaniu otrzymasz powiadomienie, a kapitanowie będą mogli się z Tobą skontaktować.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-primary to-accent rounded-full shadow-lg mb-6">
            <Users className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
            Zostań rezerwowym
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Dołącz do elitarnej grupy rezerwowych i pomóż zespołom osiągnąć sukces w turnieju
          </p>
        </div>

        {/* Registration Form Card */}
        <Card className="max-w-4xl mx-auto shadow-2xl border-2 border-primary/30">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information Section */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-primary/20">
                <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">1</span>
                  </div>
                  Informacje podstawowe
                </h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="nickname" className="text-base font-semibold text-foreground">
                      Nickname *
                    </Label>
                    <Input
                      id="nickname"
                      value={formData.nickname}
                      onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                      required
                      placeholder="Twój nick w grze"
                      className="h-12 text-lg border-2 border-border focus:border-primary transition-colors"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="mmr" className="text-base font-semibold text-foreground">
                      MMR *
                    </Label>
                    <Input
                      id="mmr"
                      type="number"
                      min="1000"
                      max="12000"
                      value={formData.mmr}
                      onChange={(e) => setFormData(prev => ({ ...prev, mmr: e.target.value }))}
                      required
                      placeholder="Twoje aktualne MMR"
                      className="h-12 text-lg border-2 border-border focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-accent/20">
                <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-accent-foreground font-bold text-sm">2</span>
                  </div>
                  Kontakt
                </h3>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="discordUsername" className="text-base font-semibold text-foreground">
                      Discord Username *
                    </Label>
                    <Input
                      id="discordUsername"
                      value={formData.discordUsername}
                      onChange={(e) => setFormData(prev => ({ ...prev, discordUsername: e.target.value }))}
                      required
                      placeholder="username#1234"
                      className="h-12 text-lg border-2 border-border focus:border-accent transition-colors"
                    />
                    <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                      💬 Kapitanowie będą kontaktować się z Tobą przez Discord
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="steamProfileUrl" className="text-base font-semibold text-foreground">
                      Link do profilu Steam *
                    </Label>
                    <Input
                      id="steamProfileUrl"
                      type="url"
                      value={formData.steamProfileUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, steamProfileUrl: e.target.value }))}
                      required
                      placeholder="https://steamcommunity.com/id/yourprofile/"
                      className="h-12 text-lg border-2 border-border focus:border-accent transition-colors"
                    />
                    <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                      🔍 Link do Twojego profilu Steam (używany do weryfikacji, że nie jesteś już graczem w innej drużynie)
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Section */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-secondary/20">
                <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                    <span className="text-secondary-foreground font-bold text-sm">3</span>
                  </div>
                  Weryfikacja
                </h3>
                
                <div className="space-y-3">
                  <Label htmlFor="profileScreenshot" className="text-base font-semibold text-foreground">
                    Zrzut ekranu profilu Dota 2 z MMR *
                  </Label>
                  <Input
                    id="profileScreenshot"
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    required
                    className="h-12 text-lg border-2 border-border focus:border-secondary transition-colors"
                  />
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                    📸 Zrzut ekranu profilu z widocznym MMR do weryfikacji przez administratora
                  </p>
                  {screenshotPreview && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                      <p className="text-sm font-medium text-foreground mb-2">Podgląd zrzutu ekranu:</p>
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="max-w-xs rounded-lg border-2 border-border cursor-pointer hover:border-secondary transition-colors shadow-lg"
                        onClick={() => setIsModalOpen(true)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Roles & Skills Section */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-chart-3/20">
                <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-chart-3/80 to-chart-1/80 rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-sm">4</span>
                  </div>
                  Role i umiejętności
                </h3>
                
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-foreground">
                      Role, które możesz grać *
                    </Label>
                    <div className="grid md:grid-cols-3 gap-4">
                      {ROLES.map((role) => (
                        <div key={role.id} className="flex items-center space-x-3 bg-muted/30 p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
                          <Checkbox
                            id={role.id}
                            checked={formData.roles.includes(role.id)}
                            onCheckedChange={() => handleRoleToggle(role.id)}
                            className="w-5 h-5"
                          />
                          <Label htmlFor={role.id} className="text-base font-medium text-foreground cursor-pointer">
                            {role.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="description" className="text-base font-semibold text-foreground">
                      Opis (maks. 300 znaków) *
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      required
                      maxLength={300}
                      rows={5}
                      placeholder="Napisz o sobie: kiedy jesteś dostępny, jakich herosów grasz najlepiej, dodatkowe informacje..."
                      className="text-lg border-2 border-border focus:border-primary transition-colors resize-none"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        💡 Opisz swoje mocne strony i dostępność
                      </p>
                      <p className="text-sm font-medium text-muted-foreground bg-muted/30 px-3 py-1 rounded-full border border-border/50">
                        {formData.description.length}/300 znaków
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <Button 
                  type="submit" 
                  disabled={submitting} 
                  size="lg" 
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-3"></div>
                      Wysyłanie...
                    </>
                  ) : (
                    <>
                      🚀 Zarejestruj się jako rezerwowy
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      
      {screenshotPreview && (
        <ImageModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          imageUrl={screenshotPreview}
          title="Podgląd zrzutu ekranu"
        />
      )}
    </div>
  );
}
