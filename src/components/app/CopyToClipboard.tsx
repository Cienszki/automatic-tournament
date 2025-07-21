"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CopyToClipboardProps {
  text: string;
}

export function CopyToClipboard({ text }: CopyToClipboardProps) {
  const [hasCopied, setHasCopied] = React.useState(false);
  const { toast } = useToast();

  const onCopy = () => {
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast({ title: "Copied!", description: "Discord username copied to clipboard." });
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" onClick={onCopy} className="ml-2 h-7 w-7">
      {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
