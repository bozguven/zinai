from playwright.sync_api import sync_playwright
import sys
CFG={'square':(1080,1080,dict(top=70,mid=520,brand=26,h1=104,sub=34,line=28,gap=22)),
     'wide':(1920,1080,dict(top=80,mid=470,brand=30,h1=118,sub=40,line=32,gap=24))}
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')
  for name,(w,h,c) in CFG.items():
    pg=b.new_page(viewport={'width':w,'height':h}); pg.goto('file:///tmp/sg/cover.html')
    pg.add_style_tag(content=f"#c{{width:{w}px;height:{h}px}}#top{{top:{c['top']}px}}.brand{{font-size:{c['brand']}px}}#mid{{top:{c['mid']}px}}h1{{font-size:{c['h1']}px}}#sub{{font-size:{c['sub']}px;margin-top:{c['gap']}px}}.line{{font-size:{c['line']}px;margin-top:{c['gap']//2}px}}#l1{{margin-top:{c['gap']*2}px}}")
    pg.wait_for_timeout(400); pg.screenshot(path=f'shotgun-cover-{name}.png'); pg.close()
  b.close()
