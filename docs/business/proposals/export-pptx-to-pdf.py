import subprocess, time, sys, uno
from com.sun.star.beans import PropertyValue
src, out = sys.argv[1], sys.argv[2]
p = subprocess.Popen(['soffice','--headless','--invisible','--norestore','--accept=socket,host=127.0.0.1,port=2002;urp;'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ctx=None
for _ in range(60):
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
        ctx = resolver.resolve('uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext'); break
    except Exception: time.sleep(1)
smgr = ctx.ServiceManager
desktop = smgr.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
def pv(n,v):
    x=PropertyValue(); x.Name=n; x.Value=v; return x
doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), '_blank', 0, (pv('Hidden',True),))
fixed=0
def fix_text(t):
    global fixed
    try:
        en = t.createEnumeration()
        while en.hasMoreElements():
            para = en.nextElement()
            try:
                para.setPropertyValue('ParaIsCharacterDistance', False); fixed+=1
            except Exception: pass
    except Exception: pass
def walk(shape):
    st = shape.getShapeType()
    if st == 'com.sun.star.drawing.GroupShape':
        for i in range(shape.getCount()): walk(shape.getByIndex(i))
    elif st == 'com.sun.star.drawing.TableShape':
        m = shape.getPropertyValue('Model')
        for r in range(m.getRowCount()):
            for c in range(m.getColumnCount()):
                fix_text(m.getCellByPosition(c, r))
    else:
        fix_text(shape)
pages = doc.getDrawPages()
for i in range(pages.getCount()):
    pg = pages.getByIndex(i)
    for j in range(pg.getCount()): walk(pg.getByIndex(j))
doc.storeToURL(uno.systemPathToFileUrl(out), (pv('FilterName','impress_pdf_Export'),))
doc.close(True)
print('paragraphs fixed', fixed)
try: desktop.terminate()
except Exception: pass
p.wait(timeout=30)
