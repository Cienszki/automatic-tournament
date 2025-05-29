
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useActionState, useEffect, useState } from "react"; // Added useState
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerRegistrationFields } from "@/components/app/PlayerRegistrationFields";
import { registerTeamAction } from "./actions";
import { registrationFormSchema } from "@/lib/registration-schema";
import type { RegistrationFormState, TeamRegistrationFormData, PlayerRole } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, AlertTriangle, FileText, Users, ShieldCheck } from "lucide-react"; // Added icons
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Added Accordion

const defaultValues: TeamRegistrationFormData = {
  teamName: "",
  teamLogo: undefined,
  player1: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "", role: "" },
  player2: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "", role: "" },
  player3: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "", role: "" },
  player4: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "", role: "" },
  player5: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "", role: "" },
  rulesAgreed: false,
};

export default function RegistrationPage() {
  const { toast } = useToast();
  const [isDiscordLoggedIn, setIsDiscordLoggedIn] = useState(false); // Simulated login state

  const form = useForm<TeamRegistrationFormData>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const [formState, formAction, isPending] = useActionState<RegistrationFormState, FormData>(
    registerTeamAction,
    { message: "", success: false }
  );

  useEffect(() => {
    if (formState.message) {
      toast({
        title: formState.success ? "Success" : "Error",
        description: formState.message,
        variant: formState.success ? "default" : "destructive",
      });
      if (formState.success) {
        form.reset(defaultValues);
      } else if (formState.errors) {
        formState.errors.forEach(error => {
          const fieldName = error.path.join(".") as keyof TeamRegistrationFormData;
          if (form.control._fields[fieldName]) {
            form.setError(fieldName, { type: "manual", message: error.message });
          } else {
            console.warn(`Error for unmappable field ${fieldName}: ${error.message}`);
          }
        });
      }
    }
  }, [formState, toast, form]);

  const onFormSubmit = async (data: TeamRegistrationFormData) => {
    const formData = new FormData();
    formData.append("teamName", data.teamName);
    if (data.teamLogo) {
      formData.append("teamLogo", data.teamLogo);
    }
    
    (['player1', 'player2', 'player3', 'player4', 'player5'] as const).forEach(playerKey => {
      const player = data[playerKey];
      formData.append(`${playerKey}.nickname`, player.nickname);
      formData.append(`${playerKey}.mmr`, player.mmr.toString());
      if (player.profileScreenshot) {
        formData.append(`${playerKey}.profileScreenshot`, player.profileScreenshot);
      }
      formData.append(`${playerKey}.steamProfileUrl`, player.steamProfileUrl);
      formData.append(`${playerKey}.role`, player.role); // Add role
    });
    formData.append("rulesAgreed", data.rulesAgreed.toString());

    formAction(formData);
  };

  const handleDiscordLogin = () => {
    // In a real app, this would initiate OAuth flow
    setIsDiscordLoggedIn(true);
    toast({ title: "Login Successful", description: "You are now logged in with Discord (Simulated)." });
  };


  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-primary">Team Registration</CardTitle>
          <CardDescription>
            Register your team for the tournament. Please provide accurate information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full mb-6" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold text-accent hover:no-underline">
                <Info className="mr-2 h-5 w-5" />Important Information Before You Register
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <p>Welcome to the 'Jesienna Zadyma' tournament registration!</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Registration Period: 16.09.24 - 28.09.2024 (midnight, Polish time).</li>
                  <li>Team Captains are responsible for submitting the registration and ensuring all data is correct.</li>
                  <li>Please read the full <Link href="/rules" className="text-primary hover:underline">Tournament Rules</Link> before proceeding.</li>
                  <li>You'll need to login with Discord to access the registration form.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold text-accent hover:no-underline">
                <FileText className="mr-2 h-5 w-5" />Required Information
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <p>Prepare the following for your team and each player:</p>
                <strong className="text-foreground">Team Details:</strong>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Team Name</li>
                  <li>Team Logo (Image file: JPG, PNG, WEBP, max 1MB)</li>
                </ul>
                <strong className="text-foreground">For Each of the 5 Players:</strong>
                <ul className="list-disc pl-5 space-y-1">
                  <li>In-game Nickname</li>
                  <li>Current Matchmaking Rating (MMR) - must be a whole number.</li>
                  <li>Assigned Role (Carry, Mid, Offlane, Soft Support, Hard Support) - each role must be unique per team.</li>
                  <li>Screenshot of their Dota 2 profile showing MMR (Image file: JPG, PNG, WEBP, max 1MB)</li>
                  <li>Link to their Steam Profile URL</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold text-accent hover:no-underline">
                <Users className="mr-2 h-5 w-5" />Team Composition Rules
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li>The sum of MMR for all 5 players in a team cannot exceed 22,000.</li>
                  <li>Each player must be assigned one of the five standard Dota 2 roles.</li>
                  <li>Each role (Carry, Mid, Offlane, Soft Support, Hard Support) must be unique within your team. One player per role.</li>
                  <li>Uncalibrated players will be assessed individually by administration. Players with less than 1000 MMR will be counted as 1000 MMR.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {!isDiscordLoggedIn ? (
            <Card className="shadow-md text-center p-6 bg-card border-border">
              <AlertTriangle className="h-12 w-12 mx-auto text-primary mb-3" />
              <CardTitle className="text-xl text-accent mb-2">Discord Login Required</CardTitle>
              <CardDescription className="mb-4 text-muted-foreground">
                Please login with your Discord account to access the team registration form.
              </CardDescription>
              <Button onClick={handleDiscordLogin} className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] hover:text-white" size="lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M19.54 0c1.356 0 2.46 1.104 2.46 2.472v21.528l-2.58-2.28-1.452-1.344-1.536-1.428.636 2.22h-13.62c-1.356 0-2.46-1.104-2.46-2.472v-16.224c0-1.368 1.104-2.472 2.46-2.472h16.08zm-4.632 15.672c2.652-.084 3.672-1.824 3.672-1.824 0-3.864-1.728-6.996-1.728-6.996-1.728-1.296-3.372-1.26-3.372-1.26l-.168.192c2.04.624 2.988 1.524 2.988 1.524-2.256-.816-4.008-1.524-5.964-1.524-1.956 0-3.708.708-5.964 1.524 0 0 .948-.9 2.988-1.524l-.168-.192c0 0-1.644-.036-3.372 1.26 0 0-1.728 3.132-1.728 6.996 0 0 1.02 1.74 3.672 1.824 0 0 .864-.276 1.68-.924-1.608.972-3.12 1.956-3.12 1.956l1.224 1.056s1.38-.348 2.808-.936c.912.42 1.872.576 2.784.576.912 0 1.872-.156 2.784-.576 1.428.588 2.808.936 2.808.936l1.224-1.056s-1.512-.984-3.12-1.956c.816.648 1.68.924 1.68.924zm-6.552-5.616c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332.012-.732-.54-1.332-1.224-1.332zm4.38 0c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332s-.54-1.332-1.224-1.332z"/></svg>
                Login with Discord (Simulated)
              </Button>
            </Card>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-8 mt-6">
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle>Team Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="teamName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., The Champions" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="teamLogo"
                      render={({ field: { onChange, value, ...rest } }) => ( 
                        <FormItem>
                          <FormLabel>Team Logo (max 1MB, .jpg, .png, .webp)</FormLabel>
                          <FormControl>
                            <Input 
                              type="file" 
                              accept=".jpg,.jpeg,.png,.webp"
                              onChange={(e) => onChange(e.target.files?.[0])} 
                              {...rest} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  {(['player1', 'player2', 'player3', 'player4', 'player5'] as const).map((_, index) => (
                    <PlayerRegistrationFields key={index} form={form} playerIndex={(index + 1) as 1 | 2 | 3 | 4 | 5} />
                  ))}
                </div>

                <FormField
                  control={form.control}
                  name="rulesAgreed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="rulesAgreed"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel htmlFor="rulesAgreed">
                          I have read and agree to the <Link href="/rules" className="text-primary hover:underline">tournament rules</Link>.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" size="lg" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Register Team
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
