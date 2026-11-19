import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/** Pill photos live in the app's own storage, never in the gallery or online. */
const dir = () => new Directory(Paths.document, 'pill-photos');

/** Take a photo with the camera, or pick one from the gallery. Returns the saved file's uri, or null if cancelled. */
export async function pickPillPhoto(source: 'camera' | 'library', medId: string): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    res = await ImagePicker.launchCameraAsync(opts);
  } else {
    res = await ImagePicker.launchImageLibraryAsync(opts);
  }
  if (res.canceled || !res.assets?.[0]) return null;
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
  const target = new File(d, `${medId}-${Date.now()}.jpg`);
  new File(res.assets[0].uri).copy(target);
  return target.uri;
}

/** Delete a saved pill photo (ignored if it's already gone). */
export function deletePillPhoto(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // nothing to clean up
  }
}
