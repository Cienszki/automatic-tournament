"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { getTournamentStatus, updateTournamentStatus } from "@/lib/firestore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TOURNAMENT_STAGES = [
  { 
    id: 'initial', 
    name: 'Registration Open', 
    description: 'Teams can register, fantasy and pick\'em open',
    color: 'bg-green-500/20 text-green-300 border-green-500/40',
    category: 'pre-tournament'
  },
  { 
    id: 'pre_season', 
    name: 'Pre-Season', 
    description: 'Registration closed, fantasy and pick\'em still open',
    color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    category: 'pre-tournament'
  },
  { 
    id: 'group_stage', 
    name: 'Group Stage', 
    description: 'Round robin matches, fantasy lineups for wildcards',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    category: 'tournament'
  },
  { 
    id: 'wildcards', 
    name: 'Wildcards', 
    description: 'Wildcard elimination matches, fantasy lineups for playoffs round 1',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    category: 'tournament'
  },
  { 
    id: 'playoffs_round1', 
    name: 'Playoffs Round 1', 
    description: 'First playoff round, fantasy lineups for round 2',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    category: 'playoffs'
  },
  { 
    id: 'playoffs_round2', 
    name: 'Playoffs Round 2', 
    description: 'Second playoff round, fantasy lineups for round 3',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    category: 'playoffs'
  },
  { 
    id: 'playoffs_round3', 
    name: 'Playoffs Round 3', 
    description: 'Third playoff round, fantasy lineups for round 4',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    category: 'playoffs'
  },
  { 
    id: 'playoffs_round4', 
    name: 'Playoffs Round 4', 
    description: 'Fourth playoff round, fantasy lineups for round 5',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    category: 'playoffs'
  },
  { 
    id: 'playoffs_round5', 
    name: 'Playoffs Round 5', 
    description: 'Fifth playoff round, fantasy lineups for round 6',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    category: 'playoffs'
  },
  { 
    id: 'playoffs_round6', 
    name: 'Playoffs Round 6', 
    description: 'Sixth playoff round, fantasy lineups for round 7',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    category: 'playoffs'
  },
  { 
    id: 'playoffs_round7', 
    name: 'Playoffs Round 7 (Finals)', 
    description: 'Final round - tournament completion',
    color: 'bg-red-500/20 text-red-300 border-red-500/40',
    category: 'playoffs'
  },
  { 
    id: 'finished', 
    name: 'Tournament Finished', 
    description: 'Tournament completed',
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
    category: 'post-tournament'
  }
];

export function TournamentStatusTab() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [currentStatus, setCurrentStatus] = React.useState<string>('initial');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('initial');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  React.useEffect(() => {
    loadTournamentStatus();
  }, []);

  const loadTournamentStatus = async () => {
    try {
      setIsLoading(true);
      const status = await getTournamentStatus();
      const roundId = status?.roundId || 'initial';
      setCurrentStatus(roundId);
      setSelectedStatus(roundId);
    } catch (error) {
      console.error('Error loading tournament status:', error);
      toast({
        title: "Error",
        description: "Failed to load tournament status.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    try {
      setIsUpdating(true);
      await updateTournamentStatus(selectedStatus);
      setCurrentStatus(selectedStatus);
      setShowConfirmDialog(false);
      
      toast({
        title: "Success",
        description: `Tournament status updated to ${TOURNAMENT_STAGES.find(s => s.id === selectedStatus)?.name}`,
      });
    } catch (error) {
      console.error('Error updating tournament status:', error);
      toast({
        title: "Error",
        description: "Failed to update tournament status.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getCurrentStage = () => TOURNAMENT_STAGES.find(s => s.id === currentStatus);
  const getSelectedStage = () => TOURNAMENT_STAGES.find(s => s.id === selectedStatus);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Tournament Status Management
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  const currentStage = getCurrentStage();
  const selectedStage = getSelectedStage();
  const hasChanges = currentStatus !== selectedStatus;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Tournament Status Management
        </CardTitle>
        <CardDescription>
          Control the tournament stage to manage registration, fantasy, and pick'em availability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Current Tournament Stage</Label>
          <div className="flex items-center space-x-2">
            <Badge className={currentStage?.color}>
              <CheckCircle className="w-3 h-3 mr-1" />
              {currentStage?.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{currentStage?.description}</p>
        </div>

        {/* Stage Selector */}
        <div className="space-y-2">
          <Label htmlFor="stage-select" className="text-sm font-medium">
            Change Tournament Stage
          </Label>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger id="stage-select">
              <SelectValue placeholder="Select tournament stage" />
            </SelectTrigger>
            <SelectContent>
              {['pre-tournament', 'tournament', 'playoffs', 'post-tournament'].map(category => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {category === 'pre-tournament' && 'Pre-Tournament'}
                    {category === 'tournament' && 'Tournament'}
                    {category === 'playoffs' && 'Playoffs'}
                    {category === 'post-tournament' && 'Post-Tournament'}
                  </div>
                  {TOURNAMENT_STAGES.filter(stage => stage.category === category).map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{stage.name}</span>
                        <span className="text-xs text-muted-foreground">{stage.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        {hasChanges && selectedStage && (
          <div className="p-4 border border-yellow-500/40 bg-yellow-500/10 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="font-medium text-yellow-300">Proposed Change</span>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="line-through">{currentStage?.name}</span>
              {' → '}
              <span className="text-yellow-300">{selectedStage.name}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">{selectedStage.description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!hasChanges || isUpdating}
            variant={hasChanges ? "default" : "secondary"}
          >
            {isUpdating ? <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div> : null}
            {hasChanges ? "Update Tournament Stage" : "No Changes"}
          </Button>
          
          {hasChanges && (
            <Button
              variant="outline"
              onClick={() => setSelectedStatus(currentStatus)}
            >
              Reset
            </Button>
          )}
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Tournament Stage Change</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to change the tournament stage from <strong>{currentStage?.name}</strong> to <strong>{selectedStage?.name}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-3">
                This will affect:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {selectedStatus === 'pre_season' && (
                  <>
                    <li>Team registration will be closed</li>
                    <li>Fantasy and pick'em submissions remain open</li>
                  </>
                )}
                {selectedStatus === 'group_stage' && (
                  <>
                    <li>All registrations and predictions will be locked</li>
                    <li>Group stage matches become active</li>
                    <li>Fantasy users can submit lineups for wildcards</li>
                  </>
                )}
                {selectedStatus === 'wildcards' && (
                  <>
                    <li>Wildcard elimination matches active</li>
                    <li>Fantasy users can submit lineups for playoffs round 1</li>
                  </>
                )}
                {selectedStatus?.startsWith('playoffs_round') && (
                  <>
                    <li>{`${selectedStage?.name} matches active`}</li>
                    <li>Fantasy users can submit lineups for the next round</li>
                  </>
                )}
                {selectedStatus === 'finished' && (
                  <>
                    <li>Tournament declared complete</li>
                    <li>Final fantasy and pick'em rankings locked</li>
                  </>
                )}
              </ul>
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleStatusUpdate}>
                Confirm Change
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
