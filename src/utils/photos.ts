import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/*
| One size for every photo the driver sends.
|
| A phone photo is several megabytes, which over the weak signal at a dock
| can outlast even a generous upload timeout. 1280px wide at 70% is plenty to
| read paperwork or a VIN plate and is a few hundred kilobytes. Camera shots
| and photos picked from the gallery both go through here.
*/
export async function shrinkPhoto(uri: string): Promise<string> {
  try {
    const result = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch (err) {
    console.warn("[photos] Could not shrink the photo, sending the original:", err);
    return uri;
  }
}
