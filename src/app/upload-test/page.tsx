"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadScreenshot, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Loader2, LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

export default function UploadTestPage() {
    const { user, signInWithGoogle, signOut } = useAuth(); // Updated to use Google sign-in

    const [file, setFile] = useState<File | null>(null);
    const [isFileUploading, setIsFileUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ url?: string; message?: string; type: 'success' | 'error' } | null>(null);

    const [teamName, setTeamName] = useState('');
    const [teamTag, setTeamTag] = useState('');
    const [isDbSubmitting, setIsDbSubmitting] = useState(false);
    const [dbResult, setDbResult] = useState<{ message?: string; type: 'success' | 'error' } | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) setFile(selectedFile);
    };

    const handleFileUpload = async () => {
        if (!file) return;
        setIsFileUploading(true);
        setUploadResult(null);
        try {
            const downloadURL = await uploadScreenshot(file, "upload-test-team", "test-player");
            setUploadResult({ url: downloadURL, message: "File uploaded successfully!", type: 'success' });
        } catch (error) {
            setUploadResult({ message: (error as Error).message, type: 'error' });
        } finally {
            setIsFileUploading(false);
        }
    };
    
    const handleDbSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!teamName || !teamTag) return;
        
        setIsDbSubmitting(true);
        setDbResult(null);
        
        try {
            const docRef = await addDoc(collection(db, "testTeams"), {
              name: teamName,
              tag: teamTag,
              createdAt: serverTimestamp(),
              ownerId: user?.uid || 'unknown'
            });
            setDbResult({ message: `Test team saved with ID: ${docRef.id}`, type: 'success' });
        } catch (error) {
            console.error("Database test failed:", error);
            setDbResult({ message: (error as Error).message, type: 'error' });
        } finally {
            setIsDbSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto p-8 flex justify-center">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>System Test Page</CardTitle>
                    <CardDescription>
                        Use this page to test individual pieces of functionality.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* --- AUTHENTICATION --- */}
                    <div className="p-4 border rounded-md bg-muted/50">
                        {user ? (
                            <div className="flex items-center justify-between">
                                <p>Signed in as <strong>{user.displayName}</strong></p>
                                <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4"/>Sign Out</Button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                               <p className="text-destructive font-semibold">You are not signed in.</p>
                                <Button onClick={signInWithGoogle}><LogIn className="mr-2 h-4 w-4"/>Sign In with Google</Button>
                            </div>
                        )}
                    </div>

                    {/* --- DATABASE WRITE TEST --- */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">1. Database Write Test</h3>
                        <form onSubmit={handleDbSubmit} className="p-4 border rounded-md">
                            <fieldset disabled={!user} className="space-y-4">
                               <div className="space-y-2">
                                   <Label htmlFor="teamName">Team Name</Label>
                                   <Input id="teamName" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Enter a test team name" />
                               </div>
                               <div className="space-y-2">
                                   <Label htmlFor="teamTag">Team Tag</Label>
                                   <Input id="teamTag" value={teamTag} onChange={(e) => setTeamTag(e.target.value)} placeholder="Enter a test team tag" />
                               </div>
                               <Button type="submit" disabled={isDbSubmitting} className="w-full">
                                   {isDbSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save to Database"}
                               </Button>
                            </fieldset>
                           {dbResult && (
                                <p className={`text-sm font-medium p-3 rounded-md mt-4 text-center ${dbResult.type === 'success' ? "bg-green-100 text-green-800" : "bg-red-100 text-destructive"}`}>
                                    {dbResult.message}
                                </p>
                           )}
                        </form>
                    </div>
                    
                    <Separator />

                    {/* --- FILE UPLOAD TEST --- */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">2. File Upload Test</h3>
                        <div className="p-4 border rounded-md">
                           <fieldset disabled={!user} className="space-y-4">
                               <div className="space-y-2">
                                 <Label htmlFor="fileUpload">MMR Screenshot</Label>
                                 <Input id="fileUpload" type="file" accept="image/*" onChange={handleFileChange} />
                               </div>
                               <Button onClick={handleFileUpload} disabled={!file || isFileUploading} className="w-full">
                                   {isFileUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Upload File"}
                               </Button>
                           </fieldset>
                        </div>
                        {uploadResult && (
                            <div>
                                <p className={`text-sm font-medium p-3 rounded-md mt-4 text-center ${uploadResult.type === 'success' ? "bg-green-100 text-green-800" : "bg-red-100 text-destructive"}`}>
                                    {uploadResult.message}
                                </p>
                                {uploadResult.url && (
                                    <div className="pt-4 text-center">
                                        <Link href={uploadResult.url} target="_blank" className="text-sm text-primary hover:underline break-all">{uploadResult.url}</Link>
                                        <div className="relative w-full h-64 mt-2"><Image src={uploadResult.url} alt="Uploaded screenshot" layout="fill" objectFit="contain" /></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
