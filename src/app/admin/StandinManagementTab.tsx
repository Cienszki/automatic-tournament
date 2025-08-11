"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, ShieldCheck, Trash2, Users, Clock, CheckCircle } from 'lucide-react';
import { getAllStandins, verifyStandin, deleteStandin } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Standin } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImageModal } from '@/components/ui/image-modal';

export function StandinManagementTab() {
    const [standins, setStandins] = useState<Standin[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        loadStandins();
    }, []);

    const loadStandins = async () => {
        try {
            const standinData = await getAllStandins();
            setStandins(standinData);
        } catch (error) {
            console.error('Error loading standins:', error);
            toast({
                title: "Błąd",
                description: "Nie udało się załadować listy rezerwowych.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (standinId: string) => {
        setUpdating(standinId);
        try {
            await verifyStandin(standinId);
            toast({
                title: "Sukces",
                description: "Rezerwowy został zweryfikowany."
            });
            await loadStandins();
        } catch (error) {
            console.error('Error verifying standin:', error);
            toast({
                title: "Błąd",
                description: "Nie udało się zweryfikować rezerwowego.",
                variant: "destructive"
            });
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (standinId: string) => {
        setUpdating(standinId);
        try {
            await deleteStandin(standinId);
            toast({
                title: "Sukces",
                description: "Rezerwowy został usunięty."
            });
            await loadStandins();
        } catch (error) {
            console.error('Error deleting standin:', error);
            toast({
                title: "Błąd",
                description: "Nie udało się usunąć rezerwowego.",
                variant: "destructive"
            });
        } finally {
            setUpdating(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'verified':
                return (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/40">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Zweryfikowany
                    </Badge>
                );
            case 'pending':
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40">
                        <Clock className="h-3 w-3 mr-1" />
                        Oczekuje
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const openImageModal = (url: string) => {
        setModalImageUrl(url);
        setIsModalOpen(true);
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Zarządzanie Rezerwowymi
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center py-8">
                        <div className="text-muted-foreground">Ładowanie...</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const pendingStandins = standins.filter(s => s.status === 'pending');
    const verifiedStandins = standins.filter(s => s.status === 'verified');

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Zarządzanie Rezerwowymi
                    </CardTitle>
                    <CardDescription>
                        Weryfikuj i zarządzaj graczami rezerwowymi dla turnieju
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Pending Standins */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        Oczekujące weryfikacji ({pendingStandins.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {pendingStandins.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Brak oczekujących zgłoszeń
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nick</TableHead>
                                    <TableHead>Discord</TableHead>
                                    <TableHead>MMR</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Data zgłoszenia</TableHead>
                                    <TableHead>Zrzut ekranu</TableHead>
                                    <TableHead>Akcje</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingStandins.map((standin) => (
                                    <TableRow key={standin.id}>
                                        <TableCell className="font-medium">{standin.nickname}</TableCell>
                                        <TableCell>{standin.discordUsername}</TableCell>
                                        <TableCell>{standin.mmr}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {standin.roles.map((role) => (
                                                    <Badge key={role} variant="outline" className="text-xs">
                                                        {role}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {formatDistanceToNow(new Date(standin.createdAt), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openImageModal(standin.profileScreenshotUrl)}
                                            >
                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                Zobacz
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleVerify(standin.id)}
                                                    disabled={updating === standin.id}
                                                >
                                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                                    Zweryfikuj
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            disabled={updating === standin.id}
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1" />
                                                            Usuń
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Potwierdź usunięcie</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Czy na pewno chcesz usunąć zgłoszenie rezerwowego <strong>{standin.nickname}</strong>? 
                                                                Ta akcja nie może zostać cofnięta.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(standin.id)}
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            >
                                                                Usuń
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Verified Standins */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        Zweryfikowani rezerwowi ({verifiedStandins.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {verifiedStandins.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Brak zweryfikowanych rezerwowych
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nick</TableHead>
                                    <TableHead>Discord</TableHead>
                                    <TableHead>MMR</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Mecze</TableHead>
                                    <TableHead>Akcje</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {verifiedStandins.map((standin) => (
                                    <TableRow key={standin.id}>
                                        <TableCell className="font-medium">{standin.nickname}</TableCell>
                                        <TableCell>{standin.discordUsername}</TableCell>
                                        <TableCell>{standin.mmr}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {standin.roles.map((role) => (
                                                    <Badge key={role} variant="outline" className="text-xs">
                                                        {role}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(standin.status)}
                                        </TableCell>
                                        <TableCell>
                                            {standin.matches ? standin.matches.length : 0}
                                        </TableCell>
                                        <TableCell>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={updating === standin.id}
                                                    >
                                                        <Trash2 className="h-3 w-3 mr-1" />
                                                        Usuń
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Potwierdź usunięcie</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Czy na pewno chcesz usunąć zweryfikowanego rezerwowego <strong>{standin.nickname}</strong>? 
                                                            Ta akcja nie może zostać cofnięta.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(standin.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Usuń
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <ImageModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                imageUrl={modalImageUrl}
                title="Podgląd zrzutu ekranu"
            />
        </div>
    );
}
