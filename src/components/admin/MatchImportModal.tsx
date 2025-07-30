
// src/components/admin/MatchImportModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Match } from "@/lib/definitions";

interface MatchImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: Match | null; // The match this import is for
    onImportSuccess: () => void;
}

export function MatchImportModal({ isOpen, onClose, match, onImportSuccess }: MatchImportModalProps) {
    // Placeholder content for now
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Game Data</DialogTitle>
                    <DialogDescription>
                        Import OpenDota JSON data for {match?.teamA?.name || 'TBD'} vs {match?.teamB?.name || 'TBD'}.
                    </DialogDescription>
                </DialogHeader>
                {/* Modal content will go here */}
                <div className="py-4">
                    <p>Modal content coming soon...</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
