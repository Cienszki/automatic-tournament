
import * as React from "react";
import type { CaptainsChecklistItem } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CaptainsChecklistProps {
  items: CaptainsChecklistItem[];
}

export function CaptainsChecklist({ items }: CaptainsChecklistProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <CheckCircle2 className="mr-2" />
          Captain's Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start space-x-3">
              <div className="flex items-center h-6">
                {item.isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <span
                  className={cn(
                    "font-medium",
                    item.isCompleted && "text-muted-foreground line-through"
                  )}
                >
                  {item.label}
                </span>
                {item.link && !item.isCompleted && (
                  <Link
                    href={item.link}
                    className="text-xs text-primary hover:underline ml-2 inline-flex items-center"
                  >
                    {item.linkText || "Go"} <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
