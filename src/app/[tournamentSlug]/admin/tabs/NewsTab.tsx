"use client";

import React, { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  Image,
  Bold,
  Italic,
  Link2,
  List,
  Heading1,
  Heading2,
} from 'lucide-react';

interface NewsPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
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
  
  const [posts, setPosts] = useState<NewsPost[]>([
    {
      id: '1',
      title: 'Rozpoczynamy sezon pierwszy PDL!',
      excerpt: 'Witajcie w pierwszym sezonie Polish Dota League! Sprawdźcie wszystkie informacje...',
      content: 'Pełna treść artykułu...',
      author: 'Admin',
      createdAt: '2025-02-20',
      updatedAt: '2025-02-20',
      published: true,
    },
  ]);
  
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

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save functionality
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const handleCreatePost = () => {
    const post: NewsPost = {
      id: `post-${Date.now()}`,
      title: newPost.title,
      excerpt: newPost.excerpt,
      content: newPost.content,
      author: 'Admin',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      published: newPost.published,
      imageUrl: newPost.imageUrl || undefined,
    };
    setPosts([post, ...posts]);
    setNewPost({ title: '', excerpt: '', content: '', imageUrl: '', published: false });
    setShowEditor(false);
  };

  const togglePublished = (postId: string) => {
    setPosts(posts.map(p => 
      p.id === postId ? { ...p, published: !p.published } : p
    ));
  };

  const deletePost = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

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
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={() => setShowEditor(true)}
            className="font-logik"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nowy wpis
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="font-logik"
            style={{ backgroundColor: theme.primaryColor }}
          >
            {isSaving ? (
              <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Zapisz zmiany
          </Button>
        </div>
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
                  <Image className="h-4 w-4 mr-2" />
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
              
              {/* Toolbar */}
              <div className="flex items-center gap-1 p-2 border border-border rounded-t-lg bg-muted/50">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Heading2 className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Bold className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Italic className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Link2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <List className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Image className="h-4 w-4" />
                </Button>
              </div>
              
              <Textarea
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                placeholder="Napisz treść artykułu... (obsługuje Markdown)"
                className="font-logik resize-none rounded-t-none border-t-0 min-h-[300px]"
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
            <Button variant="outline" onClick={() => setShowEditor(false)} className="font-logik">
              Anuluj
            </Button>
            <Button 
              onClick={handleCreatePost}
              className="font-logik"
              style={{ backgroundColor: theme.primaryColor }}
              disabled={!newPost.title || !newPost.content}
            >
              {newPost.published ? 'Opublikuj' : 'Zapisz jako szkic'}
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
                            {post.createdAt}
                          </span>
                          <span>Autor: {post.author}</span>
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
                          onClick={() => {
                            setEditingPost(post);
                            setNewPost({
                              title: post.title,
                              excerpt: post.excerpt,
                              content: post.content,
                              imageUrl: post.imageUrl || '',
                              published: post.published,
                            });
                            setShowEditor(true);
                          }}
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
