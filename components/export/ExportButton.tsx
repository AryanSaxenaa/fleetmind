"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      // Dynamically import to avoid SSR issues
      const jsPDF = (await import("jspdf")).default;

      // Fetch all fleet data in parallel
      const [fleetRes, dnaRes] = await Promise.all([
        fetch("/api/fleet-status"),
        fetch("/api/driver-dna?top=5"),
      ]);

      const fleet = await fleetRes.json();
      const dna = await dnaRes.json();

      const doc = new jsPDF();
      const now = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Title
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("FleetMind Report", 20, 25);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated ${now}`, 20, 33);

      // Separator
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 37, 190, 37);

      // Fleet Status Section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Fleet Status", 20, 47);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let y = 55;
      const statusLines = [
        `Total Vehicles: ${fleet.total}`,
        `Active: ${fleet.active}`,
        `Stopped: ${fleet.stopped}`,
        `Idling: ${fleet.idling}`,
        `Offline: ${fleet.offline}`,
      ];
      for (const line of statusLines) {
        doc.text(line, 25, y);
        y += 7;
      }

      // Driver DNA Section
      y += 5;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Driver DNA Profiles", 20, y);
      y += 10;

      if (dna.profiles && dna.profiles.length > 0) {
        for (const driver of dna.profiles) {
          // Check page overflow
          if (y > 260) {
            doc.addPage();
            y = 20;
          }

          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(`${driver.name} — ${driver.archetype}`, 25, y);
          y += 6;

          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          const scores = driver.scores;
          doc.text(
            `Safety: ${scores.safety} | Efficiency: ${scores.efficiency} | Consistency: ${scores.consistency} | Responsive: ${scores.responsiveness} | Endurance: ${scores.endurance}`,
            25,
            y
          );
          y += 5;

          doc.setTextColor(80, 80, 80);
          // Word-wrap the strength summary
          const summaryLines = doc.splitTextToSize(
            driver.strengthSummary,
            160
          );
          doc.text(summaryLines, 25, y);
          y += summaryLines.length * 4.5;

          // Coaching tip
          doc.setTextColor(50, 100, 150);
          const tipLines = doc.splitTextToSize(
            `Tip: ${driver.coachingTip}`,
            160
          );
          doc.text(tipLines, 25, y);
          y += tipLines.length * 4.5 + 6;

          doc.setTextColor(0, 0, 0);
        }
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("No Driver DNA data available.", 25, y);
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "FleetMind v2 — AI Fleet Management Copilot",
        20,
        doc.internal.pageSize.height - 10
      );

      doc.save(`FleetMind-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={exportPDF}
      disabled={isExporting}
      className="size-10 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-cream transition-colors group disabled:opacity-50"
      aria-label={isExporting ? "Exporting PDF..." : "Export PDF"}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <FileDown className="h-4 w-4 text-muted group-hover:text-primary transition-colors" />
      )}
    </button>
  );
}
