import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'io.github.yasuic.literature.debug'
OUT = Path('android-test-results')
OUT.mkdir(exist_ok=True)

def adb(*args, binary=False):
    return subprocess.check_output(['adb', *args], timeout=25, text=not binary)

def ui():
    adb('shell', 'uiautomator', 'dump', '/sdcard/literature-ui.xml')
    text = adb('shell', 'cat', '/sdcard/literature-ui.xml')
    (OUT / 'latest-ui.xml').write_text(text)
    return ET.fromstring(text)

def words(tree):
    return ' '.join(n.get('text', '') + ' ' + n.get('content-desc', '') for n in tree.iter())

def wait_for(phrase, timeout=60):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        try:
            tree = ui()
            if phrase.lower() in words(tree).lower():
                return tree
        except (subprocess.SubprocessError, ET.ParseError):
            pass
        time.sleep(2)
    raise AssertionError('Android did not show ' + phrase)

def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))

def screenshot(name):
    (OUT / name).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))

def launch():
    component = adb('shell', 'cmd', 'package', 'resolve-activity', '--brief', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-p', PACKAGE).strip().splitlines()[-1]
    assert '/' in component, component
    adb('shell', 'am', 'start', '-W', '-n', component)

try:
    adb('shell', 'wm', 'size', '1080x1920')
    launch()
    tree = wait_for('What should the table call you')
    name = next(n for n in tree.iter() if n.get('class') == 'android.widget.EditText')
    tap(name)
    adb('shell', 'input', 'text', 'Player')
    adb('shell', 'input', 'keyevent', '4')
    tree = ui()
    deal = next(n for n in tree.iter() if n.get('text', '').strip() == 'Deal' or n.get('content-desc', '').strip() == 'Deal')
    tap(deal)
    wait_for('Your hand')
    screenshot('android-table.png')
    # Only the test app on this disposable cloud emulator is stopped.
    adb('shell', 'am', 'force-stop', PACKAGE)
    launch()
    tree = wait_for('Your hand')
    assert 'What should the table call you' not in words(tree)
    screenshot('android-resumed.png')
    print('Android launch, deal and saved game resume passed.')
finally:
    screenshot('android-final.png')
    (OUT / 'logcat.txt').write_text(adb('logcat', '-d', '-t', '600'))
