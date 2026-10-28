# Retro Arcade JavaScript ports

The static site serves NOM 1, NOM 2, NOM 3, and MiniGame Paradise 1–3.
NOM 3 and MiniGame Paradise are Korean WIPI beta ports. Their original ARM/Thumb
functions are translated into JavaScript at build time. The web bundle has no
ARM instruction decoder, interpreter fallback, JVM, or Wasm runtime.

## Build WIPI ports

Supply your original game JAR containers as `lib/nom3.jar`, `lib/mini1.jar`,
`lib/mini2.jar`, and `lib/mini3.jar`. Game containers are not included in the
source archive. Use Python 3.11 or later and Node.js for validation.

```sh
python -m pip install pyelftools==0.33 capstone==5.0.9 unicorn==2.1.4 Pillow
python tools/wipi_aot.py
python tools/wipi_lgt_aot.py
python tools/test_wipi_trace.py
node tools/test_wipi_aot.mjs
node tools/test_wipi_lgt_aot.mjs
python -m http.server 8767 --bind 127.0.0.1 --directory dist
```

Unicorn is used only by the build/research tools for initial image relocation and
ABI preparation. It is not shipped in the website. Runtime assets are generated
JavaScript basic blocks plus data/resources, gzip-compressed for transfer and
unpacked with the browser DecompressionStream API. Only the selected game loads.

## Validation

The three MiniGame Paradise ports pass original start/paint/timer/OK-input scenarios.
Eight boot/menu frames matched the research ARM execution output pixel for pixel.
NOM 3 passes a 960-frame JavaScript scenario through menus, story, and the first
play stage, including default save writes. All results are local research fixtures
in the ignored `analysis/` directory, not required at runtime.

## Beta limits

- Vibration, carrier networking, billing, and handset program management
  are unavailable. Game code is not patched to bypass these services.
- Some original game paths and all later stages have not been exhaustively tested.
- NOM 3 has a bounded 32 MiB managed data heap; the MiniGame ports use an 8 MiB heap.
- Progress saves use browser localStorage. Clearing site data removes those saves.
- Fullscreen controls appear only when the letterbox has safe touch space.

The original games/assets remain the property of GAMEVIL/Com2uS. See
`THIRD-PARTY-NOTICES.txt` for WIE ABI reference metadata and fflate MIT notices.

## Audio restoration

See [SOUND-RESTORATION.md](SOUND-RESTORATION.md) for the build-time SMAF renderer,
mobile Web Audio activation, original PCM effects and MIDI score synthesis,
licensing and the three MiniGame Paradise 1 resources still producing silence.
Run `python tools/build_audio.py` and `node tools/test_game_audio.mjs` after preparing the game builds.
