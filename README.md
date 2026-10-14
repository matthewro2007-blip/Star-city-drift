# Star City Drift

Star City Drift is a finished 2D arcade beat 'em up set in Roanoke, Virginia. You play as Matthew Rose, free-roaming the streets at golden hour, clearing thug waves, and finishing the job. It is a static site of vanilla ES modules and canvas (no build step) and can be installed as an app on PC and phone.

Version 1.5.0 adds a free prequel DLC where you play as Silas Boone. Version 1.6.0 rewrites the story as "The Star Goes Dark" and adds the Dark Star Suit. Version 1.6.1 adds Sunny, Night, and Rainy weather, switchable from the title screen and the pause menu.

Play it at https://matthewro2007-blip.github.io/Star-city-drift/

## Install as an app

- **Chrome or Edge on PC:** use the install icon in the address bar.
- **Android Chrome:** Add to Home screen, or Install app.
- **iPhone Safari:** Share, then Add to Home Screen.

## Android APK

Download [Star-City-Drift.apk](downloads/Star-City-Drift.apk) (v1.6.1, versionCode 13) and sideload it. Allow installation from unknown sources when Android asks. Music, sound effects, character voices, the Beacon outfit, item collectibles, and the closer camera are built in. The app auto-updates when online. This APK is signed with a new debug key, because the original signing key is not in the repo. If 1.6.0 is already installed, uninstall it before installing 1.6.1. Uninstalling clears that app's on-device save. Desktop installs keep their saves.

## Controls

- **Keyboard:** WASD or arrows move, Z punch, X kick, C heavy, E talk, T weather (Sunny / Night / Rainy), 1–5 outfits, Esc pause/save. Weather is also on the title screen and in the pause menu, and it is remembered on this device.
- **Controllers:** PlayStation 5 and Xbox controllers are supported.
- **Phones:** on-screen touch controls.

## Windows

The v1.6.1 desktop build for 64-bit Windows is split into seven parts. Download all seven into the same folder:

- [Star-City-Drift-1.6.1-Setup-win-x64.7z.001](downloads/windows/Star-City-Drift-1.6.1-Setup-win-x64.7z.001)
- [Star-City-Drift-1.6.1-Setup-win-x64.7z.002](downloads/windows/Star-City-Drift-1.6.1-Setup-win-x64.7z.002)
- [Star-City-Drift-1.6.1-Setup-win-x64.7z.003](downloads/windows/Star-City-Drift-1.6.1-Setup-win-x64.7z.003)
- [Star-City-Drift-1.6.1-Setup-win-x64.7z.004](downloads/windows/Star-City-Drift-1.6.1-Setup-win-x64.7z.004)
- [Star-City-Drift-1.6.1-Setup-win-x64.7z.005](downloads/windows/Star-City-Drift-1.6.1-Setup-win-x64.7z.005)
- [Star-City-Drift-1.6.1-Setup-win-x64.7z.006](downloads/windows/Star-City-Drift-1.6.1-Setup-win-x64.7z.006)
- [Star-City-Drift-1.6.1-Setup-win-x64.7z.007](downloads/windows/Star-City-Drift-1.6.1-Setup-win-x64.7z.007)

Install [7-Zip](https://www.7-zip.org/), then right-click `Star-City-Drift-1.6.1-Setup-win-x64.7z.001` and choose **7-Zip → Extract Here**. 7-Zip reads `.002` through `.007` automatically. Run the extracted `Star-City-Drift-Setup-1.6.1.exe`.

Music, sound effects, character voices, the Beacon outfit, item collectibles, and the closer camera are built in. The app auto-updates when online. It downloads only the files that changed. Offline, it plays the copy that came with the installer.

## Chromebook

There are three ways to play on a Chromebook. Full steps are in [CHROMEBOOK.txt](downloads/chromebook/CHROMEBOOK.txt).

- **Easiest (recommended): install the web app.** Open the game in Chrome and click **Install** in the address bar (or three-dot menu → Cast, save, and share → Install page as app). It works offline, updates itself, and runs on every Chromebook, including ARM.
- **Android APK:** only for Chromebooks with Google Play turned on. Installing a downloaded APK needs ChromeOS developer mode, so use the web app or the Linux app instead.
- **Linux app (.deb), Intel/AMD Chromebooks:** turn on Linux under **Settings → Advanced → Developers**. Download all 7 parts into the same folder:

  - [Star-City-Drift-1.6.1-chromebook-linux-x64.7z.001](downloads/chromebook/Star-City-Drift-1.6.1-chromebook-linux-x64.7z.001)
  - [Star-City-Drift-1.6.1-chromebook-linux-x64.7z.002](downloads/chromebook/Star-City-Drift-1.6.1-chromebook-linux-x64.7z.002)
  - [Star-City-Drift-1.6.1-chromebook-linux-x64.7z.003](downloads/chromebook/Star-City-Drift-1.6.1-chromebook-linux-x64.7z.003)
  - [Star-City-Drift-1.6.1-chromebook-linux-x64.7z.004](downloads/chromebook/Star-City-Drift-1.6.1-chromebook-linux-x64.7z.004)
  - [Star-City-Drift-1.6.1-chromebook-linux-x64.7z.005](downloads/chromebook/Star-City-Drift-1.6.1-chromebook-linux-x64.7z.005)
  - [Star-City-Drift-1.6.1-chromebook-linux-x64.7z.006](downloads/chromebook/Star-City-Drift-1.6.1-chromebook-linux-x64.7z.006)
  - [Star-City-Drift-1.6.1-chromebook-linux-x64.7z.007](downloads/chromebook/Star-City-Drift-1.6.1-chromebook-linux-x64.7z.007)

  Move them into **Linux files**, then in the Terminal app run `sudo apt install -y p7zip-full` and `7z x Star-City-Drift-1.6.1-chromebook-linux-x64.7z.001`. Double-click the extracted `Star-City-Drift-1.6.1-chromebook-amd64.deb` in the Files app and click **Install**. Star City Drift appears under **Linux apps** in the Launcher. It auto-updates when online.
