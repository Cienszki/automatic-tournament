"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { doc, collection, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
  Newspaper,
  Save,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';

interface NewsPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  published: boolean;
  imageUrl?: string;
}

/**
 * News Tab - Blog post editor with title, content, images, styling
 */
export function NewsTab() {
  const { tournament, theme } = useTournament();
  const { user } = useAuth();
  
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);
  const [newPost, setNewPost] = useState({
    title: '',
    excerpt: '',
    content: '',
    imageUrl: '',
    published: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load announcements from Firestore
  useEffect(() => {
    if (!tournament?.id) return;
    loadAnnouncements();
  }, [tournament?.id]);

  const loadAnnouncements = async () => {
    if (!tournament?.id) return;
    
    setLoading(true);
    try {
      const announcementsRef = collection(db, 'tournaments', tournament.id, 'announcements');
      const q = query(announcementsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const loadedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsPost[];
      
      setPosts(loadedPosts);
    } catch (error) {
      console.error('Error loading announcements:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się załadować aktualności',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!tournament?.id || !user) {
      toast({
        title: 'Błąd',
        description: 'Brak danych użytkownika lub turnieju',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const announcementsRef = collection(db, 'tournaments', tournament.id, 'announcements');
      const postData = {
        title: newPost.title,
        excerpt: newPost.excerpt,
        content: newPost.content,
        authorId: user.uid,
        authorName: user.displayName || 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        published: newPost.published,
        imageUrl: newPost.imageUrl || '',
      };

      if (editingPost) {
        // Update existing post
        const postRef = doc(db, 'tournaments', tournament.id, 'announcements', editingPost.id);
        await updateDoc(postRef, {
          ...postData,
          createdAt: editingPost.createdAt, // Keep original creation date
        });
        
        toast({
          title: 'Zaktualizowano',
          description: 'Wpis został zaktualizowany',
          action: <CheckCircle className="h-5 w-5 text-green-500" />,
        });
      } else {
        // Create new post
        await addDoc(announcementsRef, postData);
        
        toast({
          title: 'Utworzono',
          description: 'Nowy wpis został utworzony',
          action: <CheckCircle className="h-5 w-5 text-green-500" />,
        });
      }

      // Reset form and reload
      setNewPost({ title: '', excerpt: '', content: '', imageUrl: '', published: false });
      setEditingPost(null);
      setShowEditor(false);
      await loadAnnouncements();
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zapisać wpisu',
        variant: 'destructive',
        action: <AlertCircle className="h-5 w-5" />,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublished = async (postId: string) => {
    if (!tournament?.id) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      const postRef = doc(db, 'tournaments', tournament.id, 'announcements', postId);
      await updateDoc(postRef, {
        published: !post.published,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setPosts(posts.map(p => 
        p.id === postId ? { ...p, published: !p.published } : p
      ));

      toast({
        title: 'Zaktualizowano',
        description: `Wpis ${!post.published ? 'opublikowany' : 'ukryty'}`,
      });
    } catch (error) {
      console.error('Error toggling published:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zaktualizować statusu',
        variant: 'destructive',
      });
    }
  };

  const deletePost = async (postId: string) => {
    if (!tournament?.id) return;
    
    if (!confirm('Czy na pewno chcesz usunąć ten wpis?')) return;

    try {
      const postRef = doc(db, 'tournaments', tournament.id, 'announcements', postId);
      await deleteDoc(postRef);

      setPosts(posts.filter(p => p.id !== postId));

      toast({
        title: 'Usunięto',
        description: 'Wpis został usunięty',
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć wpisu',
        variant: 'destructive',
      });
    }
  };

  const handleEditPost = (post: NewsPost) => {
    setEditingPost(post);
    setNewPost({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      imageUrl: post.imageUrl || '',
      published: post.published,
    });
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingPost(null);
    setNewPost({ title: '', excerpt: '', content: '', imageUrl: '', published: false });
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin" style={{ color: theme.primaryColor }} />
          <p className="text-muted-foreground font-logik">Ładowanie aktualności...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Aktualności</h2>
          <p className="text-muted-foreground font-logik">
            Zarządzanie wpisami na blogu turnieju
          </p>
        </div>
        <Button 
          variant="outline"
          onClick={() => setShowEditor(true)}
          className="font-logik"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nowy wpis
        </Button>
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold">
              {editingPost ? 'Edytuj wpis' : 'Nowy wpis'}
            </DialogTitle>
            <DialogDescription className="font-logik">
              Stwórz lub edytuj wpis na blogu turnieju
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Tytuł</Label>
              <Input
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                placeholder="Wpisz tytuł artykułu..."
                className="font-logik text-lg"
              />
            </div>

            {/* Featured Image */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Obrazek wyróżniający</Label>
              <div className="flex items-center gap-3">
                <Input
                  value={newPost.imageUrl}
                  onChange={(e) => setNewPost({ ...newPost, imageUrl: e.target.value })}
                  placeholder="URL obrazka..."
                  className="font-logik"
                />
                <Button variant="outline" className="font-logik shrink-0">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Prześlij
                </Button>
              </div>
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Zajawka</Label>
              <Textarea
                value={newPost.excerpt}
                onChange={(e) => setNewPost({ ...newPost, excerpt: e.target.value })}
                placeholder="Krótki opis artykułu (max 200 znaków)..."
                className="font-logik resize-none"
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground font-logik">
                {newPost.excerpt.length}/200 znaków
              </p>
            </div>

            {/* Content Editor */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Treść</Label>
              
              {/* Formatting Guide */}
              <div className="text-xs text-muted-foreground font-logik bg-muted/30 p-3 rounded-lg space-y-1">
                <p className="font-logik-extended-bold mb-2">Dostępne formatowanie:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div><code className="bg-black/30 px-1 rounded">**pogrubienie**</code> → <strong>pogrubienie</strong></div>
                  <div><code className="bg-black/30 px-1 rounded">*kursywa*</code> → <em>kursywa</em></div>
                  <div><code className="bg-black/30 px-1 rounded"># Nagłówek 1</code> → duży tytuł</div>
                  <div><code className="bg-black/30 px-1 rounded">## Nagłówek 2</code> → średni tytuł</div>
                  <div><code className="bg-black/30 px-1 rounded">### Nagłówek 3</code> → mały tytuł</div>
                  <div><code className="bg-black/30 px-1 rounded">[tekst](url)</code> → link</div>
                  <div><code className="bg-black/30 px-1 rounded">- element</code> → lista</div>
                  <div><code className="bg-black/30 px-1 rounded">1. element</code> → lista numerowana</div>
                </div>
                <p className="mt-2 pt-2 border-t border-white/5">💡 Podwójny Enter = nowy akapit. Pojedynczy Enter = nowa linia.</p>
              </div>
              
              <Textarea
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                placeholder="Napisz treść artykułu... (użyj formatowania powyżej)"
                className="font-logik resize-none min-h-[300px]"
              />
            </div>

            {/* Publish Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div>
                <p className="font-logik-extended-bold">Opublikuj od razu</p>
                <p className="text-sm text-muted-foreground font-logik">
                  Wpis będzie widoczny dla wszystkich użytkowników
                </p>
              </div>
              <Switch
                checked={newPost.published}
                onCheckedChange={(v) => setNewPost({ ...newPost, published: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditor} className="font-logik">
              Anuluj
            </Button>
            <Button 
              onClick={handleCreatePost}
              className="font-logik"
              style={{ backgroundColor: theme.primaryColor }}
              disabled={!newPost.title || !newPost.content || isSaving}
            >
              {isSaving ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                <>
                  {editingPost ? 'Zaktualizuj' : (newPost.published ? 'Opublikuj' : 'Zapisz jako szkic')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Posts List */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardContent className="py-12 text-center">
              <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-logik-extended-bold mb-2">Brak wpisów</p>
              <p className="text-muted-foreground font-logik mb-4">
                Stwórz pierwszy wpis aby rozpocząć
              </p>
              <Button onClick={() => setShowEditor(true)} className="font-logik">
                <Plus className="h-4 w-4 mr-2" />
                Nowy wpis
              </Button>
            </CardContent>
          </Card>
        ) : (
          posts.map(post => (
            <Card key={post.id} className="border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {/* Featured Image Thumbnail */}
                  {post.imageUrl && (
                    <div 
                      className="w-24 h-24 rounded-lg bg-cover bg-center shrink-0"
                      style={{ backgroundImage: `url(${post.imageUrl})` }}
                    />
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-logik-extended-bold text-lg truncate">{post.title}</h3>
                          {post.published ? (
                            <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-logik shrink-0">
                              <Eye className="h-3 w-3 mr-1" />
                              Opublikowany
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-logik shrink-0">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Szkic
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-logik line-clamp-2 mb-2">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-logik">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(post.createdAt).toLocaleDateString('pl-PL')}
                          </span>
                          <span>Autor: {post.authorName}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => togglePublished(post.id)}
                          className="h-8 w-8"
                        >
                          {post.published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditPost(post)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePost(post.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
