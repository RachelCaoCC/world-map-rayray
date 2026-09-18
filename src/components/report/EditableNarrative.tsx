import { useEffect, useState } from "react";

interface EditableNarrativeProps {
  storageKey: string;
  defaultValue: string;
  className?: string;
}

const STORAGE_PREFIX = "world-map-report:v1:";

function readSavedValue(storageKey: string, defaultValue: string) {
  if (typeof window === "undefined") return defaultValue;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function EditableNarrative({
  storageKey,
  defaultValue,
  className = "",
}: EditableNarrativeProps) {
  const [value, setValue] = useState(() => readSavedValue(storageKey, defaultValue));
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const nextValue = readSavedValue(storageKey, defaultValue);
    setValue(nextValue);
    setDraft(nextValue);
    setIsEditing(false);
  }, [storageKey, defaultValue]);

  const save = () => {
    const nextValue = draft.trim() || defaultValue;
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, nextValue);
    } catch {
      // The edited text still remains available for this browser session.
    }
    setValue(nextValue);
    setDraft(nextValue);
    setIsEditing(false);
  };

  const reset = () => {
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
    } catch {
      // Reset the visible value even when storage is unavailable.
    }
    setValue(defaultValue);
    setDraft(defaultValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="mt-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={6}
          aria-label="Edit report commentary"
          className={`min-h-36 w-full resize-y rounded-lg border border-blue-300 bg-white p-3 text-sm leading-6 text-slate-700 outline-none ring-blue-100 focus:ring-4 print:hidden ${className}`}
        />
        <p className={`hidden whitespace-pre-wrap text-sm leading-6 text-slate-600 print:block ${className}`}>
          {draft.trim() || defaultValue}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Save comment
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setIsEditing(false);
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            Restore automatic analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className={`whitespace-pre-wrap text-sm leading-6 text-slate-600 ${className}`}>{value}</p>
      <div className="mt-2 flex gap-3 print:hidden">
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setIsEditing(true);
          }}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          Edit comment
        </button>
        {value !== defaultValue && (
          <button
            type="button"
            onClick={reset}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 hover:underline"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
