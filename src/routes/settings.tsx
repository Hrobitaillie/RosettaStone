import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { exportAll, importAll, clearAll } from "@/lib/db";
import { useRef } from "react";
import { Download, Upload, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { AppShell } from "@/components/mobile/AppShell";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      const json = await exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rosettastone-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé");
    } catch (e) {
      toast.error("Impossible d'exporter");
      console.error(e);
    }
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const mode = confirm(
        "OK = fusionner avec les données actuelles. Annuler = tout remplacer.",
      )
        ? "merge"
        : "replace";
      await importAll(text, mode);
      qc.invalidateQueries();
      toast.success("Données importées");
    } catch (e) {
      toast.error("Fichier invalide");
      console.error(e);
    }
  }

  async function handleReset() {
    if (!confirm("Tout supprimer définitivement ?")) return;
    if (!confirm("Vraiment ? Cette action est irréversible.")) return;
    await clearAll();
    qc.invalidateQueries();
    toast.success("Tout a été supprimé");
  }

  return (
    <>
      <MobileHeader title="Réglages" />
      <AppShell>
        <div className="px-5 pt-4 pb-10">
          <Section title="Vos données">
            <Row
              icon={<Download className="h-5 w-5" />}
              label="Exporter (JSON)"
              hint="Sauvegarder toutes vos langues, mots, verbes et notes."
              onClick={handleExport}
            />
            <Row
              icon={<Upload className="h-5 w-5" />}
              label="Importer (JSON)"
              hint="Restaurer ou fusionner une sauvegarde."
              onClick={() => fileInput.current?.click()}
            />
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />
            <Row
              icon={<Trash2 className="h-5 w-5 text-destructive" />}
              label="Tout effacer"
              hint="Supprimer définitivement toutes les données locales."
              onClick={handleReset}
              danger
            />
          </Section>

          <Section title="À propos">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Info className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">RosettaStone</div>
                <p className="mt-1 text-muted-foreground">
                  Votre dictionnaire personnel d'apprentissage. Toutes les données sont
                  stockées localement sur votre téléphone — aucun compte, aucun serveur.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">v0.1 · build local</p>
              </div>
            </div>
          </Section>
        </div>
      </AppShell>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Row({
  icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition active:bg-muted"
    >
      <div
        className={
          danger
            ? "flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10"
            : "flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        }
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className={"font-medium " + (danger ? "text-destructive" : "")}>{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </button>
  );
}
