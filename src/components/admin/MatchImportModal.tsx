
// src/components/admin/MatchImportModal.tsx

import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { Match } from "@/lib/definitions";
import { getAllTeams, getAllTournamentPlayers, saveGameResults } from "@/lib/firestore";
import { useTranslation } from "@/hooks/useTranslation";



interface MatchImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: Match | null; // The match this import is for
    onImportSuccess: () => void;
}

export function MatchImportModal({ isOpen, onClose, match, onImportSuccess }: MatchImportModalProps) {
    const { t } = useTranslation();

    const [file, setFile] = useState<File | null>(null);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [openDotaData, setOpenDotaData] = useState<any>(null);
    const [radiantTeam, setRadiantTeam] = useState<string>("");
    const [direTeam, setDireTeam] = useState<string>("");
    const [gameNumber, setGameNumber] = useState<string>("1");
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when modal opens/closes
    React.useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setJsonError(null);
            setOpenDotaData(null);
            setRadiantTeam("");
            setDireTeam("");
            setGameNumber("1");
            setIsImporting(false);
            setImportError(null);
        }
    }, [isOpen]);

    // Handle file upload and parse JSON
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setJsonError(null);
        setOpenDotaData(null);
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        try {
            const text = await f.text();
            const json = JSON.parse(text);
            setOpenDotaData(json);
        } catch (err) {
            setJsonError("Invalid JSON file.");
        }
    };

    // Import handler
    const handleImport = async () => {
        setIsImporting(true);
        setImportError(null);
        try {
            if (!openDotaData || !radiantTeam || !direTeam || !match) {
                setImportError(t('toasts.requiredInfo'));
                setIsImporting(false);
                return;
            }
            // Call API route to handle import on the server
            const res = await fetch("/api/import-match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                openDotaData,
                radiantTeam,
                direTeam,
                matchId: match.id,
                gameNumber
              })
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Import failed.");
            }
            setIsImporting(false);
            onImportSuccess();
        } catch (err: any) {
            setImportError(err?.message || "Import failed.");
            setIsImporting(false);
        }
    };

    // Team options for dropdowns
    const teamOptions = match ? [
        { id: match.teamA.id, name: match.teamA.name },
        { id: match.teamB.id, name: match.teamB.name }
    ] : [];
    // Game number options (BO1/2/3)
    const gameNumberOptions = ["1", "2", "3"];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Game Data</DialogTitle>
                    <DialogDescription>
                        Import OpenDota JSON data for {match?.teamA?.name || 'TBD'} vs {match?.teamB?.name || 'TBD'}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <label className="block font-medium mb-1">OpenDota Match JSON</label>
                        <Input type="file" accept="application/json" onChange={handleFileChange} ref={fileInputRef} />
                        {jsonError && <div className="text-destructive text-sm mt-1">{jsonError}</div>}
                        {openDotaData && <div className="text-green-700 text-sm mt-1">File loaded: {file?.name}</div>}
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block font-medium mb-1">Radiant Team</label>
                            <Select value={radiantTeam} onValueChange={setRadiantTeam}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Radiant" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teamOptions.map(opt => (
                                        <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <label className="block font-medium mb-1">Dire Team</label>
                            <Select value={direTeam} onValueChange={setDireTeam}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Dire" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teamOptions.map(opt => (
                                        <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Game Number</label>
                        <Select value={gameNumber} onValueChange={setGameNumber}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select game number" />
                            </SelectTrigger>
                            <SelectContent>
                                {gameNumberOptions.map(num => (
                                    <SelectItem key={num} value={num}>{num}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {importError && <div className="text-destructive text-sm">{importError}</div>}
                    <Button onClick={handleImport} disabled={isImporting || !openDotaData || !radiantTeam || !direTeam} className="w-full">
                        {isImporting ? "Importing..." : "Import Game Data"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
