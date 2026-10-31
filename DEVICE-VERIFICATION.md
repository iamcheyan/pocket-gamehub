# DEVICE VERIFICATION — pocket-gamehub

Status: **DEVICE-PASS** for the captured states. Local host verification is in
`apps/pocket-gamehub/POCKETJS-VERIFICATION.md`.

## Device

- Anbernic RG34XX, Base OS 1.5.2 (h700), kernel 4.9.170 aarch64.
- Access: Debian host -> HX90 -> USB ADB.
- Display: `/dev/fb0`, 720x480 visible page, 32 bpp.
- Runtime: `/mnt/sdcard/System/pocketjs/bin/pocket-linux-kms` (existing boot runtime, not rebuilt or replaced).
- Package: `pocket-gamehub` sha256 `8cab816a8489421d4343da6cd41e0173c17076bb15d6837deb565388d65bdf57`.
- Deployed to `/storage/pjs/pocket-gamehub/app.pocket` only.

## Procedure

1. Recorded boot launcher pid `18645` and `boot.pocket`
   sha256 `6ed41612bce1723d1eda64b5a0ee9333a105ed498b7085c03267539cf6c1b32d`.
2. Paused the launcher supervisor, stopped the launcher, and started the
   package with the same runtime and `/dev/fb0`.
3. Created a virtual keyboard with `/dev/uinput` and drove the native view
   tree through a FIFO (`uinputd-c`); no host browser and no HTML.
4. Captured `/dev/fb0` with `dd` -> base64 -> PIL.
5. Killed the package, restored the launcher, and read the pid
   `28102` and boot hash back.

Result: launcher pid changed, boot package sha256 stayed
`6ed41612bce1723d1eda64b5a0ee9333a105ed498b7085c03267539cf6c1b32d`. No write to `/storage/System`, `/storage/pocketjs`,
`/storage/baseos.conf` or `/storage/content`.

## Frames

The images are the device framebuffer. The UI was rasterized by the PocketJS
native renderer on the RG34XX, not by host Chrome.

| file | sha256 (first 16) |
|---|---|
| `docs/device/device-gamehub-detail-action.png` | `73a85b9a12ba61d0` |
| `docs/device/device-gamehub-detail.png` | `e6636fd23e95230d` |
| `docs/device/device-gamehub-fb-after.png` | `d59130e3329b8496` |
| `docs/device/device-gamehub-fb-before.png` | `d59130e3329b8496` |
| `docs/device/device-gamehub-home-focus.png` | `50e78345657e5980` |
| `docs/device/device-gamehub-home.png` | `4fb3c37f034a9424` |
| `docs/device/device-gamehub-settings-toggled.png` | `348766438a3920d0` |
| `docs/device/device-gamehub-settings.png` | `6e390b891cbf36c6` |

`device-gamehub-fb-before.png` and `device-gamehub-fb-after.png` are the boot
launcher before and after; they are byte-identical here, which is the intended
restore evidence.

Captured states: 6 states: home, focus, detail, detail action, settings, settings toggle.
