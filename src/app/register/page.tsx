"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, ShieldPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { TEAM_MMR_CAP } from "@/lib/mock-data";
import { PlayerRoles } from "@/lib/definitions";
import type { TeamRegistrationFormData } from "@/lib/definitions";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const playerSchema = z.object({
  nickname: z.string().min(2, "Nickname must be at least 2 characters."),
  mmr: z.coerce.number().int().min(1, "MMR must be a positive number.").max(12000, "MMR seems too high."),
  profileScreenshot: z
    .any()
    .refine((file) => file instanceof File, "Profile screenshot is required.")
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 2MB.`)
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
      ".jpg, .jpeg, .png and .webp files are accepted."
    ),
  steamProfileUrl: z.string().url("Must be a valid Steam profile URL."),
  role: z.enum(PlayerRoles, { required_error: "Please select a role." }),
});

const registrationFormSchema = z.object({
    teamName: z.string().min(3, "Team name must be at least 3 characters.").max(50),
    teamLogo: z
      .any()
      .refine((file) => file instanceof File, "A team logo is required.")
      .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 2MB.`)
      .refine(
        (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
        ".jpg, .jpeg, .png and .webp files are accepted."
      ),
    teamMotto: z.string().max(100, "Motto cannot exceed 100 characters.").optional(),
    players: z.array(playerSchema).length(5, "You must register exactly 5 players."),
    rulesAgreed: z.boolean().refine((val) => val === true, {
      message: "You must agree to the tournament rules.",
    }),
}).refine(data => {
    const totalMMR = data.players.reduce((sum, player) => sum + player.mmr, 0);
    return totalMMR <= TEAM_MMR_CAP;
}, {
    message: `Total team MMR cannot exceed ${TEAM_MMR_CAP.toLocaleString()}.`,
    path: ["players"], 
});

export default function RegisterPage() {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof registrationFormSchema>>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      teamName: "",
      teamMotto: "",
      players: Array(5).fill({
        nickname: "",
        mmr: 0,
        steamProfileUrl: "",
        role: undefined,
      }),
      rulesAgreed: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "players",
  });

  const totalMMR = form.watch("players").reduce((sum, player) => sum + (Number(player.mmr) || 0), 0);
  const isOverMMRCap = totalMMR > TEAM_MMR_CAP;


  function onSubmit(values: z.infer<typeof registrationFormSchema>) {
    console.log("Form Submitted:", values);
    toast({
      title: "Registration Submitted!",
      description: `Team "${values.teamName}" has been submitted for verification.`,
    });
    form.reset();
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <UserPlus className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">
            Team Registration
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Register your team for the 'Jesienna Zadyma' tournament.
          </CardDescription>
        </CardHeader>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Team Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="teamName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., The Radiant Protectors" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teamMotto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Motto (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="A short, catchy phrase" {...field} />
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
                      <FormLabel>Team Logo</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept={ACCEPTED_IMAGE_TYPES.join(",")}
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
          
          <Card>
            <CardHeader>
              <CardTitle>Player Roster</CardTitle>
               <div className={cn(
                    "p-3 rounded-md text-center text-sm font-semibold",
                     isOverMMRCap ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary"
                  )}>
                  Total Team MMR: {totalMMR.toLocaleString()} / {TEAM_MMR_CAP.toLocaleString()}
               </div>
                {form.formState.errors.players && (
                  <p className="text-sm font-medium text-destructive">{form.formState.errors.players.message}</p>
                )}
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
                    {fields.map((field, index) => (
                        <AccordionItem value={`item-${index}`} key={field.id}>
                            <AccordionTrigger>Player {index + 1}</AccordionTrigger>
                            <AccordionContent className="grid md:grid-cols-2 gap-6 p-4 border rounded-md">
                                <FormField
                                    control={form.control}
                                    name={`players.${index}.nickname`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nickname</FormLabel>
                                        <FormControl><Input placeholder="Player's in-game name" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`players.${index}.mmr`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>MMR</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 5500" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`players.${index}.steamProfileUrl`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Steam Profile URL</FormLabel>
                                        <FormControl><Input placeholder="https://steamcommunity.com/..." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`players.${index}.role`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Role</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select the player's primary role" />
                                                </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {PlayerRoles.map(role => (
                                                        <SelectItem key={role} value={role}>{role}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="md:col-span-2">
                                  <FormField
                                      control={form.control}
                                      name={`players.${index}.profileScreenshot`}
                                      render={({ field: { onChange, value, ...rest }}) => (
                                      <FormItem>
                                          <FormLabel>MMR Screenshot</FormLabel>
                                          <FormControl>
                                            <Input 
                                              type="file" 
                                              accept={ACCEPTED_IMAGE_TYPES.join(",")}
                                              onChange={(e) => onChange(e.target.files?.[0])}
                                              {...rest}
                                            />
                                          </FormControl>
                                          <FormDescription>A recent, clear screenshot of the player's profile showing their MMR.</FormDescription>
                                          <FormMessage />
                                      </FormItem>
                                      )}
                                  />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>Final Steps</CardTitle>
            </CardHeader>
            <CardContent>
               <FormField
                    control={form.control}
                    name="rulesAgreed"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                            I confirm that my team and I have read and agree to the tournament rules.
                            </FormLabel>
                            <FormDescription>
                             You can review the full ruleset on the <Link href="/rules" className="text-primary hover:underline">Rules page</Link>.
                            </FormDescription>
                            <FormMessage />
                        </div>
                        </FormItem>
                    )}
                />
            </CardContent>
             <CardContent>
                 <Button type="submit" size="lg" className="w-full">
                    <ShieldPlus className="mr-2 h-5 w-5" />
                    Submit Registration
                </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
