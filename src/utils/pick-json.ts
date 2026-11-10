// Pick a JSON file and read it as text — ADR-012 (data import).
//
// expo-document-picker is a native module added in v1.1. Builds made before
// it have no ExpoDocumentPicker, so it is required lazily behind
// requireOptionalNativeModule (a plain require would log a red "Cannot find
// native module" even when the throw is caught) — same as ExpoSystemUI.

import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system';

type DocumentPickerModule = typeof import('expo-document-picker');

export type PickJsonResult =
  | { kind: 'picked'; text: string; name: string }
  | { kind: 'cancelled' }
  /** This build has no document picker — the app needs updating. */
  | { kind: 'unavailable' }
  /** Picked, but not readable as text (or far too big to be a backup). */
  | { kind: 'unreadable' };

/** A backup is a few hundred KB at most; anything bigger is not ours. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

let picker: DocumentPickerModule | null | undefined;
function loadPicker(): DocumentPickerModule | null {
  if (picker === undefined) {
    picker =
      requireOptionalNativeModule('ExpoDocumentPicker') === null
        ? null
        : // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require('expo-document-picker') as DocumentPickerModule);
  }
  return picker;
}

export async function pickJsonFile(): Promise<PickJsonResult> {
  const mod = loadPicker();
  if (mod === null) return { kind: 'unavailable' };
  const res = await mod.getDocumentAsync({
    // Files exported from WeMoa are .json; some share targets hand them back
    // as plain text, so accept both and validate the content instead.
    type: ['application/json', 'public.json', 'text/plain', 'public.text'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled) return { kind: 'cancelled' };
  const asset = res.assets[0];
  if (asset === undefined) return { kind: 'cancelled' };
  if (asset.size !== undefined && asset.size > MAX_BACKUP_BYTES) return { kind: 'unreadable' };
  try {
    const file = new FileSystem.File(asset.uri);
    const text = await file.text();
    try {
      file.delete(); // the picker's cache copy — not needed once read
    } catch {
      /* ignore */
    }
    if (text.length > MAX_BACKUP_BYTES) return { kind: 'unreadable' };
    return { kind: 'picked', text, name: asset.name };
  } catch {
    return { kind: 'unreadable' };
  }
}
