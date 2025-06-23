
"use client";

import { Youtube } from 'lucide-react';
import React from 'react';

// SVG Icon Components
const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19.54 0c1.356 0 2.46 1.104 2.46 2.472v21.528l-2.58-2.28-1.452-1.344-1.536-1.428.636 2.22h-13.62c-1.356 0-2.46-1.104-2.46-2.472v-16.224c0-1.368 1.104-2.472 2.46-2.472h16.08zm-4.632 15.672c2.652-.084 3.672-1.824 3.672-1.824 0-3.864-1.728-6.996-1.728-6.996-1.728-1.296-3.372-1.26-3.372-1.26l-.168.192c2.04.624 2.988 1.524 2.988 1.524-2.256-.816-4.008-1.524-5.964-1.524-1.956 0-3.708.708-5.964 1.524 0 0 .948-.9 2.988-1.524l-.168-.192c0 0-1.644-.036-3.372 1.26 0 0-1.728 3.132-1.728 6.996 0 0 1.02 1.74 3.672 1.824 0 0 .864-.276 1.68-.924-1.608.972-3.12 1.956-3.12 1.956l1.224 1.056s1.38-.348 2.808-.936c.912.42 1.872.576 2.784.576.912 0 1.872-.156 2.784-.576 1.428.588 2.808.936 2.808.936l1.224-1.056s-1.512-.984-3.12-1.956c.816.648 1.68.924 1.68.924zm-6.552-5.616c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332.012-.732-.54-1.332-1.224-1.332zm4.38 0c-.684 0-1.224.6-1.224 1.332 0 .732.552 1.332 1.224 1.332.684 0 1.224-.6 1.224-1.332s-.54-1.332-1.224-1.332z"/>
  </svg>
);

const TwitchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M2.149 0l-1.612 4.119v16.836h5.731v3.045h3.045l3.045-3.045h4.567l6.09-6.09v-11.7L17.851 0h-15.702zm15.701 10.925l-3.045 3.045h-3.806l-3.045 3.045v-3.045h-3.806v-10.149h13.702v7.104zm-4.567-3.806h2.284v3.806h-2.284v-3.806zm-4.567 0h2.284v3.806h-2.284v-3.806z"/>
  </svg>
);

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);


export function Footer() {
  return (
    <footer className="bg-card border-t border-border py-6 text-center">
      <div className="container mx-auto px-4">
        <div className="flex justify-center items-center space-x-6">
          <a
            href="https://discord.gg/pd2ih"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <DiscordIcon className="h-6 w-6" />
            <span className="sr-only">Discord</span>
          </a>
          <a
            href="https://www.twitch.tv/polishdota2inhouse"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitch"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <TwitchIcon className="h-6 w-6" />
            <span className="sr-only">Twitch</span>
          </a>
          <a
            href="https://www.instagram.com/polishdota2inhouse"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <InstagramIcon className="h-6 w-6" />
            <span className="sr-only">Instagram</span>
          </a>
          <a
            href="https://www.youtube.com/@Dota2_Polska"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <Youtube className="h-6 w-6" />
            <span className="sr-only">YouTube</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
