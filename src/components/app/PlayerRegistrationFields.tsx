
"use client";
import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeamRegistrationFormData } from "@/lib/definitions";

interface PlayerRegistrationFieldsProps {
  form: UseFormReturn<TeamRegistrationFormData>;
  playerIndex: 1 | 2 | 3 | 4 | 5;
}

export function PlayerRegistrationFields({ form, playerIndex }: PlayerRegistrationFieldsProps) {
  const fieldNamePrefix = `player${playerIndex}` as const;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Player {playerIndex}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name={`${fieldNamePrefix}.nickname`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nickname</FormLabel>
              <FormControl>
                <Input placeholder="e.g., ProGamer123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${fieldNamePrefix}.mmr`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matchmaking Rating (MMR)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g., 5000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${fieldNamePrefix}.profileScreenshot`}
          render={({ field: { onChange, value, ...rest } }) => ( // value is File | undefined
            <FormItem>
              <FormLabel>Profile Screenshot (max 1MB, .jpg, .png, .webp)</FormLabel>
              <FormControl>
                <Input 
                  type="file" 
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => onChange(e.target.files?.[0])} // Pass single File or undefined
                  {...rest} // Pass name, onBlur, ref
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${fieldNamePrefix}.steamProfileUrl`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Steam Profile URL</FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://steamcommunity.com/profiles/..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
