
// src/components/ui/image-modal.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, title = "Screenshot" }: ImageModalProps) {
  // Don't render if no image URL is provided
  if (!imageUrl) return null;
  
  // Check if the imageUrl is a data URL (base64)
  const isDataUrl = imageUrl.startsWith('data:');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 relative w-full h-[70vh]">
          {isDataUrl ? (
            // Use regular img tag for data URLs
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-contain"
            />
          ) : (
            // Use Next.js Image for remote URLs
            <Image
              src={imageUrl}
              alt={title}
              fill
              style={{ objectFit: "contain" }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
