import { scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { extractTextFromImage, isSupported } from 'expo-text-extractor';
import { guessFromBox, productCode, type BoxGuess } from '../drugs/scan';

export interface ScanResult extends BoxGuess {
  barcode: string | null;
  lines: string[];
}

/**
 * Takes a photo of a medicine box and reads it on the phone: the text with Google's
 * on-device text recognition and any barcode. The photo isn't kept or sent anywhere.
 * Returns null if cancelled.
 */
export async function scanBox(source: 'camera' | 'library' = 'camera'): Promise<ScanResult | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to scan a box.');
    res = await ImagePicker.launchCameraAsync(opts);
  } else {
    res = await ImagePicker.launchImageLibraryAsync(opts);
  }
  if (res.canceled || !res.assets?.[0]) return null;
  const uri = res.assets[0].uri;

  const [lines, codes] = await Promise.all([
    isSupported ? extractTextFromImage(uri).catch(() => [] as string[]) : Promise.resolve([] as string[]),
    scanFromURLAsync(uri, ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'datamatrix']).catch(() => []),
  ]);
  const text = lines.flatMap((l) => l.split('\n')).map((l) => l.trim()).filter(Boolean);
  return { ...guessFromBox(text), barcode: productCode(codes[0]?.data), lines: text };
}
