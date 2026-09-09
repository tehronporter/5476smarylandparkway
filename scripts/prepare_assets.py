"""Derive website assets from the current model revision without modifying any
handover or source file.

The interactive model and the dimensioned plans track MODEL_REVISION. The
downloadable SketchUp and Blender files can only be reissued on a machine with
those applications installed, so while they lag they are labelled with their own
revision and the manifest says so explicitly rather than implying one number.
"""
import hashlib, json, shutil, sys
from pathlib import Path
import fitz
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'06-model/v9'))
from web_filter import kept_elements,KEEP_SCENE_MODES,WEB_FIELDS
MODEL_REVISION='v9.5-representation-repair'   # what the viewer and plans carry
NATIVE_REVISION='v9.4-client-handover'        # what the .skp/.blend still carry
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '..').resolve()
OUT=Path(__file__).resolve().parents[1]/'public'
H=ROOT/'06-model/v9'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((H/'model.json').read_text())
assert m['version']==MODEL_REVISION and m['units']=='inches'
assert m['field_gate']=='NOT_PASSED'  # the site states this; never publish a model that dropped it
source_fields=WEB_FIELDS
kept=kept_elements(m)   # one definition, shared with sync_gate.py
ids={e['id'] for e in kept}
scenes=json.loads((H/'scenes.json').read_text())
scenes=[{**s,'visible_ids':[i for i in s['visible_ids'] if i in ids]} for s in scenes if s['mode'] in KEEP_SCENE_MODES]
data={'version':m['version'],'units':m['units'],'source_sha256':sha(H/'model.json'),'source_object_count':len(m['elements']),'field_gate':m['field_gate'],'derived':m['derived'],'materials':m['materials'],'elements':[{k:e[k] for k in source_fields if k in e} for e in kept],'scenes':scenes}
(OUT/'model').mkdir(parents=True,exist_ok=True)
(OUT/'model/house.json').write_text(json.dumps(data,separators=(',',':')))
shutil.copytree(H/'textures',OUT/'model/textures',dirs_exist_ok=True)
PLANS=ROOT/'05-deliverables/day09-v95/5476-Maryland-2D-Floor-Plans-V9.5.pdf'
native_pending = MODEL_REVISION!=NATIVE_REVISION
manifest={'model_revision':MODEL_REVISION,'model_sha256':sha(H/'model.json'),
 'plans_revision':MODEL_REVISION,'plans_sha256':sha(PLANS),
 'native_revision':NATIVE_REVISION,
 'native_status':'PENDING_REBUILD' if native_pending else 'CURRENT',
 'native_pending_reason':('SketchUp and Blender are not installed on the authoring machine; '
  'the .skp and .blend are reissued at '+MODEL_REVISION+' when the native rebuild runs.')
  if native_pending else None,
 'source_sha256':sha(H/'model.json'),'source_objects':len(m['elements']),'web_objects':len(kept),'excluded_objects':len(m['elements'])-len(kept),'coordinate_transform':'[x,y,z] inches -> [x,z,-y] metres; scale 0.0254','source_geometry_changed':False,'files':[]}
for p in sorted((ROOT/'FINAL-CLIENT-HANDOVER').iterdir()):
 if p.suffix not in ['.pdf','.blend','.skp']:continue
 shutil.copy2(p,OUT/'documents'/p.name)
 manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p),'revision':NATIVE_REVISION})
shutil.copy2(ROOT/'FINAL-CLIENT-HANDOVER-V9.4.zip',OUT/'documents/FINAL-CLIENT-HANDOVER-V9.4.zip')
p=ROOT/'FINAL-CLIENT-HANDOVER-V9.4.zip'
manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p),'revision':NATIVE_REVISION})
with fitz.open(PLANS) as doc:
 for i,page in enumerate(doc):
  page.get_pixmap(matrix=fitz.Matrix(2,2)).save(str(OUT/f'plans/level-{i+1}.png'))
(OUT/'model/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f"Exported {len(kept)} existing-condition objects with unchanged source vertices and faces; {len(scenes)} current scenes.")
