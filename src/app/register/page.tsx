
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerRegistrationFields } from "@/components/app/PlayerRegistrationFields";
import { registerTeamAction } from "./actions";
import { registrationFormSchema } from "@/lib/registration-schema";
import type { RegistrationFormState, TeamRegistrationFormData } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Define initial form values matching TeamRegistrationFormData structure
const defaultValues: TeamRegistrationFormData = {
  teamName: "",
  teamLogo: undefined,
  player1: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "" },
  player2: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "" },
  player3: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "" },
  player4: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "" },
  player5: { nickname: "", mmr: "", profileScreenshot: undefined, steamProfileUrl: "" },
  rulesAgreed: false,
};

export default function RegistrationPage() {
  const { toast } = useToast();

  const form = useForm<TeamRegistrationFormData>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues,
    mode: "onChange", // Validate on change to provide feedback sooner
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
        // Ensure errors are correctly mapped to fields
        formState.errors.forEach(error => {
          const fieldName = error.path.join(".") as keyof TeamRegistrationFormData;
          // Check if the field exists in the form before setting an error
          if (form.control._fields[fieldName]) {
            form.setError(fieldName, { type: "manual", message: error.message });
          } else {
            // Fallback for general errors or errors not directly mappable to a field
            console.warn(`Error for unmappable field ${fieldName}: ${error.message}`);
            // Optionally, show a general error toast for unmappable errors
            // toast({ title: "Error", description: `An issue with ${fieldName}: ${error.message}`, variant: "destructive" });
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
      formData.append(`${playerKey}.mmr`, player.mmr.toString()); // mmr is string in form, validated to number in schema
      if (player.profileScreenshot) {
        formData.append(`${playerKey}.profileScreenshot`, player.profileScreenshot);
      }
      formData.append(`${playerKey}.steamProfileUrl`, player.steamProfileUrl);
    });
    formData.append("rulesAgreed", data.rulesAgreed.toString());

    formAction(formData); // No await needed here as useActionState handles it
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-primary">Team Registration</CardTitle>
          <CardDescription>
            Register your team for the tournament. Please provide accurate information.
            All fields are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full mb-6 bg-[#5865F2] text-white hover:bg-[#4752C4] hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M19.54 0c1.356 0 2.46 1.104 2.46 2.472v21.528l-2.58-2.28-1.452-1.344-1.536-1.428.636 2.22h-13.62c-1.356 0-2.46-1.104-2.46-2.472v-16.224c0-1.368 1.104-2.472 2.46-2.472h16.08zm-4.632 15.672c2.652-.084 3.672-1.824 3.672-1.824 0-3.864-1.728-6.996-1.728-6.996-1.728-1.296-3.372-1.26-3.372-1.26l-.168.192c2.04.624 2.988 1.524 2.988 1.524-2.256-.816-4.008-1.524-5.964-1.524-1.956 0-3.708.708-5.964 1.524 0 0 .948-.9 2.988-1.524l-.168-.192c0 0-1.644-.036-3.372 1.26 0 0-1.728 3.132-1.728 6.996 0 0 1.02 1.74 3.672 1.824 0 0 .864-.276 1.68-.924-1.608.972-3.12 1.956-3.12 1.956l1.224 1.056s1.38-.348 2.808-.936c.912.42 1.872.576 2.784.576.912 0 1.872-.156 2.784-.576 1.428.588 2.808.936 2.808.936l1.224-1.056s-1.512-.984-3.12-1.956c.816.648 1.68.924 1.68.924zm-6.552-5.616c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332.012-.732-.54-1.332-1.224-1.332zm4.38 0c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332s-.54-1.332-1.224-1.332z"/></svg>
            Login with Discord (Simulated)
          </Button>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-8">
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
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
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
        </CardContent>
      </Card>
    </div>
  );
}

    