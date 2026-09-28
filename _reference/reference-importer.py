"""Reference importer: filled One Score PDFs -> app rules JSON. Shows the precedence logic."""
import json, sys
from pypdf import PdfReader
MAP = json.load(open('/mnt/user-data/outputs/one-score-philosophy-sheets/one-score-field-map.json'))
def resolve(pdfs):
    raw = {}
    for p in pdfs:
        for k, v in (PdfReader(p).get_fields() or {}).items():
            val = v.get('/V'); val = str(val).strip() if val is not None else ''
            if val and val not in ('/Off',): raw[k] = val
    rules, errors = {}, []
    dec = {d['key']: d for d in MAP['decisions']}
    for key, d in dec.items():                      # Layer 2
        ans = raw.get(key)
        if not ans: errors.append(f"{d['question']} (no answer)"); continue
        opt = next(o for o in d['options'] if o['label'] == ans)
        rules.update(opt['sets'])
        if not opt['sets']: rules['_custom_' + key] = True
    for f in MAP['fields']:
        k = f['key']
        if f['layer'] == 'decision': continue
        if k in raw:                                 # Layer 3 + Layer 4 override
            v = raw[k]
            if f['type'] == 'number':
                try: v = float(v)
                except ValueError: errors.append(f"{f['label']}: '{v}' is not a number"); continue
            rules[k] = True if v == '/Yes' else v
        elif f['required'] and not k.startswith('ath.'):
            errors.append(f"{f['sheet']}: {f['label']} is empty")
    return rules, errors
if __name__ == '__main__':
    r, e = resolve(sys.argv[1:]); print(json.dumps(dict(errors=e[:8], n_errors=len(e), n_rules=len(r)), indent=1))
