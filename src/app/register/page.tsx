
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerRegistrationFields } from "@/components/app/PlayerRegistrationFields";
import { registerTeamAction } from "./actions";
import { registrationFormSchema } from "@/lib/registration-schema";
import type { RegistrationFormState, TeamRegistrationFormData } from "@/lib/definitions";
import { useEffect } from "react";
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
};

export default function RegistrationPage() {
  const { toast } = useToast();

  const form = useForm<TeamRegistrationFormData>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues,
  });

  const [formState, formAction] = useFormState<RegistrationFormState, FormData>(
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
        form.reset(defaultValues); // Reset form on success
      } else if (formState.errors) {
        formState.errors.forEach(error => {
          // Map Zod path to react-hook-form path
          const fieldName = error.path.join(".") as keyof TeamRegistrationFormData;
          form.setError(fieldName, { type: "manual", message: error.message });
        });
      }
    }
  }, [formState, toast, form]);

  const onSubmit = (data: TeamRegistrationFormData) => {
    const formData = new FormData();
    formData.append("teamName", data.teamName);
    if (data.teamLogo && data.teamLogo.length > 0) {
      formData.append("teamLogo", data.teamLogo[0]);
    }
    
    (['player1', 'player2', 'player3', 'player4', 'player5'] as const).forEach(playerKey => {
      const player = data[playerKey];
      formData.append(`${playerKey}.nickname`, player.nickname);
      formData.append(`${playerKey}.mmr`, player.mmr.toString()); // MMR is string in form, converted in action
      if (player.profileScreenshot && player.profileScreenshot.length > 0) {
        formData.append(`${playerKey}.profileScreenshot`, player.profileScreenshot[0]);
      }
      formData.append(`${playerKey}.steamProfileUrl`, player.steamProfileUrl);
    });

    // Directly call formAction which is bound to the server action
    // React Hook Form's handleSubmit will pass the event, but we need FormData.
    // Instead, we construct FormData and pass it to `formAction`.
    // This requires a bit of a workaround for useFormState with react-hook-form.
    // A simpler way is to manage pending state manually and call action directly.
    // For this example, let's use a submit button that calls formAction.
    // The 'action' prop on <form> element handles this with useFormState.
  };


  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-primary">Team Registration</CardTitle>
          <CardDescription>
            Register your team for the tournament. Please provide accurate information.
            You might be asked to log in via Discord (simulated for now).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full mb-6 bg-[#5865F2] text-white hover:bg-[#4752C4] hover:text-white">
            {/* Discord Icon SVG or Lucide equivalent */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M19.54 0c1.356 0 2.46 1.104 2.46 2.472v21.528l-2.58-2.28-1.452-1.344-1.536-1.428.636 2.22h-13.62c-1.356 0-2.46-1.104-2.46-2.472v-16.224c0-1.368 1.104-2.472 2.46-2.472h16.08zm-4.632 15.672c2.652-.084 3.672-1.824 3.672-1.824 0-3.864-1.728-6.996-1.728-6.996-1.728-1.296-3.372-1.26-3.372-1.26l-.168.192c2.04.624 2.988 1.524 2.988 1.524-2.256-.816-4.008-1.524-5.964-1.524-1.956 0-3.708.708-5.964 1.524 0 0 .948-.9 2.988-1.524l-.168-.192c0 0-1.644-.036-3.372 1.26 0 0-1.728 3.132-1.728 6.996 0 0 1.02 1.74 3.672 1.824 0 0 .864-.276 1.68-.924-1.608.972-3.12 1.956-3.12 1.956l1.224 1.056s1.38-.348 2.808-.936c.912.42 1.872.576 2.784.576.912 0 1.872-.156 2.784-.576 1.428.588 2.808.936 2.808.936l1.224-1.056s-1.512-.984-3.12-1.956c.816.648 1.68.924 1.68.924zm-6.552-5.616c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332.012-.732-.54-1.332-1.224-1.332zm4.38 0c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332s-.54-1.332-1.224-1.332z"/></svg>
            Login with Discord (Simulated)
          </Button>

          <Form {...form}>
            <form action={formAction} className="space-y-8">
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
                            onChange={(e) => onChange(e.target.files)}
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
              
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" size="lg" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register Team
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
