"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTime } from "@/context/TimeContext";
import { format } from "date-fns";

export function TimeMachine() {
  const { simulatedTime, setSimulatedTime } = useTime();
  const [date, setDate] = React.useState<Date | undefined>(simulatedTime);
  const [time, setTime] = React.useState(format(simulatedTime, "HH:mm"));

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
  };

  const handleApply = () => {
    const [hours, minutes] = time.split(":").map(Number);
    const newDate = new Date(date || new Date());
    newDate.setHours(hours, minutes);
    setSimulatedTime(newDate);
  };

  const handleReset = () => {
    setSimulatedTime(new Date());
    setDate(new Date());
    setTime(format(new Date(), "HH:mm"));
  };

  return (
    <Card className="bg-muted/30">
        <CardHeader>
            <CardTitle>Time Machine</CardTitle>
            <CardDescription>Control the current time for the application to test deadline-related logic.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-start">
            <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border"
            />
            <div className="space-y-4 flex-grow">
                <div className="space-y-2">
                    <Label htmlFor="time-input">Time (HH:mm)</Label>
                    <Input id="time-input" type="time" value={time} onChange={handleTimeChange} />
                </div>
                <Button onClick={handleApply} className="w-full">Apply Simulated Time</Button>
                <Button onClick={handleReset} variant="outline" className="w-full">Reset to Real Time</Button>
                <div className="p-3 bg-background rounded-md text-center">
                    <p className="text-sm text-muted-foreground">Simulated Time:</p>
                    <p className="font-bold text-primary">{format(simulatedTime, "PPPPpp")}</p>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
