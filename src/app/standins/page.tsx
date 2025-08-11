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
import { db } from "@/lib/firebase";
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
  const { user, loading } = useAuth();
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

      await setDoc(doc(db, 'standins', user.uid), standinData);
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
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center gap-3">
              <Users className="h-8 w-8" />
              Zostań rezerwowym
            </CardTitle>
            <CardDescription className="text-lg mt-4">
              Dziękujemy za chęć pomocy zespołom w turnieju! 
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Aby się zarejestrować jako rezerwowy, musisz się najpierw zalogować.
            </p>
            <p className="text-muted-foreground">
              Rezerwowi to gracze, którzy mogą zastąpić nieobecnych członków drużyn podczas meczów. 
              To ważna rola, która pomaga utrzymać sprawiedliwość i ciągłość turnieju.
            </p>
            <Button size="lg" className="mt-6">
              <a href="/api/auth/signin">{t('common.signIn')}</a>
            </Button>
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
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center gap-3">
            <Users className="h-8 w-8" />
            Zostań rezerwowym
          </CardTitle>
          <CardDescription className="text-lg mt-4">
            Pomóż zespołom w turnieju jako gracz rezerwowy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname *</Label>
              <Input
                id="nickname"
                value={formData.nickname}
                onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                required
                placeholder="Twój nick w grze"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discordUsername">Discord Username *</Label>
              <Input
                id="discordUsername"
                value={formData.discordUsername}
                onChange={(e) => setFormData(prev => ({ ...prev, discordUsername: e.target.value }))}
                required
                placeholder="username#1234"
              />
              <p className="text-sm text-muted-foreground">
                Kapitanowie będą kontaktować się z Tobą przez Discord
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mmr">MMR *</Label>
              <Input
                id="mmr"
                type="number"
                min="1000"
                max="12000"
                value={formData.mmr}
                onChange={(e) => setFormData(prev => ({ ...prev, mmr: e.target.value }))}
                required
                placeholder="Twoje aktualne MMR"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="steamProfileUrl">Link do profilu Steam *</Label>
              <Input
                id="steamProfileUrl"
                type="url"
                value={formData.steamProfileUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, steamProfileUrl: e.target.value }))}
                required
                placeholder="https://steamcommunity.com/id/yourprofile/"
              />
              <p className="text-sm text-muted-foreground">
                Link do Twojego profilu Steam (używany do weryfikacji, że nie jesteś już graczem w innej drużynie)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileScreenshot">Zrzut ekranu profilu Dota 2 z MMR *</Label>
              <Input
                id="profileScreenshot"
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                required
              />
              <p className="text-sm text-muted-foreground">
                Zrzut ekranu profilu z widocznym MMR do weryfikacji przez administratora
              </p>
              {screenshotPreview && (
                <div className="mt-2">
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    className="max-w-xs rounded border cursor-pointer"
                    onClick={() => setIsModalOpen(true)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Role, które możesz grać *</Label>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={role.id}
                      checked={formData.roles.includes(role.id)}
                      onCheckedChange={() => handleRoleToggle(role.id)}
                    />
                    <Label htmlFor={role.id} className="text-sm font-medium">
                      {role.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis (maks. 300 znaków) *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
                maxLength={300}
                rows={4}
                placeholder="Napisz o sobie: kiedy jesteś dostępny, jakich herosów grasz najlepiej, dodatkowe informacje..."
              />
              <p className="text-sm text-muted-foreground">
                {formData.description.length}/300 znaków
              </p>
            </div>

            <Button type="submit" disabled={submitting} size="lg" className="w-full">
              {submitting ? 'Wysyłanie...' : 'Zarejestruj się jako rezerwowy'}
            </Button>
          </form>
        </CardContent>
      </Card>
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
