/**
 * ScanPresenceCard — Which scans contain this stock
 * ===================================================
 * Runs all 6 scan filters against the stock's current data
 * and lists which scans include it.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ScanSearch } from 'lucide-react';
import type { ScanStock } from '@/types';

interface ScanPresenceCardProps {
  /** Current stock as ScanStock (with DOT flags) */
  stock: ScanStock | null;
  /** Array of scan IDs this stock appears in */
  matchedScans: { id: string; name: string }[];
}

export default function ScanPresenceCard({ stock, matchedScans }: ScanPresenceCardProps) {
  if (!stock) return null;

  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <ScanSearch className="w-3.5 h-3.5 text-accent-indigo" />
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
          Currently in Scans
        </span>
      </div>

      {matchedScans.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {matchedScans.map((scan) => (
            <Link
              key={scan.id}
              to={`/scanner/${scan.id}`}
              className="flex items-center gap-2 group"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-indigo shrink-0" />
              <span className="text-[11px] font-mono text-secondary group-hover:text-accent-indigo transition-colors">
                {scan.name}
              </span>
              <span className="ml-auto text-[10px] text-muted group-hover:text-accent-indigo transition-colors">
                &rarr;
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted italic">
          Not surfacing in any scans today.
        </p>
      )}
    </div>
  );
}
