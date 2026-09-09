import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const house = JSON.parse(
  readFileSync(new URL("../public/model/house.json", import.meta.url)),
);
const manifest = JSON.parse(
  readFileSync(new URL("../public/model/manifest.json", import.meta.url)),
);
const sha = (b) => createHash("sha256").update(b).digest("hex");
test("published asset is the V9.4 provisional source and has no duplicate objects", () => {
  assert.equal(house.version, manifest.model_revision);
  assert.equal(house.units, "inches");
  assert.equal(house.field_gate, "NOT_PASSED");
  // Derived from the export filter rather than pinned, so the gate owns the
  // invariant and a revision does not have to edit a literal.
  assert.equal(house.elements.length, manifest.web_objects);
  assert.equal(
    new Set(house.elements.map((e) => e.id)).size,
    manifest.web_objects,
  );
  assert.equal(house.source_sha256, manifest.model_sha256);
  assert.equal(house.source_sha256, manifest.source_sha256);
});
test("geometry uses finite source vertices, valid face indices and existing materials", () => {
  for (const e of house.elements) {
    assert(e.vertices.length > 0, e.id);
    for (const v of e.vertices)
      assert(v.length === 3 && v.every(Number.isFinite), e.id);
    for (const f of e.faces)
      assert(
        f.length >= 3 &&
          f.every(
            (i) => Number.isInteger(i) && i >= 0 && i < e.vertices.length,
          ),
        e.id,
      );
    assert(house.materials[e.material], e.id);
    for (const mat of e.face_materials || [])
      assert(house.materials[mat], e.id);
  }
});
test("source scene memberships refer only to current exported objects", () => {
  const ids = new Set(house.elements.map((e) => e.id));
  for (const scene of house.scenes)
    for (const id of scene.visible_ids)
      assert(ids.has(id), `${scene.name}: ${id}`);
  for (const scope of [
    "kitchen",
    "living-entry",
    "bedroom-01",
    "bedroom-02",
    "bathroom-02",
    "master-bath-wet",
    "Laundry",
    "patio-covered",
  ])
    assert(
      house.scenes.some((s) => s.scope === scope),
      scope,
    );
});
// The handover source files are not published in the public repository.
const documentsPresent = manifest.files.every((file) =>
  existsSync(new URL("../public/documents/" + file.name, import.meta.url)),
);
test(
  "every downloadable file matches the exact handover checksum",
  { skip: !documentsPresent },
  () => {
    for (const file of manifest.files) {
      const bytes = readFileSync(
        new URL("../public/documents/" + file.name, import.meta.url),
      );
      assert.equal(bytes.length, file.bytes, file.name);
      assert.equal(sha(bytes), file.sha256, file.name);
    }
  },
);
test("every material texture exists", () => {
  for (const mat of Object.values(house.materials))
    if (mat.texture)
      assert(
        existsSync(new URL("../public/model/" + mat.texture, import.meta.url)),
        mat.texture,
      );
});
const original = new URL("../../06-model/v9/model.json", import.meta.url);
test(
  "web export preserves exact V9.4 vertices, polygons and face materials",
  { skip: !existsSync(original) },
  () => {
    const bytes = readFileSync(original);
    assert.equal(sha(bytes), house.source_sha256);
    const data = JSON.parse(bytes);
    const expected = data.elements.filter(
      (e) =>
        ["EXISTING_REALISTIC", "EXISTING_ENHANCED_DETAIL"].includes(e.branch) &&
        !e.superseded_by_detail &&
        !e.client_exclude &&
        !e.hidden_in_existing_views,
    );
    assert.deepEqual(
      house.elements.map((e) => e.id),
      expected.map((e) => e.id),
    );
    for (let i = 0; i < expected.length; i++) {
      for (const key of ["vertices", "faces", "material", "face_materials"])
        assert.deepEqual(
          house.elements[i][key],
          expected[i][key],
          expected[i].id + " " + key,
        );
    }
  },
);

test("the natives are labelled with their own revision while a rebuild is pending", () => {
  if (manifest.native_status !== "PENDING_REBUILD") {
    assert.equal(manifest.native_revision, manifest.model_revision);
    return;
  }
  // Nothing may imply the .skp/.blend carry the current geometry.
  assert.notEqual(manifest.native_revision, manifest.model_revision);
  assert.ok(manifest.native_pending_reason);
  for (const f of manifest.files)
    assert.equal(f.revision, manifest.native_revision, f.name);
});
