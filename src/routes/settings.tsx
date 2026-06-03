import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSettings,
  updateSettings,
  exportAll,
  importAll,
  clearAll,
  type AccentColor,
  type Settings,
} from "@/lib/db";
import { applyAccent, applyTheme } from "@/lib/theme";
import { useRef, useState, type ReactNode } from "react";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Screen } from "@/components/mobile/Screen";
import {
  ScreenHeader,
  LangAvatar,
  PastelCard,
  SectionLabel,
} from "@/components/mobile/primitives";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

/* True swatch colours — fixed so they always show their real hue,
 * independent of the currently-active accent. */
const ACCENTS: { key: AccentColor; label: string; color: string }[] = [
  { key: "lime", label: "Lime", color: "oklch(0.88 0.19 124)" },
  { key: "pink", label: "Rose", color: "oklch(0.86 0.075 350)" },
  { key: "mint", label: "Menthe", color: "oklch(0.89 0.085 165)" },
  { key: "lavender", label: "Lavande", color: "oklch(0.87 0.06 295)" },
  { key: "peach", label: "Pêche", color: "oklch(0.88 0.07 70)" },
];

const CARDS_OPTIONS = [10, 20, 30, 50];

function SettingsPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [cardsOpen, setCardsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [importPayload, setImportPayload] = useState<string | null>(null);

  async function patch(p: Partial<Settings>) {
    await updateSettings(p);
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  async function handleTheme() {
    const next = settings?.theme === "light" ? "dark" : "light";
    applyTheme(next);
    await patch({ theme: next });
  }

  async function handleAccent(accent: AccentColor) {
    applyAccent(accent);
    await patch({ accent });
  }

  async function handleCards(value: number) {
    setCardsOpen(false);
    await patch({ cards_per_day: value });
  }

  async function handleReminder(value: boolean) {
    await patch({ daily_reminder: value });
    toast("Bientôt disponible");
  }

  function openName() {
    setNameDraft(settings?.profile_name ?? "");
    setNameOpen(true);
  }

  async function saveName() {
    const name = nameDraft.trim();
    if (!name) return;
    setNameOpen(false);
    await patch({ profile_name: name });
    toast.success("Nom enregistré");
  }

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
      toast.success("Données exportées");
    } catch (e) {
      toast.error("Impossible d'exporter");
      console.error(e);
    }
  }

  async function runImport(mode: "merge" | "replace") {
    const text = importPayload;
    setImportPayload(null);
    if (!text) return;
    try {
      await importAll(text, mode);
      qc.invalidateQueries();
      toast.success(
        mode === "merge" ? "Données fusionnées" : "Données remplacées",
      );
    } catch (e) {
      toast.error("Fichier invalide");
      console.error(e);
    }
  }

  async function handleReset() {
    setResetOpen(false);
    try {
      await clearAll();
      qc.invalidateQueries();
      toast.success("Toutes les données ont été supprimées");
    } catch (e) {
      toast.error("Échec de la suppression");
      console.error(e);
    }
  }

  return (
    <Screen withNav padded>
      <ScreenHeader
        title="Paramètres"
        avatar={<LangAvatar icon="" size="sm" variant="muted" />}
      />

      <PastelCard tone="bg-verbes text-verbes-foreground" className="mt-2">
        <p className="text-sm font-medium leading-snug">
          Vos données restent sur cet appareil. Aucun compte requis.
        </p>
      </PastelCard>

      {/* APPARENCE */}
      <SectionLabel className="mt-8 mb-1 px-1">Apparence</SectionLabel>
      <Group>
        <Row label="Nom" onClick={openName}>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="max-w-[10rem] truncate">
              {settings?.profile_name ?? "—"}
            </span>
            <Pencil className="h-4 w-4 shrink-0" />
          </span>
        </Row>
        <Row label="Thème" onClick={handleTheme}>
          <span className="text-muted-foreground">
            {settings?.theme === "light" ? "Clair" : "Sombre"}
          </span>
        </Row>
        <Row label="Couleur d'accent">
          <div className="flex items-center gap-2.5">
            {ACCENTS.map((a) => {
              const active = settings?.accent === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  aria-label={a.label}
                  aria-pressed={active}
                  onClick={() => handleAccent(a.key)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                    active ? "ring-foreground" : "ring-transparent",
                  )}
                  style={{ backgroundColor: a.color }}
                >
                  {active && (
                    <Check className="h-4 w-4 text-black/70" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
        </Row>
      </Group>

      {/* RÉVISION */}
      <SectionLabel className="mt-8 mb-1 px-1">Révision</SectionLabel>
      <Group>
        <Row label="Cartes par jour" onClick={() => setCardsOpen(true)}>
          <span className="text-muted-foreground">
            {settings?.cards_per_day ?? 20}
          </span>
        </Row>
        <Row label="Rappel quotidien">
          <Switch
            checked={settings?.daily_reminder ?? false}
            onCheckedChange={handleReminder}
            aria-label="Rappel quotidien"
          />
        </Row>
      </Group>

      {/* DONNÉES */}
      <SectionLabel className="mt-8 mb-1 px-1">Données</SectionLabel>
      <Group>
        <Row label="Exporter mes données" onClick={handleExport} />
        <Row
          label="Importer des données"
          onClick={() => fileInput.current?.click()}
        />
        <Row
          label="Tout effacer"
          danger
          onClick={() => setResetOpen(true)}
        />
      </Group>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            setImportPayload(await f.text());
          } catch {
            toast.error("Fichier illisible");
          }
        }}
      />

      <p className="mt-10 text-center text-xs text-muted-foreground">
        RosettaStone · v0.1 · 100% hors-ligne
      </p>

      {/* Nom — edit drawer */}
      <Drawer open={nameOpen} onOpenChange={setNameOpen}>
        <DrawerContent className="pb-8">
          <DrawerHeader>
            <DrawerTitle>Votre nom</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-3 px-4">
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
              }}
              placeholder="Apprenant"
              className="h-12 rounded-2xl text-base"
            />
            <button
              type="button"
              onClick={saveName}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
              disabled={!nameDraft.trim()}
            >
              Enregistrer
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Cartes par jour — picker drawer */}
      <Drawer open={cardsOpen} onOpenChange={setCardsOpen}>
        <DrawerContent className="pb-8">
          <DrawerHeader>
            <DrawerTitle>Cartes par jour</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4">
            {CARDS_OPTIONS.map((n) => {
              const active = (settings?.cards_per_day ?? 20) === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleCards(n)}
                  className={cn(
                    "flex h-14 w-full items-center justify-between rounded-2xl px-5 text-base font-semibold transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  <span>{n} cartes</span>
                  {active && <Check className="h-5 w-5" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Import — merge vs replace */}
      <Dialog
        open={importPayload != null}
        onOpenChange={(o) => {
          if (!o) setImportPayload(null);
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Importer des données</DialogTitle>
            <DialogDescription>
              Fusionner avec vos données actuelles, ou tout remplacer ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              type="button"
              onClick={() => runImport("merge")}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground transition active:scale-[0.98]"
            >
              Fusionner
            </button>
            <button
              type="button"
              onClick={() => runImport("replace")}
              className="flex h-12 w-full items-center justify-center rounded-full bg-destructive text-base font-bold text-destructive-foreground transition active:scale-[0.98]"
            >
              Tout remplacer
            </button>
            <button
              type="button"
              onClick={() => setImportPayload(null)}
              className="flex h-12 w-full items-center justify-center rounded-full text-base font-bold text-muted-foreground transition active:scale-[0.98]"
            >
              Annuler
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tout effacer — confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Tout effacer ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement toutes vos langues, mots,
              verbes, notes et réglages. Elle est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleReset}
              className="h-12 w-full rounded-full bg-destructive text-base font-bold text-destructive-foreground hover:bg-destructive"
            >
              Oui, tout effacer
            </AlertDialogAction>
            <AlertDialogCancel className="h-12 w-full rounded-full text-base font-bold">
              Annuler
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Screen>
  );
}

/* ---------- Divided row group ---------- */

function Group({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {children}
    </div>
  );
}

function Row({
  label,
  children,
  onClick,
  danger,
}: {
  label: string;
  children?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          "text-lg font-bold",
          danger ? "text-destructive" : "text-foreground",
        )}
      >
        {label}
      </span>
      {children}
    </>
  );
  const base =
    "flex w-full items-center justify-between gap-3 py-5 text-left";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, "transition active:opacity-60")}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
}
