"""Ends the backend together with the desktop shell that started it."""

import os
import platform
import time


def parent_alive(pid: int) -> bool:
    if platform.system() == "Windows":
        import ctypes
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        STILL_ACTIVE = 259
        handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return False
        code = ctypes.c_ulong()
        ok = ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return bool(ok) and code.value == STILL_ACTIVE
    return os.getppid() == pid


def exit_with_parent(pid: int) -> None:
    """Terminates this process once the supervising Tauri shell is gone (crash, kill -9)."""
    while True:
        time.sleep(2.0)
        if not parent_alive(pid):
            os._exit(0)
