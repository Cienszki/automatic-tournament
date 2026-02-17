import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
	"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
	"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
	"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
	screens: {
	  'xs': '475px',     // Large phones
	  'sm': '640px',     // Small tablets
	  'md': '768px',     // Tablets
	  'lg': '1024px',    // Small laptops
	  'xl': '1280px',    // Desktops
	  '2xl': '1536px',   // Large desktops
	  'fhd': '1920px',   // Full HD
	  '2k': '2560px',    // 2K monitors
	},
	extend: {
	  fontFamily: {
		sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
		mono: ["var(--font-space-mono)", "var(--font-geist-mono)", "ui-monospace", "monospace"],
		neon: ["var(--font-neon-bines)"],
		geist: ["var(--font-geist-sans)"],
		logik: ["var(--font-logik)", "var(--font-geist-sans)", "sans-serif"],
		'logik-extended-bold': ["var(--font-logik-extended-bold)", "var(--font-geist-sans)", "sans-serif"],
		'logik-wide-black': ["var(--font-logik-wide-black)", "var(--font-geist-sans)", "sans-serif"],
		'logik-extended-8': ["var(--font-logik-extended-8)", "var(--font-geist-sans)", "sans-serif"],
		'logik-3': ["var(--font-logik-3)", "var(--font-geist-sans)", "sans-serif"],
		'logik-4': ["var(--font-logik-4)", "var(--font-geist-sans)", "sans-serif"],
		'logik-readable': ["var(--font-logik-4)", "var(--font-geist-sans)", "sans-serif"],
		'space-mono': ["Space Mono", "var(--font-geist-mono)", "monospace"],
		neonderthaw: ["Neonderthaw", "var(--font-geist-sans)", "sans-serif"],
		'tilt-neon': ["Tilt Neon", "var(--font-geist-sans)", "sans-serif"],
	  },
	  fontSize: {
		// Fluid typography scale
		'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
		'fluid-sm': 'clamp(0.875rem, 0.825rem + 0.25vw, 1rem)',
		'fluid-base': 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)',
		'fluid-lg': 'clamp(1.125rem, 1.05rem + 0.375vw, 1.25rem)',
		'fluid-xl': 'clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)',
		'fluid-2xl': 'clamp(1.5rem, 1.35rem + 0.75vw, 1.875rem)',
		'fluid-3xl': 'clamp(1.875rem, 1.65rem + 1.125vw, 2.25rem)',
		'fluid-4xl': 'clamp(2.25rem, 1.9rem + 1.75vw, 3rem)',
		'fluid-5xl': 'clamp(3rem, 2.4rem + 3vw, 4rem)',
		'fluid-6xl': 'clamp(3.75rem, 2.85rem + 4.5vw, 5rem)',
	  },
		colors: {
			background: 'hsl(var(--background))',
			foreground: 'hsl(var(--foreground))',
			card: {
				DEFAULT: 'hsl(var(--card))',
				foreground: 'hsl(var(--card-foreground))'
			},
			popover: {
				DEFAULT: 'hsl(var(--popover))',
				foreground: 'hsl(var(--popover-foreground))'
			},
			primary: {
				DEFAULT: 'hsl(var(--primary))',
				foreground: 'hsl(var(--primary-foreground))'
			},
			secondary: {
				DEFAULT: 'hsl(var(--secondary))',
				foreground: 'hsl(var(--secondary-foreground))'
			},
			muted: {
				DEFAULT: 'hsl(var(--muted))',
				foreground: 'hsl(var(--muted-foreground))'
			},
			accent: {
				DEFAULT: 'hsl(var(--accent))',
				foreground: 'hsl(var(--accent-foreground))'
			},
			destructive: {
				DEFAULT: 'hsl(var(--destructive))',
				foreground: 'hsl(var(--destructive-foreground))'
			},
			border: 'hsl(var(--border))',
			input: 'hsl(var(--input))',
			ring: 'hsl(var(--ring))',
			// PDL-specific colors
			pdl: {
				crimson: 'hsl(345, 75%, 31%)',
				'crimson-light': 'hsl(345, 70%, 39%)',
				'crimson-dark': 'hsl(345, 75%, 24%)',
				gold: 'hsl(46, 65%, 52%)',
				'gold-light': 'hsl(46, 72%, 62%)',
				'gold-dark': 'hsl(46, 60%, 45%)',
			},
			// Letnia-specific colors
			letnia: {
				pink: 'hsl(330, 100%, 54%)',
				cyan: 'hsl(180, 100%, 50%)',
				green: 'hsl(109, 100%, 54%)',
				purple: 'hsl(270, 100%, 65%)',
			},
			// Division tier colors
			division: {
				elite: 'hsl(46, 65%, 52%)',      // Gold
				challenger: 'hsl(0, 0%, 75%)',   // Silver
				adept: 'hsl(30, 60%, 50%)',      // Bronze
			},
			chart: {
				'1': 'hsl(var(--chart-1))',
				'2': 'hsl(var(--chart-2))',
				'3': 'hsl(var(--chart-3))',
				'4': 'hsl(var(--chart-4))',
				'5': 'hsl(var(--chart-5))'
			},
			sidebar: {
				DEFAULT: 'hsl(var(--sidebar-background))',
				foreground: 'hsl(var(--sidebar-foreground))',
				primary: 'hsl(var(--sidebar-primary))',
				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
				accent: 'hsl(var(--sidebar-accent))',
				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
				border: 'hsl(var(--sidebar-border))',
				ring: 'hsl(var(--sidebar-ring))'
			}
		},
		borderRadius: {
			lg: 'var(--radius)',
			md: 'calc(var(--radius) - 2px)',
			sm: 'calc(var(--radius) - 4px)'
		},
		keyframes: {
			'accordion-down': {
				from: {
					height: '0'
				},
				to: {
					height: 'var(--radix-accordion-content-height)'
				}
			},
			'accordion-up': {
				from: {
					height: 'var(--radix-accordion-content-height)'
				},
				to: {
					height: '0'
				}
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out'
		}
	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
