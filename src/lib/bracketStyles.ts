// Enhanced styles for the bracket components
export const bracketStyles = {
  container: {
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden'
  },
  
  // Custom styles for the SVG elements that the bracket library creates
  bracketSvgOverrides: `
    .bracket-game {
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
    }
    
    .bracket-game rect {
      fill: rgba(30, 41, 59, 0.9) !important;
      stroke: rgba(59, 130, 246, 0.3) !important;
      stroke-width: 2 !important;
      rx: 8 !important;
    }
    
    .bracket-game text {
      fill: white !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-weight: 500 !important;
    }
    
    .bracket-game .team-name {
      font-size: 14px !important;
      font-weight: 600 !important;
    }
    
    .bracket-game .team-score {
      font-size: 16px !important;
      font-weight: bold !important;
      fill: #60a5fa !important;
    }
    
    .bracket-connector {
      stroke: rgba(156, 163, 175, 0.6) !important;
      stroke-width: 2 !important;
    }
    
    .bracket-game:hover rect {
      fill: rgba(30, 41, 59, 1) !important;
      stroke: rgba(59, 130, 246, 0.6) !important;
    }
  `
};

export default bracketStyles;
