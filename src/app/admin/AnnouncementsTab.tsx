
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createAnnouncement, getAnnouncements, deleteAnnouncement } from '@/lib/firestore';
import { Announcement } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';

export function AnnouncementsTab() {
    const [announcement, setAnnouncement] = useState('');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        async function fetchAnnouncements() {
            setIsLoading(true);
            const allAnnouncements = await getAnnouncements();
            setAnnouncements(allAnnouncements);
            setIsLoading(false);
        }
        fetchAnnouncements();
    }, []);

    const handleSubmit = async () => {
        if (!announcement.trim()) {
            toast({
                title: 'Error',
                description: 'Announcement content cannot be empty.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await createAnnouncement(announcement);
            setAnnouncement('');
            // Refresh the list after submitting
            const allAnnouncements = await getAnnouncements();
            setAnnouncements(allAnnouncements);
            toast({
                title: 'Success!',
                description: 'Your announcement has been posted.',
                variant: 'success',
            });
        } catch (error) {
            console.error("Failed to create announcement:", error);
            toast({
                title: 'Error',
                description: 'Could not post the announcement. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteAnnouncement(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            toast({
                title: 'Deleted',
                description: 'The announcement has been removed.',
            });
        } catch (error) {
            console.error("Failed to delete announcement:", error);
            toast({
                title: 'Error',
                description: 'Could not delete the announcement. Please try again.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manage Announcements</CardTitle>
                <CardDescription>
                    Post new announcements or delete existing ones.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="font-semibold mb-2">Create New Announcement</h3>
                    <Textarea
                        placeholder="Type your announcement here..."
                        value={announcement}
                        onChange={(e) => setAnnouncement(e.target.value)}
                        rows={4}
                    />
                     <Button onClick={handleSubmit} disabled={isSubmitting} className="mt-2">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                        {isSubmitting ? 'Posting...' : 'Post Announcement'}
                    </Button>
                </div>

                <div className="border-t pt-6">
                     <h3 className="font-semibold mb-2">Existing Announcements</h3>
                     {isLoading ? (
                         <div className="text-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                     ) : (
                        <ul className="space-y-2">
                            {announcements.map((item) => (
                                <li key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <div>
                                        <p>{item.content}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                    <Button size="sm" variant="destructive-outline" onClick={() => handleDelete(item.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                     )}
                </div>
            </CardContent>
        </Card>
    );
}
