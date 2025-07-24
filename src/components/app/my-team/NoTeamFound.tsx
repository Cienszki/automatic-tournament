
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldPlus, Swords } from 'lucide-react';

const NoTeamFound = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full  p-4">
            <Card className="w-full max-w-lg text-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                <CardHeader>
                    <div className="mx-auto bg-primary/10 text-primary rounded-full p-4 w-fit mb-4">
                        <Swords className="h-12 w-12" />
                    </div>
                    <CardTitle className="text-3xl font-bold">Assemble Your Team, Captain!</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground pt-2">
                        The battlefield awaits your strategy. Register your team to manage your roster, schedule matches, and lead your players to victory.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-muted-foreground">
                        Take the first step towards the championship.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button asChild size="lg">
                            <Link href="/register">
                                <ShieldPlus className="mr-2 h-5 w-5" />
                                Create Your Team
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default NoTeamFound;
