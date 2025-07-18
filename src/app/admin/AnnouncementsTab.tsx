
"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createAnnouncement, deleteAnnouncement } from '@/lib/announcement-actions';
import { getAnnouncements } from '@/lib/firestore';
import { Announcement } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

export function AnnouncementsTab() {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isSubmitting, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const sortedAnnouncements = useMemo(() => {
        return [...announcements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }, [announcements]);

    const fetchAnnouncements = async () => {
        setIsLoading(true);
        const allAnnouncements = await getAnnouncements();
        setAnnouncements(allAnnouncements);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const handleSubmit = async () => {
        if (!user) {
            toast({
                title: 'Not Authenticated',
                description: 'You must be logged in to post an announcement.',
                variant: 'destructive',
            });
            return;
        }
        
        if (!title.trim() || !announcement.trim()) {
            toast({
                title: 'Error',
                description: 'Title and content cannot be empty.',
                variant: 'destructive',
            });
            return;
        }

        startTransition(async () => {
            const result = await createAnnouncement(title, announcement);
            if (result.success) {
                setTitle('');
                setAnnouncement('');
                await fetchAnnouncements(); // Re-fetch announcements
                toast({
                    title: 'Success!',
                    description: 'Your announcement has been posted.',
                });
            } else {
                console.error("Failed to create announcement:", result.error);
                toast({
                    title: 'Error',
                    description: 'Could not post the announcement. Please try again.',
                    variant: 'destructive',
                });
            }
        });
    };

    const handleDelete = async (id: string) => {
        if (!user) {
            toast({
                title: 'Not Authenticated',
                description: 'You must be logged in to delete an announcement.',
                variant: 'destructive',
            });
            return;
        }

        startTransition(async () => {
            const result = await deleteAnnouncement(id);
            if (result.success) {
                await fetchAnnouncements(); // Re-fetch announcements
                toast({
                    title: 'Deleted',
                    description: 'The announcement has been removed.',
                });
            } else {
                console.error("Failed to delete announcement:", result.error);
                toast({
                    title: 'Error',
                    description: 'Could not delete the announcement. Please try again.',
                    variant: 'destructive',
                });
            }
        });
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
                <div className="space-y-2">
                    <h3 className="font-semibold mb-2">Create New Announcement</h3>
                    <Input
                        placeholder="Announcement Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isSubmitting}
                    />
                    <Textarea
                        placeholder="Type your announcement here..."
                        value={announcement}
                        onChange={(e) => setAnnouncement(e.target.value)}
                        rows={4}
                        disabled={isSubmitting}
                    />
                     <Button onClick={handleSubmit} disabled={isSubmitting || !user} className="mt-2">
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
                            {sortedAnnouncements.map((item) => (
                                <li key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <div>
                                        <p className="font-bold">{item.title}</p>
                                        <p>{item.content}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Posted {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })} by {item.authorName}
                                        </p>
                                    </div>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)} disabled={isSubmitting}>
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
