/**
 * Mind Map Tests: data model and layouts
 * Pure logic from apps/mindmap — no browser needed.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

require('../../apps/mindmap/js/model.js');
require('../../apps/mindmap/js/layout.js');

const { MindMap, Layout } = globalThis;

function distance(a, b) {
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + dz ** 2);
}

describe('Mind map model', () => {
  test('sample map is a tree rooted at one node', () => {
    const map = MindMap.sample();
    assert.equal(map.root().text, 'Mind Map');
    assert.equal(map.children(map.rootId).length, 4);
    assert.equal(map.branch(map.rootId).length, map.nodes.size);
    map.all().forEach((node) => {
      if (node.id !== map.rootId) assert.ok(map.get(node.parentId), 'every node has a live parent');
    });
  });

  test('add() attaches a child and gives root branches their own colour', () => {
    const map = new MindMap();
    const root = map.setRoot('Root');
    const first = map.add('One', root.id);
    const second = map.add('Two', root.id);
    const leaf = map.add('Deep', second.id);

    assert.equal(map.nodes.size, 4);
    assert.equal(map.depth(leaf.id), 2);
    assert.notEqual(first.color, second.color);
    assert.equal(leaf.color, second.color, 'descendants inherit the branch colour');
  });

  test('remove() deletes the whole branch but never the root', () => {
    const map = MindMap.sample();
    const branch = map.children(map.rootId)[0];
    const size = branch.id ? map.branch(branch.id).length : 0;
    const before = map.nodes.size;

    assert.equal(map.remove(branch.id), true);
    assert.equal(map.nodes.size, before - size);
    assert.equal(map.get(branch.id), null);

    assert.equal(map.remove(map.rootId), false);
    assert.ok(map.root());
  });

  test('reparent() moves a branch and refuses cycles', () => {
    const map = new MindMap();
    const root = map.setRoot('Root');
    const a = map.add('A', root.id);
    const b = map.add('B', root.id);
    const child = map.add('A child', a.id);

    assert.equal(map.reparent(a.id, b.id), true);
    assert.equal(map.get(a.id).parentId, b.id);
    assert.equal(map.depth(child.id), 3);
    assert.equal(map.get(child.id).color, map.get(a.id).color);

    assert.equal(map.reparent(b.id, child.id), false, 'a node cannot become its own descendant');
    assert.equal(map.reparent(root.id, a.id), false, 'the root stays put');
  });

  test('toJSON()/fromJSON() round-trips structure and positions', () => {
    const map = MindMap.sample();
    Layout.radial(map, { force: true });
    Layout.seed3d(map, { force: true });

    const copy = MindMap.fromJSON(JSON.parse(JSON.stringify(map.toJSON())));
    assert.equal(copy.nodes.size, map.nodes.size);
    assert.equal(copy.rootId, map.rootId);
    map.all().forEach((node) => {
      const other = copy.get(node.id);
      assert.ok(other, `node ${node.id} survived the round-trip`);
      assert.equal(other.text, node.text);
      assert.equal(other.parentId, node.parentId);
      assert.equal(other.p2.x, node.p2.x);
      assert.equal(other.p3.z, node.p3.z);
    });
  });

  test('fromJSON() rejects junk and repairs orphans', () => {
    assert.equal(MindMap.fromJSON(null), null);
    assert.equal(MindMap.fromJSON({ nodes: [] }), null);

    const repaired = MindMap.fromJSON({
      rootId: 'root',
      nodes: [
        { id: 'root', text: 'Root', parentId: null },
        { id: 'orphan', text: 'Orphan', parentId: 'gone' }
      ]
    });
    assert.equal(repaired.get('orphan').parentId, 'root');
  });
});

describe('Mind map layouts', () => {
  test('radial() rings the root and keeps pinned nodes in place', () => {
    const map = MindMap.sample();
    const pinned = map.children(map.rootId)[0];
    Layout.radial(map, { force: true });

    const root = map.root();
    assert.deepEqual({ x: root.p2.x, y: root.p2.y }, { x: 0, y: 0 });
    map.children(map.rootId).forEach((child) => {
      assert.ok(Math.abs(distance(child.p2, root.p2) - Layout.RING) < 1, 'depth 1 sits on the first ring');
    });

    pinned.pinned = true;
    pinned.p2.x = 999;
    pinned.p2.y = -999;
    Layout.radial(map);
    assert.equal(pinned.p2.x, 999, 'a placed node is left alone');
  });

  test('seed3d() puts each depth on its own shell', () => {
    const map = MindMap.sample();
    Layout.seed3d(map, { force: true });
    map.all().forEach((node) => {
      const depth = map.depth(node.id);
      const radius = distance(node.p3, { x: 0, y: 0, z: 0 });
      assert.ok(Math.abs(radius - Layout.SHELL * depth) < 1, `depth ${depth} sits on its shell`);
    });
  });

  test('step3d() settles down and pins the root at the origin', () => {
    const map = MindMap.sample();
    Layout.seed3d(map, { force: true });

    let motion = 0;
    for (let i = 0; i < 400; i++) motion = Layout.step3d(map, 1 / 60);

    assert.ok(motion < 1, `layout cooled off (last motion ${motion})`);
    assert.deepEqual(map.root().p3, { x: 0, y: 0, z: 0 });
    map.all().forEach((node) => {
      assert.ok(Number.isFinite(node.p3.x + node.p3.y + node.p3.z), 'positions stay finite');
    });

    // Nothing should end up sitting on top of anything else.
    const nodes = map.all();
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        assert.ok(distance(nodes[i].p3, nodes[j].p3) > 20, 'nodes keep their distance');
      }
    }
  });

  test('bounds() covers every node', () => {
    const map = MindMap.sample();
    Layout.radial(map, { force: true });
    const box = Layout.bounds(map, 'p2');
    map.all().forEach((node) => {
      assert.ok(node.p2.x >= box.min.x && node.p2.x <= box.max.x);
      assert.ok(node.p2.y >= box.min.y && node.p2.y <= box.max.y);
    });
  });
});
