import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function GameDeleteModal({ isOpen, onClose, games, onDelete }: {
  isOpen: boolean;
  onClose: () => void;
  games: { id: string; name: string }[];
  onDelete: (gameId: string) => void;
}) {
  const [selectedGame, setSelectedGame] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) setSelectedGame(null);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete a Game</DialogTitle>
          <DialogDescription>
            Select a game to delete. This will block it from future sync attempts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {games.map(game => (
            <div key={game.id} className="flex items-center space-x-2">
              <input
                type="radio"
                id={game.id}
                name="game"
                value={game.id}
                checked={selectedGame === game.id}
                onChange={() => setSelectedGame(game.id)}
              />
              <label htmlFor={game.id}>{game.name || game.id}</label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => selectedGame && onDelete(selectedGame)} disabled={!selectedGame}>
            Delete Selected Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
