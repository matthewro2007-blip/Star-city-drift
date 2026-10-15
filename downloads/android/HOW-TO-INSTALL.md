# How to install Streets of Roanoke 1.8.0 on Android

The Android app is one file, `Streets-of-Roanoke-1.8.0-debug.apk`, about 130 MB. That is over GitHub's 100 MB limit, so it ships as **six parts**. The parts are useless alone. Download all six, keep the names exactly as they are, and leave them in the **same folder**. Then unpack part 1. The unpacker reads the other five by itself.

You can do the whole thing on the phone (route A), or download on a computer and copy the app over (route B).

## The six parts

| Part | File | Size |
| --- | --- | --- |
| 1 | `Streets-of-Roanoke-1.8.0-apk.7z.001` | about 22 MB |
| 2 | `Streets-of-Roanoke-1.8.0-apk.7z.002` | about 22 MB |
| 3 | `Streets-of-Roanoke-1.8.0-apk.7z.003` | about 22 MB |
| 4 | `Streets-of-Roanoke-1.8.0-apk.7z.004` | about 22 MB |
| 5 | `Streets-of-Roanoke-1.8.0-apk.7z.005` | about 22 MB |
| 6 | `Streets-of-Roanoke-1.8.0-apk.7z.006` | about 13 MB |

Direct downloads (tap each one):

1. [Streets-of-Roanoke-1.8.0-apk.7z.001](https://github.com/matthewro2007-blip/Star-city-drift/raw/main/downloads/android/Streets-of-Roanoke-1.8.0-apk.7z.001)
2. [Streets-of-Roanoke-1.8.0-apk.7z.002](https://github.com/matthewro2007-blip/Star-city-drift/raw/main/downloads/android/Streets-of-Roanoke-1.8.0-apk.7z.002)
3. [Streets-of-Roanoke-1.8.0-apk.7z.003](https://github.com/matthewro2007-blip/Star-city-drift/raw/main/downloads/android/Streets-of-Roanoke-1.8.0-apk.7z.003)
4. [Streets-of-Roanoke-1.8.0-apk.7z.004](https://github.com/matthewro2007-blip/Star-city-drift/raw/main/downloads/android/Streets-of-Roanoke-1.8.0-apk.7z.004)
5. [Streets-of-Roanoke-1.8.0-apk.7z.005](https://github.com/matthewro2007-blip/Star-city-drift/raw/main/downloads/android/Streets-of-Roanoke-1.8.0-apk.7z.005)
6. [Streets-of-Roanoke-1.8.0-apk.7z.006](https://github.com/matthewro2007-blip/Star-city-drift/raw/main/downloads/android/Streets-of-Roanoke-1.8.0-apk.7z.006)

After unpacking, the app file is named `Streets-of-Roanoke-1.8.0-debug.apk`. That is the file you install. Do not try to install a `.7z.00` part.

## A. On the phone only

You need the free **ZArchiver** app from the Play Store. It unpacks the six parts. Chrome cannot do that by itself.

1. Tap the link for part 1 above. If the file starts saving, let it finish. If GitHub opens a file page instead, tap the **Download** button (the down arrow) or the **Raw** button. The phone puts the file in the **Downloads** folder.
2. Do the same for parts 2, 3, 4, 5, and 6. Open each file, then tap **Download** or **Raw**. All six must land in the same Downloads folder. Do not rename them, and do not move some of them somewhere else.
3. Open the Files app (or Downloads) and count. You should see:
   - `Streets-of-Roanoke-1.8.0-apk.7z.001`
   - `Streets-of-Roanoke-1.8.0-apk.7z.002`
   - `Streets-of-Roanoke-1.8.0-apk.7z.003`
   - `Streets-of-Roanoke-1.8.0-apk.7z.004`
   - `Streets-of-Roanoke-1.8.0-apk.7z.005`
   - `Streets-of-Roanoke-1.8.0-apk.7z.006`
4. Install [ZArchiver](https://play.google.com/store/apps/details?id=ru.zdevs.zarchiver) from the Play Store. It is free. Open it when it finishes.
5. In ZArchiver, go to **Internal storage → Download** (some phones say **Downloads**). Tap `Streets-of-Roanoke-1.8.0-apk.7z.001`.
6. Tap **Extract**. Leave the destination as the same folder and confirm. ZArchiver reads `.002` through `.006` on its own. Wait until it says it is done. A new file appears: `Streets-of-Roanoke-1.8.0-debug.apk`.
7. Tap that `.apk`. If Android says the phone is not allowed to install unknown apps, tap **Settings** and turn on **Install unknown apps** (sometimes called **Allow from this source**) for **ZArchiver**, or for **Chrome** if the browser is the app that asked. Press Back, then tap the `.apk` again.
8. Tap **Install**. When it finishes, tap **Open**. Streets of Roanoke is on your home screen or app drawer.

The six part files can be deleted after the app is installed. Keep the `.apk` if you want a spare copy.

## B. With a PC

Use this if the phone downloads keep failing, or if you would rather unpack on a computer.

1. On the computer, make one new folder and download all six parts into it. Use the six links above. On each GitHub file page, click the **Download** button (the down arrow) or **Raw**. The names must stay `Streets-of-Roanoke-1.8.0-apk.7z.001` through `.006`, all in that same folder.
2. Install [7-Zip](https://www.7-zip.org/) if it is not already installed. (Windows: the 64-bit installer. Mac and Linux can use the 7-Zip / p7zip app the same way: open the `.001` file and extract here.)
3. In the folder, right-click `Streets-of-Roanoke-1.8.0-apk.7z.001` and choose **7-Zip → Extract Here**. 7-Zip reads `.002` through `.006` by itself. When it finishes you have `Streets-of-Roanoke-1.8.0-debug.apk` in that folder.
4. Copy only that `.apk` to the phone. Either way works:
   - **USB:** plug the phone into the computer, choose **File transfer** on the phone, and copy the `.apk` into the phone's **Download** folder.
   - **Google Drive:** on the computer, upload the `.apk` to Drive. On the phone, open the Drive app, find the file, and download it.
5. On the phone, open Files or Drive and tap `Streets-of-Roanoke-1.8.0-debug.apk`. If Android asks, turn on **Install unknown apps** for the app that opened it (Files, Drive, or Chrome), then go back and tap the `.apk` again.
6. Tap **Install**, then **Open**.

## Troubleshooting

### Only part 1 downloaded, or a missing-part error

ZArchiver or 7-Zip says it cannot find the next volume, "Unexpected end of archive", "Missing volume", or something similar. Part 1 is not the whole app. The other five parts have to sit beside it.

- Count the files. You need `.001`, `.002`, `.003`, `.004`, `.005`, and `.006` in one folder, with those exact names.
- Compare sizes with the table above. A part that is much smaller did not finish. Delete that file and download it again from its link.
- Do not rename `.001` to `.zip` or `.7z`. Do not extract a part other than `.001`.
- On a phone, a second try sometimes saves `Streets-of-Roanoke-1.8.0-apk.7z.001 (1)`. That copy is not part of the set. Delete the broken download and keep one complete set in Downloads.
- Start the extract again from `Streets-of-Roanoke-1.8.0-apk.7z.001` only, after all six files are in that folder.

### "App not installed"

Android got as far as the `.apk` and then stopped with **App not installed**.

- An older Streets of Roanoke or Star City Drift app is already installed, and it was **signed differently**, so Android will not replace it. Uninstall the old copy first: **Settings → Apps → Streets of Roanoke** (or **Star City Drift**) → **Uninstall**. Then tap `Streets-of-Roanoke-1.8.0-debug.apk` again. Uninstalling removes that old app's saved data, so only do this when install-over fails.
- Free about **400 MB** of storage. The download is about 130 MB, and Android needs extra room to unpack the app. Check **Settings → Storage**, remove files you do not need, and tap Install again.
- You have to install `Streets-of-Roanoke-1.8.0-debug.apk`. Tapping a `.7z.001` file will not install the game.

### Play Protect warning

Google Play Protect may warn you, or say the app was blocked, because this app did not come from the Play Store. Tap **More details**, then **Install anyway**. This is the Streets of Roanoke 1.8.0 build published with the game.

### Saves and later updates

When this version installs over an older Streets of Roanoke app, your old saves carry over. You do not start the story again.

After the app is on the phone, later game updates install themselves when you are online. You do not download the six parts again for a normal update.
