"use client";

import { Pencil } from "lucide-react";
import {
  useActionState,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import {
  updateAssetNotes,
  type NotesFormState,
} from "@/app/(app)/assets/[type]/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ASSET_NOTES_MAX_LENGTH } from "@/lib/schemas/asset";

const initialState: NotesFormState = { status: "idle" };

type AssetNotesCardProps = {
  assetId: number;
  notes: string | null;
  // Decided on the server from the user's role; the action checks it again.
  canEdit: boolean;
};

// Free-text notes, edited in place: Ctrl/⌘ + Enter saves, Esc cancels.
export function AssetNotesCard({
  assetId,
  notes,
  canEdit,
}: AssetNotesCardProps) {
  const saveNotes = useMemo(
    () => updateAssetNotes.bind(null, assetId),
    [assetId],
  );
  const [state, formAction, isPending] = useActionState(
    saveNotes,
    initialState,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  // React to each new result once: close the editor after a save, or show
  // why the save failed.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "saved") setIsEditing(false);
    if (state.status === "error") setError(state.message);
  }

  function startEditing() {
    setDraft(notes ?? "");
    setError(null);
    setIsEditing(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsEditing(false);
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        {canEdit && !isEditing && (
          <CardAction>
            <Button variant="ghost" size="xs" onClick={startEditing}>
              <Pencil aria-hidden />
              {notes ? "Edit" : "Add"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form action={formAction} className="flex flex-col gap-2">
            <Textarea
              name="notes"
              aria-label="Notes"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={ASSET_NOTES_MAX_LENGTH}
              placeholder="e.g. Screen replaced in March; charger kept in IT"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="max-h-80"
            />
            {error && (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {draft.length} / {ASSET_NOTES_MAX_LENGTH}
              </span>
            </div>
          </form>
        ) : notes ? (
          <p className="wrap-break-word whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-muted-foreground">No notes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
