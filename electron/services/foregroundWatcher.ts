import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

/**
 * Watches the Windows foreground window and reports its process name whenever it
 * changes, so the overlay can hide itself when the user alt-tabs away from the
 * game (the "only show on AoE4" requirement).
 *
 * Implemented as ONE long-lived hidden PowerShell process that polls
 * `GetForegroundWindow` in a light loop and prints the process name on change —
 * far cheaper than spawning a process per check, and needs no native module.
 * Windows-only; a no-op elsewhere (callers then leave gating effectively off).
 */
const PS_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class _RtsFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
$last = '__init__'
while ($true) {
  $h = [_RtsFg]::GetForegroundWindow()
  $procId = 0
  [void][_RtsFg]::GetWindowThreadProcessId($h, [ref]$procId)
  $name = ''
  try { $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { $name = '' }
  if ($name -ne $last) { $last = $name; Write-Output $name }
  Start-Sleep -Milliseconds 600
}
`.trim()

export class ForegroundWatcher {
  private proc: ChildProcessWithoutNullStreams | null = null

  /** Begin watching; `onChange` fires with the foreground process name on change. */
  start(onChange: (processName: string) => void): void {
    if (process.platform !== 'win32' || this.proc) return
    try {
      this.proc = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT],
        { windowsHide: true },
      )
      let buf = ''
      this.proc.stdout.on('data', (chunk: Buffer) => {
        buf += chunk.toString()
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          // Skip the priming line emitted before the user focuses anything.
          if (line && line !== '__init__') onChange(line)
        }
      })
      this.proc.on('error', () => {
        this.proc = null
      })
      this.proc.on('exit', () => {
        this.proc = null
      })
    } catch {
      this.proc = null
    }
  }

  stop(): void {
    if (!this.proc) return
    try {
      this.proc.kill()
    } catch {
      // already gone
    }
    this.proc = null
  }
}
