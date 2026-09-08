# PyInstaller spec for Sonotype Windows build
# Build: pyinstaller sonotype.spec --noconfirm

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

datas = []
datas += collect_data_files("fastapi")
datas += collect_data_files("uvicorn")
datas += collect_data_files("yt_dlp")
datas += collect_data_files("reportlab")
datas += collect_data_files("docx")
datas += [("static", "static")]

hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "webview.platforms.edgechromium",
    "webview.platforms.winforms",
    "faster_whisper",
]

hiddenimports += collect_submodules("yt_dlp")

block_cipher = None

a = Analysis(
    ["desktop.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["matplotlib", "tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6"],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="Sonotype",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    icon=None,
)