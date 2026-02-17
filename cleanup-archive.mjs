#!/usr/bin/env node

/**
 * Cleanup Script - Archives unused files to _archive folder
 * 
 * This script moves development files, test files, and legacy data
 * to an _archive folder to keep the project clean while preserving
 * the files for potential future reference.
 * 
 * Run: node cleanup-archive.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Archive folder location
const ARCHIVE_DIR = path.join(__dirname, '_archive');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
const ARCHIVE_SUBDIR = path.join(ARCHIVE_DIR, `archive-${timestamp}`);

// Files and folders to archive
const TO_ARCHIVE = {
  // Root-level debug/test scripts
  scripts: [
    'check-existing-data.js',
    'check-game-fantasy-scores.js',
    'check-performance-structure.js',
    'check-playoff-data.js',
    'check-tournament-status.js',
    'check-tournaments.js',
    'check_processed_game.js',
    'cleanup-pdl-test-data.mjs',
    'debug-dominance.js',
    'debug-hero-picks-fixed.js',
    'debug-hero-picks.js',
    'debug-lower-bracket.js',
    'debug-perf-fields.js',
    'debug-performance-data.js',
    'debug-pickem-data-simple.js',
    'debug-pickem-structure.js',
    'debug-playoff-data.js',
    'debug-stats-values.js',
    'debug-stats.js',
    'debug-tournament-stats.js',
    'delete-mockup-data.js',
    'detailed-performance-analysis.js',
    'explore-pickem-system.js',
    'export-pickem-debug.js',
    'export-pickem-scores-final.js',
    'export-pickem-standalone.js',
    'fix-tournament-status.js',
    'inspect_db.js',
    'list-mockup-data.js',
    'reinitialize-playoffs.js',
    'setup-tournaments.mjs',
    'trigger-stats-fetch.mjs',
    'verify-bracket-structure.js',
  ],

  // JSON data files
  dataFiles: [
    'all_performance_ids.json',
    'api_response.json',
    'new_api_response.json',
    'full_leaderboards.json',
    'hero_data.json',
    'hero-data.json',
    'league_18559_matches.json',
    'opendota-match.json',
    'opendota_league_matches.json',
    'opendota_league_teams_for_registration.json',
    'opendota_league_teams_from_matches.json',
    'opendota_match_8423006415.json',
    'stratz_league_matches.json',
    'marchewa_games.json',
    'marchewa_player.json',
    'marchewa_steam32_games.json',
    'match_players.json',
    'player_league_matches.json',
    'registration_payloads.json',
    'tournament-hero-statistics.json',
    'test-playoff-data.json',
    'test-playoff-enhanced.json',
  ],

  // Documentation files (keep README.md and PERFORMANCE_OPTIMIZATION_REPORT.md)
  docs: [
    'api-doc.txt',
    'firebase-doc.txt',
    'for-gemini.txt',
    'headers.txt',
    'opendota-specs.json',
    'react-tournament-brackets-docs.txt',
    'BALANCED_SCORING_SUMMARY.md',
    'DIVISION_PAGES_COMPLETE.md',
    'FANTASY FINAL_EQUALIZED_SCORING_SUMMARY.md',
    'FANTASY_SCORING_GUIDE.md',
    'FANTASY_SCORING_QUICK_REFERENCE.txt',
    'FANTASY_STRATEGY_GUIDE.txt',
    'fantasy-scoring-report.xml',
    'HERO_STATISTICS_REPORT.md',
    'HOW_IT_WORKS.md',
    'MANUAL_MATCH_IMPORT.md',
    'PICKEM_EXPORT_README.md',
    'PLAYOFF_IMPROVEMENTS.md',
    'UNIFIED_GAME_SAVE_MIGRATION.md',
    'test-standin-display.md',
    'example-opendota-match.json',
  ],

  // Log and CSV files
  logs: [
    'firebase-debug.log',
    'firebase_test.log',
    'pickem_export_2025-10-06.csv',
    'pickem_scores_export_2025-10-06.csv',
    'cors.json',
  ],

  // Backup and temporary folders
  folders: [
    'backup-threejs',
    'codebase1',
    'parsed replays',
    'dist',
    'messages',
  ],

  // Test pages in src/app (these become actual routes)
  testPages: [
    'src/app/test-3d',
    'src/app/test-aframe',
    'src/app/test-canvas',
    'src/app/test-css3d',
    'src/app/test-hooks',
    'src/app/test-minimal',
    'src/app/test-pure-three',
    'src/app/test-spline',
    'src/app/test-threejs',
    'src/app/test-useeffect',
    'src/app/upload-test',
    'src/app/playoffs-test',
    'src/app/playoffs-test-v2',
    'src/app/playoffs-test-v3',
    'src/app/groups-builder',
    'src/app/groups-draw',
  ],

  // Test components
  testComponents: [
    'src/components/test',
    'src/components/dev',
  ],
};

// Statistics
let stats = {
  moved: 0,
  skipped: 0,
  errors: 0,
  totalSize: 0,
};

/**
 * Get file/folder size recursively
 */
function getSize(itemPath) {
  try {
    const stat = fs.statSync(itemPath);
    if (stat.isFile()) {
      return stat.size;
    } else if (stat.isDirectory()) {
      let size = 0;
      const items = fs.readdirSync(itemPath);
      for (const item of items) {
        size += getSize(path.join(itemPath, item));
      }
      return size;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Copy file or directory recursively
 */
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const items = fs.readdirSync(src);
    for (const item of items) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

/**
 * Move a file or folder to archive
 */
function moveToArchive(relativePath) {
  const sourcePath = path.join(__dirname, relativePath);
  const destPath = path.join(ARCHIVE_SUBDIR, relativePath);

  if (!fs.existsSync(sourcePath)) {
    console.log(`⏭️  Skipped: ${relativePath} (doesn't exist)`);
    stats.skipped++;
    return;
  }

  try {
    const size = getSize(sourcePath);
    stats.totalSize += size;

    // Copy to archive
    copyRecursive(sourcePath, destPath);

    // Delete original
    if (fs.statSync(sourcePath).isDirectory()) {
      fs.rmSync(sourcePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(sourcePath);
    }

    console.log(`✅ Moved: ${relativePath} (${formatSize(size)})`);
    stats.moved++;
  } catch (error) {
    console.error(`❌ Error moving ${relativePath}:`, error.message);
    stats.errors++;
  }
}

/**
 * Main cleanup function
 */
function main() {
  console.log('🗂️  Cleanup Script - Archiving unused files\n');
  console.log(`Archive location: ${ARCHIVE_SUBDIR}\n`);

  // Create archive directory
  if (!fs.existsSync(ARCHIVE_SUBDIR)) {
    fs.mkdirSync(ARCHIVE_SUBDIR, { recursive: true });
  }

  // Archive each category
  console.log('📦 Archiving root-level scripts...');
  TO_ARCHIVE.scripts.forEach(moveToArchive);

  console.log('\n📦 Archiving JSON data files...');
  TO_ARCHIVE.dataFiles.forEach(moveToArchive);

  console.log('\n📦 Archiving documentation files...');
  TO_ARCHIVE.docs.forEach(moveToArchive);

  console.log('\n📦 Archiving logs and CSV files...');
  TO_ARCHIVE.logs.forEach(moveToArchive);

  console.log('\n📦 Archiving backup folders...');
  TO_ARCHIVE.folders.forEach(moveToArchive);

  console.log('\n📦 Archiving test pages...');
  TO_ARCHIVE.testPages.forEach(moveToArchive);

  console.log('\n📦 Archiving test components...');
  TO_ARCHIVE.testComponents.forEach(moveToArchive);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✨ Cleanup Complete!\n');
  console.log(`✅ Files/folders moved:  ${stats.moved}`);
  console.log(`⏭️  Skipped (not found):  ${stats.skipped}`);
  console.log(`❌ Errors:               ${stats.errors}`);
  console.log(`💾 Total size archived:  ${formatSize(stats.totalSize)}`);
  console.log('='.repeat(60));

  // Create a manifest file
  const manifest = {
    timestamp: new Date().toISOString(),
    stats,
    archived: TO_ARCHIVE,
  };
  
  fs.writeFileSync(
    path.join(ARCHIVE_SUBDIR, 'ARCHIVE_MANIFEST.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n📋 Archive manifest saved to: ${path.join(ARCHIVE_SUBDIR, 'ARCHIVE_MANIFEST.json')}`);
  console.log('\n💡 Tip: You can safely delete the _archive folder if you don\'t need these files.\n');
}

// Run the script
main();
