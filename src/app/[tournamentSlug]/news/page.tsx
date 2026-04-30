"use client";

import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Calendar, User, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { cn } from '@/lib/utils';

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
 * Public News Page - Displays all published announcements
 */
export default function NewsPage() {
  const { tournament, theme } = useTournament();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPosts();
  }, [tournament?.id]);

  const loadPosts = async () => {
    if (!tournament?.id) {
      setLoading(false);
      return;
    }

    try {
      const announcementsRef = collection(db, 'tournaments', tournament.id, 'announcements');
      // Filter server-side so unpublished drafts are never sent to the browser.
      // Requires composite index: published ASC + createdAt DESC (defined in firestore.indexes.json)
      const q = query(
        announcementsRef,
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
      );
      const snapshot = await getDocs(q);

      const loadedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsPost[];

      setPosts(loadedPosts);
    } catch (error) {
      console.error('Error loading news posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePostExpansion = (postId: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'd MMMM yyyy, HH:mm', { locale: pl });
    } catch {
      return dateString;
    }
  };

  // Convert plain text with markdown-like formatting to HTML
  const formatContent = (content: string) => {
    if (!content) return '';
    
    let formatted = content;
    
    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong class="font-logik-extended-bold">$1</strong>');
    
    // Convert *italic* to <em>
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Convert [link](url) to <a>
    formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80 transition-opacity">$1</a>');
    
    // Convert headers ### to <h3>, ## to <h2>, # to <h1>
    formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="text-xl font-logik-extended-bold text-white mt-6 mb-3">$1</h3>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-logik-extended-bold text-white mt-8 mb-4">$1</h2>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-logik-extended-bold text-white mt-10 mb-5">$1</h1>');
    
    // Convert unordered lists (lines starting with - or *)
    formatted = formatted.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 mb-2">$1</li>');
    // Wrap consecutive <li> in <ul>
    formatted = formatted.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => 
      `<ul class="list-disc list-inside space-y-2 my-4">${match}</ul>`
    );
    
    // Convert numbered lists
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-2">$1</li>');
    // Wrap consecutive numbered <li> in <ol>
    formatted = formatted.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
      // If not already wrapped in ul
      if (!match.includes('<ul')) {
        return `<ol class="list-decimal list-inside space-y-2 my-4">${match}</ol>`;
      }
      return match;
    });
    
    // Convert line breaks to <br> and wrap paragraphs
    const paragraphs = formatted.split(/\n\n+/);
    formatted = paragraphs
      .map(para => {
        // Don't wrap if already wrapped in HTML tag
        if (para.trim().startsWith('<')) return para;
        // Replace single line breaks with <br>
        const withBreaks = para.replace(/\n/g, '<br>');
        return `<p class="mb-4 leading-relaxed">${withBreaks}</p>`;
      })
      .join('\n');
    
    return formatted;
  };

  if (!tournament) return null;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">
      {/* Premium Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle vignette */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)',
          }}
        />

        {/* Ambient glow - top right */}
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
          style={{ background: theme?.primaryColor || '#3b82f6' }}
        />

        {/* Ambient glow - bottom left */}
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: '#dc2626' }}
        />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-8 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 py-8 relative">
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-32 blur-[100px] rounded-full pointer-events-none opacity-10"
            style={{ background: theme.primaryColor }}
          />

          <h1 className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tighter uppercase relative z-10 drop-shadow-2xl">
            Aktualności
          </h1>

          <div className="flex items-center justify-center gap-4 opacity-60">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent" style={{ background: `linear-gradient(to right, transparent, ${theme.primaryColor})` }} />
            <div className="w-2 h-2 rotate-45 border" style={{ borderColor: theme.primaryColor }} />
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent" style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor})` }} />
          </div>
        </div>

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <Card className="border-white/10 bg-black/30 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <Newspaper className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-gray-400 text-lg font-logik">Brak opublikowanych aktualności</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const isExpanded = expandedPosts.has(post.id);
              
              return (
                <Card 
                  key={post.id}
                  className="border-white/10 bg-black/30 backdrop-blur-sm hover:border-white/20 transition-all duration-300 overflow-hidden group"
                >
                  <CardContent className="p-0">
                    {/* Featured Image */}
                    {post.imageUrl && (
                      <div className="relative w-full h-64 overflow-hidden">
                        <Image
                          src={post.imageUrl}
                          alt={post.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-6 md:p-8 space-y-4">
                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span className="font-logik">{formatDate(post.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-logik">{post.authorName}</span>
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="text-3xl md:text-4xl font-logik-extended-bold text-white leading-tight">
                        {post.title}
                      </h2>

                      {/* Excerpt */}
                      {post.excerpt && (
                        <p className="text-gray-300 text-lg font-logik leading-relaxed">
                          {post.excerpt}
                        </p>
                      )}

                      {/* Expandable Content */}
                      <div className={cn(
                        "overflow-hidden transition-all duration-500",
                        isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                      )}>
                        <div className="pt-4 border-t border-white/10 mt-4">
                          <div 
                            className="prose prose-invert prose-lg max-w-none font-logik text-gray-300 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatContent(post.content)) }}
                            style={{
                              '--tw-prose-links': theme.primaryColor,
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      {/* Toggle Button */}
                      <button
                        onClick={() => togglePostExpansion(post.id)}
                        className="flex items-center gap-2 text-sm font-logik font-semibold transition-colors hover:opacity-80 mt-4"
                        style={{ color: theme.primaryColor }}
                      >
                        {isExpanded ? (
                          <>
                            <span>Zwiń</span>
                            <ChevronRight className="h-4 w-4 rotate-90 transition-transform" />
                          </>
                        ) : (
                          <>
                            <span>Czytaj więcej</span>
                            <ChevronRight className="h-4 w-4 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
